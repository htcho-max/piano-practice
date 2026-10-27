import { describe, it, expect } from 'vitest';
import { parseChord, parseBarsText } from '../src/music/chordbook';
import { underVoices, arrangeBoth, melodySteps, voiceItems, judgeVoicing, isChordTone } from '../src/music/melodyvoice';
import { FreeGrader } from '../src/practice/free';
import { findBuiltin } from '../src/songs/builtin';
import { parseSteps, onlyHand, totalBeats } from '../src/music/steps';

const C = parseChord('C')!;

describe('멜로디 아래 음', () => {
  it('한 음: 3도 먼저, 없으면 6도', () => {
    expect(underVoices(64, C, 1)).toEqual([60]); // 미 아래 도 (3도)
    expect(underVoices(67, C, 1)).toEqual([64]); // 솔 아래 미
    expect(underVoices(72, C, 1)).toEqual([64]); // 도 아래: 3도(라)는 코드 밖 → 6도 미
  });
  it('두 음: 멜로디가 맨 위인 닫힌 3화음', () => {
    expect(underVoices(64, C, 2)).toEqual([55, 60]); // 솔-도-미
    expect(underVoices(67, C, 2)).toEqual([60, 64]); // 도-미-솔
    expect(underVoices(72, C, 2)).toEqual([64, 67]); // 미-솔-도
    // 7화음은 3음이 꼭 들어가게
    const v = underVoices(71, parseChord('Em7')!, 2);
    expect(v.map((m) => m % 12)).toContain(7);
  });
  it('바닥(G3) 아래로는 안 내려감', () => {
    expect(underVoices(60, C, 2)).toEqual([55]); // 도 아래는 솔 하나만
    expect(underVoices(57, parseChord('Am')!, 2)).toEqual([]);
  });
});

describe('양손 반주 만들기', () => {
  const g = findBuiltin('grace')!;
  const right = onlyHand(g.steps, 'R');
  const total = totalBeats(g.steps);
  it('단계마다 음이 늘어남, 멜로디는 늘 맨 위', () => {
    const counts = ([1, 2, 3, 4] as const).map((lv) => {
      const st = arrangeBoth(right, g.chords!, lv, g.beats, total);
      for (const s of st) {
        const r = s.notes.filter((n) => n.hand === 'R'), l = s.notes.filter((n) => n.hand === 'L');
        if (r.length && l.length) expect(Math.max(...l.map((n) => n.midi))).toBeLessThan(Math.min(...r.map((n) => n.midi)));
      }
      // 멜로디 음은 그대로 다 있음
      const mel = right.flatMap((s) => s.notes.map((n) => `${s.beat}:${n.midi}`));
      for (const m of mel) expect(st.some((s) => `${s.beat}:${Math.max(...s.notes.filter((n) => n.hand === 'R').map((n) => n.midi))}` === m)).toBe(true);
      expect(totalBeats(st)).toBeCloseTo(total);
      return st.reduce((a, s) => a + s.notes.length, 0);
    });
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    expect(counts[3]).toBeGreaterThan(counts[2]);
  });
  it('경과음 아래는 화음 없음, 아래 음은 멜로디 길이만큼', () => {
    const right2 = parseSteps('R:E4/q R:D4/q R:C4/h');
    const spans = parseBarsText('C', 4).spans;
    const st = arrangeBoth(right2, spans, 3, 4, 4);
    expect(st[0].notes.filter((n) => n.hand === 'R').map((n) => n.midi)).toEqual([55, 60, 64]);
    // 솔·도는 미와 같이 1박
    expect(st[0].notes.find((n) => n.midi === 60)!.len ?? st[0].dur).toBeCloseTo(1);
    expect(st[1].notes.filter((n) => n.hand === 'R').map((n) => n.midi)).toEqual([62]);
    expect(st[2].notes.filter((n) => n.hand === 'R').map((n) => n.midi)).toEqual([55, 60]);
  });
  it('멜로디만 남기기', () => {
    const s = melodySteps(parseSteps('L:C3+R:E4+R:G4/q R:A4/q'));
    expect(s.map((x) => x.notes.map((n) => n.midi))).toEqual([[67], [69]]);
  });
});

