import Link from "next/link";

import Logo from "@/components/icons/Logo";

// ─── Sample Workout Profile ─────────────────────────────────
// A decorative SVG showing a sample workout shape — the visual
// language users will recognise from the editor and workout HUD.

const SAMPLE_INTERVALS = [
  { duration: 3, from: 55, to: 55, zone: "z1" },
  { duration: 2, from: 55, to: 75, zone: "z2" },
  { duration: 5, from: 75, to: 75, zone: "z2" },
  { duration: 1, from: 75, to: 95, zone: "z3" },
  { duration: 4, from: 95, to: 95, zone: "z4" },
  { duration: 1, from: 95, to: 55, zone: "z1" },
  { duration: 3, from: 55, to: 55, zone: "z1" },
  { duration: 1, from: 55, to: 110, zone: "z5" },
  { duration: 3, from: 110, to: 110, zone: "z5" },
  { duration: 1, from: 110, to: 55, zone: "z1" },
  { duration: 3, from: 55, to: 55, zone: "z1" },
  { duration: 1, from: 55, to: 120, zone: "z5" },
  { duration: 2, from: 120, to: 120, zone: "z6" },
  { duration: 1, from: 120, to: 55, zone: "z1" },
  { duration: 4, from: 55, to: 55, zone: "z1" },
];

const ZONE_FILLS: Record<string, string> = {
  z1: "rgba(148,163,184,0.25)",
  z2: "rgba(96,165,250,0.3)",
  z3: "rgba(52,211,153,0.3)",
  z4: "rgba(251,191,36,0.25)",
  z5: "rgba(249,115,22,0.3)",
  z6: "rgba(239,68,68,0.3)",
  z7: "rgba(192,132,252,0.3)",
};

function SampleWorkoutSVG({ className }: { className?: string }) {
  const maxPower = 150;
  const viewHeight = maxPower;
  let totalWidth = 0;
  SAMPLE_INTERVALS.forEach((i) => (totalWidth += i.duration));
  const scale = 20;
  const viewWidth = totalWidth * scale;

  let offset = 0;
  const blocks = SAMPLE_INTERVALS.map((interval, i) => {
    const x1 = offset * scale;
    const x2 = (offset + interval.duration) * scale;
    const y1From = viewHeight - interval.from;
    const y1To = viewHeight - interval.to;
    const points = `${x1},${viewHeight} ${x1},${y1From} ${x2},${y1To} ${x2},${viewHeight}`;
    offset += interval.duration;
    return (
      <polygon
        key={i}
        points={points}
        fill={ZONE_FILLS[interval.zone] || ZONE_FILLS.z1}
      />
    );
  });

  // FTP reference line at 100%
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
        stroke="rgba(248,113,113,0.2)"
        strokeWidth="1"
        strokeDasharray="6 4"
      />
    </svg>
  );
}

// ─── Zone Pill ──────────────────────────────────────────────
// Small badge replicating the workout HUD zone indicator style.

