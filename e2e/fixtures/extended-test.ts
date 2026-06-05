import { test as base } from '@playwright/test';

/**
 * Fixture estendida para capturar logs de rede detalhados em caso de falha.
 * O Playwright Trace já captura HAR e logs, mas aqui adicionamos um listener 
 * explícito para o console do Playwright e eventos de rede para facilitar o debug imediato nos logs do CI.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const networkLogs: any[] = [];

    // Listener para erros de console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        networkLogs.push(`[CONSOLE ERROR] ${msg.text()}`);
      }
    });

    // Listener para falhas de rede
    page.on('requestfailed', request => {
      networkLogs.push(`[REQUEST FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        networkLogs.push(`[HTTP ERROR] ${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    await use(page);

    // Se o teste falhar, anexamos os logs coletados
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('network-console-logs', {
        body: networkLogs.join('\n'),
        contentType: 'text/plain',
      });
      
      // Também logamos no stdout para aparecer direto no log do GitHub Actions
      console.log('--- NETWORK & CONSOLE LOGS FOR FAILED TEST ---');
      console.log(networkLogs.join('\n'));
      console.log('----------------------------------------------');
    }
  },
});

export { expect } from '@playwright/test';
