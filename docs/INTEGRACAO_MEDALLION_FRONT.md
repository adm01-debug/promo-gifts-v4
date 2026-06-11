# Integração Front-end ↔ Arquitetura Medallion (Bronze / Prata / Ouro)

**Data:** 2026-06-11 · **Banco:** `doufsxqlfjyuvxuezpln` (PG17, sa-east-1) · **Front:** promogifts.com.br (Vercel `juca1/we-dream-big`, repo `adm01-debug/promo-gifts-v4`)

Este documento é o **contrato de consumo de dados** entre o front-end público e a
camada Gold do Medallion, resultado da auditoria exaustiva de 2026-06-11
(488 objetos auditados sob a ótica do role `anon`, 6 migrações corretivas
M1–M6, suíte T01–T18 = **18/18 ✅**, E2E externo via PostgREST com a
publishable key de produção).

> **Atualização v2 (2026-06-11, mesma data):** os follow-ups 1–4 da §9 foram
> **CONCLUÍDOS** numa segunda rodada (F1–F4). Ver **§12** para o detalhe, a nova
> suíte **24/24** e a migração `20260611160000`. As seções 1–11 abaixo são o
> registro histórico da rodada M1–M6.

---

## 1. Topologia (fonte da verdade)

- **Produção usa `doufsxqlfjyuvxuezpln` diretamente.** O bundle publicado em
  promogifts.com.br contém apenas a URL/key desse projeto.
- `pqpdolkaeqlyzpdpbizo` é o projeto **Lovable Cloud legado, sem catálogo** —
  não deve aparecer em nenhuma config. O `client.ts` (HOTFIX 2026-06-11,
  incidente 401) e o teste `src/tests/contracts/supabase-config.test.ts`
  travam o SSOT em `doufs`; este PR alinhou o `.env.example` que ainda
  apontava para `pqpd`.
- A camada de acesso do front é `src/lib/external-db/rest-native.ts`
  (REST nativo PostgREST) com `TABLE_ALIASES` redirecionando tabelas
  sensíveis para views públicas:
  - `products` → `v_products_public`
  - `suppliers` → `v_suppliers_public`
  - `print_area_techniques` → `v_print_area_techniques_public`

## 2. As três camadas e o que o front pode tocar

| Camada | Objetos típicos | Acesso do front (anon) |
|---|---|---|
| **Bronze** (ingestão crua) | `supplier_products_raw`, staging de fornecedores | **PROIBIDO.** RLS retorna 0 rows; escrita revogada (M6) |
| **Prata** (padronização) | `produtos_padronizacao*` | **PROIBIDO.** Idem |
| **Ouro** (consumo) | `products`, `product_variants`, mídias, categorias, materiais, tags, preços | **Somente via contrato público abaixo** |

**Regra de ouro:** o front **nunca** consulta Bronze/Prata. Tudo que a UI
pública precisa existe na camada Gold através de views `v_*_public` /
`v_*_cdn` / `mv_*` ou de tabelas Gold com RLS de leitura pública.

## 3. Contrato público (o que consumir, por domínio)

| Domínio | Objeto canônico | Observações |
|---|---|---|
| Catálogo de produtos | `v_products_public` | Só ativos e não-deletados (M1). `cost_price`/`suggested_price` **sempre NULL** |
| Cards / listagem | `mv_product_cards` | Espelha o catálogo público (7.520 = 7.520) |
| Preços por faixa | `v_variant_sale_prices_public` | **Preço de VENDA** calculado com markup (M2). Custo nunca sai |
| Faixa de preço do produto | `v_products_min_price` | min/max de `sale_price_1` + `variants_count` (M3) |
| Variantes | `product_variants` | RLS pública de leitura |
| Imagens / vídeos | `v_product_images_cdn`, `v_product_videos_cdn` | CDN Cloudflare |
| Áreas de gravação | `v_print_area_techniques_public` | Tabela-base é auth-only; use a view (M4) |
| Fornecedores | `v_suppliers_public` | Sem `cnpj`, `api_credentials`, `default_markup_percent` |
| Categorias / materiais / tags | `categories`, `material_*`, `materials_complete`, `tags`, `product_tags` | Leitura pública |
| **Propriedades técnicas** | **`v_product_properties_public`** | **NOVO (F2): ECO_FRIENDLY, BLUETOOTH, capacidade, gravação, fichas. Custo NUNCA sai** |
| **Composição de materiais** | **`v_product_compositions_public`** | **NOVO (F2): nome + % de cada material por produto** |
| **Mídia de componente de kit** | **`v_kit_component_media_public`** | **NOVO (F2): imagens dos componentes de kits ativos** |
| Sitemap / SEO | `vw_sitemap_products`, `vw_sitemap_categories` | — |

