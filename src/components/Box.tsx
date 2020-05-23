import { styled } from "linaria/react";
// eslint-disable-next-line import/no-unresolved
import * as CSS from "csstype";

type BoxProps = {
  width?: number;
  height?: number;
  direction?: CSS.FlexDirectionProperty;
  align?: CSS.AlignItemsProperty;
  justify?: CSS.JustifyContentProperty;
  padding?: CSS.PaddingProperty<number>;
};

const applyUnits = (value: string | number): string =>
  typeof value === "number" ? `${value}rem` : value;

const Box = styled.div`
  display: flex;
  flex-direction: ${({ direction = "column" }: BoxProps) => direction};
  align-items: ${({ align = "flex-start" }: BoxProps) => align};
  justify-content: ${({ justify = "flex-start" }: BoxProps) => justify};
  width: ${({ width }: BoxProps) => (width ? `${width}rem` : "100%")};
  height: ${({ height }: BoxProps) => (height ? `${height}rem` : "auto")};
  padding: ${({ padding }: BoxProps) => (padding ? applyUnits(padding) : 0)};
`;

export default Box;
