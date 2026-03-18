import { Given } from '@letsrunit/bdd';
import { Then } from '@cucumber/cucumber';
import { EventChain } from 'eqty-core';

const E2E_ADDRESS = '0x0000000000000000000000000000000000000001';
const E2E_CHAIN_ID = 84532; // Base Sepolia
const IDB_NAME = `ownables:${E2E_CHAIN_ID}:${E2E_ADDRESS}`;

const PACKAGES = [
  {
    title: 'Antenna',
    name: 'ownable-antenna',
    description: 'Add-on for Robot',
    cid: 'bafybeig7pd32tqm564ksqsliicv7u3jru5i6kzq7ct6g6e3difyu3grk34',
    keywords: [],
    isNotLocal: false,
    isDynamic: true,
    hasMetadata: true,
    hasWidgetState: true,
    isConsumable: true,
    isConsumer: false,
    isTransferable: true,
    versions: [{ date: '2025-10-06T14:32:57.294Z', cid: 'bafybeig7pd32tqm564ksqsliicv7u3jru5i6kzq7ct6g6e3difyu3grk34' }],
  },
  {
    title: 'Car',
    name: 'ownable-car',
    description: 'Ride for HODLers',
    cid: 'bafybeigljdubk7pbkhecvswsekvdyms7dhetm7xa7blubugjx4ciqii274',
    keywords: [],
    isNotLocal: false,
    isDynamic: false,
    hasMetadata: false,
    hasWidgetState: false,
    isConsumable: false,
    isConsumer: false,
    isTransferable: false,
    versions: [{ date: '2025-10-06T14:33:02.677Z', cid: 'bafybeigljdubk7pbkhecvswsekvdyms7dhetm7xa7blubugjx4ciqii274' }],
  },
  {
    title: 'Robot',
    name: 'ownable-robot',
    description: 'An adorable robot companion',
    cid: 'bafybeihskccwosjdz7ze3px6gw7p55hchrt6hqjsvrn2pyjzsr6spe5l64',
    keywords: [],
    isNotLocal: false,
    isDynamic: true,
    hasMetadata: true,
    hasWidgetState: true,
    isConsumable: false,
    isConsumer: true,
    isTransferable: true,
    versions: [{ date: '2025-11-10T15:59:29.816Z', cid: 'bafybeihskccwosjdz7ze3px6gw7p55hchrt6hqjsvrn2pyjzsr6spe5l64' }],
  },
];

function makeOwnableSeeds() {
  return PACKAGES.map((pkg) => {
    const chain = EventChain.create(E2E_ADDRESS, E2E_CHAIN_ID);
    return {
      chainId: chain.id,
      packageCid: pkg.cid,
      chainJson: chain.toJSON(),
      state: chain.state.hex,
      latestHash: chain.latestHash.hex,
    };
  });
}

Given('there are example Ownables', async function () {
  const seeds = makeOwnableSeeds();

  await this.page.goto('/');

  await this.page.evaluate(async ({ idbName, packages, seeds }) => {
    // 1. Seed global localStorage with package registry
    localStorage.setItem('packages', JSON.stringify(packages));

    // 2. Open per-user IDB — get current version first
    const currentVersion = await new Promise((resolve) => {
      const req = indexedDB.open(idbName);
      req.onsuccess = () => { const v = req.result.version; req.result.close(); resolve(v); };
      req.onerror = () => resolve(1);
    });

    // 3. Upgrade DB version to create ownable stores
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(idbName, currentVersion + 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const seed of seeds) {
          const name = `ownable:${seed.chainId}`;
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // 4. Write chain data into each ownable store
    for (const seed of seeds) {
      const storeName = `ownable:${seed.chainId}`;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(seed.chainJson, 'chain');
        store.put(seed.packageCid, 'package');
        store.put(new Date().toISOString(), 'created');
        store.put([], 'keywords');
        store.put(seed.state, 'state');
        store.put(seed.latestHash, 'latestHash');
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }

    db.close();
  }, { idbName: IDB_NAME, packages: PACKAGES, seeds });

  // Reload so the app picks up the seeded data
  await this.page.reload({ waitUntil: 'networkidle' });
});

Then('The page does not contain button {string}', async function (name) {
  const matches = this.page.getByRole('button', { name });
  const count = await matches.count();
  if (count > 0) throw new Error(`Expected no button named "${name}", found ${count}`);
});
