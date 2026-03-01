"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "@xstate/react";
import type { SnapshotFrom } from "xstate";

import UploadButton from "@/modules/strava/UploadButton";
import SaveButton from "@/modules/workout/SaveButton";
import Visualiser from "@/modules/workout/Visualiser";
import { useAppActor } from "@/machines/context";
import {
  selectDevices,
  selectSavedDevices,
  selectShowTestDevice,
} from "@/machines/devices";
import { loadEditorWorkout } from "@/machines/workoutEditor";
import { setMuted, isMuted, playComplete } from "@/utils/beep";
import {
  selectIsRunning,
  selectTcx,
  selectCurrentPower,
  selectCurrentHeartRate,
  selectCurrentCadence,
  selectCurrentSpeed,
  selectTargetPowerFromSnapshot,
  selectNextTargetPower,
  selectElapsedTime,
  selectTimeUntilNextIntervalFromSnapshot,
  selectTimeUntilWorkoutEnd,
  selectWorkout,
  selectFtp,
  selectFinishedAt,
  selectTotalTime,
  selectCurrentTextBlocks,
  type WorkoutMachine,
} from "@/machines/workout";

type WorkoutSnapshot = SnapshotFrom<WorkoutMachine>;

// ─── Zone System ───────────────────────────────────────────

type ZoneInfo = {
  name: string;
  label: string;
  color: string;
  glow: string;
  bg: string;
};

const ZONES: { max: number; info: ZoneInfo }[] = [
  {
    max: 55,
    info: {
      name: "Z1",
      label: "Recovery",
      color: "#94a3b8",
      glow: "rgba(148,163,184,0.3)",
      bg: "rgba(148,163,184,0.05)",
    },
  },
  {
    max: 75,
    info: {
      name: "Z2",
      label: "Endurance",
      color: "#60a5fa",
      glow: "rgba(96,165,250,0.3)",
      bg: "rgba(96,165,250,0.05)",
    },
  },
  {
    max: 90,
    info: {
      name: "Z3",
      label: "Tempo",
      color: "#34d399",
      glow: "rgba(52,211,153,0.3)",
      bg: "rgba(52,211,153,0.06)",
    },
  },
  {
    max: 105,
    info: {
      name: "Z4",
      label: "Threshold",
      color: "#fbbf24",
      glow: "rgba(251,191,36,0.3)",
      bg: "rgba(251,191,36,0.06)",
    },
  },
  {
    max: 120,
    info: {
      name: "Z5",
      label: "VO2max",
      color: "#f97316",
      glow: "rgba(249,115,22,0.4)",
      bg: "rgba(249,115,22,0.07)",
    },
  },
  {
    max: 150,
    info: {
      name: "Z6",
      label: "Anaerobic",
      color: "#ef4444",
      glow: "rgba(239,68,68,0.4)",
      bg: "rgba(239,68,68,0.07)",
    },
  },
  {
    max: Infinity,
    info: {
      name: "Z7",
      label: "Sprint",
      color: "#c084fc",
      glow: "rgba(192,132,252,0.4)",
      bg: "rgba(192,132,252,0.07)",
    },
  },
];

const NO_ZONE: ZoneInfo = {
  name: "--",
  label: "",
  color: "#6b7280",
  glow: "rgba(107,114,128,0.15)",
  bg: "rgba(107,114,128,0.03)",
};

function getZone(power: number | undefined | null, ftp: number): ZoneInfo {
  if (!power || !ftp) return NO_ZONE;
  const pct = (power / ftp) * 100;
  for (const z of ZONES) {
    if (pct <= z.max) return z.info;
  }
  return ZONES[ZONES.length - 1].info;
}

// ─── Time Formatting ───────────────────────────────────────

function formatTime(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ─── Shared Hook ───────────────────────────────────────────

function useWorkoutActor() {
  const appActor = useAppActor();
  return appActor.system.get("workout");
}

// ─── Metric Display ────────────────────────────────────────

function Metric({
  label,
  selector,
  unit,
  decimals = 0,
}: {
  label: string;
  selector: (s: WorkoutSnapshot) => number | string | undefined | null;
  unit: string;
  decimals?: number;
}) {
  const workoutActor = useWorkoutActor();
  const raw = useSelector(workoutActor, selector);

  const display =
    raw == null
      ? "--"
      : typeof raw === "number"
        ? raw.toFixed(decimals)
        : raw;

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 min-w-0">
      <span className="text-[0.55rem] md:text-[0.6rem] uppercase tracking-[0.18em] text-white/20 font-medium leading-none">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[1.65rem] md:text-[2.75rem] font-bold tabular-nums text-white/80 leading-none font-display">
          {display}
        </span>
        <span className="text-[0.55rem] md:text-[0.65rem] text-white/25 font-medium leading-none uppercase tracking-wider">
          {unit}
        </span>
      </div>
    </div>
  );
}

