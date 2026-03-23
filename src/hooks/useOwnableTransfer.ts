import { useCallback } from "react";
import { Binary, EventChain, IMessageMeta } from "eqty-core";
import { TypedPackage } from "../interfaces/TypedPackage";
import TypedDict from "../interfaces/TypedDict";
import { LogProgress } from "../contexts/Progress.context";
import { useService } from "./useService";
import { useProgress } from "../contexts/Progress.context";
import { enqueueSnackbar } from "notistack";
import { PACKAGE_TYPE } from "../constants";

type ExecuteFn = (msg: TypedDict, onProgress?: LogProgress, submitAnchors?: boolean) => Promise<void>;

export function useOwnableTransfer(
  chain: EventChain,
  pkg: TypedPackage | undefined,
  execute: ExecuteFn
) {
  const ownables = useService("ownables");
  const relay = useService("relay");
  const progress = useProgress();

  const resizeToThumbnail = useCallback(async (file: File): Promise<Blob> => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });

    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    ctx.drawImage(img, 0, 0, 50, 50);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8)
    );
    if (!blob) throw new Error("Failed to create thumbnail blob");
    if (blob.size > 256 * 1024) throw new Error("Compressed thumbnail still exceeds 256KB");
    return blob;
  }, []);

  const constructMeta = useCallback(async (): Promise<Partial<IMessageMeta>> => {
    if (!pkg) return {};

    let thumbnail: Binary | undefined;
    try {
      const globalIdb = await import("../services/IDB.service").then((m) => m.default.main());
      const thumbnailFile = await globalIdb.get(`package:${pkg.cid}`, "thumbnail.webp");
      if (thumbnailFile) {
        const resized = await resizeToThumbnail(thumbnailFile);
        thumbnail = Binary.from(new Uint8Array(await resized.arrayBuffer()));
      }
    } catch (e) {
      console.warn("Failed to get thumbnail for package:", e);
    }

    return { type: PACKAGE_TYPE, title: pkg.title, description: pkg.description ?? "", thumbnail: thumbnail?.base64 };
  }, [pkg, resizeToThumbnail]);

  const transfer = useCallback(async (to: string): Promise<void> => {
    if (!relay || !ownables || !pkg) return;

    const available = await relay.isAvailable();
    if (!available) {
      enqueueSnackbar("Relay server is down", { variant: "error" });
      return;
    }

    const steps = [
      { id: "signEvent", label: "Sign the event" },
      { id: "signMessage", label: "Sign the Relay message" },
    ];
    if (ownables.anchoring) steps.push({ id: "anchor", label: "Anchor the event & Relay message" });

    try {
      const [ctrl, onProgress] = progress.open({ title: "Transferring Ownable", steps });

      await execute({ transfer: { to } }, onProgress, false);

      const zip = await ownables.zip(chain);
      const content = await zip.generateAsync({ type: "uint8array" });
      const meta = await constructMeta();

      await relay.sendOwnable(to, content, meta, ownables.anchoring, onProgress);
      await ownables.submitAnchors(onProgress);

      enqueueSnackbar("Ownable sent and anchored successfully!", { variant: "success" });
      ctrl.close();

      if (pkg.uniqueMessageHash) {
        await relay.removeOwnable(pkg.uniqueMessageHash);
        await ownables.delete(chain.id);
      }
    } catch (error) {
      console.error("Error during transfer:", error);
      enqueueSnackbar(
        `Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { variant: "error" }
      );
    }
  }, [relay, ownables, pkg, chain, execute, constructMeta, progress]);

  return { transfer };
}
