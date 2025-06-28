/* eslint-disable react/jsx-props-no-spreading */
import { createSelector } from "@reduxjs/toolkit";
import React, { CSSProperties, MouseEvent, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useModule } from "remodules";
import { useDrag } from "@use-gesture/react";
import classNames from "classnames";
import { Menu, MenuButton, MenuItem, MenuList } from "@reach/menu-button";

import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/Button";

import workoutEditor, { durationStep, powerStep, stickToSteps } from "./module";
import workoutLoader from "../loader/module";
import { type Interval } from "../types";

const maxFtpPercentageShown = 500;

const createIntervalByIdSelector = (id: string) =>
  createSelector(workoutEditor.selectors.workout, (workout) => {
    return workout.intervalsById[id];
  });

function PowerAdjuster({ id, offset }: { id: string; offset: number }) {
  const dispatch = useDispatch();
  const selector = useMemo(() => createIntervalByIdSelector(id), [id]);
  const interval = useSelector(selector);

  const bind = useDrag(
    ({ down, delta: [, x], last }) => {
      if (down || last) {
        const fromPower = interval.targets.power.at(0);
        const toPower = interval.targets.power.at(1);
        const newFromPower = fromPower - x;
        const newToPower = toPower - x;
        const targetFromPower = last
          ? stickToSteps(newFromPower, powerStep)
          : newFromPower;
        const targetToPower = last
          ? stickToSteps(newToPower, powerStep)
          : newToPower;
        dispatch(
          workoutEditor.actions.updateIntervalTargetPower({
            id,
            power: [targetFromPower, targetToPower],
          }),
        );
      }
    },
    { from: () => [0, interval.targets.power.at(0)] },
  );

  return (
    <line
      {...bind()}
      x1={offset}
      x2={offset + interval.duration / 1000}
      y1={maxFtpPercentageShown - interval.targets.power.at(0)}
      y2={maxFtpPercentageShown - interval.targets.power.at(1)}
      stroke="currentColor"
      strokeWidth="12"
      strokeLinecap="round"
      className="z-1 rounded-sm opacity-25 text-gray-400 hover:opacity-80 transition-all touch-none cursor-ns-resize"
    />
  );
}

// a little knob on the left side of the interval that allows you to create a ramp
function FromPowerAdjuster({ id, offset }: { id: string; offset: number }) {
  const dispatch = useDispatch();
  const selector = useMemo(() => createIntervalByIdSelector(id), [id]);
  const interval = useSelector(selector);

  const bind = useDrag(
    ({ down, delta: [, x], last }) => {
      if (down || last) {
        const fromPower = interval.targets.power.at(0);
        const newFromPower = fromPower - x;
        const targetFromPower = last
          ? stickToSteps(newFromPower, powerStep)
          : newFromPower;
        dispatch(
          workoutEditor.actions.updateIntervalTargetPower({
            id,
            power: [targetFromPower, interval.targets.power.at(1)],
          }),
        );
      }
    },
    { from: () => [0, interval.targets.power.at(0)] },
  );

  const onDoubleClick = useCallback(() => {
    const toPower = interval.targets.power.at(1);
    dispatch(
      workoutEditor.actions.updateIntervalTargetPower({
        id,
        power: [toPower, toPower],
      }),
    );
  }, [dispatch, id, interval.targets.power]);

  return (
    <circle
      {...bind()}
      onDoubleClick={onDoubleClick}
      cx={offset}
      cy={maxFtpPercentageShown - interval.targets.power.at(0)}
      r="12"
      fill="currentColor"
      className="z-1 rounded-sm opacity-25 text-gray-400 hover:opacity-80 transition-all touch-none cursor-ns-resize"
    />
  );
}

// a little knob on the right side of the interval that allows you to create a ramp
function ToPowerAdjuster({ id, offset }: { id: string; offset: number }) {
  const dispatch = useDispatch();
  const selector = useMemo(() => createIntervalByIdSelector(id), [id]);
  const interval = useSelector(selector);

  const bind = useDrag(
    ({ down, delta: [, x], last }) => {
      if (down || last) {
        const toPower = interval.targets.power.at(1);
        const newToPower = toPower - x;
        const targetToPower = last
          ? stickToSteps(newToPower, powerStep)
          : newToPower;
        dispatch(
          workoutEditor.actions.updateIntervalTargetPower({
            id,
            power: [interval.targets.power.at(0), targetToPower],
          }),
        );
      }
    },
    { from: () => [0, interval.targets.power.at(1)] },
  );

  const onDoubleClick = useCallback(() => {
    const fromPower = interval.targets.power.at(0);
    dispatch(
      workoutEditor.actions.updateIntervalTargetPower({
        id,
        power: [fromPower, fromPower],
      }),
    );
  }, [dispatch, id, interval.targets.power]);

  return (
    <circle
      {...bind()}
      onDoubleClick={onDoubleClick}
      cx={offset + interval.duration / 1000}
      cy={maxFtpPercentageShown - interval.targets.power.at(1)}
      r="12"
      fill="currentColor"
      className="z-1 rounded-sm opacity-25 text-gray-400 hover:opacity-80 transition-all touch-none cursor-ns-resize"
    />
  );
}

