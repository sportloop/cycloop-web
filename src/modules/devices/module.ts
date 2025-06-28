/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-continue */
/* eslint-disable no-bitwise */
import { AnyAction, PayloadAction } from "@reduxjs/toolkit";
import { EventChannel, eventChannel } from "redux-saga";
import {
  all,
  call,
  fork,
  put,
  select,
  take,
  takeLatest,
} from "redux-saga/effects";
import { createModule } from "remodules";

import { addPoint, Point, updateResistance } from "../common/actions";

const name = "devices";

type Device = {
  id: string;
  name: string;
  type: string;
  features: { [key: string]: boolean };
  values: { [key: string]: number };
};

const shortIdToLongId = (shortId: number) => {
  const hex = shortId.toString(16);
  return `0000${hex}-0000-1000-8000-00805f9b34fb`;
};

const longIdToShortId = (longId: string) => {
  const hex = longId.split("-")[0].slice(4);
  return parseInt(hex, 16);
};

const nthBitFlag = (n: number) => 1 << n;

type NumberFormat =
  // | `Big${"Uint" | "Int"}64`
  `${"Uint" | "Int"}${8 | 16 | 32}` | `Float${32 | 64}`;

type GattCharacteristicDefinition = {
  field: string;
  format: NumberFormat;
  unit: string;
  size: number;
  modifier?: number | ((value: number) => any);
  flag?: number;
};

type GattCommandField = {
  name: string;
  format: NumberFormat;
  getValue: (data: Record<string, number | string | boolean>) => number;
  littleEndian?: boolean;
};

type WriteResponse = {
  name: string;
  format: NumberFormat;
  check: (code: number) => boolean | string;
};

type GattCommandDefinition = {
  bufferSize: number;
  fields: GattCommandField[];
  response: WriteResponse[];
};

type GattCharacteristicInfo<Type extends "read" | "write" | "notify"> = {
  shortId: number;
  id: string;
  name: string;
  type: Type;
};

type GattWriteCharacteristicInfo = GattCharacteristicInfo<"write"> & {
  definition: Record<string, GattCommandDefinition>;
};

type GattReadNotifyCharacteristicInfo = GattCharacteristicInfo<
  "read" | "notify"
> & {
  definition: GattCharacteristicDefinition[];
};

type GattServiceDefinition = {
  shortId: number;
  id: BluetoothServiceUUID;
  name: string;
};

const opCodeToResponse = {
  0x00: "Reserved.",
  0x01: null, // "Succeeded.",
  0x02: "Not supported.",
  0x03: "Incorrect parameter.",
  0x04: "Operation failed.",
  0x05: "Control is not allowed.",
};

const createFtmsResponse = (opCode: number): WriteResponse[] => {
  return [
    {
      name: "responseCode",
      format: "Uint8",
      check: (code) => code !== 0x80,
    },
    {
      name: "requestCode",
      format: "Uint8",
      check: (code) => code !== opCode,
    },
    {
      name: "resultCode",
      format: "Uint8",
      check: (code) => opCodeToResponse[code] || false,
    },
  ];
};

const parseFlagMap = (flagMap: Record<string, number>) => (flags: number) => {
  const result: Record<string, boolean> = {};
  Object.entries(flagMap).forEach(([key, value]) => {
    result[key] = Boolean(flags & value);
  });
  return result;
};

const parseFitnessMachineFeatureFlags = parseFlagMap({
  averageSpeedSupported: nthBitFlag(0),
  cadenceSupported: nthBitFlag(1),
  totalDistanceSupported: nthBitFlag(2),
  inclinationSupported: nthBitFlag(3),
  elevationGainSupported: nthBitFlag(4),
  paceSupported: nthBitFlag(5),
  stepCountSupported: nthBitFlag(6),
  resistanceLevelSupported: nthBitFlag(7),
  strideCountSupported: nthBitFlag(8),
  expendedEnergySupported: nthBitFlag(9),
  heartRateMeasurementSupported: nthBitFlag(10),
  metabolicEquivalentSupported: nthBitFlag(11),
  elapsedTimeSupported: nthBitFlag(12),
  RemainingTimeSupported: nthBitFlag(13),
  powerMeasurementSupported: nthBitFlag(14),
  forceOnBeltAndPowerOutputSupported: nthBitFlag(15),
  userDataRetentionSupported: nthBitFlag(16),
});

