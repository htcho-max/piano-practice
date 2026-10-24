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
