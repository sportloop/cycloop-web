/* eslint-disable no-promise-executor-return */
/* eslint-disable no-await-in-loop */
let audioCtx: AudioContext | null = null;
const getAudioContext = () => {
  if (audioCtx) {
    return audioCtx;
  }
  audioCtx = new AudioContext();
  return audioCtx;
};

// All arguments are optional:

// duration of the tone in milliseconds. Default is 500
// frequency of the tone in hertz. default is 440
// volume of the tone. Default is 1, off is 0.
// type of tone. Possible values are sine, square, sawtooth, triangle, and custom. Default is sine.
// callback to use on end of tone
function performBeep(
  duration: number,
  frequency: number,
  volume: number,
  type: OscillatorType,
  callback: AudioScheduledSourceNode["onended"]
) {
  const oscillator = getAudioContext().createOscillator();
  const gainNode = getAudioContext().createGain();

  oscillator.connect(gainNode);
  gainNode.connect(getAudioContext().destination);

  if (volume) {
    gainNode.gain.value = volume;
  }
  if (frequency) {
    oscillator.frequency.value = frequency;
  }
  if (type) {
    oscillator.type = type;
  }
  if (callback) {
    oscillator.onended = callback;
  }

  oscillator.start(getAudioContext().currentTime);
  oscillator.stop(getAudioContext().currentTime + (duration || 500) / 1000);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const beepAsync = (
  duration: number,
  frequency: number,
  volume: number,
  type: OscillatorType
) =>
  new Promise((resolve) =>
    performBeep(duration, frequency, volume, type, resolve)
  );

export default async function beep(
  sequence: ([number, number?, number?, OscillatorType?] | number)[]
) {
  for (let index = 0; index < sequence.length; index += 1) {
    const next = sequence[index];
    if (Array.isArray(next)) {
      const [duration, frequency, volume, type] = next;
      await beepAsync(duration, frequency, volume, type);
      // eslint-disable-next-line no-continue
    } else {
      await wait(next);
    }
  }
}
