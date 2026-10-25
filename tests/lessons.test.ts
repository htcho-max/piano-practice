import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { LESSONS } from '../src/lessons/lessons';
import { findLevel } from '../src/practice/reading';
import { totalBeats } from '../src/music/steps';
import { todayPlan, currentLesson, passedSet } from '../src/data/progress';
import type { Run } from '../src/data/db';

describe('레슨 데이터', () => {
  it('번호가 차례대로, id 겹침 없음', () => {
    expect(LESSONS.map((l) => l.n)).toEqual(LESSONS.map((_, i) => i + 1));
    const ids = LESSONS.flatMap((l) => l.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('연주 연습: 마디가 꽉 차고, 손가락 번호가 한 손 자리 안에서 앞뒤가 맞음', () => {
    for (const l of LESSONS) for (const e of l.exercises) {
      if (e.kind !== 'play') continue;
      expect(totalBeats(e.steps) % e.beats, `${e.id} 마디`).toBe(0);
      // 코드(한 손 세 음 이상)를 누르는 연습은 손가락이 코드마다 달라서 빼고
      const chordal = e.steps.some((s) => s.notes.filter((n) => n.hand === 'R').length >= 3);
      for (const hand of (chordal ? [] : ['R', 'L']) as ('R' | 'L')[]) {
        const map = new Map<number, number>();
        for (const s of e.steps) for (const n of s.notes) {
          expect(n.midi, e.id).toBeGreaterThanOrEqual(36);
          expect(n.midi, e.id).toBeLessThanOrEqual(84);
          if (n.hand !== hand || !n.finger) continue;
          const had = map.get(n.midi);
          if (had !== undefined) expect(n.finger, `${e.id} ${hand}${n.midi} 같은 음 같은 손가락`).toBe(had);
          map.set(n.midi, n.finger);
        }
        // 다섯 손가락 자리: 높은 음일수록 오른손은 큰 번호, 왼손은 작은 번호
        const pairs = [...map.entries()].sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < pairs.length; i++) {
          if (pairs[i][0] - pairs[i - 1][0] === 1 && pairs[i][1] === pairs[i - 1][1]) continue; // 파·파♯ 같은 손가락
          if (hand === 'R') expect(pairs[i][1], `${e.id} 오른손 순서`).toBeGreaterThan(pairs[i - 1][1]);
          else expect(pairs[i][1], `${e.id} 왼손 순서`).toBeLessThan(pairs[i - 1][1]);
        }
      }
    }
  });
  it('도 자리 연습(1~8과)은 오른손 C4=1…G4=5, 왼손 C3=5…G3=1', () => {
    for (const l of LESSONS.filter((x) => x.n <= 8)) for (const e of l.exercises) {
      if (e.kind !== 'play') continue;
      for (const s of e.steps) for (const n of s.notes) {
        if (!n.finger) continue;
        const f = n.hand === 'R' ? { 60: 1, 62: 2, 64: 3, 65: 4, 67: 5 }[n.midi] : { 48: 5, 50: 4, 52: 3, 53: 2, 55: 1 }[n.midi];
        expect(n.finger, `${e.id} ${n.hand}${n.midi}`).toBe(f);
      }
    }
  });
  it('읽기 문제는 있는 단계를 가리킴', () => {
    for (const l of LESSONS) for (const e of l.exercises) if (e.kind === 'read') expect(findLevel(e.level), e.id).toBeTruthy();
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

import { parseChord } from '../src/music/chordbook';
import { BUILTIN_SONGS } from '../src/songs/builtin';
describe('코드 레슨·기본 곡 코드', () => {
  it('코드 연습의 코드는 모두 읽힘, 반주 연습은 코드·페달 박이 있음', () => {
    for (const l of LESSONS) for (const e of l.exercises) {
      if (e.kind === 'chords') for (const c of e.chords) expect(parseChord(c), `${e.id} ${c}`).toBeTruthy();
      if (e.kind === 'play' && e.chords) { expect(e.steps.length).toBeGreaterThan(0); expect(totalBeats(e.steps) % e.beats).toBe(0); }
    }
  });
  it('기본 곡 코드가 마디 수와 맞음', () => {
    for (const s of BUILTIN_SONGS) {
      expect(s.chords?.length, s.key).toBeGreaterThan(0);
      const end = s.chords![s.chords!.length - 1];
      expect(end.beat + end.dur, s.key).toBe(totalBeats(s.steps));
    }
  });
});
