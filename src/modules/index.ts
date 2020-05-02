import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";
import { fork } from "redux-saga/effects";

import * as devices from "./devices";
import * as heartrate from "./heartrate";

import { combineSagas } from "./util";

const createStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { devices: devices.reducer, heartrate: heartrate.reducer },
    middleware: [sagaMiddleware],
  });

  sagaMiddleware.run(combineSagas([fork(devices.saga), fork(heartrate.saga)]));

  return store;
};

export default createStore;
