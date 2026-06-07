import type { LogProgress } from "@/contexts/Progress.context";
import { withProgress } from "@/contexts/Progress.context";

export interface HubUploadResult {
  cid: string;
  owner?: string;
  ownerAccount?: string;
  nftNetwork?: string;
  smartContractAddress?: string;
  NftId?: string;
}

export interface HubDeliveryStatus {
  cid: string;
  owner: string;
  status:
    | "delivered"
    | "pending"
    | "failed_transient"
    | "failed_permanent"
    | "not_configured"
    | "not_subscribed";
  lastAttemptAt?: string;
  detail?: string;
}

export interface HubLocalDeveloperNotificationEntry {
  id: string;
  scope: "local-dev";
  type: string;
  title: string;
  body: string;
  url: string;
  sentAt: string;
  cid?: string;
  ownerStateVersion?: number;
  triggerKind?: string;
}

export interface HubLocalDeveloperNotificationDiscoveryResponse {
  owner: string;
  entries: HubLocalDeveloperNotificationEntry[];
}

export const LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE =
  "Local developer notifications are enabled, but the Hub local discovery endpoint is unavailable.";

export default class HubService {
  public static readonly URL = (import.meta.env.VITE_HUB || "").trim();
  public static readonly LOCAL_DEVELOPER_NOTIFICATIONS_ENABLED =
    (import.meta.env.VITE_LOCAL_DEVELOPER_NOTIFICATIONS || "").trim().toLowerCase() ===
    "true";

  constructor(private readonly url: string = HubService.URL) {}

  get isConfigured(): boolean {
    return this.url.trim().length > 0;
  }

  get localDeveloperNotificationsEnabled(): boolean {
    return HubService.LOCAL_DEVELOPER_NOTIFICATIONS_ENABLED;
  }

  get origin(): string {
    if (!this.isConfigured) {
      throw new Error("VITE_HUB is not configured");
    }

    return new URL(this.url).origin;
  }

  private endpoint(path: string): string {
    if (!this.isConfigured) {
      throw new Error("VITE_HUB is not configured");
    }

    return `${this.url.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }

  parseNotificationUrl(url: string): URL {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Notification URL is malformed");
    }

    if (parsed.origin !== this.origin) {
      throw new Error("Notification URL must use the configured Hub origin");
    }

    return parsed;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      const response = await fetch(this.endpoint("/info"), { method: "GET" });
      return response.ok;
    } catch {
      return false;
    }
  }

  async uploadOwnable(
    content: Uint8Array,
    filename = "ownable.zip",
    onProgress?: LogProgress
  ): Promise<HubUploadResult> {
    const step = withProgress(onProgress);

    return await step("hubUpload", async () => {
      const form = new FormData();
      const buffer = new ArrayBuffer(content.byteLength);
      new Uint8Array(buffer).set(content);
      form.append("file", new File([buffer], filename, { type: "application/zip" }));

      const response = await fetch(this.endpoint("/ownables/upload"), {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const message = await readError(response);
        throw new Error(`Hub upload failed: ${message}`);
      }

      return (await response.json()) as HubUploadResult;
    });
  }

  async downloadOwnable(cid: string, onProgress?: LogProgress): Promise<File> {
    const step = withProgress(onProgress);

    return await step("hubDownload", async () => {
      const response = await fetch(this.endpoint(`/ownables/${encodeURIComponent(cid)}/download`));

      if (!response.ok) {
        const message = await readError(response);
        throw new Error(`Hub download failed: ${message}`);
      }

      return new File([await response.blob()], `${cid}.zip`, { type: "application/zip" });
    });
  }

  async importFromNotificationUrl(url: string): Promise<File> {
    const parsed = this.parseNotificationUrl(url);
    const response = await fetch(parsed.toString());

    if (!response.ok) {
      const message = await readError(response);
      throw new Error(`Hub notification import failed: ${message}`);
    }

    return new File([await response.blob()], fileNameFromUrl(parsed), {
      type: response.headers.get("content-type") || "application/zip",
    });
  }

  async getDeliveryStatus(
    cid: string,
    ownerAccount: string
  ): Promise<HubDeliveryStatus> {
    const query = new URLSearchParams({
      cid,
      owner: ownerAccount,
    });
    const response = await fetch(
      this.endpoint(`/notify/delivery-status?${query.toString()}`)
    );

    if (!response.ok) {
      const message = await readError(response);
      throw new Error(`Hub delivery-status lookup failed: ${message}`);
    }

    return (await response.json()) as HubDeliveryStatus;
  }

  async getLocalDeveloperNotifications(
    ownerAccount: string
  ): Promise<HubLocalDeveloperNotificationDiscoveryResponse> {
    const query = new URLSearchParams({
      owner: ownerAccount,
    });

    try {
      const response = await fetch(
        this.endpoint(`/notify/local/discovery?${query.toString()}`)
      );

      if (response.status === 404 || response.status === 501) {
        throw new Error(LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE);
      }

      if (!response.ok) {
        const message = await readError(response);
        throw new Error(`Hub local discovery failed: ${message}`);
      }

      return (await response.json()) as HubLocalDeveloperNotificationDiscoveryResponse;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Hub local discovery failed:")) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.message === LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE
      ) {
        throw error;
      }

      throw new Error(LOCAL_DEVELOPER_DISCOVERY_UNAVAILABLE_MESSAGE);
    }
  }
}

function fileNameFromUrl(url: URL): string {
  const lastSegment = url.pathname.split("/").filter(Boolean).pop();
  if (!lastSegment) return "ownable.zip";
  return lastSegment.endsWith(".zip") ? lastSegment : `${lastSegment}.zip`;
}

async function readError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await response.json().catch(() => undefined);
    if (body?.message) return String(body.message);
    if (body?.error) return String(body.error);
    if (body?.code) return String(body.code);
    if (body) return JSON.stringify(body);
  }

  return (await response.text().catch(() => "")) || `${response.status} ${response.statusText}`;
}
