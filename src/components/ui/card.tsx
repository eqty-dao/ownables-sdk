import { forwardRef, type ComponentPropsWithoutRef } from "react";

type CardBlockProps = ComponentPropsWithoutRef<"div">;

export const Card = forwardRef<HTMLDivElement, CardBlockProps>(function Card({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});

export const CardContent = forwardRef<HTMLDivElement, CardBlockProps>(function CardContent({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});

export const CardActions = forwardRef<HTMLDivElement, CardBlockProps>(function CardActions({ children, ...rest }, ref) {
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
});

type CardMediaProps = ComponentPropsWithoutRef<"img"> & {
  image?: string;
};

export const CardMedia = forwardRef<HTMLImageElement, CardMediaProps>(function CardMedia(
  { image, src, ...rest },
  ref
) {
  return <img ref={ref} src={src || image} {...rest} />;
});
