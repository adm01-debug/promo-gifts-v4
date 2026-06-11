# Inventário e Arquitetura de Mídia — Promo Brindes
> **Projeto:** promo-gifts-v4 · Supabase `doufsxqlfjyuvxuezpln`
> **Levantado em:** jun/2026 · **Ferramentas:** Cloudflare Images MCP + SQL direto
> **Classificação:** USO INTERNO

---

## 1. Cloudflare Images — Estado Atual

| Métrica | Valor |
|---|---|
| **Total de imagens** | 47.518 |
| **Limite do plano** | 100.000 |
| **Uso do plano** | 48% |
| **Delivery hash (CDN)** | `vKMs9Ow8bA_enuhLXZ2HAw` |
| **URL base de entrega** | `https://imagedelivery.net/vKMs9Ow8bA_enuhLXZ2HAw/{image_id}/public` |
| **Margem disponível** | ~52.482 imagens antes de atingir o limite |

### 1.1 Breakdown estimado por fornecedor no Cloudflare

| Fornecedor | Estimativa CF Images |
|---|---|
| SPOT | ~24.000 |
| XBZ | ~13.000 |
| Só Marcas | ~8.000 |
| ASIA Import | ~2.000 |
| 88 Brindes | ~14 |

---

## 2. Padrões de ID no Cloudflare Images

Cada fornecedor usa um padrão distinto de `image_id` que permite identificar a origem sem consultar o banco:

| Fornecedor | Tipo de imagem | Padrão de ID | Exemplo real |
|---|---|---|---|
| SPOT | Produto (todas as vistas) | `spot-{iderp}_{cor}{-sufixo}` | `spot-11103_103`, `spot-11104_105-b` |
| SPOT | Picotado (zona de impressão) | `spot-pa-{iderp}_{cor}_{comp}_{loc}_{view}` | `spot-pa-81112_103_1_1_2` |
| XBZ | Imagem principal por cor (1ª geração) | `xbz-{ref_produto}-{sku_id_numerico}` | `xbz-14375-11256` |
| XBZ | Galeria detalhe (2ª geração) | `xbz-{codigo_amigavel}-d{n}` | `xbz-01331-d3`, `xbz-01332-d1` |
| Só Marcas | Imagem principal / galeria | `sm-{sku_ref}` | `sm-as-00610-00` |
| ASIA Import | Imagem principal / galeria | `asia-{referencia}` | `asia-bac003` |
| 88 Brindes | Galeria / principal | `88b_{ref}_{tipo}_{n}` | `88b_1000-002_gallery_1` |

**Nota de sufixos SPOT:** `-a`, `-b`, `-c`, `-d`, `-e`, `-f` = vistas adicionais; `-logo` = zona de impressão; `-amb` = imagem ambiente; `-box` = embalagem; `-set` = conjunto; `-pouch` = bolsa.

---

## 3. Banco de Dados — `product_images`

### 3.1 Estrutura da tabela

Campos relevantes para o pipeline de mídia:

| Campo | Tipo | Observação |
|---|---|---|
| `cloudflare_image_id` | varchar NOT NULL | ID no CF Images — chave de entrega |
| `url_cdn` | text NOT NULL | URL completa de entrega via CF |
| `url_original` | text | URL original do fornecedor |
| `image_type` | varchar NOT NULL | Tipo da imagem (main, gallery, set, ambient, box, pouch, area, component, location, logo, product, detail) |
| `is_primary` | boolean | Imagem principal do produto/variant |
| `source_supplier` | varchar | Fornecedor de origem (SPOT, XBZ, xbz, SM, ASIA, 88BRINDES) |
| `supplier_code` | varchar | Código do produto no fornecedor |
| `applies_to_color` | boolean | Se a imagem é específica de uma cor |
| `display_order` | int | Ordem de exibição na galeria |

### 3.2 Inventário por fornecedor

| `source_supplier` | Total Imagens | Imagens Primárias | Tipos de Imagem | Exemplo `cloudflare_image_id` |
|---|---|---|---|---|
| `SPOT` | 21.228 | 1.200 | 10 tipos | `spot-11103_103` |
| `xbz` ⚠️ | 19.971 | 1.790 | 4 tipos | `xbz_site_0003de0ce5ebdc3a` |
| `SM` | 4.206 | 1.090 | 2 tipos | `sm-as-00610-00` |
| `XBZ` ⚠️ | 3.454 | 879 | 5 tipos | `xbz-00001-caneta-ecologica-pap` |
| `ASIA` | 2.502 | 432 | 3 tipos | `asia-bac003` |
| `88BRINDES` | 14 | 1 | 2 tipos | `88b_1000-002_gallery_1` |
| **TOTAL** | **51.375** | **5.392** | — | — |

