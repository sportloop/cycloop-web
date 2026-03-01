import { useReducer } from "react";
import { useSelector } from "@xstate/react";

import useInterval from "../../hooks/useInterval";
import useViewport from "../../hooks/useViewport";

import { useAppActor } from "../../machines/context";
import {
  selectPoints,
  selectStartedAt,
  selectFinishedAt,
  selectWorkoutIntervals,
  selectFtp,
  selectElapsedTime,
} from "../../machines/workout";

const minimumDuration = 10 * 60 * 1000;
const minimumDisplayedPower = 200;
const assumedDurationFraction = 1.2;

const getZoneColor = (ftpPercent: number) => {
  if (ftpPercent < 56) return "rgba(148,163,184,0.4)";
  if (ftpPercent < 76) return "rgba(96,165,250,0.4)";
  if (ftpPercent < 91) return "rgba(52,211,153,0.4)";
  if (ftpPercent < 106) return "rgba(251,191,36,0.35)";
  if (ftpPercent < 121) return "rgba(249,115,22,0.4)";
  if (ftpPercent < 151) return "rgba(239,68,68,0.4)";
  return "rgba(192,132,252,0.4)";
};

export default function Visualiser() {
  const appActor = useAppActor();
  const workoutActor = appActor.system.get("workout");

  const points = useSelector(workoutActor, selectPoints);
  const startTime = useSelector(workoutActor, selectStartedAt);
  const finishTime = useSelector(workoutActor, selectFinishedAt);
  const intervals = useSelector(workoutActor, selectWorkoutIntervals);
  const ftp = useSelector(workoutActor, selectFtp);
  const elapsedTime = useSelector(workoutActor, selectElapsedTime);

  let workoutTime = 0;
  let workoutMaxPower = 0;

  intervals.forEach((interval) => {
    workoutTime += interval.duration;
    const fromPower = interval.targets.power?.[0] ?? 0;
    const toPower = interval.targets.power?.[1] ?? fromPower;
    workoutMaxPower = Math.max(
      workoutMaxPower,
      (fromPower * ftp) / 100,
      (toPower * ftp) / 100
    );
  });

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

  const maxRecordedPower = points.reduce(
    (max, { power }) => Math.max(max, power),
    0
  );

  // viewBox height must encompass all content: interval blocks,
  // recorded power peaks, and the FTP line. Add 10% headroom.
  const topPower = Math.ceil(
    Math.max(workoutMaxPower, maxRecordedPower, ftp, minimumDisplayedPower) *
      1.1,
  );

  const intervalBlocks: { points: string; fill: string }[] = [];

  // Build segmented paths — start a new segment when elapsedTime goes
  // backwards (skip-back) so we don't get backward-drawing artifacts.
  const powerSegments: string[][] = [[]];
  const heartRateSegments: string[][] = [[]];
  let prevElapsed = -1;

  points.forEach(({ power, heartRate, elapsedTime: pointElapsed }) => {
    if (pointElapsed < prevElapsed) {
      // rewind detected — start new segments
      powerSegments.push([]);
      heartRateSegments.push([]);
    }
    prevElapsed = pointElapsed;
    const x = pointElapsed * durationModifier;
    if (power) {
      powerSegments[powerSegments.length - 1].push(`${x},${topPower - power}`);
    }
    if (heartRate) {
      heartRateSegments[heartRateSegments.length - 1].push(`${x},${topPower - heartRate}`);
    }
  });

  let intervalFrom = 0;
  intervals.forEach((interval) => {
    const fromPercent = interval.targets.power?.[0] ?? 0;
    const toPercent = interval.targets.power?.[1] ?? fromPercent;
    const fromPower = (fromPercent * ftp) / 100;
    const toPower = (toPercent * ftp) / 100;
    const x1 = intervalFrom * durationModifier;
    const x2 = (intervalFrom + interval.duration) * durationModifier;
    const zone =
      (Math.max(Math.min(fromPercent, toPercent), 60) +
        Math.max(fromPercent, toPercent)) /
      2;
    intervalBlocks.push({
      points: `${x1},${topPower} ${x1},${topPower - fromPower} ${x2},${topPower - toPower} ${x2},${topPower}`,
      fill: getZoneColor(zone),
    });
    intervalFrom += interval.duration;
  });

  const powerDs = powerSegments
    .filter((seg) => seg.length > 0)
    .map((seg) => `M${seg.join("L")}`);
  const heartRateDs = heartRateSegments
    .filter((seg) => seg.length > 0)
    .map((seg) => `M${seg.join("L")}`);

  const lineX = elapsedTime * durationModifier;
  const line = `M${lineX},${topPower}L${lineX},0`;

  const ftpY = topPower - ftp;
  const ftpLine = `M0,${ftpY}L${viewport.width},${ftpY}`;

  return (
    <svg
      viewBox={`0 0 ${viewport.width} ${topPower}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
      strokeLinejoin="round"
    >
      {/* Interval blocks */}
      {intervalBlocks.map((block, i) => (
        <polygon key={i} points={block.points} fill={block.fill} />
      ))}
      {/* FTP reference line */}
      <path
        d={ftpLine}
        stroke="rgba(248,113,113,0.25)"
        strokeWidth="1"
        strokeDasharray="6 4"
        fill="none"
      />
      {/* Heart rate trace */}
      {heartRateDs.map((d, i) => (
        <path
          key={`hr-${i}`}
          d={d}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
          fill="none"
        />
      ))}
      {/* Power trace */}
      {powerDs.map((d, i) => (
        <path
          key={`pw-${i}`}
          d={d}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="2"
          fill="none"
        />
      ))}
      {/* Current time indicator */}
      {startTime != null && (
        <path
          d={line}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.5"
          fill="none"
        />
      )}
    </svg>
  );
}
