import { forwardRef, HTMLAttributes, Ref, useEffect, useState } from "react";
import { Grid } from "@/components/ui";

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
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: zIndex ?? 5,
        backgroundColor: isEnabled ? "" : "rgba(255, 255, 255, 0.8)",
        cursor: onClick && isEnabled ? "pointer" : "",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default forwardRef(Overlay);

export function OverlayBanner(props: { children: React.ReactNode }) {
  return (
    <Grid container justifyContent="center" alignItems="center" height="100%" width="100%" overflow="hidden" padding={0} margin={0}>
      <Grid width="100%" padding={0} textAlign="center">
        <div
          className="w-[120%] -ml-[10%] rotate-[-10deg] bg-slate-900 py-1 text-[28px] text-white"
          style={{ cursor: "default", userSelect: "none" }}
        >
          {props.children}
        </div>
      </Grid>
    </Grid>
  );
}

