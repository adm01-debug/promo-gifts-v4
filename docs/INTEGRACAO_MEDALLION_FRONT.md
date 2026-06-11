# Integração Front-end ↔ Arquitetura Medallion (Bronze / Prata / Ouro)

**Data:** 2026-06-11 · **Banco:** `doufsxqlfjyuvxuezpln` (PG17, sa-east-1) · **Front:** promogifts.com.br (Vercel `juca1/we-dream-big`, repo `adm01-debug/promo-gifts-v4`)

Este documento é o **contrato de consumo de dados** entre o front-end público e a
camada Gold do Medallion, resultado da auditoria exaustiva de 2026-06-11
(488 objetos auditados sob a ótica do role `anon`, 6 migrações corretivas
M1–M6, suíte T01–T18 = **18/18 ✅**, E2E externo via PostgREST com a
publishable key de produção).

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
| Cards / listagem | `mv_product_cards` | Espelha o catálogo público (7.521 = 7.521) |
| Preços por faixa | `v_variant_sale_prices_public` | **Preço de VENDA** calculado com markup (M2). Custo nunca sai |
| Faixa de preço do produto | `v_products_min_price` | min/max de `sale_price_1` + `variants_count` (M3) |
| Variantes | `product_variants` | RLS pública de leitura |
| Imagens / vídeos | `v_product_images_cdn`, `v_product_videos_cdn` | CDN Cloudflare |
| Áreas de gravação | `v_print_area_techniques_public` | Tabela-base é auth-only; use a view (M4) |
| Fornecedores | `v_suppliers_public` | Sem `cnpj`, `api_credentials`, `default_markup_percent` |
| Categorias / materiais / tags | `categories`, `material_*`, `materials_complete`, `tags`, `product_tags` | Leitura pública |
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
| M1 | `v_products_public` | Vazava 19 produtos **inativos** (incl. fantasmas) | `+ is_active = true`; 7.521 = 7.521 vs RLS |
| M2 | `v_variant_sale_prices_public` | `42501` p/ anon (view interna lia `suppliers.default_markup_percent` sem grant) | Reescrita DEFINER nas tabelas-base; 18.359 rows; markup variante→produto→categoria→supplier→115% |
| M3 | `v_products_min_price` | Expunha **CUSTO** (`min(vss.cost_price_1)`) como `min_price` + quebrava p/ anon (`user_belongs_to_org`) | Agrega **preço de venda** sobre M2; 7.174 rows |
| M4 | `v_print_area_techniques_public` | 0 rows p/ anon (base auth-only, view invoker) | DEFINER + `is_active=true`; 21.319 rows |
| M5 | `mcp_sessions` **P0** | Qualquer visitante lia/escrevia o **cookie do portal Só Marcas** com a key pública (provado por E2E) | Policies anon dropadas + `REVOKE ALL FROM anon`; agora `42501` |
| M6 | Bronze/Prata/staging | Grants de escrita órfãos p/ anon | `REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` |

## 6. Suíte de validação T01–T18 (como role `anon`) — 18/18 ✅

| ID | Teste | Resultado |
|---|---|---|
| T01 | `v_products_public` = products ativos (RLS) | 7521 vs 7521 ✅ |
| T02 | Zero inativos/deletados na view pública | 0 ✅ |
| T03 | Preços por faixa legíveis p/ anon | 18.359 rows ✅ |
| T04 | Variantes com `sale_price_1` preenchido | 16.435 ✅ |
| T05 | `v_products_min_price` legível p/ anon | 7.174 rows ✅ |
| T06 | `min_price` = `min(sale_price_1)` (consistência) | 0 divergências ✅ |
| T07 | Print areas públicas legíveis | 21.319 rows ✅ |
| T08 | `mcp_sessions` BLOQUEADO p/ anon | permission denied ✅ |
| T09 | Bronze invisível | 0 rows ✅ |
| T10 | Prata invisível | 0 rows ✅ |
| T11 | `products` `select(*)` nega (column-grant) | 42501 ✅ |
| T12 | `suppliers` `select(*)` nega | 42501 ✅ |
| T13 | `v_suppliers_public` legível | 5 rows ✅ |
| T14 | `categories` legíveis | 463 ✅ |
| T15 | Imagens CDN legíveis | 73.156 ✅ |
| T16 | Vídeos CDN legíveis | 983 ✅ |
| T17 | `mv_product_cards` = catálogo público | 7521 vs 7521 ✅ |
| T18 | `cost/suggested_price` NULL na view pública | 0 vazando ✅ |

E2E externo (PostgREST com a publishable key de produção — a mesma do bundle)
confirmou os mesmos resultados antes/depois das migrações.

