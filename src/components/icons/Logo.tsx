import classNames from "classnames";
import { forwardRef, SVGProps } from "react";

const Logo = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  (props, ref: React.Ref<SVGSVGElement>) => (
    <svg
      viewBox="0 0 315 175"
      width="1em"
      height="0.5555em"
      ref={ref}
      {...props}
    >
      <path
        fill="currentColor"
        d="M227.5 0A87.5 87.5 0 00140 87.5a52.5 52.5 0 11-8.4-28.4 99.8 99.8 0 0117.5-33.7A87.5 87.5 0 10175 87.5a52.5 52.5 0 115.7 23.8 99.8 99.8 0 01-17 36A87.5 87.5 0 10227.5 0z"
      />
    </svg>
  ),
);

Logo.displayName = "Logo";

export const TranslucentLogo = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => (
  <div
    ref={ref}
    data-glow
    {...props}
    className={classNames("translucent-logo", props.className)}
  />
));

TranslucentLogo.displayName = "TranslucentLogo";

export default Logo;
