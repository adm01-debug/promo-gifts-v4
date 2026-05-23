# Migration Sync Log

## 2026-05-23 — Root cause confirmado e corrigido

### Bug: sort-order mismatch versao 20250103

Versao `20250103` (8 digitos) no DB ordena ANTES de `20250103010000`
por comparacao de strings. O arquivo `20250103_*.sql` na filesystem
ordena DEPOIS porque `_` (ASCII 95) > `0` (ASCII 48).
O CLI via como remote-only e disparava:
> Remote migration versions not found in local migrations directory

**Fix aplicado:** `supabase migration repair --status reverted 20250103`
Executado via Supabase CLI + PAT no VPS em 2026-05-23.
Remote-only count = 0 confirmado via `supabase migration list --linked`.

| Banco | Versoes | Repo | Orphans |
|---|---|---|---|
| `doufsxqlfjyuvxuezpln` | 774 | 775 | 0 |
| `pqp` | 775 | 775 | 0 |

### Fix duravel (Fase 3)
Trocar conexao Lovable de `pqp` para `doufsxqlfjyuvxuezpln` nos settings do Lovable.
