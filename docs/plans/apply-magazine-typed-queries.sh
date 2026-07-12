#!/usr/bin/env bash
# Aplica a migração `magazineService` → queries tipadas.
# Roda APÓS o types.ts regenerado ter sido mergeado.
#
# Uso:  bash docs/plans/apply-magazine-typed-queries.sh
#
# Idempotente: pode rodar múltiplas vezes; se já migrado, sai limpo.
#
# 2026-07-12 (v2): eliminado o .patch (headers de hunk frágeis com GNU patch).
# Toda a transformação agora é sed/awk determinístico + verificações estritas.

set -euo pipefail

FILE="src/services/magazineService.ts"
TYPES="src/integrations/supabase/types.ts"

if [[ ! -f "$FILE" ]]; then
  echo "::error::$FILE não encontrado (rode a partir da raiz do repo)"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1) Pré-check: types.ts precisa ter as tabelas
# ---------------------------------------------------------------------------
if ! grep -qE "magazines: \{" "$TYPES"; then
  echo "::error::$TYPES não contém a tabela 'magazines'."
  echo "         Rode antes o workflow 'Regenerate Supabase Types' e mergeie o PR."
  exit 2
fi
if ! grep -qE "magazine_items: \{" "$TYPES"; then
  echo "::error::$TYPES não contém a tabela 'magazine_items'."
  exit 2
fi

# ---------------------------------------------------------------------------
# 2) Já migrado?
# ---------------------------------------------------------------------------
if ! grep -q "untypedFrom" "$FILE"; then
  echo "::notice::$FILE já não usa untypedFrom — nada a fazer."
  exit 0
fi

# ---------------------------------------------------------------------------
# 3) Snapshot de contagens ANTES (invariantes esperados)
# ---------------------------------------------------------------------------
BEFORE_MAG=$(grep -c "untypedFrom<MagazineRow>('magazines')" "$FILE" || echo 0)
BEFORE_ITEMS=$(grep -c "untypedFrom<MagazineItemRow>('magazine_items')" "$FILE" || echo 0)
BEFORE_TOTAL=$(grep -c "untypedFrom" "$FILE" || echo 0)
echo "::notice::antes → magazines=$BEFORE_MAG · magazine_items=$BEFORE_ITEMS · untypedFrom total=$BEFORE_TOTAL"

if [[ "$BEFORE_MAG" -eq 0 || "$BEFORE_ITEMS" -eq 0 ]]; then
  echo "::error::contagens inesperadas — abortando por segurança"
  exit 3
fi

# ---------------------------------------------------------------------------
# 4) Transformações mecânicas (sed BSD/GNU compatível)
# ---------------------------------------------------------------------------
cp "$FILE" "$FILE.premigration.bak"

# 4.1 — chamadas untypedFrom<Row>() → supabase.from()
sed -i.bak \
  -e "s/untypedFrom<MagazineRow>('magazines')/supabase.from('magazines')/g" \
  -e "s/untypedFrom<MagazineItemRow>('magazine_items')/supabase.from('magazine_items')/g" \
  "$FILE"

# 4.2 — remover import untypedFrom
sed -i.bak "/^import { untypedFrom } from '@\/lib\/supabase-untyped';$/d" "$FILE"

# 4.3 — inserir import Database logo após import supabase (idempotente)
if ! grep -q "^import type { Database } from '@/integrations/supabase/types';$" "$FILE"; then
  awk '
    /^import { supabase } from .@\/integrations\/supabase\/client.;$/ && !done {
      print
      print "import type { Database } from '\''@/integrations/supabase/types'\'';"
      done=1
      next
    }
    { print }
  ' "$FILE" > "$FILE.awk" && mv "$FILE.awk" "$FILE"
fi

# 4.4 — substituir bloco interface MagazineRow { ... } por type alias
awk '
  /^interface MagazineRow \{$/ { skip=1; print "type MagazineRow = Database['\''public'\'']['\''Tables'\'']['\''magazines'\'']['\''Row'\''];"; next }
  skip && /^\}$/ { skip=0; next }
  skip { next }
  { print }
