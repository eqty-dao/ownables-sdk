import { forwardRef, type AnchorHTMLAttributes } from "react";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement>;

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(props, ref) {
  return <a ref={ref} {...props} />;
});