function DurationAdjuster({ id, offset }: { id: string; offset: number }) {
  const dispatch = useDispatch();
  const selector = useMemo(() => createIntervalByIdSelector(id), [id]);
  const interval = useSelector(selector);

  const bind = useDrag(
    ({ down, delta: [y], last }) => {
      if (down || last) {
        const rawDuration = interval.duration + y * 1000;
        const duration = last
          ? stickToSteps(rawDuration, durationStep)
          : rawDuration;
        dispatch(
          workoutEditor.actions.updateIntervalDuration({
            id,
            duration,
          }),
        );
      }
    },
    { from: () => [interval.duration, 0] },
  );

  return (
    <line
      {...bind()}
      x1={offset + interval.duration / 1000}
      x2={offset + interval.duration / 1000}
      y1={maxFtpPercentageShown - interval.targets.power.at(1)}
      y2={maxFtpPercentageShown}
      stroke="currentColor"
      strokeWidth="12"
      strokeLinecap="round"
      className="z-1 rounded-sm opacity-25 text-gray-400 hover:opacity-80 transition-all touch-none cursor-ew-resize"
    />
  );
}

const createIsSelectedSelector = (id: string) =>
  createSelector(workoutEditor.selectors.selectedIntervals, (selected) => {
    return selected[id];
  });

function Interval({ id, offset }: { id: string; offset: number }) {
  const dispatch = useDispatch();
  const intervalSelector = useMemo(() => createIntervalByIdSelector(id), [id]);
  const isSelectedSelector = useMemo(() => createIsSelectedSelector(id), [id]);
  const interval = useSelector(intervalSelector);
  const isSelected = useSelector(isSelectedSelector);

  const onSelect = useCallback(
    (event: MouseEvent<SVGPolygonElement>) => {
      if (event.target === event.currentTarget) {
        dispatch(workoutEditor.actions.selectInterval(id));
      }
    },
    [dispatch, id],
  );

  // return a quadrilateral, drawn from the bottom left corner
  // going up to top left corner with height of interval.targets.power.at(0)
  // then going to top right, moving x by interval.duration and y by interval.targets.power.at(1) - interval.targets.power.at(0)
  // then going down to bottom right, moving y by interval.targets.power.at(1)
  // then going left to bottom left, moving x by interval.duration

  const point1 = `${offset},${maxFtpPercentageShown - interval.targets.power.at(0)}`;
  const point2 = `${offset},${maxFtpPercentageShown}`;
  const point3 = `${offset + interval.duration / 1000},${maxFtpPercentageShown}`;
  const point4 = `${offset + interval.duration / 1000},${
    maxFtpPercentageShown - interval.targets.power.at(1)
  }`;

  const points = `${point1} ${point2} ${point3} ${point4}`;

  return (
    <>
      <polygon
        className={classNames(
          "fill-current text-white",
          isSelected ? "opacity-100" : "opacity-50",
        )}
        points={points}
        onClick={onSelect}
        tabIndex={0}
        data-glow
      />
      <DurationAdjuster id={id} offset={offset} />
      <PowerAdjuster id={id} offset={offset} />
      <FromPowerAdjuster id={id} offset={offset} />
      <ToPowerAdjuster id={id} offset={offset} />
    </>
  );
}

const formatTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return `${hours}:${(minutes % 60).toString().padStart(2, "0")}:${(
    seconds % 60
  )
    .toString()
    .padStart(2, "0")}`;
};

const getWorkingZoneNames = (workingZone: number) => {
  if (workingZone < 60) {
    return "Active Recovery";
  }
  if (workingZone < 75) {
    return "Endurance";
  }
  if (workingZone < 90) {
    return "Tempo";
  }
  if (workingZone < 105) {
    return "Threshold";
  }
  if (workingZone < 120) {
    return "VO2 Max";
  }
  if (workingZone < 130) {
    return "Anaerobic";
  }
  return "Neuromuscular";
};

