import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);

export async function uploadFile(
  page: Page,
  filePath: string,
  placeholder: string
) {
  const inputName = `${placeholder
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-input`;

  await page
    .locator(`input[type="file"][name="${inputName}"]`)
    .setInputFiles(path.resolve(PROJECT_ROOT, filePath));
}
