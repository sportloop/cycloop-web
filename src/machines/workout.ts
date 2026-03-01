import { parse } from "mrc";
import { uid } from "uid";
import { json2xml } from "xml-js";
import {
  type ActorRefFrom,
  type AnyActorRef,
  type SnapshotFrom,
  assign,
  fromCallback,
  fromPromise,
  sendTo,
  setup,
} from "xstate";

import {
  playCountdown,
  playIntensityUp,
  playIntensityDown,
} from "@/utils/beep";

import type { Interval, IntervalMeta, Point, Workout } from "./types";
import { loadEditorWorkout } from "./workoutEditor";
import { woToWorkout } from "@/modules/workout/parser";

// ---------------------------------------------------------------------------
// TCX types (internal)
// ---------------------------------------------------------------------------

type TcxWorkout = {
  _declaration: { _attributes: { version: string; encoding: string } };
  TrainingCenterDatabase: {
    _attributes: Record<string, string>;
    Activities: {
      Activity: {
        _attributes: { Sport: string };
        Id: { _text: string };
        Notes: Record<string, never>;
        Creator: {
          _attributes: { "xsi:type": string };
          Name: { _text: string };
        };
        Lap: {
          _attributes: { StartTime: Date };
          TriggerMethod: { _text: string };
          Track: {
            Trackpoint: {
              Time: { _text: string };
              DistanceMeters: { _text: string };
              HeartRateBpm: { Value: { _text: string } };
              Cadence: { _text: string };
              Extensions: {
                "ns3:TPX": {
                  "ns3:Watts": { _text: string };
                  "ns3:Speed": { _text: string };
                };
              };
            }[];
          };
        };
      }[];
    };
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const kmh2mps = (kmh: number) => kmh / 3.6;

function createTcxWorkout(startedAt: number, points: Point[]): TcxWorkout {
  const tcxPoints: TcxWorkout["TrainingCenterDatabase"]["Activities"]["Activity"][0]["Lap"]["Track"]["Trackpoint"] =
    [];

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
      Time: { _text: timestamp },
      DistanceMeters: { _text: `${distance}` },
      HeartRateBpm: { Value: { _text: `${heartRate}` } },
      Cadence: { _text: `${cadence}` },
      Extensions: {
        "ns3:TPX": {
          "ns3:Watts": { _text: `${power}` },
          "ns3:Speed": { _text: `${kmh2mps(speed)}` },
        },
      },
    });
  }

  return {
    _declaration: { _attributes: { version: "1.0", encoding: "utf-8" } },
    TrainingCenterDatabase: {
      _attributes: {
        "xsi:schemaLocation":
          "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd",
        "xmlns:ns5": "http://www.garmin.com/xmlschemas/ActivityGoals/v1",
        "xmlns:ns3": "http://www.garmin.com/xmlschemas/ActivityExtension/v2",
        "xmlns:ns2": "http://www.garmin.com/xmlschemas/UserProfile/v2",
        xmlns:
          "http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2",
        "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
        "xmlns:ns4": "http://www.garmin.com/xmlschemas/ProfileExtension/v1",
        "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
      },
      Activities: {
        Activity: [
          {
            _attributes: { Sport: "Biking" },
            Id: { _text: new Date(startedAt).toISOString() },
            Notes: {},
            Creator: {
              _attributes: { "xsi:type": "Device_t" },
              Name: { _text: "cycloop" },
            },
            Lap: {
              _attributes: { StartTime: new Date(startedAt) },
              TriggerMethod: { _text: "Time" },
              Track: { Trackpoint: tcxPoints },
            },
          },
        ],
      },
    },
  };
}

function computeIntervalMeta(
  workout: Workout
): Record<string, IntervalMeta> {
  const meta: Record<string, IntervalMeta> = {};
  let total = 0;
  for (const id of workout.intervalIds) {
    const interval = workout.intervalsById[id];
    meta[id] = { start: total, end: total + interval.duration };
    total += interval.duration;
  }
  return meta;
}

