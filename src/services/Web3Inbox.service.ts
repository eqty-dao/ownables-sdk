import { Web3InboxClient } from "@web3inbox/core";
import type { NotifyClientTypes } from "@walletconnect/notify-client";
import type { WalletClient } from "viem";

export type Web3InboxNotification = NotifyClientTypes.NotifyNotification & {
  read: () => void;
};

export interface Web3InboxNotificationPage {
  notifications: Web3InboxNotification[];
  hasMore: boolean;
  hasMoreUnread: boolean;
}

export interface NotificationWatchHandle {
  stopWatchingNotifications: () => void;
  nextPage: () => Promise<void>;
  data: Web3InboxNotificationPage;
}

export default class Web3InboxService {
  public static readonly PROJECT_ID = (
    import.meta.env.VITE_REOWN_PROJECT_ID ||
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
    ""
  ).trim();

  public static readonly DOMAIN = (
    import.meta.env.VITE_REOWN_APP_DOMAIN || ""
  ).trim();

  constructor(
    private readonly walletClient?: WalletClient,
    private readonly chainId?: number
  ) {}

  get isConfigured(): boolean {
    return (
      Web3InboxService.PROJECT_ID.length > 0 &&
      Web3InboxService.DOMAIN.length > 0
    );
  }

  configurationError(): string | null {
    if (!Web3InboxService.PROJECT_ID) {
      return "VITE_REOWN_PROJECT_ID or VITE_WALLETCONNECT_PROJECT_ID must be configured for notifications";
    }

    if (!Web3InboxService.DOMAIN) {
      return "VITE_REOWN_APP_DOMAIN must be configured for notifications";
    }

    return null;
  }

  toAccount(address: string): string {
    if (!address) {
      throw new Error("Wallet address is required for notifications");
    }

    if (!this.chainId) {
      throw new Error("Active chain ID is required for notifications");
    }

    return `eip155:${this.chainId}:${address}`;
  }

  async getRegistrationStatus(account: string): Promise<boolean> {
    const client = await this.forAccount(account);
    return client.getAccountIsRegistered(account);
  }

  async getSubscription(account: string): Promise<NotifyClientTypes.NotifySubscription | null> {
    const client = await this.forAccount(account);
    return client.getSubscription(account);
  }

  async enable(account: string): Promise<void> {
    if (!this.walletClient) {
      throw new Error("A connected wallet is required to enable notifications");
    }

    const client = await this.forAccount(account);
    const { message, registerParams } = await client.prepareRegistration({ account });
    const signerAccount = this.walletClient.account;
    if (!signerAccount) {
      throw new Error("The connected wallet is missing a signing account");
    }
    const signature = await this.walletClient.signMessage({
      account: signerAccount,
      message,
    });

    await client.register({ registerParams, signature });
    await client.subscribeToDapp(account);
  }

  async disable(account: string): Promise<void> {
    const client = await this.forAccount(account);
    await client.unsubscribeFromDapp(account);
  }

  async pageNotifications(
    account: string,
    onUpdate: (page: Web3InboxNotificationPage) => void,
    notificationsPerPage = 20
  ): Promise<NotificationWatchHandle> {
    const client = await this.forAccount(account);
    return client.pageNotifications(
      notificationsPerPage,
      true,
      account,
      undefined,
      true
    )(onUpdate);
  }

  async markNotificationsAsRead(
    notificationIds: string[],
    account: string
  ): Promise<void> {
    if (notificationIds.length === 0) return;
    const client = await this.forAccount(account);
    client.markNotificationsAsRead(notificationIds, account);
  }

  async watchSubscription(
    account: string,
    cb: (subscription: NotifyClientTypes.NotifySubscription | null) => void
  ): Promise<() => void> {
    const client = await this.forAccount(account);
    return client.watchSubscription(cb, account);
  }

  private async forAccount(account: string): Promise<Web3InboxClient> {
    const client = await this.getClient();
    await client.setAccount(account);
    return client;
  }

  private async getClient(): Promise<Web3InboxClient> {
    const error = this.configurationError();
    if (error) {
      throw new Error(error);
    }

    return Web3InboxClient.init({
      projectId: Web3InboxService.PROJECT_ID,
      domain: Web3InboxService.DOMAIN,
      allApps: false,
      logLevel: "error",
    });
  }
}
