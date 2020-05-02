/* eslint-disable no-bitwise */
import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import { call, put } from "redux-saga/effects";

export type DevicesState = {
  bleAvailable: boolean;
};

const initialState: DevicesState = {
  bleAvailable: false,
};

const { reducer, actions } = createSlice({
  name: "devices",
  initialState,
  reducers: {
    updateBLEAvailability: (state, { payload }: PayloadAction<boolean>) => {
      state.bleAvailable = payload;
    },
  },
});

const isBLEAvailable = () => {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
};

function* saga() {
  const available = yield call(isBLEAvailable);
  yield put(actions.updateBLEAvailability(available));
}

const stateSelector = <S extends { devices: DevicesState }>(state: S) =>
  state.devices;

const selectors = {
  bleAvailable: createSelector(stateSelector, (state) => state.bleAvailable),
};

export { reducer, actions, saga, selectors };
