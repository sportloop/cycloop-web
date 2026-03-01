/* eslint-disable no-continue */
/* eslint-disable no-bitwise */
import { setup, assign, sendTo, fromPromise, fromCallback, type SnapshotFrom } from "xstate";
import type { Device } from "./types";
import { type SavedDevice, loadSavedDevices, saveDevice } from "@/utils/savedDevices";
import { testDeviceSimulator, createTestDevice, TEST_DEVICE_ID } from "./testDevice";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const shortIdToLongId = (shortId: number) => {
  const hex = shortId.toString(16);
  return `0000${hex}-0000-1000-8000-00805f9b34fb`;
};

const longIdToShortId = (longId: string) => {
  const hex = longId.split("-")[0].slice(4);
  return parseInt(hex, 16);
};

const nthBitFlag = (n: number) => 1 << n;

// ---------------------------------------------------------------------------
// GATT type definitions
// ---------------------------------------------------------------------------

type NumberFormat =
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
  getValue: (data: Record<string, any>) => number;
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

// ---------------------------------------------------------------------------
// BLE constants & characteristic definitions
// ---------------------------------------------------------------------------

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

const opCodeToResponse: Record<number, string | null> = {
  0x00: "Reserved.",
  0x01: null, // "Succeeded."
  0x02: "Not supported.",
  0x03: "Incorrect parameter.",
  0x04: "Operation failed.",
  0x05: "Control is not allowed.",
};