⚠️ **Bug de normalização:** `xbz` (lowercase) e `XBZ` (uppercase) são o mesmo fornecedor. Dois registros distintos por inconsistência no `source_supplier`. Ver §6 (gaps e problemas).

### 3.3 Tipos de imagem por fornecedor

| Tipo | SPOT | XBZ/xbz | SM | ASIA | 88B |
|---|---|---|---|---|---|
| `main` | ✅ 1.174 | ✅ | ✅ | ✅ | ✅ |
| `gallery` | ✅ 4.957 | ✅ | ✅ | ✅ | ✅ |
| `set` | ✅ 1.165 | ✅ | ❌ | ✅ | ❌ |
| `ambient` | ✅ 546 | ✅ (XBZ) | ❌ | ❌ | ❌ |
| `box` | ✅ 154 | ❌ | ❌ | ❌ | ❌ |
| `pouch` | ✅ 15 | ❌ | ❌ | ❌ | ❌ |
| `area` (picotado) | ✅ 1.203 | ❌ | ❌ | ❌ | ❌ |
| `component` | ✅ 3.025 | ❌ | ❌ | ❌ | ❌ |
| `location` | ✅ 7.755 | ❌ | ❌ | ❌ | ❌ |
| `logo` | ✅ 1.234 | ❌ | ❌ | ❌ | ❌ |
| `product` | ❌ | ✅ (xbz) | ❌ | ❌ | ❌ |
| `detail` | ❌ | ✅ (XBZ) | ❌ | ❌ | ❌ |

**Destaques:**
- SPOT tem 10 tipos de imagem — o mais rico. ~36% são imagens de `location` (zona de impressão) e ~14% `component`.
- SM e ASIA têm apenas 2–3 tipos — gap significativo para apresentação de produto.
- `area`/`component`/`location`/`logo` são exclusivos do SPOT porque vêm do webservice OptionalsComplete.

---

## 4. Cobertura de Imagens nos Produtos Gold

| Fornecedor | Produtos Gold Ativos | Com Imagem | Sem Imagem | Cobertura | Média imgs/produto |
|---|---|---|---|---|---|
| **Spot \| Stricker** | 1.200 | 1.200 | **0** | **100%** | 17,7 |
| **XBZ Brindes** | 3.716 | 3.548 | **168** | 95.5% | 6,6 |
| **Só Marcas** | 1.110 | 992 | **118** | 89.4% | 3,8 |
| **Asia Import** | 431 | 415 | **16** | 96.3% | 5,9 |
| **88 Brindes** | 10 | **0** | **10** | **0%** | — |
| **TOTAL** | **6.467** | **6.155** | **312** | **95.2%** | — |

**Observação:** 312 produtos Gold ativos sem nenhuma imagem vinculada. 88 Brindes é o caso mais crítico: 10 produtos no Gold sem cobertura alguma.

---

## 5. Vídeos — `product_videos`

### 5.1 Status atual

| Fornecedor | Total Vídeos | Status CF | Observação |
|---|---|---|---|
| **SPOT** | 139 | `ready` (Cloudflare Stream) | Migrados do YouTube → CF Stream. `url_hls`, `url_dash`, `url_stream` disponíveis |
| **XBZ** | 155 | `youtube` | Apenas `source_youtube_id`. **NÃO migrados** para Cloudflare Stream |
| SM | 0 | — | Nenhum vídeo |
| ASIA | 0 | — | Nenhum vídeo |
| 88 Brindes | 0 | — | Nenhum vídeo |
| **TOTAL** | **294** | — | — |

### 5.2 Fluxo atual dos vídeos SPOT

```
YouTube (VideoLink no OptionalsComplete)
  → fn_promote_padronizacao detecta VideoLink
  → Registra em product_videos (cloudflare_status = 'pending')
  → Worker de upload para CF Stream
  → cloudflare_status = 'ready'
  → url_hls / url_dash / url_stream preenchidos
```

### 5.3 Problema dos vídeos XBZ

XBZ tem 155 vídeos com `cloudflare_status = 'youtube'` — ficaram parados depois da descoberta. Não houve migração para CF Stream. O campo `cloudflare_video_id` contém o YouTube ID (ex: `aIheiqpuVas`) em vez de um Stream ID real — isso é inconsistente: o campo deveria ser o CF Stream ID.

---

