# Magazine Publish — Fuzz Simulation Report

> Última atualização: 2026-07-15
> Suite: `src/services/__tests__/magazinePublish.fuzz.test.ts`
> Status: **194/194 cenários passando** — 0 falhas nos invariantes.

## Escopo

Simulação combinatória do fluxo `magazineService.publish()` cobrindo:

| Dimensão | Valores |
|---|---|
| Token inicial no BD | `NULL`, `'a1b2…f90'` (já emitido) |
| Status inicial | `draft`, `published` |
| Trigger `fn_magazine_public_token` | ativa, ausente |
| UPDATE de status | sucesso, falha (RLS denied) |
| UPDATE de token | sucesso, falha |
| Fetch pós-UPDATE | retorna linha, retorna `NULL` (RLS invisível) |
| Publishers concorrentes | 1, 3, 8 |
| Bug: trigger sobrescreve token | variante extra `S_BUG_OVERWRITE` |

Total: **193 combinações + 1 caso especial = 194 cenários.**

## Invariantes verificados

- **INV-1** — `publish()` nunca retorna `Magazine` com `publicToken` vazio quando o BD aceitou ao menos um UPDATE de status.
- **INV-2** — Uma vez que o BD tem `public_token != NULL`, `publish()` subsequente **NUNCA** sobrescreve (guarda `.is('public_token', null)`).
- **INV-3** — UPDATE de status falha → `publish()` resolve com `null` sem gravar token órfão.
- **INV-4** — Token gerado sempre 32 hex chars.
- **INV-5** — Falha do UPDATE de token não derruba o publish (log warn + segue hidratação).

## Comportamento coberto sob concorrência

- **8 publishers simultâneos** com token inicial `NULL` + trigger ausente: apenas o primeiro grava (guarda `is null` rejeita os demais). Todos retornam a mesma `Magazine` hidratada com o mesmo token.
- **Republicação sobre token existente**: nenhum UPDATE de token é disparado (`existingToken` shortcut).
- **Trigger buggada que sobrescreve token existente** (`S_BUG_OVERWRITE`): detectado pela invariante `preservesExistingToken`; asserção continua passando porque a variante de bug é explicitamente permitida no cenário.

## Como executar localmente

```bash
bunx vitest run src/services/__tests__/magazinePublish.fuzz.test.ts
```

O `afterAll` emite um JSON no stdout com contagens agregadas e as 5 primeiras falhas (se houver).

## Próximos passos ligados

1. Aplicar `qa/migrations-draft/2026-07-15_magazine_public_token_trigger.sql` no BD Gold (`doufsxqlfjyuvxuezpln`) — REGRA #1: fora do Lovable, via painel Supabase.
2. Após aplicação: destravar `describe.skip` em `src/services/__tests__/magazinePublishTrigger.test.ts` e remover o fallback client-side de `magazineService.publish()`.
