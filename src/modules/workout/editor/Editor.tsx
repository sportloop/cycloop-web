/* eslint-disable react/jsx-props-no-spreading */
import React, {
  CSSProperties,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelector } from "@xstate/react";
import { useDrag } from "@use-gesture/react";
import classNames from "classnames";
import Link from "next/link";

import Logo from "@/components/icons/Logo";
import { useAppActor } from "@/machines/context";
import {
  durationStep,
  powerStep,
  stickToSteps,
  selectStats,
} from "@/machines/workoutEditor";
import { type Interval } from "../types";

const maxFtpPercentageShown = 300;

// ─── Zone Colors (matching workout HUD) ─────────────────────

const getZoneColor = (ftpPercent: number) => {
  if (ftpPercent < 56) return "rgba(148,163,184,0.35)";
  if (ftpPercent < 76) return "rgba(96,165,250,0.4)";
  if (ftpPercent < 91) return "rgba(52,211,153,0.4)";
  if (ftpPercent < 106) return "rgba(251,191,36,0.35)";
  if (ftpPercent < 121) return "rgba(249,115,22,0.4)";
  if (ftpPercent < 151) return "rgba(239,68,68,0.4)";
  return "rgba(192,132,252,0.4)";
};

const getZoneAccent = (ftpPercent: number) => {
  if (ftpPercent < 56) return "#94a3b8";
  if (ftpPercent < 76) return "#60a5fa";
  if (ftpPercent < 91) return "#34d399";
  if (ftpPercent < 106) return "#fbbf24";
  if (ftpPercent < 121) return "#f97316";
  if (ftpPercent < 151) return "#ef4444";
  return "#c084fc";
};

// ─── Helpers ────────────────────────────────────────────────

/** Clamp a power % to the visible coordinate range, scaled by pixels-per-percent */
const clampY = (pct: number, pp: number) =>
  (maxFtpPercentageShown - Math.min(pct, maxFtpPercentageShown)) * pp;

const formatDuration = (ms: number) => {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Parse a duration string like "1:30", "90s", "1m30s", "90" into ms */
const parseDuration = (raw: string): number | null => {
  const s = raw.trim();
  // "m:ss" or "mm:ss"
  const colonMatch = s.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    return (parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2])) * 1000;
  }
  // "Xm", "Xs", "XmYs"
  const hmsMatch = s.match(/^(?:(\d+)m)?(?:(\d+)s)?$/);
  if (hmsMatch && (hmsMatch[1] || hmsMatch[2])) {
    return ((parseInt(hmsMatch[1] || "0") * 60) + parseInt(hmsMatch[2] || "0")) * 1000;
  }
  // Plain number → seconds
  const num = parseFloat(s);
  if (!isNaN(num) && num > 0) return num * 1000;
  return null;
};

// ─── Selectors ──────────────────────────────────────────────

const selectIntervalById = (id: string) => (snapshot: any) =>
  snapshot.context.workout.intervalsById[id] as Interval;

const selectIsSelected = (id: string) => (snapshot: any) =>
  !!snapshot.context.selectedIntervals[id];

// ─── Inline Editable Label ──────────────────────────────────
// foreignObject-based inline input for editing power/duration
// right on the block. Click to edit, Enter/blur to commit.

function InlineEdit({
  x,
  y,
  width,
  height,
  value,
  onCommit,
  className,
  align = "center",
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  align?: "center" | "left" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraft(value);
      setEditing(true);
    },
    [value],
  );

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft.trim() && draft !== value) {
      onCommit(draft.trim());
    }
  }, [draft, value, onCommit]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") commit();
      if (e.key === "Escape") setEditing(false);
    },
    [commit],
  );

  const textAlign =
    align === "left"
      ? "text-left"
      : align === "right"
        ? "text-right"
        : "text-center";

  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className={`bg-white/10 backdrop-blur-sm text-white rounded px-1 w-full h-full outline-none border border-white/20 font-display font-bold tabular-nums ${textAlign}`}
          style={{ fontSize: "inherit" }}
        />
      ) : (
        <div
          onClick={startEditing}
          className={classNames(
            "cursor-text w-full h-full flex items-center select-none",
            align === "center" && "justify-center",
            align === "left" && "justify-start",
            align === "right" && "justify-end",
            className,
          )}
        >
          {value}
        </div>
      )}
    </foreignObject>
  );
}

