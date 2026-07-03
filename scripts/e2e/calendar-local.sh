#!/usr/bin/env bash
# Roda o spec visual do calendário localmente com os mesmos viewports do CI:
# 320/768/1280. Use --update para regenerar baselines PNG.
set -euo pipefail

UPDATE_FLAG=""
if [[ "${1:-}" == "--update" || "${UPDATE:-}" == "1" ]]; then
  UPDATE_FLAG="--update-snapshots"
  echo "🖼️  Modo: --update-snapshots (regenera baselines do calendário)"
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PLAYWRIGHT_JSON_OUTPUT_NAME=playwright-report/results.json \
  npx playwright test e2e/ui/calendar-visual.spec.ts \
  --project=chromium-public \
  --trace=retain-on-failure \
  --reporter=list,html,json \
  ${UPDATE_FLAG} || TEST_EXIT=$?

TEST_EXIT="${TEST_EXIT:-0}"

if [[ "$TEST_EXIT" -ne 0 ]]; then
  node scripts/build-visual-diff-report.mjs \
    --results test-results \
    --out visual-diff-report/index.html \
    --title "Calendário — local"
fi

exit "$TEST_EXIT"