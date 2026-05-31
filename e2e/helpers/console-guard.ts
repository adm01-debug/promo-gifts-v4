import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Captura erros e avisos do console
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Ignora erros conhecidos de bibliotecas externas se necessário
        if (!msg.text().includes('chrome-extension')) {
          errors.push(msg.text());
        }
      } else if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    // Captura erros não tratados (uncaught exceptions)
    page.on('pageerror', (exception) => {
      errors.push(`Uncaught exception: ${exception.message}`);
    });

    await use(page);

    // Falha o teste se houver erros ou avisos capturados durante o fluxo
    if (errors.length > 0) {
      throw new Error(`Test failed due to console errors:\n${errors.join('\n')}`);
    }
    
    // Opcional: falhar em warnings também, conforme solicitado
    if (warnings.length > 0) {
      // Podemos ser seletivos com warnings para evitar falsos positivos de libs
      const criticalWarnings = warnings.filter(w => 
        w.includes('React') || 
        w.includes('Supabase') || 
        w.includes('Invalid') ||
        w.includes('Failed')
      );
      
      if (criticalWarnings.length > 0) {
        throw new Error(`Test failed due to critical console warnings:\n${criticalWarnings.join('\n')}`);
      }
    }
  },
});

export { expect };
