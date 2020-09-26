import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import logger from "redux-logger";

import * as devices from "./devices";
import * as workoutEditor from "./workoutEditor";

import { combineSagas } from "./util";

const createStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { devices: devices.reducer, workoutEditor: workoutEditor.reducer },
    middleware: [
      sagaMiddleware,
      ...(process.env.NODE_ENV === "development" ? [logger] : []),
    ],
  });

  sagaMiddleware.run(combineSagas([devices.saga, workoutEditor.saga]));

  return store;
};

export default createStore;