// ─── Interval Adjusters ─────────────────────────────────────

function PowerAdjuster({ id, offset, pp }: { id: string; offset: number; pp: number }) {
  const appActor = useAppActor();
  const editorActor = appActor.system.get("editor");
  const interval = useSelector(editorActor, selectIntervalById(id));

  const bind = useDrag(
    ({ down, delta: [, x], last }) => {
      if (down || last) {
        const fromPower = interval.targets.power.at(0);
        const toPower = interval.targets.power.at(1);
        const newFromPower = fromPower - x / pp;
        const newToPower = toPower - x / pp;
        const targetFromPower = last
          ? stickToSteps(newFromPower, powerStep)
          : newFromPower;
        const targetToPower = last
          ? stickToSteps(newToPower, powerStep)
          : newToPower;
        editorActor.send({
          type: "UPDATE_INTERVAL_POWER",
          id,
          power: [targetFromPower, targetToPower],
        });
      }
    },
    { from: () => [0, interval.targets.power.at(0)] },
  );

  return (
    <line
      {...bind()}
      x1={offset}
      x2={offset + interval.duration / 1000}
      y1={clampY(interval.targets.power.at(0), pp)}
      y2={clampY(interval.targets.power.at(1), pp)}
      stroke="white"
      strokeWidth="14"
      strokeLinecap="round"
      className="opacity-[0.08] hover:opacity-30 transition-opacity duration-150 touch-none cursor-ns-resize"
    />
  );
}

function FromPowerAdjuster({ id, offset, pp }: { id: string; offset: number; pp: number }) {
  const appActor = useAppActor();
  const editorActor = appActor.system.get("editor");
  const interval = useSelector(editorActor, selectIntervalById(id));

  const bind = useDrag(
    ({ down, delta: [, x], last }) => {
      if (down || last) {
        const fromPower = interval.targets.power.at(0);
        const newFromPower = fromPower - x / pp;
        const targetFromPower = last
          ? stickToSteps(newFromPower, powerStep)
          : newFromPower;
        editorActor.send({
          type: "UPDATE_INTERVAL_POWER",
          id,
          power: [targetFromPower, interval.targets.power.at(1)],
        });
      }
    },
    { from: () => [0, interval.targets.power.at(0)] },
  );

  const onDoubleClick = useCallback(() => {
    const toPower = interval.targets.power.at(1);
    editorActor.send({
      type: "UPDATE_INTERVAL_POWER",
      id,
      power: [toPower, toPower],
    });
  }, [editorActor, id, interval.targets.power]);

  return (
    <circle
      {...bind()}
      onDoubleClick={onDoubleClick}
      cx={offset}
      cy={clampY(interval.targets.power.at(0), pp)}
      r="8"
      fill="white"
      stroke="white"
      strokeWidth="4"
      className="opacity-20 hover:opacity-60 transition-opacity duration-150 touch-none cursor-ns-resize"
    />
  );
}

function ToPowerAdjuster({ id, offset, pp }: { id: string; offset: number; pp: number }) {
  const appActor = useAppActor();
  const editorActor = appActor.system.get("editor");
  const interval = useSelector(editorActor, selectIntervalById(id));

  const bind = useDrag(
    ({ down, delta: [, x], last }) => {
      if (down || last) {
        const toPower = interval.targets.power.at(1);
        const newToPower = toPower - x / pp;
        const targetToPower = last
          ? stickToSteps(newToPower, powerStep)
          : newToPower;
        editorActor.send({
          type: "UPDATE_INTERVAL_POWER",
          id,
          power: [interval.targets.power.at(0), targetToPower],
        });
      }
    },
    { from: () => [0, interval.targets.power.at(1)] },
  );

  const onDoubleClick = useCallback(() => {
    const fromPower = interval.targets.power.at(0);
    editorActor.send({
      type: "UPDATE_INTERVAL_POWER",
      id,
      power: [fromPower, fromPower],
    });
  }, [editorActor, id, interval.targets.power]);

  return (
    <circle
      {...bind()}
      onDoubleClick={onDoubleClick}
      cx={offset + interval.duration / 1000}
      cy={clampY(interval.targets.power.at(1), pp)}
      r="8"
      fill="white"
      stroke="white"
      strokeWidth="4"
      className="opacity-20 hover:opacity-60 transition-opacity duration-150 touch-none cursor-ns-resize"
    />
  );
}

