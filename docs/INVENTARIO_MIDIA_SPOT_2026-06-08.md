# Inventário de Mídia SPOT × Cloudflare — 2026-06-08

## Status Geral

| Métrica | Valor |
|---|---|
| Health Score | **99/100** |
| Bronze SKUs | 3.612 / 3.612 ✅ |
| Gold Products (ativos) | 1.200 / 1.200 ✅ |
| Gold Variants | 3.636 / 3.636 ✅ |
| product_images total | 21.228 |
| product_images com CF ID | 21.228 (100%) ✅ |
| Produtos com image_type='main' | 1.200 / 1.200 ✅ |
| product_videos CF ready | 148 / 149 ✅ |
| URLs via proxy (produtos) | 1.200 / 1.200 ✅ |

## Arquitetura de Imagens

### Lote mar/2026 (area, component, location, picotado)
- **11.983 imagens** no CF Images ✅ 100%
- Tipos: location (7.755), component (3.025), area (1.203)
- Prefixo CF ID: `spot-pa-`, `spot-area-`

### Lote fev/2026 (main, gallery, set, ambient, logo, box, pouch)
- **9.245 registros** no banco com CF IDs
- **~504 presentes** no CF (~5.5%)
- **~8.741 ausentes** — reimport em andamento (script serial, ~800ms/upload)
- Tipos: main (1.200), gallery (4.955), set (1.142), logo (1.233), ambient (546), box (154), pouch (15)

## Worker spot-images-proxy

URL: `https://spot-images-proxy.adm01.workers.dev`

**Arquitetura CF-first + SPOT-fallback:**
- Imagem no CF → `x-image-source: cf-exact` (200)
- Imagem ausente no CF → `x-image-source: spot-fallback` (CDN SPOT)
- Imagem inexistente em ambos → 404
- Cache-Control: `public, max-age=31536000, immutable`

## product_videos

| Status | Count |
|---|---|
| CF ready | 148 |
| CF queued | 1 (SKU 97140) |
| Error permanente (YouTube deletado) | 2 (92184, 97145) |

### Queue video_import_queue
| Status | Count |
|---|---|
| linked | 141 |
| pending | 1 (SKU 97173 — eYolmR9XFE4) |
| error permanente | 2 (retry_count=99) |

## Correções Aplicadas (2026-06-08)

| # | Correção | Validada |
|---|---|---|
| C1 | Vídeo 97173 desbloqueado (downloading→pending) | ✅ |
| C2 | 26 produtos sem image_type='main' corrigidos (set/gallery→main) | ✅ |
| C3 | 2 vídeos YouTube deletados documentados (retry=99) | ✅ |
| C4 | SKUs Price1=null documentados com _price_alert | ✅ |

## Melhorias Implementadas (2026-06-08)

| # | Melhoria | Status |
|---|---|---|
| M1 | Script spot-full-reimport.cjs + spot-reimport-serial.cjs | ✅ Rodando |
| M2 | View vw_spot_price_alerts | ✅ |
| M3 | View vw_spot_cf_health | ✅ Score=99 |
| M4 | Vídeos deletados documentados definitivamente | ✅ |
| M5 | pg_cron spot-health-check-daily (09:00 UTC) | ✅ jobid=74 |
| M6 | Workflow n8n ING-SPOT-STOCK (30min, ID: LW3AGEwm51jAteQO) | ✅ Ativo |
| M7 | Funções fn_upsert_stock_to_bronze + fn_upsert_stocks_bulk_spot + fn_sync_stock_bronze_to_gold_spot | ✅ |
| M8 | Reimport serial em background (PID 21424) | ⏳ Em andamento |

## Objetos Criados no Banco

| Objeto | Tipo | Finalidade |
|---|---|---|
| `fn_get_spot_feb2026_ids(offset,limit)` | FUNCTION | Retorna IDs fev/2026 paginados |
| `fn_upsert_stock_to_bronze(sku, qty, ...)` | FUNCTION | Atualiza stock no Bronze |
| `fn_upsert_stocks_bulk_spot(stocks[])` | FUNCTION | Bulk upsert + auto-sync Gold |
| `fn_sync_stock_bronze_to_gold_spot()` | FUNCTION | Sincroniza Bronze→Gold |
| `fn_spot_health_check()` | FUNCTION | Health check com log |
| `spot_cf_reimport_log` | TABLE | Rastreamento de uploads |
| `spot_health_log` | TABLE | Histórico health checks |
| `vw_spot_cf_health` | VIEW | Dashboard consolidado |
| `vw_spot_price_alerts` | VIEW | SKUs com preço ausente |

## Scripts VPS

| Script | Descrição |
|---|---|
| `/workspace/scripts/spot-reimport-serial.cjs` | Reimport serial com retry e estado persistente |
| `/workspace/scripts/spot-full-reimport.cjs` | Reimport paralelo (não usar — sobrecarga Worker) |
| `/workspace/logs/reimport-state.json` | Estado persistente do reimport serial |

## Pendências

1. **Reimport lote fev/2026** — script rodando em background (~8.741 uploads, ETA 2h)
2. **Vídeo 97173** — pendente no cron VPS (próxima execução a cada 2h)
3. **ING-SPOT-STOCK** — workflow n8n ativo, rodando a cada 30min
