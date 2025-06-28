import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModule } from "remodules";
import { createSelector } from "@reduxjs/toolkit";

import WorkoutLayout from "@/layouts/workout";
import UploadButton from "@/modules/strava/UploadButton";
import workoutModule from "@/modules/workout/module";
import SaveButton from "@/modules/workout/SaveButton";
import Visualiser from "@/modules/workout/Visualiser";
import { Button } from "@/components/Button";

const format = (value: number | string) => {
  if (typeof value !== "number") {
    return value;
  }
  return Number.prototype.toLocaleString.call(value, undefined, {
    maximumFractionDigits: 2,
  });
};

function Value({
  name,
  selector,
  unit = "",
}: {
  name: string;
  selector: (state: any) => number | string;
  unit?: string;
}) {
  const value = useSelector(selector);
  return (
    <article className="w-1/2 flex flex-col justify-center items-center text-center px-8 py-6 md:w-1/3">
      <h3 className="text-sm font-bold">{name}</h3>
      <p className="text-4xl tabular-nums">
        {format(value) ?? "--"} <span className="text-2xl">{unit}</span>
      </p>
    </article>
  );
}

const msToTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
};

const timeSelector = createSelector(
  workoutModule.selectors.startedAt,
  workoutModule.selectors.elapsedTime,
  workoutModule.selectors.totalTime,
  (startedAt, elapsedTime, totalTime) => {
    if (!startedAt) {
      return null;
    }
    const ms = totalTime ?? elapsedTime;

    return msToTime(ms);
  },
);

const nextIntervalInSelector = createSelector(
  workoutModule.selectors.timeUntilNextInterval,
  (timeUntilNextInterval) => {
    if (timeUntilNextInterval === null) {
      return null;
    }
    return msToTime(timeUntilNextInterval);
  },
);

function LoadWorkoutButton() {
  const dispatch = useDispatch();
  const workout = useSelector(workoutModule.selectors.workout);

  const onLoad = useCallback(() => {
    dispatch(workoutModule.actions.loadWorkout());
  }, [dispatch]);

  const onClear = useCallback(() => {
    dispatch(workoutModule.actions.clearWorkout());
  }, [dispatch]);

  return (
    <Button onClick={workout ? onClear : onLoad}>
      {workout ? "Clear" : "Load"} Workout
    </Button>
  );
}

export default function Workout() {
  useModule(workoutModule);

  const dispatch = useDispatch();

  const isRunning = useSelector(workoutModule.selectors.isRunning);
  const tcx = useSelector(workoutModule.selectors.tcx);

  const onStart = useCallback(() => {
    dispatch(workoutModule.actions.start());
  }, [dispatch]);

  const onFinish = useCallback(() => {
    dispatch(workoutModule.actions.finish());
  }, [dispatch]);

  return (
    <div className="h-screen w-full text-white flex flex-col">
      <section className="w-full flex flex-wrap">
        <Value
          name="Power"
          selector={workoutModule.selectors.currentPower}
          unit="W"
        />
        <Value
          name="Heart Rate"
          selector={workoutModule.selectors.currentHeartRate}
          unit="BPM"
        />
        <Value
          name="Cadence"
          selector={workoutModule.selectors.currentCadence}
          unit="RPM"
        />
        <Value
          name="Speed"
          selector={workoutModule.selectors.currentSpeed}
          unit="KM/H"
        />
        <Value name="Time" selector={timeSelector} unit="" />
        <Value
          name="Target Power"
          selector={workoutModule.selectors.targetPower}
          unit="W"
        />
        <Value
          name="Next Target"
          selector={workoutModule.selectors.nextTargetPower}
          unit="W"
        />
        <Value
          name="Next Interval in"
          selector={nextIntervalInSelector}
          unit="ms"
        />
      </section>
      <section className="w-full flex-1 flex flex-wrap overflow-hidden">
        <Visualiser />
      </section>
      <footer>
        {isRunning ? (
          <Button onClick={onFinish}>Finish</Button>
        ) : (
          <Button onClick={onStart}>Start</Button>
        )}
        <UploadButton tcx={tcx} />
        <SaveButton tcx={tcx} />
        <LoadWorkoutButton />
      </footer>
    </div>
  );
}

Workout.Layout = WorkoutLayout;
