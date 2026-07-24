# Auditoria de Migração: `process_spot_products` → `fn_process_raw_v2`

- **Projeto Supabase:** `doufsxqlfjyuvxuezpln`
- **Data:** 2026-06-04
- **Fornecedor de referência (SPOT/Stricker):** `bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0`
- **Organização:** `5db5aee1-064b-4ef4-9193-345dcd8274ea`
- **Escopo:** validar exaustivamente se **todas** as funcionalidades da função legada
  `process_spot_products` foram contempladas pela nova `fn_process_raw_v2`, procurando
  falhas e gaps. Foram executados testes de integridade sobre **3.612 linhas raw,
  1.200 produtos, 3.612 variantes, 3.612 fontes de fornecedor e 56.440 batches**, além
  de **1 teste funcional end‑to‑end** (com rollback total, sem persistência).

---

## 1. Veredito

`fn_process_raw_v2` implementa um **superset** das funcionalidades de
`process_spot_products`. Todas as capacidades essenciais da função legada foram
preservadas **e** estendidas (variantes, fontes de fornecedor, mapeamentos
configuráveis, `locked_fields`, controle de erros granular, modo bulk, etc.).

A migração está **funcional e íntegra** nos dados existentes (0 órfãos, 0 duplicados,
0 erros), **porém** há **2 desvios comportamentais** e **1 defeito operacional** que
precisam de decisão/correção. Nenhum caller ficou quebrado: `process_spot_products` e
`clean_spot_name` foram removidas do banco e `process_pending_batches` já chama a v2.

| Severidade | Item | Status |
|---|---|---|
| 🟠 Médio | Limpeza de nome (`clean_spot_name`) **perdida** | ✅ **Corrigido** (migr. `20260604220000`) |
| 🟡 Baixo/Médio | Prefixo de SKU `SPOT-` deixou de ser aplicado | ✅ **Decidido**: manter sem prefixo (formato atual) — sem mudança |
| 🔴 Alto (operacional) | **56.428 batches vazios** (99,98%) por race condition de cron | ✅ **Corrigido** (migr. `20260604221000`) |

> **Atualização 2026-06-04 (remediação):** os itens 🟠 e 🔴 foram corrigidos e
> validados em produção. Detalhes ao final (§8).

---

## 2. As duas funções

### 2.1 Legada `process_spot_products` (hardcoded para SPOT)
Existiram duas versões nas migrações:

- `20260513000000_reconcile_orphan_functions_from_prod.sql` — versão **completa**:
  cria **produto + variantes + `variant_supplier_sources`**, com `clean_spot_name`,
  SKU `'SPOT-'||ProdReference`, batch e log de erro por produto.
- `20260602040000_fix_product_triggers_cascade_guard.sql` — versão **só‑produto** que
  adicionou o flag `app.bulk_import_mode` para suprimir triggers pesados.

Características (união das duas versões):
1. Cria batch em `supplier_import_batches` e finaliza com contadores.
2. Itera por `DISTINCT ON (raw_data->>'ProdReference')` em `supplier_products_raw`
   (`processed=false`, supplier e org **hardcoded**).
3. Produto: `name = clean_spot_name(Name)`, `sku = 'SPOT-'||ProdReference`,
   `supplier_reference = ProdReference`, `product_type='product'`, `is_active=true`,
   `ON CONFLICT (sku) DO UPDATE`.
4. Variantes (versão completa): `sku = raw 'Sku'`, nome `clean_spot_name(name) | color`,
   `attributes = {codigo_cor, cor}`, `ON CONFLICT (sku)`.
5. `variant_supplier_sources`: `cost_price = Price1`, `ON CONFLICT (variant_id,supplier_id)`.
6. Marca raw `processed=true, processed_at, product_id, import_batch_id`.
7. `app.bulk_import_mode = true/false` em volta do loop (v2 de 02/06).

### 2.2 Nova `fn_process_raw_v2(p_supplier_id uuid, p_batch_size int=100, p_bulk_mode bool=true)`
Motor **genérico, dirigido por configuração** (`supplier_settings` +
`supplier_field_mappings`), `SECURITY DEFINER`, retorna `jsonb`.