' "$FILE" > "$FILE.awk" && mv "$FILE.awk" "$FILE"

# 4.5 — substituir bloco interface MagazineItemRow { ... } por type alias
awk '
  /^interface MagazineItemRow \{$/ { skip=1; print "type MagazineItemRow = Database['\''public'\'']['\''Tables'\'']['\''magazine_items'\'']['\''Row'\''];"; next }
  skip && /^\}$/ { skip=0; next }
  skip { next }
  { print }
' "$FILE" > "$FILE.awk" && mv "$FILE.awk" "$FILE"

# 4.6 — atualizar comentário do topo (linhas que mencionam untypedFrom + regeneração pendente)
sed -i.bak \
  -e "s| \* A camada usa \`untypedFrom<Row>()\` porque as tabelas magazine_\* ainda| * 2026-07-XX (PR tipagem): tabelas presentes em types.ts após regeneração;|" \
  -e "s| \* não estão em src/integrations/supabase/types.ts (regeneração pendente).| * migrado para \`supabase.from()\` tipado. \`untypedFrom\` removido deste módulo.|" \
  "$FILE"

# 4.7 — remover bloco `void supabase;` (não é mais necessário)
sed -i.bak '/^\/\/ Marca o supabase client como usado/,/^void supabase;$/d' "$FILE"

rm -f "$FILE.bak"

# ---------------------------------------------------------------------------
# 5) Verificações pós-transformação
# ---------------------------------------------------------------------------
REM=$(grep -c "untypedFrom" "$FILE" || echo 0)
if [[ "$REM" -ne 0 ]]; then
  echo "::error::sobrou 'untypedFrom' em $FILE após substituição:"
  grep -n "untypedFrom" "$FILE"
  echo "::error::rollback → $FILE.premigration.bak"
  exit 4
fi

AFTER_MAG=$(grep -c "supabase.from('magazines')" "$FILE" || echo 0)
AFTER_ITEMS=$(grep -c "supabase.from('magazine_items')" "$FILE" || echo 0)

if [[ "$AFTER_MAG" -lt "$BEFORE_MAG" ]]; then
  echo "::error::supabase.from('magazines') novos ($AFTER_MAG) < untypedFrom<MagazineRow> originais ($BEFORE_MAG)"
  exit 5
fi
if [[ "$AFTER_ITEMS" -lt "$BEFORE_ITEMS" ]]; then
  echo "::error::supabase.from('magazine_items') novos ($AFTER_ITEMS) < untypedFrom<MagazineItemRow> originais ($BEFORE_ITEMS)"
  exit 5
fi

# Type aliases presentes
grep -q "^type MagazineRow = Database\['public'\]\['Tables'\]\['magazines'\]\['Row'\];$" "$FILE" \
  || { echo "::error::type alias MagazineRow ausente"; exit 6; }
grep -q "^type MagazineItemRow = Database\['public'\]\['Tables'\]\['magazine_items'\]\['Row'\];$" "$FILE" \
  || { echo "::error::type alias MagazineItemRow ausente"; exit 6; }

# Import Database presente
grep -q "^import type { Database } from '@/integrations/supabase/types';$" "$FILE" \
  || { echo "::error::import Database ausente"; exit 7; }

# Nenhuma interface órfã
if grep -qE "^interface MagazineRow \{|^interface MagazineItemRow \{" "$FILE"; then
  echo "::error::interface antiga ainda presente"
  grep -nE "^interface Magazine(Row|ItemRow) \{" "$FILE"
  exit 8
fi

# void supabase; sumiu
if grep -q "^void supabase;$" "$FILE"; then
  echo "::error::'void supabase;' ainda presente"
  exit 9
fi

echo "::notice::migração aplicada · magazines=$AFTER_MAG · magazine_items=$AFTER_ITEMS"
echo "::notice::backup em $FILE.premigration.bak (remover após validar)"
echo "::notice::validar em seguida:"
echo "  npx tsgo --noEmit"
echo "  npx vitest run src/services/__tests__/ src/pages/magazine/__tests__/"
echo "  bash scripts/lint-untyped-from.sh"