## 6. `xbz_gallery_staging` — Pipeline Parado

### 6.1 Estado atual

| Métrica | Valor |
|---|---|
| Total de registros | 17.709 |
| Status | `discovered` (100%) |
| `cloudflare_image_id` | NULL em todos |
| `url_cdn` | NULL em todos |

### 6.2 O que essa tabela representa

É uma fila de imagens da **galeria do site XBZ** (`www.xbzbrindes.com.br/img/produtos/`) que foram **descobertas** durante o enriquecimento do pipeline XBZ mas **nunca foram uploadadas** para o Cloudflare Images. O worker de processamento desta staging nunca foi implementado ou parou de funcionar.

### 6.3 Exemplo de registro

```json
{
  "status": "discovered",
  "url_original": "https://www.xbzbrindes.com.br/img/produtos/3/Caneta-Ecologica-Papelao-AZUL-11864-1589465058.jpg",
  "url_cdn": null,
  "cloudflare_image_id": null,
  "codigo_amigavel": "00003"
}
```

---

## 7. Gaps e Problemas Identificados

### 7.1 🔴 Críticos

| # | Problema | Impacto | Causa |
|---|---|---|---|
| G1 | **17.709 imagens XBZ na staging não processadas** | Galeria XBZ incompleta — imagens de detalhe ausentes no catálogo | Worker de upload da staging nunca implementado/executado |
| G2 | **155 vídeos XBZ com `cloudflare_status='youtube'`** | Vídeos dependem do YouTube (latência, sem controle de CDN) | Pipeline de migração não executado para XBZ |
| G3 | **88 Brindes: 10 produtos Gold sem imagem** | Produtos aparecendo sem foto no catálogo | Ingestão de imagens nunca implementada |

### 7.2 🟡 Importantes

| # | Problema | Impacto | Causa |
|---|---|---|---|
| G4 | **`source_supplier` com case inconsistente** (`xbz` vs `XBZ`) | Queries precisam de ILIKE ou normalization; analytics duplicados | Dois momentos de ingestão com normalização diferente |
| G5 | **SM: 118 produtos sem imagem** (10.6% gap) | Catálogo SM com produtos sem foto | Imagens não encontradas no pipeline Jina/SM |
| G6 | **XBZ: 168 produtos sem imagem** (4.5% gap) | Produtos XBZ sem foto | Produtos novos não cobertos |
| G7 | **SM e ASIA têm apenas 2-3 tipos de imagem** | Experiência de produto pobre (sem ambient, set, detail) | APIs de origem não fornecem esses tipos |

### 7.3 🟢 Oportunidades de melhoria

| # | Oportunidade | Benefício |
|---|---|---|
| O1 | Migrar vídeos XBZ para CF Stream (como SPOT) | Controle total de CDN, sem dependência do YouTube |
| O2 | `alt_text` automatizado por IA para todas as imagens | SEO e acessibilidade |
| O3 | Gerar variantes de tamanho via CF Images transforms | Redução de 60-80% no tempo de carregamento (thumbnail, card, fullsize) |
| O4 | Adicionar imagens `ambient` e `detail` ao SM via Jina/Playwright | Experiência de produto mais rica |
| O5 | Worker de webhook para re-upload automático quando imagem CF for deletada | Resiliência automática |

---

## 8. Arquitetura de Mídia Atual (Estado Real)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FONTES DE IMAGEM                             │
├──────────────────┬──────────────────┬───────────────────────────┤
│ SPOT Webservice  │  XBZ Site        │  SM / ASIA / 88B          │
│ OptionalsComplete│  xbzbrindes.com  │  APIs / Sites             │
│ ~/fotos/produtos │  /img/produtos/  │  variado                  │
└────────┬─────────┴──────┬───────────┴──────────┬────────────────┘
         │                │                      │
         ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              PIPELINE DE INGESTÃO DE MÍDIA                      │
│                                                                 │
│  SPOT: fn_promote_to_gold → product_images (direto, COMPLETO)   │
│                                                                 │
│  XBZ:  fn_site_promote_to_gold → product_images                 │
│        xbz_gallery_staging (17.709 PARADOS em 'discovered')     │
│        Worker upload CF ← ⚠️ NÃO IMPLEMENTADO                  │
│                                                                 │
│  SM:   fn_sm_site_promote → product_images                      │
│        Jina Reader (scraping) → site_data no Bronze             │
│                                                                 │
│  ASIA: fn_promote_variants_of_parent → product_images           │
│                                                                 │
│  88B:  ⚠️ SEM PIPELINE ATIVO                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE IMAGES (47.518 / 100.000)              │
│  Delivery: imagedelivery.net/vKMs9Ow8bA_enuhLXZ2HAw/{id}/public│
│                                                                 │
│  ~24k SPOT  ~13k XBZ  ~8k SM  ~2k ASIA  14 88b                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE STREAM (vídeos)                         │
│  139 vídeos SPOT (ready)                                        │
│  155 vídeos XBZ (youtube - NÃO MIGRADOS)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Arquitetura de Mídia Alvo

