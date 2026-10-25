import { describe, it, expect } from 'vitest';
import { parseChord, matchChord, voicing, rhFingers, bassNote, progressionChords, PROGRESSIONS, accompany, parseBarsText, barsText } from '../src/music/chordbook';
import { harmonize } from '../src/music/harmonize';
import { totalBeats } from '../src/music/steps';

describe('코드 기호', () => {
  it('여러 표기', () => {
    expect(parseChord('C')!.pcs).toEqual([0, 4, 7]);
    expect(parseChord('Am7')!.pcs).toEqual([9, 0, 4, 7]);
    expect(parseChord('G/B')).toMatchObject({ root: 7, bass: 11 });
    expect(parseChord('F#m')!.pcs).toEqual([6, 9, 1]);
    expect(parseChord('Bb')!.root).toBe(10);
    expect(parseChord('C2')!.pcs).toEqual([0, 2, 4, 7]);
    expect(parseChord('Dsus4')!.pcs).toEqual([2, 7, 9]);
    expect(parseChord('Cmaj7')!.quality).toBe('maj7');
    expect(parseChord('H')).toBeNull();
    expect(parseChord('Cxyz')).toBeNull();
  });
  it('누른 음 판정 (자리바꿈·베이스 허용, 5음 생략 허용)', () => {
    const C = parseChord('C')!;
    expect(matchChord([64, 67, 72], C)).toBe('ok'); // 1전위
    expect(matchChord([48, 64, 67, 72], C)).toBe('ok');
    expect(matchChord([60, 64], C)).toBe('partial');
    expect(matchChord([60, 64, 69], C)).toBe('wrong');
    expect(matchChord([47, 55, 62, 67], parseChord('G/B')!)).toBe('ok');
    expect(matchChord([55, 59, 65], parseChord('G7')!)).toBe('ok'); // 5음 없는 G7
  });
  it('자리: 앞 코드에 가까운 자리바꿈', () => {
    const c = voicing(parseChord('C')!);
    expect(c).toEqual([60, 64, 67]);
    const f = voicing(parseChord('F')!, c);
    expect(f).toEqual([60, 65, 69]); // F/C 자리 (도 그대로)
    const g = voicing(parseChord('G')!, c);
    expect(g).toEqual([59, 62, 67]); // G/B 자리
    expect(rhFingers(f)).toEqual([1, 3, 5]); // 2전위: 아래가 4도
    expect(rhFingers(g)).toEqual([1, 2, 5]); // 1전위: 위가 4도
    expect(rhFingers(c)).toEqual([1, 3, 5]);
    expect(bassNote(parseChord('C')!)).toBe(48);
    expect(bassNote(parseChord('G/B')!)).toBe(47);
    expect(bassNote(parseChord('E')!)).toBe(40);
  });
  it('진행을 조에 맞게', () => {
    expect(progressionChords(PROGRESSIONS[1], 7)).toEqual(['G', 'D', 'Em', 'C']);
    expect(progressionChords(PROGRESSIONS[4], 0)).toEqual(['C', 'G/B', 'Am', 'C/G', 'F', 'C/E', 'Dm', 'G']);
    expect(progressionChords(PROGRESSIONS[1], 10)).toEqual(['Bb', 'F', 'Gm', 'Eb']);
  });
});

describe('반주 패턴', () => {
  const spans = [{ name: 'C', beat: 0, dur: 4 }, { name: 'G', beat: 4, dur: 4 }];
  it('길게 누르기 / 8비트 / 펼친화음', () => {
    const b = accompany(spans, 'block');
    expect(b.steps.length).toBe(2);
    expect(b.steps[0].notes.map((n) => n.midi)).toEqual([48, 60, 64, 67]);
    expect(b.pedalAt).toEqual([0, 4]);
    const e = accompany(spans, 'eight');
    expect(e.steps.length).toBe(16);
    expect(totalBeats(e.steps)).toBe(8);
    expect(e.steps[4].notes.some((n) => n.hand === 'L')).toBe(true); // 3박
    const a = accompany(spans, 'arp');
    expect(a.steps.slice(0, 4).map((s) => s.notes.find((n) => n.hand === 'L')!.midi)).toEqual([48, 55, 60, 55]);
    expect(a.steps[0].notes.find((n) => n.hand === 'R')!.len).toBe(4);
  });
  it('마디 글', () => {
    const r = parseBarsText('C | G | Am F | % | G7 . | X', 4);
    expect(r.spans.map((s) => [s.name, s.beat, s.dur])).toEqual([['C', 0, 4], ['G', 4, 4], ['Am', 8, 2], ['F', 10, 2], ['Am', 12, 2], ['F', 14, 2], ['G7', 16, 4]]);
    expect(r.errors).toEqual(['6마디 "X"']);
    expect(barsText(r.spans, 4, 5)).toBe('C | G | Am F | Am F | G7');
  });
});

describe('코드 붙이기 (기타 앱에서 가져옴)', () => {
  it('비행기 멜로디 → C 장조, C 로 시작해 C 로 끝남', () => {
    const mel = [64, 62, 60, 62, 64, 64, 64, null, 62, 62, 62, null, 64, 67, 67, null, 64, 62, 60, 62, 64, 64, 64, 64, 62, 62, 64, 62, 60, null, null, null];
    const notes = mel.map((m, i) => ({ midi: m, beat: i, dur: 1 }));
    const r = harmonize(notes, { beatsPerBar: 4 });
    expect(r.key.name).toBe('C');
    expect(r.spans[0].name).toBe('C');
    expect(r.spans[r.spans.length - 1].name).toBe('C');
    expect(r.spans.some((s) => s.name === 'G' || s.name === 'G7')).toBe(true);
  });
});
