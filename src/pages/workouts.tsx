import fs from "fs";
import path from "path";
import type { GetStaticProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback } from "react";

import Logo from "@/components/icons/Logo";
import WorkoutPreview from "@/modules/workout/WorkoutPreview";
import { woToWorkout } from "@/modules/workout/parser";
import { selectStats, type WorkoutStats } from "@/machines/workoutEditor";
import { useAppActor } from "@/machines/context";
import type { Workout } from "@/machines/types";

type SerializedWorkout = {
  workout: Workout;
  stats: WorkoutStats;
  description: string;
};

type Props = {
  workouts: SerializedWorkout[];
};

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function WorkoutCard({ workout, stats, description }: SerializedWorkout) {
  const router = useRouter();
  const appActor = useAppActor();

  const onStart = useCallback(() => {
    const workoutActor = appActor.system.get("workout");
    workoutActor.send({ type: "LOAD_PRESET", workout });
    router.push("/workout");
  }, [appActor, workout, router]);

  const onModify = useCallback(() => {
    const editorActor = appActor.system.get("editor");
    editorActor.send({ type: "LOAD_PRESET", workout });
    router.push("/workout/editor");
  }, [appActor, workout, router]);

  return (
    <div className="group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.1]">
      {/* Preview */}
      <div className="h-24 md:h-28 w-full px-4 pt-4 overflow-hidden">
        <WorkoutPreview
          workout={workout}
          className="w-full h-full opacity-70 group-hover:opacity-90 transition-opacity duration-300"
        />
      </div>

      {/* Info */}
      <div className="p-4 md:p-5 pt-3">
        <h3 className="text-base md:text-lg font-display font-bold text-white/80 leading-tight">
          {workout.name}
        </h3>

        {description && (
          <p className="text-xs text-white/25 mt-1.5 leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[0.6rem] uppercase tracking-[0.15em] text-white/30 font-bold">
            {formatDuration(stats.duration)}
          </span>
          <span className="text-white/10">|</span>
          <span className="text-[0.6rem] uppercase tracking-[0.15em] text-white/30 font-bold">
            {Math.round(stats.power)}% avg
          </span>
          <span className="text-white/10">|</span>
          <span className="text-[0.6rem] uppercase tracking-[0.15em] text-white/30 font-bold">
            TSS {Math.round(stats.trainingStress)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onStart}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 active:scale-[0.98] text-emerald-400/90 text-sm font-display font-bold transition-all touch-manipulation select-none"
          >
            Start
          </button>
          <button
            onClick={onModify}
            className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] active:scale-[0.98] text-white/40 hover:text-white/60 text-sm font-display font-bold transition-all touch-manipulation select-none"
          >
            Modify
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Workouts({ workouts }: Props) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ambient background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(96,165,250,0.04), transparent 70%), radial-gradient(ellipse 50% 40% at 80% 60%, rgba(251,191,36,0.03), transparent)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 md:px-10 h-16 md:h-20">
        <Link
          href="/"
          className="flex items-center gap-0.5 text-white/90 hover:text-white transition-colors"
        >
          <span className="text-xl md:text-2xl font-display font-black flex items-center tracking-tight">
            Cycl
            <Logo className="mx-0.5 text-white/80" />p
          </span>
        </Link>

        <nav className="flex items-center gap-2 md:gap-3">
          <Link
            href="/workouts"
            className="text-[0.65rem] md:text-xs font-bold uppercase tracking-[0.18em] text-white/50 hover:text-white/70 transition-colors px-3 py-2"
          >
            Workouts
          </Link>
          <Link
            href="/workout/editor"
            className="text-[0.65rem] md:text-xs font-bold uppercase tracking-[0.18em] text-white/25 hover:text-white/50 transition-colors px-3 py-2"
          >
            Editor
          </Link>
          <Link
            href="/workout"
            className="text-[0.65rem] md:text-xs font-bold uppercase tracking-[0.18em] px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/70 transition-all"
          >
            Ride
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-10 pt-10 md:pt-16 pb-8 md:pb-12 text-center">
        <div className="text-[0.55rem] md:text-[0.6rem] uppercase tracking-[0.25em] text-white/15 font-bold mb-3">
          Pre-made workouts
        </div>
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-display font-black text-white/90 leading-tight tracking-tight"
          style={{
            textShadow: "0 0 80px rgba(96,165,250,0.1)",
          }}
        >
          Workout Gallery
        </h1>
        <p className="text-sm md:text-base text-white/25 mt-3 max-w-md mx-auto font-medium">
          Pick a workout, start riding, or customize it in the editor.
        </p>
      </section>

      {/* Grid */}
      <section className="relative z-10 px-5 md:px-10 pb-20 md:pb-32">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {workouts.map((w) => (
            <WorkoutCard key={w.workout.name} {...w} />
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] px-6 md:px-10 py-6 md:py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-white/15 font-bold flex items-center gap-1">
            Cycl
            <Logo className="text-white/15 text-[0.55rem]" />p
          </span>
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-white/10 font-medium">
            Do what it takes
          </span>
        </div>
      </footer>
    </div>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const workoutsDir = path.join(process.cwd(), "workouts");
  const files = fs.readdirSync(workoutsDir).filter((f) => f.endsWith(".wo"));

  const workouts: SerializedWorkout[] = files.map((file) => {
    const content = fs.readFileSync(path.join(workoutsDir, file), "utf-8");
    const workout = woToWorkout(content);
    const stats = selectStats(workout);

    // Extract description: first paragraph after the heading
    const lines = content.split("\n");
    let description = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed === "" || trimmed.startsWith("-"))
        continue;
      description = trimmed;
      break;
    }

    return { workout, stats, description };
  });

  // Sort by duration ascending
  workouts.sort((a, b) => a.stats.duration - b.stats.duration);

  return { props: { workouts } };
};
