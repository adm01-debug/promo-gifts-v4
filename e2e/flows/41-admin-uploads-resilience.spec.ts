import { test, expect } from '../fixtures/extended-test';
import { Sel } from '../fixtures/selectors';

test.describe('Admin Uploads & State Resilience', () => {
  test.use({ storageState: 'e2e/.auth/storageState.json' });

  test('should handle media uploads without duplicate requests and persist state', async ({ page }) => {
    await page.goto('/admin/produtos');
    
    // Monitorar requests para detectar duplicatas
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/storage/v1/object') && request.method() === 'POST') {
        requests.push(request.url());
      }
    });

    // 1. Abrir criação de produto
    await page.locator(Sel.admin.createBtn).click();
    
    // 2. Preencher dados básicos
    const uniqueName = `Teste Upload ${Date.now()}`;
    await page.locator(Sel.admin.nameInput).fill(uniqueName);
    await page.locator(Sel.admin.codeInput).fill(`UP-${Date.now()}`);

    // 3. Simular upload de arquivo
    // Assumindo que existe um input type="file" ou área de drop
    const fileChooserPromise = page.waitForEvent('filechooser');
    // Procure por um botão de upload ou o próprio input
    const uploadTrigger = page.locator('input[type="file"]').first();
    
    // Se o input for escondido, podemos precisar clicar em um label/botão
    if (!await uploadTrigger.isVisible()) {
      await page.locator('text=Upload').first().click();
    }
    
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-data'),
    });

    // Esperar o upload terminar (feedback de UI)
    await expect(page.locator('text=Upload concluído').or(page.locator('img[src*="supabase"]'))).toBeVisible({ timeout: 20000 });

    // Verificar se não houve requests duplicados de upload
    const duplicateUploads = requests.filter((item, index) => requests.indexOf(item) !== index);
    expect(duplicateUploads.length, 'Should not have duplicate upload requests').toBe(0);

    // 4. Salvar e verificar persistência após navegação
    await page.locator(Sel.admin.saveBtn).click();
    await expect(page.locator(Sel.app.toast)).toContainText('sucesso');

    // 5. Refresh e verificar se a mídia ainda é exibida na edição
    await page.locator(Sel.admin.searchInput).fill(uniqueName);
    await page.locator(`text=${uniqueName}`).click();
    
    await expect(page.locator('img[src*="supabase"]')).toBeVisible();

    // 6. Testar Back/Forward na edição
    await page.goBack();
    await page.goForward();
    await expect(page.locator('img[src*="supabase"]')).toBeVisible();
  });
});
