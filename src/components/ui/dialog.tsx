import { Dialog as BaseDialog } from "@base-ui/react";
import type { CSSProperties } from "react";
import type { AnyProps } from "@/utils/uiCompat";
import { mergeStyle } from "@/utils/uiCompat";

const modalBackdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.4)",
  zIndex: 1300,
};

const dialogPopupStyle: CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 1400,
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
  padding: 16,
  maxWidth: "min(640px, calc(100vw - 32px))",
  maxHeight: "calc(100vh - 32px)",
  overflow: "auto",
};

export function Dialog({ open, onClose, children, style, sx, ...rest }: AnyProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop style={modalBackdropStyle} />
        <BaseDialog.Popup {...rest} style={mergeStyle({ ...dialogPopupStyle, ...style }, sx)}>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
