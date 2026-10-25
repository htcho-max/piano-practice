import type { Step } from './steps';
import { rootName, type ChordSpan } from './chordbook';

/** 장조 으뜸음 → 조표 (#=+). 6 은 F#(+6) 대신 Gb(−6) 이 아니라 찬양에 흔한 쪽으로 F# */
const FIFTHS_OF: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function keyPcOf(fifths: number): number { return (((fifths * 7) % 12) + 12) % 12; }
export function keyName(fifths: number): string { const pc = keyPcOf(fifths); return rootName(pc, fifths < 0); }
export function transposeFifths(fifths: number, n: number): number { return FIFTHS_OF[(keyPcOf(fifths) + n + 120) % 12]; }

export function transposeSteps(steps: Step[], n: number, newFifths: number): Step[] {
  const spell = newFifths < 0 ? 'flat' : 'sharp';
  return steps.map((s) => ({ ...s, notes: s.notes.map((x) => { const midi = x.midi + n; const o = { ...x, midi }; if ([1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)) o.spell = spell; else delete o.spell; return o; }) }));
}

/** "G/B" 를 n 반음 → 새 조의 철자로 */
export function transposeChordName(name: string, n: number, flat: boolean): string {
  return name.replace(/(^|\/)([A-G])([#b♯♭]?)/g, (_, pre: string, l: string, a: string) => {
    const pc = LETTER[l] + (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0) + n;
    return pre + rootName(pc, flat);
  });
}

export function transposeChords(chords: ChordSpan[] | undefined, n: number, newFifths: number): ChordSpan[] | undefined {
  return chords?.map((c) => ({ ...c, name: transposeChordName(c.name, n, newFifths < 0) }));
}
