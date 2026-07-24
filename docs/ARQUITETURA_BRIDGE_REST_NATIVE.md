# 🌉➡️🗄️ A Mudança da "Bridge": de Edge Function para PostgREST Nativo

> **Sistema:** Gifts Store / Promo Gifts (`promo-gifts-v4`)
> **Idioma:** Português do Brasil 🇧🇷
> **Público-alvo:** Desenvolvedores novos e agentes de IA que precisam entender como o catálogo lê o banco hoje.
> **Status:** ✅ Em produção — 100% REST nativo (kill-switch `edge_external_db_bridge` = OFF, rollout 100%)
> **Validado em:** 30/05/2026 (código `@72dab92` + estado vivo do Supabase `doufsxqlfjyuvxuezpln`)

---

## 0. TL;DR (leia isto primeiro)

- A **"bridge"** era a Edge Function `external-db-bridge` — um proxy Deno que ficava **entre o navegador e o Postgres**. Todo SELECT/INSERT/UPDATE/DELETE do catálogo passava por ela.
- Ela foi **aposentada**. Hoje o frontend fala **direto com o PostgREST** do Supabase via `supabase.from(...)`.
- A troca é controlada por um **kill-switch** no banco (`system_kill_switches.edge_external_db_bridge`). Estado atual: **`enabled=false`, `rollout=100`** → **100% REST nativo**.
- ⚠️ **A Edge Function NÃO foi deletada.** Ela continua deployada (`ACTIVE`, v156). A aposentadoria é **lógica** (kill-switch OFF + um interceptor no cliente). A deleção física é o **último passo pendente**.
- **Rollback de emergência** é uma linha de SQL (vira o switch para `true`).
- **O que ainda NÃO migrou:** as **escritas** (INSERT/UPDATE/DELETE) de telas admin. Com a bridge OFF, elas viram **no-op silencioso** — essa é a "lacuna de escrita" conhecida.

```
ANTES:  Browser ──▶ external-db-bridge (Edge Function Deno) ──▶ PostgREST ──▶ Postgres
DEPOIS: Browser ──────────────────────────────────────────▶ PostgREST ──▶ Postgres
```

---

## 1. Por que mudamos

A bridge resolvia um problema legítimo (centralizar acesso e esconder colunas sensíveis), mas cobrava caro:

| Problema da bridge | Impacto |
|---|---|
| **Cold start** do Deno (~88 KB de código) | P50 ~150 ms quente, mas **~1500 ms frio**. Catálogo lento e instável. |
| **CORS no preview** | O header global `x-application-name: gifts-store-web` era rejeitado no preflight em domínios fora da allowlist (ex.: preview do Lovable) → erros `ERR_FAILED`/CORS. |
| **Hop de rede extra** | Browser → Edge → PostgREST → Postgres, em vez de Browser → PostgREST → Postgres. |
| **Superfície de manutenção** | 88 KB de Deno + lógica de retry/backoff duplicando o que o PostgREST já faz. |

**Resultado da migração:** P50 ~80 ms, **zero cold start**, sem CORS no caminho público. Validado com **94 cenários HTTP, 0 falhas** (ver `docs/REST_NATIVE_MIGRATION.md`).

---

## 2. Onde mora o código

Tudo que diz respeito à bridge/REST-nativo vive em **`src/lib/external-db/`**. Mapa dos arquivos que importam:

| Arquivo | Papel |
|---|---|
| **`bridge.ts`** | 🧠 Núcleo. `invokeExternalDb()` (REST-native-first), `invokeBatchBridge()` (decompõe lote), `invokeExternalDbDelete()`. Mantém `invokeBridge()` legado **só para rollback**. |
| **`rest-native.ts`** | 🗺️ O coração da migração. Whitelist de tabelas, `TABLE_ALIASES` (→ VIEWs de segurança), adaptador de colunas PT/EN, parser de operadores PostgREST, retry, limitador de concorrência e métricas. |
| **`kill-switch-client.ts`** | 🔀 Lê `system_kill_switches` com rollout A/B (`fn_should_apply_kill_switch`), cache em camadas (memória 60 s / localStorage 5 min) e **fail-open**. |
| **`bridge-compat.ts`** | 🔌 Shim drop-in `invokeExternalDbBridge(body)` — mesmo contrato de resposta da bridge antiga. |
| **`bridge-interceptor.ts`** | 🪝 Faz **monkey-patch** em `supabase.functions.invoke` no boot (importado **primeiro** em `main.tsx`). Captura TODA chamada a `external-db-bridge` e roteia pelo shim, **sem editar os callers**. |
| **`bridge-status-events.ts`** | 📣 Event bus `degraded`/`unavailable`/`recovered` que alimenta os banners de UI. |
| **`health-check.ts`** | 🩺 `pingHealth()`/`waitForBridgeReady()` viraram **stubs `ok:true`** — bridge aposentada ≠ falha de infra. |
| **`silent-empty-report.ts`** | 🔎 Diagnóstico: classifica retornos vazios silenciosos (`table_not_whitelisted`, `write_bridge_off`, `rest_error`). |

