# Relatório de Melhorias V2 — Rumo ao 10/10 (anti-decay)

**Data:** 2026-06-11 · **Projeto:** Supabase `doufsxqlfjyuvxuezpln`
**Antecedente:** as 10 melhorias V1 (2026-06-06) foram aplicadas como UPDATEs
retroativos. **Diagnóstico V2 provou que decaíram**: novas sincronizações
re-ingeriram dados brutos por cima das correções. V2 corrige **as funções do
pipeline** (fonte), reconverge retroativamente e instala monitoramento anti-regressão.

---

## Regressão encontrada no diagnóstico (estado real vs relatório V1)

| Métrica | V1 reportou | V2 encontrou | Causa |
|---|---|---|---|
| ALLCAPS Silver+Gold | 0 | **100% (7.5k produtos)** | UPDATE retroativo + funções re-UPPERizando |
| ASIA materials | 85.4% | **27.2%** | 481 produtos novos sem enriquecimento |
| ASIA tags | 100% | **47.3%** | idem |
| XBZ tags | 100% | 92.7% | idem |
| XBZ IPI (Silver) | — | 58.8% | bloco IPI morto + `IpiTaxa` sem mapping |
| ASIA IPI (Silver) | — | 3.3% | idem |

## Melhorias executadas (uma a uma, cada qual simulada → migrada → validada)

### M11 — Núcleo anti-decay
- **M11a** `fn_display_product_name` (sentence-case por segmento com preservação de
  siglas/unidades minerada dos dados: USB, LED, ABS, PU, 600D, 16L, A5, GB...),
  `fn_tokenize_product_tags` (PT, ≥3 chars, stopwords), `fn_safe_jsonb_arr`/`fn_safe_text_arr`.
  Validação full-corpus 7.491 nomes: zero defeitos.
- **M11b** `fn_enrich_padronizacao` — enriquecimento canônico só-preenche-NULL:
  description←raw · materials←raw|extração · tags←raw∪tokenização ·
  ipi←ncm_codes|moda-irmãos · ncm←prefixo-nome inequívoco · meta←tags.
  Validação 25 produtos: 0 sobrescritas, 32 preenchimentos.
- **M11c** `fn_standardize_raw` v3 — persiste TODAS as ~20 colunas mapeadas que eram
  descartadas; remove bloco IPI morto; chama enrich ao final. Validação 50 raws ×2:
  0 falhas, 0 não-idempotência, 0 regressões NULL.

### M12 — Display-case no Gold
- `fn_promote_padronizacao` v2: Gold name ← `fn_display_product_name(s.name)`;
  guards `NULLIF('[]')` em tags/materials na promoção (anti-Bug6); `locked_fields`
  respeitado em todos os campos.
- `trigger_limpar_nome_produto` v3: SPOT no Gold recebe display-case (era UPPERCASE).
- **Auditoria de locks:** 2.526 nomes lockados — 100% byte-idênticos à forma máquina,
  zero conteúdo humano. Retro seguro.

### M13 — Convergência retroativa Silver
| Passo | Ganho |
|---|---|
| IPI ← `ncm_codes` | +781 |
| IPI ← moda inequívoca de irmãos (2 passadas) | +620 |
| IPI ← raw XBZ `IpiTaxa` (novo mapping, 91.3% cobertura) | +1.070 |
| IPI ← moda pós-XBZ | +214 |
| NCM ← prefixo de nome inequívoco | +15 |
| tags/materials/meta/description ← enrich | 1.961 produtos |

### M14 — Convergência retroativa Gold
- **7.485 nomes** ALLCAPS → display-case (conteúdo preservado, só caixa).
- **1.357 produtos** enriquecidos (tags/materials/meta/ipi/ncm/description ← Silver,
  fill-only, locks respeitados por coluna).

### M16 — Categorias
- `fn_classify_category_residual` — dicionário ILIKE de alta precisão (2 ondas,
  derivado da mineração dos sem-categoria: caixa de som, mouse pad, churrasco,
  chapéus, cadernos, marmitas, kits drink/executivo, frasqueiras, pet...).