const createFtmsResponse = (opCode: number): WriteResponse[] => [
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
          { name: "opCode", format: "Uint8", getValue: () => 0x00 },
        ],
        response: createFtmsResponse(0x00),
      },
      reset: {
        bufferSize: 1,
        fields: [
          { name: "opCode", format: "Uint8", getValue: () => 0x01 },
        ],
        response: createFtmsResponse(0x01),
      },
      setTargetSpeed: {
        bufferSize: 18,
        fields: [
          { name: "opCode", format: "Uint8", getValue: () => 0x02 },
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
          { name: "opCode", format: "Uint8", getValue: () => 0x03 },
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
          { name: "opCode", format: "Uint8", getValue: () => 0x04 },
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
          { name: "opCode", format: "Uint8", getValue: () => 0x05 },
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
          { name: "opCode", format: "Uint8", getValue: () => 0x06 },
        ],
        response: createFtmsResponse(0x06),
      },
      stopOrPause: {
        bufferSize: 1,
        fields: [
          { name: "opCode", format: "Uint8", getValue: () => 0x07 },
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
      { field: "flags", format: "Uint32", size: 2, unit: "struct" },
      { field: "instantSpeed", format: "Uint16", size: 2, unit: "km/h", modifier: 0.01 },
      { field: "averageSpeed", format: "Uint16", size: 2, unit: "km/h", modifier: 0.01, flag: nthBitFlag(1) },
      { field: "instantCadence", format: "Uint16", size: 2, unit: "rpm", flag: nthBitFlag(2), modifier: 0.5 },
      { field: "averageCadence", format: "Uint16", size: 2, unit: "rpm", flag: nthBitFlag(3), modifier: 0.5 },
      { field: "totalDistance", format: "Uint32", size: 4, unit: "m", flag: nthBitFlag(4) },
      { field: "resistanceLevel", format: "Int16", size: 2, unit: "", flag: nthBitFlag(5) },
      { field: "instantPower", format: "Int16", size: 2, unit: "w", flag: nthBitFlag(6) },
      { field: "averagePower", format: "Int16", size: 2, unit: "w", flag: nthBitFlag(7) },
      { field: "expendedEnergy", format: "Uint16", size: 2, unit: "kJ", flag: nthBitFlag(8) },
      { field: "heartRate", format: "Uint8", size: 1, unit: "bpm", flag: nthBitFlag(9) },
      { field: "metabolicEquivalent", format: "Uint8", size: 1, unit: "mets", flag: nthBitFlag(10), modifier: 0.1 },
      { field: "elapsedTime", format: "Uint16", size: 2, unit: "s", flag: nthBitFlag(11) },
      { field: "remainingTime", format: "Uint16", size: 2, unit: "s", flag: nthBitFlag(12) },
    ],
  },
  0x2a65: {
    shortId: 0x2a65,
    id: shortIdToLongId(0x2a65),
    name: "cycling_power_measurement",
    type: "notify",
    definition: [
      { field: "flags", format: "Uint8", size: 1, unit: "struct" },
      { field: "instantPower", format: "Int16", size: 2, unit: "watt" },
      { field: "pedalPowerBalance", format: "Uint8", size: 1, unit: "percent", modifier: 2, flag: nthBitFlag(0) },
      { field: "accumulatedTorque", format: "Uint16", size: 2, unit: "newton_metre", modifier: 32, flag: nthBitFlag(2) },
      { field: "cumulativeWheelRevolutions", format: "Uint32", size: 4, unit: "unitless", flag: nthBitFlag(4) },
      { field: "lastWheelEventTime", format: "Uint16", size: 2, unit: "second", modifier: 2048, flag: nthBitFlag(4) },
      { field: "cumulativeCrankRevolutions", format: "Uint16", size: 2, unit: "unitless", flag: nthBitFlag(5) },
      { field: "lastCrankEventTime", format: "Uint16", size: 2, unit: "second", modifier: 1024, flag: nthBitFlag(5) },
      { field: "maximumForceMagnitude", format: "Int16", size: 2, unit: "newton", flag: nthBitFlag(6) },
      { field: "minimumForceMagnitude", format: "Int16", size: 2, unit: "newton", flag: nthBitFlag(6) },
      { field: "maximumTorqueMagnitude", format: "Uint16", size: 2, unit: "newton_metre", modifier: 32, flag: nthBitFlag(7) },
      { field: "minimumTorqueMagnitude", format: "Uint16", size: 2, unit: "newton_metre", modifier: 32, flag: nthBitFlag(7) },
      { field: "maximumAngle", format: "Uint16", size: 1.5, unit: "degree", flag: nthBitFlag(8) },
      { field: "minimumAngle", format: "Uint16", size: 1.5, unit: "degree", flag: nthBitFlag(8) },
      { field: "topDeadSpotAngle", format: "Uint16", size: 2, unit: "degree", flag: nthBitFlag(9) },
      { field: "bottomDeadSpotAngle", format: "Uint16", size: 2, unit: "degree", flag: nthBitFlag(9) },
      { field: "accumulatedEnergy", format: "Uint16", size: 2, unit: "joule", flag: nthBitFlag(10) },
    ],
  },
  0x2a5b: {
    shortId: 0x2a5b,
    id: shortIdToLongId(0x2a5b),
    name: "cycling_speed_and_cadence_measurement",
    type: "notify",
    definition: [
      { field: "flags", format: "Uint8", size: 1, unit: "struct" },
    ],
  },
  0x2a37: {
    shortId: 0x2a37,
    id: shortIdToLongId(0x2a37),
    name: "heart_rate_measurement",
    type: "notify",
    definition: [
      { field: "flags", format: "Uint8", size: 1, unit: "struct" },
      { field: "heartRate", format: "Uint8", size: 1, unit: "bpm" },
    ],
  },
};

const gattServices: GattServiceDefinition[] = [
  { shortId: 0x180f, id: shortIdToLongId(0x180f), name: "battery_service" },
  { shortId: 0x1826, id: shortIdToLongId(0x1826), name: "fitness_machine" },
  { shortId: 0x1818, id: shortIdToLongId(0x1818), name: "cycling_power" },
  { shortId: 0x1816, id: shortIdToLongId(0x1816), name: "cycling_speed_and_cadence" },
  { shortId: 0x180d, id: shortIdToLongId(0x180d), name: "heart_rate" },
];

const createFilters = (
  definition: GattServiceDefinition[]
): BluetoothLEScanFilter[] =>
  definition.map((service) => ({ services: [service.shortId] }));

const fitnessMachineControlPointCharacteristicId = 0x2ad9;