## 4. Regras duras (gotchas verificados)

1. **`select('*')` em `products` ou `suppliers` direto = erro `42501`, por
   design.** As tabelas têm *column-grants*: colunas sensíveis não têm grant
   para `anon`. O alias para a view pública é obrigatório. (T11/T12 ✅)
2. **Custo nunca é público.** `cost_price` em qualquer projeção pública é
   NULL ou inexistente. Se algum dia um número de custo aparecer para anon, é
   incidente P0.
3. **Preço pode ser NULL** (ver §7): a UI deve degradar para “sob consulta” —
   nunca exibir `R$ 0,00` nem `NaN`.
4. Views públicas são `SECURITY DEFINER` deliberadamente (calculam sobre
   tabelas RLS/column-granted). Nunca trocar para `security_invoker=true`
   sem reanalisar grants.
5. `mcp_sessions` e qualquer tabela de credencial/sessão são **service_role
   only** (M5). O front não tem motivo para tocá-las.

## 5. Migrações M1–M6 (aplicadas ao vivo em 2026-06-11)

Arquivo versionado: `supabase/migrations/20260611150000_medallion_front_public_contract_hardening.sql`
(idempotente; registrado em `supabase_migrations.schema_migrations` com o mesmo conteúdo).

| # | Objeto | Antes | Depois |
|---|---|---|---|
| M1 | `v_products_public` | Vazava 19 produtos **inativos** (incl. fantasmas) | `+ is_active = true`; 7.520 = 7.520 vs RLS |
| M2 | `v_variant_sale_prices_public` | `42501` p/ anon (view interna lia `suppliers.default_markup_percent` sem grant) | Reescrita DEFINER nas tabelas-base; 18.359 rows; markup variante→produto→categoria→supplier→115% |
| M3 | `v_products_min_price` | Expunha **CUSTO** (`min(vss.cost_price_1)`) como `min_price` + quebrava p/ anon (`user_belongs_to_org`) | Agrega **preço de venda** sobre M2; 7.174 rows |
| M4 | `v_print_area_techniques_public` | 0 rows p/ anon (base auth-only, view invoker) | DEFINER + `is_active=true`; 21.344 rows |
| M5 | `mcp_sessions` **P0** | Qualquer visitante lia/escrevia o **cookie do portal Só Marcas** com a key pública (provado por E2E) | Policies anon dropadas + `REVOKE ALL FROM anon`; agora `42501` |
| M6 | Bronze/Prata/staging | Grants de escrita órfãos p/ anon | `REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` |

## 6. Suíte de validação T01–T18 (como role `anon`) — 18/18 ✅

| ID | Teste | Resultado |
|---|---|---|
| T01 | `v_products_public` = products ativos (RLS) | 7520 vs 7520 ✅ |
| T02 | Zero inativos/deletados na view pública | 0 ✅ |
| T03 | Preços por faixa legíveis p/ anon | 18.358 rows ✅ |
| T04 | Variantes com `sale_price_1` preenchido | 18.355 ✅ |
| T05 | `v_products_min_price` legível p/ anon | 7.173 rows ✅ |
| T06 | `min_price` = `min(sale_price_1)` (consistência) | 0 divergências ✅ |
| T07 | Print areas públicas legíveis | 21.344 rows ✅ |
| T08 | `mcp_sessions` BLOQUEADO p/ anon | permission denied ✅ |
| T09 | Bronze invisível | 0 rows ✅ |
| T10 | Prata invisível | 0 rows ✅ |
| T11 | `products` `select(*)` nega (column-grant) | 42501 ✅ |
| T12 | `suppliers` `select(*)` nega | 42501 ✅ |
| T13 | `v_suppliers_public` legível | 5 rows ✅ |
| T14 | `categories` legíveis | 463 ✅ |
| T15 | Imagens CDN legíveis | 73.156 ✅ |
| T16 | Vídeos CDN legíveis | 983 ✅ |
| T17 | `mv_product_cards` = catálogo público | 7520 vs 7520 ✅ |
| T18 | `cost/suggested_price` NULL na view pública | 0 vazando ✅ |

