import { useReducer } from "react";
import { useSelector } from "react-redux";

import useInterval from "../../hooks/useInterval";
import useViewport from "../../hooks/useViewport";

import workoutModule from "./module";

// const minimumPixelsPerMillisecond = 0.0002;
const minimumDuration = 10 * 60 * 1000;
const viewportHeightFraction = 0.5;
const minimumPixelsPerWatt = 0.2;
const minimumDisplayedPower = 200;
const maxDisplayedPower = 2000;
const assumedDurationFraction = 1.2;

export default function Visualiser() {
  const points = useSelector(workoutModule.selectors.points);
  const startTime = useSelector(workoutModule.selectors.startedAt);
  const finishTime = useSelector(workoutModule.selectors.finishedAt);
  const intervals = useSelector(workoutModule.selectors.workoutIntervals);
  const ftp = useSelector(workoutModule.selectors.ftp);

  let workoutTime = 0;
  let workoutMaxPower = 0;

  intervals.forEach((interval) => {
    workoutTime += interval.duration;
    workoutMaxPower = Math.max(
      workoutMaxPower,
      (interval.targetPower * ftp) / 100
    );
  });

  const currentTime = finishTime ?? Date.now();
  let fullDuration = minimumDuration;
  if (workoutTime) {
    fullDuration = workoutTime;
  } else if (finishTime) {
    fullDuration = finishTime - startTime;
  } else {
    fullDuration = Math.max(
      (Date.now() - startTime) * assumedDurationFraction,
      minimumDuration
    );
  }

  const [, ping] = useReducer((state) => state + 1, 0);
  useInterval(ping, 1000);

  const viewport = useViewport();

  const durationModifier = viewport.width / fullDuration;

  const height = viewport.height * viewportHeightFraction;

  const powerPoints: string[] = [];
  const cadencePoints: string[] = [];
  const heartRatePoints: string[] = [];
  const maxPower = points.reduce(
    (max, { power }) => Math.max(max, power),
    minimumDisplayedPower
  );

  const maxPowerThatFits = Math.min(
    height / minimumPixelsPerWatt,
    maxDisplayedPower
  );

  const topPower = Math.min(maxPower, maxPowerThatFits, workoutMaxPower);

  const intervalPoints: string[] = [
    `${workoutTime * durationModifier},${topPower}`,
    `0,${topPower}`,
  ];

  points.forEach(({ power, cadence, heartRate, timestamp }) => {
    const x = (timestamp - startTime) * durationModifier;
    if (power) {
      powerPoints.push(`${x},${topPower - power}`);
    }
    if (cadence) {
      cadencePoints.push(`${x},${topPower - cadence}`);
    }
    if (heartRate) {
      heartRatePoints.push(`${x},${topPower - heartRate}`);
    }
  });

  let intervalFrom = 0;
  intervals.forEach((interval) => {
    const power = (interval.targetPower * ftp) / 100;
    intervalPoints.push(
      `${intervalFrom * durationModifier},${topPower - power}`,
      `${(intervalFrom + interval.duration) * durationModifier},${
        topPower - power
      }`
    );
    intervalFrom += interval.duration;
  });

  const powerD = `M${powerPoints.join("L")}`;

  const cadenceD = `M${cadencePoints.join("L")}`;

  const heartRateD = `M${heartRatePoints.join("L")}`;

  const lineX = (currentTime - startTime) * durationModifier;

  const line = `M${lineX},${topPower}L${lineX},0`;

  const intervalsD = `M${intervalPoints.join("L")}`;

  return (
    <svg
      viewBox={`0 0 ${viewport.width} ${topPower}`}
      xmlns="http://www.w3.org/2000/svg"
      strokeLinejoin="round"
    >
      <path d={powerD} stroke="#fff" strokeWidth="3" fill="none" />
      <path d={cadenceD} stroke="#ddd" strokeWidth="2" fill="none" />
      <path
        d={heartRateD}
        stroke="#ddd"
        strokeWidth="2"
        strokeDasharray="2 1"
        fill="none"
      />
      <path d={line} stroke="#fff" strokeWidth="2" fill="none" />
      <path d={intervalsD} stroke="none" fill="rgba(255,255,255,0.2)" />
    </svg>
  );
}
