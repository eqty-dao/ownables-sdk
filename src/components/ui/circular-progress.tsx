import type { ComponentPropsWithoutRef } from "react";

type CircularProgressProps = ComponentPropsWithoutRef<"span">;

export function CircularProgress(props: CircularProgressProps) {
  return <span role="progressbar" {...props} />;
}
