/**
 * 자유 반주 채점: 악보는 멜로디 + 코드만. 멜로디는 정해진 음, 그 아래는 마음대로 코드 음.
 * - 멜로디 음을 누르면 다음 음으로 (기다려 주기처럼)
 * - 코드 음(슬래시 베이스 포함)은 몇 개든 괜찮음, 코드 밖 음은 틀림
 *   (멜로디를 누른 직후 0.25초 안에 누른 음은 앞 코드로도 봐 줌 — 화음을 살짝 늦게 누르는 경우)
 * - 멜로디를 누를 때 그보다 높은 음을 누르고 있으면 "멜로디가 맨 위가 아님"
 * - 코드가 바뀌는 멜로디 음(코드 음일 때)마다 그 아래 코드 음이 둘 이상이면 화음 ●, 하나면 ◐
 */
import type { Step } from '../music/steps';
import { parseChord, type Chord, type ChordSpan } from '../music/chordbook';
import { isChordTone, spanAt } from '../music/melodyvoice';
import { TimedGrader, type WaitFeedback, type TimedFeedback, type TimedResult } from './grader';

export type FreeResult = {
  mode: 'free'; steps: number; clean: number; errors: number; errorsPerStep: number[]; wrongNotes: number[]; seconds: number; score: number;
  /** 코드가 바뀌는 멜로디 음 수, 그중 아래 코드 음 둘 이상 / 하나 */
  harmTotal: number; harmFull: number; harmHalf: number; topErrors: number;
};

const GRACE_MS = 250;

export class FreeGrader {
  idx = 0;
  /** PlayRunner 와 맞추려고 (자유 반주는 화음을 다 누를 필요가 없어 늘 비어 있음) */
  hit = new Set<number>();
  errorsPerStep: number[];
  topErr: number[];
  /** 칸마다 멜로디 아래 코드 음 수 (가장 많았을 때) */
  harm: number[];
  wrongNotes: number[] = [];
  startedAt: number | null = null;
  endedAt: number | null = null;
  chords: (Chord | null)[];
  onset: boolean[];
  private last = { step: -1, at: -Infinity };

  constructor(public steps: Step[], spans: ChordSpan[]) {
    this.errorsPerStep = steps.map(() => 0);
    this.topErr = steps.map(() => 0);
    this.harm = steps.map(() => 0);
    this.chords = steps.map((s) => { const sp = spanAt(spans, s.beat); return sp ? parseChord(sp.name) : null; });
    this.onset = steps.map((s) => { const sp = spanAt(spans, s.beat); return !!sp && Math.abs(sp.beat - s.beat) < 1e-6; });
    // 코드가 바뀌는 박이 쉼표면 그다음 첫 음을 코드 시작으로
    let pending = false;
    steps.forEach((s, i) => {
      if (this.onset[i] && !s.notes.length) { pending = true; this.onset[i] = false; }
      else if (pending && s.notes.length) { this.onset[i] = true; pending = false; }
    });
    this.skipRests();
  }

  get done() { return this.idx >= this.steps.length; }
  get current(): Step | undefined { return this.steps[this.idx]; }
  private skipRests() { while (this.idx < this.steps.length && this.steps[this.idx].notes.length === 0) this.idx++; }
  melOf(i: number): number { return Math.max(...this.steps[i].notes.map((n) => n.midi)); }

  private under(i: number, held: number[]) {
    const c = this.chords[i];
    if (!c) return;
    const mel = this.melOf(i);
    const n = new Set(held.filter((m) => m < mel && isChordTone(m, c))).size;
    this.harm[i] = Math.max(this.harm[i], n);
  }

  /** held: 지금 누르고 있는 음 (방금 누른 음 포함) */
  noteOn(note: number, time: number, held: number[]): WaitFeedback {
    if (this.done) return { kind: 'ignore', note, step: this.idx };
    if (this.startedAt === null) this.startedAt = time;
    const i = this.idx;
    const mel = this.melOf(i);
    const c = this.chords[i];
    if (note === mel) {
      const prevMel = [i - 1, i - 2].filter((k) => k >= 0 && this.steps[k].notes.length).map((k) => this.melOf(k));
      if (held.some((m) => m > mel && !prevMel.includes(m))) this.topErr[i]++;
      this.under(i, held);
      this.last = { step: i, at: time };
      this.idx++;
      this.skipRests();
      if (this.done) { this.endedAt = time; return { kind: 'done', note, step: i }; }
      return { kind: 'step', note, step: i };
    }
    if (!c || isChordTone(note, c)) { this.under(i, held); return { kind: 'hit', note, step: i }; }
    const pc = this.chords[this.last.step];
    if (time - this.last.at <= GRACE_MS && pc && isChordTone(note, pc)) { this.under(this.last.step, held); return { kind: 'hit', note, step: this.last.step }; }
    this.errorsPerStep[i]++;
    this.wrongNotes.push(note);
    return { kind: 'wrong', note, step: i };
  }

