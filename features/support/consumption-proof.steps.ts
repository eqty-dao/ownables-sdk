import { readFile } from 'node:fs/promises';
import { Then, When } from '@letsrunit/bdd';
import { expect, type Page } from '@playwright/test';
import { EventChain } from 'eqty-core';
import JSZip from 'jszip';
import { runHubIndexer } from './utils/public-events-harness.ts';
import { expectWalletEmpty } from './utils/wallet.ts';

type ArchiveEntry = { name: string; mimeType: string; buffer: Buffer };
type ProofVariant = 'missing' | 'changed';

interface ConsumptionProofWorld {
  page: Page;
  robotArchive?: ArchiveEntry;
  paintProof?: { path: string; color: string };
}

async function readChain(archive: JSZip) {
  const entry = archive.file('chain.json');
  if (!entry) throw new Error('Ownable archive has no chain.json');
  const json: ReturnType<EventChain['toJSON']> = JSON.parse(await entry.async('string'));
  expect(json.events.every((event) => !('attachments' in event))).toBe(true);
  return EventChain.from(json);
}

async function importInFreshWallet(
  originalPage: Page,
  archive: ArchiveEntry,
  check: (page: Page) => Promise<void>
) {
  const browser = originalPage.context().browser();
  if (!browser) throw new Error('The test requires an isolated browser context');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(new URL('/', originalPage.url()).href);
    await expectWalletEmpty(page);
    await page.getByRole('button', { name: 'Issue an Ownable', exact: true }).click();
    const [picker] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import Ownable', exact: true }).click(),
    ]);
    await picker.setFiles(archive);
    await check(page);
  } finally {
    await context.close();
  }
}

When('I download the Ownable archive', async function (this: ConsumptionProofWorld) {
  const [download] = await Promise.all([
    this.page.waitForEvent('download'),
    this.page.getByRole('menuitem', { name: 'Export Ownable', exact: true }).click(),
  ]);
  const path = await download.path();
  this.robotArchive = {
    name: download.suggestedFilename(),
    mimeType: 'application/zip',
    buffer: await readFile(path),
  };
});

When('the Hub indexes the Ownable anchors', function () {
  runHubIndexer();
});

Then('the Robot archive contains its signed Paint proof as a separate attachment', async function (
  this: ConsumptionProofWorld
) {
  if (!this.robotArchive) throw new Error('Download the Robot archive first');
  const archive = await JSZip.loadAsync(this.robotArchive.buffer);
  const robot = await readChain(archive);
  const ingest = robot.events.at(-1)?.parsedData;
  expect(ingest).toMatchObject({
    '@context': 'ingest_msg.json',
    type: 'consume',
    source: { id: expect.any(String), event: expect.any(String), cid: expect.any(String) },
    target: { id: robot.id },
    attributes: { consumable_type: 'paint', color: expect.stringMatching(/^#[\da-f]{6}$/i) },
  });

  const path = `attachments/${ingest.source.cid}`;
  const entries = Object.values(archive.files).filter((entry) => !entry.dir && entry.name.startsWith('attachments/'));
  expect(entries.map((entry) => entry.name)).toEqual([path]);
  const snapshot = await JSZip.loadAsync(await entries[0].async('nodebuffer'));
  const paint = await readChain(snapshot);
  expect(paint.id).toBe(ingest.source.id);
  expect(paint.events.at(-1)?.hash.hex).toBe(ingest.source.event);
  expect(paint.events.at(-1)?.parsedData).toMatchObject({ consume: { consumer_id: robot.id } });
  this.paintProof = { path, color: ingest.attributes.color.toLowerCase() };
});

Then('a fresh wallet imports the Robot and renders the verified Paint color', async function (
  this: ConsumptionProofWorld
) {
  if (!this.robotArchive || !this.paintProof) throw new Error('Inspect the Robot archive first');
  const { color } = this.paintProof;
  await importInFreshWallet(this.page, this.robotArchive, async (page) => {
    await expect(page.getByRole('heading', { name: 'Robot', exact: true })).toBeVisible({ timeout: 20_000 });
    const widget = page.frameLocator('iframe[aria-label="Ownable widget"]');
    await expect(widget.locator('#robot circle[cx="80"][cy="90"]')).toHaveAttribute('fill', color);
  });
});

Then(/^a fresh wallet rejects the Robot with its Paint proof (missing|changed)$/, async function (
  this: ConsumptionProofWorld,
  variant: ProofVariant
) {
  if (!this.robotArchive || !this.paintProof) throw new Error('Inspect the Robot archive first');
  const { path } = this.paintProof;
  const archive = await JSZip.loadAsync(this.robotArchive.buffer);
  let message: RegExp;
  if (variant === 'missing') {
    archive.remove(path);
    message = /Missing (consumption )?attachment/i;
  } else {
    const entry = archive.file(path);
    if (!entry) throw new Error('Paint proof attachment is missing from the export');
    const snapshot = await JSZip.loadAsync(await entry.async('nodebuffer'));
    snapshot.file('tampered.txt', 'Changed after signing');
    archive.file(path, await snapshot.generateAsync({ type: 'nodebuffer' }));
    message = /Attachment bytes do not match CID/i;
  }

  const buffer = await archive.generateAsync({ type: 'nodebuffer' });
  await importInFreshWallet(this.page, { ...this.robotArchive, buffer }, async (page) => {
    const dialog = page.getByRole('dialog', { name: 'Failed to import Ownable' });
    await expect(dialog).toContainText(message, { timeout: 20_000 });
    await expectWalletEmpty(page);
  });
});
