import { Given, Then, When } from '@letsrunit/bdd';
import { EventChain } from 'eqty-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearBrowserWalletState } from './utils/browser-state.ts';
import { expectOwnableWidgetReady } from './utils/ownable-widget.ts';

const E2E_ADDRESS = '0x0000000000000000000000000000000000000001';
const E2E_CHAIN_ID = 84532; // Base Sepolia
const IDB_NAME = `ownables:${E2E_CHAIN_ID}:${E2E_ADDRESS}`;
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);

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
    hasAttachments: false,
    isClosable: false,
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
    hasAttachments: false,
    isClosable: false,
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
    hasAttachments: false,
    isClosable: false,
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

Given('I have a Dossier', async function () {
  await clearBrowserWalletState(this.page);
  await this.page.goto('/');
  await this.page.getByRole('button', { name: 'Issue an Ownable' }).click();
  await this.page.getByRole('button', { name: 'Ownable Builder' }).click();
  await this.page.getByLabel('Name *').fill('Dossier');
  await this.page.getByLabel('Description').fill('A living file dossier');
  await this.page.getByRole('button', { name: 'Create Ownable' }).click();
  await this.page.getByRole('heading', { name: 'Dossier' }).waitFor();
  await this.page.getByRole('button', { name: 'Add files' }).waitFor();
});

When('the ownable widget is ready', async function () {
  await expectOwnableWidgetReady(this.page);
});

When('I start recording widget action messages', async function () {
  await this.page.evaluate(() => {
    const win = window as typeof window & {
      __ownableWidgetMessages?: Array<unknown>;
      __ownableWidgetMessageHandler?: (event: MessageEvent) => void;
    };

    win.__ownableWidgetMessages = [];
    if (win.__ownableWidgetMessageHandler) {
      window.removeEventListener('message', win.__ownableWidgetMessageHandler);
    }

    win.__ownableWidgetMessageHandler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (!('type' in data) || !('ownable_id' in data) || !('msg' in data)) return;
      win.__ownableWidgetMessages?.push(data);
    };

    window.addEventListener('message', win.__ownableWidgetMessageHandler);
  });
});

Then(
  'the latest widget action message is an emit for {string}',
  async function (eventType: string) {
    const message = await this.page.evaluate(() => {
      const win = window as typeof window & {
        __ownableWidgetMessages?: Array<{
          type?: string;
          ownable_id?: string;
          msg?: Record<string, unknown>;
        }>;
      };

      return win.__ownableWidgetMessages?.at(-1) ?? null;
    });

    if (!message) {
      throw new Error('No widget action message was recorded');
    }

    if (message.type !== 'emit') {
      throw new Error(`Expected widget action type emit but received ${String(message.type)}`);
    }

    const keys = Object.keys(message.msg ?? {});
    if (keys.length !== 1 || keys[0] !== eventType) {
      throw new Error(
        `Expected widget emit envelope ${eventType} but received ${JSON.stringify(message.msg)}`
      );
    }
  }
);

When(
  'I upload the file {string} into the {string} file input',
  async function (filePath: string, placeholder: string) {
    const absolutePath = path.resolve(PROJECT_ROOT, filePath);
    const inputName = `${placeholder
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-input`;
    const input = this.page.locator(
      `input[type="file"][name="${inputName}"]`
    );
    await input.setInputFiles(absolutePath);
  }
);
