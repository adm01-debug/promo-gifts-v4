#!/usr/bin/env bash
# Revalidação completa do módulo Magazine após merge do `types.ts` regenerado.
#
# Fluxo:
#   1. Snapshot pré-migração de untypedFrom (deve ser 26: 13 magazines +
#      10 magazine_items + 3 no bloco de tipos).
#   2. Executa apply-magazine-typed-queries.sh.
#   3. Confere as substituições exatas: 23 call-sites migrados + bloco de
#      tipos removido → 0 untypedFrom remanescente em magazineService.
#   4. Roda o pipeline: tsgo → lint-untyped-from → vitest do módulo →
#      lint:baseline.
#   5. Emite relatório em qa/reports/magazine-typed-queries-revalidation-<data>.md
#
# Uso:  bash docs/plans/revalidate-magazine-typed-queries.sh
#
# Bloqueia se types.ts não estiver regenerado (evita rodada às cegas).

set -euo pipefail

FILE="src/services/magazineService.ts"
TYPES="src/integrations/supabase/types.ts"
DATE=$(date -u +%Y-%m-%d)
REPORT="qa/reports/magazine-typed-queries-revalidation-${DATE}.md"

# ── 0. pré-condições ──────────────────────────────────────────────────────
if ! grep -qE "^\s*magazines: \{" "$TYPES" || ! grep -qE "^\s*magazine_items: \{" "$TYPES"; then
  echo "::error::$TYPES não contém as tabelas magazines/magazine_items."
  echo "         Merge antes o PR 'chore: regenerate supabase types'."
  exit 2
fi

# ── 1. snapshot pré-migração ──────────────────────────────────────────────
PRE_TOTAL=$(grep -c "untypedFrom" "$FILE" || true)
PRE_MAG=$(grep -c "untypedFrom<MagazineRow>('magazines')" "$FILE" || true)
PRE_ITEMS=$(grep -c "untypedFrom<MagazineItemRow>('magazine_items')" "$FILE" || true)

echo "::group::Pré-migração"
echo "  untypedFrom total:                             $PRE_TOTAL  (esperado ≥ 23)"
echo "  untypedFrom<MagazineRow>('magazines'):         $PRE_MAG   (esperado 13)"
echo "  untypedFrom<MagazineItemRow>('magazine_items'):$PRE_ITEMS (esperado 10)"
echo "::endgroup::"

if [[ "$PRE_MAG" -lt 13 || "$PRE_ITEMS" -lt 10 ]]; then
  echo "::warning::Contagem pré-migração fora do esperado — magazineService.ts pode já ter sido tocado."
fi

# ── 2. aplica a migração ──────────────────────────────────────────────────
bash docs/plans/apply-magazine-typed-queries.sh

# ── 3. valida substituições ──────────────────────────────────────────────
POST_TOTAL=$(grep -c "untypedFrom" "$FILE" || true)
POST_SUPA=$(grep -c "supabase.from('magazines')" "$FILE" || true)
POST_ITEMS=$(grep -c "supabase.from('magazine_items')" "$FILE" || true)

echo "::group::Pós-migração"
echo "  untypedFrom remanescente:                $POST_TOTAL   (esperado 0)"
echo "  supabase.from('magazines') novos:        $POST_SUPA    (esperado ≥ $PRE_MAG)"
echo "  supabase.from('magazine_items') novos:   $POST_ITEMS   (esperado ≥ $PRE_ITEMS)"
echo "::endgroup::"

if [[ "$POST_TOTAL" -ne 0 ]]; then
  echo "::error::Sobrou untypedFrom em $FILE após script."
  grep -n "untypedFrom" "$FILE"
  exit 3
fi
if [[ "$POST_SUPA" -lt "$PRE_MAG" ]] || [[ "$POST_ITEMS" -lt "$PRE_ITEMS" ]]; then
  echo "::error::Substituições faltando: esperado $PRE_MAG magazines + $PRE_ITEMS magazine_items."
  exit 4
fi

# ── 4. pipeline de validação ─────────────────────────────────────────────
echo "::group::tsgo --noEmit"
npx tsgo --noEmit
echo "::endgroup::"

echo "::group::lint-untyped-from"
bash scripts/lint-untyped-from.sh
echo "::endgroup::"

echo "::group::vitest — módulo Magazine"
npx vitest run \
  src/services/__tests__/magazineAddProductsUnique.test.ts \
  src/services/__tests__/magazineEdgeContract.test.ts \
  src/pages/magazine/__tests__/publishAwait.regression.test.ts \
  tests/integration/magazine-service-fuzz.test.ts \
  src/pages/magazine/__tests__/pagination.property.test.ts \
  src/pages/magazine/__tests__/stepValidation.matrix.test.ts \
  --reporter=default
echo "::endgroup::"

echo "::group::lint:baseline"
npm run lint:baseline
echo "::endgroup::"

# ── 5. relatório ─────────────────────────────────────────────────────────
mkdir -p qa/reports
cat > "$REPORT" <<EOF
# Revalidação — Magazine typed queries — ${DATE}

## Substituições
- \`untypedFrom<MagazineRow>('magazines')\`: ${PRE_MAG} → \`supabase.from('magazines')\`
- \`untypedFrom<MagazineItemRow>('magazine_items')\`: ${PRE_ITEMS} → \`supabase.from('magazine_items')\`
- Total \`untypedFrom\` no arquivo: ${PRE_TOTAL} → ${POST_TOTAL}

## Pipeline
- \`tsgo --noEmit\`: ✅
- \`scripts/lint-untyped-from.sh\`: ✅
- Vitest (6 suítes Magazine): ✅
- \`npm run lint:baseline\`: ✅

## Próximos passos
Abrir PR seguindo \`.github/pulls/refactor-magazine-typed-queries.md\`.
EOF

echo "::notice::Revalidação completa. Relatório: $REPORT"
