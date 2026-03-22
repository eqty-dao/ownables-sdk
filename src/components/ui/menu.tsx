import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

type MenuProps = Omit<ComponentPropsWithoutRef<"div">, "onClose"> & {
  anchorEl?: HTMLElement | null;
  open?: boolean;
  onClose?: () => void;
};

type MenuItemProps = ComponentPropsWithoutRef<"button">;

export function Menu({
  anchorEl,
  open,
  children,
  onClose,
  className,
  ...rest
}: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    if (!open || !anchorEl) return;

    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      setPosition({
        top: Math.min(rect.bottom + 8, window.innerHeight - 8),
        left: Math.min(rect.right, window.innerWidth - 8),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorEl?.contains(target)) return;
      onClose?.();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchorEl, onClose]);

  const menuStyle = useMemo<CSSProperties>(
    () => ({
      position: "fixed",
      top: position.top,
      left: position.left,
      transform: "translateX(-100%)",
    }),
    [position]
  );

  if (!open || !anchorEl) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={menuStyle}
      className={cn(
        "z-[1600] min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900",
        className
      )}
      {...rest}
    >
      {children}
    </div>,
    document.body
  );
}

export function MenuItem({
  children,
  onClick,
  className,
  disabled,
  ...rest
}: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent",
        className
      )}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
