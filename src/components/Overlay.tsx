import { forwardRef, HTMLAttributes, Ref, useEffect, useState } from "react";
import { cn } from "@/utils/cn";

interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean | Promise<boolean>;
  zIndex?: number;
}

function Overlay(props: OverlayProps, ref: Ref<HTMLDivElement>) {
  const { children, onClick, disabled, zIndex, className, style, ...rest } = props;
  const [isEnabled, setIsEnabled] = useState(disabled === undefined);

  useEffect(() => {
    if (disabled instanceof Promise) {
      disabled.then((v) => setIsEnabled(!v));
      return;
    }
    setIsEnabled(!disabled);
  }, [disabled]);

  return (
    <div
      {...rest}
      ref={ref}
      onClick={isEnabled ? onClick : undefined}
      className={cn(!isEnabled && "bg-white/80 dark:bg-slate-900/65", className)}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: zIndex ?? 5,
        cursor: onClick && isEnabled ? "pointer" : "",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default forwardRef(Overlay);
