#!/usr/bin/env bash
# Aplica a migração `magazineService` → queries tipadas.
# Roda APÓS o types.ts regenerado ter sido mergeado.
#
# Uso:  bash docs/plans/apply-magazine-typed-queries.sh
#
# Idempotente: pode rodar múltiplas vezes; se já migrado, sai limpo.

set -euo pipefail

FILE="src/services/magazineService.ts"

if [[ ! -f "$FILE" ]]; then
  echo "::error::$FILE não encontrado (rode a partir da raiz do repo)"
  exit 1
fi

# 1) Pré-check: types.ts precisa ter as tabelas
if ! grep -qE "magazines: \{" src/integrations/supabase/types.ts; then
  echo "::error::src/integrations/supabase/types.ts não contém a tabela 'magazines'."
  echo "         Rode antes o workflow 'Regenerate Supabase Types' e mergeie o PR."
  exit 2
fi
if ! grep -qE "magazine_items: \{" src/integrations/supabase/types.ts; then
  echo "::error::src/integrations/supabase/types.ts não contém a tabela 'magazine_items'."
  exit 2
fi

# 2) Já migrado?
if ! grep -q "untypedFrom" "$FILE"; then
  echo "::notice::$FILE já não usa untypedFrom — nada a fazer."
  exit 0
fi

# 3) Aplica o header patch (bloco de tipos)
git apply docs/plans/magazine-typed-queries-migration.patch

# 4) Substitui chamadas mecânicas
#    untypedFrom<MagazineRow>('magazines')       → supabase.from('magazines')
#    untypedFrom<MagazineItemRow>('magazine_items') → supabase.from('magazine_items')
#    (BSD/GNU sed compatível)
sed -i.bak \
  -e "s/untypedFrom<MagazineRow>('magazines')/supabase.from('magazines')/g" \
  -e "s/untypedFrom<MagazineItemRow>('magazine_items')/supabase.from('magazine_items')/g" \
  "$FILE"
rm -f "$FILE.bak"

# 5) Remove `void supabase;` do final (não é mais necessário)
sed -i.bak '/^\/\/ Marca o supabase client como usado/,/^void supabase;$/d' "$FILE"
rm -f "$FILE.bak"

# 6) Verifica que não sobrou untypedFrom no arquivo
if grep -q "untypedFrom" "$FILE"; then
  echo "::error::sobrou 'untypedFrom' em $FILE após substituição — inspecionar manualmente"
  grep -n "untypedFrom" "$FILE"
  exit 3
fi

echo "::notice::Migração aplicada. Rodar em seguida:"
echo "  npx tsgo --noEmit"
echo "  npx vitest run src/services/__tests__/ src/pages/magazine/__tests__/"
echo "  bash scripts/lint-untyped-from.sh"
