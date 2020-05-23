import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { nanoid } from "nanoid";

import {
  createSelectorHooks,
  createActionHooks,
  createSelectors,
} from "./util";
import { average, getZoneName, zoneToColor } from "../utils";

export const getIntervalZone = (interval: Interval) =>
  getZoneName(average(interval.from, interval.to));

export const getIntervalColor = (interval: Interval) =>
  zoneToColor[getIntervalZone(interval)];

type ID = string;

export type Board = Interval[];

export type Interval = {
  id: ID;
  name: string;
  from: number;
  to: number;
  duration: number;
};

export type Section = {
  id: ID;
  name: string;
  intervals: Interval[];
  modifier: number;
};

type Workout = {
  name: string;
  intervals: Interval[];
};

export type WorkoutEditorState = {
  workout: Workout;
  sectionId: ID;
  intervalId: ID;
  sections: Section[];
  board: Board;
};

export type WorkoutStats = {
  duration: number;
  power: number;
  intensity: number;
  trainingStress: number;
  workingZone: number;
  workingTime: number;
};

export const isSection = (
  candidate: Interval | Section
): candidate is Section => {
  return "intervals" in candidate;
};

const initialState: WorkoutEditorState = {
  sections: [],
  sectionId: null,
  intervalId: null,
  workout: {
    name: "",
    intervals: [],
  },
  board: [],
};

const stateSelector = <S extends { workoutEditor: WorkoutEditorState }>(
  state: S
) => state.workoutEditor;

const workoutSelector = (state: WorkoutEditorState) => state.workout;

const createSectionSelector = (id: ID) => (state: WorkoutEditorState) => {
  if (!id) {
    return null;
  }
  return state.sections.find((section) => section.id === id);
};

const sectionSelector = (state: WorkoutEditorState) => {
  const id = state.sectionId;
  return createSectionSelector(id)(state);
};

const listSelector = (state: WorkoutEditorState) => {
  const section = sectionSelector(state);
  return section ? section.intervals : state.board;
};

const createIntervalSelector = (id: string) => (
  state: WorkoutEditorState
): Interval => {
  if (!id) {
    return null;
  }

  const list = listSelector(state);
  return list.find((item) => item.id === id) as Interval;
};

const intervalSelector = (state: WorkoutEditorState): Interval => {
  return createIntervalSelector(state.intervalId)(state);
};

const boardSelector = (state: WorkoutEditorState) => state.board;

const getIntensityFactor = (power: number, ftp: number) => {
  return power / ftp;
};

const getTrainingStress = (duration: number, intensity: number) => {
  return (duration * intensity ** 2) / 36;
};

const statsSelector = (state: WorkoutEditorState) => {
  const intervals = boardSelector(state);
  const stats: WorkoutStats = {
    duration: 0,
    intensity: 0,
    trainingStress: 0,
    power: 0,
    workingZone: 0,
    workingTime: 0,
  };
  intervals.forEach((interval) => {
    const avgZone = average(interval.from, interval.to);
    const isWorking = avgZone >= 0.6;
    const duration = stats.duration + interval.duration;
    const power =
      (stats.power * stats.duration + avgZone * interval.duration) / duration;
    stats.duration = duration;
    stats.power = power;
    if (isWorking) {
      const workingTime = stats.workingTime + interval.duration;
      stats.workingZone =
        (stats.workingZone * stats.workingTime + avgZone * interval.duration) /
        workingTime;
      stats.workingTime = workingTime;
    }
  });

  stats.intensity = getIntensityFactor(stats.power, 1);
  stats.trainingStress = getTrainingStress(stats.duration, stats.intensity);

  return stats;
};

const selectors = createSelectors(stateSelector, {
  workout: workoutSelector,
  section: sectionSelector,
  interval: intervalSelector,
  board: boardSelector,
  stats: statsSelector,
});

const createInterval = (): Interval => {
  return { id: nanoid(), name: "", from: 0.5, to: 0.5, duration: 60 };
};

const createSection = (): Section => {
  return { id: nanoid(), name: "", intervals: [], modifier: 1 };
};

const { reducer, actions } = createSlice({
  name: "workoutEditor",
  initialState,
  reducers: {
    clear: () => initialState,
    updateWorkoutName: (state, action: PayloadAction<string>) => {
      state.workout.name = action.payload;
    },
    createInterval: (state) => {
      const interval = createInterval();
      state.intervalId = interval.id;
      const list = listSelector(state);
      list.push(interval);
    },
    selectInterval: (state, action: PayloadAction<ID>) => {
      const interval = createIntervalSelector(action.payload)(state);
      if (!interval) {
        return;
      }
      state.intervalId = interval.id;
    },
    updateIntervalName: (state, action: PayloadAction<string>) => {
      const interval = intervalSelector(state);
      interval.name = action.payload;
    },
    updateIntervalFrom: (state, action: PayloadAction<number>) => {
      const interval = intervalSelector(state);
      interval.from = action.payload;
    },
    updateIntervalTo: (state, action: PayloadAction<number>) => {
      const interval = intervalSelector(state);
      interval.to = action.payload;
    },
    updateIntervalDuration: (state, action: PayloadAction<number>) => {
      const interval = intervalSelector(state);
      interval.duration = action.payload;
    },
    saveInterval: (state) => {
      state.intervalId = null;
    },
    deleteInterval: (state) => {
      if (!state.intervalId) {
        return;
      }
      const list = listSelector(state);
      const intervalIndex = list.findIndex(
        (interval) => interval.id === state.intervalId
      );
      list.splice(intervalIndex, 1);
      state.intervalId = null;
    },
    select: (state, action: PayloadAction<ID>) => {
      const interval = createIntervalSelector(action.payload)(state);
      if (interval) {
        state.intervalId = interval.id;
        return;
      }
      const section = createSectionSelector(action.payload)(state);
      if (section) {
        state.sectionId = section.id;
      }
    },
    createSection: (state) => {
      if (state.sectionId) {
        return;
      }
      const section = createSection();
      state.sectionId = section.id;
      state.sections.push(section);
    },
    addSection: (state) => {
      const section = sectionSelector(state);
      if (!section) {
        return;
      }
      state.board.push(...section.intervals);
    },
    updateSectionName: (state, action: PayloadAction<string>) => {
      const section = sectionSelector(state);
      if (!section) {
        return;
      }
      section.name = action.payload;
    },
    cancelSection: (state) => {
      state.sectionId = null;
    },
  },
});

function* saga() {
  // NOTE: workoutEditor saga
}

const hooks = {
  ...createSelectorHooks(selectors),
  ...createActionHooks(actions),
};

export { reducer, actions, saga, selectors, hooks };
