import { expect, type Page } from '@playwright/test';

export async function expectWalletEmpty(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const databases = await indexedDB.databases();
          const ownableStores: string[] = [];

          for (const { name } of databases) {
            if (!name) continue;

            const database = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open(name);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });

            ownableStores.push(
              ...Array.from(database.objectStoreNames).filter((storeName) =>
                storeName.startsWith('ownable:')
              )
            );
            database.close();
          }

          return ownableStores;
        }),
      { timeout: 15_000 }
    )
    .toEqual([]);
}
