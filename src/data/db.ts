import Dexie, { type Table } from 'dexie';
import type { Mode } from '../lessons/lessons';

/** 연습 한 판 */
export type Run = {
  id?: number;
  exId: string;
  lessonId: string;
  date: string; // YYYY-MM-DD (기기 시간)
  ts: number;
  mode: Mode | 'find';
  hands: 'B' | 'R' | 'L';
  bpm: number | null;
  score: number;
  passed: boolean;
  seconds: number;
  detail?: string; // 한 줄 평
};

/** 하루 연습 시간 (건반을 친 시간, 초) */
export type Day = { date: string; seconds: number; notes: number };
export type KV = { key: string; value: unknown };

class PianoDB extends Dexie {
  runs!: Table<Run, number>;
  days!: Table<Day, string>;
  kv!: Table<KV, string>;
  constructor() {
    super('piano-practice');
    this.version(1).stores({ runs: '++id, exId, lessonId, date, ts', days: 'date', kv: 'key' });
  }
}

export const db = new PianoDB();

export async function addRun(r: Omit<Run, 'id'>): Promise<number> {
  const id = await db.runs.add(r as Run);
  notify();
  return id;
}

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}
export async function setKV(key: string, value: unknown) { await db.kv.put({ key, value }); notify(); }

/** 연습한 시간 더하기 */
export async function addActivity(date: string, seconds: number, notes: number) {
  await db.transaction('rw', db.days, async () => {
    const d = await db.days.get(date);
    await db.days.put({ date, seconds: (d?.seconds ?? 0) + seconds, notes: (d?.notes ?? 0) + notes });
  });
  notify();
}

/* 바뀌면 화면 다시 읽기 */
const subs = new Set<() => void>();
let version = 0;
export function notify() { version++; subs.forEach((f) => f()); }
export function subscribeDB(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; }
export function dbVersion() { return version; }
