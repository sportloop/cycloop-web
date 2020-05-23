import { styled } from "linaria/react";

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
  justify-content: ${({
    align = "top",
  }: {
    align?: "top" | "center" | "bottom";
  }) => ({ top: "flex-start", center: "center", bottom: "flex-end" }[align])};

  pointer-events: none;
  > * {
    pointer-events: initial;
  }
`;

export default Overlay;
