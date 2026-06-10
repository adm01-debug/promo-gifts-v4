# Relatório de Testes V6 — SPOT: CustomizationOptions + Correção de Projeto (SUPPLEMENTS/ORDERS)
**Data:** 2026-06-07 | **Escopo:** Fornecedor SPOT/Stricker | **Banco:** doufsxqlfjyuvxuezpln

Este ciclo (1) implementou e validou o último feed de PRODUTO faltante (CustomizationOptions / HotSpots) e (2) descobriu e corrigiu que dois workflows estavam no projeto n8n errado, com crons que falhariam silenciosamente.

---

## Parte 1 — CustomizationOptions (HotSpots do editor visual)

### Objetivo
Ingerir as opções de personalização por zona de cada produto (técnica, área, preço por faixa e, principalmente, o **HotSpot** — o retângulo onde o logo é posicionado no mockup) na tabela `supplier_customization_options_raw`.

### Resultado final (run `cc2159f0-ed62-422f-beed-83c04a92aa63`, exec manual `1050365`)
- status `ok` | fetched **35.936** | upserted **35.936** | skipped 0 | errors 0 | **42s**
- 35.832 combinações únicas (104 repetições do feed colapsadas pela chave natural)
- 1.197 produtos | **100% com HotSpot** | 100% com área cm² | 14 técnicas | tabela 68 MB

### Cadeia de 3 bugs (todos resolvidos)
A primeira execução completou "com sucesso" mas ingeriu **0 linhas**. A causa era uma cadeia:

**Bug 1 — CHECK constraint rejeitava o feed.**
`ingestion_run_log_feed_check` só permitia `('products','stock','customization')`. Ao abrir o run com `feed='customization_options'`, o `fn_ingestion_run_open` lançava exceção 23514. Como o nó HTTP usava `neverError:true`, o erro era engolido.
- *Armadilha de diagnóstico:* `execute_sql` com múltiplos statements **só retorna o resultado do último** — minha verificação anterior da constraint foi sobrescrita pela consulta seguinte, mascarando o problema. **Lição: verificar schema/constraint em query isolada.**
- *Correção:* migration `extend_ingestion_run_log_feed_check` (DROP + ADD incluindo `customization_options` e `colors`).

**Bug 2 — run_id virava string-lixo → todos os lotes falhavam.**
Com o run_open falhando, o nó `run_id` extraía a **mensagem de erro** (string), não null. Essa string ia como `p_run_id` para `fn_ingest_customization_options_batch`, cujo parâmetro é tipado **`uuid`**. O PostgREST rejeitava a chamada inteira (uuid inválido) em **todos** os ~90 lotes → 0 linhas. **Lição: um uuid inválido derruba a chamada PostgREST inteira; garantir run_open OK antes.**
- *Correção:* resolvida automaticamente ao corrigir o Bug 1 (run_id volta a ser uuid válido).

**Bug 3 — extração do HotSpot e vírgula decimal (qualidade de dados).**
Probe via `curl` revelou a estrutura real (≠ documentação):
- Resposta é OBJETO `{"CustomizationOptions":[...]}`, não array nu.
- Parâmetro `ref` é IGNORADO (sempre retorna o bulk completo ~36k). Per-ref inviável.
- **NÃO existe campo `HotSpot`** — são `HotSpot1Type/OriginX/OriginY/Top/Left/Width/Height` (+ HotSpot2*). O `->>'HotSpot'` retornava sempre NULL.
- `TableMaxAreaCM2` usa **vírgula decimal** (ex. `"9980,01"`) — o regex numérico rejeitava.
- *Correção:* migration `fix_customization_options_hotspot_extraction` — monta o HotSpot em jsonb a partir dos campos HotSpot1*/HotSpot2*; trata vírgula com `replace(...,',','.')` em `table_max_area_cm2` e `handling_cost`.

### Amostra validada (produto 11103, zona Borracha/Superior)
- area_cm2 = `9980.01` (vírgula convertida)
- hotspot = `{"hotspot1":{"top":205.96,"left":84.33,"type":"RectAngle","width":333.33,"height":74.07,"originX":"left","originY":"top"}}`

### Objeto entregue
- RPC `fn_ingest_customization_options_batch` (upsert idempotente; chave `(supplier_id, product_reference, service_code, table_code, component, location)`).
- Workflow `ING-SPOT-CUSTOMIZATION-OPTIONS` (`1uKqFK3xbAWf8ycU`), mensal dia 1 04:30, projeto Atomica BR.

---

## Parte 2 — Correção de projeto: SUPPLEMENTS e ORDERS

### Descoberta
Auditoria do `shared.projectId` revelou que `ING-SPOT-SUPPLEMENTS` e `OP-SPOT-ORDERS` (criados em sessão anterior via MCP) estavam no projeto **pessoal** `RfQyNbnUYI7xnBrM`, não no Atomica BR. A credencial `kite` vive só no Atomica BR → os crons falhariam no primeiro nó, **sem erro visível**.

### Impacto medido (antes da correção)
- `supplier_customization_raw`: **8** linhas (esperado ~289+) — SUPPLEMENTS nunca rodou com sucesso (0 runs de customization `ok`).
- `supplier_colors`: **49** (esperado 52).

### Ação e validação
Ambos recriados no Atomica BR com `projectId: K1sOP2Gf9sQt2U7P`; originais despublicados.
- **SUPPLEMENTS** (`bhoevJqxei1DsqGN`, exec `1051151`): customization 8 → **309** (301 upserted), colors 49 → **52**, run `ok`. Extração endurecida com `$input.all()`.
- **ORDERS** (`2PvnD15sj7AhsOgB`, exec `1051160`): testado on-demand, 1 pedido PROCESSING retornado e consolidado corretamente. **Redesenho:** consolidação agora lê cada status via `$('nó').first().json` (determinístico) em vez de `pairedItem.sourceNodeName` (que traria `{item:0}` sem `sourceNodeName` → 0 pedidos — bug latente eliminado). Descoberto que OrdersV1 retorna a lista em `OrdersDetails`.

---

## Lições transversais (reforçadas)
1. **Workflows via MCP caem no projeto pessoal** sem acesso à `kite`. Sempre `projectId: K1sOP2Gf9sQt2U7P`; auditar `shared.projectId` de workflows criados via MCP.
2. **`execute_sql` multi-statement só devolve o último resultado** — verificações de schema em query isolada.
3. **uuid inválido no PostgREST derruba a chamada inteira** — validar dependências (run_open) antes de RPCs com parâmetro uuid.
4. **n8n HTTP node:** resposta objeto `{...}` → 1 item; array `[...]` → N items. Endurecer code nodes com `$input.all()` cobrindo ambos.
5. **SDK n8n:** proibido arrow functions E function declarations no nível do código — declarar cada nó explicitamente. `function(){}` só dentro de strings `jsCode`.
6. **Estruturas reais ≠ documentação:** sempre validar via curl/execução (HotSpot1*, vírgula decimal, `OrdersDetails`, `ref` ignorado).

## Pendências
- Apagar manualmente (UI) os órfãos no projeto pessoal: `ddARcGMBeMyjGuNR`, `FaHmF8iQbGHc3GTV`, `YpN6XVVEJFR4UDmg`.
- Phase 2: OrderV1/CancelOrderV1 (Bitrix24), ServiceOrderV1 (arte base64), OrderDetailsV1, ProductTypes.
