import { configureStore } from "@reduxjs/toolkit";
import createSagaMiddleware from "redux-saga";

import * as devices from "./devices";

import { combineSagas } from "./util";

const createStore = () => {
  const sagaMiddleware = createSagaMiddleware();
  const store = configureStore({
    reducer: { devices: devices.reducer },
    middleware: [sagaMiddleware],
  });

  sagaMiddleware.run(combineSagas([devices.saga]));

  return store;
};

export default createStore;
