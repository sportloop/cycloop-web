import { ImageResponse } from "next/og";

export const alt = "Cycloop — Structured Indoor Cycling";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Workout profile bars for the decorative background
const INTERVALS = [
  { d: 3, p: 55, zone: "z1" },
  { d: 2, p: 65, zone: "z2" },
  { d: 5, p: 75, zone: "z2" },
  { d: 1, p: 85, zone: "z3" },
  { d: 4, p: 95, zone: "z4" },
  { d: 1, p: 75, zone: "z2" },
  { d: 3, p: 55, zone: "z1" },
  { d: 1, p: 80, zone: "z3" },
  { d: 3, p: 110, zone: "z5" },
  { d: 1, p: 70, zone: "z2" },
  { d: 3, p: 55, zone: "z1" },
  { d: 1, p: 90, zone: "z4" },
  { d: 2, p: 120, zone: "z6" },
  { d: 1, p: 60, zone: "z1" },
  { d: 4, p: 55, zone: "z1" },
];

const ZONE_COLORS: Record<string, string> = {
  z1: "rgba(148,163,184,0.35)",
  z2: "rgba(96,165,250,0.45)",
  z3: "rgba(52,211,153,0.45)",
  z4: "rgba(251,191,36,0.40)",
  z5: "rgba(249,115,22,0.50)",
  z6: "rgba(239,68,68,0.50)",
};

export default function OGImage() {
  const totalDuration = INTERVALS.reduce((s, i) => s + i.d, 0);
  const maxPower = 140;
  const barAreaTop = 340;
  const barAreaHeight = 250;

  let offset = 0;
  const bars = INTERVALS.map((interval, i) => {
    const x = (offset / totalDuration) * 1200;
    const w = (interval.d / totalDuration) * 1200;
    const h = (interval.p / maxPower) * barAreaHeight;
    const y = barAreaTop + barAreaHeight - h;
    offset += interval.d;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w - 2,
          height: h,
          borderRadius: "4px 4px 0 0",
          background: ZONE_COLORS[interval.zone] || ZONE_COLORS.z1,
        }}
      />
    );
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: 200,
            width: 800,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(96,165,250,0.08), transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -50,
            right: 100,
            width: 600,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(251,191,36,0.06), transparent 70%)",
          }}
        />

        {/* Workout bars */}
        {bars}

        {/* Gradient overlay to fade bars into black at bottom */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 1200,
            height: 120,
            background:
              "linear-gradient(to top, #000 30%, transparent)",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
            paddingTop: 100,
          }}
        >
          {/* Zone pills */}
          <div style={{ display: "flex", gap: 12, marginBottom: 32 }}>
            {[
              { label: "Z2 Endurance", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
              { label: "Z4 Threshold", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
              { label: "Z5 VO2max", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
            ].map((z) => (
              <div
                key={z.label}
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: z.color,
                  background: z.bg,
                  padding: "6px 16px",
                  borderRadius: 999,
                }}
              >
                {z.label}
              </div>
            ))}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 0.95,
              textAlign: "center",
              letterSpacing: "-0.02em",
            }}
          >
            Train with
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: "#fbbf24",
              lineHeight: 0.95,
              textAlign: "center",
              letterSpacing: "-0.02em",
              marginTop: 8,
            }}
          >
            precision.
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.3)",
              marginTop: 28,
              textAlign: "center",
              maxWidth: 600,
              lineHeight: 1.5,
            }}
          >
            Structured workouts & smart trainer control — in your browser.
          </div>
        </div>

        {/* Bottom brand */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: 0,
            width: 1200,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            cycloop
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
