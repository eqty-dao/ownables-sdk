import { Given, Then, When } from '@letsrunit/bdd';
import { EventChain } from 'eqty-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, formatUnits, http, parseAbiItem, parseUnits } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { clearBrowserWalletState } from './utils/browser-state.ts';
import { expectOwnableWidgetReady } from './utils/ownable-widget.ts';

const DEFAULT_E2E_MNEMONIC =
  'test test test test test test test test test test test junk';
const E2E_CHAIN_ID = 84532; // Base Sepolia
const E2E_RPC_URL = process.env.VITE_E2E_RPC_URL || 'http://127.0.0.1:8545';
const ANCHOR_ADDRESS = (process.env.VITE_BASE_SEPOLIA_ANCHOR_ADDRESS ||
  '0x7607af0cea78815c71bbea90110b2c218879354b') as `0x${string}`;
const EQTY_TOKEN_ADDRESS = (process.env.VITE_BASE_SEPOLIA_EQTY_TOKEN_ADDRESS ||
  '0x24159513a74ca294f5367764557438d318eb7ffe') as `0x${string}`;
const E2E_ADDRESS = resolveE2EAddress();
const IDB_NAME = `ownables:${E2E_CHAIN_ID}:${E2E_ADDRESS}`;
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
const PUBLIC_EVENT_ABI = parseAbiItem(
  'event PublicEvent(bytes32 indexed subjectId, address indexed source, string eventType, bytes data, uint64 timestamp)'
);

function resolveE2EAddress() {
  const mnemonic = process.env.VITE_E2E_MNEMONIC?.trim() || DEFAULT_E2E_MNEMONIC;
  const indexRaw = process.env.VITE_E2E_ACCOUNT_INDEX;
  const addressIndex = Number.isFinite(Number(indexRaw)) ? Number(indexRaw) : 0;
  return mnemonicToAccount(mnemonic, { addressIndex }).address.toLowerCase();
}

function debugString(value: unknown) {
  return JSON.stringify(value, (_, currentValue) =>
    typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
  );
}

type PrivateChainSnapshot = Array<{
  storeName: string;
  latestHash: string | null;
  eventCount: number;
}>;

type PublicReplaySnapshot = Array<{
  storeName: string;
  replayKeys: string[];
}>;

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

function createE2EPublicClient() {
  return createPublicClient({
    chain: {
      ...baseSepolia,
      rpcUrls: {
        ...baseSepolia.rpcUrls,
        default: { http: [E2E_RPC_URL] },
      },
    },
    transport: http(E2E_RPC_URL),
  });
}

