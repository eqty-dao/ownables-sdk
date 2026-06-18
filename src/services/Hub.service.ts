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

export interface HubAvailableOwnableEntry {
  id: string;
  title: string;
  description?: string;
  issuer?: string;
  availableAt: string;
  package: {
    cid: string;
    thumbnailUrl?: string | null;
  };
}

export interface HubAvailableOwnablesResponse {
  owner: string;
  entries: HubAvailableOwnableEntry[];
}

export const AVAILABLE_OWNABLES_UNAVAILABLE_MESSAGE =
  "Hub available-ownables discovery is enabled, but the Hub discovery endpoint is unavailable.";

export default class HubService {
  public static readonly URL = (import.meta.env.VITE_HUB || "").trim();
  public static readonly RECIPIENT_DISCOVERY_ENABLED =
    (import.meta.env.VITE_LOCAL_DEVELOPER_NOTIFICATIONS || "").trim().toLowerCase() ===
    "true";

  constructor(private readonly url: string = HubService.URL) {}

  get isConfigured(): boolean {
    return this.url.trim().length > 0;
  }

  get recipientDiscoveryEnabled(): boolean {
    return HubService.RECIPIENT_DISCOVERY_ENABLED;
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

  parseHubDownloadUrl(url: string): URL {
    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Hub download URL is malformed");
    }

    if (parsed.origin !== this.origin) {
      throw new Error("Hub download URL must use the configured Hub origin");
    }

    return parsed;
  }

  getPackageDownloadUrl(cid: string): string {
    return this.endpoint(`/packages/${encodeURIComponent(cid)}/download`);
  }

  getOwnableChainUrl(id: string): string {
    return this.endpoint(`/ownables/${encodeURIComponent(id)}/chain`);
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      const response = await fetch(this.endpoint("/health"), { method: "GET" });
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
      const response = await fetch(this.endpoint(`/packages/${encodeURIComponent(cid)}/download`));

      if (!response.ok) {
        const message = await readError(response);
        throw new Error(`Hub download failed: ${message}`);
      }

      return new File([await response.blob()], `${cid}.zip`, { type: "application/zip" });
    });
  }

  async importFromHub(packageCid: string, ownableId: string): Promise<{
    packageFile: File;
    chainJson: unknown;
  }> {
    const packageUrl = this.parseHubDownloadUrl(this.getPackageDownloadUrl(packageCid));
    const chainUrl = this.parseHubDownloadUrl(this.getOwnableChainUrl(ownableId));
    const [packageResponse, chainResponse] = await Promise.all([
      fetch(packageUrl.toString()),
      fetch(chainUrl.toString()),
    ]);

    if (!packageResponse.ok) {
      const message = await readError(packageResponse);
      throw new Error(`Hub import failed: ${message}`);
    }

    if (!chainResponse.ok) {
      const message = await readError(chainResponse);
      throw new Error(`Hub event chain download failed: ${message}`);
    }

    return {
      packageFile: new File([await packageResponse.blob()], fileNameFromUrl(packageUrl), {
        type: packageResponse.headers.get("content-type") || "application/zip",
      }),
      chainJson: await chainResponse.json(),
    };
  }

  async listAvailableOwnables(
    ownerAccount: string
  ): Promise<HubAvailableOwnablesResponse> {
    const query = new URLSearchParams({
      owner: ownerAccount,
    });

    try {
      const response = await fetch(
        this.endpoint(`/ownables/available?${query.toString()}`)
      );

      if (response.status === 404 || response.status === 501) {
        throw new Error(AVAILABLE_OWNABLES_UNAVAILABLE_MESSAGE);
      }

      if (!response.ok) {
        const message = await readError(response);
        throw new Error(`Hub available-ownables lookup failed: ${message}`);
      }

      return (await response.json()) as HubAvailableOwnablesResponse;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Hub available-ownables lookup failed:")
      ) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.message === AVAILABLE_OWNABLES_UNAVAILABLE_MESSAGE
      ) {
        throw error;
      }

      throw new Error(AVAILABLE_OWNABLES_UNAVAILABLE_MESSAGE);
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
