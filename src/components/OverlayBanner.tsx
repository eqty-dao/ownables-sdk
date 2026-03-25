import type { ReactNode } from "react";

interface OverlayBannerProps {
  icon: ReactNode;
  title: string;
}

export function OverlayBanner({ icon, title }: OverlayBannerProps) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-white/60 backdrop-blur-sm dark:bg-slate-900/50"
      style={{ cursor: "default", userSelect: "none" }}
    >
      <div className="w-full text-center">
        <div className="w-[120%] -ml-[10%] rotate-[-10deg] bg-slate-900 py-3 text-white dark:bg-slate-800">
          <div className="flex items-center justify-center gap-2">
            <span className="[&>svg]:h-6 [&>svg]:w-6">{icon}</span>
            <span className="text-xl font-semibold tracking-wide">{title}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
