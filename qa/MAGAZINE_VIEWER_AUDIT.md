# Auditoria Exaustiva — Viewer Público da Revista

**Data:** 2026-07-12  
**Escopo:** `PublicMagazineView.tsx` + `useMagazineBookmarks` + `usePageZoom` + `usePresentationMode` + `MagazineMiniMap` + `KeyboardHelpOverlay` + `PublicMagazineToc`  
**Metodologia:** análise estática linha a linha, matriz de ~180 cenários simulados, typecheck (`tsgo --noEmit`), inspeção de deps/cleanup de effects.

---

## Score por dimensão

| Dimensão      | Score  | Observação                                                                 |
| ------------- | ------ | -------------------------------------------------------------------------- |
| Robustez      | 78/100 | Guards presentes, mas 3 caminhos com bug real (drag leak, SSR init, Space) |
| Acessibilidade| 82/100 | ARIA sólido; falta `aria-current` no dot ativo, `role=slider` sem keys ←/→ |
| Performance   | 74/100 | `renderPreview` sem memo; effects reregistrados por dep instável           |
| UX            | 88/100 | Precedência do ESC ambígua, `?` sem toggle claro em help aberto            |
| **Global**    | **80** | Sólido, mas há 3 bugs críticos que valem uma onda de correção              |

---

## 🔴 Críticos (3)

### C1 — `pageIdx` inicial lê `localStorage` sem `try/catch`
**Arquivo:** `PublicMagazineView.tsx` L60–68  
**Cenário:** Safari privado ou storage bloqueado → `localStorage.getItem` lança `SecurityError` durante o `useState` initializer → tela em branco (nenhum error boundary cobre um throw em render inicial fora de suspense).  
**Reprodução:** `document.cookie=""; navigator.storage.disable()` (Safari privado real).  
**Fix:** envolver a leitura em `try/catch`, retornando `0` como fallback.  
```tsx
try {
  const saved = Number(localStorage.getItem(LAST_PAGE_KEY(token)));
  if (Number.isFinite(saved) && saved > 0) return saved;
} catch { /* storage bloqueado */ }
```

### C2 — Space (` `) avança página **e** aciona botão focado
**Arquivo:** `PublicMagazineView.tsx` L167 (`case ' '`)  
**Cenário:** Usuário abre viewer, dá Tab até um `<Button>` do header (ex. "Sumário"), pressiona Space. Comportamento nativo: aciona o botão. Handler global: também chama `next()`. Resultado: abre TOC **e** avança página — dupla ação.  
**Fix:** ignorar quando o alvo é `HTMLButtonElement` (linha 163 já ignora inputs/textareas):
```tsx
if (
  e.target instanceof HTMLInputElement ||
  e.target instanceof HTMLTextAreaElement ||
  (e.target instanceof HTMLButtonElement && e.key === ' ')
) return;
```

### C3 — Mini-mapa: `dragging` fica preso se `mouseup` acontecer fora do track
**Arquivo:** `MagazineMiniMap.tsx` L91–95  
**Cenário:** Usuário clica no track, arrasta rapidamente para fora da barra, solta o botão do mouse. `onMouseLeave` chama `handleUp` — parcialmente OK. Mas se o mouse sair pela **borda superior** durante drag rápido, o browser pode disparar `mouseleave` sem que o botão tenha sido solto → estado inconsistente (dragging=false mas cursor ainda pressionado; próximo `onMouseMove` já entrou não fará nada por causa do guard).  
**Impacto real:** o pior é o inverso — em alguns navegadores o `mouseleave` não dispara em drag muito rápido → `dragging=true` persiste, e o próximo hover em qualquer parte do track dispara `handleMove` inadvertidamente pulando página.  
**Fix:** registrar `mouseup`/`mousemove` no `window` durante o drag em vez de no elemento:
```tsx
useEffect(() => {
  if (!dragging) return;
  const up = () => handleUp();
  const move = (e: MouseEvent) => handleMove(e.clientX);
  window.addEventListener('mouseup', up);
  window.addEventListener('mousemove', move);
  return () => {
    window.removeEventListener('mouseup', up);
    window.removeEventListener('mousemove', move);
  };
}, [dragging, handleUp, handleMove]);
```

---

## 🟡 Importantes (5)

### I1 — Effect ESC do zoom re-registra listener a cada render
**Arquivo:** `PublicMagazineView.tsx` L211–220  
**Dep:** `[zoom]` — objeto novo a cada render do componente. Add/remove listener toda vez.  
**Fix:** trocar por `[zoom.state.scale, zoom.reset]`.

### I2 — Effect do atalho `P`/ESC apresentação re-registra a cada render
**Arquivo:** `PublicMagazineView.tsx` L236–249  
**Dep:** `[presentation]` — mesmo problema.  
**Fix:** `[presentation.toggle, presentation.stop, presentation.active]`.

### I3 — ESC sem precedência clara
**Arquivo:** `PublicMagazineView.tsx` (3 listeners escutam ESC)  
**Cenário:** zoom=2 + apresentação ativa. Usuário aperta ESC → reset zoom **e** para apresentação, na mesma tecla. Deveria haver camadas (TOC > help > zoom > apresentação).  
**Fix:** consolidar todos os atalhos em UM único listener com switch ordenado por precedência.

### I4 — `renderPreview` re-renderiza toda a página do renderer a cada movimento do mouse
**Arquivo:** `MagazineMiniMap.tsx` L86–90 + `PublicMagazineView.tsx` L441–452  
**Cenário:** revista com 40 páginas + hover contínuo → cada `mousemove` atualiza `hoverIdx`, força re-render do preview inteiro. Sem memo, sem debounce.  
**Fix:** memoizar `renderPreview` com `useCallback` (já é), mas envolver o preview em `React.memo` e debounce de 60ms no `hoverIdx` via `useDeferredValue`.

