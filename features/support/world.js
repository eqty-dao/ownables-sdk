import { Before, setDefaultTimeout } from '@cucumber/cucumber';
import '@letsrunit/cucumber';

setDefaultTimeout(30_000);

Before(async function () {
  await this.page.goto('/');

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
