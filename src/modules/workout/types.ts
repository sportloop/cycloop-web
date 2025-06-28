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
