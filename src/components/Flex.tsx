import { styled } from "linaria/react";
import {
  FlexDirectionProperty,
  AlignItemsProperty,
  JustifyContentProperty,
  // eslint-disable-next-line import/no-unresolved
} from "csstype";

export type FlexProps = {
  direction?: FlexDirectionProperty;
  align?: AlignItemsProperty;
  justify?: JustifyContentProperty;
};

const Flex = styled.div`
  display: flex;
  flex: 1;
  flex-direction: ${({ direction }: FlexProps) => direction};
  align-items: ${({ align }: FlexProps) => align};
  justify-content: ${({ justify }: FlexProps) => justify};
`;

Flex.defaultProps = {
  direction: "column",
  align: "initial",
  justify: "initial",
};

export default Flex;
