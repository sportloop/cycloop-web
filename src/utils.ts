export type ZoneName =
  | "recovery"
  | "endurance"
  | "tempo"
  | "threshold"
  | "vo2max"
  | "anaerobic";

// eslint-disable-next-line consistent-return
export const getZoneName = (percentage: number): ZoneName => {
  // eslint-disable-next-line default-case
  switch (true) {
    case percentage <= 0.6:
      return "recovery";
    case percentage <= 0.75:
      return "endurance";
    case percentage <= 0.89:
      return "tempo";
    case percentage <= 1.04:
      return "threshold";
    case percentage <= 1.18:
      return "vo2max";
    case percentage > 1.18:
      return "anaerobic";
  }
};

export const average = (...numbers: number[]) => {
  return numbers.reduce((acc, number) => acc + number, 0) / numbers.length;
};

export const capitalise = (str: string) => {
  return str[0].toUpperCase() + str.slice(1);
};

export const zoneToColor = {
  recovery: "#dae4ee",
  endurance: "#a0cdff",
  tempo: "#a3f2a3",
  threshold: "#f2f286",
  vo2max: "#e7ae8e",
  anaerobic: "#e78888",
};
export const zoneColor = (zone: number) => {
  return zoneToColor[getZoneName(zone)];
};
