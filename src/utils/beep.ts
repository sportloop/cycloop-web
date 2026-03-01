let muted = false;
export function setMuted(value: boolean) {
  muted = value;
}
export function isMuted() {
  return muted;
}

let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (audioCtx) return audioCtx;
  audioCtx = new AudioContext();
  return audioCtx;
};

// --- Singleton guard ---

const activeCues = new Set<string>();

function guardCue(name: string, durationMs: number): boolean {
  if (muted || activeCues.has(name)) return false;
  activeCues.add(name);
  setTimeout(() => activeCues.delete(name), durationMs + 150);
  return true;
}

// --- Countdown: filtered percussive ticks ---

export function playCountdown() {
  if (!guardCue("countdown", 900)) return;
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  for (let i = 0; i < 3; i++) {
    const offset = t + i * 0.3;

    // Noise burst for click texture
    const bufLen = ctx.sampleRate * 0.04;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let j = 0; j < bufLen; j++) data[j] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    // Bandpass filter for a tight tick
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3500;
    bp.Q.value = 5;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.35, offset);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, offset + 0.035);

    noise.connect(bp);
    bp.connect(noiseEnv);
    noiseEnv.connect(ctx.destination);
    noise.start(offset);
    noise.stop(offset + 0.04);

    // Pitched click body
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = i < 2 ? 1200 : 1600;
    const clickEnv = ctx.createGain();
    clickEnv.gain.setValueAtTime(0.2, offset);
    clickEnv.gain.exponentialRampToValueAtTime(0.001, offset + 0.05);
    osc.connect(clickEnv);
    clickEnv.connect(ctx.destination);
    osc.start(offset);
    osc.stop(offset + 0.06);
  }
}

// --- Intensity Up: rising filtered synth sweep ---

export function playIntensityUp() {
  if (!guardCue("transition", 600)) return;
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const dur = 0.5;

  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  // Two detuned saws for thickness
  for (const detune of [-8, 8]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(720, t + dur);
    osc.detune.value = detune;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.03);
    env.gain.setValueAtTime(1, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    // Low-pass sweep rising with the pitch
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(6000, t + dur * 0.8);
    lp.Q.value = 4;

    osc.connect(lp);
    lp.connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // Sub hit for punch
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(80, t);
  sub.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  const subEnv = ctx.createGain();
  subEnv.gain.setValueAtTime(0.3, t);
  subEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  sub.connect(subEnv);
  subEnv.connect(master);
  sub.start(t);
  sub.stop(t + 0.2);
}

// --- Intensity Down: descending filtered pad ---

export function playIntensityDown() {
  if (!guardCue("transition", 700)) return;
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const dur = 0.6;

  const master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);

  // Smooth triangle oscillators, detuned for warmth
  for (const detune of [-6, 6]) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + dur);
    osc.detune.value = detune;

    // Low-pass sweeping down
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4000, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + dur * 0.7);
    lp.Q.value = 2;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.04);
    env.gain.setValueAtTime(0.8, t + dur * 0.4);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(lp);
    lp.connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

// --- Workout Complete: triumphant synth fanfare ---

export function playComplete() {
  if (!guardCue("complete", 2200)) return;
  const ctx = getAudioContext();
  const t = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.value = 0.2;
  master.connect(ctx.destination);

  // Impact hit — filtered noise burst
  const hitLen = ctx.sampleRate * 0.08;
  const hitBuf = ctx.createBuffer(1, hitLen, ctx.sampleRate);
  const hitData = hitBuf.getChannelData(0);
  for (let i = 0; i < hitLen; i++) hitData[i] = Math.random() * 2 - 1;
  const hitSrc = ctx.createBufferSource();
  hitSrc.buffer = hitBuf;
  const hitLp = ctx.createBiquadFilter();
  hitLp.type = "lowpass";
  hitLp.frequency.value = 2000;
  hitLp.Q.value = 1;
  const hitEnv = ctx.createGain();
  hitEnv.gain.setValueAtTime(0.6, t);
  hitEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  hitSrc.connect(hitLp);
  hitLp.connect(hitEnv);
  hitEnv.connect(master);
  hitSrc.start(t);
  hitSrc.stop(t + 0.1);

  // Sub boom
  const boom = ctx.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(100, t);
  boom.frequency.exponentialRampToValueAtTime(30, t + 0.3);
  const boomEnv = ctx.createGain();
  boomEnv.gain.setValueAtTime(0.5, t);
  boomEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  boom.connect(boomEnv);
  boomEnv.connect(master);
  boom.start(t);
  boom.stop(t + 0.35);

  // Rising chord stabs — C major spread across time
  const chordNotes = [
    { freq: 261.6, time: 0.05 },  // C4
    { freq: 329.6, time: 0.12 },  // E4
    { freq: 392.0, time: 0.19 },  // G4
    { freq: 523.3, time: 0.28 },  // C5
    { freq: 659.3, time: 0.40 },  // E5
  ];

  for (const note of chordNotes) {
    const start = t + note.time;
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = note.freq;
      osc.detune.value = detune;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(note.freq * 3, start);
      lp.frequency.exponentialRampToValueAtTime(note.freq * 0.8, start + 1.2);
      lp.Q.value = 2;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.35, start + 0.02);
      env.gain.setValueAtTime(0.25, start + 0.3);
      env.gain.exponentialRampToValueAtTime(0.001, start + 1.6);

      osc.connect(lp);
      lp.connect(env);
      env.connect(master);
      osc.start(start);
      osc.stop(start + 1.7);
    }
  }

  // Shimmering noise tail
  const tailLen = ctx.sampleRate * 1.5;
  const tailBuf = ctx.createBuffer(1, tailLen, ctx.sampleRate);
  const tailData = tailBuf.getChannelData(0);
  for (let i = 0; i < tailLen; i++) tailData[i] = Math.random() * 2 - 1;
  const tailSrc = ctx.createBufferSource();
  tailSrc.buffer = tailBuf;
  const tailBp = ctx.createBiquadFilter();
  tailBp.type = "bandpass";
  tailBp.frequency.setValueAtTime(6000, t + 0.3);
  tailBp.frequency.exponentialRampToValueAtTime(2000, t + 2.0);
  tailBp.Q.value = 3;
  const tailEnv = ctx.createGain();
  tailEnv.gain.setValueAtTime(0, t + 0.3);
  tailEnv.gain.linearRampToValueAtTime(0.08, t + 0.5);
  tailEnv.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
  tailSrc.connect(tailBp);
  tailBp.connect(tailEnv);
  tailEnv.connect(master);
  tailSrc.start(t + 0.3);
  tailSrc.stop(t + 2.1);
}