async function waitFor<T>(
  getValue: () => Promise<T | null>,
  validate: (value: T) => boolean,
  label: string,
  timeoutMs = 10_000
): Promise<T> {
  const started = Date.now();
  let lastValue: T | null = null;

  while (Date.now() - started < timeoutMs) {
    const value = await getValue();
    if (value !== null) {
      lastValue = value;
      if (validate(value)) {
        return value;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `${label} timed out${lastValue === null ? '' : `: ${debugString(lastValue)}`}`
  );
}

async function readPrivateChainSnapshot(page: {
  evaluate: <T, U>(fn: (arg: T) => Promise<U> | U, arg: T) => Promise<U>;
}) {
  return page.evaluate(async ({ idbName }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(idbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    try {
      const storeNames = Array.from(db.objectStoreNames)
        .filter((name) => name.startsWith('ownable:') && !name.includes('.'))
        .sort();

      const snapshot = await Promise.all(
        storeNames.map(
          (storeName) =>
            new Promise<{ storeName: string; latestHash: string | null; eventCount: number }>(
              (resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const latestHashReq = store.get('latestHash');
                const chainReq = store.get('chain');

                tx.oncomplete = () => {
                  const chain = chainReq.result as { events?: Array<unknown> } | undefined;
                  resolve({
                    storeName,
                    latestHash: (latestHashReq.result as string | undefined) ?? null,
                    eventCount: Array.isArray(chain?.events) ? chain.events.length : 0,
                  });
                };
                tx.onerror = () => reject(tx.error);
              }
            )
        )
      );

      return snapshot;
    } finally {
      db.close();
    }
  }, { idbName: IDB_NAME });
}

async function readPublicReplaySnapshot(page: {
  evaluate: <T, U>(fn: (arg: T) => Promise<U> | U, arg: T) => Promise<U>;
}) {
  return page.evaluate(async ({ idbName }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(idbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    try {
      const storeNames = Array.from(db.objectStoreNames)
        .filter((name) => name.startsWith('ownable:') && name.endsWith('.public-event-replays'))
        .sort();

      const snapshot = await Promise.all(
        storeNames.map(
          (storeName) =>
            new Promise<{ storeName: string; replayKeys: string[] }>((resolve, reject) => {
              const tx = db.transaction(storeName, 'readonly');
              const store = tx.objectStore(storeName);
              const keysReq = store.getAllKeys();

              tx.oncomplete = () =>
                resolve({
                  storeName,
                  replayKeys: (keysReq.result as string[]).map(String).sort(),
                });
              tx.onerror = () => reject(tx.error);
            })
        )
      );

      return snapshot;
    } finally {
      db.close();
    }
  }, { idbName: IDB_NAME });
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

Given('the local Anchor preflight succeeds', async function () {
  const client = createE2EPublicClient();
  const chainId = await client.getChainId();
  if (chainId !== E2E_CHAIN_ID) {
    throw new Error(`Expected local chain ID ${E2E_CHAIN_ID} but received ${chainId}`);
  }

  const code = await client.getCode({ address: ANCHOR_ADDRESS });
  if (!code || code === '0x') {
    throw new Error(`Expected contract code at ${ANCHOR_ADDRESS}`);
  }

  const [eqtyCost, ethCost] = await Promise.all([
    client.readContract({
      address: ANCHOR_ADDRESS,
      abi: [
        {
          type: 'function',
          name: 'quoteEqtyCost',
          stateMutability: 'view',
          inputs: [{ name: 'count', type: 'uint256' }],
          outputs: [{ name: 'cost', type: 'uint256' }],
        },
      ],
      functionName: 'quoteEqtyCost',
      args: [1n],
    }),
    client.readContract({
      address: ANCHOR_ADDRESS,
      abi: [
        {
          type: 'function',
          name: 'quoteEthCost',
          stateMutability: 'view',
          inputs: [{ name: 'count', type: 'uint256' }],
          outputs: [{ name: 'cost', type: 'uint256' }],
        },
      ],
      functionName: 'quoteEthCost',
      args: [1n],
    }),
  ]);

  if (eqtyCost !== 0n) {
    throw new Error(`Expected quoteEqtyCost(1) to be 0 but received ${eqtyCost.toString()}`);
  }
  if (ethCost !== 0n) {
    throw new Error(`Expected quoteEthCost(1) to be 0 but received ${ethCost.toString()}`);
  }
});

When('the ownable widget is ready', async function () {
  await expectOwnableWidgetReady(this.page);
});

When('I forge the example ownable {string}', async function (title: string) {
  await this.page.goto('/');
  await this.page.getByRole('link', { name: 'the examples' }).click();
  const button = this.page.locator('button').filter({ hasText: title }).first();
  await button.waitFor();
  await button.click();
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

When('I record the current private chain snapshots', async function () {
  (this as any).privateChainSnapshot = await readPrivateChainSnapshot(this.page);
});

When('I start recording public replay evidence', async function () {
  (this as any).publicReplaySnapshot = await readPublicReplaySnapshot(this.page);
});

When('I start recording local Anchor public events', async function () {
  const client = createE2EPublicClient();
  (this as any).anchorPublicEventsFromBlock = (await client.getBlockNumber()) + 1n;
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

    (this as any).latestWidgetActionMessage = message;
    const keys = Object.keys(message.msg ?? {});
    if (keys.length !== 1 || keys[0] !== eventType) {
      throw new Error(
        `Expected widget emit envelope ${eventType} but received ${JSON.stringify(message.msg)}`
      );
    }
  }
);

Then('the latest local Anchor public event is {string}', async function (eventType: string) {
  const fromBlock = (this as any).anchorPublicEventsFromBlock as bigint | undefined;
  if (fromBlock === undefined) {
    throw new Error('Local Anchor public-event recording has not been started');
  }

  const client = createE2EPublicClient();
  const latest = await waitFor(
    async () => {
      const logs = await client.getLogs({
        address: ANCHOR_ADDRESS,
        event: PUBLIC_EVENT_ABI,
        fromBlock,
      });
      return logs.at(-1) ?? null;
    },
    (log) =>
      String(log.args.eventType) === eventType &&
      String(log.args.source).toLowerCase() === E2E_ADDRESS.toLowerCase(),
    `public event ${eventType}`
  );

  if (String(latest.args.eventType) !== eventType) {
    throw new Error(
      `Expected latest Anchor public event ${eventType} but received ${String(latest.args.eventType)}`
    );
  }

  (this as any).latestAnchorPublicEvent = {
    transactionHash: latest.transactionHash,
    logIndex: latest.logIndex,
    eventType: String(latest.args.eventType),
    source: String(latest.args.source),
  };
});

Then('the private chain snapshots are unchanged', async function () {
  const before = ((this as any).privateChainSnapshot ?? null) as PrivateChainSnapshot | null;
  if (!before) {
    throw new Error('Private chain snapshot recording has not been started');
  }

  const after = await readPrivateChainSnapshot(this.page);
  if (debugString(before) !== debugString(after)) {
    throw new Error(
      `Expected public emit to leave private chains unchanged.\nBefore: ${debugString(before)}\nAfter: ${debugString(after)}`
    );
  }
});

Then('the latest local Anchor public event replay is stored', async function () {
  const before = ((this as any).publicReplaySnapshot ?? null) as PublicReplaySnapshot | null;
  const latestAnchorPublicEvent = (this as any).latestAnchorPublicEvent as
    | { transactionHash: `0x${string}`; logIndex: number; eventType: string; source: string }
    | undefined;
  const latestWidgetActionMessage = (this as any).latestWidgetActionMessage as
    | { ownable_id?: string }
    | undefined;

  if (!before) {
    throw new Error('Public replay recording has not been started');
  }
  if (!latestAnchorPublicEvent) {
    throw new Error('No Anchor public event was recorded');
  }
  const ownableId = latestWidgetActionMessage?.ownable_id;
  if (!ownableId) {
    throw new Error('No widget ownable id was recorded for the latest emit');
  }

  const replayKey = `${latestAnchorPublicEvent.transactionHash}:${latestAnchorPublicEvent.logIndex}`;
  const storeName = `ownable:${ownableId}.public-event-replays`;

  const after = await waitFor(
    async () => {
      const snapshot = await readPublicReplaySnapshot(this.page);
      return snapshot.find((entry) => entry.storeName === storeName) ?? null;
    },
    (snapshot) => snapshot.replayKeys.includes(replayKey),
    `replay evidence ${replayKey}`
  );

  const beforeKeys =
    before.find((entry) => entry.storeName === storeName)?.replayKeys ?? [];

  if (beforeKeys.includes(replayKey)) {
    throw new Error(`Replay key ${replayKey} was already present before the emit`);
  }
  if (!after.replayKeys.includes(replayKey)) {
    throw new Error(`Expected replay store ${storeName} to contain ${replayKey}`);
  }
});

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

When('I open the Anchor allowance dialog', async function () {
  const changeButton = this.page.getByRole('button', { name: 'change' });
  if ((await changeButton.count()) === 0) {
    await this.page.getByRole('button', { name: 'menu' }).click();
  }
  await changeButton.click();
});

When('I open More information for the current ownable', async function () {
  await this.page.getByRole('button', { name: 'More information' }).click();
});

Then('the More information dialog is visible for {string}', async function (name: string) {
  const dialog = this.page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('heading', { name }).waitFor();
});

Then('the More information dialog shows a replay-ordered mixed timeline', async function () {
  const dialog = this.page.getByRole('dialog');
  const privateCards = dialog.getByTestId('private-event-card');
  const publicCards = dialog.getByTestId('public-event-card');
  const timelineCards = dialog.locator('[data-timeline-kind]');

  await privateCards.first().getByText('Private chain event').waitFor();
  await privateCards.first().getByText('Anchor tx:', { exact: false }).waitFor();
  await publicCards.first().getByText('Public replay event').waitFor();
  await publicCards.first().getByText('Replay applied').waitFor();
  await publicCards.first().getByText('Anchor tx:', { exact: false }).waitFor();
  await publicCards.first().getByText('Data:', { exact: false }).waitFor();
  const privateCount = await privateCards.count();
  const publicCount = await publicCards.count();
  if (privateCount < 1) {
    throw new Error('Expected at least one private timeline card');
  }
  if (publicCount < 2) {
    throw new Error(`Expected at least two public timeline cards but found ${publicCount}`);
  }

  const timelineCount = await timelineCards.count();
  const orderedEntries = await Promise.all(
    Array.from({ length: timelineCount }, async (_, index) => {
      const card = timelineCards.nth(index);
      return {
        index,
        kind: await card.getAttribute('data-timeline-kind'),
        eventType: await card.getAttribute('data-event-type'),
        text: await card.innerText(),
      };
    })
  );
  const firstPrivate = orderedEntries.find((entry) => entry.kind === 'private');
  const stackPublic = orderedEntries.find(
    (entry) => entry.kind === 'public' && entry.eventType === 'stack'
  );
  const resetPublic = orderedEntries.find(
    (entry) => entry.kind === 'public' && entry.eventType === 'reset'
  );

  if (!firstPrivate) {
    throw new Error(`Expected a private timeline card but found sequence ${debugString(orderedEntries)}`);
  }
  if (!stackPublic || !resetPublic) {
    throw new Error(
      `Expected stack and reset public cards but found sequence ${debugString(orderedEntries)}`
    );
  }
  if (stackPublic.index !== 0) {
    throw new Error(
      `Expected the stack replay card to lead the rendered timeline but found sequence ${debugString(orderedEntries)}`
    );
  }
  if (resetPublic.index !== stackPublic.index + 1) {
    throw new Error(
      `Expected reset to render immediately after stack but found sequence ${debugString(orderedEntries)}`
    );
  }
  if (firstPrivate.index !== resetPublic.index + 1) {
    throw new Error(
      `Expected the retained private instantiate card after the replayed public cards but found sequence ${debugString(orderedEntries)}`
    );
  }
});

Then('public timeline cards omit private chain rails', async function () {
  const dialog = this.page.getByRole('dialog');
  const publicCards = dialog.getByTestId('public-event-card');
  const count = await publicCards.count();
  if (count === 0) {
    throw new Error('Expected at least one public timeline card');
  }

  for (let index = 0; index < count; index += 1) {
    const card = publicCards.nth(index);
    if (await card.getByText('Previous:', { exact: false }).count()) {
      throw new Error(`Public timeline card ${index} rendered a Previous rail`);
    }
    if (await card.getByText('Hash:', { exact: false }).count()) {
      throw new Error(`Public timeline card ${index} rendered a Hash rail`);
    }
  }
});

Then('private timeline cards keep private chain rails', async function () {
  const dialog = this.page.getByRole('dialog');
  const privateCards = dialog.getByTestId('private-event-card');
  const count = await privateCards.count();
  if (count === 0) {
    throw new Error('Expected at least one private timeline card');
  }

  const lastPrivateCard = privateCards.nth(count - 1);
  const hashLabels = await lastPrivateCard.getByText('Hash:', { exact: false }).count();
  if (hashLabels < 1) {
    throw new Error('Expected at least one private chain hash rail');
  }
});

When('I save the Anchor allowance amount {string}', async function (amount: string) {
  await this.page.getByLabel('Allowance amount (EQTY)').fill(amount);
  await this.page.getByRole('button', { name: 'Save allowance' }).click();
});

When('I reset the Anchor allowance to zero', async function () {
  await this.page.getByRole('button', { name: 'Reset to zero' }).click();
});

Then('the Anchor allowance is shown as {string}', async function (amountLabel: string) {
  await this.page.getByText(`Allowance: ${amountLabel}`).waitFor();
});

Then('the local EQTY allowance is {string}', async function (amount: string) {
  const client = createE2EPublicClient();
  const allowance = await waitFor(
    async () =>
      client.readContract({
        address: EQTY_TOKEN_ADDRESS,
        abi: [
          {
            type: 'function',
            name: 'allowance',
            stateMutability: 'view',
            inputs: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
            ],
            outputs: [{ name: 'remaining', type: 'uint256' }],
          },
        ],
        functionName: 'allowance',
        args: [E2E_ADDRESS, ANCHOR_ADDRESS],
      }),
    (value) => formatUnits(value, 18) === formatUnits(parseUnits(amount, 18), 18),
    `EQTY allowance ${amount}`
  );

  if (allowance !== parseUnits(amount, 18)) {
    throw new Error(
      `Expected EQTY allowance ${amount} but received ${formatUnits(allowance, 18)}`
    );
  }
});