## 7. Gap de DADOS conhecido: preços NULL (não é bug de view/front)

1.924 variantes preferidas **não têm `cost_price` em nenhuma faixa de nenhuma
fonte** — dívida de pipeline de ingestão, já mapeada:

| Fornecedor | Variantes sem custo | Status |
|---|---|---|
| XBZ | 1.415 NULL + 1 ZERO | dívida de pipeline |
| ASIA | 509 NULL | = produtos site-only documentados |
| SOMARCAS / STRICKER | 0 | 100% OK |

Impacto no catálogo (7.521 ativos): **6.136 (81,6%) preço completo**, 129
parcial (a view min/max resolve), 747 sem preço de variante mas com
`products.sale_price` (card OK), **509 sem preço algum → UI exibe “sob
consulta”** (877 dos 1.256 sem preço também estão sem estoque).

## 8. Sweep whitelist do front × banco (79 objetos)

- ✅ **Núcleo do catálogo público: 100% verde** (existe + grant + policy).
- ❌ `kit_component_media` **não existe** no banco — entrada morta em
  `rest-native.ts` (follow-up de front: remover ou criar a view).
- ⚠️ 13 tabelas RLS **auth-only** retornam vazio p/ anon **by design**
  (`color_nuances`, `kit_component_print_areas`, `personalization_techniques`,
  `print_area_techniques`*, `product_group_members`, `product_groups`,
  `product_properties`, `stock_daily_summary`, `stock_snapshots`,
  `supplier_branches`, `supplier_colors`, `supplier_property_mappings`).
  *`print_area_techniques` já resolvido pelo alias → view (M4).
- ⚠️ 3 matviews internas **sem grant anon** (42501 se usadas em página
  pública): `mv_material_group_stats`, `mv_product_compositions`,
  `mv_stock_velocity` — decisão de produto pendente antes de qualquer GRANT.

## 9. Follow-ups (fora do escopo deste PR)

1. **Backfill de custos XBZ/ASIA** (1.924 variantes) — dívida de pipeline
   Bronze→Prata, prioridade alta para conversão.
2. Remover `kit_component_media` da whitelist do `rest-native.ts` (ou criar a
   view correspondente).
3. Decidir exposição pública (ou não) de `product_properties` /
   `mv_product_compositions` para a página de produto.
4. Higiene opcional: revogar grants de escrita anon remanescentes em tabelas
   Gold (RLS já bloqueia; mesmo padrão da M6).
5. Apêndice no `supabase/MIGRATIONS_SYNC_LOG.md` (ver §10) — fazer via git
   local no merge para preservar EOL/bytes históricos do arquivo.

## 10. Entrada para o MIGRATIONS_SYNC_LOG.md (colar no merge)

```markdown
## 2026-06-11 — Contrato público Gold p/ front (M1–M6 via MCP execute_sql)

Auditoria de integração front↔Medallion (anon/PostgREST) achou 4 defeitos de
contrato e 1 vazamento P0, corrigidos AO VIVO em doufsxqlfjyuvxuezpln e
consolidados na migração idempotente
`20260611150000_medallion_front_public_contract_hardening.sql` (registrada em
supabase_migrations.schema_migrations com o mesmo conteúdo do arquivo):

- M1 v_products_public: + is_active=true (fecha vazamento de 19 inativos). 7521=7521.
- M2 v_variant_sale_prices_public: reescrita DEFINER nas tabelas-base
  (42501 → 18.359 rows p/ anon); markup variante→produto→categoria→supplier→115%.
- M3 v_products_min_price: antes expunha CUSTO como min_price e quebrava p/
  anon (user_belongs_to_org); agora min/max de PREÇO DE VENDA. 7.174 rows.
- M4 v_print_area_techniques_public: DEFINER + is_active (0 → 21.319 rows).
- M5 P0 mcp_sessions: DROP policies anon + REVOKE ALL FROM anon — E2E provou
  que qualquer visitante lia o cookie do portal Só Marcas. Agora 42501.
- M6 REVOKE escrita anon em Bronze/Prata/staging (defense-in-depth).

Validação: suíte T01–T18 como anon = 18/18 ✅; E2E PostgREST com key de
produção antes/depois. Sweep whitelist front×banco: núcleo público 100% OK;
kit_component_media inexistente (follow-up front); gap de dados: 1.924
variantes sem custo (XBZ 1.416, ASIA 509) ⇒ 509 produtos “sob consulta”.
Detalhes: docs/INTEGRACAO_MEDALLION_FRONT.md
```

## 11. Como revalidar rapidamente

```bash
# catálogo público (espera 7521; nenhum is_active=false)
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