Capacidades adicionais frente à legada:
- Checagem de permissão (`is_admin_or_above`) quando há `auth.uid()`.
- `app.write_source='pipeline'` + respeito a `products.locked_fields`.
- Mapeamentos/transformações configuráveis via `fn_apply_transform` (lookup, custom,
  convert_unit, multiply…), `dimensions_display` via `fn_format_dimensions_display`.
- Nome de variante por **template** (`supplier_settings.variant_name_template`).
- Tratamento de erro **granular** (por parent e por variante) acumulado em `error_log`
  + `process_errors` por linha + contadores `products_errors`/`variants_errors`.
- Grava `variant_id` de volta na raw (a legada não gravava).
- `variant_supplier_sources` com `quantity`, `source='raw_v2'`, `is_preferred`.

---

## 3. Mapa de paridade funcional (feature-by-feature)

| # | Funcionalidade legada | `fn_process_raw_v2` | Resultado |
|---|---|---|---|
| 1 | Criação/fechamento de batch | ✅ (só cria se há trabalho) | **Paridade+** |
| 2 | `organization_id` | Derivado de `suppliers` (= mesmo valor) | **Paridade** |
| 3 | `supplier_reference` = ProdReference | ✅ mapping ativo | **Paridade** |
| 4 | `product_type='product'` | Via **default** da coluna (`'product'`) | **Paridade** |
| 5 | `is_active=true` | ✅ (+`active=true`) | **Paridade+** |
| 6 | Upsert de produto idempotente | ✅ (busca por supplier_reference) | **Paridade** |
| 7 | **`name = clean_spot_name(Name)`** | mapping `name` **direct** (sem limpeza) | **⚠️ GAP** |
| 8 | **`sku = 'SPOT-'||ref`** | `sku_prefix=''` ⇒ `sku = ref` | **⚠️ Desvio** |
| 9 | Variantes (`product_variants`) | ✅ + template + size/capacity/hex | **Paridade+** |
| 10 | `attributes={codigo_cor,cor}` | ✅ idêntico | **Paridade** |
| 11 | `variant_supplier_sources.cost_price` | ✅ (+quantity, source, is_preferred) | **Paridade+** |
| 12 | Marca raw processed/product_id/batch | ✅ (+`variant_id`, +`process_errors=NULL`) | **Paridade+** |
| 13 | Log de erro | ✅ granular (parent+variant) | **Paridade+** |
| 14 | `app.bulk_import_mode` | ✅ (`p_bulk_mode`) | **Paridade** |
| 15 | Retorno | `jsonb` (era `TABLE`) | **Mudança de contrato** |

---

## 4. Testes executados e evidências

### 4.1 Integridade dos dados existentes (3.612 raw / 1.200 prod / 3.612 var)
- `proc_no_product = 0`, `dangling_product = 0`, `dangling_variant = 0`.
- Produtos: `products_without_variants = 0`, `sku_ne_ref = 0`, `sku_null = 0`,
  `name_empty = 0`, `name_placeholder_leftover = 0` (nenhum produto preso em
  `'Produto <ref>'`).
- SKUs duplicados: **0** em produtos e **0** em variantes.
- Variantes: `name_empty = 0`, `color_not_in_name = 0`, `name_has_separator = 3612`
  (todas seguem o template).
- `variant_supplier_sources`: 3.612 linhas, `vss_null_cost = 0`, 1 VSS por variante.
- `raw_errors = 0`, `unprocessed = 0`.

> ⚠️ **Observação importante:** em **todos** os 3.612 raw, `variant_id IS NULL` e
> **0** VSS têm `source='raw_v2'`. Ou seja, **o dataset atual NÃO foi produzido pela
> `fn_process_raw_v2`** — veio do pipeline predecessor (SKUs sem prefixo `SPOT-`).
> Como não há raw pendente, a v2 roda como **no-op** em produção. Por isso o teste
> E2E sintético abaixo foi essencial para validar o comportamento real da função.

### 4.2 Execução idempotente real (sem pendências)
`SELECT fn_process_raw_v2('bcfc0d02…',100,true)` →
`{success:true, parents_processed:0, variants_processed:0, errors:[], batch_id:null}`.
Executa limpo, sem efeitos colaterais.

