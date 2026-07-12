# PR: refactor(magazine): migra magazineService para queries tipadas

**Base:** `main` · **Head:** `refactor/magazine-typed-queries` (a criar)
**Depende de:** PR `chore: regenerate supabase types` — merge obrigatório antes.
**Autor:** Claude Opus 4.8 (multi-agent) · **Data-alvo:** 2026-07-XX

---

## Resumo

Substitui em `src/services/magazineService.ts` todas as chamadas
`untypedFrom<X>('y')` por `supabase.from('y')` tipado, e as interfaces locais
`MagazineRow` / `MagazineItemRow` por aliases derivados do schema gerado
(`Database['public']['Tables']['magazines' | 'magazine_items']['Row']`).

Sem mudança de comportamento em runtime: mapping helpers, edge
`magazine-public-view`, tratamento de erros e retornos permanecem
byte-idênticos. É uma migração puramente de tipagem.

## Motivação

`untypedFrom` foi introduzido em 2026-05-24 como escape hatch enquanto o
`types.ts` estava desatualizado. Com a regeneração deste PR
(`chore: regenerate supabase types`), as tabelas `magazines` e
`magazine_items` passam a estar no schema gerado, tornando o cast permissivo
desnecessário.

Benefícios:
- Autocomplete e checagem de colunas em `.eq`, `.update`, `.insert`.
- Regressões de schema (coluna renomeada, tabela dropada) passam a quebrar
  o build imediatamente, em vez de virar `catch { return [] }` silencioso —
  exatamente o cenário que causou o colapso de 2026-05-24.
- Remove uma vitrine central do helper `untypedFrom`, reduzindo débito.

## Como aplicar

O patch é gerado por script idempotente:

```bash
bash docs/plans/apply-magazine-typed-queries.sh
```

Ele valida `types.ts`, aplica o `.patch` do bloco de tipos e executa as
substituições mecânicas via `sed`. Ver
`docs/plans/magazine-typed-queries-migration.md` para detalhes.

O workflow `.github/workflows/magazine-typed-queries.yml` já faz **dry-run
completo** deste patch a cada PR — abrir este PR já garante execução do
gate.

## Checklist de pré-condições (bloqueadoras)

- [ ] PR de regeneração do `types.ts` mergeado no `main`
- [ ] `grep -E "magazines: \{|magazine_items: \{" src/integrations/supabase/types.ts` retorna as duas tabelas
- [ ] `npx tsgo --noEmit` limpo no `main` atual
- [ ] `npm run lint:baseline` sem regressões novas
- [ ] Constraint UNIQUE `(magazine_id, product_id)` aplicada no BD Gold
      (`qa/migrations-draft/2026-07-12_magazine_items_unique_product.sql`)
      — não bloqueia mas evita ruído de teste

## Checklist deste PR

- [ ] Rodar `bash docs/plans/apply-magazine-typed-queries.sh` local
- [ ] `git diff` limitado a `src/services/magazineService.ts`
- [ ] Nenhum `untypedFrom` remanescente em `magazineService.ts`
      (`! grep -q untypedFrom src/services/magazineService.ts`)
- [ ] `npx tsgo --noEmit` verde
- [ ] `bash scripts/lint-untyped-from.sh` verde
- [ ] Vitest verde:
      `npx vitest run src/services/__tests__/magazineAddProductsUnique.test.ts src/services/__tests__/magazineEdgeContract.test.ts src/pages/magazine/__tests__/publishAwait.regression.test.ts tests/integration/magazine-service-fuzz.test.ts`
- [ ] Workflow `Magazine typed queries — dry-run` verde
- [ ] `npm run lint:baseline` sem regressão
- [ ] Sem alteração em `src/integrations/supabase/client.ts` (REGRA #1 SSOT)
- [ ] Campos críticos do tipo `Product` intactos (REGRA #2)

## Risco / Rollback

- **Risco:** baixo — apenas tipagem; runtime idêntico.
- **Rollback:** `git revert <sha>` — o helper `untypedFrom` continua no repo
  intacto e pode voltar sem side-effects.

## Arquivos alterados (esperado)

```
src/services/magazineService.ts   |  ~40 −  ~30 = ~10 linhas líquidas
```

Nenhum outro arquivo é tocado. Se o diff mostrar mais, algo deu errado — abortar e reinvestigar.

## Referências

- Plano: `docs/plans/magazine-typed-queries-migration.md`
- Script: `docs/plans/apply-magazine-typed-queries.sh`
- Patch (bloco de tipos): `docs/plans/magazine-typed-queries-migration.patch`
- Workflow dry-run: `.github/workflows/magazine-typed-queries.yml`
- Follow-up original: `qa/reports/magazine-followup-2026-07-12.md`
- Regras: `CLAUDE.md` (REGRA #1 SSOT, REGRA #2 Product fields, REGRA #4 types.ts)

---

## Como abrir o PR (após pré-condições verdes)

```bash
git switch -c refactor/magazine-typed-queries
bash docs/plans/apply-magazine-typed-queries.sh
git add src/services/magazineService.ts
git commit -m "refactor(magazine): migra magazineService para queries tipadas

Remove untypedFrom em favor de supabase.from() tipado após regeneração
do types.ts. Sem mudança de comportamento; benefícios em type-safety.

Ver: .github/pulls/refactor-magazine-typed-queries.md"
git push -u origin refactor/magazine-typed-queries
gh pr create \
  --base main \
  --head refactor/magazine-typed-queries \
  --title "refactor(magazine): migra magazineService para queries tipadas" \
  --body-file .github/pulls/refactor-magazine-typed-queries.md
```
