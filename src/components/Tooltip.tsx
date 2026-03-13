import {Tooltip as BaseTooltip, TooltipProps as BaseTooltipProps} from "@/components/ui/primitives";

interface TooltipProps extends BaseTooltipProps {
  condition?: boolean;
}

export default function Tooltip(props: TooltipProps) {
  const {condition, children} = props;
  const tooltipProps = {...props, condition: undefined} as BaseTooltipProps;

  return condition === false
    ? <>{children}</>
    : <BaseTooltip {...tooltipProps}>{children}</BaseTooltip>
}
