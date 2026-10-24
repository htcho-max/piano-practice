import { describe, it, expect } from 'vitest';
import { parseNote, noteName, solfa, isBlack, fitRange, whiteCount } from '../src/music/notes';
import { parseSteps, totalBeats, onlyHand, handsUsed } from '../src/music/steps';
import { chordName } from '../src/music/chords';
import { parseMidi } from '../src/midi/input';

describe('음 이름', () => {
  it('C4 = 60, 이름 되돌리기', () => {
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('A4')).toBe(69);
    expect(parseNote('F#3')).toBe(54);
    expect(parseNote('Bb2')).toBe(46);
    expect(noteName(61)).toBe('C♯4');
    expect(solfa(64)).toBe('미');
    expect(isBlack(61)).toBe(true);
    expect(isBlack(60)).toBe(false);
  });
  it('건반 범위는 도에서 도로, 흰 건반 최소 개수', () => {
    const [lo, hi] = fitRange([60, 67], 15);
    expect(lo % 12).toBe(0);
    expect(hi % 12).toBe(0);
    expect(whiteCount(lo, hi)).toBeGreaterThanOrEqual(15);
    expect(lo).toBeLessThanOrEqual(60);
    expect(hi).toBeGreaterThanOrEqual(67);
  });
});

describe('칸 글 읽기', () => {
  it('손·손가락·화음·쉼표·점음표', () => {
    const s = parseSteps('R1:C4/q L5:C3+R3:E4/h | r/q R:G4/q. R2:D4/e');
    expect(s.map((x) => x.beat)).toEqual([0, 1, 3, 4, 5.5]);
    expect(s[1].notes).toEqual([{ hand: 'L', finger: 5, midi: 48 }, { hand: 'R', finger: 3, midi: 64 }]);
    expect(s[2].notes).toEqual([]);
    expect(s[3].notes[0].finger).toBeUndefined();
    expect(totalBeats(s)).toBe(6);
    expect(handsUsed(s)).toEqual(['R', 'L']);
    expect(onlyHand(s, 'L')[0].notes).toEqual([]);
  });
  it('잘못된 글은 오류', () => {
    expect(() => parseSteps('R1:C4')).toThrow();
    expect(() => parseSteps('X1:C4/q')).toThrow();
    expect(() => parseSteps('R1:H4/q')).toThrow();
  });
});

describe('코드 이름', () => {
  it('3화음·7화음·자리바꿈', () => {
    expect(chordName([60, 64, 67])).toBe('C');
    expect(chordName([57, 60, 64])).toBe('Am');
    expect(chordName([55, 59, 62, 65])).toBe('G7');
    expect(chordName([52, 55, 60])).toBe('C/E');
    expect(chordName([60, 65, 67])).toBe('Csus4');
    expect(chordName([60])).toBe('');
    expect(chordName([60, 61, 62])).toBe('');
  });
});

describe('MIDI 바이트', () => {
  it('노트 온·오프·페달', () => {
    expect(parseMidi([0x90, 60, 100], 5)).toEqual({ kind: 'on', note: 60, vel: 100, time: 5, source: 'midi' });
    expect(parseMidi([0x90, 60, 0], 5)?.kind).toBe('off');
    expect(parseMidi([0x83, 60, 40], 5)?.kind).toBe('off');
    expect(parseMidi([0xb0, 64, 127], 5)).toEqual({ kind: 'pedal', cc: 64, value: 127, time: 5 });
    expect(parseMidi([0xb0, 7, 100], 5)).toBeNull();
    expect(parseMidi([0xfe], 5)).toBeNull(); // active sensing
  });
});
