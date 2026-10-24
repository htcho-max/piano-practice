import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { LESSONS } from '../src/lessons/lessons';
import { totalBeats } from '../src/music/steps';
import { todayPlan, currentLesson, passedSet } from '../src/data/progress';
import type { Run } from '../src/data/db';

describe('레슨 데이터', () => {
  it('번호가 차례대로, id 겹침 없음', () => {
    expect(LESSONS.map((l) => l.n)).toEqual(LESSONS.map((_, i) => i + 1));
    const ids = LESSONS.flatMap((l) => l.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('연주 연습: 마디가 꽉 차고, 손가락 번호가 도 자리와 맞음', () => {
    for (const l of LESSONS) for (const e of l.exercises) {
      if (e.kind !== 'play') continue;
      expect(totalBeats(e.steps) % e.beats, `${e.id} 마디`).toBe(0);
      for (const s of e.steps) for (const n of s.notes) {
        expect(n.midi, e.id).toBeGreaterThanOrEqual(36);
        expect(n.midi, e.id).toBeLessThanOrEqual(84);
        if (!n.finger) continue;
        // 오른손 도 자리 C4=1 … G4=5, 왼손 C3=5 … G3=1
        const expectFinger = n.hand === 'R' ? { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 }[n.midi] : { 48: 5, 50: 4, 52: 3, 53: 2, 55: 1 }[n.midi];
        expect(n.finger, `${e.id} ${n.hand}${n.midi}`).toBe(expectFinger);
      }
    }
  });
  it('찾기 문제는 need 만큼 정답 건반이 있음', () => {
    for (const l of LESSONS) for (const e of l.exercises) if (e.kind === 'find') for (const q of e.questions) expect(q.accept.length).toBeGreaterThanOrEqual(q.need);
  });
});

const run = (exId: string, score: number, passed = true, ts = 1): Run => ({ exId, lessonId: exId.split('-')[0], date: '2026-10-25', ts, mode: 'timed', hands: 'B', bpm: 60, score, passed, seconds: 10 });

describe('오늘의 연습', () => {
  it('처음엔 1과 건반 찾기', () => {
    const p = todayPlan([]);
    expect(p.map((x) => x.exId)).toEqual(['l1-find']);
  });
  it('통과한 만큼 다음 레슨, 손 풀기·다시 하기', () => {
    const runs = [run('l1-find', 100), run('l1-scale', 100), run('l2-up', 95), run('l2-skip', 70), run('l2-pairs', 88)];
    expect(currentLesson(passedSet(runs)).id).toBe('l3');
    const p = todayPlan(runs);
    expect(p.map((x) => x.key)).toEqual(['warm', 'learn', 'review']);
    expect(p[0].exId).toBe('l2-up');
    expect(p[1].exId).toBe('l3-bihaenggi');
    expect(p[2].exId).toBe('l2-skip'); // 통과한 것 중 점수 낮은 것
  });
});
