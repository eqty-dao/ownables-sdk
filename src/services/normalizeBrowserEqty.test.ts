import { describe, expect, it, vi } from "vitest";
import { normalizeBrowserEqty } from "./normalizeBrowserEqty";

describe("normalizeBrowserEqty", () => {
  it("converts Uint8Array public-event payloads to hex before calling the provider", async () => {
    const emitPublicEvent = vi.fn().mockResolvedValue({ ok: true });
    const provider = normalizeBrowserEqty({ emitPublicEvent });

    await provider.emitPublicEvent(
      `0x${"11".repeat(32)}`,
      "stack",
      Uint8Array.from([1, 2, 3]),
      { value: 0n }
    );

    expect(emitPublicEvent).toHaveBeenCalledWith(
      `0x${"11".repeat(32)}`,
      "stack",
      "0x010203",
      { value: 0n }
    );
  });

  it("leaves hex payloads unchanged", async () => {
    const emitPublicEvent = vi.fn().mockResolvedValue({ ok: true });
    const provider = normalizeBrowserEqty({ emitPublicEvent });

    await provider.emitPublicEvent(
      `0x${"22".repeat(32)}`,
      "reset",
      "0x0a0b"
    );

    expect(emitPublicEvent).toHaveBeenCalledWith(
      `0x${"22".repeat(32)}`,
      "reset",
      "0x0a0b",
      undefined
    );
  });
});
