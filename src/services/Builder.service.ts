import axios from "axios";

export interface UploadOptions {
  templateId?: number;
  name?: string;
  sender?: string;
  signedTransaction?: string;
}

export default class BuilderService {
  public static URL: string = import.meta.env.VITE_BUILDER ?? "";
  public static SERVER_WALLETS_ENDPOINT: string =
    import.meta.env.VITE_BUILDER_SERVER_WALLETS_ENDPOINT ??
    "/api/v1/ServerWalletAddresses";
  public static NETWORK_PARAM: string =
    import.meta.env.VITE_BUILDER_NETWORK_PARAM ?? "networkId";

  // Base mainnet = 8453, Base Sepolia = 84532
  private static readonly BASE_MAINNET_CHAIN_ID = 8453;
  private static readonly BASE_SEPOLIA_CHAIN_ID = 84532;

  constructor(private chainId: number) {}

  private static configuredUrl(): string {
    const raw = BuilderService.URL;
    return typeof raw === "string" ? raw.trim() : "";
  }

  public static isAvailable(): boolean {
    const url = BuilderService.configuredUrl();
    return /^https?:\/\//i.test(url);
  }

  /**
   * Infers builder network code from chainId.
   * Base mainnet (8453) = 'L' (mainnet)
   * Base Sepolia (84532) = 'T' (testnet)
   */
  public getNetworkCode(): "L" | "T" {
    if (this.chainId === BuilderService.BASE_MAINNET_CHAIN_ID) {
      return "L";
    } else if (this.chainId === BuilderService.BASE_SEPOLIA_CHAIN_ID) {
      return "T";
    } else {
      // Default to testnet for unknown chain IDs
      console.warn(
        `Unknown chainId ${this.chainId}, defaulting to testnet (T)`
      );
      return "T";
    }
  }

  public async getAddress() {
    if (!BuilderService.isAvailable()) {
      return null;
    }
    const baseUrl = BuilderService.configuredUrl();

    try {
      // Use the same endpoint as eqty-ownable-builder - no chainId, no API key
      const response = await axios.get(
        `${baseUrl}${BuilderService.SERVER_WALLETS_ENDPOINT}`
      );

      if (!response.data) {
        throw new Error("No data returned from server");
      }

      const networkCode = this.getNetworkCode();
      const networkSuffix = `_${networkCode}`;
      const address = Object.entries(response.data).find(
        ([key, value]) =>
          key.toLowerCase().includes("walletaddress") &&
          key.endsWith(networkSuffix) &&
          typeof value === "string"
      )?.[1] as string | undefined;

      if (!address) {
        throw new Error(
          `Server wallet address not found for network ${networkCode}`
        );
      }

      return address;
    } catch (error: any) {
      console.error("Failed to fetch builder address:", error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to get server wallet address";
      console.error("Error details:", errorMessage);
      return null;
    }
  }

  /**
   * Gets the template cost for a given template ID
   * @param templateId Template ID (default: 1)
   * @returns Promise with cost information in ETH
   */
  public async getTemplateCost(
    templateId: number = 1
  ): Promise<{ eth: string; usd?: string }> {
    if (!BuilderService.isAvailable()) {
      throw new Error("Builder service URL not configured");
    }
    const baseUrl = BuilderService.configuredUrl();

    try {
      const networkCode = this.getNetworkCode();
      const response = await axios.get(
        `${baseUrl}/api/v1/templateCost?templateId=${templateId}`
      );

      const costData = response.data[networkCode]?.base;
      if (!costData) {
        throw new Error("Template cost not found");
      }

      return {
        eth: costData.ETH || costData,
        usd: costData.USD,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to get template cost";
      throw new Error(errorMessage);
    }
  }

  /**
   * Uploads an ownable zip file to the builder service
   * @param zipFile - The zip file as Uint8Array or Blob
   * @param options - Optional upload parameters (templateId, name, sender, signedTransaction)
   * @returns Promise with requestId and message
   */
  public async upload(
    zipFile: Uint8Array | Blob,
    options?: UploadOptions
  ): Promise<{ requestId: string; message: string }> {
    if (!BuilderService.isAvailable()) {
      throw new Error("Builder service URL not configured");
    }
    const baseUrl = BuilderService.configuredUrl();

    const networkCode = this.getNetworkCode();
    const formData = new FormData();

    // Convert Uint8Array to Blob if needed
    let fileBlob: Blob | File;
    if (zipFile instanceof Blob) {
      fileBlob = zipFile;
    } else {
      // Create a new ArrayBuffer copy to ensure type compatibility
      const arrayBuffer: ArrayBuffer = new ArrayBuffer(zipFile.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(zipFile);
      fileBlob = new Blob([arrayBuffer], { type: "application/zip" });
    }

    formData.append("file", fileBlob, "ownable-package.zip");

    // Add optional fields
    if (options?.templateId !== undefined) {
      formData.append("templateId", options.templateId.toString());
    }
    if (options?.name) {
      formData.append("name", options.name);
    }
    if (options?.sender) {
      formData.append("sender", options.sender);
    }
    if (options?.signedTransaction) {
      formData.append("signedTransaction", options.signedTransaction);
    }

    try {
      const params = new URLSearchParams({
        [BuilderService.NETWORK_PARAM]: networkCode,
      });
      const response = await axios.post(
        `${baseUrl}/api/v1/upload?${params.toString()}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const requestId =
        typeof response.data.requestId === "string"
          ? response.data.requestId
          : response.data.requestId?.requestId || response.data.requestId;

      return {
        requestId: requestId,
        message: response.data.message || "Request queued",
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || error.message || "Upload failed";
      throw new Error(`Failed to upload ownable: ${errorMessage}`);
    }
  }
}
