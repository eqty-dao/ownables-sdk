import type { ComponentPropsWithoutRef } from "react";

type DividerProps = ComponentPropsWithoutRef<"hr">;

export function Divider(props: DividerProps) {
  return <hr {...props} />;
}