const valueNameToFeatureMapping: Record<string, string> = {
  instantSpeed: "speed",
  instantCadence: "cadence",
  instantPower: "power",
  heartRate: "heartRate",
  batteryLevel: "battery",
};

// ---------------------------------------------------------------------------
// Data parsing (extracted from saga — battle-tested, preserved as-is)
// ---------------------------------------------------------------------------

function parseCharacteristicData(
  info: GattReadNotifyCharacteristicInfo,
  data: DataView
): Record<string, any> | null {
  const { definition } = info;
  if (!definition.length) return null;

  let index = 0;
  let offset = 0;
  let flags: number | undefined;

  const first = definition[0];
  if (first.field === "flags") {
    flags = (data as any)[`get${first.format}`](offset, true);
    index = 1;
    offset += first.size;
  }

  const values: Record<string, number> = {};
  for (; index < definition.length; index += 1) {
    const { field, format, size, flag, modifier = (v: number) => v } = definition[index];
    if (flag && flags !== undefined && !(flags & flag)) {
      continue;
    }
    const raw = (data as any)[`get${format}`](offset, true);
    offset += size;
    const applyModifier =
      typeof modifier === "function" ? modifier : (v: number) => v * modifier;
    values[field] = applyModifier(raw);
  }

  return Object.keys(values).length ? values : null;
}

// ---------------------------------------------------------------------------
// Types for the devices machine
// ---------------------------------------------------------------------------

type DevicesContext = {
  devicesById: Record<string, Device>;
  deviceIds: string[];
  isSearching: boolean;
  isBluetoothAvailable: boolean;
  valueToDeviceId: Record<
    "power" | "cadence" | "heartRate" | "speed" | "resistance",
    string | null
  >;
  resistance: number;
  savedDevices: SavedDevice[];
  /** BLE characteristic refs stored for writes — not serialisable */
  _controlPointCharacteristic: BluetoothRemoteGATTCharacteristic | null;
};

type SearchType = "ftms" | "hrm" | "all";

type DevicesEvent =
  | { type: "SEARCH_FTMS" }
  | { type: "SEARCH_HRM" }
  | { type: "SEARCH_ALL" }
  | { type: "STOP_SEARCH" }
  | { type: "SEARCH_FAILED"; error?: string }
  | { type: "DEVICE_FOUND"; device: Device }
  | {
    type: "FEATURES_FOUND";
    deviceId: string;
    features: Record<string, boolean>;
  }
  | { type: "VALUES_UPDATED"; deviceId: string; values: Record<string, number> }
  | {
    type: "CONNECTED";
    device: Device;
    controlPointCharacteristic: BluetoothRemoteGATTCharacteristic | null;
  }
  | {
    type: "WRITE_COMMAND";
    command: string;
    data?: Record<string, any>;
  }
  | { type: "UPDATE_RESISTANCE"; value: number }
  | { type: "DISCONNECT" }
  | { type: "CONNECT_TEST" }
  | { type: "RECONNECT"; deviceId: string };

// ---------------------------------------------------------------------------
// Shared GATT connection setup (used by both discovery and reconnect)
// ---------------------------------------------------------------------------

type DiscoveryResult = {
  device: Device;
  services: BluetoothRemoteGATTService[];
  controlPointCharacteristic: BluetoothRemoteGATTCharacteristic | null;
};

