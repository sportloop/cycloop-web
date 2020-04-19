import { createSlice } from "@reduxjs/toolkit";

export type DeviceState = {};

const initialState: DeviceState = {};

const { reducer, actions } = createSlice({
  name: "devices",
  initialState,
  reducers: {},
});

function* saga() {
  // NOTE: device saga
}

export { reducer, actions, saga };