// ---------------------------------------------------------------------------
// CWO / MRC file parsing (ported from loader/module.ts)
// ---------------------------------------------------------------------------

type CwoFile = {
  name: string;
  meta?: unknown;
  intervals: Interval[];
  instructions: Workout["instructions"];
};

function mrcToWorkout(mrc: string): Workout {
  const { courseHeader, courseData } = parse(mrc);
  const { fileName: name } = courseHeader;
  const intervalsById: Record<string, Interval> = {};
  const intervalIds: string[] = [];
  const instructions: Workout["instructions"] = [];

  const [durationDataType, powerDataType] = courseHeader.dataTypes;
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
}

function cwoToWorkout({ intervals, instructions, name }: CwoFile): Workout {
  const workout: Workout = {
    name,
    intervalsById: {},
    intervalIds: [],
    instructions,
  };
  const seenIds = new Set<string>();
  for (const interval of intervals) {
    if (seenIds.has(interval.id)) {
      throw new Error(`Duplicate interval id: ${interval.id}`);
    }
    seenIds.add(interval.id);
    workout.intervalsById[interval.id] = interval;
    workout.intervalIds.push(interval.id);
  }
  return workout;
}

// ---------------------------------------------------------------------------
// File-system accept types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Machine context type
// ---------------------------------------------------------------------------

type WorkoutContext = {
  temporaryValues: Point | null;
  points: Point[];
  startedAt: number | null;
  finishedAt: number | null;
  tcx: string | null;
  workout: Workout | null;
  intervalMetaById: Record<string, IntervalMeta>;
  ftp: number;
  elapsedTime: number;
  lastTickAt: number | null;
  countdownStartedAt: number | null;
  rampStartedAt: number | null;
  zeroOutputSince: number | null;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type WorkoutEvent =
  | { type: "LOAD_WORKOUT" }
  | { type: "LOAD_FROM_EDITOR" }
  | { type: "LOAD_PRESET"; workout: Workout }
  | { type: "WORKOUT_LOADED"; workout: Workout }
  | { type: "LOAD_FAILED" }
  | { type: "START" }
  | { type: "TICK"; timestamp: number; point?: Point }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "FINISH" }
  | { type: "SKIP_FORWARD" }
  | { type: "SKIP_BACK" }
  | { type: "CLEAR" }
  | { type: "RESET" }
  | { type: "GENERATE_TCX" }
  | { type: "TCX_READY"; tcx: string }
  | { type: "ADD_POINT"; point: Partial<Point> }
  | { type: "SET_FTP"; ftp: number };

// ---------------------------------------------------------------------------
// Invoked actors
// ---------------------------------------------------------------------------

const ticker = fromCallback<WorkoutEvent, { system: AnyActorRef["system"] }>(
  ({ sendBack, system }) => {
    const id = setInterval(() => {
      const now = Date.now();

      // Read device values from the devices actor snapshot
      let devicePoint: Partial<Point> | undefined;
      try {
        const devicesActor = system.get("devices") as AnyActorRef | undefined;
        if (devicesActor) {
          const snap = devicesActor.getSnapshot() as {
            context?: {
              devicesById?: Record<
                string,
                { values?: Record<string, number> }
              >;
              valueToDeviceId?: Record<string, string>;
            };
          };
          const ctx = snap?.context;
          if (ctx?.valueToDeviceId) {
            const powerDevId = ctx.valueToDeviceId.power;
            const cadenceDevId = ctx.valueToDeviceId.cadence;
            const heartRateDevId = ctx.valueToDeviceId.heartRate;
            const speedDevId = ctx.valueToDeviceId.speed;

            devicePoint = {
              timestamp: now,
              power:
                (powerDevId &&
                  ctx.devicesById?.[powerDevId]?.values?.power) ??
                0,
              cadence:
                (cadenceDevId &&
                  ctx.devicesById?.[cadenceDevId]?.values?.cadence) ??
                0,
              heartRate:
                (heartRateDevId &&
                  ctx.devicesById?.[heartRateDevId]?.values?.heartRate) ??
                0,
              speed:
                (speedDevId &&
                  ctx.devicesById?.[speedDevId]?.values?.speed) ??
                0,
            };
          }
        }
      } catch {
        // devices actor not available yet — continue without device data
      }

      sendBack({
        type: "TICK",
        timestamp: now,
        ...(devicePoint ? { point: devicePoint } : {}),
      });
    }, 250);

    return () => clearInterval(id);
  }
);

