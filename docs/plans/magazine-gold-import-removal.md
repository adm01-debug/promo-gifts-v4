# Plano — Desativação e Remoção de `useMagazineGoldImport`

**Owner:** @adm01-debug
**Status:** 🟡 Aguardando janela de telemetria (30 dias)
**Criado:** 2026-07-12

## Contexto

`src/pages/magazine/hooks/useMagazineGoldImport.ts` é uma ponte one-shot
que migra revistas do `localStorage` legado (`promobrind.magazines.v1`)
para o BD Gold via edge `magazine-import-local`. Após a migração completa
do `magazineService` para o BD (2026-07-12), o hook é vestigial —
ele só ainda serve leitores que:

1. Nunca abriram o app após 2026-07-12, **E**
2. Têm revistas salvas apenas em `localStorage`.

O hook é **inofensivo** enquanto existir (idempotente, silencioso, marca
flag no primeiro sucesso), então **não há urgência**. Mas é dívida técnica.

## Critério de remoção segura

Remover somente quando **todas** forem verdadeiras:

- [ ] **Telemetria confirma < 5 execuções/dia** por 7 dias consecutivos.
      Adicionar log estruturado no hook (ver §Telemetria).
- [ ] **30 dias corridos** desde a migração do `magazineService` (i.e., depois
      de **2026-08-11**).
- [ ] **Zero registros** na tabela `frontend_telemetry` com
      `event = 'magazine_import_local_success'` nos últimos 14 dias.
- [ ] Aviso em release notes ao menos 1 sprint antes.

## Telemetria (a adicionar ANTES da remoção)

Instrumentar `useMagazineGoldImport` para emitir eventos via
`createClientLogger('magazine.gold-import')`:

```ts
log.info('magazine_import_local_start', { count: localMagazines.length });
// ...
log.info('magazine_import_local_success', { okCount, totalCount: localMagazines.length });
// ou
log.warn('magazine_import_local_failed', { status: res.status });
```

Painel: `/admin/telemetria` → filtrar por `scope = 'magazine.gold-import'`.
Snapshot esperado após 30 dias: `magazine_import_local_success` deve
tender a **zero**.

## Passos do PR de remoção

1. **Verificação prévia** (script/consulta):
   ```sql
   -- No BD Gold
   SELECT date_trunc('day', occurred_at) as dia, count(*)
   FROM frontend_telemetry
   WHERE event LIKE 'magazine_import_local_%'
     AND occurred_at > now() - interval '14 days'
   GROUP BY 1 ORDER BY 1;
   ```
   Se houver > 0 sucessos nos últimos 14 dias, **abortar** e reagendar.

2. **Deletar arquivos**:
   - `src/pages/magazine/hooks/useMagazineGoldImport.ts`
   - `src/pages/magazine/hooks/__tests__/useMagazineGoldImport.test.ts` (se existir)

3. **Limpar callers**:
   - `src/pages/magazine/MagazineListPage.tsx` — remover import + chamada + qualquer badge de "migrando".

4. **Depreciar edge** `magazine-import-local` (mantém no repo por + 30 dias com
   header `Deprecation: version="v1"` e log `warn` a cada chamada; depois deleta).

5. **Migration opcional** limpando `localStorage` no boot:
   ```ts
   // src/main.tsx (uma única vez, com flag própria)
   try { localStorage.removeItem('promobrind.magazines.v1'); } catch {}
   ```

6. **Regenerar `types.ts`** se houver drift.

7. **Changelog**: "Removida ponte de migração localStorage→Gold (Magazine).
   Todas as revistas agora vivem exclusivamente no BD."

## Rollback

Reverter o PR. `magazine-import-local` continua idempotente pela chave
`(owner_id, legacy_local_id)`, então nenhuma revista é duplicada.

## Riscos

- **Baixo**: hook é opt-in silencioso. Remoção antes do tempo só significa
  perda de migração automática — o usuário pode recriar a revista.
- **Zero risco de corrupção**: nenhum dado do BD é tocado no delete do hook.
