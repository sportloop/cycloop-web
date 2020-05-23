import * as React from "react";
import { FC } from "react";
import { styled } from "linaria/react";
import Link from "next/link";

import Logo from "../components/Logo";

const Container = styled.div`
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Icon = styled.h1`
  font-size: 4rem;
  margin-bottom: 2rem;
`;

const Description = styled.p`
  font-size: 2rem;
  text-align: center;
  margin-bottom: 2rem;
`;

const Anchor = styled.a`
  color: #a0cdff;
  font-weight: 400;
`;

const Index: FC = () => {
  return (
    <Container>
      <Icon>
        <Logo />
      </Icon>
      <Description>
        <strong>cycloop</strong> is under construction. Check back later for
        updates.
      </Description>
      <Description>
        In the meantime, check out the{" "}
        <Link href="/workout/editor" passHref>
          <Anchor>Workout Editor</Anchor>
        </Link>
      </Description>
    </Container>
  );
};

export default Index;
