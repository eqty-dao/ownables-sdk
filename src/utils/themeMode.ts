export type ThemeMode = "light" | "dark" | "system";

export const THEME_MODE_STORAGE_KEY = "theme-mode";

export function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export function resolveSystemDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  const useDark = mode === "dark" || (mode === "system" && resolveSystemDark());
  root.classList.toggle("dark", useDark);
  root.dataset.themeMode = mode;
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  applyThemeMode(mode);
}

export function initializeThemeMode() {
  const mode = getStoredThemeMode();
  applyThemeMode(mode);
  return mode;
}

export function setupSystemThemeListener() {
  if (typeof window === "undefined") return;

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", () => {
    if (getStoredThemeMode() === "system") {
      applyThemeMode("system");
    }
  });
}
