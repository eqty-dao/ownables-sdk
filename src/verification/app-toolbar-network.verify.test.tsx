// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/assets/logo.svg", () => ({ default: "ownables-logo.svg" }));

import AppToolbar from "@/components/AppToolbar";

describe("AppToolbar network support", () => {
  afterEach(cleanup);

  it("accepts Base Mainnet without a testnet label or network warning", () => {
    render(<AppToolbar onMenuClick={vi.fn()} chainId={8453} isConnected />);

    expect(screen.queryByText("Testnet")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("accepts Base Sepolia and labels it as testnet", () => {
    render(<AppToolbar onMenuClick={vi.fn()} chainId={84532} isConnected />);

    expect(screen.getByText("Testnet")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("warns for unsupported connected networks", () => {
    render(<AppToolbar onMenuClick={vi.fn()} chainId={1} isConnected />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Please switch to Base or Base Sepolia to use this application."
    );
  });
});