describe('보이싱 문제·판정', () => {
  it('맨 위 음은 가까이 움직임', () => {
    const it = voiceItems(['C', 'G', 'Am', 'F']);
    it.forEach((x) => expect(isChordTone(x.mel, parseChord(x.chord)!)).toBe(true));
    for (let i = 1; i < it.length; i++) expect(Math.abs(it[i].mel - it[i - 1].mel)).toBeLessThanOrEqual(4);
  });
  it('판정', () => {
    const item = { chord: 'C', mel: 64 };
    expect(judgeVoicing([55, 60, 64], item).full).toBe(true);
    expect(judgeVoicing([48, 55, 60, 64], item).full).toBe(true); // 왼손 베이스 같이
    expect(judgeVoicing([60, 64, 67], item).top).toBe(false); // 솔이 위
    expect(judgeVoicing([60, 64], item).full).toBe(false); // 아래 하나뿐
    expect(judgeVoicing([55, 62, 64], item).wrong).toEqual([62]);
    expect(judgeVoicing([55, 57, 62], { chord: 'Dsus4', mel: 62 }).full).toBe(true); // sus 는 3음 없어도 됨
    expect(judgeVoicing([57, 64, 67], { chord: 'C', mel: 67 }).full).toBe(false); // 라는 코드 밖
  });
});

describe('자유 반주 채점', () => {
  const steps = parseSteps('R:E4/q R:D4/q R:C4/h');
  const spans = parseBarsText('C . F .', 4).spans;
  it('멜로디를 치면 넘어가고, 아래 코드 음은 화음으로 셈', () => {
    const g = new FreeGrader(steps, spans);
    let held: number[] = [];
    const on = (m: number, t: number) => { held = [...held, m]; return g.noteOn(m, t, held); };
    on(48, 0); on(55, 5); expect(on(64, 10).kind).toBe('step'); // 도-솔 + 미(멜로디)
    held = [];
    expect(on(61, 500).kind).toBe('wrong'); // 코드 밖
    expect(on(62, 600).kind).toBe('step'); // 레 (경과음)
    held = [];
    on(41, 1000); on(57, 1001);
    expect(on(60, 1002).kind).toBe('done');
    const r = g.result(2000);
    expect(r.errors).toBe(1);
    expect(r.harmTotal).toBe(2); // 코드가 바뀌는 음 2곳 (미, 도)
    expect(r.harmFull).toBe(2);
  });
  it('멜로디보다 높은 음을 누르고 있으면 맨 위 아님', () => {
    const g = new FreeGrader(steps, spans);
    g.noteOn(67, 0, [67]);
    const f = g.noteOn(64, 5, [67, 64]);
    expect(f.kind).toBe('step');
    expect(g.result(10).topErrors).toBe(1);
  });
});

import { FreeTimedGrader } from '../src/practice/free';
describe('박자 맞춰 자유 반주', () => {
  // ♩60: 1박 = 1000ms, 멜로디 미(C) 레 도(F)
  const steps = parseSteps('R:E4/q R:D4/q R:C4/h');
  const spans = parseBarsText('C . F .', 4).spans;
  it('멜로디 박자 + 화음 + 코드 밖 음', () => {
    const g = new FreeTimedGrader(steps, 60, 0, spans);
    expect(g.harmStep).toEqual([0, 2]);
    expect(g.noteOnFree(48, -20, [48]).kind).toBe('harm');
    expect(g.noteOnFree(55, -10, [48, 55]).kind).toBe('harm');
    expect(g.noteOnFree(64, 0, [48, 55, 64]).kind).toBe('match');
    expect(g.noteOnFree(61, 900, [61]).kind).toBe('extra');
    expect(g.noteOnFree(62, 1000, [62]).kind).toBe('match');
    g.noteOnFree(53, 2000, [53]); g.noteOnFree(60, 2010, [53, 60]); // 파 + 도(멜로디) → 아래 하나
    const r = g.finishFree();
    expect(r.good).toBe(3);
    expect(r.extra).toBe(1);
    expect(r.free).toEqual({ harmTotal: 2, harmFull: 1, harmHalf: 1, topErrors: 0 });
    expect(r.score).toBe(Math.round(60 + 40 * 0.75 - 3));
  });
});