```
┌─────────────────────────────────────────────────────────────────┐
│                 ARQUITETURA ALVO (estado futuro)                │
└─────────────────────────────────────────────────────────────────┘

IMAGENS — fluxo padronizado por fornecedor:
  Fonte original → Bronze (url_original em raw_data)
    → Silver (fn_standardize) → Gold (fn_promote)
    → product_images (status = 'pending_upload')
    → Worker CF Image Uploader (pg_cron/Edge Function */5)
        → POST CF Images API (upload via URL)
        → UPDATE product_images SET cloudflare_image_id, url_cdn, status='uploaded'
    → Delivery: imagedelivery.net/{hash}/{id}/public

VÍDEOS — fluxo padronizado:
  YouTube ID (Bronze/Silver) → product_videos (cloudflare_status = 'pending')
    → Worker CF Stream Uploader (pg_cron diário)
        → POST CF Stream API (upload via YouTube URL)
        → UPDATE product_videos SET cloudflare_video_id, cloudflare_status='ready',
                                     url_hls, url_dash, url_stream

STAGING (XBZ gallery):
  xbz_gallery_staging (discovered)
    → Worker upload em lote (*/30 min, max 100/execução)
    → CF Images API
    → UPDATE status='uploaded', cloudflare_image_id, url_cdn
    → INSERT product_images (se não existir)
```

---

## 10. Plano de Ação e Roadmap

### Fase 1 — Normalização (0-1 semana)

| Tarefa | Prioridade | Esforço |
|---|---|---|
| **F1.1** Corrigir `source_supplier` case: `UPDATE product_images SET source_supplier='XBZ' WHERE source_supplier='xbz'` | 🔴 Alta | 15 min |
| **F1.2** Auditoria: quais dos 312 produtos sem imagem têm URLs válidas no Bronze? | 🔴 Alta | 2h |
| **F1.3** Fix na tabela `product_videos`: zerar `cloudflare_video_id` dos 155 XBZ que contêm YouTube ID no lugar errado | 🟡 Média | 30 min |

### Fase 2 — XBZ Gallery Staging Pipeline (1-3 semanas)

| Tarefa | Prioridade | Esforço |
|---|---|---|
| **F2.1** Criar worker `xbz-gallery-uploader` (CF Worker com scheduled trigger */30 min) | 🔴 Alta | 3-4h |
| **F2.2** Lógica: processar max 100 imagens/execução do staging (`status='discovered'`) | 🔴 Alta | incluso F2.1 |
| **F2.3** Upload via CF Images API (URL-based upload direto do site XBZ) | 🔴 Alta | incluso F2.1 |
| **F2.4** Após upload: UPDATE staging + INSERT em `product_images` se não existir | 🔴 Alta | incluso F2.1 |
| **F2.5** Tratamento de erro (imagem inválida, 404) → status='error', error_message | 🟡 Média | incluso F2.1 |
| **F2.6** Meta: processar 17.709 imagens em ~3-5 dias (~100/30min = ~5.760/dia) | — | automático |

### Fase 3 — Migração Vídeos XBZ → CF Stream (2-4 semanas)

| Tarefa | Prioridade | Esforço |
|---|---|---|
| **F3.1** Criar função `fn_migrate_youtube_to_cfstream(supplier)` | 🟡 Média | 2h |
| **F3.2** Para cada vídeo com `cloudflare_status='youtube'`: fazer upload via CF Stream API (POST com URL do YouTube) | 🟡 Média | incluso F3.1 |
| **F3.3** Após migration: UPDATE `cloudflare_video_id`, `cloudflare_status='ready'`, `url_hls`, `url_dash`, `url_stream` | 🟡 Média | incluso F3.1 |
| **F3.4** Processar 155 vídeos XBZ (lote seguro, máx 10-20/dia para respeitar limites CF Stream) | 🟡 Média | 1 semana execução |

### Fase 4 — Gaps de Cobertura (3-5 semanas)

