#!/usr/bin/env bash
# ============================================================================
# sentinel-check.sh — Coração do Branch Protection Sentinel
#
# Recebe (subject, full_message, author) e retorna:
#   - exit 0 + motivo de aceitação no stdout
#   - exit 1 + motivo de rejeição no stdout
#
# Extraído do workflow para permitir teste isolado via fixtures.
# Mudanças aqui devem passar pela matriz em .github/workflows/sentinel-self-test.yml
#
# Uso: bash scripts/sentinel-check.sh "<subject>" "<full-message>" "<author>"
# ============================================================================

set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "ERRO: uso: $0 \"<subject>\" \"<full-message>\" \"<author>\"" >&2
  exit 2
fi

SUBJECT="$1"
FULL_MSG="$2"
AUTHOR="$3"

# Normaliza CRLF (Git Bash / Windows)
SUBJECT=$(printf '%s' "$SUBJECT" | tr -d '\r')
FULL_MSG=$(printf '%s' "$FULL_MSG" | tr -d '\r')

# ----------------------------------------------------------------------------
# Regra 1: Squash merge — mensagem termina em "(#NNN)"
# ----------------------------------------------------------------------------
if echo "$SUBJECT" | grep -qE '\(#[0-9]+\)[[:space:]]*$'; then
  echo "squash-merge"
  exit 0
fi

# ----------------------------------------------------------------------------
# Regra 2: Merge commit — começa com "Merge pull request #NNN"
# ----------------------------------------------------------------------------
if echo "$SUBJECT" | grep -qE '^Merge pull request #[0-9]+'; then
  echo "merge-commit"
  exit 0
fi

# ----------------------------------------------------------------------------
# Regra 3: Bot oficial GitHub
# ----------------------------------------------------------------------------
case "$AUTHOR" in
  "github-actions[bot]"|"dependabot[bot]"|"renovate[bot]")
    echo "bot-oficial: $AUTHOR"
    exit 0
    ;;
esac

# ----------------------------------------------------------------------------
# Regra 4: Família Lovable / gpt-engineer (regex pega renomeações futuras)
# Cobre: lovable-dev[bot], lovable-bot[bot], gpt-engineer-app[bot], etc.
# ----------------------------------------------------------------------------
if [[ "$AUTHOR" =~ ^(lovable|gpt-engineer)-[a-z0-9-]+\[bot\]$ ]]; then
  echo "bot-familia-lovable: $AUTHOR"
  exit 0
fi

# ----------------------------------------------------------------------------
# Regra 5: Release commit
# ----------------------------------------------------------------------------
if echo "$SUBJECT" | grep -qE '^chore\(release\):'; then
  echo "release"
  exit 0
fi

# ----------------------------------------------------------------------------
# Regra 6: Allowlist estreita — prefixos justificados para push direto
# ATENÇÃO: cada novo prefixo aqui é uma porta de fuga. Adicione só com
# justificativa documentada em .github/SENTINEL_CHANGELOG.md
# ----------------------------------------------------------------------------
if echo "$SUBJECT" | grep -qE '^(docs\(redeploy\)|chore\(workflows\)|chore\(docs\)):'; then
  PREFIX="${SUBJECT%%:*}"
  echo "allowlist: $PREFIX"
  exit 0
fi

# ----------------------------------------------------------------------------
# Regra 7: Bypass explícito — [skip-sentinel: <motivo>]
# Motivo é obrigatório e deve ter >=5 caracteres não-espaço.
# Aceita motivo em qualquer parte da mensagem (subject ou body).
# ----------------------------------------------------------------------------
BYPASS_TAG=$(echo "$FULL_MSG" | grep -oE '\[skip-sentinel:[^]]*\]' | head -1 || true)
if [[ -n "$BYPASS_TAG" ]]; then
  REASON="${BYPASS_TAG#\[skip-sentinel:}"
  REASON="${REASON%\]}"
  # Trim
  REASON=$(echo "$REASON" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  # Contar caracteres não-espaço
  REASON_NONSPACE=$(echo -n "$REASON" | tr -d '[:space:]' | wc -c)
  if [[ $REASON_NONSPACE -ge 5 ]]; then
    echo "bypass-explicito: $REASON"
    exit 0
  else
    echo "ERRO: tag [skip-sentinel:] precisa de motivo com >=5 caracteres não-espaço (recebido: '$REASON')"
    exit 1
  fi
fi

# Uso errado: [skip-sentinel] sem ":" — rejeita explicitamente com instrução
if echo "$FULL_MSG" | grep -qE '\[skip-sentinel\]'; then
  echo "ERRO: use [skip-sentinel: <motivo>] em vez de [skip-sentinel] (motivo obrigatório)"
  exit 1
fi

# ----------------------------------------------------------------------------
# Nenhuma regra bateu → rejeita
# ----------------------------------------------------------------------------
echo "sem-padrao-aceito"
exit 1
