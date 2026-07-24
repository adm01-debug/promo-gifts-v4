# Simulação de Cenários V6 — Prevendo Falhas e Gaps

**Data:** 2026-06-11 · **Projeto:** Supabase `doufsxqlfjyuvxuezpln`
**Método:** baterias de simulação em schema isolado (`sim.*`), executadas ANTES de
qualquer mudança no pipeline. Corpus = dados reais de produção (não sintéticos).
**Volume total:** ~9.800 cenários executados.

---

## Resultado por bateria

| # | Bateria | Cenários | Resultado |
|---|---------|----------|-----------|
| S1a | `fn_normalize_ncm` — casos artesanais (pontos, hífens, O→0, Z→0, placeholders, 7/9 dígitos, letras, vazios) | 30 | **30/30 PASS** |
| S1b | `fn_normalize_ncm` — fuzzing com TODOS os NCMs reais do Bronze (5 fornecedores, 18.4k raws, 273 valores distintos) | 273 | **0 falhas reais** — únicas rejeições = placeholder `00000000` (90 raws XBZ, comportamento correto) |
| S2 | `fn_display_product_name` — full-corpus 7.491 nomes reais | 7.491 ×2 (idempotência) | **0 vazios · 0 não-idempotentes · 0 siglas mutiladas · 0 unidades mutiladas · 0 espaços duplos** |
| S3 | `fn_apply_transform` — fuzzing adversarial (19 transform types × configs ativos × 20 inputs: vazio, N/A, milhar BR, emoji, multiline, 2000 chars...) | 1.020 | **0 exceções**; 2 gaps teóricos identificados (abaixo) |
| S4 | Resolução de `source_path`/`source_field` — todos os mappings ativos × 200 raws/fornecedor | ~12.000 resoluções | 20 mappings com 0% — **todos explicados** por heterogeneidade de tipo de raw (variantes ASIA em `variacoes[]`, preços SPOT em feed separado, nulls 88B). **Nenhum bug classe `$.titulo`** |
| S5 | Categorização — produtos Gold sem categoria vs `classify_xbz_category` | 388 | 112 resolvíveis pelo classify; residual exigiu dicionário novo (implementado) |
| S6/S7 | Oportunidade IPI — `ncm_codes` lookup + moda de irmãos + campo raw XBZ `IpiTaxa` | 7.5k produtos | Ganho previsto: ~2.500 produtos; **8 conflitos** fornecedor≠tabela (política: fornecedor vence, nunca sobrescrever) |
| S8 | Tokenização tags — full-corpus | 7.491 | v1: 7 nomes sem tags ("KIT PARA CHÁ - 3 PÇS") → v2 com tokens ≥3 chars: **0 sem tags** |
| E2E | Cadeia completa standardize→enrich→promote ×2 em 10 produtos (2/fornecedor) | 10 ×2 | **0 divergências** entre rodadas (convergência total) |

---

## Falhas e gaps PREVISTOS pela simulação (e o que foi feito)

### Críticos — corrigidos
1. **Decay sistêmico (raiz de tudo):** `fn_standardize_raw` calculava ~20 campos
   mapeados (tags, materials, meta_keywords, engraving_type, images, box_*, flags...)
   e os **descartava** no UPDATE final. Cada sync re-ingeria sem enriquecimento —
   por isso as melhorias V1 (retroativas) decaíram. → **v3 persiste todas as colunas.**
2. **Bloco IPI morto:** o lookup `ncm_codes` estava no branch `ELSE` onde `v_ncm`
   é sempre NULL — nunca executou desde que foi escrito. → movido para
   `fn_enrich_padronizacao` com cadeia tabela→moda-irmãos.
3. **Máquina de ALLCAPS em 3 pernas:** Silver UPPER (contrato de matching, mantido)
   → promote copiava cru → trigger Gold re-UPPERizava SPOT. 7.485 produtos do site
   em caixa alta. → promoção e trigger agora usam `fn_display_product_name`.
4. **Lock em massa:** 2.526 produtos com `name` em `locked_fields` — auditoria provou
   que 100% eram byte-idênticos à forma máquina (zero conteúdo humano). Retro aplicado
   com preservação de conteúdo; pipeline continua respeitando locks.
5. **`IpiTaxa` XBZ sem mapping:** 91.3% de cobertura no raw, ignorado. → mapping criado
   (+1.070 produtos com IPI real do fornecedor).
6. **Duplicatas de variantes 88B:** 10 SKUs ×4 cópias (syncs repetidos sem guarda). → dedup
   mantendo a linha conectada/mais recente (30 removidas).

### Teóricos — documentados, sem ação (0 ocorrências reais no corpus)
- `cast_decimal('1.234,56')` → NULL (formato milhar BR não usado por nenhum fornecedor)
- `dim_to_cm('1,5')` → NULL (dimensões com vírgula inexistentes nos raws)

### Limites de fonte — documentados (não fabricáveis)
- **88 Brindes:** fonte sem NCM (21 produtos) → IPI também bloqueado. Próximo passo:
  classificação fiscal manual ou consulta TIPI.
- **ASIA description (Silver 53%):** só 28% dos raws atuais têm `descricao`; Gold
  está em 97.9% via histórico.
- **SPOT IPI (Silver 81%):** raw não tem campo IPI; tabela `ncm_codes` local tem só
  261 entradas. Próximo passo: importar TIPI completa.

---

*Todas as baterias usaram schema `sim` isolado, removido após a execução.
Nenhuma mutação de produção ocorreu durante a fase de simulação.*