import { colorize } from '../src/music/chordcolor';
describe('찬양 색채', () => {
  const sp = (t: string) => parseBarsText(t, 4).spans;
  const names = (x: { name: string; beat: number }[]) => x.map((s) => `${s.name}@${s.beat}`).join(' ');
  it('sus4 → 3 는 다음 코드로 풀리는 V 에만', () => {
    expect(names(colorize(sp('C | G | C | F'), { sus: true, add2: false, walk: false }, 4))).toBe('C@0 Gsus4@4 G@6 C@8 F@12');
  });
  it('add2 는 딸림이 아닌 장3화음', () => {
    expect(names(colorize(sp('C | G | Am | F/A | G | C'), { sus: false, add2: true, walk: false }, 4))).toBe('C2@0 G2@4 Am@8 F2/A@12 G@16 C2@20');
  });
  it('지나가는 베이스: C → Am 사이 B, G → Em 사이 F# (사장조)', () => {
    expect(names(colorize(sp('C | Am'), { sus: false, add2: false, walk: true }, 4))).toBe('C@0 C/B@3 Am@4');
    expect(names(colorize(sp('G | Em'), { sus: false, add2: false, walk: true }, 4, 1))).toBe('G@0 G/F#@3 Em@4');
    expect(names(colorize(sp('C | Em'), { sus: false, add2: false, walk: true }, 4))).toBe('C@0 C/D@3 Em@4');
  });
});

describe('⑤ 리듬 반주', () => {
  it('4/4: 긴 멜로디 아래 박마다 화음(멜로디 다시), 왼손 8비트', () => {
    const st = arrangeBoth(parseSteps('R:E4/w'), parseBarsText('C', 4).spans, 5, 4, 4);
    const r = st.map((s) => s.notes.filter((n) => n.hand === 'R').map((n) => n.midi));
    expect(r[0]).toEqual([55, 60, 64]);
    expect(st.filter((s) => s.notes.some((n) => n.midi === 64)).map((s) => s.beat)).toEqual([0, 1, 2, 3]);
    expect(st.flatMap((s) => s.notes.filter((n) => n.hand === 'L').map((n) => `${n.midi}@${s.beat}`))).toEqual(['36@0', '43@1.5', '48@2']);
  });
  it('3/4 왈츠: 왼손 첫 박, 오른손 2·3박', () => {
    const st = arrangeBoth(parseSteps('R:G4/h.'), parseBarsText('C', 3).spans, 5, 3, 3);
    expect(st.map((s) => s.beat)).toEqual([0, 1, 2]);
    expect(st[1].notes.map((n) => n.midi)).toEqual([60, 64, 67]);
    expect(st[0].notes.filter((n) => n.hand === 'L')).toHaveLength(1);
  });
  it('6/8: 8분 2·3·5·6 채움, 왼손 점4분 둘', () => {
    const st = arrangeBoth(parseSteps('R:G4/h.'), parseBarsText('C', 3).spans, 5, 3, 3, 8);
    expect(st.map((s) => s.beat)).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(st[3].notes.some((n) => n.hand === 'L')).toBe(true);
  });
});
describe('sus4 와 멜로디', () => {
  it('멜로디가 3음이면 sus 를 걸지 않음', () => {
    const sp = parseBarsText('G | C', 4).spans;
    expect(colorize(sp, { sus: true, add2: false, walk: false }, 4, 0, [{ beat: 0, len: 2, midi: 71 }])[0].name).toBe('G');
    expect(colorize(sp, { sus: true, add2: false, walk: false }, 4, 0, [{ beat: 0, len: 2, midi: 74 }])[0].name).toBe('Gsus4');
  });
});
