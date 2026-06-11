# ING-SPOT-STOCK — Sincronização de Estoque SPOT/Stricker

## Visão Geral
Workflow n8n que sincroniza estoque SPOT a cada 30 minutos, seguindo o padrão Medallion Bronze→Silver→Gold.

- **Workflow ID:** `6j92ZC6didDgGrGD`
- **URL:** https://n8n.atomicabr.com.br/workflow/6j92ZC6didDgGrGD
- **Supplier:** SPOT/Stricker (`bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0`)
- **Cadência:** */30 min (48 calls/dia de 96 disponíveis)
- **Status:** `inactive` — aguarda atribuição de credencial + ativação manual

---

## Fluxo (10 nós)

```
Schedule 30min ─┐
                 ├─► Get AccessKey (fn_get_spot_access_key via RPC)
Trigger Manual ─┘
                     ↓
               Extrair AccessKey (Code: normaliza retorno text/object)
                     ↓
               Autenticar SPOT WS
               GET https://ws.spotgifts.com.br/api/v1SSL/AuthenticateClient?accessKey=...
               → {Token: "..."}
                     ↓
               Buscar Feed Stocks
               GET /Stocks?token=...
               → [{Sku, Quantity, NextQuantity1-3, NextDate1-3}, ...]
                     ↓
               Preparar Payload Bronze (Code: valida array, injeta supplier_id)
                     ↓
               Upsert Stock Bronze
               RPC fn_upsert_stock_to_bronze(p_supplier_id, p_items)
               → {updated, not_found, total}
                     ↓
               Sync Bronze → Gold
               RPC fn_sync_stock_bronze_to_gold(p_supplier_id)
               → {silver_updated, gold_updated}
                     ↓
               Resumo Final
```

---

## Credenciais Necessárias (atribuição manual na UI)

| Nó | Credencial |
|---|---|
| Get AccessKey | Supabase \| Produtos |
| Upsert Stock Bronze | Supabase \| Produtos |
| Sync Bronze Gold | Supabase \| Produtos |

> **Autenticar SPOT WS** e **Buscar Feed Stocks** NÃO precisam credencial — autenticação é via query parameter `accessKey`/`token`.

---

## Funções Backend

| Função | Assinatura | Propósito |
|---|---|---|
| `fn_get_spot_access_key` | `()→text` | Lê AccessKey do Vault (SECURITY DEFINER) |
| `fn_upsert_stock_to_bronze` | `(uuid, jsonb)→jsonb` | Grava stock_data por Sku no Bronze |
| `fn_sync_stock_bronze_to_gold` | `(uuid, text=NULL)→jsonb` | Propaga Bronze→Silver→Gold (bulk) |

---

## Workflows Legados Arquivados
- `88ktOZEvWZiDLw7b` — "SPOT - Atualiza Estoque" (arquivado)
- `fssNdowvlZ6QTYxv` — "SPOT - Atualiza Estoque teste" (arquivado)

---

## Ativação

1. Abrir o workflow no n8n
2. Atribuir `Supabase | Produtos` nos 3 nós Supabase
3. Testar via Trigger Manual e verificar Resumo Final
4. Ativar o workflow

## KPIs Esperados (após ativação)
- `bronze_updated` ≈ 3.611 (todos os SKUs SPOT)
- `not_found` = 0 (todos os SKUs estão no Bronze)
- `silver_updated` ≈ 3.611
- `gold_updated` ≈ 3.611
- Tempo total por execução: < 30s
