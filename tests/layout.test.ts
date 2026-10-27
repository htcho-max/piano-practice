import { describe, it, expect } from 'vitest';
import { diatonic, staffY, ledgerLines, layoutSteps } from '../src/music/layout';
import { parseSteps } from '../src/music/steps';
import { pickNote, updateStat, readScore, READ_LEVELS } from '../src/practice/reading';

describe('오선 자리', () => {
  it('줄·칸 높이', () => {
    expect(staffY(diatonic(64).dia, 'treble')).toBe(4); // E4 맨 아랫줄
    expect(staffY(diatonic(77).dia, 'treble')).toBe(0); // F5 맨 윗줄
    expect(staffY(diatonic(60).dia, 'treble')).toBe(5); // 가운데 도 = 덧줄
    expect(staffY(diatonic(57).dia, 'bass')).toBe(0); // A3 낮은음자리표 맨 윗줄
    expect(staffY(diatonic(53).dia, 'bass')).toBe(1); // F3 = 파 줄
    expect(ledgerLines(diatonic(60).dia, 'treble')).toEqual([5]);
    expect(ledgerLines(diatonic(84).dia, 'treble')).toEqual([-1, -2]); // C6
    expect(ledgerLines(diatonic(60).dia, 'bass')).toEqual([-1]);
    expect(diatonic(61, 'flat')).toEqual({ dia: diatonic(62).dia, alter: -1 });
    expect(diatonic(61, 'sharp')).toEqual({ dia: diatonic(60).dia, alter: 1 });
  });
  it('왼손 온음표 + 오른손 4분음표, 빈 곳은 쉼표', () => {
    const lay = layoutSteps(parseSteps('L5:C3=w+R1:C4/q R2:D4/q R3:E4/h | R1:C4/w'), 4);
    const bass = lay.items.filter((i) => i.staff === 'bass');
    expect(bass[0]).toMatchObject({ kind: 'chord', dur: 4 });
    expect(bass[1]).toMatchObject({ kind: 'rest', beat: 4, dur: 4 }); // 둘째 마디 온쉼표
    expect(lay.total).toBe(8);
    expect(lay.bars).toEqual([4]);
  });
  it('임시표는 마디 안에서 이어지고, 제자리표로 취소', () => {
    const lay = layoutSteps(parseSteps('R:F#4/q R:F#4/q R:F4/q R:F#4/q | R:F#4/w'), 4, 'treble');
    const acc = lay.items.filter((i) => i.kind === 'chord').map((i) => (i.kind === 'chord' ? i.notes[0].acc : null));
    expect(acc).toEqual(['sharp', undefined, 'natural', 'sharp', 'sharp']);
  });
  it('3/4 박자와 쉼표 나누기', () => {
    const lay = layoutSteps(parseSteps('R:C4/q r/h | R:E4/h. | r/q R:G4/q r/q'), 3, 'treble');
    const rests = lay.items.filter((i) => i.kind === 'rest').map((i) => [i.beat, i.dur]);
    expect(rests).toEqual([[1, 1], [2, 1], [6, 1], [8, 1]]);
    expect(lay.total).toBe(9);
  });
  it('기둥 방향: 가운데 줄 아래면 위로', () => {
    const lay = layoutSteps(parseSteps('R:E4/q R:C5/q'), 4, 'treble');
    const ch = lay.items.filter((i) => i.kind === 'chord');
    expect(ch.map((c) => c.kind === 'chord' && c.stemUp)).toEqual([true, false]);
  });
});

describe('음표 읽기', () => {
  it('약한 음이 더 자주', () => {
    const pool = READ_LEVELS[0].pool;
    let stats = {};
    for (let i = 0; i < 10; i++) stats = updateStat(stats, 'F4', true, 4000);
    for (const p of pool) if (p.key !== 'F4') for (let i = 0; i < 10; i++) stats = updateStat(stats, p.key, false, 800);
    let f = 0;
    let seed = 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 500; i++) if (pickNote(pool, stats, null, rand).key === 'F4') f++;
    expect(f / 500).toBeGreaterThan(0.4); // 다섯 음 중 하나지만 절반 가까이
  });
  it('바로 앞 음은 다시 안 나옴', () => {
    const pool = READ_LEVELS[0].pool;
    for (let i = 0; i < 50; i++) expect(pickNote(pool, {}, 'C4').key).not.toBe('C4');
  });
  it('점수', () => {
    expect(readScore(20, 20, 1500)).toBe(100);
    expect(readScore(18, 20, 1500)).toBe(90);
    expect(readScore(20, 20, 5000)).toBe(90); // 느리면 깎임
    expect(readScore(0, 0, 0)).toBe(0);
  });
});

