import { Dialog as BaseDialog } from "@base-ui/react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/utils/cn";

export const DialogClose = BaseDialog.Close;

export interface DialogProps extends Omit<ComponentPropsWithoutRef<"div">, "onClose"> {
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
            "fixed z-[1400] overflow-auto bg-white shadow-xl dark:bg-slate-900",
            "inset-0 max-h-screen w-full rounded-none border-0",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100vh-32px)] sm:w-[min(640px,calc(100vw-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-slate-200 sm:dark:border-slate-700",
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

type DialogTitleProps = ComponentPropsWithoutRef<"h2">;
type DialogContentProps = ComponentPropsWithoutRef<"div">;
type DialogContentTextProps = ComponentPropsWithoutRef<"p">;
type DialogActionsProps = ComponentPropsWithoutRef<"div">;

export function DialogTitle({ children, ...rest }: DialogTitleProps) {
  return <h2 {...rest}>{children}</h2>;
}

export function DialogContent({ children, ...rest }: DialogContentProps) {
  return <div {...rest}>{children}</div>;
}

export function DialogContentText({ children, ...rest }: DialogContentTextProps) {
  return <p {...rest}>{children}</p>;
}

export function DialogActions({ children, ...rest }: DialogActionsProps) {
  return <div {...rest}>{children}</div>;
}
