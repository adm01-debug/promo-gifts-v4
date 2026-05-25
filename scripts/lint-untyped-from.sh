#!/usr/bin/env bash
# Lint: cruza nomes de tabela chamados via untypedFrom("...") contra o
# schema gerado em src/integrations/supabase/types.ts. Falha se houver
# tabela em untypedFrom() que NÃO aparece no types.ts.
#
# Origem: o colapso de 2026-05-24 (PRs #315 e #317) foi causado por 14
# tabelas chamadas via untypedFrom() que não existiam no banco. O front
# tem `catch { return []; }` em cada chamada, então features quebravam
# em silêncio. Este lint evita a regressão.
#
# Possíveis falhas:
#   1. A tabela não existe no banco → criar migration que a restaure.
#   2. database.types.ts está desatualizado → rodar `supabase gen types`.
#
# Uso local: ./scripts/lint-untyped-from.sh
# Uso CI:    .github/workflows/lint-untyped-from.yml

set -euo pipefail

REPO_ROOT="${1:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
TYPES_FILE="$REPO_ROOT/src/integrations/supabase/types.ts"
SRC_DIR="$REPO_ROOT/src"
DEF_FILE="src/lib/supabase-untyped.ts"

if [[ ! -f "$TYPES_FILE" ]]; then
  echo "::error::types.ts não encontrado em $TYPES_FILE"
  echo "Rode 'supabase gen types typescript --project-id <id> > $TYPES_FILE' antes."
  exit 2
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "::error::diretório src/ não encontrado em $SRC_DIR"
  exit 2
fi

tmp_called=$(mktemp)
tmp_schema=$(mktemp)
tmp_missing=$(mktemp)
trap 'rm -f "$tmp_called" "$tmp_schema" "$tmp_missing"' EXIT

# 1) Tabelas chamadas via untypedFrom("...") ou untypedFrom('...') em src/
#    (exclui a própria definição em supabase-untyped.ts)
grep -rhE "untypedFrom[^(]*\(['\"]([a-z_][a-z0-9_]*)['\"]" "$SRC_DIR" \
    --include='*.ts' --include='*.tsx' --exclude='supabase-untyped.ts' 2>/dev/null \
  | sed -E "s/.*untypedFrom[^(]*\(['\"]([a-z_][a-z0-9_]+)['\"].*/\1/" \
  | sort -u > "$tmp_called" || true

# 2) Nomes de tabela no types.ts gerado.
#    Estrutura: dentro de `Tables: {`, cada chave é uma tabela com 6
#    espaços de indentação seguida de `: {`.
grep -E '^      [a-z_][a-z0-9_]+: \{$' "$TYPES_FILE" \
  | sed -E 's/^      ([a-z_][a-z0-9_]+):.*/\1/' \
  | sort -u > "$tmp_schema"

called_count=$(wc -l < "$tmp_called" | tr -d ' ')
schema_count=$(wc -l < "$tmp_schema" | tr -d ' ')

echo "=== lint-untyped-from ==="
echo "Tabelas chamadas via untypedFrom(): $called_count"
echo "Tabelas no schema gerado (types.ts): $schema_count"
echo ""

if [[ "$called_count" -eq 0 ]]; then
  echo "✅ Nenhuma chamada untypedFrom() encontrada — fonte está totalmente tipada."
  exit 0
fi

# 3) Diff: tabelas em untypedFrom que NÃO existem no schema
comm -23 "$tmp_called" "$tmp_schema" > "$tmp_missing"

if [[ ! -s "$tmp_missing" ]]; then
  echo "✅ Todas as $called_count tabelas chamadas via untypedFrom() existem"
  echo "   no schema gerado. Considere migrá-las para supabase.from() tipado."
  echo ""
  echo "Chamadas detectadas:"
  sed 's/^/  - /' "$tmp_called"
  exit 0
fi

missing_count=$(wc -l < "$tmp_missing" | tr -d ' ')

echo "::error::$missing_count tabela(s) em untypedFrom() não existem no schema gerado:"
sed 's/^/  - /' "$tmp_missing"
echo ""
echo "Possíveis causas:"
echo "  1. A tabela não existe no banco. Crie uma migration que a restaure"
echo "     (ver PR #315 / #317 como referência)."
echo "  2. database.types.ts está desatualizado. Rode:"
echo "       supabase gen types typescript --project-id <id> \\"
echo "         > src/integrations/supabase/types.ts"
echo ""
echo "Este lint existe pra evitar a regressão do colapso de 2026-05-24,"
echo "quando tabelas inexistentes no banco quebravam features silenciosamente."
exit 1
