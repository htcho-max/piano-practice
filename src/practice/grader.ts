import type { Step } from '../music/steps';

/* ───────── 기다려 주기: 맞는 건반을 누를 때까지 다음으로 안 감 ───────── */

export type WaitFeedback = { kind: 'hit' | 'step' | 'wrong' | 'repeat' | 'done' | 'ignore'; note: number; step: number };
export type WaitResult = { mode: 'wait'; steps: number; clean: number; errors: number; errorsPerStep: number[]; wrongNotes: number[]; seconds: number; score: number };

export class WaitGrader {
  idx = 0;
  /** 지금 칸에서 눌러 둔(맞는) 음 */
  hit = new Set<number>();
  errorsPerStep: number[];
  wrongNotes: number[] = [];
  startedAt: number | null = null;
  endedAt: number | null = null;

  constructor(public steps: Step[]) {
    this.errorsPerStep = steps.map(() => 0);
    this.skipRests();
  }

  get done() { return this.idx >= this.steps.length; }
  get current(): Step | undefined { return this.steps[this.idx]; }

  private skipRests() { while (this.idx < this.steps.length && this.steps[this.idx].notes.length === 0) this.idx++; }

  noteOn(note: number, time: number): WaitFeedback {
    if (this.done) return { kind: 'ignore', note, step: this.idx };
    if (this.startedAt === null) this.startedAt = time;
    const step = this.steps[this.idx];
    const need = step.notes.map((n) => n.midi);
    if (need.includes(note)) {
      if (this.hit.has(note)) return { kind: 'repeat', note, step: this.idx };
      this.hit.add(note);
      if (need.every((m) => this.hit.has(m))) {
        const was = this.idx;
        this.idx++;
        this.hit.clear();
        this.skipRests();
        if (this.done) { this.endedAt = time; return { kind: 'done', note, step: was }; }
        return { kind: 'step', note, step: was };
      }
      return { kind: 'hit', note, step: this.idx };
    }
    this.errorsPerStep[this.idx]++;
    this.wrongNotes.push(note);
    return { kind: 'wrong', note, step: this.idx };
  }

  /** 화음은 다 같이 누르고 있어야 함 → 다 누르기 전에 뗀 음은 다시 */
  noteOff(note: number) {
    if (this.hit.has(note)) this.hit.delete(note);
  }

  result(now: number): WaitResult {
    const counted = this.steps.map((s, i) => ({ s, e: this.errorsPerStep[i] })).filter((x) => x.s.notes.length > 0);
    const clean = counted.filter((x) => x.e === 0).length;
    const errors = counted.reduce((a, x) => a + x.e, 0);
    const steps = counted.length;
    const seconds = Math.max(0, ((this.endedAt ?? now) - (this.startedAt ?? now)) / 1000);
    // 틀리지 않고 넘어간 칸 비율 (틀린 건반 하나마다 조금 더 깎음)
    const score = steps ? Math.max(0, Math.round((100 * clean) / steps - Math.max(0, errors - (steps - clean)) * 2)) : 0;
    return { mode: 'wait', steps, clean, errors, errorsPerStep: [...this.errorsPerStep], wrongNotes: [...this.wrongNotes], seconds, score };
  }
}

/* ───────── 박자 맞춰: 메트로놈에 맞춰 치고 시각까지 채점 ───────── */

export type Verdict = 'good' | 'early' | 'late' | 'miss';
export type Expected = { midi: number; step: number; hand: 'R' | 'L'; time: number; dt: number | null; verdict: Verdict | null };
export type TimedFeedback = { kind: 'match'; exp: Expected } | { kind: 'extra'; note: number; time: number; near: number };
export type TimedResult = {
  mode: 'timed'; bpm: number; total: number; good: number; early: number; late: number; miss: number; extra: number;
  meanAbsMs: number; meanMs: number; handGapMs: number | null; score: number; verdicts: (Verdict | null)[][];
};

/** 잘 맞음 기준 (ms) */
export const GOOD_MS = 90;

export class TimedGrader {
  expected: Expected[] = [];
  extras: { note: number; time: number; near: number }[] = [];
  readonly spb: number;
  readonly window: number;
  finished = false;

  constructor(public steps: Step[], public bpm: number, public t0: number) {
    this.spb = 60000 / bpm;
    // 한 음을 찾을 때 앞뒤로 보는 폭: 반 박 남짓, 200~420ms
    this.window = Math.max(200, Math.min(420, this.spb * 0.55));
    steps.forEach((s, i) => s.notes.forEach((n) => this.expected.push({ midi: n.midi, step: i, hand: n.hand, time: t0 + s.beat * this.spb, dt: null, verdict: null })));
  }

  get endTime(): number {
    const last = this.steps[this.steps.length - 1];
    return this.t0 + (last ? (last.beat + last.dur) * this.spb : 0);
  }

  /** time 에 해당하는 칸 번호 (아직 시작 전이면 -1) */
  stepAt(time: number): number {
    const beat = (time - this.t0) / this.spb;
    if (beat < 0) return -1;
    let k = -1;
    this.steps.forEach((s, i) => { if (s.beat <= beat + 1e-6) k = i; });
    return k;
  }

  noteOn(note: number, time: number): TimedFeedback {
    let best: Expected | null = null;
    for (const e of this.expected) {
      if (e.verdict !== null || e.midi !== note) continue;
      const d = Math.abs(time - e.time);
      if (d <= this.window && (!best || d < Math.abs(time - best.time))) best = e;
    }
    if (best) {
      best.dt = time - best.time;
      best.verdict = Math.abs(best.dt) <= GOOD_MS ? 'good' : best.dt < 0 ? 'early' : 'late';
      return { kind: 'match', exp: best };
    }
    const near = Math.max(0, this.stepAt(time + this.window));
    const x = { note, time, near };
    this.extras.push(x);
    return { kind: 'extra', ...x };
  }

