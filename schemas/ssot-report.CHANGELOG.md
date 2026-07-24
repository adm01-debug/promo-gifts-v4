# SSOT Report — Changelog de contrato

Formato SemVer (`MAJOR.MINOR.PATCH`). Cada bump é aplicado por
`scripts/ssot-report-bump.mjs` (nunca editar à mão) e registrado aqui.

Regras de bump:

- **MAJOR** — remoção de campo, mudança de tipo, `const` alterado, novo `required`,
  restrição de `enum`. Consumidores precisam ser atualizados.
- **MINOR** — adição de campo opcional, extensão de `enum`, novo gate. Consumidores
  antigos seguem lendo com sucesso.
- **PATCH** — ajuste de descrição, `pattern` mais permissivo, correção de metadata
  sem impacto observável.

## 2.0.0 — 2026-07-15

Introdução do campo `schemaVersion` (obrigatório, `const` = versão atual).
Consumidores DEVEM ler `schemaVersion` antes de qualquer outro campo e falhar
com mensagem clara em caso de mismatch. Artefatos gerados antes desta versão
não possuem o campo e são rejeitados pelo validator.

## 1.0.0 — 2026-07-14

Contrato inicial (implícito, sem `schemaVersion`). Campos: `timestamp`,
`canonical`, `forbidden`, `overallOk`, `gates`, `details`.
