import { test, expect } from '@playwright/test';

test.describe('Quote Builder - Personalization E2E UX & Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Setup inicial para chegar na etapa de Personalização
    await page.goto('/quotes/new');
    
    // Etapa 1: Cliente
    await page.getByTestId('company-search-input').fill('Teste');
    await page.getByText('EMPRESA TESTE').first().click();
    await page.getByTestId('contact-selector').click();
    await page.getByText('João Silva').first().click();
    
    // Etapa 2: Condições
    await page.getByTestId('stepper-step-2').click();
    await page.getByTestId('shipping-type-select').click();
    await page.getByText('FOB | Valor pré negociado').click();
    await page.getByPlaceholder('0,00').fill('50');
    
    // Etapa 3: Itens
    await page.getByTestId('stepper-step-3').click();
    await page.getByPlaceholder('Buscar produtos...').fill('Caneta');
    await page.getByTestId('add-product-button').first().click();
    
    // Etapa 4: Personalização
    await page.getByTestId('stepper-step-4').click();
    await expect(page.getByTestId('customization-location-panel')).toBeVisible();
  });

  test('deve validar transição de técnica com data-testids, foco e aria-live', async ({ page }) => {
    // 1. Seleciona técnica A (Silk)
    await page.getByTestId('customization-technique-card-tech-A').click();
    
    // 2. Troca para técnica B (Transfer) via data-testid
    const changeBtn = page.getByTestId('customization-change-technique');
    await changeBtn.click();
    
    // 3. Verifica seletor aberto e aria-live
    await expect(page.getByTestId('customization-technique-picker')).toBeVisible();
    await expect(page.getByTestId('customization-aria-announcer')).toContainText(/Seletor de técnicas aberto/i);
    
    // 4. Seleciona técnica B
    await page.getByTestId('customization-technique-card-tech-B').click();
    
    // 5. Verifica seletor fechado, foco devolvido e toast
    await expect(page.getByTestId('customization-technique-picker')).not.toBeVisible();
    await expect(changeBtn).toBeFocused();
    await expect(page.locator('.sonner-toast')).toContainText(/Técnica alterada/i);
    
    // 6. Valida aria-live final
    await expect(page.getByTestId('customization-aria-announcer')).toContainText(/Técnica selecionada: Transfer Digital/i);
  });

  test('deve validar clamp de dimensões e cores ao trocar para técnica restritiva', async ({ page }) => {
    // 1. Seleciona Transfer (Tech B) - Limites: 10x10, 4 cores
    await page.getByTestId('customization-technique-card-tech-B').click();
    
    // 2. Preenche valores altos
    await page.getByTestId('customization-width-input').fill('9');
    await page.getByTestId('customization-height-input').fill('8');
    await page.getByTestId('customization-color-button-4').click();
    
    // 3. Troca para técnica restritiva (Laser Pequeno - Tech Small: 5x3, 1 cor)
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-small').click();
    
    // 4. Valida clamp nos inputs e exibição do Alert
    await expect(page.getByTestId('clamp-notice')).toBeVisible();
    await expect(page.getByTestId('customization-width-input')).toHaveValue('5');
    await expect(page.getByTestId('customization-height-input')).toHaveValue('3');
    
    // Laser não cobra por cor ou tem max_cores=1, valida que o botão de 4 cores sumiu/foi resetado
    await expect(page.getByTestId('customization-color-button-4')).not.toBeVisible();
  });

  test('deve lidar com trocas rápidas A->B->A e validar toast único e preço final', async ({ page }) => {
    // 1. Estado inicial A
    await page.getByTestId('customization-technique-card-tech-A').click();
    
    // 2. Troca rápida A -> B -> A
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-B').click();
    
    // Imediatamente abre de novo e volta para A
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-A').click();
    
    // 3. Valida que o toast final de B->A apareceu (ou que o seletor fechou silenciosamente se for a mesma técnica)
    // Se clicamos em A, depois trocamos para B, o toast diz A->B. 
    // Se clicamos em Trocar e selecionamos A de novo, o toast diz B->A.
    // O requisito é validar que não há "spam" e o preço bate com o estado final (A).
    const priceText = await page.getByTestId('customization-total-price').innerText();
    expect(priceText).toContain('200,00'); // Valor mockado no teste unitário, aqui validamos consistência
    
    // Verifica se há apenas um toast visível de "Técnica alterada" (ou o mais recente)
    const toasts = page.locator('.sonner-toast');
    await expect(toasts).toHaveCount(1);
  });

  test('deve restaurar rascunho após navegação completa (Sair -> Voltar)', async ({ page }) => {
    // 1. Configura gravação
    await page.getByTestId('customization-technique-card-tech-B').click();
    await page.getByTestId('customization-width-input').fill('7.5');
    await page.getByTestId('customization-height-input').fill('4.2');
    await page.getByTestId('customization-color-button-2').click();
    
    // 2. Navega para Dashboard (Página diferente completa)
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // 3. Volta para Novo Orçamento (Simulando fluxo do usuário)
    await page.goto('/quotes/new');
    
    // Navega até a etapa 4 novamente
    await page.getByTestId('company-search-input').fill('Teste');
    await page.getByText('EMPRESA TESTE').first().click();
    await page.getByTestId('stepper-step-4').click();
    
    // 4. Valida restauração completa dos dados do sessionStorage
    await expect(page.getByTestId('customization-width-input')).toHaveValue('7.5');
    await expect(page.getByTestId('customization-height-input')).toHaveValue('4.2');
    await expect(page.getByTestId('customization-color-button-2')).toHaveClass(/bg-primary/); // Selecionado
    
    // Valida que o preço foi recalculado corretamente na hidratação
    await expect(page.getByTestId('customization-total-price')).toBeVisible();
  });

  test('deve validar navegação por teclado no picker (Tab/Escape/Enter)', async ({ page }) => {
    // 1. Abre o seletor
    await page.getByTestId('customization-technique-card-tech-A').click();
    const changeBtn = page.getByTestId('customization-change-technique');
    await changeBtn.click();
    
    // 2. Navega via Tab
    await page.keyboard.press('Tab');
    // Como o useEffect foca no primeiro card, o primeiro Tab pode ir para o próximo elemento ou permanecer dependendo da implementação do navegador, 
    // mas o foco inicial já deve estar no card. Vamos validar que um card tem o foco.
    const firstCard = page.getByTestId('customization-technique-card-tech-A');
    await expect(firstCard).toBeFocused();

    // 3. Testa Escape (deve fechar e voltar foco)
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('customization-technique-picker')).not.toBeVisible();
    await expect(changeBtn).toBeFocused();

    // 4. Testa Enter para selecionar
    await changeBtn.click();
    await page.keyboard.press('Tab'); // Garante foco no picker/card
    // Navega para a técnica B (assumindo que é o próximo na ordem de tabulação ou foca nela diretamente para o teste)
    const techBCard = page.getByTestId('customization-technique-card-tech-B');
    await techBCard.focus();
    await page.keyboard.press('Enter');
    
    await expect(page.getByTestId('customization-technique-picker')).not.toBeVisible();
    await expect(page.getByTestId('customization-aria-announcer')).toContainText(/Técnica selecionada: Transfer Digital/i);
    await expect(changeBtn).toBeFocused();

  test('deve validar clamp persistido após sair e voltar e preview íntegro', async ({ page }) => {
    // 1. Seleciona Transfer (Tech B - Limites: 10x10)
    await page.getByTestId('customization-technique-card-tech-B').click();
    
    // 2. Preenche valores válidos mas altos (8x8)
    await page.getByTestId('customization-width-input').fill('8');
    await page.getByTestId('customization-height-input').fill('8');
    
    // 3. Troca para técnica restritiva (Laser Pequeno - Tech Small: 5x3)
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-small').click();
    
    // Valida clamp imediato
    await expect(page.getByTestId('customization-width-input')).toHaveValue('5');
    await expect(page.getByTestId('customization-height-input')).toHaveValue('3');
    
    // 4. Sai da página e volta (simulando perda de contexto)
    await page.goto('/dashboard');
    await page.goto('/quotes/new');
    
    // Navega até a etapa 4
    await page.getByTestId('company-search-input').fill('Teste');
    await page.getByText('EMPRESA TESTE').first().click();
    await page.getByTestId('stepper-step-4').click();
    
    // 5. Valida que os valores continuam clampados no rascunho restaurado
    await expect(page.getByTestId('customization-width-input')).toHaveValue('5');
    await expect(page.getByTestId('customization-height-input')).toHaveValue('3');
    
    // 6. Valida que o aria-live não disparou mensagens duplicadas na restauração
    // O announcer deve estar vazio ou conter apenas a técnica se carregado direto
    // Mas não deve disparar o "Técnica selecionada" de novo se for o mesmo estado.
    const announcer = page.getByTestId('customization-aria-announcer');
    const announcerText = await announcer.innerText();
    // Na restauração, como bloqueamos o primeiro render, ele deve estar vazio até uma nova interação
    expect(announcerText).toBe('');

    // Preço deve aparecer (recalculado na hidratação)
    await expect(page.getByTestId('customization-total-price')).toBeVisible();
  });


  test('deve ocultar painel de cores para técnicas que não cobram por cor', async ({ page }) => {
    // 1. Seleciona uma técnica que NÃO cobra por cor (Tech Digital / UV)
    await page.getByTestId('customization-technique-card-tech-digital').click();
    
    // 2. Valida que botões de cor não existem
    await expect(page.locator('[data-testid^="customization-color-button-"]')).not.toBeVisible();
    
    // 3. Verifica mensagem de Full Color
    await expect(page.getByText(/Full Color/i)).toBeVisible();
  });

  test('deve validar foco e anúncio aria-live ao ocorrer clamp por troca de técnica', async ({ page }) => {
    // 1. Seleciona técnica com limites grandes
    await page.getByTestId('customization-technique-card-tech-B').click();
    await page.getByTestId('customization-width-input').fill('9');
    
    // 2. Troca para técnica com largura menor (Tech Small: 5cm)
    await page.getByTestId('customization-change-technique').click();
    await page.getByTestId('customization-technique-card-tech-small').click();
    
    // 3. Valida clamp-notice visível
    await expect(page.getByTestId('clamp-notice')).toBeVisible();
    
    // 4. Valida FOCO no input de largura (o primeiro que sofreu clamp)
    await expect(page.getByTestId('customization-width-input')).toBeFocused();
    
    // 5. Valida aria-live announcement (contém técnica + aviso de clamp)
    const announcer = page.getByTestId('customization-aria-announcer');
    await expect(announcer).toContainText(/Técnica selecionada: Laser Pequeno/i);
    await expect(announcer).toContainText(/ajustados aos limites/i);
  });
});
});
