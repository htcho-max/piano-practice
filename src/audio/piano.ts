import { getAudioContext, resumeAudio } from './context';

/**
 * 가벼운 합성 피아노 소리 (화면 건반·들어 보기용).
 * 진짜 피아노가 연결돼 있으면 연주 소리는 피아노에서 나고, 이 소리는 '들어 보기'에만 씁니다.
 * 배음 몇 개(조금씩 높아지는 비조화 배음) + 두 줄 맥놀이 + 망치 잡음, 높은 배음일수록 빨리 사라짐.
 */
type Voice = { gains: GainNode[]; out: GainNode; oscs: AudioScheduledSourceNode[]; endAt: number };

class Piano {
  volume = 0.7;
  private master: GainNode | null = null;
  private voices = new Map<number, Voice[]>();
  private scheduled: Voice[] = [];
  private sustain = false;
  private sustained = new Set<number>();
  private noise: AudioBuffer | null = null;

  private out(ctx: AudioContext): GainNode {
    if (!this.master) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp).connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.03);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return this.master;
  }

  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }

  /** 사용자 터치 안에서 한 번 불러 두면 이후 소리가 바로 남 */
  async warm() { await resumeAudio(); }

  noteOn(note: number, vel = 90) {
    const ctx = getAudioContext();
    if (ctx.state !== 'running') void ctx.resume();
    const t = ctx.currentTime;
    this.noteOff(note, t); // 같은 건반 다시 치면 앞소리는 짧게 정리
    const v = this.voice(ctx, note, vel, t);
    const list = this.voices.get(note) ?? [];
    list.push(v);
    this.voices.set(note, list.filter((x) => x.endAt > ctx.currentTime));
    this.sustained.delete(note);
  }

  /** 정해진 시각에 정해진 길이만큼 (들어 보기·다른 손 반주). 직접 친 음과 섞이지 않게 따로 관리 */
  schedule(note: number, vel: number, at: number, dur: number) {
    const ctx = getAudioContext();
    if (ctx.state !== 'running') void ctx.resume();
    const t = Math.max(at, ctx.currentTime);
    const v = this.voice(ctx, note, vel, t);
    const off = t + Math.max(0.05, dur);
    v.out.gain.setValueAtTime(1, off);
    v.out.gain.setTargetAtTime(0, off, 0.07);
    for (const o of v.oscs) { try { o.stop(Math.min(v.endAt, off + 0.6)); } catch { /* 무시 */ } }
    this.scheduled.push(v);
    this.scheduled = this.scheduled.filter((x) => x.endAt > ctx.currentTime - 1);
  }

  /** 예약한 소리 모두 멈춤 */
  cancelScheduled() {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    for (const v of this.scheduled) {
      v.out.gain.cancelScheduledValues(t);
      v.out.gain.setValueAtTime(0, t);
      for (const o of v.oscs) { try { o.stop(t + 0.05); } catch { /* 무시 */ } }
    }
    this.scheduled = [];
  }

  private voice(ctx: AudioContext, note: number, vel: number, t: number): Voice {
    const master = this.out(ctx);
    const f = 440 * Math.pow(2, (note - 69) / 12);
    const v = Math.max(0.05, Math.min(1, vel / 127));
    const amp = 0.22 * Math.pow(v, 1.5);
    const low = Math.max(0, Math.min(1, (note - 21) / 87)); // 0 = 맨 아래, 1 = 맨 위
    const base = 7 - 5.5 * low; // 낮은 음은 오래 울림 (초)
    const B = 0.00012 + 0.0004 * low; // 비조화도
    const voiceOut = ctx.createGain();
    voiceOut.gain.value = 1;
    voiceOut.connect(master);
    const gains: GainNode[] = [];
    const oscs: AudioScheduledSourceNode[] = [];
    const nPart = note > 84 ? 4 : note > 72 ? 6 : 8;
    const bright = 0.35 + 0.65 * v; // 세게 치면 밝음
    for (let n = 1; n <= nPart; n++) {
      const fn = f * n * Math.sqrt(1 + B * n * n);
      if (fn > 12000) break;
      const a = amp * Math.pow(bright, n - 1) / Math.pow(n, 1.1) * (n === 1 ? 1 : 0.8);
      const decay = base / Math.pow(n, 0.8);
      for (const det of n <= 2 ? [-0.6, 0.6] : [0]) { // 두 줄이 조금 어긋나 맥놀이
        const o = ctx.createOscillator();
        o.frequency.value = fn;
        o.detune.value = det;
        const g = ctx.createGain();
        const share = n <= 2 ? 0.5 : 1;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(a * share, t + 0.004);
        g.gain.setTargetAtTime(a * share * 0.35, t + 0.004, decay * 0.08); // 처음 빨리 줄고
        g.gain.setTargetAtTime(0, t + 0.004 + decay * 0.25, decay * 0.45); // 길게 남음
        o.connect(g).connect(voiceOut);
        o.start(t);
        o.stop(t + decay * 2.5 + 0.1);
        gains.push(g);
        oscs.push(o);
      }
    }
    if (this.noise) { // 망치
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 3 + 800); bp.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = amp * 0.5 * v;
      src.connect(bp).connect(g).connect(voiceOut);
      src.start(t);
      oscs.push(src);
    }
    return { gains, out: voiceOut, oscs, endAt: t + base * 2.5 + 0.1 };
  }

  noteOff(note: number, when?: number) {
    const list = this.voices.get(note);
    if (!list?.length) return;
    if (this.sustain && when === undefined) { this.sustained.add(note); return; }
    const ctx = getAudioContext();
    const t = Math.max(when ?? ctx.currentTime, ctx.currentTime);
    for (const v of list) {
      v.out.gain.cancelScheduledValues(t);
      v.out.gain.setValueAtTime(v.out.gain.value, t);
      v.out.gain.setTargetAtTime(0, t, 0.06);
      for (const o of v.oscs) { try { o.stop(t + 0.5); } catch { /* 이미 멈춤 */ } }
    }
    this.voices.delete(note);
  }

  setSustain(on: boolean) {
    this.sustain = on;
    if (!on) { for (const n of this.sustained) this.noteOff(n); this.sustained.clear(); }
  }

  allOff() { for (const n of [...this.voices.keys()]) this.noteOff(n, getAudioContext().currentTime); this.sustained.clear(); this.cancelScheduled(); }
}

export const piano = new Piano();
