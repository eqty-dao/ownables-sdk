import { Before, setDefaultTimeout } from '@cucumber/cucumber';
import '@letsrunit/cucumber';
import { clearBrowserWalletState } from './utils/browser-state.ts';

setDefaultTimeout(90_000);

Before(async function () {
  await clearBrowserWalletState(this.page);
});
