import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      size: {
        small: "text-sm px-2 py-1",
        medium: "text-sm",
        large: "text-base px-4 py-3",
      },
    },
    defaultVariants: {
      size: "medium",
    },
  }
);

type ButtonBaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">;
export type ButtonProps = ButtonBaseProps & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, size, type = "button", ...rest },
  ref
) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ size }), className)} {...rest} />;
});
