// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mnemonicToAccount } from "viem/accounts";
import {
  DEFAULT_E2E_MNEMONIC,
  E2E_ADDRESS_INDEX_KEY,
  getE2EAccount,
} from "./E2EWallet";

describe("controlled E2E address selection", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_E2E", "1");
    localStorage.clear();
  });

  it("selects the funded recipient by address index", () => {
    localStorage.setItem(E2E_ADDRESS_INDEX_KEY, "1");
    expect(getE2EAccount().address).toBe(
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    );
  });

  it("does not confuse address derivation with the alternate account path", () => {
    expect(
      mnemonicToAccount(DEFAULT_E2E_MNEMONIC, { accountIndex: 1 }).address
    ).not.toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });
});
