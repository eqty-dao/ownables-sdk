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
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, className, ...rest },
  ref
) {
  return (
    <BaseSwitch.Root
      ref={ref}
      checked={checked}
      onCheckedChange={(next: boolean) => onChange?.({ target: { checked: next } })}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-slate-300 p-0.5 transition-colors data-[checked]:bg-indigo-600 dark:bg-slate-700 dark:data-[checked]:bg-indigo-500",
        className
      )}
      {...rest}
    >
      <BaseSwitch.Thumb
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform dark:bg-slate-900 dark:data-[checked]:bg-white"
        )}
        style={{ transform: checked ? "translateX(20px)" : "translateX(0px)" }}
      />
    </BaseSwitch.Root>
  );
});
