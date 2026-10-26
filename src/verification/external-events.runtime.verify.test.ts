import { describe, expect, it } from "vitest";
import { verifyExternalEventsRuntime } from "./external-events.runtime.verify";

describe("external-events runtime verification", () => {
  it("runs against the installed core artifact under the repository Node runtime", async () => {
    await expect(verifyExternalEventsRuntime()).resolves.toBe(
      "external-events runtime verification passed"
    );
  });
});
