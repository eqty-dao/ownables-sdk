import { createContext, ReactNode, useContext, useState } from "react";

interface OverlayContextValue {
  active: boolean;
  show: () => void;
  hide: () => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);

  return (
    <OverlayContext.Provider value={{ active, show: () => setActive(true), hide: () => setActive(false) }}>
      {children}
      {active && (
        <div className="fixed inset-0 z-[100] bg-black/50" />
      )}
    </OverlayContext.Provider>
  );
}

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used within OverlayProvider");
  return ctx;
}
