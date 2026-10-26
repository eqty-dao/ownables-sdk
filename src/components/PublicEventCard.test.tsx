import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PublicEventCard from "./PublicEventCard";

describe("PublicEventCard", () => {
  it("renders one stable replay-key row with pending state and local error", () => {
    render(
      <PublicEventCard
        record={{
          replayKey: "0xreceipt:4",
          event: {
            source: "0xsource",
            eventType: "drink",
            data: "0x01",
            blockNumber: 8,
            transactionHash: "0xreceipt",
            transactionIndex: 1,
            logIndex: 4,
          },
          status: "pending",
          sources: ["local"],
          localApplicationState: "failed",
          localDisplayError: "runtime unavailable",
        }}
      />
    );

    expect(screen.getByTestId("public-event-0xreceipt:4").textContent).toContain("Public event: drink");
    expect(screen.getByTestId("public-event-0xreceipt:4").textContent).toContain("Pending");
    expect(screen.getByText("Local application failed: runtime unavailable")).toBeTruthy();
  });

  it("renders confirmed status on the same replay-key row", () => {
    render(
      <PublicEventCard
        record={{
          replayKey: "0xreceipt:4",
          event: {
            source: "0xsource",
            eventType: "drink",
            data: "0x01",
            blockNumber: 8,
            transactionHash: "0xreceipt",
            transactionIndex: 1,
            logIndex: 4,
          },
          status: "confirmed",
          sources: ["local", "stream"],
        }}
      />
    );

    expect(screen.getByTestId("public-event-0xreceipt:4").textContent).toContain("Confirmed");
  });
});
