import { describe, expect, it, vi } from "vitest";
import { normalizeAnchorProvider } from "./normalizeAnchorProvider";

describe("normalizeAnchorProvider", () => {
  it("stays safe when verifyAnchors delegates through validateAnchors on the same instance", async () => {
    const fallbackResult = {
      verified: true,
      anchors: {
        "0x01": "0xaaa",
      },
      map: {
        "0x01": "0x02",
      },
    };

    const provider = {
      address: "0xabc",
      chainId: 84532,
      signer: null,
      sign: vi.fn(),
      anchor: vi.fn(),
      submitAnchors: vi.fn(),
      emitPublicEvent: vi.fn(),
      validateAnchors: vi.fn().mockResolvedValue(fallbackResult),
      async verifyAnchors(...anchors: any[]) {
        return await this.validateAnchors(...anchors);
      },
    };

    const normalized = normalizeAnchorProvider(provider);
    const renormalized = normalizeAnchorProvider(normalized);

    expect(normalized).not.toBe(provider);
    expect(provider.validateAnchors).not.toBe((normalized as any).validateAnchors);

    const result = await renormalized.verifyAnchors({
      key: { hex: "0x01" },
      value: { hex: "0x02" },
    });

    expect(provider.validateAnchors).toHaveBeenCalledTimes(1);
    expect(result.verified).toBe(true);
    expect(result.details["0x01"]).toMatchObject({
      key: "0x01",
      expectedValue: "0x02",
      value: "0x02",
      transactionHash: "0xaaa",
      verified: true,
      source: "provider",
    });
  });
});