**Wiring crítico** — em `src/main.tsx`, antes de qualquer componente React:
```ts
// Bridge interceptor: patches supabase.functions.invoke to route
// external-db-bridge calls through REST native. Must be imported
// BEFORE any React component renders.
import './lib/external-db/bridge-interceptor';
```

---

## 3. Ciclo de vida de uma leitura (o caminho feliz)

```
invokeExternalDb({ table, operation:'select', filters, ... })
  │
  ├─ 1. Lê o kill-switch (cache barato, fail-open) → bridgeEnabled?
  │
  ├─ 2. isRestNativeEligible()?  (SELECT + tabela na whitelist)
  │        SIM ─▶ tryExecuteRestNative()
  │                 ├─ resolve TABLE_ALIASES (products → v_products_public)
  │                 ├─ remapeia colunas PT/EN se preciso (tecnicas_gravacao)
  │                 ├─ traduz filtros → operadores PostgREST (.eq/.in/.ilike/...)
  │                 ├─ _search → .ilike('%termo%')  (índice GIN trigram)
  │                 ├─ 1 retry em erro transitório
  │                 └─ retorna { records, count }   ✅ FIM
  │
  └─ 3. Não elegível / REST falhou:
           ├─ bridge OFF  ─▶ retorna { records: [], count: 0 } (vazio gracioso)
           │                 + reportSilentEmpty(motivo) para diagnóstico
           └─ bridge ON   ─▶ invokeBridge() com guarda de CORS/410 (rollback)
```

Para **lotes** (`invokeBatchBridge`): com a bridge OFF, o `KillSwitchActiveError` faz o sistema **decompor o lote em N chamadas REST nativas individuais** (`decomposeBatchToIndividual`, concorrência 6). É por isso que o catálogo carrega normalmente mesmo "sem bridge".

---

## 4. Whitelist, VIEWs de segurança e aliases

Só tabelas **explicitamente liberadas** podem ir por REST nativo (`REST_NATIVE_SAFE_TABLES` em `rest-native.ts`). Hoje são **23 entradas**.

### 4.1 Tabelas e contagem aproximada
| Tabela / View | Linhas | Observação |
|---|---|---|
| `products` / `v_products_public` | ~6.123 | leitura pública via VIEW |
| `product_variants` | ~16.456 | |
| `product_images` | ~46.122 | |
| `product_videos` | ~139 | |
| `product_kit_components` | ~3.424 | |
| `product_materials` | ~9.645 | |
| `suppliers` / `v_suppliers_public` | ~5 | leitura via VIEW |
| `color_variations` / `color_groups` | ~80 / ~18 | |
| `categories` | ~463 | |
| `material_types` | ~91 | |
| `print_area_techniques` / `v_print_area_techniques_public` | ~13.238 | leitura via VIEW |
| `tabela_preco_gravacao_oficial` (+ `_faixa`) | ~52 / ~884 | |
| `tecnicas_gravacao` | ~16 | colunas em PT (ver 4.3) |
| `ramo_atividade` | ~22 | |
| `system_kill_switches` | ~6 | o próprio switch |

### 4.2 VIEWs de segurança (✅ existem no banco, validado 30/05)
A bridge escondia colunas sensíveis no servidor. O REST nativo replica isso roteando a leitura para **VIEWs públicas** via `TABLE_ALIASES`:

| Alias (o que o app pede) | VIEW real (o que é lido) | Oculta |
|---|---|---|
| `products` | `v_products_public` | `cost_price`, `suggested_price`, `supplier_reference`, IPI |
| `suppliers` | `v_suppliers_public` | `api_credentials`, `default_markup_percent`, `cnpj`, `notes`, `api_base_url` |
| `print_area_techniques` | `v_print_area_techniques_public` | `unit_cost`, `notes` |

