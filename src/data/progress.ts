import { LESSONS, type Lesson, type Exercise } from '../lessons/lessons';
import type { Run } from './db';

export function passedSet(runs: Run[]): Set<string> {
  return new Set(runs.filter((r) => r.passed).map((r) => r.exId));
}

export function bestScore(runs: Run[], exId: string): number | null {
  const s = runs.filter((r) => r.exId === exId).map((r) => r.score);
  return s.length ? Math.max(...s) : null;
}

export function lessonDone(lesson: Lesson, passed: Set<string>): number {
  return lesson.exercises.filter((e) => passed.has(e.id)).length;
}

/** 지금 배울 레슨: 아직 다 통과 못 한 첫 레슨 (다 했으면 마지막) */
export function currentLesson(passed: Set<string>): Lesson {
  return LESSONS.find((l) => lessonDone(l, passed) < l.exercises.length) ?? LESSONS[LESSONS.length - 1];
}

/** 그 레슨에서 다음에 할 연습 */
export function nextExercise(lesson: Lesson, passed: Set<string>): Exercise {
  return lesson.exercises.find((e) => !passed.has(e.id)) ?? lesson.exercises[0];
}

export type PlanItem = { key: string; label: string; why: string; minutes: number; exId: string };

/**
 * 오늘의 연습 (20~30분):
 * 1) 손 풀기 — 손가락 번호 연습 (2과 이후엔 지난 레슨의 손가락 연습)
 * 2) 새로 배우기 — 지금 레슨의 다음 연습
 * 3) 다시 하기 — 통과했지만 점수가 가장 낮은(또는 오래된) 곡
 */
export function todayPlan(runs: Run[]): PlanItem[] {
  const passed = passedSet(runs);
  const lesson = currentLesson(passed);
  const items: PlanItem[] = [];
  const warm = lesson.n >= 5 && passed.has('l5-down') ? 'l5-down' : 'l2-up';
  if (lesson.n > 1) items.push({ key: 'warm', label: '손 풀기', why: lesson.n >= 5 ? '양손 다섯 손가락' : '오른손 다섯 손가락', minutes: 3, exId: warm });
  const next = nextExercise(lesson, passed);
  items.push({ key: 'learn', label: `${lesson.n}과 ${lesson.title}`, why: next.title, minutes: lesson.n === 1 ? 10 : 15, exId: next.id });
  // 다시 하기: 통과한 '연주' 연습 중 최고 점수가 가장 낮은 것
  const played = LESSONS.flatMap((l) => l.exercises).filter((e) => e.kind === 'play' && passed.has(e.id) && e.id !== warm && e.id !== next.id);
  if (played.length) {
    const scored = played.map((e) => {
      const rs = runs.filter((r) => r.exId === e.id);
      return { e, best: Math.max(...rs.map((r) => r.score)), last: Math.max(...rs.map((r) => r.ts)) };
    }).sort((a, b) => a.best - b.best || a.last - b.last);
    const pick = scored[0];
    items.push({ key: 'review', label: '다시 하기', why: `${pick.e.title} (최고 ${pick.best}점)`, minutes: 5, exId: pick.e.id });
  }
  return items;
}
