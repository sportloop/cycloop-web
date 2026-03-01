import { createContext, useContext } from "react";
import type { ActorRefFrom } from "xstate";
import type { appMachine } from "./index";

export const AppActorContext = createContext<ActorRefFrom<
  typeof appMachine
> | null>(null);

export function useAppActor() {
  const actor = useContext(AppActorContext);
  if (!actor)
    throw new Error(
      "useAppActor must be used within AppActorContext.Provider"
    );
  return actor;
}
