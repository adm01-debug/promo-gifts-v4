# Auditoria crítica (re-teste ao vivo): `process_spot_products` → `fn_process_raw_v2`

- **Projeto Supabase:** `doufsxqlfjyuvxuezpln` (Promo Gifts) · PostgreSQL 17
- **Fornecedor (SPOT/Stricker):** `bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0` · org `5db5aee1-064b-4ef4-9193-345dcd8274ea` · markup 115%
- **Data:** 2026-06-04
- **Método:** comparação função-a-função (legada vs. viva) + testes ao vivo no banco
  (integridade sobre 3.612 raw / 1.200 ProdReferences / 1.200 produtos / 3.612 variantes
  / 3.612 VSS) + **2 testes funcionais E2E transacionais com ROLLBACK total** (nenhuma
  linha persistida — verificado: 0 resíduos).

> Esta auditoria **revê** e **corrige** a conclusão das auditorias anteriores
> (`AUDITORIA_fn_process_raw_v2_vs_process_spot_products.md` e
> `AUDITORIA_PARIDADE_SPOT_FN_PROCESS_RAW_V2_2026-06-04.md`), que declararam
> "paridade/superset — pronto para produção". **Esse veredito estava incorreto para o
> caminho real de importação.** O re-teste com um `ProdReference` inédito + dados raw
> reais expôs um defeito que torna a importação **100% inoperante**.

---

## 1. Veredito

`fn_process_raw_v2` é arquiteturalmente um superset da legada **e**, quando o
`product_type` é válido, produz resultado superior (nome limpo, custo, `sale_price` com
markup, variante com cor/tamanho/atributos, VSS). **Porém, com os dados raw REAIS da
SPOT, a função falha em 100% dos produtos** por um mapeamento incompatível com uma
constraint. A migração **NÃO está pronta** para a próxima importação real.

| Sev. | Gap | Impacto medido | Status |
|---|---|---|---|
| 🔴 **Crítico** | `Type → products.product_type` (mapping `direct` ativo) injeta categorias SPOT (`SUCO`, `Escrita`…) que violam `products_product_type_check` | **1.200/1.200 ProdReferences (100%)** falham; produto **não é criado**, raw fica **`pending`** (re-tentado a cada 5 min para sempre), e a função retorna `success:true` (mascara a falha) | ✅ **Corrigido** (migr. `20260605000239`) |
| 🟠 Médio | `short_description` é `varchar(500)`, mas `ShortDescription` raw chega a **969** chars | 48 ProdReferences falhariam (após corrigir o crítico) | ✅ **Corrigido** (migr. `20260605000347`) |
| 🟠 Médio | `ncm_code` é `varchar(10)`, mas `Taric` raw chega a **11** chars | 6 ProdReferences falhariam (após corrigir o crítico) | ✅ **Corrigido** (migr. `20260605000347`) |
| 🟡 Baixo | `process_pending_batches` reporta `variants_processed` na coluna `products_processed`; `success` da fn é `true` mesmo com `products_errors>0` | Telemetria/observabilidade enganosa (esconde o crítico) | ⚠️ Aberto (cosmético) |

Itens já corrigidos pelas auditorias anteriores e **confirmados ao vivo como OK**: nome
limpo (`fn_clean_spot_name`), `cost_price`+`sale_price` (markup), VSS, advisory-lock
anti-race, batch lazy, cron duplicado removido (resta só jobid 1), 0 batches vazios.

---

## 2. Prova ao vivo (E2E transacional, rollback total)

### 2.1 Caso A — dados REAIS (`Type='SUCO'`)
Inserido 1 raw sintético (`ProdReference='ZZTYPE_A'`, `Type='SUCO'`, demais campos
válidos), chamada `fn_process_raw_v2(...,100,true)`, leitura do resultado e `RAISE` final
para reverter tudo. Resultado capturado:

