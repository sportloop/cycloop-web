export type Point = {
  timestamp: number;
  heartRate: number;
  cadence: number;
  power: number;
  speed: number;
};

export type Device = {
  id: string;
  name: string;
  type: string;
  features: { [key: string]: boolean };
  values: { [key: string]: number };
};

export type Interval = {
  id: string;
  // enables ramps
  duration: number;
  targets: IntervalTargets;
};

export type IntervalTargetType = "power" | "heartRate" | "cadence";

export type IntervalTargets = {
  [key in IntervalTargetType]?: [number, number];
};

export type TextBlock = {
  id: string;
  text: string;
  startAt: number;
  duration: number;
};

export type Workout = {
  name: string;
  intervalsById: { [id: string]: Interval };
  intervalIds: string[];
  instructions: TextBlock[];
};

export type WorkoutEditorState = {
  workout: Workout;
  selectedIntervals: { [id: string]: boolean };
  saving: boolean;
};

export type IntervalMeta = {
  start: number;
  end: number;
};
