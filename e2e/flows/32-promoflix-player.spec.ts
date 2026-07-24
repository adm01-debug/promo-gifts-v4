
import { test, expect } from '@playwright/test';

test.describe('PromoFlix Video Player', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test playground
    await page.goto('/promoflix-test');
    
    // Wait for the container to render
    await page.waitForSelector('.group.relative.w-full.overflow-hidden.bg-black');
  });

  test('should display brand and title', async ({ page }) => {
    const brand = page.locator('span:has-text("PromoFlix")');
    await expect(brand).toBeVisible();
    
    const title = page.locator('text=Sintel - Test HLS Stream');
    await expect(title).toBeVisible();
  });

  test('should toggle playback via UI and keyboard', async ({ page }) => {
    const video = page.locator('video');
    const playOverlay = page.locator('button[aria-label="Reproduzir"]');

    // Initially paused (autoPlay was false in playground)
    await expect(playOverlay).toBeVisible();

    // Click play
    await playOverlay.click();
    await expect(playOverlay).toBeHidden();

    // Wait a bit and check if playing (currentTime should increase)
    await page.waitForTimeout(1000);
    const timeAfterPlay = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(timeAfterPlay).toBeGreaterThan(0);

    // Toggle pause via Space key
    await page.keyboard.press(' ');
    await expect(playOverlay).toBeVisible();

    // Toggle play via 'k' key
    await page.keyboard.press('k');
    await expect(playOverlay).toBeHidden();
  });

  test('should seek using keyboard shortcuts', async ({ page }) => {
    const video = page.locator('video');
    
    // Start playback
    await page.keyboard.press(' ');
    await page.waitForTimeout(500);

    const initialTime = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    
    // Seek forward 10s (L)
    await page.keyboard.press('l');
    await page.waitForTimeout(200);
    const afterForward = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(afterForward).toBeGreaterThanOrEqual(initialTime + 9); // Allow small buffer diff

    // Seek backward 10s (J)
    await page.keyboard.press('j');
    await page.waitForTimeout(200);
    const afterBackward = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(afterBackward).toBeLessThanOrEqual(afterForward - 9);
  });

  test('should change playback rate', async ({ page }) => {
    const video = page.locator('video');
    
    // Default rate is 1
    let rate = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate).toBe(1);

    // Increase rate (>) - in most browsers it's Shift+.
    await page.keyboard.press('>');
    await page.waitForTimeout(200);
    rate = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate).toBeGreaterThan(1);

    // Decrease rate (<)
    await page.keyboard.press('<');
    await page.waitForTimeout(200);
    rate = await video.evaluate((v: HTMLVideoElement) => v.playbackRate);
    expect(rate).toBe(1);
  });

  test('should mute/unmute', async ({ page }) => {
    const video = page.locator('video');
    
    // Mute (M)
    await page.keyboard.press('m');
    let isMuted = await video.evaluate((v: HTMLVideoElement) => v.muted);
    expect(isMuted).toBeTruthy();

    // Unmute (M)
    await page.keyboard.press('m');
    isMuted = await video.evaluate((v: HTMLVideoElement) => v.muted);
    expect(isMuted).toBeFalsy();
  });

  test('should take a screenshot and show toast', async ({ page }) => {
    // We expect a toast notification after pressing 'S'
    // Note: The actual download depends on browser settings, but we check UI feedback
    await page.keyboard.press('s');
    
    // Check for "Foto" flash feedback in the center
    const flash = page.locator('.animate-fade-in:has-text("Foto")');
    await expect(flash).toBeVisible();
    
    // Check for success toast (if sonner is active)
    const toast = page.locator('text=Frame salvo em PNG');
    await expect(toast).toBeVisible();
  });
});
