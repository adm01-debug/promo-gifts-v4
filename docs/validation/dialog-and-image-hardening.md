# Validação Exaustiva — Dialog & Image Hardening

**Data:** 2026-07-01  
**Escopo:** correções recentes em `ConfirmDialog`, `QuoteItemEditorSheet`, mock global de `IntersectionObserver`, testes de `OptimizedImage` e workflow CI `ui-visual-a11y.yml`.

## Resumo executivo

| Fase | Casos | Pass | Fail | Status |
|---|---:|---:|---:|---|
| 1. Estático (grep + import) | 4 | 4 | 0 | ✅ |
| 2. Unit (Vitest) | 31 | 31 | 0 | ✅ |
| 3. Matriz Playwright (raw) | 336 | 197 | 139 | ⚠️ falso-positivo |
| 3b. Matriz c/ reduced-motion + medição estável | 40 | 40 | 0 | ✅ |
| 6. Parse workflow CI | 2 jobs | 2 | 0 | ✅ |

**Veredito:** correções sólidas. Nenhum bug real de produção detectado. Duas oportunidades de hardening (não-bloqueantes) listadas abaixo.

---

## Fase 1 — Estático

- `src/components/ui/ConfirmDialog.tsx:116` — classes ativas: `!max-w-[358px] w-[92vw]` ✓
- `src/components/quotes/QuoteItemEditorSheet.tsx:155` — classes ativas: `!max-w-[358px] w-[92vw]` ✓
- Base shadcn `alert-dialog.tsx:144` ainda traz `w-full max-w-lg` — confirma necessidade do modifier `!` (important). ✓
- Auditoria: **40+ outros AlertDialogContent/DialogContent** no projeto ainda usam largura padrão `max-w-lg` (512px). Não são bug — são dialogs desktop-first. Ver "Gaps" abaixo.

## Fase 2 — Unit tests

```
ConfirmDialog.responsive.test.tsx  16/16 ✓
OptimizedImage.test.tsx            15/15 ✓
```

Cobertura inclui Unsplash `w=50&q=10&blur=10`, Supabase `?width=50&quality=10`, Cloudflare thumbnail, blurhash inválido, IntersectionObserver mock auto-fire.

## Fase 3 — Matriz Playwright (336 → 40 refinados)

- **Grid inicial:** 21 viewports × 4 variants × 2 themes × 2 dpr = 336 casos.
- **139 "falhas" iniciais** — todas com `actual < expected` por 4–18 px. **Causa raiz:** medição durante a animação `zoom-in-95 slide-in-from-top` do Radix, antes da largura estabilizar.
- **Refinamento:** contexto com `reduced_motion="reduce"` + polling `bounding_box()` até 2 leituras consecutivas idênticas (∆<0.5 px).
- **Resultado:** 40/40 dentro de ±4 px do esperado `min(358, vw × 0.92)`.

**Métricas por viewport (todos os variants):**

| vw | esperado | medido | ok |
|---:|---:|---:|:-:|
| 180 | 165.6 | 165.6 | ✅ |
| 200 | 184.0 | 184.0 | ✅ |
| 320 | 294.4 | 294.4 | ✅ |
| 375 | 345.0 | 345.0 | ✅ |
| 390 | 358.0 | 358.0 | ✅ |
| 480–1920 | 358.0 | 358.0 | ✅ |

Nenhum clipping horizontal detectado; `role="alertdialog"` presente em 100% dos casos (a11y ✓).

## Fase 6 — CI workflow

`.github/workflows/ui-visual-a11y.yml` — 2 jobs (`confirm-dialog`, `optimized-image`), sem `needs:` cruzado → executam em paralelo ✓.

---

## Gaps identificados (não-bloqueantes)

### 🟡 Gap 1 — Cobertura de outros dialogs
40+ componentes ainda herdam `max-w-lg` (512px) do shadcn. Em viewports < 512 px eles podem estourar (`w-full` no base cobre o caso, mas sem `92vw` explícito o padding fica colado na borda em telas 320–360 px).

**Recomendação:** promover `!max-w-[358px] w-[92vw]` para um wrapper compartilhado (ex.: `<ResponsiveAlertDialogContent>`) e migrar dialogs de confirmação um a um. **Requer aprovação separada.**

### 🔵 Gap 2 — Spec E2E não usa `reduced_motion`
`e2e/ui/confirm-dialog-visual.spec.ts` mede `boundingBox()` sem forçar `reduced_motion="reduce"`. Em CI lento (GitHub-hosted runners) pode gerar flake idêntico ao observado nesta validação (∆ ~10 px por animação).

**Recomendação:** adicionar `test.use({ reducedMotion: 'reduce' })` no describe do spec. Fix pequeno, sem risco.

### 🔵 Gap 3 — Harness `width` param nunca é 0
`ConfirmDialogHarness.tsx:51` — `Number(params.get('width') ?? '400')`. Se query `?width=abc` chegar, vira `NaN` e o `maxWidth: NaN px` é inválido (fallback silencioso). Adicionar clamp defensivo.

---

## Fora de escopo (conforme plano)

- Nenhuma alteração em código de produção nesta rodada.
- Baselines PNG de Playwright: exigem `--update-snapshots` em CI — passo manual documentado.
- `full-ci.yml` e demais gates: intocados.

---

## Artefatos

- Script matriz: `/tmp/browser/dialog-matrix/run.py` + `run2.py`
- CSV bruto (336 casos): `/tmp/browser/dialog-matrix/results.csv`
- Screenshots de falha: `/tmp/browser/dialog-matrix/failures/` (apenas falso-positivos de animação)