function ZonePill({
  name,
  label,
  color,
  bg,
}: {
  name: string;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <span
      className="text-[0.55rem] font-bold uppercase tracking-[0.25em] px-2.5 py-1 rounded-full inline-flex items-center gap-1"
      style={{
        color,
        backgroundColor: bg,
        boxShadow: `0 0 16px ${bg}`,
      }}
    >
      {name}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

// ─── Feature Card ───────────────────────────────────────────

function FeatureCard({
  title,
  description,
  href,
  cta,
  accent,
  glow,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
  accent: string;
  glow: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 md:p-8 flex flex-col gap-4 transition-all duration-300 hover:bg-white/[0.04] hover:border-white/[0.1]"
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 80% at 50% 0%, ${glow}, transparent)`,
        }}
      />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: glow }}
          >
            {icon}
          </div>
          <h3
            className="text-lg md:text-xl font-display font-bold"
            style={{ color: accent }}
          >
            {title}
          </h3>
        </div>

        <p className="text-sm md:text-base text-white/35 leading-relaxed font-medium">
          {description}
        </p>

        <span
          className="text-sm font-display font-bold uppercase tracking-[0.15em] group-hover:tracking-[0.25em] transition-all duration-300"
          style={{ color: `${accent}90` }}
        >
          {cta}
        </span>
      </div>
    </Link>
  );
}

// ─── Main Landing Page ──────────────────────────────────────

export default function Index() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 20%, rgba(96,165,250,0.04), transparent 70%), radial-gradient(ellipse 50% 40% at 80% 60%, rgba(251,191,36,0.03), transparent)",
        }}
      />

      {/* ── Header ── */}
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
            className="text-[0.65rem] md:text-xs font-bold uppercase tracking-[0.18em] text-white/25 hover:text-white/50 transition-colors px-3 py-2"
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

      {/* ── Hero Section ── */}
      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 md:pt-28 pb-8 md:pb-16">
        {/* Decorative zone pills */}
        <div className="flex items-center gap-2 mb-6 md:mb-8">
          <ZonePill name="Z2" label="Endurance" color="#60a5fa" bg="rgba(96,165,250,0.08)" />
          <ZonePill name="Z4" label="Threshold" color="#fbbf24" bg="rgba(251,191,36,0.08)" />
          <ZonePill name="Z5" label="VO2max" color="#f97316" bg="rgba(249,115,22,0.08)" />
        </div>

        {/* Hero headline */}
        <h1 className="text-center">
          <span
            className="block text-5xl sm:text-6xl md:text-8xl lg:text-[8rem] font-display font-black leading-[0.85] tracking-tight text-white/90"
            style={{
              textShadow:
                "0 0 120px rgba(96,165,250,0.15), 0 4px 80px rgba(0,0,0,0.5)",
            }}
          >
            Train with
          </span>
          <span
            className="block text-5xl sm:text-6xl md:text-8xl lg:text-[8rem] font-display font-black leading-[0.85] tracking-tight mt-1 md:mt-2"
            style={{
              color: "#fbbf24",
              textShadow:
                "0 0 80px rgba(251,191,36,0.2), 0 4px 60px rgba(251,191,36,0.1)",
            }}
          >
            precision.
          </span>
        </h1>

        <p className="text-sm md:text-base text-white/25 mt-6 md:mt-8 max-w-md text-center leading-relaxed font-medium">
          Build structured workouts, connect your smart trainer, and ride
          with real-time power targets — all from your browser.
        </p>

        {/* CTA */}
        <div className="flex items-center gap-3 mt-8 md:mt-10">
          <Link
            href="/workout"
            className="px-8 py-4 md:px-10 md:py-5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 active:scale-[0.98] text-emerald-400/90 text-lg md:text-xl font-display font-bold transition-all touch-manipulation select-none"
            style={{
              boxShadow: "0 0 40px rgba(52,211,153,0.08)",
            }}
          >
            Start Riding
          </Link>
          <Link
            href="/workout/editor"
            className="px-8 py-4 md:px-10 md:py-5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.98] text-white/40 hover:text-white/60 text-lg md:text-xl font-display font-bold transition-all touch-manipulation select-none"
          >
            Build a Workout
          </Link>
        </div>
      </section>

      {/* ── Workout Profile Visualization ── */}
      <section className="relative z-10 w-full px-6 md:px-10 mt-4 md:mt-8">
        <div className="max-w-4xl mx-auto">
          <SampleWorkoutSVG className="w-full h-24 md:h-36 opacity-60" />
        </div>
      </section>

      {/* ── Feature Cards ── */}
      <section className="relative z-10 px-6 md:px-10 mt-16 md:mt-24 pb-20 md:pb-32">
        <div className="max-w-4xl mx-auto">
          {/* Section label */}
          <div className="text-[0.55rem] md:text-[0.6rem] uppercase tracking-[0.25em] text-white/15 font-bold mb-6 md:mb-8">
            Everything you need
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <FeatureCard
              title="Workout Editor"
              description="Drag to shape intervals. Set power targets as % of FTP. Build ramps, steady states, and recovery blocks. Save as CWO or MRC format."
              href="/workout/editor"
              cta="Open Editor"
              accent="#60a5fa"
              glow="rgba(96,165,250,0.06)"
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              }
            />

            <FeatureCard
              title="Workout Gallery"
              description="Browse 9 pre-made structured workouts — from easy coffee rides to brutal threshold sessions. Preview, start, or customize any of them."
              href="/workouts"
              cta="Browse Workouts"
              accent="#34d399"
              glow="rgba(52,211,153,0.06)"
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              }
            />

            <FeatureCard
              title="Live Workout"
              description="Zone-colored HUD with real-time power, heart rate, cadence, and speed. Ambient glow shifts with your effort. Big touch targets for mid-ride control."
              href="/workout"
              cta="Start Riding"
              accent="#fbbf24"
              glow="rgba(251,191,36,0.06)"
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              }
            />

            <FeatureCard
              title="Bluetooth Devices"
              description="Connect smart trainers, heart rate monitors, and power meters via Web Bluetooth. Saved devices reconnect instantly."
              href="/workout"
              cta="Connect in Workout"
              accent="#38bdf8"
              glow="rgba(56,189,248,0.06)"
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6.5 6.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0" />
                  <path d="M17.5 17.5m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0" />
                  <path d="M6.5 10l11 4" />
                </svg>
              }
            />

          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.04] px-6 md:px-10 py-6 md:py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