// ─── Power Hero ────────────────────────────────────────────

function PowerHero() {
  const workoutActor = useWorkoutActor();
  const power = useSelector(workoutActor, selectCurrentPower);
  const target = useSelector(workoutActor, selectTargetPowerFromSnapshot);
  const ftp = useSelector(workoutActor, selectFtp);

  const zone = getZone(power, ftp);
  const delta =
    power != null && target != null ? Math.round(power - target) : null;
  const ratio =
    power != null && target != null && target > 0 ? power / target : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-4 relative">
      {/* Zone badge */}
      <div
        className="text-[0.55rem] md:text-[0.65rem] font-bold uppercase tracking-[0.25em] px-3 py-1 rounded-full transition-colors duration-700"
        style={{
          color: zone.color,
          backgroundColor: zone.bg,
          boxShadow: `0 0 24px ${zone.bg}`,
        }}
      >
        {zone.name}
        {zone.label && (
          <span className="ml-1.5 hidden sm:inline">{zone.label}</span>
        )}
      </div>

      {/* The number */}
      <div className="flex items-baseline mt-1 md:mt-2">
        <span
          className="text-[5.5rem] sm:text-[7rem] md:text-[9rem] lg:text-[11rem] font-display font-black tabular-nums leading-[0.82] transition-colors duration-500"
          style={{
            color: zone.color,
            textShadow: `0 0 80px ${zone.glow}, 0 4px 120px ${zone.bg}`,
          }}
        >
          {power != null ? Math.round(power) : "--"}
        </span>
        <span
          className="text-lg md:text-2xl font-bold ml-0.5 self-end mb-2 md:mb-4 transition-colors duration-500"
          style={{ color: `${zone.color}50` }}
        >
          W
        </span>
      </div>

      {/* Target + delta */}
      {target != null && (
        <div className="flex items-center gap-3 mt-0.5 md:mt-1.5">
          <span className="text-xs md:text-sm text-white/25 tabular-nums font-medium">
            {Math.round(target)}W target
          </span>
          {delta != null && (
            <span
              className="text-xs md:text-sm font-bold tabular-nums"
              style={{
                color:
                  Math.abs(delta) <= target * 0.03
                    ? "#4ade80"
                    : delta > 0
                      ? "#fbbf24"
                      : "#f87171",
              }}
            >
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
      )}

      {/* Power gauge */}
      {ratio != null && (
        <div className="w-full max-w-[260px] md:max-w-[340px] mt-3 md:mt-4">
          <div className="relative h-[3px] md:h-1 rounded-full bg-white/[0.05]">
            {/* Fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(ratio * 100, 150)}%`,
                backgroundColor: zone.color,
                opacity: 0.65,
                boxShadow: `0 0 12px ${zone.glow}`,
              }}
            />
            {/* 100% marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 md:h-3 bg-white/30 rounded-full"
              style={{ left: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Time Strip ────────────────────────────────────────────

function TimeStrip() {
  const workoutActor = useWorkoutActor();
  const elapsed = useSelector(workoutActor, selectElapsedTime);
  const remaining = useSelector(workoutActor, selectTimeUntilWorkoutEnd);
  const nextInterval = useSelector(
    workoutActor,
    selectTimeUntilNextIntervalFromSnapshot,
  );

  return (
    <div className="flex items-end justify-between px-4 md:px-8 pt-3 pb-1 md:pt-4 md:pb-2 shrink-0">
      <div className="flex flex-col items-start gap-0.5">
        <span className="text-[0.5rem] uppercase tracking-[0.18em] text-white/15 leading-none">
          Elapsed
        </span>
        <span className="text-sm md:text-lg font-bold tabular-nums text-white/60 leading-none">
          {formatTime(elapsed)}
        </span>
      </div>

      {nextInterval != null && (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[0.5rem] uppercase tracking-[0.18em] text-white/15 leading-none">
            Next in
          </span>
          <span className="text-sm md:text-lg font-bold tabular-nums leading-none" style={{ color: "rgba(251,191,36,0.6)" }}>
            {formatTime(nextInterval)}
          </span>
        </div>
      )}

      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[0.5rem] uppercase tracking-[0.18em] text-white/15 leading-none">
          Remaining
        </span>
        <span className="text-sm md:text-lg font-bold tabular-nums text-white/60 leading-none">
          {remaining != null ? formatTime(remaining) : "--:--"}
        </span>
      </div>
    </div>
  );
}

// ─── Controls ──────────────────────────────────────────────

function WorkoutControls({
  isRunning,
  isPaused,
  hasWorkout,
  isMutedState,
  onStart,
  onFinish,
  onTogglePause,
  onToggleMute,
  onOpenDevices,
}: {
  isRunning: boolean;
  isPaused: boolean;
  hasWorkout: boolean;
  isMutedState: boolean;
  onStart: () => void;
  onFinish: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onOpenDevices: () => void;
}) {
  const btnBase =
    "h-[4.5rem] md:h-20 rounded-2xl bg-white/[0.03] active:bg-white/[0.07] active:scale-[0.96] text-white/35 font-display font-bold transition-all touch-manipulation select-none";

  return (
    <div className="shrink-0 p-2 md:p-3 flex flex-col gap-1.5 md:gap-2">
      {hasWorkout && (
      <div className="grid grid-cols-4 gap-1.5 md:gap-2">
        <button
          className={`${btnBase} text-xl md:text-2xl`}
          aria-label="Decrease power by 5 watts"
        >
          -5
        </button>

        {isRunning ? (
          <>
            <button
              onClick={onTogglePause}
              className={`h-[4.5rem] md:h-20 rounded-2xl text-xl md:text-2xl font-display font-bold transition-all touch-manipulation select-none active:scale-[0.96] ${
                isPaused
                  ? "bg-emerald-500/15 active:bg-emerald-500/25 text-emerald-400"
                  : "bg-amber-400/10 active:bg-amber-400/20 text-amber-400/80"
              }`}
              aria-label={isPaused ? "Resume workout" : "Pause workout"}
            >
              {isPaused ? "GO" : "PAUSE"}
            </button>
            <button
              onClick={onFinish}
              className="h-[4.5rem] md:h-20 rounded-2xl bg-red-500/8 active:bg-red-500/15 active:scale-[0.96] text-red-400/70 text-xl md:text-2xl font-display font-bold transition-all touch-manipulation select-none"
              aria-label="End workout"
            >
              END
            </button>
          </>
        ) : (
          <button
            onClick={onStart}
            className="h-[4.5rem] md:h-20 rounded-2xl bg-emerald-500/10 active:bg-emerald-500/20 active:scale-[0.96] text-emerald-400/90 text-2xl md:text-3xl font-display font-black col-span-2 transition-all touch-manipulation select-none"
            aria-label="Start workout"
          >
            START
          </button>
        )}

        <button
          className={`${btnBase} text-xl md:text-2xl`}
          aria-label="Increase power by 5 watts"
        >
          +5
        </button>
      </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 md:gap-2">
        <button
          onClick={onToggleMute}
          className={`${btnBase} h-12 md:h-14 flex items-center justify-center gap-2 text-sm md:text-base`}
          aria-label={isMutedState ? "Unmute sounds" : "Mute sounds"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            {isMutedState ? (
              <>
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            )}
          </svg>
          {isMutedState ? "MUTED" : "SOUND"}
        </button>
        <button
          onClick={onOpenDevices}
          className={`${btnBase} h-12 md:h-14 flex items-center justify-center gap-2 text-sm md:text-base`}
          aria-label="Devices"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 6.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0" />
            <path d="M17.5 17.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0" />
            <path d="M6.5 10l11 4" />
          </svg>
          DEVICES
        </button>
      </div>
    </div>
  );
}

// ─── Ambient Zone Glow ─────────────────────────────────────

function ZoneAmbience({ zone }: { zone: ZoneInfo }) {
  return (
    <div
      className="fixed inset-0 pointer-events-none transition-all duration-[1200ms] ease-in-out"
      style={{
        background: `radial-gradient(ellipse 90% 70% at 50% 30%, ${zone.bg}, transparent)`,
      }}
    />
  );
}

// ─── Pause Overlay ─────────────────────────────────────────

function PauseOverlay() {
  return (
    <div className="absolute inset-0 z-40 bg-black/60 flex items-center justify-center">
      <span
        className="text-[3.5rem] md:text-[5rem] font-display font-black text-white/[0.07] uppercase tracking-[0.4em] select-none"
      >
        Paused
      </span>
    </div>
  );
}

// ─── Devices Dialog ────────────────────────────────────────

function DevicesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const appActor = useAppActor();
  const devicesActor = appActor.system.get("devices");
  const devices = useSelector(devicesActor, selectDevices);
  const savedDevices = useSelector(devicesActor, selectSavedDevices);
  const showTestDevice = useSelector(devicesActor, selectShowTestDevice);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const onSearchAll = useCallback(() => {
    devicesActor.send({ type: "SEARCH_ALL" });
  }, [devicesActor]);

  const onConnectTest = useCallback(() => {
    devicesActor.send({ type: "CONNECT_TEST" });
    onClose();
  }, [devicesActor, onClose]);

  const onReconnect = useCallback(
    (deviceId: string) => {
      devicesActor.send({ type: "RECONNECT", deviceId });
      onClose();
    },
    [devicesActor, onClose],
  );

  const onDisconnect = useCallback(() => {
    devicesActor.send({ type: "DISCONNECT" });
  }, [devicesActor]);

  // Sync open state with the <dialog> element
  if (dialogRef.current) {
    if (open && !dialogRef.current.open) dialogRef.current.showModal();
    if (!open && dialogRef.current.open) dialogRef.current.close();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto bg-neutral-950 border border-white/10 rounded-2xl w-[90vw] max-w-md p-5 text-white backdrop:fixed backdrop:inset-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-white/80">
            Devices
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {devices.length === 0 ? (
          <p className="text-sm text-white/30 mb-4">No devices connected</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {devices.map((device) => (
              <li
                key={device.id}
                className="rounded-xl bg-white/[0.04] px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-white/70">
                    {device.name}
                  </div>
                  <button
                    onClick={onDisconnect}
                    className="text-xs text-white/25 hover:text-red-400/70 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  {Object.entries(device.values).map(([key, value]) => (
                    <span
                      key={key}
                      className="text-xs text-white/35 tabular-nums"
                    >
                      {key}: {typeof value === "number" ? value.toFixed(0) : value}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Available devices (saved + test) */}
        {(savedDevices.length > 0 || showTestDevice) && (
          <div className="mb-4">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/20 font-medium mb-2">
              Available
            </div>
            <ul className="space-y-2">
              {savedDevices.map((device) => (
                <li
                  key={device.id}
                  className="rounded-xl bg-white/[0.03] px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-bold text-white/50">
                      {device.name}
                    </div>
                    <div className="text-xs text-white/20">{device.type}</div>
                  </div>
                  <button
                    onClick={() => onReconnect(device.id)}
                    className="text-xs font-bold text-white/40 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg bg-white/[0.04] active:bg-white/[0.08]"
                  >
                    Connect
                  </button>
                </li>
              ))}
              {showTestDevice && (
                <li className="rounded-xl bg-yellow-500/[0.04] border border-yellow-500/10 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-yellow-400/70">
                      TEST Trainer
                    </div>
                    <div className="text-xs text-yellow-500/30">
                      Simulated device
                    </div>
                  </div>
                  <button
                    onClick={onConnectTest}
                    className="text-xs font-bold text-yellow-400/50 hover:text-yellow-400/80 transition-colors px-3 py-1.5 rounded-lg bg-yellow-400/[0.06] active:bg-yellow-400/[0.12]"
                  >
                    Connect
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        <button
          onClick={onSearchAll}
          className="w-full py-3 rounded-xl bg-white/[0.05] active:bg-white/[0.1] text-white/50 text-sm font-bold transition-colors touch-manipulation"
        >
          Search for Devices
        </button>
      </div>
    </dialog>
  );
}


// ─── Idle Screen ───────────────────────────────────────────

function IdleScreen({ onLoad, onLoadFromEditor }: { onLoad: () => void; onLoadFromEditor: () => void }) {
  const [editorWorkoutName, setEditorWorkoutName] = useState<string | null>(null);

  useEffect(() => {
    const w = loadEditorWorkout();
    if (w && w.intervalIds.length > 0) {
      setEditorWorkoutName(w.name || "Untitled Workout");
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <h1 className="text-4xl md:text-6xl font-display font-black text-white/90 leading-tight tracking-tight">
          Ready to ride
        </h1>
        <p className="text-sm md:text-base text-white/25 mt-3 font-medium">
          Load a workout to begin
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onLoad}
          className="px-10 py-5 md:px-14 md:py-7 rounded-2xl bg-white/[0.04] active:bg-white/[0.08] active:scale-[0.98] text-white/70 text-xl md:text-2xl font-display font-bold transition-all touch-manipulation select-none"
        >
          Load Workout
        </button>
        {editorWorkoutName && (
          <button
            onClick={onLoadFromEditor}
            className="px-8 py-5 md:px-10 md:py-7 rounded-2xl bg-white/[0.04] active:bg-white/[0.08] active:scale-[0.98] transition-all touch-manipulation select-none flex flex-col items-center gap-1"
          >
            <span className="text-[0.55rem] uppercase tracking-[0.18em] text-white/20 font-medium leading-none">
              Last edited
            </span>
            <span className="text-lg md:text-xl font-display font-bold text-white/70 leading-tight">
              {editorWorkoutName}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Finished Screen ───────────────────────────────────────

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const colors = [
      "#34d399", "#60a5fa", "#fbbf24", "#f97316",
      "#c084fc", "#ef4444", "#38bdf8", "#a3e635",
    ];

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      w: number; h: number;
      color: string;
      rotation: number; spin: number;
      opacity: number;
      drag: number;
    };

    const particles: Particle[] = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: w * 0.5 + (Math.random() - 0.5) * w * 0.4,
        y: h * 0.35 + (Math.random() - 0.5) * h * 0.1,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 12 - 4,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.3,
        opacity: 1,
        drag: 0.98 + Math.random() * 0.015,
      });
    }

    let raf: number;
    const gravity = 0.18;
    const fadeStart = 2500;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, w, h);

      let alive = false;
      for (const p of particles) {
        p.vy += gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;

        if (elapsed > fadeStart) {
          p.opacity = Math.max(0, p.opacity - 0.012);
        }

        if (p.opacity <= 0) continue;
        alive = true;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (alive) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}

function FinishedScreen({
  tcx,
  onClear,
  onReset,
}: {
  tcx: string | null;
  onClear: () => void;
  onReset: () => void;
}) {
  const workoutActor = useWorkoutActor();
  const totalTime = useSelector(workoutActor, selectTotalTime);

  useEffect(() => {
    playComplete();
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
      <Confetti />

      {/* Completion glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(52,211,153,0.04), transparent)",
        }}
      />

      <div className="text-center relative z-10">
        <div className="text-[0.6rem] uppercase tracking-[0.3em] text-emerald-400/40 font-bold mb-3">
          Workout Complete
        </div>
        <h1
          className="text-5xl md:text-7xl font-display font-black text-emerald-400 leading-none tabular-nums"
          style={{ textShadow: "0 0 60px rgba(52,211,153,0.25)" }}
        >
          {formatTime(totalTime)}
        </h1>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
        <UploadButton tcx={tcx} />
        <SaveButton tcx={tcx} />
        <button
          onClick={onClear}
          className="px-8 py-4 rounded-xl bg-white/[0.03] active:bg-white/[0.06] active:scale-[0.98] text-white/30 text-base font-bold transition-all touch-manipulation select-none"
        >
          Restart
        </button>
        <button
          onClick={onReset}
          className="px-8 py-4 rounded-xl bg-white/[0.03] active:bg-white/[0.06] active:scale-[0.98] text-white/30 text-base font-bold transition-all touch-manipulation select-none"
        >
          New Workout
        </button>
      </div>
    </div>
  );
}

// ─── Text Block Display ───────────────────────────────────

function TextBlockDisplay() {
  const workoutActor = useWorkoutActor();
  const textBlocks = useSelector(workoutActor, selectCurrentTextBlocks);

  if (textBlocks.length === 0) return null;

  return (
    <div className="absolute inset-x-0 top-[3.25rem] md:top-2 flex flex-col items-center gap-1 px-4 py-2 z-20 pointer-events-none">
      {textBlocks.map((block) => (
        <div
          key={block.id}
          className="text-lg md:text-xl font-semibold text-white/70 text-center max-w-lg leading-snug animate-in fade-in duration-300 line-clamp-2"
        >
          {block.text}
        </div>
      ))}
    </div>
  );
}

// ─── HUD (Running & Ready States) ─────────────────────────

function WorkoutHUD({ isPaused }: { isPaused: boolean }) {
  const workoutActor = useWorkoutActor();
  const power = useSelector(workoutActor, selectCurrentPower);
  const ftp = useSelector(workoutActor, selectFtp);
  const zone = getZone(power, ftp);

  return (
    <>
      <ZoneAmbience zone={zone} />
      {isPaused && <PauseOverlay />}

      <TimeStrip />

      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-10">
        <TextBlockDisplay />
        {/* Left sidebar / top row on mobile */}
        <div className="flex md:flex-col items-center justify-around md:justify-center md:gap-12 md:w-44 lg:w-56 px-3 py-1.5 md:py-0 shrink-0">
          <Metric
            label="Heart Rate"
            selector={selectCurrentHeartRate}
            unit="bpm"
          />
          <Metric
            label="Speed"
            selector={selectCurrentSpeed}
            unit="km/h"
            decimals={1}
          />
        </div>

        {/* Power hero — center column */}
        <PowerHero />

        {/* Right sidebar / bottom row on mobile */}
        <div className="flex md:flex-col items-center justify-around md:justify-center md:gap-12 md:w-44 lg:w-56 px-3 py-1.5 md:py-0 shrink-0">
          <Metric
            label="Cadence"
            selector={selectCurrentCadence}
            unit="rpm"
          />
          <Metric label="Next" selector={selectNextTargetPower} unit="W" />
        </div>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function Workout() {
  const workoutActor = useWorkoutActor();

  const workout = useSelector(workoutActor, selectWorkout);
  const isRunning = useSelector(workoutActor, selectIsRunning);
  const finishedAt = useSelector(workoutActor, selectFinishedAt);
  const tcx = useSelector(workoutActor, selectTcx);

  const [isPaused, setIsPaused] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [isMutedState, setIsMutedState] = useState(isMuted);

  const screen = finishedAt
    ? "finished"
    : isRunning
      ? "running"
      : workout
        ? "ready"
        : "idle";

  const onStart = useCallback(() => {
    workoutActor.send({ type: "START" });
  }, [workoutActor]);

  const onFinish = useCallback(() => {
    setIsPaused(false);
    workoutActor.send({ type: "FINISH" });
  }, [workoutActor]);

  const onLoad = useCallback(() => {
    workoutActor.send({ type: "LOAD_WORKOUT" });
  }, [workoutActor]);

  const onLoadFromEditor = useCallback(() => {
    workoutActor.send({ type: "LOAD_FROM_EDITOR" });
  }, [workoutActor]);

  const onClear = useCallback(() => {
    workoutActor.send({ type: "CLEAR" });
  }, [workoutActor]);

  const onReset = useCallback(() => {
    workoutActor.send({ type: "RESET" });
  }, [workoutActor]);

  const onTogglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const onToggleMute = useCallback(() => {
    setMuted(!isMutedState);
    setIsMutedState(!isMutedState);
  }, [isMutedState]);

  const controlProps = {
    isMutedState,
    onToggleMute,
    onOpenDevices: () => setDevicesOpen(true),
    onStart,
    onFinish,
    onTogglePause,
  };

  return (
    <div className="h-screen w-full flex flex-col bg-black text-white overflow-hidden select-none">
      <DevicesDialog
        open={devicesOpen}
        onClose={() => setDevicesOpen(false)}
      />

      {screen === "idle" && (
        <>
          <IdleScreen onLoad={onLoad} onLoadFromEditor={onLoadFromEditor} />
          <WorkoutControls isRunning={false} isPaused={false} hasWorkout={false} {...controlProps} />
        </>
      )}

      {screen === "ready" && (
        <>
          <WorkoutHUD isPaused={false} />
          <section className="h-24 md:h-36 w-full shrink-0 overflow-hidden opacity-30 relative z-10">
            <Visualiser />
          </section>
          <WorkoutControls isRunning={false} isPaused={false} hasWorkout {...controlProps} />
        </>
      )}

      {screen === "running" && (
        <>
          <WorkoutHUD isPaused={isPaused} />
          <section className="h-24 md:h-36 w-full shrink-0 overflow-hidden relative z-10">
            <Visualiser />
          </section>
          <WorkoutControls isRunning isPaused={isPaused} hasWorkout {...controlProps} />
        </>
      )}

      {screen === "finished" && (
        <>
          <FinishedScreen tcx={tcx} onClear={onClear} onReset={onReset} />
          <WorkoutControls isRunning={false} isPaused={false} hasWorkout {...controlProps} />
        </>
      )}
    </div>
  );
}