const parseTargetSettingFeatureFlags = parseFlagMap({
  speedTargetSettingSupported: nthBitFlag(0),
  inclinationTargetSettingSupported: nthBitFlag(1),
  resistanceTargetSettingSupported: nthBitFlag(2),
  powerTargetSettingSupported: nthBitFlag(3),
  heartRateTargetSettingSupported: nthBitFlag(4),
  targetedExpendedEnergyConfigurationSupported: nthBitFlag(5),
  targetedStepNumberConfigurationSupported: nthBitFlag(6),
  targetedStrideNumberConfigurationSupported: nthBitFlag(7),
  targetedDistanceConfigurationSupported: nthBitFlag(8),
  targetedTrainingTimeConfigurationSupported: nthBitFlag(9),
  targetedTimeInTwoHeartRateZonesConfigurationSupported: nthBitFlag(10),
  targetedTimeInThreeHeartRateZonesConfigurationSupported: nthBitFlag(11),
  targetedTimeInFiveHeartRateZonesConfigurationSupported: nthBitFlag(12),
  indoorBikeSimulationParametersSupported: nthBitFlag(13),
  wheelCircumferenceConfigurationSupported: nthBitFlag(14),
  spinDownControlSupported: nthBitFlag(15),
  targetedCadenceConfigurationSupported: nthBitFlag(16),
});

const characteristicsById: Record<
  number,
  GattWriteCharacteristicInfo | GattReadNotifyCharacteristicInfo
