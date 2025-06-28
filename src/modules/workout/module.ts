/* eslint-disable no-underscore-dangle */
/* eslint-disable no-continue */
import beep from "@/utils/beep";
import { PayloadAction } from "@reduxjs/toolkit";
import {
  call,
  delay,
  fork,
  put,
  select,
  take,
  takeLatest,
} from "redux-saga/effects";
import { createModule } from "remodules";
import { json2xml } from "xml-js";

import { addPoint, Point, updateResistance } from "../common/actions";
import workoutLoader from "./loader/module";
import { Interval, Workout } from "./types";

type TcxWorkout = {
  _declaration: Declaration;
  TrainingCenterDatabase: TrainingCenterDatabase;
};

type TrainingCenterDatabase = {
  _attributes: TrainingCenterDatabaseAttributes;
  Activities: Activities;
};

type Activities = {
  Activity: Activity[];
};

type Activity = {
  _attributes: ActivityAttributes;
  Id: ID;
  Lap: Lap;
  Notes: Notes;
  Creator: Creator;
};

type Creator = {
  _attributes: CreatorAttributes;
  Name: ID;
};

type ID = {
  _text: string;
};

type CreatorAttributes = {
  "xsi:type": string;
};

type Lap = {
  _attributes: LapAttributes;
  TriggerMethod: ID;
  Track: Track;
};

type HeartRateBPM = {
  Value: ID;
};

type Track = {
  Trackpoint: Trackpoint[];
};

type Trackpoint = {
  Time: ID;
  DistanceMeters: ID;
  HeartRateBpm: HeartRateBPM;
  Cadence: ID;
  Extensions: Extensions;
};

type Extensions = {
  "ns3:TPX": {
    "ns3:Watts": ID;
    "ns3:Speed": ID;
  };
};

type LapAttributes = {
  StartTime: Date;
};

type Notes = Record<string, never>;

type ActivityAttributes = {
  Sport: string;
};

type TrainingCenterDatabaseAttributes = {
  "xsi:schemaLocation": string;
  "xmlns:ns5": string;
  "xmlns:ns3": string;
  "xmlns:ns2": string;
  xmlns: string;
  "xmlns:xsi": string;
  "xmlns:ns4": string;
  "xmlns:xsd": string;
};

type Declaration = {
  _attributes: DeclarationAttributes;
};

type DeclarationAttributes = {
  version: string;
  encoding: string;
};

type IntervalMeta = {
  start: number;
  end: number;
};

type WorkoutState = {
  temporaryValues: Point | null;
  points: Point[];
  startedAt: number | null;
  finishedAt: number | null;
  tcx: string | null;
  workout: Workout | null;
  intervalMetaById: { [id: Interval["id"]]: IntervalMeta };
  ftp: number | null;
  elapsedTime: number;
};

const kmh2mps = (kmh: number) => kmh / 3.6;

const createTcxWorkout = (startedAt: number, points: Point[]): TcxWorkout => {
  const tcxPoints: Trackpoint[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];

    const timestamp = new Date(point.timestamp).toISOString();
    const { heartRate, cadence, power, speed } = point;

    const speedInMps = kmh2mps(speed);

    const elapsedMs = point.timestamp - (points[index - 1]?.timestamp ?? 0);

    const distance =
      index === 0
        ? 0
        : +tcxPoints[index - 1].DistanceMeters._text +
          (speedInMps * elapsedMs) / 1000;

    tcxPoints.push({
      Time: {
        _text: timestamp,
      },
      DistanceMeters: {
        _text: `${distance}`,
      },
      HeartRateBpm: {
        Value: {
          _text: `${heartRate}`,
        },
      },
      Cadence: {
        _text: `${cadence}`,
      },
      Extensions: {
        "ns3:TPX": {
          "ns3:Watts": {
            _text: `${power}`,
          },
          "ns3:Speed": {
            _text: `${kmh2mps(speed)}`,
          },
        },
      },
    });
  }

  return {
    _declaration: {
      _attributes: {
        version: "1.0",
        encoding: "utf-8",
      },
    },
    TrainingCenterDatabase: {
      _attributes: {
        "xsi:schemaLocation":
          "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd",
        "xmlns:ns5": "http://www.garmin.com/xmlschemas/ActivityGoals/v1",
        "xmlns:ns3": "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
        "xmlns:ns2": "http://www.garmin.com/xmlschemas/UserProfile/v2",
        xmlns: "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xmlns:ns4": "http://www.garmin.com/xmlschemas/ProfileExtension/v1",
        "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
      },
      Activities: {
        Activity: [
          {
            _attributes: {
              Sport: "Biking",
            },
            Id: {
              _text: new Date(startedAt).toISOString(),
            },
            Notes: {},
            Creator: {
              _attributes: {
                "xsi:type": "Device_t",
              },
              Name: {
                _text: "cycloop",
              },
            },
            Lap: {
              _attributes: {
                StartTime: new Date(startedAt),
              },
              TriggerMethod: {
                _text: "Time",
              },
              Track: {
                Trackpoint: tcxPoints,
              },
            },
          },
        ],
      },
    },
  };
};

