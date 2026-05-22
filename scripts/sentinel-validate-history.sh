#!/usr/bin/env bash
# ============================================================================
# sentinel-validate-history.sh — auditoria retroativa
#
# Roda o sentinel-check.sh contra os últimos N commits da main.
# Útil quando se altera a lógica do sentinel para garantir que commits
# legítimos antigos ainda passam (zero falso positivo) e que pushes
# diretos antigos continuam sendo detectados (zero falso negativo).
#
# Uso: bash scripts/sentinel-validate-history.sh [N=30] [TARGET_REF=origin/main]
# Exemplo: bash scripts/sentinel-validate-history.sh 50 main
# ============================================================================

set -euo pipefail

N="${1:-30}"
TARGET_REF="${2:-origin/main}"

# Fix [8]: validar N antes de chamar git log
if ! [[ "$N" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERRO: N deve ser inteiro positivo (recebido: '$N')" >&2
  echo "Uso: $0 [N=30] [TARGET_REF=origin/main]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$SCRIPT_DIR/sentinel-check.sh"

# Fix [9/18]: não fazer chmod em runtime (falha em FS read-only).
# Como executamos com `bash "$CHECK"`, bit +x não é necessário.
if [[ ! -f "$CHECK" ]]; then
  echo "ERRO: sentinel-check.sh não encontrado em: $CHECK" >&2
  exit 1
fi

PASS=0
FAIL=0

printf "%-9s  %-32s  %-10s  %s\n" "SHA" "AUTOR" "VEREDITO" "MOTIVO"
printf "%-9s  %-32s  %-10s  %s\n" "---------" "--------------------------------" "----------" "----------------------"

while read -r SHA; do
  SUBJECT=$(git log -1 --pretty=%s "$SHA")
  FULL_MSG=$(git log -1 --pretty=%B "$SHA")
  AUTHOR=$(git log -1 --pretty=%an "$SHA")

  if RESULT=$(bash "$CHECK" "$SUBJECT" "$FULL_MSG" "$AUTHOR" 2>&1); then
    printf "%-9s  %-32s  %-10s  %s\n" "${SHA:0:7}" "${AUTHOR:0:32}" "✅ PASS" "$RESULT"
    PASS=$((PASS + 1))
  else
    printf "%-9s  %-32s  %-10s  %s\n" "${SHA:0:7}" "${AUTHOR:0:32}" "❌ FAIL" "$RESULT"
    FAIL=$((FAIL + 1))
  fi
done < <(
  # Fix [1/17]: auditar ref alvo (default origin/main) em vez de HEAD da branch atual.
  # Se a ref existir como remote, fazer fetch silencioso pra ter o histórico atualizado.
  if [[ "$TARGET_REF" == origin/* ]]; then
    git fetch --quiet origin "${TARGET_REF#origin/}" 2>/dev/null || true
  fi
  git log -n "$N" --pretty=%H "$TARGET_REF"
)

echo ""
echo "Total auditado: $((PASS + FAIL))   |   Passou: $PASS   |   Falhou: $FAIL"
