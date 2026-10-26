import { describe, expect, it } from "vitest";
import { isWalletRejection } from "./ownableErrorMessage";

describe("isWalletRejection", () => {
  it("recognizes direct and multi-level EIP-1193 rejection codes", () => {
    expect(isWalletRejection({ code: 4001 })).toBe(true);
    expect(isWalletRejection({ cause: { cause: { cause: { code: 4001 } } } })).toBe(true);
  });

  it("terminates safely for cyclic causes", () => {
    const first: { cause?: unknown } = {};
    const second: { cause?: unknown } = { cause: first };
    first.cause = second;

    expect(isWalletRejection(first)).toBe(false);
    expect(isWalletRejection({ code: 4001, cause: first })).toBe(true);
  });

  it("does not classify runtime failures as wallet rejections", () => {
    expect(isWalletRejection(new Error("Hub upload failed"))).toBe(false);
    expect(isWalletRejection({ code: -32603, message: "Internal error" })).toBe(false);
    expect(isWalletRejection(new Error("User rejected the request"))).toBe(false);
  });
});
