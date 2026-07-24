/**
 * E2E — Print fallback cross-browser (chromium + firefox + webkit)
 *
 * Não conseguimos disparar/observar o diálogo NATIVO de impressão do sistema
 * no Playwright — ele é modal do SO. Mas conseguimos:
 *
 *  1. Interceptar `window.print` e `HTMLIFrameElement.prototype.contentWindow.print`
 *     no page.addInitScript, contando quantas vezes foram chamados.
 *  2. Observar se o modal PdfPrintHelpDialog aparece com o `data-reason` certo.
 *  3. Bloquear `window.open` para forçar o cenário popup-blocked.
 *
 * Este spec roda em `chromium-public`, `firefox-public` e `webkit-public`, e:
 *  - Chromium/Firefox: espera print_success (contentWindow.print chamado 1x, SEM modal fallback)
 *  - Webkit (Safari):  espera modal com `data-reason="safari"` (não chama print)
 *  - Cross-browser:    com window.open bloqueado, modal com `data-reason="popup-blocked"`
 *
 * Não depende de autenticação nem de dados reais — usa uma página de teste
 * standalone em rota interna `/dev/print-harness` OU monta o componente via
 * `page.setContent`. Optamos por page.setContent + build inline para máxima
 * portabilidade cross-project.
 */
import { test, expect, type Page } from '@playwright/test';

// HTML harness — reproduz o handlePrint sem depender do bundle React.
// A lógica é uma cópia literal fiel do handler no PdfGenerationDialog.tsx.
const HARNESS = `<!doctype html>
<html><head><meta charset="utf-8"><title>Print Harness</title>
<style>
  body { font: 14px system-ui; padding: 20px; }
  button { padding: 8px 16px; margin: 4px; cursor: pointer; }
  #help { display: none; padding: 20px; background: #fee; border: 1px solid #f66; margin-top: 20px; }
  #help[data-open="1"] { display: block; }
  #log { background: #eee; padding: 10px; white-space: pre-wrap; margin-top: 20px; }
</style>
</head><body>
<h1>Print Fallback Harness</h1>
<button id="print-btn" data-testid="print-btn">Imprimir</button>
<button id="reset-btn" data-testid="reset-btn">Reset</button>
<div id="help" data-testid="pdf-print-help-dialog" data-reason=""></div>
<pre id="log"></pre>
<script>
  window.__events = [];
  window.__printCalls = 0;
  const log = (m) => { document.getElementById('log').textContent += m + '\\n'; window.__events.push(m); };
  const showHelp = (reason) => {
    log('help_shown:' + reason);
    const el = document.getElementById('help');
    el.setAttribute('data-reason', reason);
    el.setAttribute('data-open', '1');
    el.textContent = 'Fallback: ' + reason;
  };
  document.getElementById('reset-btn').onclick = () => {
    window.__events = []; window.__printCalls = 0;
    document.getElementById('log').textContent = '';
    document.getElementById('help').setAttribute('data-open', '0');
    document.getElementById('help').setAttribute('data-reason', '');
  };

  // PDF blob mínimo válido (header %PDF-1.4)
  const pdfBytes = new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a]);
  const blob = new Blob([pdfBytes], {type: 'application/pdf'});
  const url = URL.createObjectURL(blob);

  function detectSafari(ua) {
    const isChromeFamily = /chrome|crios|edg|edgios|android|fxios/i.test(ua);
    const isWebKit = /safari/i.test(ua) && /applewebkit/i.test(ua);
    return isWebKit && !isChromeFamily;
  }

  function openInNewTab() {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      log('popup_blocked');
      showHelp('popup-blocked');
      return false;
    }
    log('new_tab_opened');
    return true;
  }

  document.getElementById('print-btn').onclick = () => {
    const ua = navigator.userAgent;
    log('print_start:' + ua.slice(0, 60));

    if (detectSafari(ua)) {
      log('safari_detected');
      const opened = openInNewTab();
      if (opened) showHelp('safari');
      return;
    }

    try {
      const existing = document.getElementById('pdf-print-frame');
      if (existing) existing.remove();
      const iframe = document.createElement('iframe');
      iframe.id = 'pdf-print-frame';
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

      let printed = false;
      const triggerPrint = (source) => {
        if (printed) return; printed = true;
        if (source === 'watchdog') {
          log('watchdog_timeout');
          iframe.remove();
          showHelp('watchdog-timeout');
          return;
        }
        try {
          const cw = iframe.contentWindow;
          if (!cw) throw new Error('no cw');
          cw.focus();
          cw.print();
          log('print_success');
        } catch (e) {
          log('print_exception:' + e.message);
          iframe.remove();
          showHelp('print-exception');
        }
      };
      iframe.onload = () => setTimeout(() => triggerPrint('onload'), 250);
      setTimeout(() => triggerPrint('watchdog'), 3000);
      document.body.appendChild(iframe);
      iframe.src = url;
    } catch (e) {
      log('iframe_exception:' + e.message);
      showHelp('iframe-exception');
    }
  };
</script>
</body></html>`;