const initialState: WorkoutState = {
  temporaryValues: null,
  points: [],
  startedAt: null,
  finishedAt: null,
  tcx: null,
  workout: null,
  intervalMetaById: {},
  ftp: 270,
  elapsedTime: 0,
};

const isRunning = (state: WorkoutState) =>
  typeof state.startedAt !== typeof state.finishedAt;

const selectLastValues = (state: WorkoutState) => {
  return isRunning(state)
    ? state.points[state.points.length - 1]
    : state.temporaryValues;
};

const selectCurrentInterval = (state: WorkoutState) => {
  if (!state.workout || !state.startedAt) {
    return null;
  }
  for (let index = 0; index < state.workout.intervalIds.length; index += 1) {
    const intervalId = state.workout.intervalIds[index];
    const intervalMeta = state.intervalMetaById[intervalId];
    if (
      state.elapsedTime >= intervalMeta.start &&
      state.elapsedTime <= intervalMeta.end
    ) {
      return state.workout.intervalsById[intervalId];
    }
  }
  return null;
};

const selectNextInterval = (state: WorkoutState) => {
  if (!state.workout) {
    return null;
  }
  if (!state.startedAt) {
    return state.workout.intervalsById[state.workout.intervalIds[0]];
  }

  for (
    let index = 0;
    index < state.workout.intervalIds.length - 1;
    index += 1
  ) {
    const intervalId = state.workout.intervalIds[index];
    const intervalMeta = state.intervalMetaById[intervalId];
    if (
      state.elapsedTime >= intervalMeta.start &&
      state.elapsedTime <= intervalMeta.end
    ) {
      const nextId = state.workout.intervalIds[index + 1];
      return state.workout.intervalsById[nextId];
    }
  }
  return null;
};

