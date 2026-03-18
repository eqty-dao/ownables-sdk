import { Dialog as BaseDialog } from "@base-ui/react";
import type React from "react";
import { cn } from "@/utils/cn";
import type { AnyProps } from "./types";

export interface DialogProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClose"> {
  open?: boolean;
  onClose?: () => void;
}

export function Dialog({ open, onClose, className, children, ...rest }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[1300] bg-slate-900/40" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[1400] max-h-[calc(100vh-32px)] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl",
            className
          )}
          {...rest}
        >
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export function DialogTitle({ children, ...rest }: AnyProps) {
  return <h2 {...rest}>{children}</h2>;
}

export function DialogContent({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}

export function DialogContentText({ children, ...rest }: AnyProps) {
  return <p {...rest}>{children}</p>;
}

export function DialogActions({ children, ...rest }: AnyProps) {
  return <div {...rest}>{children}</div>;
}