| Tarefa | Prioridade | Esforço |
|---|---|---|
| **F4.1** SM: identificar 118 produtos sem imagem e tentar re-fetch via Jina ou SM API | 🟡 Média | 2-3h |
| **F4.2** XBZ: identificar 168 produtos sem imagem — verificar se têm URLs no Bronze | 🟡 Média | 1-2h |
| **F4.3** ASIA: identificar 16 produtos sem imagem — re-fetch via `asia_detalhe_produto` | 🟡 Média | 1-2h |
| **F4.4** 88 Brindes: implementar pipeline de imagens do zero (após descoberta da API) | 🟡 Média | depende da API |

### Fase 5 — Otimizações e SEO (ongoing)

| Tarefa | Prioridade | Esforço |
|---|---|---|
| **F5.1** Gerar `alt_text` automático via Claude API para imagens sem alt_text | 🟢 Baixa | 4-6h |
| **F5.2** Definir URL variants padrão: `/thumbnail` (200px), `/card` (400px), `/full` (1200px) via CF Images | 🟢 Baixa | 2h |
| **F5.3** Adicionar tipos `ambient` e `detail` para SM via Playwright (scraping adicional) | 🟢 Baixa | 4-6h |
| **F5.4** Webhook para re-upload automático quando imagem CF for deletada por engano | 🟢 Baixa | 2-3h |

---

## 11. Convenções e Padrões

### 11.1 Nomenclatura de IDs no Cloudflare Images (padrão a manter)

```
{supplier_prefix}-{identificador_produto}_{identificador_variante}{-sufixo_opcional}
```

| Supplier | Prefix | Exemplo completo |
|---|---|---|
| SPOT | `spot-` | `spot-11103_103-b` |
| SPOT picotado | `spot-pa-` | `spot-pa-11103_103_1_1_1` |
| XBZ | `xbz-` | `xbz-01332-d1` |
| Só Marcas | `sm-` | `sm-as-00610-00` |
| ASIA Import | `asia-` | `asia-bac003-1` |
| 88 Brindes | `88b-` | `88b-1000-002-main` |

### 11.2 Variantes de transformação CF Images (a implementar)

```
/public           → imagem original (max 1920px, qualidade original)
/thumbnail        → 200×200, crop center, quality=80
/card             → 400×400, contain, quality=85
/full             → max 1200px, quality=90
/og               → 1200×630, crop center (Open Graph)
```

Configurar via CF Images Variants na conta.

### 11.3 Status lifecycle de `product_images`

```
(novo) → pending_upload → uploading → uploaded ✅
                                    → error ❌ (retry automático)
```

> **Nota:** Hoje a tabela não tem campo `status` — imagens são inseridas já com `cloudflare_image_id` preenchido. Considerar adicionar `upload_status` em migration futura para o novo pipeline (F2.1+).

---

## 12. KPIs e Métricas de Acompanhamento

| KPI | Meta | Atual |
|---|---|---|
| Cobertura imagem nos produtos Gold | ≥ 99% | 95.2% |
| Cobertura CF Images (% plano usado) | < 85% | 48% |
| XBZ staging processada | 100% | 0% |
| Vídeos CF Stream vs YouTube | 100% CF | 47% CF (SPOT), 0% CF (XBZ) |
| Produtos sem imagem | 0 | 312 |
| Imagens com alt_text | ≥ 90% | desconhecido |

---

## 13. Workers Cloudflare Relacionados

| Worker | Função | Status |
|---|---|---|
| `xbz-cache-refresh` | Refresh de cache XBZ (scheduled) | ✅ Ativo |
| `xbz-mcp` | MCP XBZ Brindes | ✅ Ativo |
| `spot-ws-mcp` | MCP SPOT Webservice | ✅ Ativo |
| `somarcas-*` | MCPs Só Marcas (3 workers) | ⚠️ Broken (RLS) |
| `asia-import-mcp` | MCP Asia Import | ✅ Ativo |
| `cloudflare-deploy-mcp` | Deploy via MCP | ✅ Ativo |
| `xbz-gallery-uploader` | **Upload staging → CF Images** | 🔴 NÃO EXISTE (F2.1) |
| `cf-stream-migrator` | **Migração YouTube → CF Stream** | 🔴 NÃO EXISTE (F3.1) |

---

*Documento gerado em jun/2026 a partir de: `cf_images_stats` (sample_pages=5) + SQL queries diretas ao Supabase `doufsxqlfjyuvxuezpln` + listagem de Cloudflare Workers.*

*Próxima revisão recomendada após conclusão da Fase 2 (XBZ Gallery Pipeline).*