const workoutModule = createModule({
  name: "workout",
  initialState,
  reducers: {
    start: {
      prepare: () => {
        return {
          payload: new Date().getTime(),
        };
      },
      reducer: (state, { payload }: PayloadAction<number>) => {
        state.startedAt = payload;
        state.temporaryValues = null;
      },
    },
    finish: {
      prepare: () => {
        return {
          payload: new Date().getTime(),
        };
      },
      reducer: (state, { payload }: PayloadAction<number>) => {
        state.finishedAt = payload;
      },
    },
    saveTcx: (state, { payload }: PayloadAction<string>) => {
      state.tcx = payload;
    },
    loadWorkout: () => {
      //
    },
    workoutLoaded: (state, { payload }: PayloadAction<Workout>) => {
      state.workout = payload;
      state.intervalMetaById = payload.intervalIds.reduce(
        (acc, id) => {
          acc.meta[id] = {
            start: acc.total,
            end: acc.total + payload.intervalsById[id].duration,
          };
          acc.total += payload.intervalsById[id].duration;
          return acc;
        },
        {
          total: 0,
          meta: {},
        }
      ).meta;
    },
    clearWorkout: (state) => {
      state.workout = null;
      state.intervalMetaById = {};
    },
    tick: {
      prepare: () => {
        return {
          payload: Date.now(),
        };
      },
      reducer: (state, { payload }: PayloadAction<number>) => {
        state.elapsedTime = payload - (state.startedAt ?? 0);
      },
    },
  },
  selectors: {
    isRunning: (state) => isRunning(state),
    points: (state) => state.points,
    finishedAt: (state) => state.finishedAt,
    startedAt: (state) => state.startedAt,
    lastValue: (state) => selectLastValues(state),
    tcx: (state) => state.tcx,
    totalTime: (state) => {
      if (state.startedAt && state.finishedAt) {
        return state.finishedAt - state.startedAt;
      }
      return null;
    },
    workout: (state) => state.workout,
    workoutIntervals: (state) =>
      (state.workout?.intervalIds || []).map(
        (id) => state.workout.intervalsById[id]
      ),
    ftp: (state) => state.ftp,
    currentInterval: (state) => {
      return selectCurrentInterval(state);
    },
    nextInterval: (state) => {
      return selectNextInterval(state);
    },
    elapsedTime: (state) => state.elapsedTime,
    currentPower: (state) => selectLastValues(state)?.power,
    currentSpeed: (state) => selectLastValues(state)?.speed,
    currentHeartRate: (state) => selectLastValues(state)?.heartRate,
    currentCadence: (state) => selectLastValues(state)?.cadence,
    targetPower: (state) => {
      const currentInterval = selectCurrentInterval(state);
      if (!currentInterval) {
        return null;
      }
      const startPower = currentInterval.targets.power?.at(0) ?? 0;
      const endPower = currentInterval.targets.power?.at(1) ?? 0;

      const percentIntoInterval = Math.min(
        1,
        state.elapsedTime /
          (state.intervalMetaById[currentInterval.id].end -
            state.intervalMetaById[currentInterval.id].start)
      );

      const targetPower =
        startPower + (endPower - startPower) * percentIntoInterval;

      return (targetPower * state.ftp) / 100;
    },
    nextTargetPower: (state) => {
      const nextInterval = selectNextInterval(state);
      if (!nextInterval) {
        return null;
      }
      return (nextInterval.targets.power?.at(0) ?? 0 * state.ftp) / 100;
    },
    timeUntilNextInterval: (state) => {
      const nextInterval = selectNextInterval(state);
      if (!nextInterval) {
        return null;
      }
      const nextIntervalMeta = state.intervalMetaById[nextInterval.id];
      return nextIntervalMeta.start - (state.elapsedTime || 0);
    },
    timeSinceIntervalStart: (state) => {
      const currentInterval = selectCurrentInterval(state);
      if (!currentInterval) {
        return null;
      }
      const currentIntervalMeta = state.intervalMetaById[currentInterval.id];
      return state.elapsedTime - currentIntervalMeta.start;
    },
  },
  extraReducers(builder) {
    builder.addCase(addPoint, (state, { payload: point }) => {
      const defaultValues = state.points[state.points.length - 1] || {
        heartRate: null,
        cadence: null,
        speed: null,
        power: null,
      };

      if (!isRunning(state)) {
        state.temporaryValues = {
          ...defaultValues,
          ...state.temporaryValues,
          ...point,
        };
        return;
      }

      state.points.push({ ...defaultValues, ...point });
    });
  },
}).withWatcher(({ actions, selectors }) => {
  return function* watcher() {
    yield takeLatest(actions.start, function* handleStart() {
      yield fork(function* ticker() {
        while (true) {
          yield put(actions.tick());
          yield delay(250);
        }
      });
      let lastPower = 0;
      yield takeLatest(actions.tick, function* handleTick() {
        const targetPower = yield select(selectors.targetPower);

        if (targetPower === null) {
          return;
        }

        if (lastPower !== targetPower) {
          yield put(updateResistance(targetPower));
        }

        lastPower = targetPower;
      });
    });
    yield takeLatest(actions.tick, function* beepBeep() {
      const timeUntilNext = yield select(selectors.timeUntilNextInterval);
      if (timeUntilNext && timeUntilNext <= 3000) {
        yield call(beep, [[300, 440]]);
        return;
      }
      const timeSinceIntervalStart = yield select(
        selectors.timeSinceIntervalStart
      );
      if (timeSinceIntervalStart && timeSinceIntervalStart <= 1000) {
        yield call(beep, [[300, 880]]);
      }
    });
    yield takeLatest(actions.finish, function* handleFinish() {
      const startedAt: number = yield select(selectors.startedAt);
      const points: Point[] = yield select(selectors.points);

      if (!points.length) {
        return;
      }

      const tcxWorkout = createTcxWorkout(startedAt, points);

      const xmlString = json2xml(JSON.stringify(tcxWorkout), { compact: true });

      yield put(actions.saveTcx(xmlString));
    });
    yield takeLatest(actions.loadWorkout, function* handleLoadWorkout() {
      yield put(workoutLoader.actions.open());

      const { payload: workout } = yield take(workoutLoader.actions.opened);

      yield put(actions.workoutLoaded(workout));
    });
  };
});

export default workoutModule;
