/* eslint-disable no-bitwise */
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { call, take, takeLatest, put, select } from "redux-saga/effects";
import { eventChannel } from "redux-saga";
import { useSelector, useDispatch } from "react-redux";
import { useCallback } from "react";

import * as devices from "./devices";
import { DeviceStatus } from "./types";

export type HeartRateSensorLocation =
  | "Other"
  | "Chest"
  | "Wrist"
  | "Finger"
  | "Hand"
  | "Ear Lobe"
  | "Foot"
  | "Unknown";

export type HeartRateState = {
  name: string;
  value: number;
  lastUpdate: number;
  status: DeviceStatus;
  sensorLocation: HeartRateSensorLocation;
};

export type HeartRateResult = {
  heartRate: number;
  contactDetected?: boolean;
  energyExpended?: number; // in KJ
  rrIntervals: number[]; // Read Intervals
};

const initialState: HeartRateState = {
  name: null,
  value: 0,
  lastUpdate: -1,
  status: "offline",
  sensorLocation: "Unknown",
};

const { reducer, actions } = createSlice({
  name: "heartrate",
  initialState,
  reducers: {
    startScan: (state) => {
      state.status = "scanning";
    },
    found: (state, { payload }: PayloadAction<string>) => {
      state.status = "found";
      state.name = payload;
    },
    updateLocation: (
      state,
      { payload }: PayloadAction<HeartRateSensorLocation>
    ) => {
      state.sensorLocation = payload;
      state.status = "active";
    },
    updateValue: (state, { payload }: PayloadAction<number>) => {
      state.value = payload;
      state.lastUpdate = Date.now();
      state.status = "active";
    },
  },
});

const heartRateMonitorLocation: HeartRateSensorLocation[] = [
  "Other",
  "Chest",
  "Wrist",
  "Finger",
  "Hand",
  "Ear Lobe",
  "Foot",
];

const parseHeartRate = (data: DataView) => {
  const flags = data.getUint8(0);
  const rate16Bits = flags & 0x1;
  const result: Partial<HeartRateResult> = {};
  let index = 1;
  if (rate16Bits) {
    result.heartRate = data.getUint16(index, /* littleEndian= */ true);
    index += 2;
  } else {
    result.heartRate = data.getUint8(index);
    index += 1;
  }
  const contactDetected = flags & 0x2;
  const contactSensorPresent = flags & 0x4;
  if (contactSensorPresent) {
    result.contactDetected = !!contactDetected;
  }
  const energyPresent = flags & 0x8;
  if (energyPresent) {
    result.energyExpended = data.getUint16(index, /* littleEndian= */ true);
    index += 2;
  }
  const rrIntervalPresent = flags & 0x10;
  if (rrIntervalPresent) {
    const rrIntervals = [];
    for (; index + 1 < data.byteLength; index += 2) {
      rrIntervals.push(data.getUint16(index, /* littleEndian= */ true));
    }
    result.rrIntervals = rrIntervals;
  }
  return result;
};

const getSensorLocation = (data: DataView): HeartRateSensorLocation => {
  const locationValue = data.getUint8(0);
  return heartRateMonitorLocation[locationValue] || "Unknown";
};

function* updateHeartRate(event: Event) {
  const data: HeartRateResult = yield call(
    parseHeartRate,
    (event.target as BluetoothRemoteGATTCharacteristic).value
  );
  yield put(actions.updateValue(data.heartRate));
}

const createCharacteristicEventChannel = (
  characteristic: BluetoothRemoteGATTCharacteristic
) => {
  return eventChannel((emitter) => {
    const listener = (event) => {
      emitter(event);
    };
    characteristic.addEventListener("characteristicvaluechanged", listener);
    return () =>
      characteristic.removeEventListener(
        "characteristicvaluechanged",
        listener
      );
  });
};

function* saga() {
  while (true) {
    yield take(actions.startScan.type);
    const bleAvailable = yield select(devices.selectors.bleAvailable);
    if (bleAvailable) {
      const device: BluetoothDevice = yield call(
        navigator.bluetooth.requestDevice.bind(navigator.bluetooth),
        {
          filters: [{ services: ["heart_rate"] }],
        }
      );
      if (device) {
        yield put(actions.found(device.name));
        const server: BluetoothRemoteGATTServer = yield call(
          device.gatt.connect.bind(device.gatt)
        );

        const service: BluetoothRemoteGATTService = yield call(
          server.getPrimaryService.bind(server),
          "heart_rate"
        );
        const locationCharacteristic: BluetoothRemoteGATTCharacteristic = yield call(
          service.getCharacteristic.bind(service),
          "body_sensor_location"
        );
        if (locationCharacteristic) {
          const sensorLocationData: DataView = yield call(
            locationCharacteristic.readValue.bind(locationCharacteristic)
          );

          yield put(
            actions.updateLocation(getSensorLocation(sensorLocationData))
          );
        }
        const heartRateCharacteristic: BluetoothRemoteGATTCharacteristic = yield call(
          service.getCharacteristic.bind(service),
          "heart_rate_measurement"
        );

        yield call(
          heartRateCharacteristic.startNotifications.bind(
            heartRateCharacteristic
          )
        );

        const heartRateChannel = yield call(
          createCharacteristicEventChannel,
          heartRateCharacteristic
        );

        yield takeLatest(heartRateChannel, updateHeartRate);
      }
    }
  }
}

const stateSelector = <S extends { heartrate: HeartRateState }>(state: S) =>
  state.heartrate;

const selectors = {
  state: stateSelector,
};

const useDevice = () => {
  const { name, ...state } = useSelector(stateSelector);
  const dispatch = useDispatch();
  const connect = useCallback(() => {
    dispatch(actions.startScan());
  }, [dispatch]);
  return { ...state, connect, name: name || "Heart Rate Monitor" };
};

export { reducer, actions, saga, selectors, useDevice };
