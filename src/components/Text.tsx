import { styled } from "linaria/react";
import { ColorName, colors } from "../theme";

export type TextProps = {
  size?: number;
  color?: ColorName;
  margin?: number[] | number;
};

const expandNumericValue = (value: number[] | number, unit: string): string => {
  return Array.isArray(value)
    ? value.map((v) => v + unit).join(" ")
    : value + unit;
};

const Text = styled.p`
  font-size: ${({ size }: TextProps) => `${size}rem`};
  color: ${({ color }) => colors[color]};
  line-height: 1em;
  margin: ${({ margin }) => expandNumericValue(margin, "rem")};
`;

Text.defaultProps = {
  size: 1.6,
  color: "primary",
  margin: 0,
};

export default Text;
