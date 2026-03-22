import { ReactNode } from "react";

interface HelpDrawerProps {
  open: boolean;
  children: ReactNode;
}

export default function HelpDrawer(props: HelpDrawerProps) {
  if (!props.open) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1400] border-t border-slate-700 bg-slate-900 p-2 text-center text-white">
      {props.children}
    </div>
  );
}
