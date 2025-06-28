/* eslint-disable react/jsx-props-no-spreading */
import * as React from "react";
import { DefaultSeo } from "next-seo";
import { createDynamicStore } from "remodules";
import { createWrapper, HYDRATE } from "next-redux-wrapper";

import "tailwindcss/tailwind.css";
import "@reach/dialog/styles.css";
import "@reach/menu-button/styles.css";
import { ViewportProvider } from "../hooks/useViewport";

import "../global.css";

const createStore = () => {
  const store = createDynamicStore({
    reducer: (state = {}, action = { type: "" }) => {
      if (action.type === HYDRATE) {
        return { ...state, ...action.payload };
      }
      return state;
    },
  });
  return store;
};

function App({ Component, pageProps }) {
  const Layout = Component.Layout || React.Fragment;
  const layoutProps = Component.layoutProps || {};
  return (
    <ViewportProvider>
      <main className="min-h-screen bg-black selection:text-black selection:bg-white">
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
        <Layout {...layoutProps}>
          <Component {...pageProps} />
        </Layout>
      </main>
      <svg width="0" height="0" viewBox="0 0 400 300">
        <defs>
          <mask id="logo_mask">
            <path
              fill="white"
              d="M227.5 0A87.5 87.5 0 00140 87.5a52.5 52.5 0 11-8.4-28.4 99.8 99.8 0 0117.5-33.7A87.5 87.5 0 10175 87.5a52.5 52.5 0 115.7 23.8 99.8 99.8 0 01-17 36A87.5 87.5 0 10227.5 0z"
            />
          </mask>
        </defs>
      </svg>
    </ViewportProvider>
  );
}

export default createWrapper(createStore, { debug: true }).withRedux(App);
