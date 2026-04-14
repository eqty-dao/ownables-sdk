type CleanupOptions = {
  navigateHome?: boolean;
  reload?: boolean;
};

export async function cleanWalletState(page: any, options: CleanupOptions = {}) {
  const { navigateHome = false, reload = false } = options;

  if (navigateHome) {
    await page.goto('/');
  }

  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    if (typeof indexedDB === 'undefined') return;

    const names: string[] = [];

    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db?.name) names.push(db.name);
      }
    } else {
      // Fallback to known app DB prefixes where enumeration isn't supported.
      names.push('ownables');
    }

    const uniqueNames = [...new Set(names)].filter(
      (name) => name === 'ownables' || name.startsWith('ownables:')
    );

    await Promise.all(
      uniqueNames.map(
        (name) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          })
      )
    );
  });

  if (reload) {
    await page.reload({ waitUntil: 'networkidle' });
  }
}
