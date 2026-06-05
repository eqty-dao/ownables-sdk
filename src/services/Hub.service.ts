import type { LogProgress } from "@/contexts/Progress.context";
import { withProgress } from "@/contexts/Progress.context";

export interface HubUploadResult {
  cid: string;
  owner?: string;
  nftNetwork?: string;
  smartContractAddress?: string;
  NftId?: string;
}

export default class HubService {
  public static readonly URL =
    import.meta.env.VITE_HUB ||
    import.meta.env.VITE_RELAY ||
    import.meta.env.VITE_LOCAL ||
    "";

  constructor(private readonly url: string = HubService.URL) {}

  get isConfigured(): boolean {
    return this.url.trim().length > 0;
  }

  private endpoint(path: string): string {
    if (!this.isConfigured) {
      throw new Error("Hub URL is not configured");
    }

    return `${this.url.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
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

    return await step("hubReplay", async () => {
      const response = await fetch(this.endpoint(`/ownables/${encodeURIComponent(cid)}/download`));

      if (!response.ok) {
        const message = await readError(response);
        throw new Error(`Hub download failed: ${message}`);
      }

      return new File([await response.blob()], `${cid}.zip`, { type: "application/zip" });
    });
  }
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
