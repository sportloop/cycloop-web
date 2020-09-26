import { styled } from "linaria/react";
import { animated } from "react-spring";

const Modal = styled(animated.section)`
  background-color: rgba(25, 25, 25, 0.8);
  backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  padding-top: 3rem;
  position: relative;

  ::before {
    content: "";
    width: 8rem;
    height: 0.2rem;
    background-color: rgba(255, 255, 255, 0.8);
    position: absolute;
    top: 2rem;
    border-radius: 2rem;
  }
`;

export default Modal;
