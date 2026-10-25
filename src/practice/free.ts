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
import type { WaitFeedback } from './grader';

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
      if (held.some((m) => m > mel)) this.topErr[i]++;
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