> = {
  0x2a19: {
    shortId: 0x2a19,
    id: shortIdToLongId(0x2a19),
    name: "battery_level",
    type: "read",
    definition: [
      {
        field: "batteryLevel",
        format: "Uint8",
        size: 1,
        unit: "percent",
      },
    ],
  },
  0x2acc: {
    shortId: 0x2acc,
    id: shortIdToLongId(0x2a8b),
    name: "fitness_machine_feature",
    type: "read",
    definition: [
      {
        field: "fitnessMachineFeature",
        format: "Uint32",
        size: 4,
        unit: "struct",
        modifier: parseFitnessMachineFeatureFlags,
      },
      {
        field: "targetSettingFeature",
        format: "Uint32",
        size: 4,
        unit: "struct",
        modifier: parseTargetSettingFeatureFlags,
      },
    ],
  },
  0x2ad9: {
    shortId: 0x2ad9,
    id: shortIdToLongId(0x2ad9),
    name: "fitness_machine_control_point",
    type: "write",
    definition: {
      requestControl: {
        bufferSize: 1,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x00,
          },
        ],
        response: createFtmsResponse(0x00),
      },
      reset: {
        bufferSize: 1,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x01,
          },
        ],
        response: createFtmsResponse(0x01),
      },
      setTargetSpeed: {
        bufferSize: 18,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x02,
          },
          {
            name: "targetSpeed",
            format: "Uint16",
            getValue: (data: { targetSpeed: number }) => data.targetSpeed,
          },
        ],
        response: createFtmsResponse(0x02),
      },
      setTargetInclination: {
        bufferSize: 18,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x03,
          },
          {
            name: "targetInclination",
            format: "Int16",
            getValue: (data: { targetInclination: number }) =>
              data.targetInclination,
          },
        ],
        response: createFtmsResponse(0x03),
      },
      setTargetResistanceLevel: {
        bufferSize: 18,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x04,
          },
          {
            name: "targetResistanceLevel",
            format: "Uint8",
            getValue: (data: { targetResistanceLevel: number }) =>
              data.targetResistanceLevel,
          },
        ],
        response: createFtmsResponse(0x04),
      },
      updateResistance: {
        bufferSize: 18,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x05,
          },
          {
            name: "resistance",
            format: "Int16",
            getValue: (data: { resistance: number }) =>
              Math.round(data.resistance),
            littleEndian: true,
          },
        ],
        response: createFtmsResponse(0x05),
      },
      startOrResume: {
        bufferSize: 1,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x06,
          },
        ],
        response: createFtmsResponse(0x06),
      },
      stopOrPause: {
        bufferSize: 1,
        fields: [
          {
            name: "opCode",
            format: "Uint8",
            getValue: () => 0x07,
          },
          {
            name: "operation",
            format: "Uint8",
            getValue: (data: { operation: "stop" | "pause" }) =>
              ({ stop: 0x01, pause: 0x02 }[data.operation]),
          },
        ],
        response: createFtmsResponse(0x07),
      },
    },
  },
  0x2ad3: {
    shortId: 0x2ad3,
    id: shortIdToLongId(0x2ad3),
    name: "training_status",
    type: "notify",
    definition: [],
  },
  0x2ad6: {
    shortId: 0x2ad6,
    id: shortIdToLongId(0x2ad6),
    name: "supported_resistance_level_range",
    type: "read",
    definition: [],
  },
  0x2ad8: {
    shortId: 0x2ad8,
    id: shortIdToLongId(0x2ad8),
    name: "supported_power_range",
    type: "read",
    definition: [],
  },
  0x2ada: {
    shortId: 0x2ada,
    id: shortIdToLongId(0x2ada),
    name: "fitness_machine_status",
    type: "notify",
    definition: [],
  },
  0x2ad2: {
    shortId: 0x2ad2,
    id: shortIdToLongId(0x2ad2),
    name: "indoor_bike_data",
    type: "notify",
    definition: [
      {
        field: "flags",
        format: "Uint32",
        size: 2,
        unit: "struct",
      },
      {
        field: "instantSpeed",
        format: "Uint16",
        size: 2,
        unit: "km/h",
        modifier: 0.01,
      },
      {
        field: "averageSpeed",
        format: "Uint16",
        size: 2,
        unit: "km/h",
        modifier: 0.01,
        flag: nthBitFlag(1),
      },
      {
        field: "instantCadence",
        format: "Uint16",
        size: 2,
        unit: "rpm",
        flag: nthBitFlag(2),
        modifier: 0.5,
      },
      {
        field: "averageCadence",
        format: "Uint16",
        size: 2,
        unit: "rpm",
        flag: nthBitFlag(3),
        modifier: 0.5,
      },
      {
        field: "totalDistance",
        format: "Uint32",
        size: 4,
        unit: "m",
        flag: nthBitFlag(4),
      },
      {
        field: "resistanceLevel",
        format: "Int16",
        size: 2,
        unit: "",
        flag: nthBitFlag(5),
      },
      {
        field: "instantPower",
        format: "Int16",
        size: 2,
        unit: "w",
        flag: nthBitFlag(6),
      },
      {
        field: "averagePower",
        format: "Int16",
        size: 2,
        unit: "w",
        flag: nthBitFlag(7),
      },
      {
        field: "expendedEnergy",
        format: "Uint16",
        size: 2,
        unit: "kJ",
        flag: nthBitFlag(8),
      },
      {
        field: "heartRate",
        format: "Uint8",
        size: 1,
        unit: "bpm",
        flag: nthBitFlag(9),
      },
      {
        field: "metabolicEquivalent",
        format: "Uint8",
        size: 1,
        unit: "mets",
        flag: nthBitFlag(10),
        modifier: 0.1,
      },
      {
        field: "elapsedTime",
        format: "Uint16",
        size: 2,
        unit: "s",
        flag: nthBitFlag(11),
      },
      {
        field: "remainingTime",
        format: "Uint16",
        size: 2,
        unit: "s",
        flag: nthBitFlag(12),
      },
    ],
  },
  0x2a65: {
    shortId: 0x2a65,
    id: shortIdToLongId(0x2a65),
    name: "cycling_power_measurement",
    type: "notify",
    definition: [
      {
        field: "flags",
        format: "Uint8",
        size: 1,
        unit: "struct",
      },
      {
        field: "instantPower",
        format: "Int16",
        size: 2,
        unit: "watt",
      },
      {
        field: "pedalPowerBalance",
        format: "Uint8",
        size: 1,
        unit: "percent",
        modifier: 2,
        flag: nthBitFlag(0),
      },
      {
        field: "accumulatedTorque",
        format: "Uint16",
        size: 2,
        unit: "newton_metre",
        modifier: 32,
        flag: nthBitFlag(2),
      },
      {
        field: "cumulativeWheelRevolutions",
        format: "Uint32",
        size: 4,
        unit: "unitless",
        flag: nthBitFlag(4),
      },
      {
        field: "lastWheelEventTime",
        format: "Uint16",
        size: 2,
        unit: "second",
        modifier: 2048,
        flag: nthBitFlag(4),
      },
      {
        field: "cumulativeCrankRevolutions",
        format: "Uint16",
        size: 2,
        unit: "unitless",
        flag: nthBitFlag(5),
      },
      {
        field: "lastCrankEventTime",
        format: "Uint16",
        size: 2,
        unit: "second",
        modifier: 1024,
        flag: nthBitFlag(5),
      },
      {
        field: "maximumForceMagnitude",
        format: "Int16",
        size: 2,
        unit: "newton",
        flag: nthBitFlag(6),
      },
      {
        field: "minimumForceMagnitude",
        format: "Int16",
        size: 2,
        unit: "newton",
        flag: nthBitFlag(6),
      },
      {
        field: "maximumTorqueMagnitude",
        format: "Uint16",
        size: 2,
        unit: "newton_metre",
        modifier: 32,
        flag: nthBitFlag(7),
      },
      {
        field: "minimumTorqueMagnitude",
        format: "Uint16",
        size: 2,
        unit: "newton_metre",
        modifier: 32,
        flag: nthBitFlag(7),
      },
      {
        field: "maximumAngle",
        format: "Uint16",
        size: 1.5,
        unit: "degree",
        flag: nthBitFlag(8),
      },
      {
        field: "minimumAngle",
        format: "Uint16",
        size: 1.5,
        unit: "degree",
        flag: nthBitFlag(8),
      },
      {
        field: "topDeadSpotAngle",
        format: "Uint16",
        size: 2,
        unit: "degree",
        flag: nthBitFlag(9),
      },
      {
        field: "bottomDeadSpotAngle",
        format: "Uint16",
        size: 2,
        unit: "degree",
        flag: nthBitFlag(9),
      },
      {
        field: "accumulatedEnergy",
        format: "Uint16",
        size: 2,
        unit: "joule",
        flag: nthBitFlag(10),
      },
    ],
  },
  0x2a5b: {
    shortId: 0x2a5b,
    id: shortIdToLongId(0x2a5b),
    name: "cycling_speed_and_cadence_measurement",
    type: "notify",
    definition: [
      {
        field: "flags",
        format: "Uint8",
        size: 1,
        unit: "struct",
      },
    ],
  },
  0x2a37: {
    shortId: 0x2a37,
    id: shortIdToLongId(0x2a37),
    name: "heart_rate_measurement",
    type: "notify",
    definition: [
      {
        field: "flags",
        format: "Uint8",
        size: 1,
        unit: "struct",
      },
      {
        field: "heartRate",
        format: "Uint8",
        size: 1,
        unit: "bpm",
      },
    ],
  },
};

