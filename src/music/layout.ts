import type { Step, PNote } from './steps';
import { pc, octave } from './notes';

/**
 * 연습 칸들 → 오선 위 자리 (그리기와 따로 두어 시험하기 쉽게).
 * 높은음자리표 = 오른손, 낮은음자리표 = 왼손 (한 자리표만 쓰면 모든 음).
 * 단위: 오선 한 칸(sp) = 1. 각 오선의 맨 윗줄 y = 0, 아래로 +.
 */
export type Clef = 'treble' | 'bass';
export type StaffMode = 'grand' | Clef;
export type Acc = 'sharp' | 'flat' | 'natural';
export type LNote = { midi: number; y: number; acc?: Acc; step: number; finger?: number; hand: 'R' | 'L' };
export type LItem =
  | { kind: 'chord'; staff: Clef; beat: number; dur: number; notes: LNote[]; stemUp: boolean; ledgers: number[] }
  | { kind: 'rest'; staff: Clef; beat: number; dur: number };
export type Layout = { items: LItem[]; staves: Clef[]; beats: number; total: number; bars: number[]; onsets: number[] };

const LETTER_OF_PC_SHARP = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C C# D D# E F F# G G# A A# B
const LETTER_OF_PC_FLAT = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]; // C Db D Eb E F Gb G Ab A Bb B
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];

/** 줄·칸 번호 (C4 = 28) */
export function diatonic(midi: number, spell: 'sharp' | 'flat' = 'sharp'): { dia: number; alter: number } {
  const p = pc(midi);
  const letter = (spell === 'flat' ? LETTER_OF_PC_FLAT : LETTER_OF_PC_SHARP)[p];
  // B♯/C♭ 같은 경계는 다루지 않음
  return { dia: (octave(midi) + 0) * 7 + letter, alter: p - NATURAL_PC[letter] };
}

const DIA_E4 = diatonic(64).dia; // 높은음자리표 맨 아랫줄
const DIA_G2 = diatonic(43).dia; // 낮은음자리표 맨 아랫줄
const BOTTOM: Record<Clef, number> = { treble: DIA_E4, bass: DIA_G2 };

/** 그 오선 맨 윗줄 기준 y (칸 단위, 아래로 +) */
export function staffY(dia: number, clef: Clef): number { return 4 - (dia - BOTTOM[clef]) / 2; }

/** 덧줄 y 목록 */
export function ledgerLines(dia: number, clef: Clef): number[] {
  const out: number[] = [];
  const lo = BOTTOM[clef], hi = BOTTOM[clef] + 8;
  for (let d = lo - 2; d >= dia; d -= 2) out.push(staffY(d, clef));
  for (let d = hi + 2; d <= dia; d += 2) out.push(staffY(d, clef));
  return out;
}

/** 쉼표·빈 곳 길이를 마디 안 표준 길이로 나눔 */
function splitRest(from: number, to: number, beats: number): { beat: number; dur: number }[] {
  const out: { beat: number; dur: number }[] = [];
  let t = from;
  let guard = 0;
  while (t < to - 1e-6 && guard++ < 200) {
    const barEnd = (Math.floor(t / beats + 1e-6) + 1) * beats;
    const room = Math.min(to, barEnd) - t;
    // 마디 처음부터 마디 끝까지 비면 온쉼표 하나
    if (Math.abs(t % beats) < 1e-6 && Math.abs(room - beats) < 1e-6) { out.push({ beat: t, dur: beats }); t += room; continue; }
    const pos = t % beats;
    let d = 0.5;
    for (const c of [2, 1, 0.5, 0.25]) if (c <= room + 1e-6 && Math.abs((pos / c) - Math.round(pos / c)) < 1e-6) { d = c; break; }
    if (d > room + 1e-6) d = room;
    out.push({ beat: t, dur: d });
    t += d;
  }
  return out;
}

export function layoutSteps(steps: Step[], beats = 4, mode: StaffMode = 'grand', totalOverride?: number): Layout {
  const staves: Clef[] = mode === 'grand' ? ['treble', 'bass'] : [mode];
  const staffOf = (n: PNote): Clef => (mode === 'grand' ? (n.hand === 'R' ? 'treble' : 'bass') : mode);
  const end = steps.length ? Math.max(...steps.map((s) => s.beat + Math.max(s.dur, ...s.notes.map((n) => n.len ?? s.dur)))) : beats;
  const total = totalOverride ?? Math.ceil(end / beats - 1e-6) * beats;
  const items: LItem[] = [];

  for (const staff of staves) {
    // 같은 시작 박의 음은 한 화음으로
    const chords: { beat: number; dur: number; notes: { n: PNote; step: number }[] }[] = [];
    steps.forEach((s, i) => {
      const ns = s.notes.filter((n) => staffOf(n) === staff);
      if (!ns.length) return;
      const dur = Math.max(...ns.map((n) => n.len ?? s.dur));
      chords.push({ beat: s.beat, dur, notes: ns.map((n) => ({ n, step: i })) });
    });
    let cursor = 0;
    // 마디마다 임시표 기억 (줄·칸 → 올림/내림)
    let barNo = -1;
    let barAcc = new Map<number, number>();
    for (const c of chords) {
      if (c.beat > cursor + 1e-6) for (const r of splitRest(cursor, c.beat, beats)) items.push({ kind: 'rest', staff, ...r });
      const bn = Math.floor(c.beat / beats + 1e-6);
      if (bn !== barNo) { barNo = bn; barAcc = new Map(); }
      const notes: LNote[] = c.notes.map(({ n, step }) => {
        const { dia, alter } = diatonic(n.midi, n.spell);
        const prev = barAcc.get(dia) ?? 0;
        let acc: Acc | undefined;
        if (alter !== prev) { acc = alter > 0 ? 'sharp' : alter < 0 ? 'flat' : 'natural'; barAcc.set(dia, alter); }
        return { midi: n.midi, y: staffY(dia, staff), acc, step, finger: n.finger, hand: n.hand };
      }).sort((a, b) => b.y - a.y);
      const ledgers = [...new Set(c.notes.flatMap(({ n }) => ledgerLines(diatonic(n.midi, n.spell).dia, staff)))].sort((a, b) => a - b);
      const mid = notes.reduce((a, x) => a + x.y, 0) / notes.length;
      items.push({ kind: 'chord', staff, beat: c.beat, dur: c.dur, notes, stemUp: mid >= 2, ledgers });
      cursor = Math.max(cursor, c.beat + c.dur);
    }
    if (cursor < total - 1e-6) for (const r of splitRest(cursor, total, beats)) items.push({ kind: 'rest', staff, ...r });
  }
  const bars: number[] = [];
  for (let b = beats; b < total - 1e-6; b += beats) bars.push(b);
  const onsets = [...new Set(items.map((it) => it.beat))].sort((a, b) => a - b);
  return { items, staves, beats, total, bars, onsets };
}
