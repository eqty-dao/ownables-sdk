import { After, AfterAll, Before, setDefaultTimeout } from '@cucumber/cucumber';
import '@letsrunit/cucumber';
import { clearBrowserWalletState } from './utils/browser-state.ts';
import {
  capturePublicEventFailure,
  stopActiveReplacementHub,
  type PublicEventsWorld,
} from './utils/public-events-harness.ts';

setDefaultTimeout(90_000);

Before(async function () {
  await clearBrowserWalletState(this.page);
});

After(async function ({ result }) {
  if (result?.status === 'FAILED') {
    await capturePublicEventFailure(this as PublicEventsWorld, result.message);
  }
});

AfterAll(async function () {
  await stopActiveReplacementHub();
});