  noteOff(_note: number) { /* 자유 반주는 뗀 음을 따로 보지 않음 */ }

  result(now: number): FreeResult {
    const idxs = this.steps.map((s, i) => i).filter((i) => this.steps[i].notes.length > 0);
    const bad = (i: number) => this.errorsPerStep[i] + this.topErr[i];
    const clean = idxs.filter((i) => bad(i) === 0).length;
    const errors = idxs.reduce((a, i) => a + bad(i), 0);
    const topErrors = idxs.reduce((a, i) => a + this.topErr[i], 0);
    // 코드가 바뀌는 음 중 멜로디가 코드 음인 곳 (경과음 위에는 화음을 안 넣어도 됨)
    const hIdx = idxs.filter((i) => this.onset[i] && this.chords[i] && isChordTone(this.melOf(i), this.chords[i]!));
    const harmFull = hIdx.filter((i) => this.harm[i] >= 2).length;
    const harmHalf = hIdx.filter((i) => this.harm[i] === 1).length;
    const steps = idxs.length;
    const melPct = steps ? clean / steps : 0;
    const harmPct = hIdx.length ? (harmFull + 0.5 * harmHalf) / hIdx.length : 1;
    const score = steps ? Math.max(0, Math.round(60 * melPct + 40 * harmPct - Math.max(0, errors - (steps - clean)) * 2)) : 0;
    const seconds = Math.max(0, ((this.endedAt ?? now) - (this.startedAt ?? now)) / 1000);
    return { mode: 'free', steps, clean, errors, errorsPerStep: [...this.errorsPerStep], wrongNotes: [...this.wrongNotes], seconds, score, harmTotal: hIdx.length, harmFull, harmHalf, topErrors };
  }
}

export function freeLine(r: FreeResult): string {
  const h = r.harmTotal ? `코드가 바뀌는 ${r.harmTotal}곳 중 화음 ● ${r.harmFull}곳${r.harmHalf ? ` · ◐ ${r.harmHalf}곳` : ''}` : '';
  const e = [r.errors - r.topErrors > 0 ? `코드 밖 음 ${r.errors - r.topErrors}번` : '', r.topErrors ? `멜로디가 맨 위가 아닌 곳 ${r.topErrors}번` : ''].filter(Boolean).join(' · ');
  const tip = r.harmTotal && r.harmFull < r.harmTotal * 0.6 ? ' 코드가 바뀌는 음에서는 멜로디 아래에 코드 음 두 개를 같이 눌러 봐요.' : '';
  return [h, e].filter(Boolean).join(' · ') + '.' + tip;
}

/* ─────────────── 박자 맞춰 자유 반주 ─────────────── */

export type FreeHarm = { harmTotal: number; harmFull: number; harmHalf: number; topErrors: number };

/**
 * 박자 맞춰 자유 반주: 멜로디는 박자까지 채점(TimedGrader 그대로), 그 밖의 음은
 * 그때 코드의 음(코드가 바뀌는 곳 앞뒤 window 안은 두 코드 다 허용)이면 화음, 아니면 틀린 음.
 * 코드가 바뀌는 멜로디 음(코드 음일 때) 앞뒤 window 안에 그 아래 코드 음이 둘 이상이면 ●.
 */
export class FreeTimedGrader extends TimedGrader {
  chordsAt: { beat: number; end: number; c: Chord }[];
  harmStep: number[];
  harmSets = new Map<number, Set<number>>();
  topErrors = 0;