async function connectAndSetupGatt(
  bleDevice: BluetoothDevice
): Promise<DiscoveryResult> {
  const server = await bleDevice.gatt!.connect();
  if (!server.connected) {
    throw new Error(`Could not connect to device: ${bleDevice.id}`);
  }

  const services = await server.getPrimaryServices();

  const deviceType =
    gattServices.find((service) =>
      services.find((s) => s.uuid === service.id)
    )?.name || "";

  const device: Device = {
    name: bleDevice.name || "Unknown",
    id: bleDevice.id,
    type: deviceType,
    features: {},
    values: {},
  };

  // Find control point characteristic if available
  let controlPointCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  for (const service of services) {
    try {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (longIdToShortId(char.uuid) === fitnessMachineControlPointCharacteristicId) {
          controlPointCharacteristic = char;
        }
      }
    } catch {
      // service may not have this characteristic
    }
  }

  // Set up the FTMS control point: request control + reset
  if (controlPointCharacteristic) {
    await controlPointCharacteristic.startNotifications();

    const waitForResponse = () =>
      new Promise<DataView>((resolve) => {
        const handler = (event: Event) => {
          controlPointCharacteristic!.removeEventListener(
            "characteristicvaluechanged",
            handler
          );
          resolve((event.target as any).value as DataView);
        };
        controlPointCharacteristic!.addEventListener(
          "characteristicvaluechanged",
          handler
        );
      });

    // Request control [0x00]
    await controlPointCharacteristic.writeValueWithResponse(
      new DataView(new Uint8Array([0x00]).buffer)
    );
    const requestControlResult = await waitForResponse();
    console.log({ requestControlResult });

    // Reset [0x01]
    await controlPointCharacteristic.writeValueWithResponse(
      new DataView(new Uint8Array([0x01]).buffer)
    );
    const resetResult = await waitForResponse();
    console.log({ resetResult });
  }

  // Process characteristics: read static values, set up notifications
  for (const service of services) {
    const serviceDescription = gattServices.find(
      (def) => def.id === service.uuid
    );
    if (!serviceDescription) continue;

    try {
      const characteristics = await service.getCharacteristics();
      for (const characteristic of characteristics) {
        const charDescription =
          characteristicsById[longIdToShortId(characteristic.uuid)];
        if (!charDescription) continue;

        if (charDescription.type === "read") {
          try {
            const data = await characteristic.readValue();
            const parsed = parseCharacteristicData(
              charDescription as GattReadNotifyCharacteristicInfo,
              data
            );
            if (parsed) {
              if (charDescription.name === "fitness_machine_feature") {
                device.features = {};
                const fmFeatures = parsed.fitnessMachineFeature;
                if (fmFeatures && typeof fmFeatures === "object") {
                  Object.entries(valueNameToFeatureMapping).forEach(
                    ([, featureName]) => {
                      const ftmsKey = Object.keys(
                        fmFeatures
                      ).find((k) =>
                        k.toLowerCase().includes(featureName.toLowerCase())
                      );
                      if (ftmsKey && fmFeatures[ftmsKey]) {
                        device.features[featureName] = true;
                      }
                    }
                  );
                }
              } else {
                Object.entries(valueNameToFeatureMapping).forEach(
                  ([valueName, featureName]) => {
                    if (valueName in parsed) {
                      device.values[featureName] = parsed[valueName];
                    }
                  }
                );
              }
            }
          } catch {
            // read may fail for some characteristics
          }
        }
      }
    } catch {
      // service may not be accessible
    }
  }

  return { device, services, controlPointCharacteristic };
}

// ---------------------------------------------------------------------------
// Actor: BLE discovery (user-initiated device picker)
// ---------------------------------------------------------------------------

type DiscoveryInput = { searchType: SearchType };

const bleDiscovery = fromPromise<DiscoveryResult, DiscoveryInput>(
  async ({ input }) => {
    const filtersForType: Record<SearchType, GattServiceDefinition[]> = {
      ftms: gattServices.filter((s) =>
        ["fitness_machine", "cycling_power", "cycling_speed_and_cadence", "battery_service"].includes(s.name)
      ),
      hrm: gattServices.filter((s) =>
        ["heart_rate", "battery_service"].includes(s.name)
      ),
      all: gattServices,
    };

    const serviceDefinitions = filtersForType[input.searchType];

    const bleDevice: BluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: createFilters(serviceDefinitions),
      optionalServices: serviceDefinitions.map((s) => s.shortId),
    });

    return connectAndSetupGatt(bleDevice);
  }
);

// ---------------------------------------------------------------------------
// Actor: BLE reconnection (programmatic, no picker)
// ---------------------------------------------------------------------------

