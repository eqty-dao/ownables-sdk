import type { AnyProps } from "./types";

export function CircularProgress(props: AnyProps) {
  return <span role="progressbar" {...props} />;
}
