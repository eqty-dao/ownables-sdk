import { Drawer as BaseDrawer } from "@base-ui/react";
import { X } from "lucide-react";
import type React from "react";
import { cn } from "@/utils/cn";

export const DrawerClose = BaseDrawer.Close;

type Anchor = "left" | "right" | "top" | "bottom";

export interface DrawerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClose"> {
  anchor?: Anchor;
  hideBackdrop?: boolean;
  onClose?: () => void;
  open?: boolean;
}

export interface DrawerHeaderProps {
  title: React.ReactNode;
  closeAriaLabel?: string;
}

const BASE_POPUP =
  "fixed z-[1400] max-h-screen overflow-auto border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-[#2a2a2a] dark:bg-[#1a1a1a]";

function popupClass(anchor: Anchor) {
  if (anchor === "right")
    return `${BASE_POPUP} right-0 top-0 bottom-0 border-l data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full`;
  if (anchor === "top")
    return `${BASE_POPUP} top-0 left-0 right-0 border-b data-[starting-style]:-translate-y-full data-[ending-style]:-translate-y-full`;
  if (anchor === "bottom")
    return `${BASE_POPUP} bottom-0 left-0 right-0 border-t data-[starting-style]:translate-y-full data-[ending-style]:translate-y-full`;
  return `${BASE_POPUP} left-0 top-0 bottom-0 border-r data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full`;
}

export function DrawerHeader({ title, closeAriaLabel = "Close" }: DrawerHeaderProps) {
  return (
    <div className="flex shrink-0 items-center justify-between p-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      <DrawerClose
        aria-label={closeAriaLabel}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-transparent p-0 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#2a2a2a]"
      >
        <X className="h-5 w-5" />
      </DrawerClose>
    </div>
  );
}

export function Drawer({ anchor = "left", hideBackdrop, onClose, open, className, children, ...rest }: DrawerProps) {
  return (
    <BaseDrawer.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
      <BaseDrawer.Portal>
        {!hideBackdrop ? (
          <BaseDrawer.Backdrop className="fixed inset-0 z-[1300] bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        ) : null}
        <BaseDrawer.Popup className={cn(popupClass(anchor), className)} {...rest}>
          {children}
        </BaseDrawer.Popup>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}
