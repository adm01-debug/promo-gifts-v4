# Colapso do LocationPanel — máscara & limiar de pixel diff

Guia único para operar o E2E visual em `e2e/customization/collapse-reflow.spec.ts`.

## 1. Como funciona o diff

Cada teste roda em 3 viewports (`mobile 390×844`, `tablet 768×1024`, `desktop 1440×900`) e
captura 2 screenshots por viewport (expandido / colapsado). O Playwright compara pixel
a pixel contra a baseline armazenada em `e2e/customization/collapse-reflow.spec.ts-snapshots/`.

Antes de cada screenshot, `waitForStableHeight()` aguarda 2× `requestAnimationFrame` +
estabilidade de altura entre 2 rAFs consecutivos (delta < 0.5px). Isso garante que a
transição de 300ms terminou.

## 2. Onde ajustar `threshold` e `maxDiffPixelRatio`

Em `e2e/customization/collapse-reflow.spec.ts`, dentro do objeto `SCREENSHOT_OPTS`:

```ts
const SCREENSHOT_OPTS = {
  maxDiffPixelRatio: 0.015,   // até 1.5% de pixels podem diferir
  threshold: 0.25,            // sensibilidade de antialiasing (0=estrito, 1=frouxo)
  animations: "disabled",
  mask: masks,
  maskColor: "#FF00FF",
};
```

**Regra de bolso:**
- `threshold` afeta **cada pixel** (aceita variações sutis de cor/antialiasing).
- `maxDiffPixelRatio` afeta o **agregado** (quantos pixels no total podem diferir).
- Diminua se estiver deixando passar regressões; aumente se runners estiverem
  produzindo falsos positivos consistentes.

Use `npm run e2e:collapse:calibrate` (§4) para escolher valores empiricamente.

## 3. Como adicionar novas regiões dinâmicas à máscara

Edite `DYNAMIC_MASK_SELECTORS` no mesmo spec:

```ts
const DYNAMIC_MASK_SELECTORS = [
  '[data-testid*="timer"]',
  '[data-testid*="countdown"]',
  // …adicione seu selector aqui, ex.:
  '[data-testid="meu-novo-badge-dinamico"]',
];
```

Boas práticas:
- Prefira `data-testid` ou `data-dynamic="true"` no componente (estável e explícito).
- Áreas mascaradas são pintadas em `#FF00FF` — inspecione o `-actual.png` para
  confirmar que apenas a região volátil ficou magenta.
- Toasts e `aria-live` já estão cobertos globalmente.

## 4. Modo de calibragem

`scripts/qa/calibrate-collapse-thresholds.mjs` re-roda o diff com várias combinações
de `threshold` × `maxDiffPixelRatio` e imprime um relatório por viewport:

```bash
npm run e2e:collapse:calibrate
# ou com valores customizados:
node scripts/qa/calibrate-collapse-thresholds.mjs \
  --thresholds 0.1,0.2,0.3 \
  --ratios 0.005,0.01,0.02
```

O relatório final vai para `visual-diff-report/calibration.md` com uma tabela
"quantos casos falhariam" por combinação — escolha o menor par que zere as falhas
esperadas sem esconder regressões conhecidas.

## 5. Comandos úteis

| Comando | Uso |
| --- | --- |
| `npm run e2e:collapse` | Roda os testes (mobile + tablet + desktop) |
| `npm run e2e:collapse:update` | Atualiza TODAS as baselines |
| `npm run e2e:collapse:update:mobile` | Atualiza só mobile |
| `npm run e2e:collapse:update:tablet` | Atualiza só tablet |
| `npm run e2e:collapse:update:desktop` | Atualiza só desktop |
| `npm run e2e:collapse:seed` | Setup de auth + geração inicial das baselines |
| `npm run e2e:collapse:calibrate` | Modo calibragem (§4) |

## 6. Baseline ausente?

O spec detecta baselines faltando e falha com mensagem clara indicando o comando
`npm run e2e:collapse:update:<viewport>` correspondente. Veja `PRE-CHECK` no spec.
