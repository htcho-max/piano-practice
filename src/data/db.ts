import Dexie, { type Table } from 'dexie';
import type { Mode } from '../lessons/lessons';
import type { Step } from '../music/steps';

/** 연습 한 판 */
export type Run = {
  id?: number;
  exId: string;
  lessonId: string;
  date: string; // YYYY-MM-DD (기기 시간)
  ts: number;
  mode: Mode | 'find' | 'read';
  hands: 'B' | 'R' | 'L';
  bpm: number | null;
  score: number;
  /** 곡 연습: 마디마다 틀린 수 (마디 번호 1부터 → 인덱스 0부터), 구간 연습이면 그 구간만 */
  barErrors?: Record<number, number>;
  section?: [number, number];
  passed: boolean;
  seconds: number;
  detail?: string; // 한 줄 평
};

/** 곡 (기본 곡은 builtin id 로, 불러온 곡은 여기 저장) */
export type Song = {
  id?: number;
  title: string;
  composer?: string;
  beats: number; // 마디당 4분음표 수
  timeNum: number; timeDen: number;
  bpm: number;
  steps: Step[];
  origin: 'import';
  fileName?: string;
  createdAt: number;
  warnings?: string[];
  /** 코드 이름 구간 (반주 만들기·악보 위 표시), 페달 바꿀 박, 조표 */
  chords?: { name: string; beat: number; dur: number }[];
  pedalAt?: number[];
  fifths?: number;
};

/** 하루 연습 시간 (건반을 친 시간, 초) */
export type Day = { date: string; seconds: number; notes: number };
export type KV = { key: string; value: unknown };

class PianoDB extends Dexie {
  runs!: Table<Run, number>;
  days!: Table<Day, string>;
  songs!: Table<Song, number>;
  kv!: Table<KV, string>;
  constructor() {
    super('piano-practice');
    this.version(1).stores({ runs: '++id, exId, lessonId, date, ts', days: 'date', kv: 'key' });
    this.version(2).stores({ songs: '++id, title, createdAt' });
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
