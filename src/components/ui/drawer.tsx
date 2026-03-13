import * as React from "react";
import { Drawer as BaseDrawer } from "@base-ui/react/drawer";
import { cn } from "./lib/cn";

type Anchor = "left" | "right" | "top" | "bottom";

function popupClass(anchor: Anchor) {
  if (anchor === "right") return "fixed right-0 top-0 bottom-0 z-[1400] max-h-screen overflow-auto border-l border-slate-200 bg-white shadow-2xl";
  if (anchor === "top") return "fixed top-0 left-0 right-0 z-[1400] max-h-screen overflow-auto border-b border-slate-200 bg-white shadow-2xl";
  if (anchor === "bottom") return "fixed bottom-0 left-0 right-0 z-[1400] max-h-screen overflow-auto border-t border-slate-200 bg-white shadow-2xl";
  return "fixed left-0 top-0 bottom-0 z-[1400] max-h-screen overflow-auto border-r border-slate-200 bg-white shadow-2xl";
}

export interface DrawerProps {
  anchor?: Anchor;
  children: React.ReactNode;
  className?: string;
  hideBackdrop?: boolean;
  onClose?: () => void;
  open?: boolean;
}

export function Drawer({ anchor = "left", children, className, hideBackdrop, onClose, open }: DrawerProps) {
  return (
    <BaseDrawer.Root open={open} onOpenChange={(next) => !next && onClose?.()}>
      <BaseDrawer.Portal>
        {!hideBackdrop ? <BaseDrawer.Backdrop className="fixed inset-0 z-[1300] bg-slate-900/40" /> : null}
        <BaseDrawer.Popup className={cn(popupClass(anchor), className)}>{children}</BaseDrawer.Popup>
      </BaseDrawer.Portal>
    </BaseDrawer.Root>
  );
}
