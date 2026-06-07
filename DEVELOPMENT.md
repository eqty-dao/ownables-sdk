# Local Development

This repo's required Hub receive flow is the main ownables list. The active path is not a notifications drawer and does not depend on Reown or Web3Inbox.

## Required Local Env

Set these SDK env vars before starting the app:

```bash
VITE_HUB=http://127.0.0.1:8000
VITE_LOCAL_DEVELOPER_NOTIFICATIONS=true
VITE_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

`VITE_LOCAL_DEVELOPER_NOTIFICATIONS=true` is the explicit gate for local Hub recipient discovery in this run. When enabled, the SDK fetches available items from:

```text
GET /ownables/available?owner=<caip10-account>
```

Hub download URLs returned from that route must still match `new URL(VITE_HUB).origin` or the SDK will reject the import.

## Accepted Localhost A-to-B Smoke

The approved manual smoke for this repo is wallet A sending an ownable to wallet B, then wallet B discovering and importing it from the main list.

### Setup

1. Start the paired Hub worktree with recipient discovery enabled and `PUBLIC_BASE_URL` matching the local Hub origin.
2. Start this SDK worktree with `VITE_HUB` pointing at that Hub and `VITE_LOCAL_DEVELOPER_NOTIFICATIONS=true`.
3. Confirm wallet A and wallet B are both available in the browser wallet you are using for localhost testing.

### Expected Flow

1. Connect wallet A in the SDK.
2. Issue or select an ownable and transfer it to wallet B.
3. Confirm the transfer progress stops after Hub upload plus any anchoring work. The SDK must not show an `Update Hub owner state` step.
4. Switch the connected wallet to wallet B.
5. Confirm the SDK requests `GET /ownables/available?owner=<wallet-b-caip10-account>`.
6. Confirm the transferred ownable appears under `Available from Hub` in the main list with `Download & import` and `Dismiss` actions.
7. Click `Dismiss` and confirm the row disappears immediately.
8. Reload while still connected as wallet B and confirm the row stays hidden.
9. Click `Show dismissed Hub items` and confirm the row returns.
10. Click `Download & import` and confirm the row leaves the available section and reappears as an imported ownable in the main wallet inventory.

### Evidence To Capture

- Hub origin used for the run.
- Wallet B CAIP-10 account queried by the SDK.
- The `GET /ownables/available` response entry that rendered the available row.
- A screenshot or note showing the available row before import.
- A screenshot or note showing the imported ownable after `Download & import`.

### Failure Notes

- If wallet B briefly shows wallet A's available rows during an account switch, treat that as a regression in account-scoped discovery state.
- If the row imports from any non-Hub origin, treat that as a regression in the Hub import guard.
- If the receive flow depends on a notifications drawer, Reown, or Web3Inbox, it is outside the approved scope for this run.