> Ambas com `security_invoker=false` e `GRANT SELECT` para `anon` + `authenticated`.

### 4.3 Aliases de tabela e de coluna (compatibilidade)
A bridge usava nomes "lógicos" que não existem no Postgres. O REST nativo traduz:

| Alias da bridge | Tabela real |
|---|---|
| `tecnica_gravacao` | `tabela_preco_gravacao_oficial` |
| `customization_price_tiers` | `tabela_preco_gravacao_oficial_faixa` |
| `personalization_techniques` | `tecnicas_gravacao` |

**Adaptador PT/EN (ONDA-17):** `tecnicas_gravacao` tem colunas em português. O `COLUMN_ALIASES_BY_TABLE` remapeia tanto na ida (filtros/order) quanto na volta (remonta o shape legado `id/code/name/is_active/display_order` a partir de `codigo/nome/ativo/ordem_exibicao`).

---

## 5. O kill-switch (e o rollout A/B)

A consulta vive em `system_kill_switches`; a decisão por cliente passa pela RPC `fn_should_apply_kill_switch` (✅ ambas existem).

**Estado atual (validado 30/05/2026):**
```
switch_name = edge_external_db_bridge
enabled = false        ← bridge desligada
rollout_percentage = 100   ← para 100% dos clientes
→ 100% REST nativo
```

**Semântica (tabela-verdade em `resolveEffectiveState`):**
| `enabled` | `shouldApply` (rollout) | Efeito |
|---|---|---|
| `true` | — | Bridge LIGADA (permite invoke) |
| `false` | `undefined` (cache antigo) | Bridge OFF (modo legado, 100%) |
| `false` | `true` | No bucket de teste → Bridge OFF |
| `false` | `false` | Fora do rollout → comportamento antigo (bridge ON) |

**Cache:** memória 60 s + localStorage 5 min (sobrevive a reload/troca de aba). **Fail-open:** se a consulta falhar, assume **ON** — a segurança real fica no back-end, isto é só uma camada.

**Consultar / fazer rollback:**
```sql
-- Estado atual
SELECT switch_name, enabled, rollout_percentage
FROM public.system_kill_switches
WHERE switch_name = 'edge_external_db_bridge';

-- ROLLBACK DE EMERGÊNCIA (volta 100% para a bridge)
UPDATE public.system_kill_switches SET enabled = true
WHERE switch_name = 'edge_external_db_bridge';
```
> Docs de apoio: `docs/PATCH_external_db_bridge_kill_switch.md`, `docs/PLANO_AB_DESLIGAMENTO_SWITCH.md`.

---

## 6. A camada de compatibilidade (por que nada quebrou)

Havia **~80 chamadas diretas** a `supabase.functions.invoke('external-db-bridge')` espalhadas em hooks de admin/intelligence. Em vez de editar todas, a estratégia foi dupla:

1. **`bridge-compat.ts`** — `invokeExternalDbBridge(body)`: drop-in com o **mesmo contrato** (`data.success`, `data.data.records`, `data.data.count`, `data.error`).
   - `select`/`rpc` → roteia por `invokeExternalDb()` (REST nativo).
   - `ping` → responde "configurado" sem rede.
   - `insert/update/delete/...` → tenta a Edge Function com guarda de **410/CORS** e devolve erro claro ("operação temporariamente indisponível — a bridge foi descontinuada").
2. **`bridge-interceptor.ts`** — faz patch global no `supabase.functions.invoke`, então **toda** chamada à `external-db-bridge` cai no shim automaticamente. Demais Edge Functions (`manage-users`, `secrets-manager`, etc.) passam intactas.

> Quando todos os callers forem migrados individualmente, o interceptor pode ser removido.

---

## 7. Degradação graciosa e os banners

| Caso | Comportamento |
|---|---|
| Tabela fora da whitelist (bridge OFF) | `[]` silencioso + `reportSilentEmpty('table_not_whitelisted')` |
| SELECT elegível que deu erro (bridge OFF) | `[]` silencioso + `reportSilentEmpty('rest_error')` |
| Escrita com bridge OFF | no-op + `reportSilentEmpty('write_bridge_off')` (nível erro, acionável) |
| PostgREST fora do ar | bridge OFF → `{ records: [], count: 0 }` |
| Alias → tabela inexistente | `[]` silencioso |

