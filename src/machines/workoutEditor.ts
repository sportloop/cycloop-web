import { assign, fromPromise, setup } from "xstate";
import { parse, stringify } from "mrc";
import { uid } from "uid";

import type { Interval, TextBlock, Workout } from "./types";
import isomorphicLocalStorage from "@/utils/isomorphicLocalStorage";
import { woToWorkout } from "@/modules/workout/parser";

// --- localStorage persistence ---

const EDITOR_STORAGE_KEY = "cycloop:editor-workout";

export const saveEditorWorkout = (workout: Workout) => {
  try {
    isomorphicLocalStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(workout));
  } catch {
    // quota exceeded or unavailable — ignore
  }
};

export const loadEditorWorkout = (): Workout | null => {
  try {
    const raw = isomorphicLocalStorage.getItem(EDITOR_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Workout;
  } catch {
    return null;
  }
};

// --- Constants ---

const minPowerPercent = 5;
const maxPowerPercent = 400;
const minDuration = 10 * 1000;
export const durationStep = 5 * 1000;
export const powerStep = 5;

export const stickToSteps = (value: number, step: number) =>
  Math.round(value / step) * step;

// --- Empty / default factories ---

const emptyWorkout: Workout = {
  name: "New Workout",
  intervalsById: {},
  intervalIds: [],
  instructions: [],
};

const getDefaultInterval = (id: string): Interval => ({
  id,
  targets: { power: [50, 50] },
  duration: 5 * 60 * 1000,
});

// --- Format converters (pure functions) ---

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

export const workoutToCwo = ({
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

export const workoutToMrc = ({
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
      [prevEndsAt, targetPower!.at(0)!],
      [prevEndsAt + durationMinutes, targetPower!.at(1)!]
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
  });
};

export const mrcToWorkout = (mrc: string): Workout => {
  const { courseHeader, courseData } = parse(mrc);
  const { fileName: name } = courseHeader;
  const intervalsById: { [id: string]: Interval } = {};
  const intervalIds: string[] = [];
  const instructions: TextBlock[] = [];

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

  return { name, intervalsById, intervalIds, instructions };
};

export const cwoToWorkout = ({
  intervals,
  instructions,
  name,
}: CwoFile): Workout => {
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

// --- File System Access API types ---

const fileSystemTypes: Record<"mrc" | "cwo" | "wo", FilePickerAcceptType> = {
  mrc: {
    description: "MRC Workout File",
    accept: { "text/plain": [".mrc"] },
  },
  cwo: {
    description: "Cycloop Workout File",
    accept: { "application/json": [".cwo"] },
  },
  wo: {
    description: "WO Workout File",
    accept: { "text/plain": [".wo"] },
  },
};

// --- Stats selector ---

const avg = (...arr: number[]) =>
  arr.reduce((acc, next) => acc + next, 0) / arr.length;

const getIntensityFactor = (power: number) => power / 100;

const getTrainingStress = (duration: number, intensity: number) =>
  (duration * intensity ** 2) / 36;

const calculateWorkingTime = (interval: Interval) => {
  const power = interval.targets.power!;
  if (Math.max(...power) < 60) return 0;
  if (Math.min(...power) >= 60) return interval.duration;

  const [min, max] = power;
  const slope = (max - min) / interval.duration;
  return (60 - min) / slope;
};

const calculateWorkingZone = (interval: Interval) => {
  const power = interval.targets.power!;
  const highestPower = Math.max(...power);
  const lowestPower = Math.min(...power);
  const bottomPower = Math.max(lowestPower, 60);
  return avg(highestPower, bottomPower);
};

export type WorkoutStats = {
  duration: number;
  intensity: number;
  trainingStress: number;
  power: number;
  workingZone: number;
  workingTime: number;
};

export const selectStats = (workout: Workout): WorkoutStats => {
  const intervals = workout.intervalIds.map((id) => workout.intervalsById[id]);
  return intervals.reduce<WorkoutStats>(
    (stats, next) => {
      const { targets } = next;
      const avgPower = avg(...targets.power!);
      const duration = stats.duration + next.duration;
      const power =
        (stats.power * stats.duration + avgPower * next.duration) / duration;

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
          (originalWorkingZoneFactor + newWorkingZoneFactor) / totalWorkingTime;
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
};

// --- Machine ---

type WorkoutEditorContext = {
  workout: Workout;
  selectedIntervals: Record<string, boolean>;
};

type WorkoutEditorEvents =
  | { type: "ADD_INTERVAL" }
  | { type: "UPDATE_INTERVAL_DURATION"; id: string; duration: number }
  | { type: "UPDATE_INTERVAL_POWER"; id: string; power: [number, number] }
  | { type: "SELECT_INTERVAL"; id: string; additive?: boolean }
  | { type: "CLEAR_SELECTION" }
  | { type: "DUPLICATE_SELECTED" }
  | { type: "DELETE_SELECTED" }
  | { type: "UPDATE_NAME"; name: string }
  | { type: "SAVE"; format: "mrc" | "cwo" }
  | { type: "LOAD" }
  | { type: "LOAD_PRESET"; workout: Workout }
  | { type: "CREATE" };

export const workoutEditorMachine = setup({
  types: {
    context: {} as WorkoutEditorContext,
    events: {} as WorkoutEditorEvents,
  },
  actions: {
    persistWorkout: ({ context }) => {
      saveEditorWorkout(context.workout);
    },
  },
  actors: {
    saveWorkout: fromPromise(
      async ({
        input,
      }: {
        input: { workout: Workout; format: "mrc" | "cwo" };
      }) => {
        const { workout, format } = input;
        const file =
          format === "mrc" ? workoutToMrc(workout) : workoutToCwo(workout);

        const fileSystemHandle = await showSaveFilePicker({
          suggestedName: workout.name,
          types: [fileSystemTypes[format]],
        });

        const writable = await fileSystemHandle.createWritable();
        await writable.write(file);
        await writable.close();
      }
    ),
    loadWorkout: fromPromise(async () => {
      const [fileSystemHandle] = await showOpenFilePicker({
        types: [
          {
            description: "Workout",
            accept: {
              ...fileSystemTypes.mrc.accept,
              ...fileSystemTypes.cwo.accept,
              ...fileSystemTypes.wo.accept,
            },
          },
        ],
      });

      const file = await fileSystemHandle.getFile();
      const content = await file.text();

      if (file.name.endsWith(".wo")) return woToWorkout(content);
      if (file.name.endsWith(".mrc")) return mrcToWorkout(content);
      return cwoToWorkout(JSON.parse(content));
    }),
  },
}).createMachine({
  id: "workoutEditor",
  context: {
    workout: emptyWorkout,
    selectedIntervals: {},
  },
  initial: "editing",
  states: {
    editing: {
      on: {
        CREATE: {
          actions: [
            assign({
              workout: () => ({ ...emptyWorkout }),
              selectedIntervals: () => ({}),
            }),
            "persistWorkout",
          ],
        },
        ADD_INTERVAL: {
          actions: [
            assign({
              workout: ({ context }) => {
                const id = uid();
                const interval = getDefaultInterval(id);
                return {
                  ...context.workout,
                  intervalsById: {
                    ...context.workout.intervalsById,
                    [id]: interval,
                  },
                  intervalIds: [...context.workout.intervalIds, id],
                };
              },
            }),
            "persistWorkout",
          ],
        },
        UPDATE_INTERVAL_DURATION: {
          actions: [
            assign({
              workout: ({ context, event }) => {
                const interval = context.workout.intervalsById[event.id];
                if (!interval) return context.workout;
                return {
                  ...context.workout,
                  intervalsById: {
                    ...context.workout.intervalsById,
                    [event.id]: {
                      ...interval,
                      duration: Math.max(minDuration, event.duration),
                    },
                  },
                };
              },
            }),
            "persistWorkout",
          ],
        },
        UPDATE_INTERVAL_POWER: {
          actions: [
            assign({
              workout: ({ context, event }) => {
                const interval = context.workout.intervalsById[event.id];
                if (!interval) return context.workout;
                return {
                  ...context.workout,
                  intervalsById: {
                    ...context.workout.intervalsById,
                    [event.id]: {
                      ...interval,
                      targets: {
                        ...interval.targets,
                        power: event.power.map((p) =>
                          Math.min(maxPowerPercent, Math.max(minPowerPercent, p))
                        ) as [number, number],
                      },
                    },
                  },
                };
              }
            }),
            "persistWorkout",
          ],
        },
        SELECT_INTERVAL: {
          actions: assign({
            selectedIntervals: ({ context, event }) => {
              if (event.additive) {
                // Shift+click: toggle this interval, keep the rest
                const next = { ...context.selectedIntervals };
                if (next[event.id]) {
                  delete next[event.id];
                } else {
                  next[event.id] = true;
                }
                return next;
              }
              // Normal click: exclusive selection
              return { [event.id]: true };
            },
          }),
        },
        CLEAR_SELECTION: {
          actions: assign({
            selectedIntervals: () => ({}),
          }),
        },
        DUPLICATE_SELECTED: {
          actions: [
            assign({
              workout: ({ context }) => {
                const newIntervalsById = { ...context.workout.intervalsById };
                const newIntervalIds = [...context.workout.intervalIds];

                context.workout.intervalIds.forEach((id) => {
                  if (!context.selectedIntervals[id]) return;
                  const interval = context.workout.intervalsById[id];
                  const newId = uid();
                  newIntervalsById[newId] = { ...interval, id: newId };
                  newIntervalIds.push(newId);
                });

                return {
                  ...context.workout,
                  intervalsById: newIntervalsById,
                  intervalIds: newIntervalIds,
                };
              },
            }),
            "persistWorkout",
          ],
        },
        DELETE_SELECTED: {
          actions: [
            assign({
              workout: ({ context }) => {
                const newIntervalsById = { ...context.workout.intervalsById };
                context.workout.intervalIds.forEach((id) => {
                  if (context.selectedIntervals[id]) {
                    delete newIntervalsById[id];
                  }
                });
                return {
                  ...context.workout,
                  intervalsById: newIntervalsById,
                  intervalIds: context.workout.intervalIds.filter(
                    (id) => !context.selectedIntervals[id]
                  ),
                };
              },
              selectedIntervals: () => ({}),
            }),
            "persistWorkout",
          ],
        },
        UPDATE_NAME: {
          actions: [
            assign({
              workout: ({ context, event }) => ({
                ...context.workout,
                name: event.name,
              }),
            }),
            "persistWorkout",
          ],
        },
        LOAD_PRESET: {
          actions: [
            assign({
              workout: ({ event }) => event.workout,
              selectedIntervals: () => ({}),
            }),
            "persistWorkout",
          ],
        },
        SAVE: "saving",
        LOAD: "loading",
      },
    },
    saving: {
      invoke: {
        src: "saveWorkout",
        input: ({ context, event }) => ({
          workout: context.workout,
          format: (event as Extract<WorkoutEditorEvents, { type: "SAVE" }>)
            .format,
        }),
        onDone: "editing",
        onError: "editing",
      },
    },
    loading: {
      invoke: {
        src: "loadWorkout",
        onDone: {
          target: "editing",
          actions: [
            assign({
              workout: ({ event }) => event.output,
            }),
            "persistWorkout",
          ],
        },
        onError: "editing",
      },
    },
  },
});
