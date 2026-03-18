import { forwardRef, type ImgHTMLAttributes } from "react";
import type { AnyProps } from "./types";

export const Card = forwardRef<HTMLDivElement, AnyProps>(function Card({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});

export const CardContent = forwardRef<HTMLDivElement, AnyProps>(function CardContent({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});

export const CardActions = forwardRef<HTMLDivElement, AnyProps>(function CardActions({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});

type CardMediaProps = ImgHTMLAttributes<HTMLImageElement> & {
  image?: string;
};

export const CardMedia = forwardRef<HTMLImageElement, CardMediaProps>(function CardMedia(
  { image, src, ...rest },
  ref
) {
  return <img ref={ref} src={src || image} {...rest} />;
});
