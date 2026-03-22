import type React from "react";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton(props: SkeletonProps) {
  return <div aria-hidden="true" {...props} />;
}
