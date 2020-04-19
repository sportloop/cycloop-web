/* eslint-disable import/prefer-default-export */
import { all } from "redux-saga/effects";

export const combineSagas = <T extends unknown[]>(sagas: T) => {
  return function* combinedSaga() {
    yield all(sagas);
  };
};
