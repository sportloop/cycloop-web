import { createAction } from "@reduxjs/toolkit";

const name = "common";

export type Point = {
  timestamp: number;
  heartRate: number;
  cadence: number;
  power: number;
  speed: number;
};

// eslint-disable-next-line import/prefer-default-export
export const addPoint = createAction(
  `${name}/addPoint`,
  (point: Partial<Point>) => ({
    payload: { ...point, timestamp: Date.now() },
  })
);

export const updateResistance = createAction<number>(
  `${name}/updateResistance`
);
