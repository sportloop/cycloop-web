import type { Workout } from "@/machines/types";

const getZoneColor = (ftpPercent: number) => {
  if (ftpPercent < 56) return "rgba(148,163,184,0.35)";
  if (ftpPercent < 76) return "rgba(96,165,250,0.35)";
  if (ftpPercent < 91) return "rgba(52,211,153,0.35)";
  if (ftpPercent < 106) return "rgba(251,191,36,0.3)";
  if (ftpPercent < 121) return "rgba(249,115,22,0.35)";
  if (ftpPercent < 151) return "rgba(239,68,68,0.35)";
  return "rgba(192,132,252,0.35)";
};

export default function WorkoutPreview({
  workout,
  className,
}: {
  workout: Workout;
  className?: string;
}) {
  const intervals = workout.intervalIds.map((id) => workout.intervalsById[id]);

  let maxPower = 0;
  let totalDuration = 0;
  for (const interval of intervals) {
    const from = interval.targets.power?.[0] ?? 0;
    const to = interval.targets.power?.[1] ?? from;
    maxPower = Math.max(maxPower, from, to);
    totalDuration += interval.duration;
  }

  if (intervals.length === 0 || totalDuration === 0) return null;

  const viewHeight = Math.max(maxPower, 120) * 1.1;
  const viewWidth = 1000;

  let offset = 0;
  const blocks = intervals.map((interval, i) => {
    const from = interval.targets.power?.[0] ?? 0;
    const to = interval.targets.power?.[1] ?? from;
    const x1 = (offset / totalDuration) * viewWidth;
    const x2 = ((offset + interval.duration) / totalDuration) * viewWidth;
    const y1From = viewHeight - from;
    const y1To = viewHeight - to;
    const zone =
      (Math.max(Math.min(from, to), 60) + Math.max(from, to)) / 2;

    offset += interval.duration;
    return (
      <polygon
        key={i}
        points={`${x1},${viewHeight} ${x1},${y1From} ${x2},${y1To} ${x2},${viewHeight}`}
        fill={getZoneColor(zone)}
      />
    );
  });

  const ftpY = viewHeight - 100;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {blocks}
      <line
        x1="0"
        y1={ftpY}
        x2={viewWidth}
        y2={ftpY}
        stroke="rgba(248,113,113,0.15)"
        strokeWidth="1"
        strokeDasharray="6 4"
      />
    </svg>
  );
}
