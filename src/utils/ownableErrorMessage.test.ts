import { describe, expect, it } from "vitest";
import ownableErrorMessage, { isWalletRejection } from "./ownableErrorMessage";

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

describe("ownableErrorMessage", () => {
  const customError = 'Custom Error val: "Attempt to drink more than is available"';
  const abiError = new Error(`Ownable ABI call failed: UNKNOWN ${customError}`);

  it.each([
    abiError,
    new Error("Ownable execute failed", { cause: abiError }),
    new Error("Ownable execute failed", { cause: new Error(customError) }),
  ])("shows only the custom contract error value for %s", (error) => {
    expect(ownableErrorMessage(error)).toBe("Attempt to drink more than is available");
  });

  it("preserves ABI diagnostics when the error has no custom value", () => {
    const message = "Ownable ABI call failed: E_EXEC runtime unavailable";
    expect(ownableErrorMessage(new Error(message))).toBe(message);
  });
});