const gattServices: GattServiceDefinition[] = [
  {
    shortId: 0x180f,
    id: shortIdToLongId(0x180f),
    name: "battery_service",
  },
  {
    shortId: 0x1826,
    id: shortIdToLongId(0x1826),
    name: "fitness_machine",
  },
  {
    shortId: 0x1818,
    id: shortIdToLongId(0x1818),
    name: "cycling_power",
  },
  {
    shortId: 0x1816,
    id: shortIdToLongId(0x1816),
    name: "cycling_speed_and_cadence",
  },
  {
    shortId: 0x180d,
    id: shortIdToLongId(0x180d),
    name: "heart_rate",
  },
];

const createFilters = (
  definition: GattServiceDefinition[]
): BluetoothLEScanFilter[] => {
  const filters: BluetoothLEScanFilter[] = [];
  Object.values(definition).forEach((service) => {
    filters.push({
      services: [service.shortId],
    });
  });
  return filters;
};

const fitnessMachineControlPointCharacteristicId = 0x2ad9;

type DevicesState = {
  devicesById: Record<Device["id"], Device>;
  deviceIds: Device["id"][];
  isSearching: boolean;
  isBluetoothAvailable: boolean;
  valueToDeviceId: Record<
    "power" | "cadence" | "heartRate" | "speed" | "resistance",
    string | null
  >;
  resistance: number;
};