### 4.3 Teste funcional END-TO-END (sintético, rollback total)
Inserido 1 raw fictício (`ProdReference='ZZE2E_…'`, `Name='produto e2e teste'`,
`Price1='12.34'`, cor `RED/Vermelho/#FF0000`, `Size='M'`), chamada a v2 e, em seguida,
`RAISE EXCEPTION` para **reverter tudo** (verificado: `raw_leak/prod_leak/var_leak/
vss_leak/batch_leak = 0`). Resultado capturado:

```json
{
  "fn_result": {"success": true, "parents_processed": 1, "variants_processed": 1, "errors": []},
  "product": {"found": true, "sku": "ZZE2E_…", "name": "produto e2e teste",
              "product_type": "product", "sync_status": "synced", "cost_price": 12.34,
              "brand": "MarcaE2E", "origin_country": "CN", "active": true},
  "variant": {"found": true, "sku": "ZZSKU_ZZE2E_…",
              "name": "produto e2e teste | Vermelho | M",
              "color_code": "RED", "color_name": "Vermelho", "color_hex": "#FF0000",
              "attributes": {"cor": "Vermelho", "codigo_cor": "RED"}},
  "vss": {"found": true, "cost_price": 12.34, "quantity": 0, "source": "raw_v2", "is_preferred": true},
  "raw_after": {"processed": true, "product_id_set": true, "variant_id_set": true}
}
```

**Conclusão do E2E:** a v2 cria produto + variante (template resolvido) +
`variant_supplier_sources` e atualiza a raw corretamente. Também **comprova os 2
desvios**: o nome ficou `"produto e2e teste"` (sem capitalização/limpeza que o
`clean_spot_name` fazia) e o SKU do produto ficou `"ZZE2E_…"` (sem prefixo `SPOT-`).

---

## 5. Gaps e defeitos

### 🟠 GAP-1 — Limpeza de nome (`clean_spot_name`) perdida
A legada aplicava `clean_spot_name(Name)` em produto e variante. Na v2 o mapping de
`name` é `transform_type='direct'` (texto cru). A função `clean_spot_name` era **órfã
de produção** (sem `CREATE` nas migrações) e foi **removida** — sua lógica exata é
irrecuperável a partir do repositório. Evidência indireta: os 1.200 produtos atuais
têm nome com 1ª letra maiúscula/normalizado (ex.: *"Garrafa de desporto…"*), enquanto
a v2 preserva o texto cru (E2E: `"produto e2e teste"`). **Risco:** produtos
processados pela v2 ficarão com nomes inconsistentes em relação ao acervo histórico.
**Remediação sugerida:** recriar a normalização como `transform_type='custom'`
(ex.: `fn_clean_spot_name`/initcap + regras) e apontar o mapping `products.name` para ela.

### 🟡 GAP-2 — Prefixo de SKU `SPOT-` removido
`supplier_settings.sku_prefix = ''` ⇒ a v2 gera `sku = ProdReference` (sem `SPOT-`).
Os 1.200 produtos atuais já estão sem prefixo (consistente internamente, e a v2 busca
por `supplier_reference`, então **não há risco de duplicação**). Porém é uma **mudança
de contrato de SKU**: qualquer integração externa que dependa de `SPOT-XXXX` quebra.
**Remediação:** decidir formato canônico; se `SPOT-` for desejado, setar
`supplier_settings.sku_prefix='SPOT-'` **e** reconciliar os SKUs existentes.

### 🔴 DEFEITO-1 — 56.428 batches vazios (99,98%) por race condition de cron
Há **dois cron jobs no mesmo schedule `*/5 * * * *`**:
- `jobid 1`: `SELECT * FROM process_pending_batches();` (que internamente também chama
  `fn_process_raw_v2('bcfc0d02…',1000,true)` — até 10× por execução).
- `jobid 2`: `SELECT fn_process_raw_v2('bcfc0d02…',100,true);`

Ambos processam o **mesmo fornecedor concorrentemente** no mesmo tique. A v2 abre um
batch quando `EXISTS` raw pendente; sob concorrência, o "perdedor" da corrida abre o
batch e, no loop, não encontra mais linhas (já processadas/bloqueadas pelo outro),
gerando **batch vazio**. Medições: **56.440 batches** do SPOT, **56.428 vazios
(99,98%)**, apenas **12 com conteúdo**; ~253 criados nas últimas 24h. Tabela já com
~9,9 MB de bloat.

