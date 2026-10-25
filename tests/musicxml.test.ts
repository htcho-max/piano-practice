// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseMusicXML } from '../src/music/musicxml';
import xml from './fixtures/piano-test.musicxml?raw';

describe('MusicXML 읽기', () => {
  const s = parseMusicXML(xml);
  it('제목·박자표·템포', () => {
    expect(s.title).toBe('시험 곡');
    expect(s.composer).toBe('앱 시험');
    expect([s.timeNum, s.timeDen, s.beats, s.bpm]).toEqual([3, 4, 3, 96]);
    expect(s.bars).toBe(2);
  });
  it('두 오선 → 양손, 화음, 길이', () => {
    const first = s.steps[0];
    expect(first.beat).toBe(0);
    expect(first.notes.map((n) => [n.hand, n.midi])).toEqual([['L', 43], ['L', 50], ['R', 67]]);
    expect(first.notes.find((n) => n.hand === 'R')?.finger).toBe(1);
    expect(first.notes.find((n) => n.midi === 43)?.len).toBe(3); // 점2분 (칸 길이 1과 다름)
    expect(s.steps.map((x) => x.beat)).toEqual([0, 1, 1.5, 2, 5]); // 쉼표는 칸이 아님 (앞 칸 길이에 포함)
  });
  it('붙임줄은 한 음으로, 꾸밈음은 빼고, 임시표 철자', () => {
    const fs = s.steps.find((x) => x.beat === 2)!;
    expect(fs.notes[0]).toMatchObject({ midi: 66, spell: 'sharp', len: 2 });
    expect(s.steps.some((x) => x.beat === 3)).toBe(false); // 붙임줄 둘째 음은 새 칸이 아님
    const bb = s.steps.find((x) => x.beat === 5)!;
    expect(bb.notes.map((n) => [n.midi, n.spell])).toEqual([[50, undefined], [70, 'flat']]); // forward 뒤 왼손 D3 와 같은 박
    expect(s.steps.flatMap((x) => x.notes).some((n) => n.midi === 72)).toBe(false);
  });
  it('코드 기호(harmony)', () => {
    expect(s.chords).toEqual([{ name: 'G', beat: 0, dur: 5 }, { name: 'Ebmaj7/G', beat: 5, dur: 1 }]);
    expect(s.fifths).toBe(1);
  });
  it('도돌이표 안내', () => {
    expect(s.warnings.join(' ')).toMatch(/도돌이표/);
  });
  it('잘못된 파일은 오류', () => {
    expect(() => parseMusicXML('<html></html>')).toThrow();
    expect(() => parseMusicXML('not xml <<')).toThrow();
  });
});
