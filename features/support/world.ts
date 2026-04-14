import { Before, setDefaultTimeout } from '@cucumber/cucumber';
import '@letsrunit/cucumber';
import { cleanWalletState } from './utils/clean-wallet-state';

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
  await cleanWalletState(this.page);
});