  constructor(steps: Step[], bpm: number, t0: number, spans: ChordSpan[]) {
    super(steps, bpm, t0);
    this.chordsAt = spans.map((s) => ({ beat: s.beat, end: s.beat + s.dur, c: parseChord(s.name) })).filter((x): x is { beat: number; end: number; c: Chord } => !!x.c);
    // 코드가 바뀌는 첫 멜로디 음 (쉼표면 그다음 음), 멜로디가 그 코드 음일 때
    this.harmStep = [];
    for (const ch of this.chordsAt) {
      const i = steps.findIndex((s) => s.notes.length > 0 && s.beat >= ch.beat - 1e-6 && s.beat < ch.end - 1e-6);
      if (i >= 0 && Math.abs(steps[i].beat - ch.beat) < 1 + 1e-6 && isChordTone(this.mel(i), ch.c) && !this.harmStep.includes(i)) this.harmStep.push(i);
    }
  }

  mel(i: number): number { return Math.max(...this.steps[i].notes.map((n) => n.midi)); }
  private chordsNear(time: number): Chord[] {
    const b0 = (time - this.window - this.t0) / this.spb, b1 = (time + this.window - this.t0) / this.spb;
    return this.chordsAt.filter((x) => x.beat < b1 && x.end > b0).map((x) => x.c);
  }

  /** held: 지금 누르고 있는 음 (멜로디보다 높은 음이 있으면 맨 위 아님) */
  noteOnFree(note: number, time: number, held: number[]): TimedFeedback | { kind: 'harm'; note: number } {
    const f = this.noteOn(note, time);
    if (f.kind === 'match') {
      // 앞 멜로디 음을 아직 누르고 있는 것(레가토)은 괜찮음
      const prevMel = [f.exp.step - 1, f.exp.step - 2].filter((i) => i >= 0 && this.steps[i].notes.length).map((i) => this.mel(i));
      if (held.some((m) => m > note && !prevMel.includes(m))) this.topErrors++;
      // 멜로디보다 먼저 누른 화음 음
      this.recordHarm(f.exp.step, held.filter((m) => m < note));
      return f;
    }
    const cs = this.chordsNear(time);
    if (!cs.some((c) => isChordTone(note, c))) return f;
    this.extras.pop();
    // 가까운 "코드가 바뀌는 음"에 화음으로
    let best = -1, bd = Infinity;
    for (const i of this.harmStep) { const d = Math.abs(time - (this.t0 + this.steps[i].beat * this.spb)); if (d <= this.window && d < bd) { bd = d; best = i; } }
    if (best >= 0) this.recordHarm(best, [note]);
    return { kind: 'harm', note };
  }

  private recordHarm(step: number, notes: number[]) {
    if (!this.harmStep.includes(step)) return;
    const mel = this.mel(step);
    const ch = this.chordsAt.find((x) => this.steps[step].beat >= x.beat - 1e-6 && this.steps[step].beat < x.end - 1e-6);
    if (!ch) return;
    const set = this.harmSets.get(step) ?? new Set<number>();
    for (const n of notes) if (n < mel && isChordTone(n, ch.c)) set.add(n);
    this.harmSets.set(step, set);
  }

  finishFree(): TimedResult & { free: FreeHarm } {
    const r = this.finish();
    const harmFull = this.harmStep.filter((i) => (this.harmSets.get(i)?.size ?? 0) >= 2).length;
    const harmHalf = this.harmStep.filter((i) => (this.harmSets.get(i)?.size ?? 0) === 1).length;
    const harmTotal = this.harmStep.length;
    const melPct = r.total ? (r.good + 0.6 * (r.early + r.late)) / r.total : 0;
    const harmPct = harmTotal ? (harmFull + 0.5 * harmHalf) / harmTotal : 1;
    const score = Math.max(0, Math.round(60 * melPct + 40 * harmPct - Math.min(20, (r.extra + this.topErrors) * 3)));
    return { ...r, score, free: { harmTotal, harmFull, harmHalf, topErrors: this.topErrors } };
  }
}

export function freeTimedLine(r: TimedResult & { free: FreeHarm }): string {
  const f = r.free;
  const parts = [
    f.harmTotal ? `코드가 바뀌는 ${f.harmTotal}곳 중 화음 ● ${f.harmFull}곳${f.harmHalf ? ` · ◐ ${f.harmHalf}곳` : ''}` : '',
    `멜로디 딱 맞음 ${r.good}/${r.total}`,
    r.extra ? `코드 밖 음 ${r.extra}번` : '',
    f.topErrors ? `멜로디가 맨 위가 아닌 곳 ${f.topErrors}번` : '',
  ].filter(Boolean);
  return parts.join(' · ') + '.';
}
