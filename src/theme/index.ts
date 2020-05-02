import { DeviceStatus } from "../modules/types";

export type ColorName =
  | "primary"
  | "secondary"
  | "accent"
  | "info"
  | "warning"
  | "error"
  | "success";

export const colors: Record<ColorName, string> = {
  primary: "#fff",
  secondary: "#aaa",
  accent: "#666",
  info: "#217fe0",
  warning: "#e09d21",
  error: "#f37979",
  success: "#5cdc5c",
};

const statusToColorName: Record<DeviceStatus, ColorName> = {
  offline: "warning",
  scanning: "info",
  found: "primary",
  active: "success",
};

export const deviceStatusToColorName = (status: DeviceStatus): ColorName =>
  statusToColorName[status];

export const deviceStatusToColor = (status: DeviceStatus) =>
  colors[deviceStatusToColorName(status)];
