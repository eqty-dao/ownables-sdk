import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventChain } from "eqty-core";
import type { HubUploadResult } from "@ownables/platform-browser";
import { useOwnableTransfer } from "@/hooks/useOwnableTransfer";

const { serviceMap, enqueueSnackbar, progressOpen, closeProgress } = vi.hoisted(() => ({
  serviceMap: {} as Record<string, any>,
  enqueueSnackbar: vi.fn(),
  progressOpen: vi.fn(),
  closeProgress: vi.fn(),
}));

vi.mock("notistack", () => ({
  enqueueSnackbar,
  SnackbarProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/hooks/useService", () => ({
  useService: (key: string) => serviceMap[key] ?? null,
}));

vi.mock("@/contexts/Progress.context", () => ({
  useProgress: () => ({ open: progressOpen }),
}));

const CHAIN_ID = "00".repeat(32);

function TransferHarness({
  execute,
  onTransferred,
}: {
  execute: (message: unknown, onProgress?: unknown, submitAnchors?: boolean) => Promise<void>;
  onTransferred: () => void;
}) {
  const { transfer } = useOwnableTransfer(
    new EventChain(CHAIN_ID),
    { uniqueMessageHash: "message-hash" } as any,
    execute,
    onTransferred
  );

  return (
    <button type="button" onClick={() => void transfer("0xdef")}>
      Transfer
    </button>
  );
}

function configureServices(uploadResult: Promise<HubUploadResult>) {
  const zip = vi.fn().mockResolvedValue({
    generateAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  });
  const submitAnchors = vi.fn().mockResolvedValue(undefined);
  const uploadOwnable = vi.fn().mockReturnValue(uploadResult);

  serviceMap.ownables = { anchoring: true, zip, submitAnchors };
  serviceMap.hub = {
    isAvailable: vi.fn().mockResolvedValue(true),
    uploadOwnable,
  };
  progressOpen.mockReturnValue([{
    close: closeProgress,
    setActive: vi.fn(),
    setError: vi.fn(),
  }, vi.fn()]);

  return { submitAnchors, uploadOwnable };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.keys(serviceMap).forEach((key) => delete serviceMap[key]);
});

describe("transfer upload lifecycle", () => {
  it("anchors once and reports pending verification without retrying the upload", async () => {
    const user = userEvent.setup();
    const onTransferred = vi.fn();
    const execute = vi.fn().mockResolvedValue(undefined);
    const { submitAnchors, uploadOwnable } = configureServices(
      Promise.resolve({
        status: "pending",
        ownableId: "ownable-pending",
        expiresAt: "2026-11-03T10:00:00.000Z",
      })
    );

    render(<TransferHarness execute={execute} onTransferred={onTransferred} />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => expect(submitAnchors).toHaveBeenCalledTimes(1));
    expect(uploadOwnable).toHaveBeenCalledTimes(1);
    expect(onTransferred).toHaveBeenCalledTimes(1);
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(
      uploadOwnable.mock.invocationCallOrder[0]
    );
    expect(uploadOwnable.mock.invocationCallOrder[0]).toBeLessThan(
      submitAnchors.mock.invocationCallOrder[0]
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      "Ownable transferred. Hub verification is pending.",
      { variant: "info" }
    );
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(
      "Ownable transferred through Hub",
      expect.anything()
    );
  });

  it("keeps the available success meaning after one anchor submission", async () => {
    const user = userEvent.setup();
    const onTransferred = vi.fn();
    const { submitAnchors, uploadOwnable } = configureServices(
      Promise.resolve({
        status: "available",
        ownableId: "ownable-available",
        cid: "bafyavailable",
      })
    );

    render(<TransferHarness execute={vi.fn().mockResolvedValue(undefined)} onTransferred={onTransferred} />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => expect(submitAnchors).toHaveBeenCalledTimes(1));
    expect(uploadOwnable).toHaveBeenCalledTimes(1);
    expect(onTransferred).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith("Ownable transferred through Hub", {
      variant: "success",
    });
  });

  it("does not report transfer success when upload fails", async () => {
    const user = userEvent.setup();
    const onTransferred = vi.fn();
    const { submitAnchors, uploadOwnable } = configureServices(Promise.resolve({
      status: "available",
      ownableId: "ownable-available",
      cid: "bafyavailable",
    }));
    uploadOwnable.mockRejectedValue(new Error("upload failed"));

    render(<TransferHarness execute={vi.fn().mockResolvedValue(undefined)} onTransferred={onTransferred} />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith("Transfer failed: upload failed", { variant: "error" })
    );
    expect(submitAnchors).not.toHaveBeenCalled();
    expect(onTransferred).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(
      expect.stringMatching(/^Ownable transferred/),
      expect.anything()
    );
  });

  it("does not report transfer success when anchor submission fails", async () => {
    const user = userEvent.setup();
    const onTransferred = vi.fn();
    const { submitAnchors, uploadOwnable } = configureServices(
      Promise.resolve({
        status: "pending",
        ownableId: "ownable-pending",
        expiresAt: "2026-11-03T10:00:00.000Z",
      })
    );
    submitAnchors.mockRejectedValue(new Error("anchor failed"));

    render(<TransferHarness execute={vi.fn().mockResolvedValue(undefined)} onTransferred={onTransferred} />);
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith("Transfer failed: anchor failed", { variant: "error" })
    );
    expect(uploadOwnable).toHaveBeenCalledTimes(1);
    expect(onTransferred).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(
      expect.stringMatching(/^Ownable transferred/),
      expect.anything()
    );
  });

  it("pins all direct Ownables packages to one immutable lockfile resolution", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies: Record<string, string>;
    };
    const lockfile = readFileSync("yarn.lock", "utf8");
    const packageNames = [
      "@ownables/adapter-viem",
      "@ownables/builder",
      "@ownables/core",
      "@ownables/platform-browser",
    ];
    const versions = packageNames.map((name) => manifest.dependencies[name]);

    expect(versions.every((version) => Boolean(version))).toBe(true);
    expect(new Set(versions).size).toBe(1);
    const version = versions[0]!;
    for (const name of packageNames) {
      expect(lockfile).toContain(`\"${name}@npm:${version}\":`);
      expect(lockfile).toContain(`resolution: \"${name}@npm:${version}\"`);
    }
  });
});
