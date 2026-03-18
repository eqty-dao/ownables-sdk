import type { AnyProps } from "@/utils/uiCompat";

export function CircularProgress(props: AnyProps) {
  return <span role="progressbar" {...props} />;
}
