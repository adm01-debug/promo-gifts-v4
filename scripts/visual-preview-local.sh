#!/usr/bin/env bash
# Rodar a suíte visual do botão Preview localmente antes de abrir PR.
#
# Uso:
#   bash scripts/visual-preview-local.sh                 # roda specs (falha se diff)
#   bash scripts/visual-preview-local.sh --update        # atualiza baselines
#   bash scripts/visual-preview-local.sh --ui            # abre Playwright UI

set -euo pipefail

cd "$(dirname "$0")/.."

UPDATE=""
UI=""
for arg in "$@"; do
  case "$arg" in
    --update) UPDATE="--update-snapshots" ;;
    --ui)     UI="--ui" ;;
    *) echo "Flag desconhecida: $arg" >&2; exit 2 ;;
  esac
done

echo "▶ 1/4 Guarda de presença da suíte visual..."
node scripts/check-visual-preview-suite.mjs

echo "▶ 2/4 Garantindo browser Chromium do Playwright..."
npx playwright install chromium >/dev/null

# Sobe dev server em background se nada estiver escutando em :8080.
STARTED_DEV=""
if ! curl -sf http://localhost:8080 >/dev/null 2>&1; then
  echo "▶ 3/4 Iniciando dev server (porta 8080)..."
  npm run dev >/tmp/visual-dev.log 2>&1 &
  DEV_PID=$!
  STARTED_DEV="1"
  trap 'kill ${DEV_PID} 2>/dev/null || true' EXIT
  timeout 90 bash -c 'until curl -sf http://localhost:8080 > /dev/null 2>&1; do sleep 1; done'
else
  echo "▶ 3/4 Dev server já está rodando — reutilizando."
fi

echo "▶ 4/4 Executando specs visuais (Playwright + axe)..."
E2E_BASE_URL="http://localhost:8080" \
  npx playwright test \
    e2e/visual/preview-button.spec.ts \
    --project=chromium-public \
    --reporter=list \
    $UPDATE \
    $UI

echo "✅ Suíte visual passou."
if [ -n "$UPDATE" ]; then
  echo "ℹ️  Baselines atualizadas em e2e/visual/preview-button.spec.ts-snapshots/"
  echo "   Revise visualmente o diff antes de commitar."
fi