function DurationAdjuster({ id, offset, pp }: { id: string; offset: number; pp: number }) {
  const appActor = useAppActor();
  const editorActor = appActor.system.get("editor");
  const interval = useSelector(editorActor, selectIntervalById(id));

  const bind = useDrag(
    ({ down, delta: [y], last }) => {
      if (down || last) {
        const rawDuration = interval.duration + y * 1000;
        const duration = last
          ? stickToSteps(rawDuration, durationStep)
          : rawDuration;
        editorActor.send({
          type: "UPDATE_INTERVAL_DURATION",
          id,
          duration,
        });
      }
    },
    { from: () => [interval.duration, 0] },
  );

  const containerHeight = maxFtpPercentageShown * pp;

  return (
    <line
      {...bind()}
      x1={offset + interval.duration / 1000}
      x2={offset + interval.duration / 1000}
      y1={clampY(interval.targets.power.at(1), pp)}
      y2={containerHeight}
      stroke="white"
      strokeWidth="14"
      strokeLinecap="round"
      className="opacity-[0.08] hover:opacity-30 transition-opacity duration-150 touch-none cursor-ew-resize"
    />
  );
}

// ─── Interval Block ─────────────────────────────────────────
// Zone-colored blocks with inline labels for power and duration.

function IntervalBlock({ id, offset, pp }: { id: string; offset: number; pp: number }) {
  const appActor = useAppActor();
  const editorActor = appActor.system.get("editor");
  const interval = useSelector(editorActor, selectIntervalById(id));
  const isSelected = useSelector(editorActor, selectIsSelected(id));

  const onSelect = useCallback(
    (event: MouseEvent<SVGPolygonElement>) => {
      if (event.target === event.currentTarget) {
        editorActor.send({
          type: "SELECT_INTERVAL",
          id,
          additive: event.shiftKey,
        });
      }
    },
    [editorActor, id],
  );

  const fromPercent = interval.targets.power.at(0);
  const toPercent = interval.targets.power.at(1);
  const avgPercent = (fromPercent + toPercent) / 2;
  const fill = getZoneColor(avgPercent);
  const accent = getZoneAccent(avgPercent);
  const isRamp = Math.abs(fromPercent - toPercent) >= 1;
  const blockWidth = interval.duration / 1000;

  // Polygon points — clamp to visible range, scaled by pp
  const containerHeight = maxFtpPercentageShown * pp;
  const y1 = clampY(fromPercent, pp);
  const y2 = containerHeight;
  const y3 = containerHeight;
  const y4 = clampY(toPercent, pp);

  const points = `${offset},${y1} ${offset},${y2} ${offset + blockWidth},${y3} ${offset + blockWidth},${y4}`;

  const filterId = `glow-${id}`;

  // ── Label positioning ──
  const labelFontSize = Math.min(11, Math.max(7, blockWidth * 0.3));
  const labelH = 14;
  const minPower = Math.min(fromPercent, toPercent);
  const blockVisualHeight = Math.min(minPower, maxFtpPercentageShown) * pp;

  // Duration label at the bottom of the block
  const durationLabelY = containerHeight - labelH - 2;

  // Power labels near the top. For ramps, show from on left, to on right.
  // For steady, show single value centered.
  const powerLabelY = clampY(Math.max(fromPercent, toPercent), pp) - labelH - 2;

  // Commit handlers for inline editing
  const onCommitFromPower = useCallback(
    (val: string) => {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) {
        editorActor.send({
          type: "UPDATE_INTERVAL_POWER",
          id,
          power: [n, toPercent],
        });
      }
    },
    [editorActor, id, toPercent],
  );

  const onCommitToPower = useCallback(
    (val: string) => {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) {
        editorActor.send({
          type: "UPDATE_INTERVAL_POWER",
          id,
          power: [fromPercent, n],
        });
      }
    },
    [editorActor, id, fromPercent],
  );

  const onCommitPower = useCallback(
    (val: string) => {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) {
        editorActor.send({
          type: "UPDATE_INTERVAL_POWER",
          id,
          power: [n, n],
        });
      }
    },
    [editorActor, id],
  );

  const onCommitDuration = useCallback(
    (val: string) => {
      const ms = parseDuration(val);
      if (ms != null && ms >= 1000) {
        editorActor.send({
          type: "UPDATE_INTERVAL_DURATION",
          id,
          duration: stickToSteps(ms, durationStep),
        });
      }
    },
    [editorActor, id],
  );

  // Only show labels if block is wide enough
  const showLabels = blockWidth >= 20;

  return (
    <>
      {isSelected && (
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feFlood floodColor={accent} floodOpacity="0.4" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <polygon
        className="cursor-pointer transition-all duration-200"
        style={{
          opacity: isSelected ? 1 : 0.5,
          filter: isSelected ? `url(#${filterId})` : undefined,
        }}
        points={points}
        onClick={onSelect}
        tabIndex={0}
        fill={isSelected ? accent : fill}
        fillOpacity={isSelected ? 0.55 : 1}
        stroke={isSelected ? accent : "transparent"}
        strokeWidth={isSelected ? "2" : "0"}
      />

      {/* ── Labels ── */}
      {showLabels && (
        <g style={{ fontSize: `${labelFontSize}px` }}>
          {/* Power label(s) */}
          {isRamp ? (
            <>
              {/* From power — left side */}
              <InlineEdit
                x={offset + 2}
                y={Math.max(powerLabelY, 0)}
                width={blockWidth / 2 - 2}
                height={labelH}
                value={`${Math.round(fromPercent)}%`}
                onCommit={onCommitFromPower}
                className="font-display font-bold tabular-nums text-white/60"
                align="left"
              />
              {/* To power — right side */}
              <InlineEdit
                x={offset + blockWidth / 2}
                y={Math.max(powerLabelY, 0)}
                width={blockWidth / 2 - 2}
                height={labelH}
                value={`${Math.round(toPercent)}%`}
                onCommit={onCommitToPower}
                className="font-display font-bold tabular-nums text-white/60"
                align="right"
              />
            </>
          ) : (
            <InlineEdit
              x={offset + 2}
              y={Math.max(powerLabelY, 0)}
              width={blockWidth - 4}
              height={labelH}
              value={`${Math.round(fromPercent)}%`}
              onCommit={onCommitPower}
              className="font-display font-bold tabular-nums text-white/60"
            />
          )}

          {/* Duration label — bottom of block */}
          {blockVisualHeight > labelH * 2 + 8 && (
            <InlineEdit
              x={offset + 2}
              y={durationLabelY}
              width={blockWidth - 4}
              height={labelH}
              value={formatDuration(interval.duration)}
              onCommit={onCommitDuration}
              className="font-display font-bold tabular-nums text-white/30"
            />
          )}
        </g>
      )}

      <DurationAdjuster id={id} offset={offset} pp={pp} />
      <PowerAdjuster id={id} offset={offset} pp={pp} />
      <FromPowerAdjuster id={id} offset={offset} pp={pp} />
      <ToPowerAdjuster id={id} offset={offset} pp={pp} />
    </>
  );
}

// ─── Time Formatting ────────────────────────────────────────

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
  if (workingZone < 60) return "Recovery";
  if (workingZone < 75) return "Endurance";
  if (workingZone < 90) return "Tempo";
  if (workingZone < 105) return "Threshold";
  if (workingZone < 120) return "VO2max";
  if (workingZone < 130) return "Anaerobic";
  return "Sprint";
};

