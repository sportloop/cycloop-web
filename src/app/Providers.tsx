"use client";

import { createActor } from "xstate";
import { ViewportProvider } from "../hooks/useViewport";
import { AppActorContext } from "../machines/context";
import { appMachine } from "../machines";

const actor = createActor(appMachine);
actor.start();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppActorContext.Provider value={actor}>
      <ViewportProvider>
        {children}
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
    </AppActorContext.Provider>
  );
}
