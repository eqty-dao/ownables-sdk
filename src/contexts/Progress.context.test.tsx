// @vitest-environment jsdom
import type { ReactNode } from "react";
import { useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProgressProvider, useProgress, type ProgressContextValue, type ProgressController, type LogProgress } from "./Progress.context";

type ProgressApi = ProgressContextValue;

function CaptureProgress({ onReady }: { onReady: (progress: ProgressApi) => void }) {
  const progress = useProgress();

  useEffect(() => {
    onReady(progress);
  }, [onReady, progress]);

  return null;
}

function renderProvider(onReady: (progress: ProgressApi) => void, children?: ReactNode) {
  return render(
    <ProgressProvider>
      <CaptureProgress onReady={onReady} />
      {children}
    </ProgressProvider>
  );
}

function stepStatus(stepId: string) {
  return document.querySelector(`[data-progress-step="${stepId}"]`)?.getAttribute("data-progress-status");
}

function openProgress(progress: ProgressApi, steps = [
  { id: "sign", label: "Sign" },
  { id: "anchor", label: "Anchor" },
]): [ProgressController, LogProgress] {
  return progress.open({
    title: "Processing action",
    steps,
  });
}

describe("ProgressProvider sessions", () => {
  afterEach(cleanup);

  it("initializes only the first step as active", () => {
    let progress!: ProgressApi;
    renderProvider((value) => {
      progress = value;
    });

    act(() => {
      openProgress(progress);
    });

    expect(screen.getByText("Processing action")).toBeVisible();
    expect(stepStatus("sign")).toBe("active");
    expect(stepStatus("anchor")).toBe("pending");
  });

  it("turns known core completions into done and the next active step", () => {
    let progress!: ProgressApi;
    renderProvider((value) => {
      progress = value;
    });

    let onProgress!: LogProgress;
    act(() => {
      [, onProgress] = openProgress(progress);
      onProgress("sign", { signature: "0x1" });
    });

    expect(stepStatus("sign")).toBe("done");
    expect(stepStatus("anchor")).toBe("active");
  });

  it("ignores unknown core completions", () => {
    let progress!: ProgressApi;
    renderProvider((value) => {
      progress = value;
    });

    let onProgress!: LogProgress;
    act(() => {
      [, onProgress] = openProgress(progress);
      onProgress("encodePublicEvent");
    });

    expect(stepStatus("sign")).toBe("active");
    expect(stepStatus("anchor")).toBe("pending");
  });

  it("ignores all late updates and closes from a superseded session", () => {
    let progress!: ProgressApi;
    renderProvider((value) => {
      progress = value;
    });

    let first!: ProgressController;
    let firstProgress!: LogProgress;
    let second!: ProgressController;
    act(() => {
      [first, firstProgress] = openProgress(progress, [{ id: "first", label: "First" }]);
      [second] = openProgress(progress, [{ id: "second", label: "Second" }]);
      first.setDone(0);
      first.setError(0, "late failure");
      first.updateStep(0, { label: "Changed" });
      firstProgress("first");
      first.close();
    });

    expect(screen.queryByText("First")).not.toBeInTheDocument();
    expect(screen.getByText("Second")).toBeVisible();
    expect(stepStatus("second")).toBe("active");

    act(() => {
      second.close();
      second.close();
    });

    expect(screen.queryByText("Processing action")).not.toBeInTheDocument();
  });
});