// ─── Stats Panel ────────────────────────────────────────────

const selectWorkoutStats = (snapshot: any) =>
  selectStats(snapshot.context.workout);

function StatItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.5rem] uppercase tracking-[0.18em] text-white/20 font-medium leading-none">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-sm font-bold tabular-nums text-white/70 leading-none font-display">
          {value}
        </span>
        {unit && (
          <span className="text-[0.5rem] text-white/25 font-medium leading-none uppercase tracking-wider">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Stats() {
  const appActor = useAppActor();
  const editorActor = appActor.system.get("editor");
  const {
    duration,
    intensity,
    trainingStress,
    power,
    workingTime,
    workingZone,
  } = useSelector(editorActor, selectWorkoutStats);

  const zoneName = getWorkingZoneNames(workingZone);
  const zoneColor = getZoneAccent(workingZone);

  return (
    <div className="fixed top-16 right-4 md:right-6 z-30 rounded-2xl bg-neutral-950/90 border border-white/[0.06] backdrop-blur-sm p-4 md:p-5 flex flex-col gap-3 min-w-[140px]">
      <StatItem label="Duration" value={formatTime(duration)} />
      <StatItem label="Avg Power" value={power.toFixed(0)} unit="W" />
      <StatItem label="IF" value={intensity.toFixed(2)} />
      <StatItem label="TSS" value={trainingStress.toFixed(0)} />
      <StatItem label="Work Time" value={formatTime(workingTime)} />
      <div className="flex flex-col gap-0.5">
        <span className="text-[0.5rem] uppercase tracking-[0.18em] text-white/20 font-medium leading-none">
          Zone
        </span>
        <span
          className="text-sm font-bold leading-none font-display"
          style={{ color: zoneColor }}
        >
          {zoneName}
        </span>
      </div>
    </div>
  );
}

// ─── FTP Line ───────────────────────────────────────────────

function FTPLine({ pp }: { pp: number }) {
  const ftp = 100;
  return (
    <div
      style={{ "--ftp": `${ftp * pp}px` } as CSSProperties}
      className="absolute bottom-[var(--ftp)] left-0 w-full pointer-events-none flex items-center"
    >
      <div
        className="w-full h-px"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(248,113,113,0.3), rgba(248,113,113,0.3) 6px, transparent 6px, transparent 10px)",
        }}
      />
      <span className="absolute right-2 text-[0.5rem] uppercase tracking-[0.15em] text-red-400/30 font-bold whitespace-nowrap">
        FTP
      </span>
    </div>
  );
}

