import { Drawer as BaseDrawer } from "@base-ui/react";
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

function popupClass(anchor: Anchor) {
  if (anchor === "right") return "fixed right-0 top-0 bottom-0 z-[1400] max-h-screen overflow-auto border-l border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#1a1a1a]";
  if (anchor === "top") return "fixed top-0 left-0 right-0 z-[1400] max-h-screen overflow-auto border-b border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#1a1a1a]";
  if (anchor === "bottom") return "fixed bottom-0 left-0 right-0 z-[1400] max-h-screen overflow-auto border-t border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#1a1a1a]";
  return "fixed left-0 top-0 bottom-0 z-[1400] max-h-screen overflow-auto border-r border-slate-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#1a1a1a]";
}

export function Drawer({ anchor = "left", hideBackdrop, onClose, open, className, children, ...rest }: DrawerProps) {
  return (
    <BaseDrawer.Root open={open} onOpenChange={(next: boolean) => !next && onClose?.()}>
      <BaseDrawer.Portal>
        {!hideBackdrop ? <BaseDrawer.Backdrop className="fixed inset-0 z-[1300] bg-slate-900/30 backdrop-blur-sm" /> : null}
        <BaseDrawer.Popup className={cn(popupClass(anchor), className)} {...rest}>
          {children}
        </BaseDrawer.Popup>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}
