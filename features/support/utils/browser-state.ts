export async function clearBrowserWalletState(page: {
  goto: (url: string) => Promise<unknown>;
  evaluate: <T>(fn: () => Promise<T> | T) => Promise<T>;
  reload: (options: { waitUntil: 'networkidle' }) => Promise<unknown>;
}) {
  await page.goto('/');
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
              new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              })
          )
      );
    }
  });

  await page.reload({ waitUntil: 'networkidle' });
}
