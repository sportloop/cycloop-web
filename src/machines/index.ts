import { setup } from "xstate";
import { devicesMachine } from "./devices";
import { workoutMachine } from "./workout";
import { workoutEditorMachine } from "./workoutEditor";
import { stravaMachine } from "./strava";

export const appMachine = setup({
  types: {} as {
    children: {
      devices: "devicesMachine";
      workout: "workoutMachine";
      editor: "workoutEditorMachine";
      strava: "stravaMachine";
    };
  },
  actors: { devicesMachine, workoutMachine, workoutEditorMachine, stravaMachine },
}).createMachine({
  type: "parallel",
  states: {
    devices: {
      invoke: {
        src: "devicesMachine",
        id: "devices",
        systemId: "devices",
      },
    },
    workout: {
      invoke: {
        src: "workoutMachine",
        id: "workout",
        systemId: "workout",
      },
    },
    editor: {
      invoke: {
        src: "workoutEditorMachine",
        id: "editor",
        systemId: "editor",
      },
    },
    strava: {
      invoke: {
        src: "stravaMachine",
        id: "strava",
        systemId: "strava",
      },
    },
  },
});
