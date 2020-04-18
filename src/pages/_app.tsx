/* eslint-disable react/jsx-props-no-spreading */
import * as React from "react";
import { styled } from "linaria/react";
import { NextComponentType } from "next";
import { AppContext, AppInitialProps, AppProps } from "next/app";
import { DefaultSeo } from "next-seo";

import "typeface-nunito";
import "typeface-poppins";

import useViewport from "../hooks/useViewport";

const Container = styled.div<{ viewportHeight: number }>`
  --vh: ${({ viewportHeight }) =>
    viewportHeight ? `${viewportHeight / 100}px` : "1vh"};

  :global() {
    html {
      box-sizing: border-box;
      font-family: Nunito, sans-serif;
      color: #fff;
      font-size: 62.5%;
    }

    body {
      background: #000;
      margin: 0;
    }

    *,
    *:before,
    *:after {
      box-sizing: inherit;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p {
      margin: 0;
    }
  }
`;

const App: NextComponentType<AppContext, AppInitialProps, AppProps> = ({
  Component,
  pageProps,
}) => {
  const { height } = useViewport();
  return (
    <Container viewportHeight={height}>
      <DefaultSeo
        title="Cycloop App"
        description="do what it takes"
        canonical="https://cycloop.app"
        openGraph={{
          url: "https://cycloop.app",
          title: "Cycloop - do what it takes",
          description: "online cycling activity tracking",
        }}
      />
      <Component {...pageProps} />
    </Container>
  );
};

export default App;
