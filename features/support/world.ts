import { Before, setDefaultTimeout } from '@cucumber/cucumber';
import '@letsrunit/cucumber';

setDefaultTimeout(30_000);

let verifiedE2E = false;

Before({ name: 'Verify E2E mode' }, async function () {
  await this.page.goto('/');

  if (!verifiedE2E) {
    const isE2E = await this.page.evaluate(() => {
      return document.documentElement.getAttribute('data-e2e') === '1';
    });

    if (!isE2E) {
      throw new Error(
        'E2E aborted: target app is not running with VITE_E2E set. Start app with VITE_E2E=1.'
      );
    }

    verifiedE2E = true;
  }
});

Before({ name: 'Reset browser state' }, async function () {
  await this.page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();

    const dbs = await indexedDB.databases();
    const names = dbs
      .map((db) => db?.name)
      .filter((name) => !!name && (name === 'ownables' || name.startsWith('ownables:')));

    await Promise.all(names.map((name) =>
      new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      })
    ));
  });
});