const initialState: DevicesState = {
  deviceIds: [],
  devicesById: {},
  isSearching: false,
  isBluetoothAvailable: !!(
    typeof navigator === "undefined" || "bluetooth" in navigator
  ),
  valueToDeviceId: {
    power: null,
    cadence: null,
    heartRate: null,
    speed: null,
    resistance: null,
  },
  resistance: 0,
};

const createCharacteristicChannel = (
  characteristic: BluetoothRemoteGATTCharacteristic
) => {
  return eventChannel((emitter) => {
    const onCharacteristicValueChanged = (event: Event) => {
      emitter((event.target as unknown as { value: DataView }).value);
    };

    characteristic.addEventListener(
      "characteristicvaluechanged",
      onCharacteristicValueChanged
    );

    characteristic.startNotifications();

    return () => {
      characteristic.removeEventListener(
        "characteristicvaluechanged",
        onCharacteristicValueChanged
      );

      characteristic.stopNotifications();
    };
  });
};

function* handleFitnessMachineControlPoint(
  service: BluetoothRemoteGATTService,
  actions
) {
  const fitnessMachineControlPointCharacteristic: BluetoothRemoteGATTCharacteristic =
    yield call(
      service.getCharacteristic.bind(service),
      fitnessMachineControlPointCharacteristicId
    );

  const channel = createCharacteristicChannel(
    fitnessMachineControlPointCharacteristic
  );

  yield call(
    [fitnessMachineControlPointCharacteristic, "writeValueWithResponse"],
    new DataView(new Uint8Array([0x00]).buffer)
  );

  const requestControlCommandResult = yield take(channel);

  console.log({ requestControlCommandResult });

  yield call(
    [fitnessMachineControlPointCharacteristic, "writeValueWithResponse"],
    new DataView(new Uint8Array([0x01]).buffer)
  );

  const resetCommandResult = yield take(channel);

  console.log({ resetCommandResult });

  yield takeLatest(updateResistance.type, function* handleResistanceUpdate() {
    const resistance = yield select((state) => state.devices.resistance);

    const buffer = new ArrayBuffer(18);

    const dataView = new DataView(buffer);

    dataView.setUint8(0, 0x05);

    dataView.setInt16(1, resistance, true);

    yield call(
      [fitnessMachineControlPointCharacteristic, "writeValueWithResponse"],
      dataView
    );

    const setResistanceCommandResult = yield take(channel);

    console.log({ setResistanceCommandResult });
  });
}

const valueNameToFeatureMapping = {
  instantSpeed: "speed",
  instantCadence: "cadence",
  instantPower: "power",
  heartRate: "heartRate",
  batteryLevel: "battery",
};

const formatToSize: Record<NumberFormat, number> = {
  Uint8: 1,
  Uint16: 2,
  Int8: 1,
  Int16: 2,
  Int32: 4,
  Uint32: 4,
  Float32: 4,
  Float64: 8,
};

const ftmsFeatureFlagToFeatureMapping: Record<string, string> = {
  cadenceSupported: "cadence",
  averageSpeedSupported: "speed",
  powerMeasurementSupported: "power",
};