const bleReconnect = fromPromise<DiscoveryResult, { deviceId: string }>(
  async ({ input }) => {
    const getDevices = (navigator.bluetooth as any).getDevices as
      | (() => Promise<BluetoothDevice[]>)
      | undefined;
    if (!getDevices) {
      throw new Error("getDevices() not supported in this browser");
    }

    const devices: BluetoothDevice[] = await getDevices.call(navigator.bluetooth);
    const bleDevice = devices.find((d) => d.id === input.deviceId);
    if (!bleDevice) {
      throw new Error("Device not available");
    }

    return connectAndSetupGatt(bleDevice);
  }
);

// ---------------------------------------------------------------------------
// Actor: check saved devices availability on startup
// ---------------------------------------------------------------------------

const checkSavedDevices = fromPromise<SavedDevice[]>(async () => {
  const saved = loadSavedDevices();
  if (saved.length === 0) return [];

  const getDevices = (navigator.bluetooth as any)?.getDevices as
    | (() => Promise<BluetoothDevice[]>)
    | undefined;
  if (!getDevices) return saved;

  try {
    const available: BluetoothDevice[] = await getDevices.call(navigator.bluetooth);
    const availableIds = new Set(available.map((d) => d.id));
    return saved.filter((d) => availableIds.has(d.id));
  } catch {
    return saved;
  }
});

// ---------------------------------------------------------------------------
// Actor: characteristic notification listener (replaces saga event channels)
// ---------------------------------------------------------------------------

type CharacteristicListenerInput = {
  services: BluetoothRemoteGATTService[];
  deviceId: string;
};

const characteristicListener = fromCallback<
  DevicesEvent,
  CharacteristicListenerInput
>(({ sendBack, input }) => {
  const { services, deviceId } = input;
  const cleanupFns: (() => void)[] = [];

  const setupNotifications = async () => {
    for (const service of services) {
      const serviceDescription = gattServices.find(
        (def) => def.id === service.uuid
      );
      if (!serviceDescription) continue;

      try {
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
          const shortId = longIdToShortId(characteristic.uuid);
          const charDescription = characteristicsById[shortId];
          if (!charDescription) continue;

          // Skip the control point — handled separately
          if (shortId === fitnessMachineControlPointCharacteristicId) continue;

          if (charDescription.type === "notify") {
            const info = charDescription as GattReadNotifyCharacteristicInfo;

            const onValueChanged = (event: Event) => {
              const dataView = (event.target as any).value as DataView;
              const parsed = parseCharacteristicData(info, dataView);
              if (parsed) {
                // Check for features
                const features: Record<string, boolean> = {};
                let hasFeatures = false;
                Object.entries(valueNameToFeatureMapping).forEach(
                  ([valueName, featureName]) => {
                    if (valueName in parsed) {
                      features[featureName] = true;
                      hasFeatures = true;
                    }
                  }
                );
                if (hasFeatures) {
                  sendBack({
                    type: "FEATURES_FOUND",
                    deviceId,
                    features,
                  });
                }

                sendBack({
                  type: "VALUES_UPDATED",
                  deviceId,
                  values: parsed,
                });
              }
            };

            characteristic.addEventListener(
              "characteristicvaluechanged",
              onValueChanged
            );

            await characteristic.startNotifications();

            cleanupFns.push(() => {
              characteristic.removeEventListener(
                "characteristicvaluechanged",
                onValueChanged
              );
              characteristic.stopNotifications().catch(() => { });
            });
          }
        }
      } catch (error) {
        console.log("Error setting up notifications for service:", error);
      }
    }
  };

  setupNotifications().catch((error) => {
    console.log("Error in characteristic listener setup:", error);
  });

  return () => {
    cleanupFns.forEach((fn) => fn());
  };
});

// ---------------------------------------------------------------------------
// Actor: BLE write command
// ---------------------------------------------------------------------------

type WriteCommandInput = {
  characteristic: BluetoothRemoteGATTCharacteristic;
  command: string;
  data?: Record<string, any>;
};