import { sliceBars, barCount } from '../src/music/steps';
import { weakBars } from '../src/components/PlayRunner';
describe('구간·약한 마디', () => {
  it('마디 자르기', () => {
    const st = parseSteps('L5:C3=w+R1:C4/q R2:D4/q R3:E4/h | R1:C4/w | R2:D4/h R3:E4/h');
    expect(barCount(st, 4)).toBe(3);
    const s2 = sliceBars(st, 4, 2, 3);
    expect(s2.map((x) => x.beat)).toEqual([0, 4, 6]);
    expect(s2[0].notes[0].midi).toBe(60);
    const s1 = sliceBars(parseSteps('L5:C3=w+R1:C4/q R2:D4/h. | R1:C4/w'), 4, 1, 1);
    expect(s1[0].notes.find((n) => n.hand === 'L')?.len).toBe(4);
  });
  it('약한 마디는 연습한 판 수로 나눔', () => {
    const w = weakBars([
      { barErrors: { 2: 2, 5: 1 }, section: [1, 8] },
      { barErrors: { 2: 1 }, section: [1, 8] },
      { barErrors: { 5: 2 }, section: [5, 6] },
    ], 8);
    expect(w.map((x) => x.bar)).toEqual([2, 5]);
    expect(w[0].rate).toBe(1.5);
  });
});

import { splitNote } from '../src/music/layout';
describe('붙임줄로 나누기', () => {
  it('마디를 넘는 음, 이상한 길이', () => {
    expect(splitNote(2, 2, 3)).toEqual([{ beat: 2, dur: 1 }, { beat: 3, dur: 1 }]);
    expect(splitNote(0, 2.5, 4)).toEqual([{ beat: 0, dur: 2 }, { beat: 2, dur: 0.5 }]);
    expect(splitNote(0, 4, 4)).toEqual([{ beat: 0, dur: 4 }]);
    expect(splitNote(1, 3, 4)).toEqual([{ beat: 1, dur: 3 }]);
  });
  it('layout 에 tieTo·cont', () => {
    const lay = layoutSteps(parseSteps('R:C4/h R:E4=h/h | R:G4/w'), 3, 'treble'); // 3/4 에서 E4 2박이 마디를 넘음 ... 
    const ch = lay.items.filter((i) => i.kind === 'chord');
    expect(ch.some((c) => c.kind === 'chord' && c.tieTo !== undefined)).toBe(true);
    expect(ch.some((c) => c.kind === 'chord' && c.cont)).toBe(true);
  });
});

describe('빔 묶기', () => {
  const beamsOf = (src: string, unit = 1, beats = 4) => layoutSteps(parseSteps(src), beats, 'treble', undefined, 0, unit).beams;
  it('한 박 안 16분 넷 = 묶음 하나, 둘째 빔 전체', () => {
    const b = beamsOf('R:C5/s R:D5/s R:E5/s R:F5/s R:G5/q R:G5/h');
    expect(b).toHaveLength(1);
    expect(b[0].items).toHaveLength(4);
    expect(b[0].sub).toEqual([[0, 3]]);
    expect(b[0].stemUp).toBe(false);
  });
  it('8분 + 16분 둘, 점8분 + 16분 (짧은 빔), 박을 넘지 않음', () => {
    const b = beamsOf('R:C5/e R:D5/s R:E5/s R:C5/e. R:D5/s R:E5/h');
    expect(b).toHaveLength(2);
    expect(b[0].sub).toEqual([[1, 2]]);
    expect(b[1].stubs).toEqual([{ i: 1, dir: -1 }]);
  });
  it('16분-8분-16분 당김 (가운데 8분)', () => {
    const b = beamsOf('R:C5/s R:D5/e R:E5/s R:F5/q R:G5/h');
    expect(b[0].items).toHaveLength(3);
    expect(b[0].stubs).toEqual([{ i: 0, dir: 1 }, { i: 2, dir: -1 }]);
  });
  it('쉼표가 끼면 끊고, 6/8 은 점4분마다', () => {
    expect(beamsOf('R:C5/e r/e R:C5/e R:C5/e R:C5/h')).toHaveLength(1);
    const b = beamsOf('R:C5/e R:D5/e R:E5/e R:F5/e R:G5/e R:A5/e', 1.5, 3);
    expect(b.map((x) => x.items.length)).toEqual([3, 3]);
  });
});

describe('당김음 나누기', () => {
  it('16분 자리에서 박을 넘으면 박에서 나눔, 8분 뒤 4분은 그대로', () => {
    expect(splitNote(0.5, 1.25, 4)).toEqual([{ beat: 0.5, dur: 0.5 }, { beat: 1, dur: 0.75 }]);
    expect(splitNote(1.75, 2.25, 4)).toEqual([{ beat: 1.75, dur: 0.25 }, { beat: 2, dur: 2 }]);
    expect(splitNote(0.5, 1, 4)).toEqual([{ beat: 0.5, dur: 1 }]);
    expect(splitNote(1.5, 1.5, 4)).toEqual([{ beat: 1.5, dur: 1.5 }]);
  });
});