// ─── Toolbar Button ─────────────────────────────────────────

function ToolbarButton({
  onClick,
  children,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.96] text-white/40 hover:text-white/60 text-xs font-bold font-display transition-all touch-manipulation select-none"
    >
      {children}
    </button>
  );
}

// ─── Main Editor ────────────────────────────────────────────

const getIntervalsWidth = (intervals: Interval[]) => {
  return (
    intervals.reduce((acc, interval) => {
      return acc + interval.duration;
    }, 0) / 1000
  );
};

const selectWorkout = (snapshot: any) => snapshot.context.workout;

export default function Editor() {
  const appActor = useAppActor();
  const editorActor = appActor.system.get("editor");
  const workout = useSelector(editorActor, selectWorkout);

  // ── Dynamic scaling: fill available height ──
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState(maxFtpPercentageShown);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setGridHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const pp = gridHeight / maxFtpPercentageShown; // pixels per FTP %

  const onNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      editorActor.send({ type: "UPDATE_NAME", name: event.target.value });
    },
    [editorActor],
  );

  const onAddInterval = useCallback(() => {
    editorActor.send({ type: "ADD_INTERVAL" });
  }, [editorActor]);

  const onDuplicateInterval = useCallback(() => {
    editorActor.send({ type: "DUPLICATE_SELECTED" });
  }, [editorActor]);

  const onDeleteInterval = useCallback(() => {
    editorActor.send({ type: "DELETE_SELECTED" });
  }, [editorActor]);

  const onSave = useCallback(() => {
    editorActor.send({ type: "SAVE", format: "cwo" });
  }, [editorActor]);

  const onSaveMrc = useCallback(() => {
    editorActor.send({ type: "SAVE", format: "mrc" });
  }, [editorActor]);

  const onLoad = useCallback(() => {
    editorActor.send({ type: "LOAD" });
  }, [editorActor]);

  const onClearSelection = useCallback(() => {
    editorActor.send({ type: "CLEAR_SELECTION" });
  }, [editorActor]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + D → duplicate selected
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        onDuplicateInterval();
      }
      // Delete/Backspace → delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as HTMLElement)?.tagName === "INPUT") return;
        e.preventDefault();
        onDeleteInterval();
      }
      // Escape → clear selection
      if (e.key === "Escape") {
        onClearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDuplicateInterval, onDeleteInterval, onClearSelection]);

  const intervalProps = useMemo(() => {
    const props: { id: string; offset: number }[] = [];
    let offset = 0;
    workout.intervalIds.forEach((id: string) => {
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
    <div className="h-screen w-full flex flex-col bg-black text-white overflow-hidden select-none">
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 80%, rgba(96,165,250,0.03), transparent)",
        }}
      />

      {/* ── Header ── */}
      <header className="relative z-20 flex items-center justify-between px-4 md:px-6 h-14 shrink-0 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <Logo className="text-sm" />
          </Link>
          <div className="w-px h-5 bg-white/[0.08]" />
          <input
            className="bg-transparent text-lg md:text-xl font-display font-bold text-white/80 placeholder:text-white/20 focus:outline-none border-b border-transparent focus:border-white/20 transition-all pb-0.5"
            value={workout.name}
            onChange={onNameChange}
            placeholder="Untitled Workout"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <ToolbarButton onClick={onAddInterval} title="Add interval">
            + Add
          </ToolbarButton>
          <ToolbarButton onClick={onDuplicateInterval} title="Duplicate selected (Ctrl+D)">
            Dup
          </ToolbarButton>
          <ToolbarButton onClick={onDeleteInterval} title="Delete selected (Del)">
            Del
          </ToolbarButton>
          <div className="w-px h-5 bg-white/[0.06] mx-1" />
          <ToolbarButton onClick={onLoad} title="Load workout">
            Load
          </ToolbarButton>
          <ToolbarButton onClick={onSave} title="Save as CWO">
            Save
          </ToolbarButton>
          <ToolbarButton onClick={onSaveMrc} title="Save as MRC">
            MRC
          </ToolbarButton>
        </div>
      </header>

      {/* ── Canvas ── */}
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden relative z-10"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClearSelection();
        }}
      >
        <div
          ref={gridRef}
          className="flex items-end relative min-w-fit h-full"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, transparent, transparent 99%, rgba(255,255,255,0.03), rgba(255,255,255,0.03) 100%), linear-gradient(to right, transparent, transparent 99%, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 100%)",
            backgroundSize: `60px ${100 * pp}px`,
            backgroundPosition: "0 bottom",
          } as React.CSSProperties}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClearSelection();
          }}
        >
          <FTPLine pp={pp} />
          <svg
            style={{
              width,
              minWidth: width,
              height: "100%",
              overflow: "visible",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClearSelection();
            }}
          >
            {intervalProps.map((props) => (
              <IntervalBlock key={props.id} {...props} pp={pp} />
            ))}
          </svg>
          <button
            onClick={onAddInterval}
            type="button"
            style={{ height: `${100 * pp}px` }}
            className="w-[200px] flex-shrink-0 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/[0.08] hover:border-white/[0.15] text-white/15 hover:text-white/30 text-4xl font-display font-bold transition-all touch-manipulation self-end"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Stats Overlay ── */}
      <Stats />
    </div>
  );
}
