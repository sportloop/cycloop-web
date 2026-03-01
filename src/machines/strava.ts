import { setup, assign, fromPromise } from "xstate";

import isomorphicLocalStorage from "../utils/isomorphicLocalStorage";

const API_BASE_URL = "https://www.strava.com/api/v3";
const LOCAL_STORAGE_KEY = "strava/accessToken";

type StravaContext = {
  token: string | null;
  error: string | null;
};

type UploadInput = {
  tcx: string;
  token: string;
};

const stravaUpload = fromPromise(async ({ input }: { input: UploadInput }) => {
  const id = crypto.randomUUID();
  const file = new File([input.tcx], id + ".tcx", {
    type: "application/xml",
  });
  const fd = new FormData();
  fd.append("file", file);
  fd.append("name", "Cycloop Virtual Ride");
  fd.append("description", "Online Virtual Ride on cycloop.bike");
  fd.append("trainer", "1");
  fd.append("data_type", "tcx");
  fd.append("external_id", "cycloop_" + id);

  const response = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    headers: { Authorization: "Bearer " + input.token },
    body: fd,
  });

  if (response.status !== 201) {
    throw new Error("Something went wrong");
  }
});

export const stravaMachine = setup({
  types: {
    context: {} as StravaContext,
    events: {} as
      | { type: "LOGGED_IN"; token: string }
      | { type: "LOGOUT" }
      | { type: "UPLOAD"; tcx: string },
  },
  actors: {
    stravaUpload,
  },
  guards: {
    hasToken: ({ context }) => context.token !== null,
    noToken: ({ context }) => context.token === null,
  },
  actions: {
    saveToken: ({ context }) => {
      if (context.token) {
        isomorphicLocalStorage.setItem(LOCAL_STORAGE_KEY, context.token);
      }
    },
    removeToken: () => {
      isomorphicLocalStorage.removeItem(LOCAL_STORAGE_KEY);
    },
  },
}).createMachine({
  id: "strava",
  initial: "init",
  context: {
    token: null,
    error: null,
  },
  states: {
    init: {
      always: [
        {
          guard: "hasToken",
          target: "loggedIn",
        },
        {
          guard: "noToken",
          target: "loggedOut",
        },
      ],
      entry: assign({
        token: () => isomorphicLocalStorage.getItem(LOCAL_STORAGE_KEY),
      }),
    },
    loggedOut: {
      entry: "removeToken",
      on: {
        LOGGED_IN: {
          target: "loggedIn",
          actions: assign({ token: ({ event }) => event.token }),
        },
      },
    },
    loggedIn: {
      entry: "saveToken",
      on: {
        UPLOAD: {
          target: "uploading",
        },
        LOGOUT: {
          target: "loggedOut",
          actions: assign({ token: null, error: null }),
        },
      },
    },
    uploading: {
      invoke: {
        src: "stravaUpload",
        input: ({ context, event }) => ({
          tcx: (event as { type: "UPLOAD"; tcx: string }).tcx,
          token: context.token!,
        }),
        onDone: {
          target: "uploaded",
        },
        onError: {
          target: "loggedIn",
          actions: assign({
            error: ({ event }) => {
              const err = event.error;
              return err instanceof Error ? err.message : "Something went wrong";
            },
          }),
        },
      },
    },
    uploaded: {
      on: {
        UPLOAD: {
          target: "uploading",
        },
        LOGOUT: {
          target: "loggedOut",
          actions: assign({ token: null, error: null }),
        },
      },
    },
  },
});

// Selectors
export const selectToken = (snapshot: { context: StravaContext }) =>
  snapshot.context.token;

export const selectIsLoggedIn = (snapshot: { context: StravaContext }) =>
  !!snapshot.context.token;

export const selectIsLoading = (snapshot: { matches: (state: string) => boolean }) =>
  snapshot.matches("uploading");

export const selectIsUploaded = (snapshot: { matches: (state: string) => boolean }) =>
  snapshot.matches("uploaded");

export const selectError = (snapshot: { context: StravaContext }) =>
  snapshot.context.error;
