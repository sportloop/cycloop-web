/* eslint-disable react/jsx-props-no-spreading */
import * as React from "react";
import { FC } from "react";
import { styled } from "linaria/react";
import { NextComponentType } from "next";
import { AppContext, AppInitialProps, AppProps } from "next/app";
import { DefaultSeo } from "next-seo";
import { Provider } from "react-redux";

import "typeface-nunito";
import "typeface-poppins";

import createStore from "../modules";

const Container = styled.div`
  height: 100%;

  :global() {
    html {
      box-sizing: border-box;
      font-family: Nunito, sans-serif;
      color: #fff;
      font-size: 62.5%;
      touch-action: manipulation;
    }

    body {
      background: #000;
      margin: 0;
      height: 100vh;
    }

    @supports (-webkit-touch-callout: none) {
      body {
        height: -webkit-fill-available;
      }
    }

    #__next {
      height: 100%;
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
  return (
    <Provider store={createStore()}>
      <Viewport>
        <Component {...pageProps} />
      </Viewport>
    </Provider>
  );
};

const Viewport: FC = ({ children }) => {
  return (
    <Container>
      <DefaultSeo
        title="Cycloop App"
        description="do what it takes"
        canonical="https://cycloop.app"
        openGraph={{
          url: "https://cycloop.app",
          title: "Cycloop - do what it takes",
          description: "online cycling activity tracking",
        }}
        additionalMetaTags={[
          {
            property: "viewport",
            content:
              "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0",
          },
        ]}
      />
      {children}
    </Container>
  );
};

export default App;
