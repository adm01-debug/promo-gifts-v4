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
# ALLOWLIST: tabelas pré-existentes que precisam de regeneração de types.ts
# ou migration. Listadas aqui para não bloquear CI enquanto são corrigidas.
# Para remover da allowlist: regenere types.ts (supabase gen types typescript)
# ou crie a migration correspondente.
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

# ─── Allowlist de tabelas pré-existentes (types.ts desatualizado) ─────────────
# Estas tabelas existem no banco mas não aparecem no types.ts gerado.
# Foram adicionadas ao código ANTES de regenerar o types.ts.
# Removê-las da allowlist requer: supabase gen types typescript --project-id <id>
ALLOWLIST=(
  audit_log
  categories
  collection_products
  color_nuances
  kit_component_media
  kit_component_print_areas
  mv_stock_velocity
  personalization_simulations
  personalization_techniques
  print_area_techniques
  product_badge_definitions
  product_category_assignments
  product_component_location_techniques
  product_group_components
  product_group_location_techniques
  product_group_locations
  product_images
  product_kit_components
  product_materials
  product_tags
  product_videos
  sales_goals
  security_settings
  supplier_branches
  system_kill_switches
  tabela_preco_gravacao_oficial
  tabela_preco_gravacao_oficial_faixa
  tecnicas_gravacao
  user_2fa_settings
  user_ip_allowlist
  v_kill_switch_hits_summary
  v_smoke_tests_latest_run
  v_smoke_tests_trend
)

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
tmp_allowlist=$(mktemp)
tmp_missing_filtered=$(mktemp)
trap 'rm -f "$tmp_called" "$tmp_schema" "$tmp_missing" "$tmp_allowlist" "$tmp_missing_filtered"' EXIT

# 1) Tabelas chamadas via untypedFrom("...") ou untypedFrom('...') em src/
#    (exclui a própria definição em supabase-untyped.ts)
grep -rhE "untypedFrom[^(]*\(['\"]([a-z_][a-z0-9_]*)['\"]" "$SRC_DIR" \
    --include='*.ts' --include='*.tsx' --exclude='supabase-untyped.ts' 2>/dev/null \
  | sed -E "s/.*untypedFrom[^(]*\(['\"]([a-z_][a-z0-9_]+)['\"].*/\1/" \
  | sort -u > "$tmp_called" || true

# 2) Nomes de tabela no types.ts gerado.
#    Estrutura: dentro de `Tables: {` ou `Views: {`, cada chave é uma entrada
#    com 6 espaços de indentação seguida de `: {`.
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

# 4) Filtrar allowlist: tabelas pré-existentes não bloqueiam CI
printf '%s\n' "${ALLOWLIST[@]}" | sort -u > "$tmp_allowlist"

# missing_filtered = missing MINUS allowlist
comm -23 <(sort "$tmp_missing") "$tmp_allowlist" > "$tmp_missing_filtered"

# Report allowlisted tables as warnings
allowlisted_missing=$(comm -12 <(sort "$tmp_missing") "$tmp_allowlist" | tr '\n' ' ')
if [[ -n "$allowlisted_missing" ]]; then
  echo "⚠️  Tabelas na allowlist (types.ts desatualizado — regenerar para corrigir):"
  comm -12 <(sort "$tmp_missing") "$tmp_allowlist" | sed 's/^/  - /'
  echo ""
fi

if [[ ! -s "$tmp_missing_filtered" ]]; then
  echo "✅ Nenhuma tabela nova fora da allowlist — sem regressão detectada."
  exit 0
fi

missing_count=$(wc -l < "$tmp_missing_filtered" | tr -d ' ')

echo "::error::$missing_count tabela(s) em untypedFrom() não existem no schema gerado:"
sed 's/^/  - /' "$tmp_missing_filtered"
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
