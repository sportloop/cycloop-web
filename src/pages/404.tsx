import { NextComponentType } from "next";
import { styled } from "linaria/react";

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: calc(100 * var(--vh));
`;

const Title = styled.h1`
  border-right: 1px solid #ccc;
  font-weight: 700;
  padding-right: 2rem;
  font-family: Poppins, sans-serif;
`;

const Description = styled.h2`
  font-weight: 400;
  padding-left: 2rem;
`;

const NotFound: NextComponentType = () => {
  return (
    <Container>
      <Title>404</Title>
      <Description>This page does not exist (yet?)</Description>
    </Container>
  );
};

export default NotFound;
