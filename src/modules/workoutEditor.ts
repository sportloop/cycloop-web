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
  editSection: boolean;
  sectionsOpen: boolean;
};

export type WorkoutStats = {
  duration: number;
  power: number;
  intensity: number;
  trainingStress: number;
  workingZone: number;
  workingTime: number;
};

const initalSections: Section[] = [
  {
    id: nanoid(),
    name: "Sprint Warmup",
    intervals: [
      { name: "Warmup Ramp", id: nanoid(), from: 0.35, to: 0.55, duration: 2 },
      {
        name: "Warmup Recovery 1",
        id: nanoid(),
        from: 0.55,
        to: 0.55,
        duration: 3,
      },
      {
        name: "Warmup Sprint 1",
        id: nanoid(),
        from: 1.3,
        to: 1.3,
        duration: 0.25,
      },
      {
        name: "Warmup Recovery 2",
        id: nanoid(),
        from: 0.55,
        to: 0.55,
        duration: 0.75,
      },
      {
        name: "Warmup Sprint 2",
        id: nanoid(),
        from: 1.5,
        to: 1.5,
        duration: 0.25,
      },
      {
        name: "Warmup Recovery 3",
        id: nanoid(),
        from: 0.55,
        to: 0.55,
        duration: 0.75,
      },
      {
        name: "Warmup Sprint 3",
        id: nanoid(),
        from: 1.7,
        to: 1.7,
        duration: 0.25,
      },
      {
        name: "Warmup Recovery 4",
        id: nanoid(),
        from: 0.55,
        to: 0.55,
        duration: 0.75,
      },
    ],
    modifier: 1,
  },
  {
    id: nanoid(),
    name: "Over-under",
    intervals: [
      { name: "Under", id: nanoid(), from: 0.8, to: 0.8, duration: 1 },
      { name: "Over", id: nanoid(), from: 1.1, to: 1.1, duration: 1 },
    ],
    modifier: 1,
  },
  {
    id: nanoid(),
    name: "Over-under with Recovery",
    intervals: [
      { name: "Under", id: nanoid(), from: 0.9, to: 0.9, duration: 1 },
      { name: "Over", id: nanoid(), from: 1.15, to: 1.15, duration: 1 },
      { name: "Recovery", id: nanoid(), from: 0.4, to: 0.4, duration: 0.5 },
    ],
    modifier: 1,
  },
];

const initialState: WorkoutEditorState = {
  sections: initalSections,
  sectionId: null,
  intervalId: null,
  workout: {
    name: "",
    intervals: [],
  },
  board: [],
  editSection: false,
  sectionsOpen: false,
};

const stateSelector = <S extends { workoutEditor: WorkoutEditorState }>(
  state: S
) => state.workoutEditor;

const workoutSelector = (state: WorkoutEditorState) => state.workout;

const sectionsSelector = (state: WorkoutEditorState) => state.sections;

const createSectionSelector = (id: ID) => (state: WorkoutEditorState) => {
  if (!id) {
    return null;
  }
  return sectionsSelector(state).find((section) => section.id === id);
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

const editSectionSelector = (state: WorkoutEditorState) => {
  return state.editSection;
};

const sectionsOpenSelector = (state: WorkoutEditorState) => {
  return state.sectionsOpen;
};

const selectors = createSelectors(stateSelector, {
  workout: workoutSelector,
  section: sectionSelector,
  sections: sectionsSelector,
  interval: intervalSelector,
  board: boardSelector,
  stats: statsSelector,
  sectionEditorOpen: editSectionSelector,
  sectionsOpen: sectionsOpenSelector,
});

const createInterval = (): Interval => {
  return { id: nanoid(), name: "", from: 0.5, to: 0.5, duration: 60 };
};

const createSection = (): Section => {
  return { id: nanoid(), name: "", intervals: [], modifier: 1 };
};

const cloneIntervals = (intervals: Interval[]) => {
  return intervals.map((interval) => ({ ...interval, id: nanoid() }));
};

const cloneSection = (section: Section): Section => {
  return {
    ...section,
    id: nanoid(),
    name: section.name ? `${section.name} Copy` : undefined,
    intervals: cloneIntervals(section.intervals),
  };
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
      state.board.push(...cloneIntervals(section.intervals));
    },
    duplicateSection: (state, action: PayloadAction<ID>) => {
      const section = createSectionSelector(action.payload)(state);
      if (section) {
        const clone = cloneSection(section);
        state.sectionId = clone.id;
        state.sections.push(clone);
      }
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
    editSection: (state) => {
      if (sectionSelector(state)) {
        state.editSection = true;
      }
    },
    cancelEdit: (state) => {
      state.editSection = false;
    },
    openSections: (state) => {
      state.sectionsOpen = true;
    },
    closeSections: (state) => {
      state.sectionsOpen = false;
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