```
fn_result = {"success": true, "parents_processed": 0, "products_errors": 1,
             "errors": [{"stage":"parent","parent_key":"ZZTYPE_A",
               "error":"new row for relation \"products\" violates check
                        constraint \"products_product_type_check\""}]}
product_row = <<NENHUM PRODUTO CRIADO>>
raw_after   = status=pending  (process_errors preenchido)
```

Diagnóstico: o `INSERT` do produto (`name='Produto ZZTYPE_A'`) e o `UPDATE` dos campos
ocorrem no mesmo bloco `BEGIN…EXCEPTION` por parent. O `UPDATE … product_type='SUCO'`
viola a `CHECK`; a exceção é capturada pelo handler do parent, que faz **rollback ao
savepoint** — desfazendo inclusive o `INSERT`. A raw **não** é marcada `processed`
(continua `pending`) e será re-tentada eternamente pelo cron. A função retorna
`success:true`, então `process_pending_batches` reporta `SUCCESS`.

### 2.2 Caso B — `Type='product'` (controle)
Mesmo teste, trocando só `Type` para um valor válido e `Name='  GARRAFA   de   DESPORTO  '`:

```
fn_result = {"success":true,"parents_processed":1,"variants_processed":1,"errors":[]}
product   = {"name":"Garrafa de desporto","sku":"ZZTYPE_B","cost_price":10.00,
             "sale_price":21.50,"brand":"MarcaX","origin_country":"CN",
             "description":"desc teste","product_type":"product"}
variant   = {"sku":"ZZSKU_B","supplier_sku":"ZZSKU_B","name":"Garrafa de desporto | Azul | M",
             "color_code":"BLU","color_name":"Azul","color_hex":"#0000FF","size_code":"M",
             "attributes":{"cor":"Azul","codigo_cor":"BLU"}}
vss       = {"cost_price":10.0000,"quantity":0,"source":"raw_v2","is_preferred":true}
raw_after = processed
```

Conclusão: a única diferença entre o sucesso total (B) e a falha total (A) é o valor de
`Type`. O motor está correto; o **mapeamento `product_type` está envenenado**.

---

## 3. Por que as auditorias anteriores não viram

Os testes E2E anteriores usaram `Type` ausente/sintético "válido" e/ou produtos já
existentes, onde o defeito vira no-op. A constraint `products_product_type_check` só
dispara quando o `UPDATE`/`INSERT` recebe um valor real de `Type` (categoria SPOT). Como
o acervo atual (1.200) foi criado pelo **pipeline predecessor** (todos com
`product_type ∈ {product,kit,packaging}`), nenhum teste exercitou o caminho real com
`Type` cru. A `fn_process_raw_v2` roda como no-op em produção hoje (0 raw pendentes), o
que escondeu o problema — que se manifesta **na próxima importação**.

Evidência de envenenamento (corpus real):

```
product_type permitido  : {product, packaging, accessory, kit, component}
ProdReferences totais   : 1200
… com Type inválido     : 1200  (100%)   ← ex.: SUCO(674), 'Squeezes & Copos'(456), Escrita(414)…
… com Type válido       : 0
```

---

## 4. Mapa de paridade revisado (real)

| Funcionalidade legada (`process_spot_products`) | `fn_process_raw_v2` | Real |
|---|---|---|
| `product_type = 'product'` (hardcoded) | mapping `Type→product_type` `direct` ativo | **🔴 REGRESSÃO — quebra 100%** |
| `name = clean_spot_name(Name)` | mapping `custom`/`fn_clean_spot_name` | ✅ Paridade (provado: "Garrafa de desporto") |
| `sku = 'SPOT-'||ref` | `sku_prefix=''` ⇒ `sku=ref` | ⚪ Desvio aceito (decisão registrada) |
| `supplier_reference = ProdReference` | mapping ativo | ✅ |
| Variantes + cor + attributes | template + ColorDesc1/ColorHex1 + size_code | ✅ Paridade+ |
| `vss.cost_price = Price1` | mapping VSS + `products.cost_price` (markup) | ✅ Paridade+ (sale_price 21.50) |
| Abre/fecha batch, log de erro | batch lazy + advisory lock + error_log granular | ✅ Paridade+ |
| (n/a na legada) `ncm_code ← Taric` | `varchar(10)` vs Taric 11 | **🟠 overflow (6 refs)** |
| (n/a na legada) `short_description ← ShortDescription` | `varchar(500)` vs 969 | **🟠 overflow (48 refs)** |

