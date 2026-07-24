# 4 Melhorias de Pipeline n8n — SM × XBZ
**Data:** 2026-06-07 | **Sessão de comparação e equalização dos pipelines**

---

## Resumo das Melhorias

| # | Melhoria | Status | Impacto |
|---|---|---|---|
| M1 | Auth SM sem hardcode → credential injection | ✅ | Segurança + manutenibilidade |
| M2 | F3 Cores SM → `supplier_colors` | ✅ | 93 cores extraídas (96.8% com nome) |
| M3 | F6 Vídeos SM → `product_videos` | ✅ | 21 vídeos YouTube mapeados |
| M4 | XBZ dividido em Rápida/Full | ✅ | Performance + separação responsabilidades |

---

## MELHORIA 1 — Auth SM via Credential Injection

### Problema
O header `Authorization: Basic YWRtMDFAcHJvbW9icmluZGVzLmNvbS5icjpkMDczNGVmNQ==` estava
hardcoded nos nós F1 de **ambos** os workflows SM (exposição de credencial no JSON do workflow).

### Solução
- Credential `2AEWMg6rT9OwEL8c` ("SÓ MARCAS - API") atualizada para formato httpCustomAuth correto:
  ```json
  { "headers": { "Authorization": "Basic YWRtMDFAcHJvbW9icmluZGVzLmNvbS5icjpkMDczNGVmNQ==" } }
  ```
- Ambos os workflows SM atualizados para usar `predefinedCredentialType: httpCustomAuth`
- Header hardcoded removido dos nós F1

### Workflows afetados
- `6rLiyPPDKrqYqCxu` — SM Rápida 15min
- `GxHE7tqSpgO0Yi33` — SM Full Diária 06h

---

## MELHORIA 2 — F3 Cores SM → `supplier_colors`

### Fonte dos dados
Campo `produtos_similares` no Bronze `api_rest` — formato `codigo|#HEX|id|img|titulo`

### Função criada
`fn_sm_populate_colors()` — v3 com regex Unicode-safe (sem `\b`)

### Algoritmo de extração de nome
1. Regex: padrão `- COR` no título (ex: "CANECA PRETA - 350ML" → "PRETA")
2. Keyword list: PRETO, AZUL, VERDE, VERMELHO, etc. (sem `\b` — compatível com Unicode)
3. Fallback: próprio HEX como descrição

### Resultado
- **93 entradas** inseridas em `supplier_colors`
- **90/93 (96.8%)** com nome de cor extraído
- **3 fallbacks** = kits sem cor discernível no título

### Pipeline
F3 inserido no workflow Full Diário APÓS o merge das 4 fontes:
```
MERGE → F3_fn_sm_populate_colors → url_map_build → Gold → health
```

---

## MELHORIA 3 — F6 Vídeos SM → `product_videos`

### Fonte dos dados
`site_data->>'video_url'` em registros `api_rest` (não `site_scraping`)
- 290 registros com `site_data`
- 24 com `video_url`

### Diferença SM vs XBZ
| | SM | XBZ |
|---|---|---|
| Campo no Bronze | `site_data->>'video_url'` | `site_data->'video'->>''embed_id'` |
| Formato URL | YouTube watch URL completa | YouTube embed_id direto |
| Extração ID | regex `[?&]v=([A-Za-z0-9_-]{11})` | direto |

### Função criada
`fn_sm_populate_videos_from_site(p_supplier_id uuid)`

### Detalhes técnicos importantes
- `cloudflare_video_id` = `'sm_' || youtube_id` (prefixo evita conflito de unique constraint com XBZ)
- `source_supplier` = `'somarcas'`
- `cloudflare_status` = `'youtube'` (embed direto, sem upload CF Stream)
- `DISTINCT ON (youtube_id)` + `ON CONFLICT DO NOTHING` (múltiplos produtos podem compartilhar mesmo vídeo)

### Resultado
- **21 vídeos SM** inseridos em `product_videos`
- Cache `products.videos` atualizado para os 21 produtos

### Pipeline
F6 inserido em paralelo com F3 no workflow Full Diário:
```
MERGE → F3_cores ────┐
       → F6_videos ──┴→ MERGE_POS → url_map → Gold → health
```

---

## MELHORIA 4 — XBZ Dividido em Rápida/Full

### Problema
1 workflow monolítico (`8viF2PiMMNnrnkI0`) rodando a cada 30min com F1+F2+F3+F4+F5 — operações
pesadas (F4 site_tick, F5 vídeos) rodando a cada 30min desnecessariamente.

### Solução
| Workflow | ID | Schedule | Operações |
|---|---|---|---|
| XBZ Rápida 30min | `8viF2PiMMNnrnkI0` | `*/30 * * * *` | F1(6h watermark) + F2 estoque (SEMPRE) + Gold |
| XBZ Full Diária 06h | `fHFf2KFBKSx8ov7S` | `0 6 * * *` | F1 catálogo + F3 cores + F4 site_tick + F5 vídeos + Gold |

### Validação
Execução `1051824` (XBZ Rápida 30min):
- F2 estoque: **10.636 SKUs atualizados** em ~20s
- F1: pulado (catalog < 6h — watermark funcionando)
- Gold: processado
- Status: `success`

---

## Inventário Final de Workflows

### SÓ MARCAS (2 ativos)
| ID | Nome | Schedule | Nós | Operações |
|---|---|---|---|---|
| `6rLiyPPDKrqYqCxu` | SM - Atualização Rápida 15min | `*/15 * * * *` | 12 | F1 + Gold |
| `GxHE7tqSpgO0Yi33` | SM - Atualização Full Diária 06h | `0 6 * * *` | 23 | F1+F2/F3+F3_cores+F4+F5+F6_vídeos+url_map+Gold+health |

### XBZ (2 ativos)
| ID | Nome | Schedule | Nós | Operações |
|---|---|---|---|---|
| `8viF2PiMMNnrnkI0` | XBZ Rápida 30min | `*/30 * * * *` | 16 | F1(watermark 6h) + F2 estoque + Gold |
| `fHFf2KFBKSx8ov7S` | XBZ Full Diária 06h | `0 6 * * *` | 18 | F1+F3+F4+F5+Gold |

---

## Funções SQL Criadas/Atualizadas

| Função | Versão | Descrição |
|---|---|---|
| `fn_sm_populate_colors()` | v3 | Extrai 93 cores do Bronze SM → `supplier_colors`. Regex Unicode-safe. |
| `fn_sm_populate_videos_from_site(uuid)` | v1 | Extrai vídeos YouTube do `site_data` → `product_videos`. Prefixo `sm_`, ON CONFLICT DO NOTHING. |

---

## Estado do Banco (pós-melhorias)

| Tabela | SM | XBZ |
|---|---|---|
| `supplier_colors` | 93 entradas (90 com nome) | pré-existente |
| `product_videos` | **21** (source_supplier='somarcas') | 155 (source_supplier='xbz') |
| `supplier_products_raw` | 1.317 (api_rest) | ~2.056 (api_clientes) |

---

## Credenciais n8n

| ID | Nome | Tipo | Uso |
|---|---|---|---|
| `j0dpRirZr0uT8cBH` | Supabase \| Produtos | supabaseApi | Todos os nós Supabase |
| `2AEWMg6rT9OwEL8c` | SÓ MARCAS - API | httpCustomAuth | F1 SM — injeta `Authorization: Basic ...` |
| `fKHFBCyThqbP8Ofo` | XBZ BRINDES - API | httpCustomAuth | F1/F2/F3 XBZ |
