# Reconciliação de Migrations

**Status:** DB == repo == 760 versões (23/mai/2026)

## Histórico da reconciliação
- 37 arquivos órfãos adicionados ao repo (versões aplicadas no DB sem arquivo)
- 1 duplicata de versão `20260515120000` removida
- 40 marker rows inseridos em `schema_migrations` para versões repo-only já aplicadas
- `20260522001000` (add_contract_version) aplicada via workflow

Ver commit `308b82e0` para detalhes.
