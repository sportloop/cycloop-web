import { styled } from "linaria/react";
import { NextPage } from "next";
import Link from "next/link";

import Header from "../components/Header";
import Container from "../components/Container";

const Clickable = styled.a`
  color: #fff;
  text-decoration: none;
`;

const Title = styled.h3`
  font-weight: normal;
`;

const Index: NextPage = () => {
  return (
    <Container>
      <Header />
      <Link href="/devices" passHref>
        <Clickable>
          <Title>Devices</Title>
        </Clickable>
      </Link>
    </Container>
  );
};

export default Index;
