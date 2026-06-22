import { Given, When } from '@letsrunit/bdd';
import { EventChain } from 'eqty-core';
import path from 'node:path';
import { clearBrowserWalletState } from './utils/browser-state.ts';
import { expectOwnableWidgetReady } from './utils/ownable-widget.ts';

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

Given('my wallet is empty', async function () {
  await clearBrowserWalletState(this.page);
});

Given('there are example Ownables', async function () {
  const seeds = makeOwnableSeeds();

  await this.page.goto('/');

  await this.page.evaluate(async ({ idbName, packages, seeds }) => {
    localStorage.setItem('packages', JSON.stringify(packages));

    const currentVersion = await new Promise<number>((resolve) => {
      const req = indexedDB.open(idbName);
      req.onsuccess = () => {
        const v = req.result.version;
        req.result.close();
        resolve(v);
      };
      req.onerror = () => resolve(1);
    });

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(idbName, currentVersion + 1);
      req.onupgradeneeded = (e) => {
        const database = (e.target as IDBOpenDBRequest).result;
        for (const seed of seeds) {
          const name = `ownable:${seed.chainId}`;
          if (!database.objectStoreNames.contains(name)) {
            database.createObjectStore(name);
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const seed of seeds) {
      const storeName = `ownable:${seed.chainId}`;
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(seed.chainJson, 'chain');
        store.put(seed.packageCid, 'package');
        store.put(new Date().toISOString(), 'created');
        store.put([], 'keywords');
        store.put(seed.state, 'state');
        store.put(seed.latestHash, 'latestHash');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    db.close();
  }, { idbName: IDB_NAME, packages: PACKAGES, seeds });

  await this.page.reload({ waitUntil: 'networkidle' });
});

When('the ownable widget is ready', async function () {
  await expectOwnableWidgetReady(this.page);
});

When('I fill in {string} with {string}', async function (label: string, value: string) {
  const field = this.page.locator(
    `label:has-text("${label}") input, label:has-text("${label}") textarea`
  ).first();
  await field.fill(value);
});

When(
  'I upload the file {string} into the {string} file input',
  async function (filePath: string, placeholder: string) {
    const absolutePath = path.resolve(process.cwd(), filePath);
    const input = this.page.locator(
      `label:has-text("${placeholder}") input[type="file"]`
    );
    await input.setInputFiles(absolutePath);
  }
);