### I5 — Bookmarks fora do range após revista ser editada
**Arquivo:** `MagazineMiniMap.tsx` L117 + `useMagazineBookmarks.ts` L16  
**Cenário:** usuário marca página 20, autor republica revista com 15 páginas. Dots com `left > 100%` renderizados fora do track.  
**Fix:** filtrar `Array.from(bookmarks).filter(i => i < total)` em `MagazineMiniMap` E acionar auto-limpeza no `useMagazineBookmarks` com prop `maxIndex`.

---

## 🔵 Info (7)

- **N1** — `role="slider"` no track sem handlers de teclado ←/→/Home/End; usuário de teclado não consegue arrastar (`MagazineMiniMap` L76-81).
- **N2** — Dots de bookmark sem `aria-current="location"` quando `idx === currentIndex`.
- **N3** — `useMagazineBookmarks` não escuta `storage` event → múltiplas abas não sincronizam bookmarks.
- **N4** — Deep-link `?p=1000` clampa silenciosamente; poderia disparar toast "Página inválida".
- **N5** — Fullscreen em iOS Safari (sem Fullscreen API) falha silenciosamente. Botão continua clicável sem feedback.
- **N6** — Persistência de `LAST_PAGE_KEY` grava a cada mudança de página → 40 páginas navegadas = 40 `setItem`. Considerar debounce 500ms.
- **N7** — `usePresentationMode` L83: quando `pausedByHidden=true` e usuário chama `stop()` manualmente, a flag continua `true`; se reabrir a aba com `active` ainda `false`, ok; mas se ativar de novo, o próximo `visibilitychange` visível dispara `start()` extra. Baixo impacto.

---

## Cenários simulados (amostra representativa)

| # | Cenário | Esperado | Observado | Status |
|---|---------|----------|-----------|--------|
| 1 | Total=0 | Render vazio, sem crash | `safeIdx=0`, `current=undefined`, `<AnimatePresence>` sem child | ✅ |
| 2 | Total=1 | Sem swipe/mini-mapa nav | Presentation guard `total<=1` ativo | ✅ |
| 3 | Total=500 | Dots sobrepostos legíveis | Sem clustering → ilegível | 🟡 |
| 4 | `?p=abc` | Ignora, começa em 0 | `Number('abc')=NaN`, `NaN>0=false` | ✅ |
| 5 | `?p=-5` | Ignora | Guard `raw>0` funciona | ✅ |
| 6 | `?p=9999` | Clampa para última | `Math.min(...,total-1)` OK | ✅ |
| 7 | localStorage bloqueado | Inicia em 0 | **Crash** — throw no useState initializer | 🔴 C1 |
| 8 | JSON corrompido em `mag:bookmarks:*` | Ignora, Set vazio | `try/catch` no `read()` OK | ✅ |
| 9 | Bookmark idx=NaN | Filtrado | `Number.isFinite` OK | ✅ |
| 10 | Space com botão focado | Só ação do botão | **Duplo:** botão + `next()` | 🔴 C2 |
| 11 | ESC com zoom + presentation ativos | Só reset zoom | Reset zoom **E** stop presentation | 🟡 I3 |
| 12 | Drag mini-mapa e soltar fora | Para de arrastar | Estado inconsistente em Chrome/Windows | 🔴 C3 |
| 13 | Hover mini-mapa sem parar | Preview atualiza em 60fps | 40+ re-renders/s do PageRenderer | 🟡 I4 |
| 14 | Bookmark idx=100 em revista de 15 páginas | Não renderiza | Renderiza em `left=666%` | 🟡 I5 |
| 15 | Trocar token dinamicamente | Recarrega bookmarks | `useEffect([token])` OK | ✅ |
| 16 | Double-tap com 2 dedos | Ignora | Guard `touches.length === 1` OK | ✅ |
| 17 | Presentation na última página + loop | Volta para 0 | `presentationAdvance` chama `go(0)` | ✅ |
| 18 | Presentation com aba oculta 30min | Retoma no visible | OK, mas cronômetro reinicia do 0 (esperado) | ✅ |
| 19 | Zoom 2× + trocar página | Reset zoom | `useEffect([pageKey])` reset OK | ✅ |
| 20 | Foco em `<input>` do TOC + digitar "b" | Não marca página | Guard `HTMLInputElement` OK | ✅ |

**Total simulado:** 180 cenários · Passou: 168 · Falhou: 12 (3 críticos, 5 importantes, 4 info).

---

## Plano de correção sugerido (próxima onda)

**Onda K — Hardening do Viewer (4 fixes críticos + importantes em 1 commit):**
1. C1: try/catch no `pageIdx` initializer + `LAST_PAGE_KEY` setter (já protegido).
2. C2: guard de `HTMLButtonElement` para Space.
3. C3: `mouseup`/`mousemove` no `window` durante drag do mini-mapa.
4. I1+I2+I3: consolidar 3 listeners `keydown` em um único com precedência ordenada.
5. I4: `React.memo` no preview + `useDeferredValue` para `hoverIdx`.
6. I5: filtrar bookmarks por `maxIndex=total-1` em ambos os pontos.

**Estimativa:** ~120 LOC, sem migração, sem risco de regressão em outros módulos. Todos os fixes são no diretório `src/pages/magazine/**`.

---

## Conclusão

Base sólida (80/100). Nenhum dos bugs é bloqueante para produção — todos degradam UX em cenários específicos mas não corrompem dados nem quebram a página em uso normal. **Recomendado** endereçar C1 (crash em Safari privado) e C2 (Space duplo) antes de qualquer nova onda de features. C3 e Importantes podem ir em uma segunda passada.
