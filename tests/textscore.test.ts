import { describe, it, expect } from 'vitest';
import { parseTextScore } from '../src/music/textscore';

describe('글 악보', () => {
  it('머리줄·양손·화음·붙임줄·점·셋잇단·코드', () => {
    const t = parseTextScore(`@TITLE 시험
@TIME 3/4
@KEY G
@BPM 80
@CHORDS . | G | D/F#
R: r/h 1:D4/q | G4/h B4/e G4/e
R: B4/h~ B4/q
L: r/h. | G2+D3/h. | F#2/h.
// 끝`);
    expect([t.title, t.timeNum, t.timeDen, t.beats, t.fifths, t.bpm]).toEqual(['시험', 3, 4, 3, 1, 80]);
    expect(t.steps.map((s) => s.beat)).toEqual([0, 2, 3, 5, 5.5, 6]);
    expect(t.steps[1].notes[0]).toMatchObject({ midi: 62, finger: 1, hand: 'R' });
    expect(t.steps[2].notes.map((n) => n.midi)).toEqual([43, 50, 67]);
    expect(t.steps[2].notes[0].len).toBe(3);
    const b = t.steps.find((s) => s.beat === 6)!;
    expect(b.notes.find((n) => n.hand === 'R')!.midi).toBe(71);
    expect(b.dur).toBe(3); // 붙임줄 2+1 = 칸 길이와 같아서 len 은 없음
    expect(b.notes.find((n) => n.hand === 'R')!.len).toBeUndefined();
    expect(b.notes.find((n) => n.hand === 'L')!.spell).toBe('sharp');
    expect(t.chords.map((c) => [c.name, c.beat])).toEqual([['G', 3], ['D/F#', 6]]);
    expect(t.warnings).toEqual([]);
  });
  it('박 수가 틀린 마디와 못 읽는 음 알려 줌', () => {
    const t = parseTextScore('R: C4/q D4/q | E4/h F4/h G4/q | X4/q');
    expect(t.warnings.join(' ')).toMatch(/2마디: 5박/);
    expect(t.warnings.join(' ')).toMatch(/X4/);
    const s = parseTextScore('R: C4/et D4/et E4/et F4/q.');
    expect(s.steps.map((x) => x.beat)).toEqual([0, 0.333, 0.667, 1]);
  });
  it('음이 없으면 오류', () => { expect(() => parseTextScore('@TITLE 빈 곡')).toThrow(); });
});

import { transposeFifths, transposeChordName, transposeSteps, keyName } from '../src/music/transpose';
describe('조 옮기기', () => {
  it('조표·코드·음', () => {
    expect(transposeFifths(1, 2)).toBe(3); // G → A
    expect(transposeFifths(0, -2)).toBe(-2); // C → Bb
    expect(keyName(-3)).toBe('Eb');
    expect(transposeChordName('D/F#', 2, false)).toBe('E/G#');
    expect(transposeChordName('Em7', -2, true)).toBe('Dm7');
    expect(transposeChordName('G/B', 3, true)).toBe('Bb/D');
    const st = transposeSteps([{ beat: 0, dur: 1, notes: [{ midi: 66, hand: 'R', spell: 'sharp' }, { midi: 60, hand: 'L' }] }], -1, -1);
    expect(st[0].notes).toEqual([{ midi: 65, hand: 'R' }, { midi: 59, hand: 'L' }]);
  });
});
