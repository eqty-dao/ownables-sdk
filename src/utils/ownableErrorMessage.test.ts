import { describe, expect, it } from "vitest";
import { isWalletRejection } from "./ownableErrorMessage";

describe("isWalletRejection", () => {
  it("recognizes EIP-1193 rejections through wrapped causes", () => {
    expect(isWalletRejection({ cause: { code: 4001 } })).toBe(true);
    expect(isWalletRejection({ cause: { cause: { code: 4001 } } })).toBe(true);
  });

  it("does not classify runtime failures as wallet rejections", () => {
    expect(isWalletRejection(new Error("Hub upload failed"))).toBe(false);
    expect(isWalletRejection({ code: -32603, message: "Internal error" })).toBe(false);
    expect(isWalletRejection(new Error("User rejected the request"))).toBe(false);
  });
});
