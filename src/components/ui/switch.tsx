import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Switch as BaseSwitch } from "@base-ui/react";
import { cn } from "@/utils/cn";

type SwitchChangeEvent = {
  target: {
    checked: boolean;
  };
};

type SwitchProps = Omit<ComponentPropsWithoutRef<"button">, "onChange" | "children"> & {
  checked?: boolean;
  onChange?: (event: SwitchChangeEvent) => void;
  size?: "small" | "medium";
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, className, size = "medium", ...rest },
  ref
) {
  const isSmall = size === "small";
  return (
    <BaseSwitch.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(next: boolean) => onChange?.({ target: { checked: next } })}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full bg-slate-300 p-0.5 transition-colors data-[checked]:bg-indigo-600 dark:bg-slate-700 dark:data-[checked]:bg-indigo-500",
        isSmall ? "h-4 w-7" : "h-6 w-11",
        className
      )}
      {...(rest as any)}
    >
      <BaseSwitch.Thumb
        className={cn(
          "block rounded-full bg-white shadow-sm transition-transform dark:bg-slate-900 dark:data-[checked]:bg-white",
          isSmall ? "h-3 w-3" : "h-5 w-5"
        )}
        style={{ transform: checked ? `translateX(${isSmall ? 12 : 20}px)` : "translateX(0px)" }}
      />
    </BaseSwitch.Root>
  );
});