**Remediação sugerida (requer aprovação — altera cron/produção):**
1. Eliminar a duplicidade: manter **apenas um** job para o SPOT (remover `jobid 2`
   **ou** remover a chamada redundante dentro de `process_pending_batches`).
2. Tornar a v2 resiliente a corrida: usar `pg_try_advisory_xact_lock(p_supplier_id)`
   no início e/ou só abrir o batch **dentro** do loop quando houver ao menos 1 parent.
3. Purgar os batches vazios históricos
   (`DELETE … WHERE products_imported=0 AND variants_imported=0`).

---

## 6. Itens verificados que **não** são problema
- `process_spot_products` removida (0 no catálogo) e **0** referências em cron/funções.
- `process_pending_batches` atualizada para a v2 (cutover forward-only documentado).
- `parent_key_source='ProdReference'` ✅ e `variant_name_template` coerente.
- `product_type` coberto pelo **default** da coluna.
- Checagem de admin não bloqueia o cron (roda com `auth.uid() = NULL`).

---

## 7. Recomendações priorizadas
1. **(Alto)** Corrigir a duplicidade de cron + advisory lock na v2 e purgar batches vazios.
2. **(Médio)** Restaurar a normalização de nome como transform `custom` no mapping `name`.
3. **(Baixo)** Decidir o contrato de SKU (`SPOT-` vs cru) e padronizar.
4. **(Baixo)** Considerar reprocessar o acervo via v2 para popular `variant_id`/
   `source='raw_v2'` e unificar a normalização de nomes (opcional, alto volume).

> Nenhuma alteração de DDL/cron/dados foi aplicada nesta auditoria — apenas leitura e
> um teste E2E com rollback total. As remediações dos itens 1–3 podem ser implementadas
> mediante aprovação.

---

## 8. Remediação aplicada (2026-06-04)

### ✅ 🟠 Limpeza de nome — `20260604220000_fix_spot_name_cleaning.sql`
- Criada `fn_clean_spot_name(text)` (sentence-case: colapsa espaços, trim,
  1ª letra maiúscula, resto minúsculo) — reproduz o padrão dos 1.200 nomes atuais.
- Adicionado o branch `fn_clean_spot_name` ao CASE `custom` de `fn_apply_transform`.
- Mapping `products.name` migrado de `direct` → `custom`/`fn_clean_spot_name`.
- **Validação E2E (rollback):** raw `Name='  CANECA   de   PORCELANA   BRANCA  '`
  → produto `Caneca de porcelana branca`, variante `Caneca de porcelana branca | Branco`.

### ✅ 🔴 Race / batches vazios — `20260604221000_fix_raw_v2_race_and_batch_spam.sql`
- `fn_process_raw_v2` v2.1: `pg_try_advisory_xact_lock` por fornecedor (anti-race)
  + abertura **LAZY** do batch (só cria batch quando há ≥1 parent real).
- `process_pending_batches` simplificada (1 chamada à v2, sem loop redundante).
- Cron duplicado `process-marked-products` (jobid 2) **removido**;
  resta apenas `process-pending-products` (jobid 1).
- **Purge:** 56.428 batches vazios/não-referenciados removidos
  (SPOT: 56.440 → **12**).
- **Validações:** no-op não cria batch (delta=0, `batch_id=NULL`);
  `process_pending_batches()` → `SUCCESS`; cron sem duplicata.

> Nota: o espaço físico de `supplier_import_batches` é reclamado pelo job
> semanal `vacuum-analyze-weekly` (jobid 49), que já inclui a tabela.

### ✅ 🟡 Prefixo de SKU — decidido: manter sem prefixo
**Decisão (2026-06-04):** adotar formalmente o formato atual `sku = ProdReference`
(sem `SPOT-`). Os 1.200 produtos já usam esse formato, internamente consistente e
idempotente (lookup por `supplier_reference`). Reintroduzir `SPOT-` criaria
inconsistência (só novos) ou exigiria migração outward-facing de 1.200 SKUs com risco
de quebrar integrações. **Nenhuma mudança de dados é necessária** — o
`supplier_settings.sku_prefix=''` permanece como está.
