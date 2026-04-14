import { Given } from '@letsrunit/bdd';
import { cleanWalletState } from '../utils/clean-wallet-state';

Given('the wallet is clean', async function () {
  await cleanWalletState(this.page, { navigateHome: true, reload: true });
});
