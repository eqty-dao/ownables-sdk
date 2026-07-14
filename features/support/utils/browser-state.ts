export async function clearBrowserWalletState(page: {
  goto: (url: string, options?: { waitUntil?: 'domcontentloaded' | 'networkidle' }) => Promise<unknown>;
  evaluate: <T>(fn: () => Promise<T> | T) => Promise<T>;
  reload: (options: { waitUntil: 'domcontentloaded' | 'networkidle' }) => Promise<unknown>;
}) {
  // Use a same-origin static document so the app does not open IndexedDB before
  // the test cleanup has a chance to delete it.
  await page.goto('/favicon.ico', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .map((db) => db?.name)
          .filter((name): name is string => Boolean(name))
          .map(
            (name) =>
              Promise.race([
                new Promise<void>((resolve) => {
                  const request = indexedDB.deleteDatabase(name);
                  request.onsuccess = () => resolve();
                  request.onerror = () => resolve();
                  request.onblocked = () => resolve();
                }),
                new Promise<void>((resolve) => {
                  setTimeout(resolve, 500);
                }),
              ])
          )
      );
    }
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
}
