import { test, expect } from "./fixtures/test-base";
import { gotoAndSettle } from "./helpers/nav";

test.describe("PromoFlix Player - Desktop & Mobile", () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to playground
    await gotoAndSettle(page, "/promoflix-playground");
    // Wait for player to be visible
    await expect(page.locator('video')).toBeVisible();
  });

  test("deve alternar play/pause", async ({ page }) => {
    const video = page.locator('video');
    const playBtn = page.getByLabel(/Reproduzir|Pausar/);

    // Initial state might be autoplay or paused based on browser
    const isPaused = await video.evaluate((v: HTMLVideoElement) => v.paused);
    
    await playBtn.click();
    
    if (isPaused) {
      await expect(video).toHaveJSProperty('paused', false);
    } else {
      await expect(video).toHaveJSProperty('paused', true);
    }
  });

  test("deve realizar seek (avançar/voltar)", async ({ page }) => {
    const video = page.locator('video');
    
    // Get initial time
    const initialTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    
    // Click forward 10s
    await page.getByLabel("Avançar 10 segundos").click();
    
    // Check if time increased (allow some delta for processing)
    const afterForward = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(afterForward).toBeGreaterThan(initialTime);

    // Click backward 10s
    await page.getByLabel("Voltar 10 segundos").click();
    const afterBackward = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(afterBackward).toBeLessThan(afterForward);
  });

  test("deve ajustar o volume e persistir", async ({ page }) => {
    const video = page.locator('video');
    
    // Hover over volume to show slider (on desktop)
    const volumeBtn = page.getByLabel(/Mutar|Ativar som/);
    await volumeBtn.hover();
    
    const volumeSlider = page.getByLabel("Volume");
    if (await volumeSlider.isVisible()) {
      await volumeSlider.fill("0.5");
      await expect(video).toHaveJSProperty('volume', 0.5);
      
      // Reload and check persistence
      await page.reload();
      await expect(video).toHaveJSProperty('volume', 0.5);
    }
  });

  test("deve exibir estados de carregamento e erro (Mock HLS)", async ({ page }) => {
    // Simulate HLS error by routing manifest to 404
    await page.route("**/*.m3u8", route => route.abort('failed'));
    
    await page.reload();
    
    // Should show error overlay
    await expect(page.locator("text=Ops! Algo deu errado")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Tentar Novamente")).toBeVisible();
  });

  test("@mobile deve ter controles acessíveis", async ({ page }) => {
    // This test will only run in mobile projects due to grep
    const seekSlider = page.getByLabel("Linha do tempo");
    await expect(seekSlider).toBeVisible();
    
    // Check if touch areas are large (heuristic: buttons height > 40px)
    const playBtn = page.getByLabel(/Reproduzir|Pausar/);
    const box = await playBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(40);
  });

  test("deve persistir estado de play/pause após recarregar", async ({ page }) => {
    const video = page.locator('video');
    
    // Ensure it's playing
    const playBtn = page.getByLabel("Reproduzir");
    if (await playBtn.isVisible()) {
      await playBtn.click();
    }
    await expect(video).toHaveJSProperty('paused', false);
    
    await page.reload();
    
    // Should attempt to resume (might be blocked by autoplay, but our state should try)
    // We check if it's NOT explicitly paused if our persistence logic worked
    // Note: browsers might still block the actual playback without interaction, 
    // but the state sync should have happened.
    const isPlaying = await page.evaluate(() => localStorage.getItem('promoflix_playing') === 'true');
    expect(isPlaying).toBe(true);
  });

  test("deve mostrar botão 'Carregar Manualmente' se o vídeo ficar travado", async ({ page }) => {
    // Delay manifest response significantly to trigger timeout
    await page.route("**/*.m3u8", async route => {
      await new Promise(resolve => setTimeout(resolve, 12000));
      return route.abort('failed');
    });

    await page.reload();
    
    // Expect the button to appear after our 10s logic
    const manualBtn = page.getByRole('button', { name: /Carregar Manualmente/i });
    await expect(manualBtn).toBeVisible({ timeout: 15000 });
    
    // Clicking it should trigger a reload of the source
    // We can verify this by checking if the overlay goes back to the initial loading state
    await manualBtn.click();
    await expect(page.locator("text=Carregando")).toBeVisible();
    await expect(manualBtn).not.toBeVisible();
  });
});
