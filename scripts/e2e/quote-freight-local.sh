#!/usr/bin/env bash
# Executa o Playwright do bloco Frete localmente.
# Uso:
#   bash scripts/e2e/quote-freight-local.sh            # roda a suíte
#   bash scripts/e2e/quote-freight-local.sh --update   # regenera baselines PNG
set -euo pipefail

SPEC="e2e/visual/quote-freight-block.spec.ts"
SNAP_DIR="e2e/visual/quote-freight-block.spec.ts-snapshots"
PROJECT="chromium-public"

MODE="run"
if [[ "${1:-}" == "--update" ]]; then
  MODE="update"
fi

echo "▶ Playwright: $SPEC ($PROJECT) [mode=$MODE]"

if [[ "$MODE" == "update" ]]; then
  npx playwright test "$SPEC" --project="$PROJECT" --update-snapshots
  mkdir -p "$SNAP_DIR"
  # Copia PNGs gerados em test-results/ para a pasta de snapshots (fallback
  # caso o Playwright grave em outra pasta ao rodar em modo update).
  if compgen -G "test-results/**/*-actual.png" > /dev/null; then
    find test-results -name '*-actual.png' -print0 |
      while IFS= read -r -d '' f; do
        base="$(basename "$f" -actual.png).png"
        cp -v "$f" "$SNAP_DIR/$base"
      done
  fi
  echo "✅ Baselines atualizados em $SNAP_DIR"
  echo "   Revise os PNGs (git diff) antes de commitar."
else
  npx playwright test "$SPEC" --project="$PROJECT" --reporter=line,html
  echo "ℹ Relatório: playwright-report/index.html"
fi
