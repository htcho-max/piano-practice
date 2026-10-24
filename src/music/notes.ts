/** MIDI 번호 ↔ 음 이름. 가운데 도(C4) = 60 */
export const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const SOLFA = ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'];
const BLACK = new Set([1, 3, 6, 8, 10]);

export type LabelStyle = 'solfa' | 'letter';

export function pc(midi: number): number { return ((midi % 12) + 12) % 12; }
export function octave(midi: number): number { return Math.floor(midi / 12) - 1; }
export function isBlack(midi: number): boolean { return BLACK.has(pc(midi)); }

/** "C4", "F♯3" */
export function noteName(midi: number): string { return `${LETTERS[pc(midi)]}${octave(midi)}`; }
/** "도", "파♯" (옥타브 없이) */
export function solfa(midi: number): string { return SOLFA[pc(midi)]; }
export function label(midi: number, style: LabelStyle): string { return style === 'solfa' ? solfa(midi) : noteName(midi); }

/** "C4" "F#3" "Bb2" → MIDI */
export function parseNote(s: string): number {
  const m = /^([A-Ga-g])([#♯b♭]?)(-?\d)$/.exec(s.trim());
  if (!m) throw new Error(`음 이름을 읽을 수 없어요: ${s}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase() as 'C'];
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

/** 건반 범위 안의 흰 건반 수 */
export function whiteCount(lo: number, hi: number): number {
  let n = 0;
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) n++;
  return n;
}

/** 주어진 음들이 다 들어가도록 흰 건반에서 시작·끝나는 범위 (최소 폭 보장) */
export function fitRange(notes: number[], minWhite = 15): [number, number] {
  let lo = notes.length ? Math.min(...notes) : 60;
  let hi = notes.length ? Math.max(...notes) : 72;
  // 도에서 시작, 도(또는 시)에서 끝나면 읽기 쉬움
  lo -= pc(lo); // 그 옥타브의 도
  hi += (12 - pc(hi)) % 12; // 다음 도
  if (hi === lo) hi += 12;
  while (whiteCount(lo, hi) < minWhite) { if (hi - 60 <= 60 - lo) hi += 12; else lo -= 12; }
  return [Math.max(21, lo), Math.min(108, hi)];
}
