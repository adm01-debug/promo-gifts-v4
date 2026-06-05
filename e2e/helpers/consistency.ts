import { type Page, type Request } from "@playwright/test";

/**
 * Monitors network requests during an action and ensures no duplicate 
 * GET requests were fired for the same URL in a short window.
 */
export async function ensureNoDuplicateRequests(
  page: Page,
  action: () => Promise<void>,
  options: { 
    urlFilter?: string | RegExp;
    windowMs?: number;
  } = {}
) {
  const requests: Array<{ url: string; timestamp: number }> = [];
  const filter = options.urlFilter ?? /.*/;
  
  const handleRequest = (request: Request) => {
    if (request.method() === "GET" && filter.test(request.url())) {
      requests.push({ url: request.url(), timestamp: Date.now() });
    }
  };

  page.on("request", handleRequest);
  
  try {
    await action();
    // Wait a bit after action to catch late duplicates
    await page.waitForTimeout(500);
  } finally {
    page.off("request", handleRequest);
  }

  // Check for duplicates
  const urlMap = new Map<string, number[]>();
  for (const req of requests) {
    const times = urlMap.get(req.url) || [];
    times.push(req.timestamp);
    urlMap.set(req.url, times);
  }

  for (const [url, times] of urlMap.entries()) {
    if (times.length > 1) {
      // If requests happened within a tiny window (e.g. 100ms), it's likely a duplicate React render issue
      const window = options.windowMs ?? 200;
      for (let i = 0; i < times.length - 1; i++) {
        if (times[i + 1] - times[i] < window) {
          throw new Error(`Duplicate request detected for ${url} within ${window}ms`);
        }
      }
    }
  }
}

/**
 * Robust data cleanup helper. 
 * Navigates to a list, searches for an item, and deletes it if found.
 */
export async function cleanupCreatedData(
  page: Page,
  url: string,
  searchQuery: string,
  selectors: {
    searchInput: string;
    deleteBtn: string;
    confirmBtn: string;
  }
) {
  await page.goto(url);
  await page.fill(selectors.searchInput, searchQuery);
  await page.waitForTimeout(1000); // Wait for search debounce
  
  const rows = page.locator(selectors.deleteBtn);
  const count = await rows.count();
  
  for (let i = 0; i < count; i++) {
    await rows.first().click();
    await page.click(selectors.confirmBtn);
    await page.waitForTimeout(500);
  }
}
