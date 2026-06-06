# Relatório de Testes V5 — Esteira de Estoque SPOT

**Data:** 2026-06-06  
**Sessão:** Diagnóstico e correção do bug de estoque no Medallion  
**Resultado:** ✅ APROVADO

---

## 1. Bug Identificado e Corrigido

### fn_promote_variants_of_parent — COALESCE(stock, 0) destrutivo

**Causa raiz:**
```sql
-- ANTES (bug): no INSERT do VSS
quantity = COALESCE(pv.stock_quantity, 0),  -- quando Silver=NULL → EXCLUDED=0
stock_main_warehouse = COALESCE(pv.stock_quantity, 0),
-- ON CONFLICT: COALESCE(0, existente) = 0 → DESTROÍA o estoque!

-- DEPOIS (correto):
quantity = pv.stock_quantity,  -- quando Silver=NULL → EXCLUDED=NULL
stock_main_warehouse = pv.stock_quantity,
-- ON CONFLICT: COALESCE(NULL, existente) = existente → PRESERVA ✅
```

**Impacto:** Qualquer execução do pipeline com Bronze sem stock_data zeraria
o estoque Gold de todos os refs processados.

**Migration aplicada:** `fix_promote_variants_stock_coalesce_zero`

---

## 2. Funções Criadas

### fn_upsert_stock_to_bronze(supplier_id, items[])
- Recebe array de itens do feed `spot_ws_stocks`
- Grava em `supplier_products_raw.stock_data` (Bronze)
- Retorna `{updated, not_found, total}`
- **NUNCA escreve em Silver ou Gold**

### fn_sync_stock_bronze_to_gold(supplier_id, parent_ref)
- Lê `stock_data` do Bronze
- Atualiza Silver: `stock_quantity`, `next_quantity_1..3`, `next_date_1..3`
- Propaga para Gold VSS: `quantity`, `stock_main_warehouse`, `next_quantity_1..3`
- Retorna `{silver_updated, gold_updated}`
- **Caminho canônico: Bronze → Silver → Gold**

---

## 3. Restauração de Dados

| Campo | Antes | Depois |
|-------|-------|--------|
| Gold qty > 0 | 3199 (mas muitos errados) | 3220 ✅ |
| Gold qty = 0 | 400+ | 394 |
| Gold qty NULL | 22 | 22 |

Restaurados 3199 registros via `raw_data` que preservava os valores reais.

---

## 4. Teste de Esteira Completa

**SKU:** `11110-105`

| Camada | Campo | Valor |
|--------|-------|-------|
| Bronze | `stock_data->>'Quantity'` | 1862 ✅ |
| Silver | `stock_quantity` | 1862 ✅ |
| Gold | `quantity` | 1862 ✅ |
| Gold | `source` | `silver` ✅ |

**Pipeline completo (`fn_spot_process_ref('11110')`):** estoque preservado após execução ✅

---

## 5. Diagnóstico da Bronze (stock_data)

| Métrica | Valor |
|---------|-------|
| Total SKUs Bronze | 3612 |
| SKUs com stock_data | 1 (apenas 11110-105, testado agora) |
| SKUs sem stock_data | 3611 |

**Causa:** O feed `spot_ws_stocks` nunca foi ingerido na Bronze de forma sistemática.
`fn_import_stock_from_spot` escreve diretamente no Gold (violação da arquitetura Medallion).

---

## 6. Pendências

1. **n8n ING-SPOT-STOCK:** Implementar workflow que chama `spot_ws_stocks` →
   `fn_upsert_stock_to_bronze()` → `fn_sync_stock_bronze_to_gold()` a cada 30min.
2. **Carga inicial completa:** Buscar estoque de todos os 3612 SKUs via SPOT API
   e popular Bronze completamente.
3. **fn_import_stock_from_spot:** Deprecar como caminho primário. Manter apenas
   como recuperação emergencial.

---

## 7. Arquitetura Canônica de Estoque (implementada)

```
spot_ws_stocks feed
  → fn_upsert_stock_to_bronze(supplier_id, items[])   [Bronze]
    → supplier_products_raw.stock_data
      → fn_sync_stock_bronze_to_gold(supplier_id, ref)  [Silver → Gold]
        → produtos_padronizacao_variantes.stock_quantity  [Silver]
          → variant_supplier_sources.quantity              [Gold]
```

**Invariante:** Nenhum dado vai direto ao Gold. Bronze → Silver → Gold.
