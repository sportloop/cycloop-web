import { PayloadAction } from "@reduxjs/toolkit";
import { put, select, take, takeLatest } from "redux-saga/effects";

import { createModule } from "remodules";
import { uid } from "uid";

import workoutLoader from "../loader/module";

import { Interval, Workout, WorkoutEditorState } from "../types";

const minPowerPercent = 5;
const maxPowerPercent = 400;
const minDuration = 10 * 1000;
export const durationStep = 5 * 1000;
export const powerStep = 5;

const emptyWorkout: Workout = {
  name: "New Workout",
  intervalsById: {},
  intervalIds: [],
  instructions: [],
};

const getDefaultInterval = (id: string): Interval => ({
  id,
  targets: {
    power: [50, 50],
  },
  duration: 5 * 60 * 1000,
});

const initialState: WorkoutEditorState = {
  workout: emptyWorkout,
  selectedIntervals: {},
  saving: false,
};

export const stickToSteps = (value: number, step: number) => {
  return Math.round(value / step) * step;
};

const getIntensityFactor = (power: number) => {
  return power / 100;
};

const getTrainingStress = (duration: number, intensity: number) => {
  return (duration * intensity ** 2) / 36;
};

const avg = (...arr: number[]) =>
  arr.reduce((acc, next) => acc + next, 0) / arr.length;

const calculateWorkingTime = (interval: Interval) => {
  // if the largest number is below 60, we're not working
  if (Math.max(...interval.targets.power) < 60) {
    return 0;
  }

  // if the smallest number is above 60, we're working the whole time
  if (Math.min(...interval.targets.power) >= 60) {
    return interval.duration;
  }

  // otherwise, we're working for a percentage of the interval
  const [min, max] = interval.targets.power;
  const { duration } = interval;

  const slope = (max - min) / duration;

  const workingTime = (60 - min) / slope;

  return workingTime;
};

// working zone is the average power spent above 60%
const calculateWorkingZone = (interval: Interval) => {
  const highestPower = Math.max(...interval.targets.power);
  const lowestPower = Math.min(...interval.targets.power);
  const bottomPower = Math.max(lowestPower, 60);

  const averagePowerAbove60 = avg(highestPower, bottomPower);

  return averagePowerAbove60;
};

const workoutEditor = createModule({
  name: "workoutEditor",
  initialState,
  reducers: {
    create: (state) => {
      state.workout = emptyWorkout;
    },
    updateName: (state, { payload }: PayloadAction<string>) => {
      state.workout.name = payload;
    },
    addInterval: {
      prepare: () => {
        return { payload: uid() };
      },
      reducer: (state, { payload: id }: PayloadAction<string>) => {
        const interval = getDefaultInterval(id);
        state.workout.intervalsById[id] = interval;
        state.workout.intervalIds.push(id);
      },
    },
    updateIntervalDuration: (
      state,
      { payload }: PayloadAction<{ id: string; duration: number }>
    ) => {
      const interval = state.workout.intervalsById[payload.id];
      if (!interval) {
        return;
      }
      interval.duration = Math.max(minDuration, payload.duration);
    },
    updateIntervalTargetPower: (
      state,
      { payload }: PayloadAction<{ id: string; power: [number, number] }>
    ) => {
      const interval = state.workout.intervalsById[payload.id];
      if (!interval) {
        return;
      }

      interval.targets.power = payload.power.map((power) =>
        Math.min(maxPowerPercent, Math.max(minPowerPercent, power))
      ) as [number, number];
    },
    selectInterval: (state, { payload: id }: PayloadAction<string>) => {
      state.selectedIntervals[id] = !state.selectedIntervals[id];
    },
    duplicateSelectedIntervals: (state) => {
      state.workout.intervalIds.forEach((id) => {
        if (!state.selectedIntervals[id]) {
          return;
        }
        const interval = state.workout.intervalsById[id];
        const newId = uid();
        state.workout.intervalsById[newId] = {
          ...interval,
          id: newId,
        };
        state.workout.intervalIds.push(newId);
      });
    },
    deleteSelectedIntervals: (state) => {
      state.workout.intervalIds.forEach((id) => {
        if (!state.selectedIntervals[id]) {
          return;
        }
        delete state.workout.intervalsById[id];
      });
      state.workout.intervalIds = state.workout.intervalIds.filter(
        (id) => !state.selectedIntervals[id]
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    save: (state, _action: PayloadAction<"mrc" | "cwo">) => {
      state.saving = true;
    },
    saveFinished: (state) => {
      state.saving = false;
    },
    load: () => {
      // todo: show something while file is loading?
    },
    loaded: (state, { payload }: PayloadAction<Workout>) => {
      state.workout = payload;
    },
  },
  selectors: {
    workout: (state) => state.workout,
    selectedIntervals: (state) => state.selectedIntervals,
    stats: (state) => {
      const intervals = state.workout.intervalIds.map(
        (id) => state.workout.intervalsById[id]
      );
      return intervals.reduce(
        (stats, next) => {
          const { targets } = next;
          const avgPower = avg(...targets.power);
          const duration = stats.duration + next.duration;
          const power =
            (stats.power * stats.duration + avgPower * next.duration) /
            duration;

          const newWorkingTime = calculateWorkingTime(next);

          stats.duration = duration;
          stats.power = power;

          if (newWorkingTime > 0) {
            const workingZone = calculateWorkingZone(next);
            const originalWorkingZoneFactor =
              stats.workingZone * stats.workingTime;
            const newWorkingZoneFactor = workingZone * newWorkingTime;
            const totalWorkingTime = stats.workingTime + newWorkingTime;
            stats.workingZone =
              (originalWorkingZoneFactor + newWorkingZoneFactor) /
              totalWorkingTime;

            stats.workingTime += newWorkingTime;
          }

          stats.intensity = getIntensityFactor(power);
          stats.trainingStress = getTrainingStress(
            stats.duration / 1000,
            stats.intensity
          );

          return stats;
        },
        {
          duration: 0,
          intensity: 0,
          trainingStress: 0,
          power: 0,
          workingZone: 0,
          workingTime: 0,
        }
      );
    },
  },
}).withWatcher(
  ({ actions, selectors }) =>
    function* watcher() {
      yield takeLatest(actions.load, function* handleLoad() {
        yield put(workoutLoader.actions.open());
        const { payload: workout } = yield take(workoutLoader.actions.opened);

        yield put(actions.loaded(workout));
      });
      yield takeLatest(actions.save, function* handleSave({ payload: format }) {
        const workout = yield select(selectors.workout);
        yield put(workoutLoader.actions.save({ format, workout }));
      });
    }
);

export default workoutEditor;