  /** 이 시각까지 지나간(창이 닫힌) 음은 놓친 것으로 → 새로 놓친 것 돌려줌 */
  sweep(now: number): Expected[] {
    const out: Expected[] = [];
    for (const e of this.expected) if (e.verdict === null && now > e.time + this.window) { e.verdict = 'miss'; out.push(e); }
    return out;
  }

  finish(): TimedResult {
    this.finished = true;
    this.sweep(Infinity);
    const total = this.expected.length;
    const cnt = (v: Verdict) => this.expected.filter((e) => e.verdict === v).length;
    const good = cnt('good'), early = cnt('early'), late = cnt('late'), miss = cnt('miss');
    const hits = this.expected.filter((e) => e.dt !== null);
    const meanAbsMs = hits.length ? Math.round(hits.reduce((a, e) => a + Math.abs(e.dt!), 0) / hits.length) : 0;
    const meanMs = hits.length ? Math.round(hits.reduce((a, e) => a + e.dt!, 0) / hits.length) : 0;
    // 양손이 함께 누르는 칸에서 두 손 사이 어긋남
    const gaps: number[] = [];
    this.steps.forEach((_, i) => {
      const r = this.expected.filter((e) => e.step === i && e.hand === 'R' && e.dt !== null);
      const l = this.expected.filter((e) => e.step === i && e.hand === 'L' && e.dt !== null);
      if (r.length && l.length) gaps.push(Math.abs(avg(r.map((e) => e.dt!)) - avg(l.map((e) => e.dt!))));
    });
    const handGapMs = gaps.length ? Math.round(avg(gaps)) : null;
    const extra = this.extras.length;
    const score = total ? Math.max(0, Math.round((100 * (good + 0.6 * (early + late))) / total - Math.min(20, extra * 3))) : 0;
    const verdicts = this.steps.map((_, i) => this.expected.filter((e) => e.step === i).map((e) => e.verdict));
    return { mode: 'timed', bpm: this.bpm, total, good, early, late, miss, extra, meanAbsMs, meanMs, handGapMs, score, verdicts };
  }
}

function avg(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

/** 결과 한 줄 평 */
export function verdictLine(r: WaitResult | TimedResult, timedNext = true): string {
  if (r.mode === 'wait') {
    if (r.errors === 0) return timedNext ? '틀린 건반 없이 끝까지! 이제 박자 맞춰 쳐 보세요.' : '틀린 건반 없이 끝까지!';
    if (r.score >= 80) return `거의 다 맞았어요 (틀린 건반 ${r.errors}번). 한 번 더 하면 깔끔해질 거예요.`;
    return `틀린 건반 ${r.errors}번. 손가락 번호를 보며 천천히 다시 해 봐요.`;
  }
  if (r.score >= 90) return '박자까지 아주 좋아요!';
  const tips: string[] = [];
  if (r.miss > 0) tips.push(`놓친 음 ${r.miss}개`);
  if (Math.abs(r.meanMs) > 60) tips.push(r.meanMs < 0 ? '전체적으로 조금 서둘러요' : '전체적으로 조금 늦어요');
  if (r.handGapMs !== null && r.handGapMs > 60) tips.push(`양손이 ${r.handGapMs}ms 어긋나요`);
  if (r.extra > 0) tips.push(`틀린 건반 ${r.extra}번`);
  const head = r.score >= 80 ? '통과!' : '조금 더 연습해요.';
  return tips.length ? `${head} ${tips.join(' · ')}` : head;
}

export const PASS_SCORE = 80;

/* ───────── 페달 바꾸기 (레가토 페달): 코드가 바뀌는 박 직후에 뗐다가 다시 밟기 ───────── */
export type PedalEv = { time: number; value: number };
export type PedalResult = { ok: number; total: number; used: boolean; late: number; early: number };

/**
 * changeTimes: 코드가 바뀌는 시각(ms). 처음 것은 "밟기만" 하면 됨.
 * 맞음 = 바뀌는 시각 −120ms ~ +450ms 사이에 뗌(<64) → 그 뒤 700ms 안에 다시 밟음(≥64)
 * early = 바뀌기 전에 미리 뗐다 밟음(소리가 끊김), late = 너무 늦게 바꿈(앞 코드와 섞임)
 */
export function gradePedal(changeTimes: number[], evs: PedalEv[]): PedalResult {
  const down = (v: number) => v >= 64;
  const used = evs.some((e) => down(e.value));
  let ok = 0, late = 0, early = 0;
  changeTimes.forEach((t, i) => {
    if (i === 0) { if (evs.some((e) => down(e.value) && e.time >= t - 1500 && e.time <= t + 800)) ok++; return; }
    const up = evs.find((e) => !down(e.value) && e.time >= t - 120 && e.time <= t + 450);
    if (up && evs.some((e) => down(e.value) && e.time > up.time && e.time <= up.time + 700)) { ok++; return; }
    if (evs.some((e) => !down(e.value) && e.time > t + 450 && e.time <= t + 1200)) late++;
    else if (evs.some((e) => !down(e.value) && e.time >= t - 800 && e.time < t - 120)) early++;
  });
  return { ok, total: changeTimes.length, used, late, early };
}
