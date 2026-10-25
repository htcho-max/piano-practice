import { describe, it, expect } from 'vitest';
import { parseSteps } from '../src/music/steps';
import { WaitGrader, TimedGrader, verdictLine, GOOD_MS } from '../src/practice/grader';

describe('기다려 주기', () => {
  it('맞는 건반을 누를 때까지 기다리고, 틀린 건반을 셈', () => {
    const g = new WaitGrader(parseSteps('R1:C4/q R2:D4/q R3:E4/q'));
    expect(g.noteOn(62, 0).kind).toBe('wrong');
    expect(g.noteOn(60, 100).kind).toBe('step');
    expect(g.noteOn(62, 200).kind).toBe('step');
    expect(g.noteOn(64, 300).kind).toBe('done');
    const r = g.result(300);
    expect(r.errors).toBe(1);
    expect(r.clean).toBe(2);
    expect(r.steps).toBe(3);
    expect(r.score).toBe(67);
  });
  it('화음은 다 같이 누르고 있어야 넘어감', () => {
    const g = new WaitGrader(parseSteps('L5:C3+R1:C4/h R2:D4/q'));
    expect(g.noteOn(48, 0).kind).toBe('hit');
    g.noteOff(48); // 먼저 뗌
    expect(g.noteOn(60, 50).kind).toBe('hit'); // 아직 C3 이 없음
    expect(g.noteOn(48, 80).kind).toBe('step');
    expect(g.idx).toBe(1);
  });
  it('같은 음이 이어지면 다시 눌러야 함, 쉼표는 건너뜀', () => {
    const g = new WaitGrader(parseSteps('r/q R3:E4/q R3:E4/q r/q R1:C4/q'));
    expect(g.idx).toBe(1);
    expect(g.noteOn(64, 0).kind).toBe('step');
    expect(g.idx).toBe(2);
    expect(g.noteOn(64, 10).kind).toBe('step');
    expect(g.idx).toBe(4);
    expect(g.noteOn(60, 20).kind).toBe('done');
    expect(g.result(20).score).toBe(100);
    expect(verdictLine(g.result(20))).toMatch(/틀린 건반 없이/);
  });
});

describe('박자 맞춰', () => {
  const steps = parseSteps('R1:C4/q R2:D4/q R3:E4/q R2:D4/q'); // ♩=60 → 1초 간격
  it('딱 맞음·빠름·늦음·놓침', () => {
    const g = new TimedGrader(steps, 60, 1000);
    expect(g.noteOn(60, 1000 + 20)).toMatchObject({ kind: 'match', exp: { verdict: 'good' } });
    expect(g.noteOn(62, 2000 - 150)).toMatchObject({ kind: 'match', exp: { verdict: 'early' } });
    expect(g.noteOn(64, 3000 + GOOD_MS + 50)).toMatchObject({ kind: 'match', exp: { verdict: 'late' } });
    const r = g.finish(); // 마지막 D4 놓침
    expect([r.good, r.early, r.late, r.miss]).toEqual([1, 1, 1, 1]);
    expect(r.score).toBe(Math.round((100 * (1 + 0.6 * 2)) / 4));
  });
  it('엉뚱한 건반은 extra, 창 밖이면 같은 음이라도 extra', () => {
    const g = new TimedGrader(steps, 60, 1000);
    expect(g.noteOn(65, 1000).kind).toBe('extra');
    expect(g.noteOn(60, 1000 + 900).kind).toBe('extra'); // 창(최대 420ms) 밖
    expect(g.noteOn(60, 1010).kind).toBe('match');
    const r = g.finish();
    expect(r.extra).toBe(2);
  });
  it('같은 음이 이어지면 가까운 쪽에 짝지음', () => {
    const g = new TimedGrader(parseSteps('R3:E4/q R3:E4/q R3:E4/q'), 120, 0); // 0.5초 간격
    g.noteOn(64, 510); g.noteOn(64, 10); g.noteOn(64, 1020);
    const r = g.finish();
    expect(r.good).toBe(3);
  });
  it('양손 어긋남(ms)', () => {
    const g = new TimedGrader(parseSteps('L5:C3+R1:C4/h L1:G3+R5:G4/h'), 60, 0);
    g.noteOn(48, 0); g.noteOn(60, 80); g.noteOn(55, 2000); g.noteOn(67, 2040);
    const r = g.finish();
    expect(r.handGapMs).toBe(60);
    expect(r.miss).toBe(0);
  });
  it('sweep 은 창이 지난 음을 놓침으로', () => {
    const g = new TimedGrader(steps, 60, 0);
    expect(g.sweep(100).length).toBe(0);
    expect(g.sweep(1000).length).toBe(1);
    expect(g.stepAt(-5)).toBe(-1);
    expect(g.stepAt(1500)).toBe(1);
  });
});

import { gradePedal } from '../src/practice/grader';
describe('페달 바꾸기', () => {
  it('바뀔 때 뗐다 밟기', () => {
    const r = gradePedal([0, 2000, 4000, 6000], [
      { time: 50, value: 127 },
      { time: 2100, value: 0 }, { time: 2250, value: 127 }, // 맞음
      { time: 3500, value: 0 }, { time: 3600, value: 127 }, // 너무 일찍
      { time: 6900, value: 0 }, { time: 7000, value: 127 }, // 너무 늦게
    ]);
    expect(r).toEqual({ ok: 2, total: 4, used: true, late: 1, early: 1 });
    expect(gradePedal([0, 1000], []).used).toBe(false);
  });
});
