# QA Test Matrix — promo-gifts-v4
> Generated: 2026-06-02

## Test Coverage by Module

| Area | Happy Path | Borda | Erro | Permissão | Mobile | Status |
|---|---|---|---|---|---|---|
| **Auth (Login/Logout)** | Login válido | Senha errada, email vazio | Token expirado | Roles distintas | Login mobile | Partial (E2E exists) |
| **Auth (RLS)** | Read own data | Read other org | Write other org | Admin vs Seller | - | Needs testing |
| **Catálogo (Listagem)** | Load products | Empty list, filters | API error | Seller scope | 360px grid | Partial (E2E exists) |
| **Catálogo (Detalhe)** | Product detail | Missing image, null fields | Invalid ID | - | Responsive | Partial |
| **Cotação (Criar)** | Add items, calc | Zero qty, discount >100% | Save error | Alçada | - | Partial |
| **Cotação (PDF)** | Generate PDF | Acentuação, undefined | Memory leak | - | - | Needs testing |
| **Cadastro (CRUD)** | Create/Edit | Duplicates, special chars | Validation | Multi-tenant | - | Needs testing |
| **NF/Bling** | Modal open | Textarea multiline | API timeout | - | - | Needs testing |
| **Logística/Frete** | Quote freight | No coverage city | API down | - | - | Needs testing |
| **Dashboard** | Load KPIs | Empty data | Query error | Admin vs Seller | - | Needs testing |
| **Navegação** | All routes render | Deep link, 404 | Back button | Auth vs Public | Responsive | Partial (E2E exists) |
| **A11y** | Focus visible | Keyboard nav | Screen reader | - | Touch targets | Needs testing |
| **Performance** | Bundle sizes | Large lists | N+1 queries | - | - | Needs testing |

## Existing Test Infrastructure
- **Vitest unit tests:** 100+ test files in `tests/` and `src/`
- **Playwright E2E:** 30+ specs in `e2e/`
- **Projects:** chromium-public, chromium-authed, routes-mobile
- **Auth setup:** storageState-based login
- **Evidence:** Screenshot/video on failure, HTML report

## Priority Test Gaps
1. RLS isolation (multi-tenant) — no automated test
2. PDF generation under React StrictMode
3. Quote calculation edge cases (discount >100%, negative qty)
4. Freight coverage validation before quoting
5. NF/Bling API error handling
6. Mobile responsiveness on key pages
