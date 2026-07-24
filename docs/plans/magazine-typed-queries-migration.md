# PR armado — Migração `magazineService` para queries tipadas

**Status:** Aguardando merge do PR de regeneração do `types.ts` (workflow
`Regenerate Supabase Types` → deve incluir as tabelas `magazines` e
`magazine_items` no schema tipado).

**Autor:** Claude Opus 4.8 (multi-agent) · **Data:** 2026-07-12

---

## Pré-condições (checar antes de aplicar o patch)

Rodar na branch alvo, após pull do `types.ts` regenerado:

```bash
# 1) types.ts contém as tabelas
grep -E "magazines:|magazine_items:" src/integrations/supabase/types.ts
# Esperado: pelo menos duas ocorrências (Row/Insert/Update)

# 2) Sem regressão de baseline
npx tsgo --noEmit
npm run lint:baseline
```

Se qualquer um falhar, **não aplicar** — reabrir o PR de regeneração.

---

## Escopo da mudança

Arquivo único: `src/services/magazineService.ts`

- Remover `import { untypedFrom } from '@/lib/supabase-untyped'`.
- Substituir todas as chamadas `untypedFrom<MagazineRow>('magazines')`
  por `supabase.from('magazines')`.
- Substituir todas as chamadas `untypedFrom<MagazineItemRow>('magazine_items')`
  por `supabase.from('magazine_items')`.
- Substituir as interfaces locais `MagazineRow` / `MagazineItemRow` por aliases
  vindos do schema gerado:

  ```ts
  import type { Database } from '@/integrations/supabase/types';

  type MagazineRow = Database['public']['Tables']['magazines']['Row'];
  type MagazineItemRow = Database['public']['Tables']['magazine_items']['Row'];
  ```

- Remover o `void supabase;` do final do arquivo (deixa de ser necessário
  porque `supabase` volta a ser referenciado diretamente).

**Não alterar** nenhum outro comportamento: mapping helpers (`rowToItem`,
`rowToMagazine`, `productToSnapshot`, `publicPayloadToMagazine`), edge
`magazine-public-view`, tratamento de erros, ordem das operações e retornos.
Todo o resto do arquivo permanece byte-idêntico.

---

## Riscos previstos

| Risco | Mitigação |
|-------|-----------|
| Schema gerado usa `Json` (não `MagazineClientBranding`) para `branding` / `content_settings` | Manter os cast já usados no `rowToMagazine`: `...(row.branding ?? {})`. `Json` é compatível com `Partial<T>` via spread. |
| Campo `content_settings` renomeado no BD | Ainda é `content_settings` no snapshot do BD Gold — verificado em 2026-07-12. Se drift acontecer, o build quebra e o PR de regeneração precisa ser refeito. |
| `updated_at` não existir como coluna atualizável | Já é atualizado por trigger no BD; os `.update({ updated_at: ... })` são defensivos e continuam válidos. |
| `insertRow` sem `id` no `create()` | `id` tem `default gen_random_uuid()`; `.single()` retorna o registro completo. Sem mudança. |

---

## Validação pós-aplicação

```bash
# tipagem estrita
npx tsgo --noEmit src/services/magazineService.ts

# testes existentes (fuzz, dedup, edge contract, publish await)
npx vitest run src/services/__tests__/magazineAddProductsUnique.test.ts \
              src/pages/magazine/__tests__/publishAwait.regression.test.ts \
              src/services/__tests__/magazineEdgeContract.test.ts \
              tests/integration/magazine-service-fuzz.test.ts

# gate CI
bash scripts/lint-untyped-from.sh
# Esperado: 0 referências a magazine* em untypedFrom
```

Se todos passarem, abrir PR com título:

```
refactor(magazine): migra magazineService para queries tipadas
```

E corpo referenciando este doc + o PR de regeneração dos types.

---

## Patch pronto para aplicar

O arquivo `docs/plans/magazine-typed-queries-migration.patch` no mesmo
diretório contém o diff unificado. Aplicar com:

```bash
git apply docs/plans/magazine-typed-queries-migration.patch
```

Se falhar por drift (linhas deslocadas), regenerar o patch a partir do estado
atual do `magazineService.ts` seguindo a receita textual acima — todas as
substituições são mecânicas e livres de ambiguidade.

---

## Rollback

`git revert <sha>` — a mudança é puramente de tipagem; comportamento runtime
inalterado. O helper `untypedFrom` permanece no repo e pode ser reintroduzido
sem side-effects.
