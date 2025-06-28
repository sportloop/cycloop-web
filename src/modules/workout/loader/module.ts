/* eslint-disable @typescript-eslint/no-unused-vars */
import { PayloadAction } from "@reduxjs/toolkit";
import { parse, stringify } from "mrc";
import { call, put, takeLatest } from "redux-saga/effects";
import { createModule } from "remodules";
import { uid } from "uid";

import { Interval, TextBlock, Workout } from "../types";

type CwoMeta = Partial<{
  author: Partial<{ name: string; email: string; website: string }>;
  createdAt: string;
  lastModifiedAt: string;
}>;

type CwoFile = {
  name: string;
  meta?: CwoMeta;
  intervals: Interval[];
  instructions: TextBlock[];
};

const workoutToCwo = ({
  name,
  intervalsById,
  intervalIds,
  instructions,
}: Workout): string => {
  const date = new Date().toISOString();
  return JSON.stringify({
    name,
    intervals: intervalIds.map((id) => intervalsById[id]),
    instructions,
    meta: {
      createdAt: date,
      lastModifiedAt: date,
    },
  });
};

const workoutToMrc = ({
  name,
  intervalsById,
  intervalIds,
}: Workout): string => {
  const courseData = intervalIds.reduce<[number, number][]>((acc, next) => {
    const interval = intervalsById[next];

    const {
      duration,
      targets: { power: targetPower },
    } = interval;
    const durationMinutes = duration / 1000 / 60;
    const prevEndsAt = acc[0]?.[0] ?? 0;

    acc.push(
      [prevEndsAt, targetPower.at(0)],
      [prevEndsAt + durationMinutes, targetPower.at(1)]
    );
    return acc;
  }, []);
  return stringify({
    courseHeader: {
      version: 2,
      units: "ENGLISH",
      dataTypes: ["MINUTES", "PERCENT"],
      fileName: name,
    },
    courseData,
    // todo: courseText: [],
  });
};

const mrcToWorkout = (mrc: string): Workout => {
  const { courseHeader, courseData } = parse(mrc);
  const { fileName: name } = courseHeader;
  const intervalsById: { [id: string]: Interval } = {};
  const intervalIds: string[] = [];
  const instructions: TextBlock[] = []; // todo

  const { dataTypes } = courseHeader;
  const [durationDataType, powerDataType] = dataTypes;
  if (durationDataType !== "MINUTES" || powerDataType !== "PERCENT") {
    throw new Error(
      "Non minute / percent based intervals are currently not supported"
    );
  }

  for (let index = 0; index < courseData.length; index += 2) {
    const [fromTime, fromPower] = courseData[index];
    const [toTime, toPower] = courseData[index + 1];
    const id = uid();
    const duration = (toTime - fromTime) * 60 * 1000;
    const interval: Interval = {
      id,
      targets: { power: [fromPower, toPower] },
      duration,
    };
    intervalsById[id] = interval;
    intervalIds.push(id);
  }

  return {
    name,
    intervalsById,
    intervalIds,
    instructions,
  };
};

const cwoToWorkout = ({ intervals, instructions, name }: CwoFile): Workout => {
  const workout: Workout = {
    name,
    intervalsById: {},
    intervalIds: [],
    instructions,
  };
  const intervalIds = new Set<string>();
  intervals.forEach((interval) => {
    const { id } = interval;
    if (intervalIds.has(id)) {
      throw new Error(`Duplicate interval id: ${id}`);
    }
    intervalIds.add(id);
    workout.intervalsById[id] = interval;
    workout.intervalIds.push(id);
  });
  return workout;
};

type WorkoutLoaderState = {
  loading: boolean;
};

const initialState: WorkoutLoaderState = {
  loading: false,
};

const fileSystemTypes: Record<"mrc" | "cwo", FilePickerAcceptType> = {
  mrc: {
    description: "MRC Workout File",
    accept: { "text/plain": [".mrc"] },
  },
  cwo: {
    description: "Cycloop Workout File",
    accept: { "application/json": [".cwo"] },
  },
};

const workoutLoader = createModule({
  name: "workoutLoader",
  initialState,
  reducers: {
    open: (state) => {
      state.loading = true;
    },
    opened: (state, _action: PayloadAction<Workout>) => {
      state.loading = false;
    },
    openFailed: (state) => {
      state.loading = false;
    },
    save: (
      state,
      _action: PayloadAction<{ workout: Workout; format: "mrc" | "cwo" }>
    ) => {
      state.loading = true;
    },
    saved: (state) => {
      state.loading = false;
    },
    saveFailed: (state) => {
      state.loading = false;
    },
  },
}).withWatcher(
  ({ actions }) =>
    function* watcher() {
      yield takeLatest(
        actions.save,
        function* handleSave({
          payload: { workout, format },
        }: ReturnType<typeof actions.save>) {
          console.log({ format });
          const file =
            format === "mrc" ? workoutToMrc(workout) : workoutToCwo(workout);

          try {
            const fileSystemHandle: FileSystemFileHandle = yield call(
              showSaveFilePicker,
              {
                suggestedName: workout.name,
                types: [fileSystemTypes[format]],
              }
            );

            if (!fileSystemHandle) {
              return;
            }

            const writable = yield call([fileSystemHandle, "createWritable"]);

            yield call([writable, "write"], file);

            yield call([writable, "close"]);
          } catch {
            yield put(actions.saveFailed());
          }
          yield put(actions.saved());
        }
      );
      yield takeLatest(actions.open, function* handleOpen() {
        try {
          const [fileSystemHandle]: [FileSystemFileHandle] = yield call(
            showOpenFilePicker,
            {
              types: [
                {
                  description: "Workout",
                  accept: {
                    ...fileSystemTypes.mrc.accept,
                    ...fileSystemTypes.cwo.accept,
                  },
                },
              ],
            }
          );

          if (!fileSystemHandle) {
            return;
          }

          const file: File = yield call([fileSystemHandle, "getFile"]);

          const isMrc = file.name.endsWith(".mrc");

          const content = yield call([file, "text"]);

          const workout = isMrc
            ? mrcToWorkout(content)
            : cwoToWorkout(JSON.parse(content));

          yield put(actions.opened(workout));
        } catch (error) {
          console.error({ error });
          yield put(actions.openFailed());
        }
      });
    }
);

export default workoutLoader;
