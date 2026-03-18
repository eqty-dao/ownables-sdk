import { Drawer } from "@/components/ui";
import { ReactNode } from "react";

interface HelpDrawerProps {
  open: boolean;
  children: ReactNode;
}

export default function HelpDrawer(props: HelpDrawerProps) {
  return (
    <Drawer
      anchor="bottom"
      open={props.open}
      hideBackdrop
      className="bg-slate-900 p-2 text-center text-white"
    >
      {props.children}
    </Drawer>
  );
}
