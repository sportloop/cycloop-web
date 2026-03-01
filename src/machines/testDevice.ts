import { fromCallback } from "xstate";
import type { Device } from "./types";

export const TEST_DEVICE_ID = "test-device-001";
export const TEST_DEVICE_NAME = "TEST Trainer";

const MAX_POWER = 500;
const MAX_SPEED = 65;
const MIN_HR = 35;
const MAX_HR = 220;
const POWER_NOISE = 0.002; // 0.2%
const HR_SMOOTHING = 0.05;

export type TestDeviceState = {
  resistance: number;
  power: number;
  speed: number;
  heartRate: number;
  cadence: number;
};

export function createTestDevice(): Device {
  return {
    id: TEST_DEVICE_ID,
    name: TEST_DEVICE_NAME,
    type: "fitness_machine",
    features: {
      speed: true,
      cadence: true,
      power: true,
      heartRate: true,
    },
    values: {},
  };
}

export const testDeviceSimulator = fromCallback(
  ({ sendBack, receive }: { sendBack: (event: any) => void; receive: (cb: (event: any) => void) => void }) => {
    const state: TestDeviceState = {
      resistance: 0,
      power: 0,
      speed: 0,
      heartRate: MIN_HR,
      cadence: 0,
    };

    // Expose on window for devtools manipulation
    (window as any).__testDevice = state;

    receive((event: any) => {
      if (event.type === "SET_RESISTANCE") {
        state.resistance = event.value;
      }
    });

    // Announce features immediately
    sendBack({
      type: "FEATURES_FOUND",
      deviceId: TEST_DEVICE_ID,
      features: { speed: true, cadence: true, power: true, heartRate: true },
    });

    const interval = setInterval(() => {
      const effort = Math.min(1, Math.max(0, state.resistance / MAX_POWER));

      // Power: based on resistance target with 2% random deviance
      const noise = 1 + (Math.random() - 0.5) * 20 * POWER_NOISE;
      state.power = Math.max(0, Math.round(state.resistance * noise));

      // Speed: proportional to effort, 0 km/h -> 65 km/h
      state.speed = Math.round(effort * MAX_SPEED * 100) / 100;

      // HR: semi-proportional to effort, smoothed (gradual ramp)
      const targetHr = MIN_HR + effort * (MAX_HR - MIN_HR);
      state.heartRate = Math.round(
        state.heartRate + (targetHr - state.heartRate) * HR_SMOOTHING
      );
      state.heartRate = Math.max(MIN_HR, Math.min(MAX_HR, state.heartRate));

      // Cadence: proportional to effort, 0-120 RPM
      state.cadence = Math.round(effort * 120);

      sendBack({
        type: "VALUES_UPDATED",
        deviceId: TEST_DEVICE_ID,
        values: {
          instantPower: state.power,
          instantSpeed: state.speed,
          heartRate: state.heartRate,
          instantCadence: state.cadence,
        },
      });
    }, 250);

    return () => {
      clearInterval(interval);
      delete (window as any).__testDevice;
    };
  }
);