const bleWrite = fromPromise<void, WriteCommandInput>(async ({ input }) => {
  const { characteristic, command, data = {} } = input;
  const charDescription = characteristicsById[
    fitnessMachineControlPointCharacteristicId
  ] as GattWriteCharacteristicInfo;
  const commandDescription = charDescription.definition[command];

  if (!commandDescription) {
    throw new Error(`Unknown command: ${command}`);
  }

  const buffer = new ArrayBuffer(commandDescription.bufferSize);
  const dataView = new DataView(buffer);

  let offset = 0;
  for (const field of commandDescription.fields) {
    const value = field.getValue(data);
    (dataView as any)[`set${field.format}`](offset, value, field.littleEndian);
    offset += formatToSize[field.format];
  }

  // Listen for the response
  const responsePromise = new Promise<DataView>((resolve) => {
    const handler = (event: Event) => {
      characteristic.removeEventListener("characteristicvaluechanged", handler);
      resolve((event.target as any).value as DataView);
    };
    characteristic.addEventListener("characteristicvaluechanged", handler);
  });

  await characteristic.writeValueWithResponse(dataView);
  const response = await responsePromise;

  // Validate response
  offset = 0;
  for (const responseDef of commandDescription.response) {
    const value = (response as any)[`get${responseDef.format}`](offset, true);
    const result = responseDef.check(value);
    if (result) {
      throw new Error(
        typeof result === "string"
          ? result
          : `Invalid response: ${responseDef.name}`
      );
    }
    offset += formatToSize[responseDef.format];
  }
});

// ---------------------------------------------------------------------------
// The devices machine
// ---------------------------------------------------------------------------

