import { test, expect } from "./fixtures/test-base";

test.describe("Console Guard Validation", () => {
  test("should fail if console.error is called (negative test)", async ({ page }) => {
    // This test is intended to demonstrate that console errors are caught.
    // In a real CI, this would fail the build.
    await page.goto("about:blank");
    await page.evaluate(() => console.error("Intentional error for testing guard"));
  });

  test("should fail if a critical warning is called (negative test)", async ({ page }) => {
    await page.goto("about:blank");
    await page.evaluate(() => console.warn("React warning: something went wrong"));
  });

  test("should pass if no errors or critical warnings are called", async ({ page }) => {
    await page.goto("about:blank");
    await page.evaluate(() => console.log("Normal log"));
    await page.evaluate(() => console.warn("Non-critical warning from some lib"));
  });
});