function Stats() {
  const {
    duration,
    intensity,
    trainingStress,
    power,
    workingTime,
    workingZone,
  } = useSelector(workoutEditor.selectors.stats);

  return (
    <Card style={{ position: "fixed" }} className="top-3 right-6">
      <CardContent>
        <p className="text-xl">Time: {formatTime(duration)}</p>
        <p className="text-xl">Intensity: {intensity.toFixed(2)}</p>
        <p className="text-xl">TSS: {trainingStress.toFixed(0)}</p>
        <p className="text-xl">Power: {power.toFixed(0)}</p>
        <p className="text-xl">Working time: {formatTime(workingTime)}</p>
        <p className="text-xl">
          Working zone: {getWorkingZoneNames(workingZone)}
        </p>
      </CardContent>
    </Card>
  );
}

const getIntervalsWidth = (intervals: Interval[]) => {
  return (
    intervals.reduce((acc, interval) => {
      return acc + interval.duration;
    }, 0) / 1000
  );
};

type PropsOf<T> = T extends React.ComponentType<infer P> ? P : never;

function FTPLine() {
  const ftp = 100;

  return (
    <div
      style={{ "--ftp": `${ftp}px` } as CSSProperties}
      className="absolute bottom-[var(--ftp)] left-0 w-full h-1 bg-red-400 pointer-events-none"
    />
  );
}

export default function Editor() {
  useModule(workoutEditor);
  useModule(workoutLoader);
  const dispatch = useDispatch();
  const workout = useSelector(workoutEditor.selectors.workout);

  const onNameChange = useCallback(
    (event) => {
      dispatch(workoutEditor.actions.updateName(event.target.value));
    },
    [dispatch],
  );

  const onAddInterval = useCallback(() => {
    dispatch(workoutEditor.actions.addInterval());
  }, [dispatch]);

  const onDuplicateInterval = useCallback(() => {
    dispatch(workoutEditor.actions.duplicateSelectedIntervals());
  }, [dispatch]);

  const onDeleteInterval = useCallback(() => {
    dispatch(workoutEditor.actions.deleteSelectedIntervals());
  }, [dispatch]);

  const onSave = useCallback(() => {
    dispatch(workoutEditor.actions.save("cwo"));
  }, [dispatch]);

  const onSaveMrc = useCallback(() => {
    dispatch(workoutEditor.actions.save("mrc"));
  }, [dispatch]);

  const onLoad = useCallback(() => {
    dispatch(workoutEditor.actions.load());
  }, [dispatch]);

  const intervalProps = useMemo(() => {
    const props: PropsOf<typeof Interval>[] = [];
    let offset = 0;
    workout.intervalIds.forEach((id) => {
      const interval = workout.intervalsById[id];
      props.push({
        id,
        offset,
      });
      offset += interval.duration / 1000;
    });
    return props;
  }, [workout.intervalsById, workout.intervalIds]);

  const width = getIntervalsWidth(Object.values(workout.intervalsById));

  return (
    <section className="w-full h-full flex flex-col">
      <header className="flex justify-between">
        <input
          className="bg-opacity-0 bg-black text-white text-2xl focus:outline-none outline-none border-b border-opacity-0 border-gray-300 focus:border-opacity-100 transition-all"
          value={workout.name}
          onChange={onNameChange}
        />
        <Menu>
          <MenuButton className="text-white bg-transparent py-2 px-4 text-2xl">
            ⋮
          </MenuButton>
          <MenuList>
            <MenuItem onSelect={onDuplicateInterval}>
              Duplicate Selected
            </MenuItem>
            <MenuItem onSelect={onDeleteInterval}>Delete Selected</MenuItem>
            <MenuItem onSelect={onSave}>Save</MenuItem>
            <MenuItem onSelect={onSaveMrc}>Save as MRC</MenuItem>
            <MenuItem onSelect={onLoad}>Load</MenuItem>
            <MenuItem onSelect={() => alert("Discarded")}>Discard</MenuItem>
          </MenuList>
        </Menu>
      </header>
      <div className="min-w-screen overflow-x-auto flex">
        <div
          style={{ "--max-ftp": maxFtpPercentageShown } as React.CSSProperties}
          className="h-[calc(var(--max-ftp)*1px)] flex-1 bg-repeat flex items-end [background-image:linear-gradient(to_bottom,transparent,transparent_99%,#ddd,#ddd_100%),linear-gradient(to_right,transparent,transparent_99%,#333,#333_100%)] [background-size:60px_100px] relative min-w-fit"
        >
          <FTPLine />
          <svg
            style={{
              width,
              minWidth: width,
              height: "100%",
            }}
          >
            {intervalProps.map((props) => (
              <Interval key={props.id} {...props} />
            ))}
          </svg>
          <Button
            style={{ "--interval-width": "200px" } as any}
            className="rounded-sm bg-white bg-opacity-10 text-white text-4xl h-[100px] w-[var(--interval-width)] flex-shrink-0"
            onClick={onAddInterval}
            type="button"
          >
            +
          </Button>
        </div>
      </div>
      <Stats />
    </section>
  );
}
