# CNPJ SSOT — Validação Exaustiva

**Data:** 2026-07-02 · **Seed base:** `0xC0FFEE` (`src/utils/__tests__/cnpj-exhaustive.test.ts`)

## Baterias

| # | Nome                          | Casos  | Foco                                                                 |
|---|-------------------------------|--------|----------------------------------------------------------------------|
| B1| Idempotência                  | 1.000  | `normalize(normalize(x)) === normalize(x)`                           |
| B2| Roundtrip                     | 1.000  | `normalize(mask(normalize(v))) === normalize(v)`                     |
| B3| Fuzz de mutações              | 2.000  | letras/DV/trunc/zero-width/NBSP/RTL/emoji/whitespace                 |
| B4| Unicode adversarial           |   500  | ZWJ/ZWSP/NBSP/RTL/emoji intercalados                                 |
| B5| Boundary de comprimento       |   500  | 0..30 dígitos aleatórios                                             |
| B6| Todos-iguais                  |    10  | `00…0` .. `99…9`                                                     |
| B7| DV cross-check                | 13.000 | 500 CNPJs × 26 vizinhos de 1 dígito                                  |
| B8| Schema × helper               |   200  | `cnpjOptionalSchema` == `assertPersistableCnpj`                      |
| B9| Payload contract              |   100  | payload sempre `null` ou `/^\d{14}$/`                                |
| Audit | Call-sites estáticos      |   —    | scan de `src/**` por `cnpj:` em insert/update/upsert sem SSOT        |
| E2E matrix | Harness × 13 inputs  |   13   | máscara/erro/payload + interceptação de rede (nenhum body mascarado) |

Total ≈ **18.300 asserções** em ~2s (unit) + suite E2E rodada no CI dedicado.

## Call-sites cobertos

- `src/components/admin/products/new-supplier/useNewSupplierForm.ts` ✅ usa `assertPersistableCnpj`
- `src/components/admin/products/new-supplier/tabs/BasicDataTab.tsx` ✅ usa `normalizeCnpj`/`maskCnpj`
- `src/components/admin/suppliers-manager/SupplierFormDialog.tsx` ✅ usa `assertPersistableCnpj` + erros inline
- `src/components/admin/suppliers-manager/useSuppliersManager.ts` ✅ normaliza preload
- `src/components/quotes/company-contact/CompanySearchDropdown.tsx` ✅ exibição via `maskCnpj`
- `src/pages/dev/CnpjFormHarness.tsx` ✅ (harness E2E)

## CI

Workflow dedicado `.github/workflows/e2e-cnpj.yml` roda nas mudanças em qualquer arquivo do SSOT ou specs `e2e/ui/cnpj-*.spec.ts`. Falha o build em regressão.

## Como reproduzir localmente

```bash
npx vitest run src/utils/masks.test.ts src/utils/cnpj-schema.test.ts "src/utils/__tests__/cnpj-*.test.ts"
npx playwright test e2e/ui/cnpj-*.spec.ts
```

## Gaps conhecidos / fora de escopo

- Validação server-side em Postgres: hoje o SSOT é client-side (Zod + helper). O banco aceita qualquer `text` no campo `cnpj`. Um `CHECK (cnpj ~ '^\d{14}$' OR cnpj IS NULL)` seria a próxima camada — depende de auditar valores legados antes de aplicar.
- Endpoints REST/edge não fazem re-validação; o gate hoje é o helper no client. Se surgir um edge que aceite CNPJ, deve importar `assertPersistableCnpj`.
