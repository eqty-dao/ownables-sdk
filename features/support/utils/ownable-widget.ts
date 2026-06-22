import { expect, type Page } from '@playwright/test';

const WIDGET_SELECTOR = 'main iframe[aria-label="Ownable widget"]';

export async function expectOwnableWidgetReady(page: Page) {
  const iframe = page.locator(WIDGET_SELECTOR).first();

  await expect(iframe).toBeVisible({ timeout: 10_000 });

  await page.waitForFunction(
    (selector) => {
      const frame = document.querySelector<HTMLIFrameElement>(selector);
      if (!frame) return false;
      return frame.srcdoc.length > 0;
    },
    WIDGET_SELECTOR,
    { timeout: 10_000 }
  );
}