**Banners — ponto de atenção histórico:** o ramo "kill-switch OFF" em `invokeBridge()` **deixou de emitir** o evento `unavailable`. Antes, ele acendia os 3 banners de "catálogo indisponível" **em todo carregamento de catálogo**, mesmo com os dados chegando via decomposição REST. Hoje o `unavailable` só é emitido em **outage real com a bridge LIGADA** (loop de retry). Se você vir banner de indisponibilidade com a bridge OFF, é regressão.

---

## 8. ⚠️ Lacuna conhecida: ESCRITAS (admin CRUD)

A migração cobriu **leituras**. As **escritas** (INSERT/UPDATE/DELETE) de telas administrativas ainda dependiam da bridge. Com a bridge OFF:

- elas viram **no-op silencioso** (delete) ou retornam erro de "temporariamente indisponível" (via shim, no caminho 410);
- a correção definitiva é migrar essas mutações para o **cliente Supabase direto** (`supabase.from(...).insert/update/delete`) com RLS adequada — tratada separadamente da migração de leitura.

Se um dev novo for mexer em CRUD de produtos/fornecedores/técnicas, **este é o ponto onde "salva mas não persiste"** pode acontecer. Confirme o caminho de escrita antes.

---

## 9. Estado vivo do servidor (validado 30/05/2026)

| Item | Estado |
|---|---|
| Kill-switch `edge_external_db_bridge` | `enabled=false`, `rollout=100` (atualizado 30/05 00:28 UTC) |
| RPC `fn_should_apply_kill_switch` | ✅ existe |
| VIEW `v_products_public` | ✅ existe |
| VIEW `v_suppliers_public` | ✅ existe |
| VIEW `v_print_area_techniques_public` | ✅ existe |
| Edge Function `external-db-bridge` | ⚠️ **AINDA DEPLOYADA** — `ACTIVE`, v156, `verify_jwt=false` |

> A função estar "ACTIVE" significa apenas que o **deploy existe** — o cliente não a chama (kill-switch OFF + interceptor). Ela é candidata à deleção (passo 10).

---

## 10. Passos finais de aposentadoria (decommission)

- [ ] **+7 dias estável** sem rollback → **deletar** a Edge Function `external-db-bridge` (remove ~88 KB de Deno morto).
- [ ] Migrar as **escritas** admin para cliente Supabase direto (fecha a lacuna da Seção 8).
- [ ] Após deletar a função: remover `invokeBridge()` legado, `bridge-interceptor.ts` e `bridge-compat.ts`, e simplificar `bridge.ts` para REST-native puro.
- [ ] Rodar `supabase gen types` para tipar `system_kill_switches` (hoje há cast manual em `kill-switch-client.ts`).

---

## 11. Glossário rápido para IAs/devs

- **bridge** = Edge Function `external-db-bridge` (aposentada logicamente).
- **REST nativo** = `supabase.from(tabela).select(...)` direto no PostgREST.
- **kill-switch** = linha em `system_kill_switches` que liga/desliga a bridge; `enabled=false` = REST nativo.
- **whitelist** = `REST_NATIVE_SAFE_TABLES` em `rest-native.ts`; só essas tabelas vão por REST nativo.
- **VIEW de segurança** = `v_*_public`, esconde colunas de custo/credenciais.
- **silent-empty** = retorno `[]` proposital, classificado para diagnóstico (não é erro de UI).
- **lacuna de escrita** = mutações admin ainda não migradas; com bridge OFF viram no-op.
- **ONDA-NN / Caminho B / PRs #230-232** = nomes internos das fases da migração.

---

## 12. Documentos relacionados

- `docs/REST_NATIVE_MIGRATION.md` — resumo da migração (métricas, RLS adicionadas/removidas).
- `docs/PATCH_external_db_bridge_kill_switch.md` — espelho back-end do kill-switch.
- `docs/PLANO_AB_DESLIGAMENTO_SWITCH.md` — plano de rollout A/B.
- `docs/EDGE_FUNCTIONS.md` — catálogo de todas as Edge Functions.

---

**Mantido por:** equipe Promo Gifts (adm01-debug)
**Fonte de verdade:** código em `src/lib/external-db/` + `system_kill_switches` no Supabase
**Última validação:** 30/05/2026
