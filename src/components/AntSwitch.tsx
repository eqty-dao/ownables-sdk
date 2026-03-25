import { Switch } from "@/components/ui";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/cn";

const switchWrap = cva("inline-flex", {
  variants: {
    disabled: {
      true: "cursor-not-allowed opacity-50",
      false: "",
    },
  },
  defaultVariants: {
    disabled: false,
  },
});

interface AntSwitchProps {
  checked?: boolean;
  disabled?: boolean;
  onChange?: (event: { target: { checked: boolean } }, checked: boolean) => void;
  className?: string;
}

export default function AntSwitch({ checked, disabled, onChange, className }: AntSwitchProps) {
  return (
    <span className={cn(switchWrap({ disabled }), className)}>
      <Switch
        size="small"
        checked={checked}
        disabled={disabled}
        onChange={(event: { target: { checked: boolean } }) => onChange?.(event, !!event.target.checked)}
      />
    </span>
  );
}

