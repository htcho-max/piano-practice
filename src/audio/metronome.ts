import { resumeAudio, getAudioContext } from './context';

export type Tick = { index: number; beat: number; accent: boolean; perf: number };
const LOOKAHEAD = 0.12;

/** AudioContext 시각 → performance.now() ms (스피커로 나오는 늦음 포함) */
export function audioToPerf(t: number): number {
  const ctx = getAudioContext();
  const lat = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
  return performance.now() + (t - ctx.currentTime + lat) * 1000;
}
export function perfToAudio(p: number): number {
  const ctx = getAudioContext();
  const lat = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
  return ctx.currentTime + (p - performance.now()) / 1000 - lat;
}

class Metronome {
  bpm = 80;
  beats = 4;
  volume = 0.8;
  running = false;
  private ctx: AudioContext | null = null;
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private index = 0;
  private listeners = new Set<(t: Tick) => void>();
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  /** 첫 박이 울릴 performance 시각(ms)을 돌려줌 */
  async start(opts: { bpm?: number; beats?: number; delay?: number } = {}): Promise<number> {
    this.stop();
    if (opts.bpm) this.bpm = opts.bpm;
    if (opts.beats) this.beats = opts.beats;
    const ctx = await resumeAudio();
    this.ctx = ctx;
    this.next = ctx.currentTime + (opts.delay ?? 0.15);
    this.index = 0;
    this.running = true;
    try {
      if (!this.worker) {
        this.worker = new Worker(new URL('./tickWorker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = () => this.pump();
      }
      this.worker.postMessage('start');
    } catch {
      this.timer = setInterval(() => this.pump(), 25);
    }
    const first = audioToPerf(this.next);
    this.pump();
    return first;
  }

  stop() {
    this.running = false;
    this.worker?.postMessage('stop');
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
  }

  onTick(fn: (t: Tick) => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  private pump() {
    const ctx = this.ctx;
    if (!this.running || !ctx) return;
    const spb = 60 / this.bpm;
    while (this.next < ctx.currentTime + LOOKAHEAD) {
      const beat = this.index % this.beats;
      const tick: Tick = { index: this.index, beat, accent: beat === 0, perf: audioToPerf(this.next) };
      this.click(ctx, this.next, tick.accent);
      const h = setTimeout(() => {
        this.timeouts = this.timeouts.filter((x) => x !== h);
        this.listeners.forEach((fn) => fn(tick));
      }, Math.max(0, tick.perf - performance.now()));
      this.timeouts.push(h);
      this.next += spb;
      this.index++;
    }
  }

  private click(ctx: AudioContext, t: number, accent: boolean) {
    if (this.volume <= 0) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(this.volume * (accent ? 0.5 : 0.32), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.06);
  }
}

export const metronome = new Metronome();
