/* eslint-disable no-continue */
import { PayloadAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { createModule } from "remodules";
import { uid } from "uid";

import isomorphicLocalStorage from "../../utils/isomorphicLocalStorage";

type StravaState = {
  token: string | null;
  loading: boolean;
  uploaded: boolean;
  error: string | null;
};

const apiBaseUrl = "https://www.strava.com/api/v3";

const localStorageKey = "strava/accessToken";

const initialState: StravaState = {
  token: null,
  loading: false,
  uploaded: false,
  error: null,
};

const stravaModule = createModule({
  name: "strava",
  initialState,
  reducers: {
    tokenLoaded: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    loggedIn: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    logout: (state) => {
      state.token = null;
    },
    upload: (state, { payload }: PayloadAction<string>) => {
      if (!payload) {
        return;
      }
      state.loading = true;
    },
    uploadSuccess: (state) => {
      state.loading = false;
      state.uploaded = true;
    },
    uploadFailed: (state, { payload }: PayloadAction<string>) => {
      state.loading = false;
      state.error = payload;
    },
  },
  selectors: {
    token: (state) => state.token,
    isLoggedIn: (state) => !!state.token,
    isLoading: (state) => state.loading,
    isUploaded: (state) => state.uploaded,
    error: (state) => state.error,
  },
}).withWatcher(({ actions, selectors }) => {
  return function* watcher() {
    const savedToken: string = yield call(
      [isomorphicLocalStorage, "getItem"],
      localStorageKey
    );

    if (savedToken) {
      yield put(actions.tokenLoaded(savedToken));
    }

    yield takeLatest(
      actions.upload.type,
      function* handleUploadToStrava({
        payload: tcx,
      }: ReturnType<typeof actions.upload>) {
        const token = yield select(selectors.token);
        if (token === null || !tcx) {
          return;
        }

        const formData = new FormData();

        formData.append(
          "file",
          new Blob([tcx], {
            type: "application/xml",
          })
        );

        const id = yield call(uid);

        formData.append("name", "Cycloop Virtual Ride");
        formData.append("description", "Online Virtual Ride on cycloop.bike");
        formData.append("trainer", "1");
        formData.append("data_type", "tcx");
        formData.append("external_id", `cycloop_${id}`);

        const response = yield call(fetch, `${apiBaseUrl}/uploads`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.status !== 201) {
          yield put(actions.uploadFailed("Something went wrong"));
          return;
        }

        yield put(actions.uploadSuccess());
      }
    );

    yield takeLatest(actions.loggedIn.type, function* handleLogin() {
      const token = yield select(selectors.token);
      if (token === null) {
        return;
      }
      yield call([isomorphicLocalStorage, "setItem"], localStorageKey, token);
    });

    yield takeLatest(actions.logout.type, function* handleLogout() {
      yield call([isomorphicLocalStorage, "removeItem"], localStorageKey);
    });
  };
});

export default stravaModule;