export const devicesMachine = setup({
  types: {
    context: {} as DevicesContext,
    events: {} as DevicesEvent,
  },
  actors: {
    bleDiscovery,
    bleReconnect,
    characteristicListener,
    bleWrite,
    testDeviceSimulator,
    checkSavedDevices,
  },
  actions: {
    addDevice: assign({
      devicesById: ({ context }, { device }: { device: Device }) => {
        if (context.devicesById[device.id]) return context.devicesById;
        return { ...context.devicesById, [device.id]: device };
      },
      deviceIds: ({ context }, { device }: { device: Device }) => {
        if (context.devicesById[device.id]) return context.deviceIds;
        return [...context.deviceIds, device.id];
      },
    }),
    updateFeatures: assign({
      devicesById: (
        { context },
        { deviceId, features }: { deviceId: string; features: Record<string, boolean> }
      ) => {
        const device = context.devicesById[deviceId];
        if (!device) return context.devicesById;
        return {
          ...context.devicesById,
          [deviceId]: {
            ...device,
            features: { ...device.features, ...features },
          },
        };
      },
      valueToDeviceId: (
        { context },
        { deviceId, features }: { deviceId: string; features: Record<string, boolean> }
      ) => {
        const updated = { ...context.valueToDeviceId };
        Object.entries(features).forEach(([featureName, supported]) => {
          if (
            supported &&
            featureName in updated &&
            !updated[featureName as keyof typeof updated]
          ) {
            (updated as any)[featureName] = deviceId;
          }
        });
        return updated;
      },
    }),
    updateValues: assign({
      devicesById: (
        { context },
        { deviceId, values }: { deviceId: string; values: Record<string, number> }
      ) => {
        const device = context.devicesById[deviceId];
        if (!device) return context.devicesById;
        const updatedValues = { ...device.values };
        Object.entries(valueNameToFeatureMapping).forEach(
          ([valueName, featureName]) => {
            if (valueName in values) {
              updatedValues[featureName] = values[valueName];
            }
          }
        );
        return {
          ...context.devicesById,
          [deviceId]: { ...device, values: updatedValues },
        };
      },
      valueToDeviceId: (
        { context },
        { deviceId, values }: { deviceId: string; values: Record<string, number> }
      ) => {
        const updated = { ...context.valueToDeviceId };
        Object.entries(valueNameToFeatureMapping).forEach(
          ([valueName, featureName]) => {
            if (
              valueName in values &&
              featureName in updated &&
              !updated[featureName as keyof typeof updated]
            ) {
              (updated as any)[featureName] = deviceId;
            }
          }
        );
        return updated;
      },
    }),
  },
}).createMachine({
  id: "devices",
  context: {
    deviceIds: [],
    devicesById: {},
    isSearching: false,
    isBluetoothAvailable:
      typeof navigator === "undefined" || "bluetooth" in navigator,
    valueToDeviceId: {
      power: null,
      cadence: null,
      heartRate: null,
      speed: null,
      resistance: null,
    },
    resistance: 0,
    savedDevices: [],
    _controlPointCharacteristic: null,
  },
  initial: "starting",
  states: {
    starting: {
      invoke: {
        src: "checkSavedDevices",
        onDone: {
          target: "idle",
          actions: assign({
            savedDevices: ({ event }) => event.output,
          }),
        },
        onError: "idle",
      },
    },
    idle: {
      on: {
        SEARCH_FTMS: { target: "searching", actions: assign({ isSearching: true }) },
        SEARCH_HRM: { target: "searching", actions: assign({ isSearching: true }) },
        SEARCH_ALL: { target: "searching", actions: assign({ isSearching: true }) },
        CONNECT_TEST: {
          target: "testConnected",
          actions: {
            type: "addDevice",
            params: () => ({ device: createTestDevice() }),
          },
        },
        RECONNECT: {
          target: "reconnecting",
          actions: assign({ isSearching: true }),
        },
      },
    },
    searching: {
      invoke: {
        id: "bleDiscovery",
        src: "bleDiscovery",
        input: ({ event }) => ({
          searchType: (
            {
              SEARCH_FTMS: "ftms",
              SEARCH_HRM: "hrm",
              SEARCH_ALL: "all",
            } as const
          )[event.type as "SEARCH_FTMS" | "SEARCH_HRM" | "SEARCH_ALL"] || "all",
        }),
        onDone: {
          target: "connected",
          actions: [
            {
              type: "addDevice",
              params: ({ event }) => ({ device: event.output.device }),
            },
            assign({
              isSearching: false,
              _controlPointCharacteristic: ({ event }) =>
                event.output.controlPointCharacteristic,
            }),
            ({ event }) => {
              const { device } = (event as any).output as DiscoveryResult;
              saveDevice({ id: device.id, name: device.name, type: device.type });
            },
          ],
        },
        onError: {
          target: "idle",
          actions: assign({ isSearching: false }),
        },
      },
      on: {
        STOP_SEARCH: {
          target: "idle",
          actions: assign({ isSearching: false }),
        },
      },
    },
    reconnecting: {
      invoke: {
        id: "bleReconnect",
        src: "bleReconnect",
        input: ({ event }) => ({
          deviceId: (event as { type: "RECONNECT"; deviceId: string }).deviceId,
        }),
        onDone: {
          target: "connected",
          actions: [
            {
              type: "addDevice",
              params: ({ event }) => ({ device: event.output.device }),
            },
            assign({
              isSearching: false,
              _controlPointCharacteristic: ({ event }) =>
                event.output.controlPointCharacteristic,
            }),
          ],
        },
        onError: {
          target: "idle",
          actions: assign({ isSearching: false }),
        },
      },
    },
    connected: {
      invoke: {
        id: "characteristicListener",
        src: "characteristicListener",
        input: ({ event }) => {
          // The event here is the done event from bleDiscovery or bleReconnect
          const output = (event as any).output as DiscoveryResult;
          return {
            services: output.services,
            deviceId: output.device.id,
          };
        },
      },
      on: {
        VALUES_UPDATED: {
          actions: {
            type: "updateValues",
            params: ({ event }) => ({
              deviceId: event.deviceId,
              values: event.values,
            }),
          },
        },
        FEATURES_FOUND: {
          actions: {
            type: "updateFeatures",
            params: ({ event }) => ({
              deviceId: event.deviceId,
              features: event.features,
            }),
          },
        },
        WRITE_COMMAND: {
          actions: ({ context, event }) => {
            const char = context._controlPointCharacteristic;
            if (!char) {
              console.log("No control point characteristic available for write");
              return;
            }

            const charDescription = characteristicsById[
              fitnessMachineControlPointCharacteristicId
            ] as GattWriteCharacteristicInfo;
            const commandDescription =
              charDescription.definition[event.command];
            if (!commandDescription) {
              console.log(`Unknown command: ${event.command}`);
              return;
            }

            const buffer = new ArrayBuffer(commandDescription.bufferSize);
            const dataView = new DataView(buffer);

            let offset = 0;
            for (const field of commandDescription.fields) {
              const value = field.getValue(event.data || {});
              (dataView as any)[`set${field.format}`](
                offset,
                value,
                field.littleEndian
              );
              offset += formatToSize[field.format];
            }

            char.writeValueWithResponse(dataView).catch((error) => {
              console.log("Write failed:", error);
            });
          },
        },
        UPDATE_RESISTANCE: {
          actions: [
            assign({
              resistance: ({ event }) => event.value,
            }),
            ({ context, event }) => {
              const char = context._controlPointCharacteristic;
              if (!char) return;

              const buffer = new ArrayBuffer(18);
              const dataView = new DataView(buffer);
              dataView.setUint8(0, 0x05);
              dataView.setInt16(1, event.value, true);

              char.writeValueWithResponse(dataView).catch((error) => {
                console.log("Resistance write failed:", error);
              });
            },
          ],
        },
        DISCONNECT: {
          target: "idle",
          actions: assign({
            _controlPointCharacteristic: null,
          }),
        },
      },
    },
    testConnected: {
      invoke: {
        id: "testDeviceSimulator",
        src: "testDeviceSimulator",
      },
      on: {
        VALUES_UPDATED: {
          actions: {
            type: "updateValues",
            params: ({ event }) => ({
              deviceId: event.deviceId,
              values: event.values,
            }),
          },
        },
        FEATURES_FOUND: {
          actions: {
            type: "updateFeatures",
            params: ({ event }) => ({
              deviceId: event.deviceId,
              features: event.features,
            }),
          },
        },
        WRITE_COMMAND: {
          actions: sendTo("testDeviceSimulator", ({ event }) => ({
            type: "SET_RESISTANCE",
            value:
              (event as any).value ??
              event.data?.targetResistanceLevel ??
              event.data?.resistance ??
              0,
          })),
        },
        UPDATE_RESISTANCE: {
          actions: [
            assign({
              resistance: ({ event }) => event.value,
            }),
            sendTo("testDeviceSimulator", ({ event }) => ({
              type: "SET_RESISTANCE",
              value: event.value,
            })),
          ],
        },
        DISCONNECT: {
          target: "idle",
        },
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Selectors (take machine snapshot, return derived values)
// ---------------------------------------------------------------------------

type DevicesSnapshot = SnapshotFrom<typeof devicesMachine>;

export const selectDevices = (snapshot: DevicesSnapshot): Device[] =>
  snapshot.context.deviceIds.map((id) => snapshot.context.devicesById[id]);

export const selectIsSearching = (snapshot: DevicesSnapshot): boolean =>
  snapshot.context.isSearching;

export const selectValueToDeviceId = (
  snapshot: DevicesSnapshot
): Record<"power" | "cadence" | "heartRate" | "speed" | "resistance", string | null> =>
  snapshot.context.valueToDeviceId;

export const selectResistance = (snapshot: DevicesSnapshot): number =>
  snapshot.context.resistance;

export const selectSavedDevices = (snapshot: DevicesSnapshot): SavedDevice[] =>
  snapshot.context.savedDevices.filter(
    (saved) => !snapshot.context.devicesById[saved.id]
  );

export const selectShowTestDevice = (snapshot: DevicesSnapshot): boolean =>
  process.env.NODE_ENV !== "production" &&
  !snapshot.context.devicesById[TEST_DEVICE_ID];
