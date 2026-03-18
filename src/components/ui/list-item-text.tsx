import type { AnyProps } from "@/utils/uiCompat";

export function ListItemText({ primary, secondary, ...rest }: AnyProps) {
  return (
    <span {...rest}>
      {primary}
      {secondary}
    </span>
  );
}