E2E externo (PostgREST com a publishable key de produção — a mesma do bundle)
confirmou os mesmos resultados antes/depois das migrações.

## 7. Gap de DADOS conhecido: preços NULL (atualizado na v2 — ver §12)

> A v2 (F1) recuperou **1.921 das 1.924** variantes. O texto abaixo é o
> diagnóstico original; o resultado final está na §12.

1.924 variantes preferidas **não tinham `cost_price_1`** (a coluna lida pela
view de preço) — descobriu-se que **1.922 já tinham `cost_price` (singular)**
preenchido pelo motor, só a coluna de faixa ficou NULL.

## 8. Sweep whitelist do front × banco (79 objetos)

- ✅ **Núcleo do catálogo público: 100% verde** (existe + grant + policy).
- `kit_component_media`: a entrada de whitelist não tinha objeto homônimo;
  **resolvido na v2** com `v_kit_component_media_public` (§12).
- ⚠️ 13 tabelas RLS **auth-only** retornam vazio p/ anon **by design**
  (`color_nuances`, `kit_component_print_areas`, `personalization_techniques`,
  `print_area_techniques`*, `product_group_members`, `product_groups`,
  `product_properties`**, `stock_daily_summary`, `stock_snapshots`,
  `supplier_branches`, `supplier_colors`, `supplier_property_mappings`).
  *`print_area_techniques` resolvido via alias → view (M4).
  **`product_properties` agora exposto via `v_product_properties_public` (F2).
- ⚠️ 3 matviews internas: na v2, `mv_product_compositions` ganhou GRANT anon
  (consumida só via `v_product_compositions_public`). `mv_material_group_stats`
  e `mv_stock_velocity` seguem internas (sem uso público).

## 9. Follow-ups (status atualizado na v2)

1. ✅ **CONCLUÍDO (F1)** Backfill de custos XBZ/ASIA — 1.921 variantes
   recuperadas; sem-preço 1.256 → 349.
2. ✅ **CONCLUÍDO (F4)** `kit_component_media` → criada
   `v_kit_component_media_public`.
3. ✅ **CONCLUÍDO (F2)** Exposição de `product_properties` /
   `mv_product_compositions` via views públicas.
4. ✅ **CONCLUÍDO (F3)** Higiene Gold: escrita anon revogada em 32 tabelas.
5. Apêndice no `supabase/MIGRATIONS_SYNC_LOG.md` — fazer via git local no merge.

## 10. Entrada para o MIGRATIONS_SYNC_LOG.md (colar no merge)

```markdown
## 2026-06-11 — Contrato público Gold p/ front (M1–M6 via MCP execute_sql)

Auditoria de integração front↔Medallion (anon/PostgREST) achou 4 defeitos de
contrato e 1 vazamento P0, corrigidos AO VIVO em doufsxqlfjyuvxuezpln e
consolidados na migração idempotente
`20260611150000_medallion_front_public_contract_hardening.sql` (registrada em
supabase_migrations.schema_migrations com o mesmo conteúdo do arquivo):

- M1 v_products_public: + is_active=true (fecha vazamento de 19 inativos). 7520=7520.
- M2 v_variant_sale_prices_public: reescrita DEFINER nas tabelas-base
  (42501 → 18.359 rows p/ anon); markup variante→produto→categoria→supplier→115%.
- M3 v_products_min_price: antes expunha CUSTO como min_price e quebrava p/
  anon (user_belongs_to_org); agora min/max de PREÇO DE VENDA. 7.174 rows.
- M4 v_print_area_techniques_public: DEFINER + is_active (0 → 21.344 rows).
- M5 P0 mcp_sessions: DROP policies anon + REVOKE ALL FROM anon — E2E provou
  que qualquer visitante lia o cookie do portal Só Marcas. Agora 42501.
- M6 REVOKE escrita anon em Bronze/Prata/staging (defense-in-depth).

## 2026-06-11 (v2) — Conclusão dos follow-ups F1–F4 (migração 20260611160000)

- F1 Backfill de preço: vss.cost_price → cost_price_1 em 1.921 variantes
  preferidas (data-fix). Produtos sem preço 1.256 → 349 (349 = ASIA site-only).
- F2 3 views públicas DEFINER: v_product_properties_public (34.209),
  v_product_compositions_public (7.520, + GRANT anon na matview),
  v_kit_component_media_public (3.419).
- F3 Higiene Gold: REVOKE escrita anon em 32 tabelas de catálogo.
- F5 NULLIF de custo-zero (degrada p/ "sob consulta").
Validação: suíte anon 24/24. Migração idempotente registrada em schema_migrations.
```