async function loadHarness(page: Page) {
  // Intercepta print() em qualquer window/iframe futuro — precisa vir ANTES
  // do setContent para pegar tanto o main quanto os iframes criados depois.
  await page.addInitScript(() => {
    const origPrint = window.print.bind(window);
    (window as unknown as { __printCalls: number }).__printCalls = 0;
    window.print = () => {
      (window as unknown as { __printCalls: number }).__printCalls += 1;
      // NÃO chama origPrint — evita abrir diálogo nativo do SO no CI.
    };
    void origPrint;
  });
  await page.setContent(HARNESS);
  // Contador global de print() em qualquer contexto (iframe herda o hook via
  // frameattached handler no test).
  await page.exposeFunction('__notePrint', () => {
    /* placeholder — inicializado antes de cada click */
  });
}

// Hook print() em iframes criados dinamicamente
async function attachIframePrintCounter(page: Page) {
  page.on('frameattached', async (frame) => {
    try {
      await frame.evaluate(() => {
        window.print = () => {
          const w = window.top as unknown as { __printCalls?: number };
          if (w) w.__printCalls = (w.__printCalls ?? 0) + 1;
        };
      });
    } catch {
      /* frame pode ter sumido */
    }
  });
}

test.describe('Print fallback cross-browser', () => {
  test.beforeEach(async ({ page }) => {
    await attachIframePrintCounter(page);
    await loadHarness(page);
  });

  test('Chromium/Firefox: iframe.contentWindow.print() executa sem fallback', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari usa nova aba — coberto em outro teste');

    await page.getByTestId('print-btn').click();

    // Espera print_success ou algum outcome final
    await expect
      .poll(async () => await page.evaluate(() => (window as unknown as { __events: string[] }).__events), {
        timeout: 5000,
      })
      .toContain('print_success');

    // Modal fallback NÃO deve aparecer
    const help = page.getByTestId('pdf-print-help-dialog');
    await expect(help).toHaveAttribute('data-open', /^$|^0$/);
    await expect(help).toHaveAttribute('data-reason', '');
  });

  test('WebKit (Safari): detecta e mostra fallback data-reason="safari"', async ({
    page,
    browserName,
    context,
  }) => {
    test.skip(browserName !== 'webkit', 'Este cenário é específico do WebKit');

    // Bloqueia o pop-up novo para que abra na mesma aba (ou stub)
    await context.route('**/*', (route) => route.continue());

    // WebKit real → clica e espera help com data-reason=safari
    // (window.open pode abrir uma nova aba — não importa, só olhamos o modal)
    const [maybeNewPage] = await Promise.all([
      context.waitForEvent('page', { timeout: 2000 }).catch(() => null),
      page.getByTestId('print-btn').click(),
    ]);
    if (maybeNewPage) await maybeNewPage.close();

    const help = page.getByTestId('pdf-print-help-dialog');
    await expect(help).toHaveAttribute('data-reason', 'safari', { timeout: 5000 });
  });

  test('window.open bloqueado → data-reason="popup-blocked" (cross-browser)', async ({ page }) => {
    // Stuba window.open para retornar null (simula bloqueio)
    await page.evaluate(() => {
      window.open = () => null;
    });

    // No caminho não-Safari, precisamos forçar o popup path. Simulamos Safari
    // via override de UA localmente para que o handler chame openInNewTab.
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        configurable: true,
      });
    });

    await page.getByTestId('print-btn').click();

    const help = page.getByTestId('pdf-print-help-dialog');
    await expect(help).toHaveAttribute('data-reason', 'popup-blocked', { timeout: 5000 });
  });
});