const tcxGenerator = fromPromise<
  string,
  { startedAt: number; points: Point[] }
>(async ({ input }) => {
  const tcxWorkout = createTcxWorkout(input.startedAt, input.points);
  return json2xml(JSON.stringify(tcxWorkout), { compact: true });
});

const fileLoader = fromPromise<Workout>(async () => {
  const [fileHandle]: [FileSystemFileHandle] = await (
    window as unknown as { showOpenFilePicker: (opts: unknown) => Promise<[FileSystemFileHandle]> }
  ).showOpenFilePicker({
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

  if (!fileHandle) {
    throw new Error("No file selected");
  }

  const file = await fileHandle.getFile();
  const content = await file.text();

  if (file.name.endsWith(".wo")) return woToWorkout(content);
  if (file.name.endsWith(".mrc")) return mrcToWorkout(content);
  return cwoToWorkout(JSON.parse(content));
});

// ---------------------------------------------------------------------------
// Machine
// ---------------------------------------------------------------------------

export const workoutMachine = setup({
  types: {
    context: {} as WorkoutContext,
    events: {} as WorkoutEvent,
  },
  actors: {
    ticker,
    tcxGenerator,
    fileLoader,
  },
  guards: {
    workoutLoaded: ({ context }) => context.workout !== null,
  },
  actions: {
    sendResistanceUpdate: sendTo(
      ({ system }) => system.get("devices") as AnyActorRef,
      ({ context }) => {
        const currentInterval = selectCurrentInterval(context);
        if (!currentInterval) return { type: "WRITE_COMMAND" as const };
        const targetPower = selectTargetPower(context);
        return {
          type: "WRITE_COMMAND" as const,
          command: "setTargetResistanceLevel",
          value: targetPower ?? 0,
        };
      }
    ),
  },
}).createMachine({
  id: "workout",
  initial: "idle",
  context: {
    temporaryValues: null,
    points: [],
    startedAt: null,
    finishedAt: null,
    tcx: null,
    workout: null,
    intervalMetaById: {},
    ftp: 270,
    elapsedTime: 0,
    lastTickAt: null,
    countdownStartedAt: null,
    rampStartedAt: null,
    zeroOutputSince: null,
  },
  on: {
    ADD_POINT: {
      actions: assign({
        temporaryValues: ({ context, event }) => {
          if (isRunning(context)) return context.temporaryValues;
          const defaults = context.points[context.points.length - 1] ?? {
            heartRate: 0,
            cadence: 0,
            speed: 0,
            power: 0,
          };
          return {
            ...defaults,
            ...context.temporaryValues,
            ...event.point,
            timestamp: Date.now(),
            elapsedTime: context.elapsedTime,
          } as Point;
        },
        points: ({ context, event }) => {
          if (!isRunning(context)) return context.points;
          const defaults = context.points[context.points.length - 1] ?? {
            heartRate: 0,
            cadence: 0,
            speed: 0,
            power: 0,
          };
          return [
            ...context.points,
            {
              ...defaults,
              ...event.point,
              timestamp: Date.now(),
              elapsedTime: context.elapsedTime,
            } as Point,
          ];
        },
      }),
    },
    SET_FTP: {
      actions: assign({
        ftp: ({ event }) => event.ftp,
      }),
    },
  },
  states: {
    idle: {
      on: {
        LOAD_WORKOUT: "loading",
        LOAD_PRESET: {
          actions: assign({
            workout: ({ event }) => event.workout,
            intervalMetaById: ({ event }) => computeIntervalMeta(event.workout),
          }),
        },
        LOAD_FROM_EDITOR: {
          actions: assign({
            workout: () => {
              const w = loadEditorWorkout();
              return w;
            },
            intervalMetaById: () => {
              const w = loadEditorWorkout();
              return w ? computeIntervalMeta(w) : {};
            },
          }),
        },
        START: {
          target: "running",
          guard: "workoutLoaded",
          actions: assign({
            startedAt: () => Date.now(),
            lastTickAt: () => null,
            temporaryValues: () => null,
            zeroOutputSince: () => null,
          }),
        },
      },
    },
    loading: {
      invoke: {
        src: "fileLoader",
        onDone: {
          target: "idle",
          actions: assign({
            workout: ({ event }) => event.output,
            intervalMetaById: ({ event }) =>
              computeIntervalMeta(event.output),
          }),
        },
        onError: "idle",
      },
    },
    running: {
      invoke: {
        src: "ticker",
        input: ({ self }) => ({ system: self.system }),
      },
      initial: "active",
      on: {
        FINISH: {
          target: "finished",
          actions: assign({
            finishedAt: () => Date.now(),
            lastTickAt: () => null,
            countdownStartedAt: () => null,
            rampStartedAt: () => null,
            zeroOutputSince: () => null,
          }),
        },
        SKIP_BACK: {
          actions: assign({
            elapsedTime: ({ context }) => Math.max(0, context.elapsedTime - 5000),
            lastTickAt: () => null,
          }),
        },
        SKIP_FORWARD: {
          actions: assign({
            elapsedTime: ({ context }) => {
              if (!context.workout) return context.elapsedTime;
              const lastId = context.workout.intervalIds[context.workout.intervalIds.length - 1];
              if (!lastId) return context.elapsedTime;
              const workoutEnd = context.intervalMetaById[lastId].end;
              return Math.min(workoutEnd, context.elapsedTime + 5000);
            },
            lastTickAt: () => null,
          }),
        },
      },
      states: {
        active: {
          on: {
            TICK: [
              {
                guard: ({ context, event }) => {
                  if (!context.workout || !context.startedAt) return false;
                  const lastId =
                    context.workout.intervalIds[
                      context.workout.intervalIds.length - 1
                    ];
                  if (!lastId) return false;
                  const workoutEnd = context.intervalMetaById[lastId].end;
                  const delta = context.lastTickAt === null ? 0 : event.timestamp - context.lastTickAt;
                  return context.elapsedTime + delta >= workoutEnd;
                },
                target: "#workout.finished",
                actions: assign({
                  elapsedTime: ({ context, event }) => {
                    const delta = context.lastTickAt === null ? 0 : event.timestamp - context.lastTickAt;
                    return context.elapsedTime + delta;
                  },
                  lastTickAt: ({ event }) => event.timestamp,
                  finishedAt: ({ event }) => event.timestamp,
                  points: ({ context, event }) => {
                    if (!event.point) return context.points;
                    const delta = context.lastTickAt === null ? 0 : event.timestamp - context.lastTickAt;
                    const newElapsed = context.elapsedTime + delta;
                    const defaults =
                      context.points[context.points.length - 1] ?? {
                        heartRate: 0,
                        cadence: 0,
                        speed: 0,
                        power: 0,
                      };
                    return [
                      ...context.points,
                      { ...defaults, ...event.point, elapsedTime: newElapsed } as Point,
                    ];
                  },
                  countdownStartedAt: () => null,
                  rampStartedAt: () => null,
                  zeroOutputSince: () => null,
                }),
              },
              // Auto-pause: power has been 0 for 2 seconds
              {
                guard: ({ context, event }) => {
                  if (!event.point || event.point.power !== 0) return false;
                  if (context.zeroOutputSince === null) return false;
                  return event.timestamp - context.zeroOutputSince >= 2000;
                },
                target: "paused",
                actions: [
                  assign({
                    elapsedTime: ({ context, event }) => {
                      const delta = context.lastTickAt === null ? 0 : event.timestamp - context.lastTickAt;
                      return context.elapsedTime + delta;
                    },
                    lastTickAt: () => null,
                    zeroOutputSince: () => null,
                    points: ({ context, event }) => {
                      if (!event.point) return context.points;
                      const delta = context.lastTickAt === null ? 0 : event.timestamp - context.lastTickAt;
                      const newElapsed = context.elapsedTime + delta;
                      const defaults =
                        context.points[context.points.length - 1] ?? {
                          heartRate: 0,
                          cadence: 0,
                          speed: 0,
                          power: 0,
                        };
                      return [
                        ...context.points,
                        { ...defaults, ...event.point, elapsedTime: newElapsed } as Point,
                      ];
                    },
                  }),
                  ({ context, self }) => {
                    try {
                      const devicesActor = self.system.get("devices") as
                        | AnyActorRef
                        | undefined;
                      if (devicesActor) {
                        devicesActor.send({
                          type: "WRITE_COMMAND",
                          command: "setTargetResistanceLevel",
                          value: context.ftp * 0.2,
                        });
                      }
                    } catch {
                      // devices actor not available
                    }
                  },
                ],
              },
              {
                actions: [
                  assign({
                    elapsedTime: ({ context, event }) => {
                      const delta = context.lastTickAt === null ? 0 : event.timestamp - context.lastTickAt;
                      return context.elapsedTime + delta;
                    },
                    lastTickAt: ({ event }) => event.timestamp,
                    zeroOutputSince: ({ context, event }) => {
                      if (event.point === undefined || event.point.power > 0) return null;
                      return context.zeroOutputSince ?? event.timestamp;
                    },
                    points: ({ context, event }) => {
                      if (!event.point) return context.points;
                      const delta = context.lastTickAt === null ? 0 : event.timestamp - context.lastTickAt;
                      const newElapsed = context.elapsedTime + delta;
                      const defaults =
                        context.points[context.points.length - 1] ?? {
                          heartRate: 0,
                          cadence: 0,
                          speed: 0,
                          power: 0,
                        };
                      return [
                        ...context.points,
                        { ...defaults, ...event.point, elapsedTime: newElapsed } as Point,
                      ];
                    },
                  }),
                  ({ context, self }) => {
                    const targetPower = selectTargetPower(context);
                    if (targetPower === null) return;
                    try {
                      const devicesActor = self.system.get("devices") as
                        | AnyActorRef
                        | undefined;
                      if (devicesActor) {
                        devicesActor.send({
                          type: "WRITE_COMMAND",
                          command: "setTargetResistanceLevel",
                          value: targetPower,
                        });
                      }
                    } catch {
                      // devices actor not available
                    }
                  },
                  ({ context }) => {
                    const avgPower = (iv: Interval) =>
                      (iv.targets.power![0] + iv.targets.power![1]) / 2;
                    const timeUntilNext =
                      selectTimeUntilNextInterval(context);
                    if (timeUntilNext !== null && timeUntilNext <= 3000) {
                      const current = selectCurrentInterval(context);
                      const next = selectNextInterval(context);
                      if (current && next) {
                        const delta = Math.abs(
                          avgPower(next) - avgPower(current),
                        );
                        if (delta > 2) playCountdown();
                      }
                      return;
                    }
                    const timeSinceStart =
                      selectTimeSinceIntervalStart(context);
                    if (timeSinceStart !== null && timeSinceStart <= 500) {
                      const current = selectCurrentInterval(context);
                      if (!current || !context.workout) return;
                      const idx = context.workout.intervalIds.indexOf(
                        current.id,
                      );
                      if (idx <= 0) return;
                      const prev =
                        context.workout.intervalsById[
                          context.workout.intervalIds[idx - 1]
                        ];
                      const curAvg = avgPower(current);
                      const prevAvg = avgPower(prev);
                      if (curAvg > prevAvg + 2) {
                        playIntensityUp();
                      } else if (curAvg < prevAvg - 2) {
                        playIntensityDown();
                      }
                    }
                  },
                ],
              },
            ],
            PAUSE: {
              target: "paused",
              actions: [
                assign({ lastTickAt: () => null, zeroOutputSince: () => null }),
                ({ context, self }) => {
                  try {
                    const devicesActor = self.system.get("devices") as
                      | AnyActorRef
                      | undefined;
                    if (devicesActor) {
                      devicesActor.send({
                        type: "WRITE_COMMAND",
                        command: "setTargetResistanceLevel",
                        value: context.ftp * 0.2,
                      });
                    }
                  } catch {
                    // devices actor not available
                  }
                },
              ],
            },
          },
        },
        paused: {
          on: {
            TICK: {
              actions: ({ context, self }) => {
                try {
                  const devicesActor = self.system.get("devices") as
                    | AnyActorRef
                    | undefined;
                  if (devicesActor) {
                    devicesActor.send({
                      type: "WRITE_COMMAND",
                      command: "setTargetResistanceLevel",
                      value: context.ftp * 0.2,
                    });
                  }
                } catch {
                  // devices actor not available
                }
              },
            },
            RESUME: {
              target: "countdown",
              actions: assign({
                countdownStartedAt: () => Date.now(),
              }),
            },
          },
        },
        countdown: {
          entry: () => playCountdown(),
          on: {
            TICK: {
              actions: ({ context, self }) => {
                try {
                  const devicesActor = self.system.get("devices") as
                    | AnyActorRef
                    | undefined;
                  if (devicesActor) {
                    devicesActor.send({
                      type: "WRITE_COMMAND",
                      command: "setTargetResistanceLevel",
                      value: context.ftp * 0.2,
                    });
                  }
                } catch {
                  // devices actor not available
                }
              },
            },
            PAUSE: {
              target: "paused",
              actions: [
                assign({
                  countdownStartedAt: () => null,
                }),
                ({ context, self }) => {
                  try {
                    const devicesActor = self.system.get("devices") as
                      | AnyActorRef
                      | undefined;
                    if (devicesActor) {
                      devicesActor.send({
                        type: "WRITE_COMMAND",
                        command: "setTargetResistanceLevel",
                        value: context.ftp * 0.2,
                      });
                    }
                  } catch {
                    // devices actor not available
                  }
                },
              ],
            },
          },
          after: {
            3000: {
              target: "ramping",
              actions: assign({
                rampStartedAt: () => Date.now(),
              }),
            },
          },
        },
        ramping: {
          on: {
            TICK: {
              actions: ({ context, self }) => {
                const targetPower = selectTargetPower(context);
                if (targetPower === null) return;
                const progress = Math.min(
                  1,
                  (Date.now() - (context.rampStartedAt ?? 0)) / 3000,
                );
                const pauseResistance = context.ftp * 0.2;
                const resistance =
                  pauseResistance +
                  (targetPower - pauseResistance) * progress;
                try {
                  const devicesActor = self.system.get("devices") as
                    | AnyActorRef
                    | undefined;
                  if (devicesActor) {
                    devicesActor.send({
                      type: "WRITE_COMMAND",
                      command: "setTargetResistanceLevel",
                      value: resistance,
                    });
                  }
                } catch {
                  // devices actor not available
                }
              },
            },
            PAUSE: {
              target: "paused",
              actions: [
                assign({
                  countdownStartedAt: () => null,
                  rampStartedAt: () => null,
                }),
                ({ context, self }) => {
                  try {
                    const devicesActor = self.system.get("devices") as
                      | AnyActorRef
                      | undefined;
                    if (devicesActor) {
                      devicesActor.send({
                        type: "WRITE_COMMAND",
                        command: "setTargetResistanceLevel",
                        value: context.ftp * 0.2,
                      });
                    }
                  } catch {
                    // devices actor not available
                  }
                },
              ],
            },
          },
          after: {
            3000: {
              target: "active",
              actions: assign({
                lastTickAt: () => null,
                countdownStartedAt: () => null,
                rampStartedAt: () => null,
              }),
            },
          },
        },
      },
    },
    finished: {
      always: {
        target: "generatingTcx",
        guard: ({ context }) =>
          context.points.length > 0 && context.tcx === null,
      },
      on: {
        CLEAR: {
          target: "idle",
          actions: assign({
            temporaryValues: () => null,
            points: () => [],
            startedAt: () => null,
            finishedAt: () => null,
            tcx: () => null,
            elapsedTime: () => 0,
            lastTickAt: () => null,
            countdownStartedAt: () => null,
            rampStartedAt: () => null,
            zeroOutputSince: () => null,
          }),
        },
        RESET: {
          target: "idle",
          actions: assign({
            temporaryValues: () => null,
            points: () => [],
            startedAt: () => null,
            finishedAt: () => null,
            tcx: () => null,
            workout: () => null,
            intervalMetaById: () => ({}),
            elapsedTime: () => 0,
            lastTickAt: () => null,
            countdownStartedAt: () => null,
            rampStartedAt: () => null,
            zeroOutputSince: () => null,
          }),
        },
        GENERATE_TCX: "generatingTcx",
      },
    },
    generatingTcx: {
      invoke: {
        src: "tcxGenerator",
        input: ({ context }) => ({
          startedAt: context.startedAt!,
          points: context.points,
        }),
        onDone: {
          target: "finished",
          actions: assign({
            tcx: ({ event }) => event.output,
          }),
        },
        onError: "finished",
      },
    },
  },
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

function isRunning(context: WorkoutContext): boolean {
  return context.startedAt !== null && context.finishedAt === null;
}

export function selectIsRunning(
  snapshot: SnapshotFrom<typeof workoutMachine>
): boolean {
  return isRunning(snapshot.context);
}

export function selectPoints(
  snapshot: SnapshotFrom<typeof workoutMachine>
): Point[] {
  return snapshot.context.points;
}

export function selectStartedAt(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  return snapshot.context.startedAt;
}

export function selectFinishedAt(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  return snapshot.context.finishedAt;
}

export function selectTcx(
  snapshot: SnapshotFrom<typeof workoutMachine>
): string | null {
  return snapshot.context.tcx;
}

function selectLastValues(context: WorkoutContext): Point | null {
  if (isRunning(context)) {
    return context.points[context.points.length - 1] ?? null;
  }
  return context.temporaryValues;
}

export function selectLastValue(
  snapshot: SnapshotFrom<typeof workoutMachine>
): Point | null {
  return selectLastValues(snapshot.context);
}

export function selectCurrentPower(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | undefined {
  return selectLastValues(snapshot.context)?.power;
}

export function selectCurrentSpeed(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | undefined {
  return selectLastValues(snapshot.context)?.speed;
}

export function selectCurrentHeartRate(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | undefined {
  return selectLastValues(snapshot.context)?.heartRate;
}

export function selectCurrentCadence(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | undefined {
  return selectLastValues(snapshot.context)?.cadence;
}

function selectCurrentInterval(context: WorkoutContext): Interval | null {
  if (!context.workout || !context.startedAt) return null;
  for (const intervalId of context.workout.intervalIds) {
    const meta = context.intervalMetaById[intervalId];
    if (context.elapsedTime >= meta.start && context.elapsedTime <= meta.end) {
      return context.workout.intervalsById[intervalId];
    }
  }
  return null;
}

export function selectCurrentIntervalFromSnapshot(
  snapshot: SnapshotFrom<typeof workoutMachine>
): Interval | null {
  return selectCurrentInterval(snapshot.context);
}

function selectNextInterval(context: WorkoutContext): Interval | null {
  if (!context.workout) return null;
  if (!context.startedAt) {
    return context.workout.intervalsById[context.workout.intervalIds[0]] ?? null;
  }
  const ids = context.workout.intervalIds;
  for (let i = 0; i < ids.length - 1; i += 1) {
    const meta = context.intervalMetaById[ids[i]];
    if (context.elapsedTime >= meta.start && context.elapsedTime <= meta.end) {
      return context.workout.intervalsById[ids[i + 1]];
    }
  }
  return null;
}

export function selectNextIntervalFromSnapshot(
  snapshot: SnapshotFrom<typeof workoutMachine>
): Interval | null {
  return selectNextInterval(snapshot.context);
}

function selectTimeUntilNextInterval(context: WorkoutContext): number | null {
  const next = selectNextInterval(context);
  if (!next) return null;
  const meta = context.intervalMetaById[next.id];
  return meta.start - (context.elapsedTime || 0);
}

export function selectTimeUntilNextIntervalFromSnapshot(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  return selectTimeUntilNextInterval(snapshot.context);
}

function selectTimeSinceIntervalStart(context: WorkoutContext): number | null {
  const current = selectCurrentInterval(context);
  if (!current) return null;
  const meta = context.intervalMetaById[current.id];
  return context.elapsedTime - meta.start;
}

export function selectTimeSinceIntervalStartFromSnapshot(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  return selectTimeSinceIntervalStart(snapshot.context);
}

function selectTargetPower(context: WorkoutContext): number | null {
  const current = selectCurrentInterval(context);
  if (!current) return null;
  const startPower = current.targets.power?.at(0) ?? 0;
  const endPower = current.targets.power?.at(1) ?? 0;
  const meta = context.intervalMetaById[current.id];
  const percentIntoInterval = Math.min(
    1,
    (context.elapsedTime - meta.start) / (meta.end - meta.start)
  );
  const power = startPower + (endPower - startPower) * percentIntoInterval;
  return (power * context.ftp) / 100;
}

export function selectTargetPowerFromSnapshot(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  return selectTargetPower(snapshot.context);
}

export function selectNextTargetPower(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  const next = selectNextInterval(snapshot.context);
  if (!next) return null;
  return ((next.targets.power?.at(0) ?? 0) * snapshot.context.ftp) / 100;
}

export function selectTotalTime(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  const { startedAt, finishedAt } = snapshot.context;
  if (startedAt && finishedAt) {
    return finishedAt - startedAt;
  }
  return null;
}

export function selectElapsedTime(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number {
  return snapshot.context.elapsedTime;
}

export function selectWorkout(
  snapshot: SnapshotFrom<typeof workoutMachine>
): Workout | null {
  return snapshot.context.workout;
}

export function selectWorkoutIntervals(
  snapshot: SnapshotFrom<typeof workoutMachine>
): Interval[] {
  const { workout } = snapshot.context;
  if (!workout) return [];
  return workout.intervalIds.map((id) => workout.intervalsById[id]);
}

export function selectFtp(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number {
  return snapshot.context.ftp;
}

export function selectTimeUntilWorkoutEnd(
  snapshot: SnapshotFrom<typeof workoutMachine>
): number | null {
  const { context } = snapshot;
  if (!context.workout || !context.startedAt) return null;
  const lastId =
    context.workout.intervalIds[context.workout.intervalIds.length - 1];
  if (!lastId) return null;
  const endTime = context.intervalMetaById[lastId].end;
  return Math.max(0, endTime - context.elapsedTime);
}

export function selectCurrentTextBlocks(
  snapshot: SnapshotFrom<typeof workoutMachine>
): import("./types").TextBlock[] {
  const { context } = snapshot;
  if (!context.workout || !context.startedAt) return [];
  return context.workout.instructions.filter(
    (block) =>
      context.elapsedTime >= block.startAt &&
      context.elapsedTime < block.startAt + block.duration
  );
}

export function selectIsPaused(
  snapshot: SnapshotFrom<typeof workoutMachine>,
): boolean {
  return snapshot.matches({ running: "paused" });
}

export function selectIsCountdown(
  snapshot: SnapshotFrom<typeof workoutMachine>,
): boolean {
  return snapshot.matches({ running: "countdown" });
}

export function selectIsRamping(
  snapshot: SnapshotFrom<typeof workoutMachine>,
): boolean {
  return snapshot.matches({ running: "ramping" });
}

export function selectCountdownStartedAt(
  snapshot: SnapshotFrom<typeof workoutMachine>,
): number | null {
  return snapshot.context.countdownStartedAt;
}

export type WorkoutMachine = typeof workoutMachine;
export type WorkoutActorRef = ActorRefFrom<typeof workoutMachine>;