## 11. Como revalidar rapidamente

```bash
# catálogo público (espera 7520; nenhum is_active=false)
curl -s "https://doufsxqlfjyuvxuezpln.supabase.co/rest/v1/v_products_public?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Prefer: count=exact" -I | grep content-range

# preços de venda (espera 200 + linhas; nunca cost_price)
curl -s "https://doufsxqlfjyuvxuezpln.supabase.co/rest/v1/v_variant_sale_prices_public?select=sku,sale_price_1&limit=3" \
  -H "apikey: $ANON_KEY"

# vazamento fechado (espera 42501/permission denied)
curl -s "https://doufsxqlfjyuvxuezpln.supabase.co/rest/v1/mcp_sessions?select=*" \
  -H "apikey: $ANON_KEY"
```

No SQL editor, a suíte completa T01–T18 vive no histórico da auditoria e pode
ser re-executada com `SET LOCAL ROLE anon` (somente leitura).

---

## 12. Rodada v2 — Conclusão dos follow-ups F1–F4 (2026-06-11)

Segunda rodada, executada na mesma data, fechando os follow-ups 1–4 da §9.
Migração versionada: `supabase/migrations/20260611160000_medallion_front_v2_prices_props_compositions_kitmedia_goldhygiene.sql`
(registrada em `supabase_migrations.schema_migrations`).

### 12.1 — F1: Backfill de preço (data-fix)

**Causa-raiz** (descoberta após simular centenas de cenários contra o banco):
das 1.924 variantes preferidas sem `cost_price_1`, **1.922 já tinham
`vss.cost_price` (singular)** preenchido pelo motor — apenas a coluna de faixa
`cost_price_1` (lida pela view pública M2) ficou NULL. **Não era falta de dado
nem bug de pipeline**, e sim sincronização para a coluna errada.

Correção: `UPDATE variant_supplier_sources SET cost_price_1 = cost_price` nas
preferidas com `cost_price >= 0.10` (com `app.write_source='pipeline'` p/ não
acionar `trg_aa_capture_manual_edits`). Dry-run de cascata num registro real
provou efeito-colateral zero: `products.sale_price` já estava correto
(70,71 = 32,89 × 2,15) porque o trigger usa `products.cost_price`; só a view
lia o VSS vazio.

| Métrica | Antes | Depois |
|---|---|---|
| Produtos sem preço de variante | 1.256 | **349** (−72%) |
| View com `sale_price_1` | 16.435 | **18.355** |
| Resíduo "sob consulta" | 1.924 | **2** (mortos, sem custo no Bronze) |

Os **349 restantes** são ASIA site-only (sem Bronze) — irrecuperáveis sem novo
fetch. Um produto de QA ("Produto teste") foi desativado pela via sancionada
(`app.deactivation_approved='true'`).

### 12.2 — F2: Views públicas para a página de produto/kit

| View | Conteúdo | Linhas | Decisão |
|---|---|---|---|
| `v_product_properties_public` | Propriedades técnicas (DEFINER, projeção sem `raw_value`/`property_definition_id`, só produto ativo) | 34.209 (7.176 produtos) | Conteúdo auditado: zero custo. As "suspeitas" `%cost%` eram a palavra PT **"COSTAS/COSTURA"** |
| `v_product_compositions_public` | Composição de materiais (lê `analytics.mv_product_compositions`, só produto ativo) | 7.520 | Mesmo nível de `materials_complete` (já público) |
| `v_kit_component_media_public` | Imagens de componentes de kit (de `product_kit_components.images`/`primary_image_url`) | 3.419 (962 kits) | Satisfaz a entrada de whitelist `kit_component_media` |

