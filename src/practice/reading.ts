import { parseNote } from '../music/notes';
import type { StaffMode } from '../music/layout';

/** 음표 읽기 단계 */
export type ReadLevel = { id: string; title: string; desc: string; mode: StaffMode; pool: ReadNote[] };
export type ReadNote = { midi: number; spell?: 'sharp' | 'flat'; key: string };

const N = (s: string): ReadNote => ({ midi: parseNote(s), spell: /#/.test(s) ? 'sharp' : /b\d/.test(s) ? 'flat' : undefined, key: s });
const list = (s: string) => s.split(' ').map(N);

export const READ_LEVELS: ReadLevel[] = [
  { id: 'r1', title: '높은음자리표 도~솔', desc: '오른손 도 자리 (가운데 도 ~ 솔)', mode: 'treble', pool: list('C4 D4 E4 F4 G4') },
  { id: 'r2', title: '높은음자리표 한 옥타브', desc: '가운데 도 ~ 높은 도', mode: 'treble', pool: list('C4 D4 E4 F4 G4 A4 B4 C5') },
  { id: 'r3', title: '낮은음자리표 도~솔', desc: '왼손 도 자리 (낮은 도 ~ 솔)', mode: 'bass', pool: list('C3 D3 E3 F3 G3') },
  { id: 'r4', title: '낮은음자리표 한 옥타브', desc: '낮은 도 ~ 가운데 도', mode: 'bass', pool: list('C3 D3 E3 F3 G3 A3 B3 C4') },
  { id: 'r5', title: '큰보표', desc: '두 오선 섞어서 (낮은 도 ~ 높은 도)', mode: 'grand', pool: list('C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5') },
  { id: 'r6', title: '솔 자리', desc: '오른손 솔~레, 왼손 솔~레', mode: 'grand', pool: list('G2 A2 B2 C3 D3 G4 A4 B4 C5 D5') },
  { id: 'r7', title: '샵과 플랫', desc: '검은 건반 (♯·♭)', mode: 'treble', pool: list('C#4 Db4 D#4 Eb4 F#4 Gb4 G#4 Ab4 A#4 Bb4') },
  { id: 'r8', title: '넓게 + 덧줄', desc: '낮은 솔 ~ 높은 도, 덧줄 음 포함', mode: 'grand', pool: list('G2 A2 B2 C3 D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6') },
];

export function findLevel(id: string): ReadLevel | undefined { return READ_LEVELS.find((l) => l.id === id); }

/** 음마다 기록: 몇 번, 최근 틀린 비율(0~1), 최근 평균 걸린 ms */
export type ReadStat = { n: number; err: number; ms: number };
export type ReadStats = Record<string, ReadStat>;

/** 약한 음일수록 자주 (틀린 비율·느림), 바로 앞 음은 피함 */
export function pickNote(pool: ReadNote[], stats: ReadStats, prev: string | null, rand: () => number = Math.random): ReadNote {
  const cand = pool.length > 1 ? pool.filter((p) => p.key !== prev) : pool;
  const w = cand.map((p) => {
    const s = stats[p.key];
    if (!s || s.n === 0) return 2; // 아직 안 본 음
    const err = s.err;
    const slow = Math.min(2, Math.max(0, (s.ms - 1500) / 1500));
    return 1 + 4 * err + slow;
  });
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) return cand[i]; }
  return cand[cand.length - 1];
}

export function updateStat(stats: ReadStats, key: string, wrong: boolean, ms: number): ReadStats {
  const s = stats[key] ?? { n: 0, err: 0, ms: 0 };
  const n = s.n + 1;
  // 처음엔 평균, 10번 넘으면 최근 10번 쪽에 무게
  const k = Math.min(n, 10);
  return { ...stats, [key]: { n, err: s.err + ((wrong ? 1 : 0) - s.err) / k, ms: s.ms + (Math.min(ms, 10000) - s.ms) / k } };
}

/** 퀴즈 점수: 한 번에 맞힌 비율 (느리면 조금 깎음) */
export function readScore(firstTry: number, total: number, avgMs: number): number {
  if (!total) return 0;
  const base = (100 * firstTry) / total;
  const slow = Math.max(0, Math.min(15, (avgMs - 3000) / 200));
  return Math.max(0, Math.round(base - slow));
}
export const READ_PASS = 85;
