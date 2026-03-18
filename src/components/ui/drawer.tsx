import { Drawer as BaseDrawer } from "@base-ui/react";
import type { CSSProperties } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle } from "@/utils/uiCompat";

function drawerPopupStyle(anchor: string | undefined): CSSProperties {
  const side = anchor || "left";
  const base: CSSProperties = {
    position: "fixed",
    zIndex: 1400,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
    overflow: "auto",
    maxWidth: "100vw",
    maxHeight: "100vh",
  };

  if (side === "right") return { ...base, top: 0, right: 0, bottom: 0 };
  if (side === "top") return { ...base, top: 0, left: 0, right: 0 };
  if (side === "bottom") return { ...base, left: 0, right: 0, bottom: 0 };
  return { ...base, top: 0, left: 0, bottom: 0 };
}

const modalBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.4)",
  zIndex: 1300,
};

export function Drawer({ open, onClose, children, hideBackdrop, anchor, style, sx, ...rest }: AnyProps) {
  return (
    <BaseDrawer.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
      <BaseDrawer.Portal>
        {!hideBackdrop ? <BaseDrawer.Backdrop style={modalBackdropStyle} /> : null}
        <BaseDrawer.Popup {...rest} style={mergeStyle({ ...drawerPopupStyle(anchor), ...style }, sx)}>
          {children}
        </BaseDrawer.Popup>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}