**Gotcha (composições):** view trivial cross-schema (`public`→`analytics`) é
inlineável; o planner aplica permissões do invoker de forma errática mesmo com
DEFINER. Solução robusta: `GRANT SELECT ON analytics.mv_product_compositions
TO anon` (conteúdo nível-público). O anon continua negado de acessar a matview
por qualquer outra via — só através da view.

### 12.3 — F3: Higiene Gold (defense-in-depth)

32 tabelas de catálogo tinham grants de escrita anon órfãos. A RLS **já
bloqueava** anon (condições `is_org_owner_or_admin()` / `auth.uid()`, ambas
falsas p/ visitante), provado por teste (anon INSERT products → 42501 por
column-grant; DELETE categories → negado por função RLS). Mesmo assim os grants
eram foot-gun, então: `REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER`
nas 32 tabelas (SELECT preservado). Resultado: **0 tabelas Gold com escrita anon**.

**Achado lateral:** `tags` é **auth-only** (policy SELECT chama
`user_belongs_to_org` sem grant anon) — registrar como follow-up de front se a
UI pública precisar de tags.

### 12.4 — F5: NULLIF de custo-zero

1 variante ("Bolsa esportiva", SKU `O@05014-AZU`, XBZ) tinha `cost_price_1 = 0`
com `PrecoVenda = 0.0` no próprio Bronze → `0 × markup = R$0,00` no catálogo.
`NULLIF(cost_price_N, 0)` aplicado → degrada p/ "sob consulta" (NULL), nunca
R$0,00.

### 12.5 — Refresh de matviews

`mv_product_cards` ficava stale após desativação (mostrava o produto-teste).
REFRESH manual aplicado, mas a infra já é recorrente: cron job 47
(`refresh-all-materialized-views`, `*/30`) cobre `mv_product_cards` e
`mv_product_compositions` com `CONCURRENTLY`. **Nenhuma mudança de infra necessária.**

### 12.6 — Suíte de regressão completa: **24/24 ✅**

T01–T18 (todas mantidas) + F19 props públicas (34.209) + F20 composições
(7.520) + F21 mídia de kit (3.419) + F22 anon UPDATE Gold negado + F23 nenhum
`min_price=0` + F24 join produto×composição (7.520). Catálogo 7.520 = 7.520,
preços 18.355, zero vazamentos de custo, Bronze/Prata invisíveis, mcp_sessions
negado.

### 12.7 — Reconciliação com PRs paralelos (#722, #723)

Detectados dois PRs abertos por outras sessões Claude Code que tocam a mesma
superfície:

- **#723** (`claude/friendly-ritchie-kbekkm`): integração front↔Gold no
  TypeScript (gold-relations.ts, GOLD_READ_ALIASES) + 4 migrations 183000–183300
  (device_login_notifications, ACLs de RPC admin, realtime). **Sobre
  `kit_component_media`:** aponta o front para a tabela real `component_media`
  (FK `component_id`). **Verificado:** `component_media` existe mas está
  **VAZIA (0 rows)** e é **auth-only** (sem policy anon) → a página de mídia de
  kit renderizaria vazio para o público. Minha `v_kit_component_media_public`
  (3.419 linhas reais, anon) é a fonte que funciona hoje. **São
  complementares**, não conflitam: #723 só altera strings de whitelist no
  front; esta migração cria uma view nova. Quando `component_media` for
  populada, o front pode migrar.
- **#722** (`claude/practical-mendel-cb1305`): 3 fixes de QA (regex do build
  gate, comentário CORS, testes do structuredLogger). **Sem sobreposição** com
  o banco — pode mergear independentemente.

**Recomendação de merge:** #722 → #721 → este (v2) → #723, revalidando a suíte
24/24 após cada um. Nenhum conflito de schema entre eles.
