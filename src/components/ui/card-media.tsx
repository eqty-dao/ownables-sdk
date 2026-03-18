import { forwardRef, type ImgHTMLAttributes } from "react";

type CardMediaProps = ImgHTMLAttributes<HTMLImageElement> & {
  image?: string;
};

export const CardMedia = forwardRef<HTMLImageElement, CardMediaProps>(function CardMedia(
  { image, src, ...rest },
  ref
) {
  return <img ref={ref} src={src || image} {...rest} />;
});