const devicesModule = createModule({
  name,
  initialState,
  reducers: {
    startSearchingFtms: (state) => {
      state.isSearching = true;
    },
    startSearchingHrm: (state) => {
      state.isSearching = true;
    },
    startSearching: (state) => {
      state.isSearching = true;
    },
    stopSearching: (state) => {
      state.isSearching = false;
    },
    searchFailed: (state) => {
      state.isSearching = false;
    },
    deviceFound: (state, { payload: newDevice }: PayloadAction<Device>) => {
      if (state.devicesById[newDevice.id]) {
        return;
      }
      state.deviceIds.push(newDevice.id);
      state.devicesById[newDevice.id] = newDevice;
    },
    featuresFound: (
      state,
      {
        payload: { deviceId, features },
      }: PayloadAction<{
        deviceId: string;
        features: { [key: string]: boolean };
      }>
    ) => {
      const device = state.devicesById[deviceId];
      if (!device) {
        return;
      }

      const mappedFeatures = {};

      Object.entries(valueNameToFeatureMapping).forEach(
        ([valueName, featureName]) => {
          if (!features[valueName]) {
            return;
          }
          if (features[valueName] && !state.valueToDeviceId[featureName]) {
            state.valueToDeviceId[featureName] = device.id;
          }

          mappedFeatures[featureName] = true;
        }
      );

      device.features = mappedFeatures;
    },
    valuesUpdated: (
      state,
      {
        payload: { deviceId, values },
      }: PayloadAction<{
        deviceId: string;
        values: { [key: string]: number };
      }>
    ) => {
      const device = state.devicesById[deviceId];
      if (!device) {
        return;
      }

      Object.entries(valueNameToFeatureMapping).forEach(
        ([valueName, featureName]) => {
          if (!(valueName in values)) {
            return;
          }

          device.values[featureName] = values[valueName];

          if (!state.valueToDeviceId[featureName]) {
            state.valueToDeviceId[featureName] = device.id;
          }
        }
      );
    },
    updateResistance: (state, { payload }: PayloadAction<number>) => {
      state.resistance = payload;
    },
    write: (
      _state,
      _action: PayloadAction<{
        deviceId: Device["id"];
        serviceId: GattServiceDefinition["shortId"];
        command: string;
        data: Record<string, any>;
      }>
    ) => {
      // do nothing
    },
    writeFailed: (
      _state,
      _action: PayloadAction<{
        deviceId: Device["id"];
        command: string;
        error: string;
      }>
    ) => {
      // do nothing
    },
    writeSucceeded: (
      _state,
      _action: PayloadAction<{
        deviceId: Device["id"];
        command: string;
      }>
    ) => {
      // do nothing
    },
  },
  selectors: {
    devices: (state) => state.deviceIds.map((id) => state.devicesById[id]),
    isSearching: (state) => state.isSearching,
    valueToDeviceId: (state) => state.valueToDeviceId,
    resistance: (state) => state.resistance,
  },
}).withWatcher(({ actions }) => {
  return function* watcher() {
    yield takeLatest(actions.startSearching, function* handleSearch() {
      try {
        const device: BluetoothDevice = yield call(
          [navigator.bluetooth, "requestDevice"],
          {
            filters: createFilters(gattServices),
          }
        );

        const server: BluetoothRemoteGATTServer = yield call([
          device.gatt,
          "connect",
        ]);

        if (!server.connected) {
          throw new Error(`Could not connect to device: ${device.id}`);
        }

        const services: BluetoothRemoteGATTService[] = yield call([
          server,
          "getPrimaryServices",
        ]);

        yield put(
          actions.deviceFound({
            name: device.name,
            id: device.id,
            type:
              gattServices.find((service) =>
                services.find((s) => s.uuid === service.id)
              )?.name || "",
            features: {},
            values: {},
          })
        );

        yield all(
          services.map((service) =>
            call(function* handleService() {
              const serviceDescription = gattServices.find(
                (definition) => definition.id === service.uuid
              );

              if (!serviceDescription) {
                return;
              }

              const characteristics: BluetoothRemoteGATTCharacteristic[] =
                yield call([service, "getCharacteristics"]);

              yield all(
                characteristics.map((characteristic) =>
                  call(function* handleCharacteristic() {
                    const characteristicDescription =
                      characteristicsById[longIdToShortId(characteristic.uuid)];

                    if (!characteristicDescription) {
                      return;
                    }

                    function* readValues(
                      info: GattReadNotifyCharacteristicInfo,
                      data: DataView
                    ) {
                      const { definition } = info;
                      if (!definition.length) {
                        return;
                      }
                      let index = 0;
                      let offset = 0;
                      const first = definition[0];
                      let flags: number;
                      if (first.field === "flags") {
                        flags = yield call(
                          [data, `get${first.format}`],
                          offset,
                          true
                        );
                        index += 1;
                        offset += first.size;
                      }
                      const values: Record<string, number> = {};
                      for (; index < definition.length; index += 1) {
                        const {
                          field,
                          format,
                          size,
                          flag,
                          modifier = (value) => value,
                        } = definition[index];
                        if (flag && !(flags & flag)) {
                          continue;
                        }
                        const value = yield call(
                          [data, `get${format}`],
                          offset,
                          true
                        );
                        index += 1;
                        offset += size;
                        const applyModifier =
                          typeof modifier === "function"
                            ? modifier
                            : (v: number) => v * modifier;
                        values[field] = applyModifier(value);
                      }
                      if (Object.keys(values).length) {
                        yield put(
                          actions.valuesUpdated({
                            deviceId: service.device.id,
                            values,
                          })
                        );
                      }
                    }

                    try {
                      switch (characteristicDescription.type) {
                        case "read": {
                          const data = yield call([
                            characteristic,
                            "readValue",
                          ]);
                          yield call(
                            readValues,
                            characteristicDescription,
                            data
                          );
                          break;
                        }
                        case "write": {
                          const pattern = (action: AnyAction) =>
                            actions.write.match(action) &&
                            action.payload.deviceId ===
                              characteristic.service.device.id &&
                            action.payload.serviceId ===
                              serviceDescription.shortId;

                          const channel = yield call(
                            createCharacteristicChannel,
                            characteristic
                          );

                          yield takeLatest(
                            pattern,
                            function* handleWrite({
                              payload: { data, command },
                            }: ReturnType<typeof actions.write>) {
                              const commandDescription =
                                characteristicDescription.definition[command];

                              if (!commandDescription) {
                                return;
                              }

                              const buffer = new ArrayBuffer(
                                commandDescription.bufferSize
                              );

                              const dataView = new DataView(buffer);

                              let offset = 0;

                              for (
                                let index = 0;
                                index < commandDescription.fields.length;
                                index += 1
                              ) {
                                const field = commandDescription.fields[index];

                                const value = field.getValue(data);

                                dataView[`set${field.format}`](
                                  offset,
                                  value,
                                  field.littleEndian
                                );

                                offset += formatToSize[field.format];
                              }

                              const response: DataView = yield take(channel);

                              offset = 0;
                              for (
                                let index = 0;
                                index < commandDescription.response.length;
                                index += 1
                              ) {
                                const {
                                  name: responseFieldName,
                                  format,
                                  check,
                                } = commandDescription.response[index];

                                const value = yield call(
                                  [response, `get${format}`],
                                  offset,
                                  true
                                );

                                const result = check(value);

                                if (result) {
                                  yield put(
                                    actions.writeFailed({
                                      deviceId: service.device.id,
                                      command,
                                      error:
                                        typeof result === "string"
                                          ? result
                                          : `Invalid response: ${responseFieldName}`,
                                    })
                                  );
                                  return;
                                }

                                offset += formatToSize[format];
                              }
                              yield put(
                                actions.writeSucceeded({
                                  deviceId: service.device.id,
                                  command,
                                })
                              );
                            }
                          );
                          break;
                        }
                        case "notify": {
                          yield fork(function* handleNotifications() {
                            const channel: EventChannel<DataView> = yield call(
                              createCharacteristicChannel,
                              characteristic
                            );

                            yield takeLatest(
                              channel,
                              function* handleNotification(data: DataView) {
                                yield call(
                                  readValues,
                                  characteristicDescription,
                                  data
                                );
                              }
                            );
                          });
                          break;
                        }
                        default:
                          throw new Error("Unsupported characteristic type");
                      }
                    } catch (error) {
                      console.log(error);
                    }
                  })
                )
              );
            })
          )
        );
      } catch (error) {
        console.log(error);
      }
    });
  };
});

export default devicesModule;
