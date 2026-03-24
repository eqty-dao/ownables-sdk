import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

type ThemeMode = "light" | "dark" | "system";

const modeButton = cva(
  "w-full rounded-xl border-2 p-3 text-sm font-medium transition-colors",
  {
    variants: {
      active: {
        true: "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-300",
        false: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#333333] dark:bg-transparent dark:text-slate-300 dark:hover:bg-[#252525]",
      },
    },
    defaultVariants: { active: false },
  }
);

function resolveSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const useDark = mode === "dark" || (mode === "system" && resolveSystemDark());
  root.classList.toggle("dark", useDark);
  root.dataset.themeMode = mode;
}

export default function ThemePicker() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("theme-mode");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  useEffect(() => {
    applyThemeMode(themeMode);
    localStorage.setItem("theme-mode", themeMode);

    if (themeMode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyThemeMode("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [themeMode]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {([
        { mode: "light", icon: <Sun className="h-6 w-6" />, label: "Light" },
        { mode: "dark",  icon: <Moon className="h-6 w-6" />, label: "Dark" },
        { mode: "system", icon: <Monitor className="h-6 w-6" />, label: "System" },
      ] as const).map(({ mode, icon, label }) => (
        <button
          key={mode}
          type="button"
          className={cn(modeButton({ active: themeMode === mode }))}
          onClick={() => setThemeMode(mode)}
        >
          <span className="flex flex-col items-center gap-1">
            {icon}
            <span>{label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
