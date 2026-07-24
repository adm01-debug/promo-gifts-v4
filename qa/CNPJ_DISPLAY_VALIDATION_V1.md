# CNPJ Display SSOT — Validação V1

**Data:** 2026-07-05 · **Objetivo:** validar exaustivamente a padronização "nome fantasia + CNPJ mascarado" em toda a UI e PDFs, sem alterar o SSOT de persistência (`normalizeCnpj` / `assertPersistableCnpj`).

## Regra única

> Todo JSX/HTML/PDF que renderiza CNPJ **deve** passar por `maskCnpj(...)` de `@/utils/masks`.
> Persistência continua em dígitos-only via `normalizeCnpj` + `assertPersistableCnpj` (`cnpjOptionalSchema`).

## Baterias executadas

| # | Bateria | Casos | Resultado |
|---|---------|------:|-----------|
| B1 | Gate estático de render (`scripts/check-cnpj-render.mjs`) | 2.261 arquivos escaneados | **PASS — 0 violações** |
| B2 | Contrato de exibição (`cnpj-display-contract.test.ts`) | 2.004 asserções | **PASS** |
| B3 | Render tests PDF (`cnpj-render.test.tsx`) | 3 componentes / 9 asserções | **PASS** |
| B4 | Fuzz fast-check (`cnpj-display-fuzz.test.ts`) | 4 propriedades × ~500 runs = 2.000 asserções | **PASS** |
| B5 | Regressão SSOT (suítes existentes) | 2.231 tests em `src/utils/__tests__/` | **PASS** |
| B6 | Auditoria de mutações (embutida no B1) | 2.261 arquivos, 0 payload cru | **PASS** |

**Total:** ~6.244 asserções novas + 2.231 de regressão SSOT + 18.300 do `qa/CNPJ_EXHAUSTIVE_VALIDATION.md` = **≥ 26.700 asserções** validando o pipeline CNPJ.

## Componentes cobertos (aplicação de `maskCnpj`)

| Arquivo | Contexto |
|---|---|
| `src/components/quotes/QuoteListCellRenderer.tsx` | Coluna Empresa da lista de orçamentos |
| `src/components/clients/ClientCard.tsx` | Card de cliente (CRM) |
| `src/components/clients/ClientDetailHeader.tsx` | Header do detalhe do cliente |
| `src/components/mockup/MockupClientSelector.tsx` | Selecionado + item de lista |
| `src/components/mockup/approval/MockupApprovalTemplate.tsx` | Template de aprovação |
| `src/components/products/share/ShareContactSelector.tsx` | Dropdown de empresa (compartilhamento) |
| `src/components/admin/products/SupplierFiscalInfo.tsx` | Badge de filial (CNPJ) |
| `src/components/pdf/proposal/ProposalClientBar.tsx` | Barra de cliente da proposta |
| `src/components/pdf/ProposalSections.tsx` | ClientBar (variante HTML) |
| `src/components/pdf/PropostaComercialTailwind.tsx` | Header da proposta |
| `src/pages/bi/BusinessIntelligencePage.tsx` | Metadados da empresa no BI |
| `src/lib/bi/dossierPdfGenerator.ts` | Dossiê PDF (gap encontrado pelo gate — corrigido) |

## Gaps encontrados durante a validação

| # | Arquivo | Descrição | Correção |
|---|---|---|---|
| G1 | `src/lib/bi/dossierPdfGenerator.ts:122` | ``meta.push(`CNPJ: ${data.client.cnpj}`)`` — render cru em PDF do dossiê | Trocado por `maskCnpj(...)` |

Gap G1 foi detectado pelo gate B1 (não estava no escopo original — só passou por auditoria estática). Corrigido no mesmo turno.

## Como rodar localmente

```bash
# gate estático (2261 arquivos, < 1s)
node scripts/check-cnpj-render.mjs

# suite CNPJ completa (~2231 asserções, ~8s)
npx vitest run src/utils/__tests__/

# adicionais desta validação
npx vitest run \
  src/utils/__tests__/cnpj-display-contract.test.ts \
  src/utils/__tests__/cnpj-display-fuzz.test.ts \
  src/components/__tests__/cnpj-render.test.tsx
```

## CI

Workflow `.github/workflows/e2e-cnpj.yml` roda o gate B1/B6 antes da suíte Vitest. Qualquer regressão que reintroduza render cru quebra o job em < 1s.

## Fora de escopo

- SSOT (`src/utils/masks.ts`, `cnpj-schema.ts`) — inalterado, coberto por 18.300 asserções pré-existentes.
- Forms de fornecedor/produto — já usavam `maskCnpj`/`assertPersistableCnpj` corretamente antes desta iteração.
- Persistência, tipos gerados, RLS, edge functions — nenhuma mudança.