- `fn_promote_category_fallback` — cadeia: classify (melhor confiança) → residual.
- Integrada à promoção (fill-only, nunca em campo lockado) + retro: **+271 categorias**.

### M17 — Higiene final
- 1 NCM com pontos normalizado; 1 produto `rejected` re-padronizado com v3;
- 30 variantes duplicadas 88B removidas (mantida a conectada/mais recente).

### M18 — Monitoramento anti-regressão (a guarda que faltava)
- `vw_medallion_coverage` — cobertura ao vivo por fornecedor × camada × 8 métricas.
- `medallion_coverage_snapshots` + cron diário `medallion-coverage-daily` (03:37 UTC).
- `fn_check_coverage_regression()` — acusa queda >2pp vs máximo de 7 dias.

---

## Estado final — Gold (camada do site)

| Fornecedor | Prod | NCM | Mat | Tags | Meta | IPI | Desc | Cat | Nome-display |
|---|---|---|---|---|---|---|---|---|---|
| XBZ | 4.055 | 99.0 | 98.0 | 99.9 | 100 | **99.7** | 98.0 | 97.0 | **100** |
| Só Marcas | 1.325 | 100 | 94.9 | 100 | 100 | 100 | 100 | **100** | **100** |
| Spot/Stricker | 1.210 | 100 | **100** | 100 | 100 | 99.8 | 100 | 99.8 | **100** |
| Asia Import | 923 | 98.0 | 97.1 | 99.6 | 100 | 95.0 | 97.9 | 98.2 | **100** |
| 88 Brindes | 21 | 4.8* | 100 | 95.2 | 100 | 4.8* | 100 | **100** | **100** |

\* limite de fonte: 88B não envia NCM (21 produtos — classificação fiscal manual pendente).

## Estado final — Silver

| Fornecedor | NCM | Mat | Tags | Meta | IPI | Desc |
|---|---|---|---|---|---|---|
| XBZ | 98.7 | 88.4 | **100** | **100** | **98.3** (era 58.8) | 92.6 |
| Só Marcas | 100 | 94.9 | **100** | **100** | **100** | 100 |
| Spot/Stricker | 100 | 99.8 | **100** | **100** | 81.2 (era 58.2) | 100 |
| Asia Import | 98.0 | **83.5** (era 27.2) | **100** (era 47.3) | **100** | **93.7** (era 3.3) | 53.2* |
| 88 Brindes | 0* | 100 | 100 | 100 | 0* | 100 |

\* limites de fonte documentados em `SIMULACAO_CENARIOS_V6.md`.

## Invariantes finais (todos PASS)
1. Zero `rejected` na Silver · 2. Zero ALLCAPS-máquina no Gold · 3. Zero nomes vazios
4. Zero tags vazias (com nome) · 5. Zero NCM com pontos · 6/7. Zero placeholder `00000000`
8. Zero SKUs duplicados em variantes · 9. Zero IPI negativo · 10. Zero meta_keywords vazios
11. `fn_check_coverage_regression()` = vazio · E2E ×2 = 0 divergências

## Por que não vai decair de novo
1. Enriquecimento roda NA INGESTÃO (`fn_standardize_raw` → `fn_enrich_padronizacao`).
2. Promoção produz display-case e categoria automaticamente.
3. Sync que re-ingerir bruto converge sozinho (idempotência provada ×2).
4. Se algo regredir >2pp, `fn_check_coverage_regression()` acusa com snapshot diário.

## Pendências honestas (próximos passos)
- **TIPI completa** em `ncm_codes` (fecha SPOT IPI 81→~100 e residuais).
- **88B NCM/IPI**: 21 produtos, classificação fiscal manual.
- **ASIA description**: fonte fraca (28% dos raws); avaliar scrape/IA descritiva.
- 189 produtos sem categoria (97.5% cobertos; novos produtos são categorizados
  automaticamente pela cadeia na promoção).
