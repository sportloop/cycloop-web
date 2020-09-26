import { MouseEvent } from "react";
import { styled } from "linaria/react";

type OverlayProps = {
  align?: "top" | "center" | "bottom";
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
};

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: ${({ align = "top" }: OverlayProps) =>
    ({ top: "flex-start", center: "center", bottom: "flex-end" }[align])};

  pointer-events: ${({ onClick }) =>
    typeof onClick === "function" ? "initial" : "none"};
  > * {
    pointer-events: initial;
  }
`;

export default Overlay;