---

## 5. Remediação proposta (parity-restoring)

Arquivo: `supabase/migrations/20260604T000000Z_fix_raw_v2_product_type_and_overflows.sql`
(**incluído neste PR para revisão; ainda NÃO aplicado em produção**).

1. **Crítico — `product_type`:** desativar o mapping `Type→products.product_type`.
   Assim `product_type` cai no **default da coluna (`'product'`)**, reproduzindo
   exatamente a legada. (`Type` é uma **categoria**, não um `product_type`; se desejado,
   mapear depois via `lookup`/`main_category`, fora do escopo de paridade.)
2. **Overflow — `short_description`:** `ALTER … TYPE text` (sem rewrite, sem perda).
3. **Overflow — `ncm_code`:** `ALTER … TYPE varchar(20)` (aumento de tamanho = metadata-only).
4. **Telemetria (opcional):** `process_pending_batches` retornar `products_errors`/status
   real para não mascarar falhas.

Validação pós-fix recomendada: reproduzir o Caso A (agora deve criar produto
`product_type='product'`) e rodar os 54 ProdReferences de overflow num dry-run
transacional.

---

## 6. Remediação APLICADA e validada (2026-06-05)

Aprovada pelo dono (`adm01@promobrindes.com.br`) e aplicada em produção:

### ✅ 🔴 `product_type` — `20260605000239_fix_raw_v2_product_type_mapping_parity`
Mapping `Type→products.product_type` desativado (`is_active=false`). `product_type` volta
ao default da coluna (`'product'`) = comportamento legado.

### ✅ 🟠 Overflows — `20260605000347_raw_v2_transform_maxlength_and_spot_overflow_caps`
`fn_apply_transform` passou a truncar o resultado quando `transform_config.max_length`
existe (aditivo/opt-in; nenhum outro fornecedor usa). Aplicados caps:
`short_description → 500`, `ncm_code → 10`. **Optou-se por cap no mapeamento em vez de
`ALTER COLUMN`** porque `short_description`/`ncm_code` são referenciados por
`public.v_products_public` e `analytics.mv_product_cards` — alargar exigiria recriar esses
contratos públicos (risco desnecessário para um fix de paridade).

### Validação E2E pós-fix (transacional, rollback total, 0 resíduos)
Raw real reproduzindo as 3 falhas (`Type='SUCO'`, `Taric` 11 chars, `ShortDescription`
969 chars):

```
fn_result = {"success":true,"parents_processed":1,"variants_processed":1,"errors":[]}
product   = {"name":"Caneca de porcelana","product_type":"product","sku":"ZZFIX_1",
             "cost_price":7.50,"sale_price":16.13,"brand":"MarcaY",
             "ncm_code":"1234567890","ncm_len":10,"sd_len":500}
raw_after = processed
```

Antes: `<<nenhum produto criado>>`, raw `pending`. Depois: produto completo,
`product_type='product'`, campos truncados ao limite, raw `processed`. Gap crítico
eliminado e paridade real restaurada.

> Estado pós-fix confirmado: `product_type` mapping `is_active=false`;
> `short_description.cfg={max_length:500}`; `ncm_code.cfg={max_length:10}`; 0 raw SPOT
> pendentes; 0 resíduos de teste (todos os E2E revertidos por `ROLLBACK`).

### Pendente (cosmético, não bloqueia importação)
`process_pending_batches` ainda reporta `variants_processed` como `products_processed` e
`success:true` mesmo com `products_errors>0`. Recomendado expor `products_errors`/status
real para não mascarar futuras falhas — não aplicado (mudança de contrato de telemetria).
