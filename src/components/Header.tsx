import { FC } from "react";
import { styled } from "linaria/react";
import { string } from "prop-types";

import Menu from "../icons/menu_circles.svg";

import Logo from "./Logo";

const Container = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 3rem;
`;

const Title = styled.h1`
  font-weight: 400;
  font-size: 1em;
`;

const Button = styled.button`
  font-weight: 400;
  font-size: 1em;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
`;

export type HeaderProps = {
  title?: string;
};

const Header: FC<HeaderProps> = ({ title }) => {
  return (
    <Container>
      {title ? <Title>{title}</Title> : <Logo />}
      <Button>
        <Menu />
      </Button>
    </Container>
  );
};

Header.propTypes = {
  title: string,
};

Header.defaultProps = {
  title: null,
};

export default Header;
