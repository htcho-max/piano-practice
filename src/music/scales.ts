/**
 * 장음계·화성단음계 24조, 손가락 번호(널리 쓰는 표준 운지), 양손·아르페지오·하농.
 * 손가락 표는 한 옥타브 오름차순 8음 (으뜸음 → 으뜸음).
 */
import type { PNote, Step } from './steps';
import { rootName } from './chordbook';

export type ScaleKind = 'major' | 'minor';
export type ScaleDef = { pc: number; kind: ScaleKind; name: string; fifths: number; rh: number[]; lh: number[] };

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const HMIN = [0, 2, 3, 5, 7, 8, 11]; // 화성단음계 (7음 올림)
/** 조표: 장조 으뜸음 → 올림/내림 수 (#=+) */
const MAJ_FIFTHS: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };

const F = (s: string) => s.split('').map(Number);
// 장조 [오른손, 왼손]
const MAJOR_FING: Record<number, [string, string]> = {
  0: ['12312345', '54321321'], 7: ['12312345', '54321321'], 2: ['12312345', '54321321'], 9: ['12312345', '54321321'], 4: ['12312345', '54321321'],
  11: ['12312345', '43214321'], 5: ['12341234', '54321321'], 6: ['23412312', '43213214'], 1: ['23123412', '32143213'],
  8: ['34123123', '32143213'], 3: ['31234123', '32143213'], 10: ['41231234', '32143213'],
};
// 화성단음계 [오른손, 왼손]
const MINOR_FING: Record<number, [string, string]> = {
  9: ['12312345', '54321321'], 4: ['12312345', '54321321'], 2: ['12312345', '54321321'], 7: ['12312345', '54321321'], 0: ['12312345', '54321321'],
  11: ['12312345', '43214321'], 5: ['12341234', '54321321'], 6: ['34123123', '43213214'], 1: ['34123123', '32143213'],
  8: ['34123123', '32132143'], 3: ['31234123', '21432132'], 10: ['21231234', '21321432'],
};

/** 단조 이름은 관습대로 (D#m 대신 E♭m, A#m 대신 B♭m, G#m·C#m·F#m 은 샵) */
function nameOf(pc: number, kind: ScaleKind): string {
  if (kind === 'major') return rootName(pc, [1, 3, 5, 8, 10].includes(pc)) + ' 장조';
  return rootName(pc, [3, 10].includes(pc)) + 'm 단조';
}

export const SCALES: ScaleDef[] = [
  ...[0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map((pc) => ({ pc, kind: 'major' as const, name: nameOf(pc, 'major'), fifths: MAJ_FIFTHS[pc], rh: F(MAJOR_FING[pc][0]), lh: F(MAJOR_FING[pc][1]) })),
  ...[9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7, 2].map((pc) => ({ pc, kind: 'minor' as const, name: nameOf(pc, 'minor'), fifths: MAJ_FIFTHS[(pc + 3) % 12], rh: F(MINOR_FING[pc][0]), lh: F(MINOR_FING[pc][1]) })),
];
export function scaleId(s: ScaleDef): string { return `${s.kind === 'major' ? 'M' : 'm'}${s.pc}`; }
export function findScale(id: string): ScaleDef | undefined { return SCALES.find((s) => scaleId(s) === id); }

/** 음계 음들 (오름차순, octaves 옥타브, 시작 MIDI) */
export function scaleNotes(s: ScaleDef, start: number, octaves: number): number[] {
  const iv = s.kind === 'major' ? MAJ : HMIN;
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) for (const x of iv) out.push(start + 12 * o + x);
  out.push(start + 12 * octaves);
  return out;
}

/** 오름차순에서 손가락 a → b 가 자연스러운가 (오른손: 이어서 올라가거나 3·4 다음 엄지, 왼손: 이어서 내려가거나 엄지 다음 3·4) */
export function fingerStepOk(hand: 'R' | 'L', a: number, b: number): boolean {
  return hand === 'R' ? b === a + 1 || (b === 1 && (a === 3 || a === 4)) : b === a - 1 || (a === 1 && (b === 3 || b === 4));
}

/**
 * 오름차순 손가락. 맨 아래·맨 위는 표의 처음·마지막,
 * 가운데 으뜸음은 표의 처음/마지막 중 앞뒤로 자연스럽게 이어지는 쪽 (C 장조 오른손 = 1, B♭m 오른손 = 4)
 */
export function scaleFingers(s: ScaleDef, hand: 'R' | 'L', octaves: number): number[] {
  const seq = hand === 'R' ? s.rh : s.lh;
  const n = 7 * octaves + 1;
  const mid = [seq[0], seq[7]].find((m) => fingerStepOk(hand, seq[6], m) && fingerStepOk(hand, m, seq[1])) ?? seq[0];
  return Array.from({ length: n }, (_, i) => (i === 0 ? seq[0] : i === n - 1 ? seq[7] : i % 7 === 0 ? mid : seq[i % 7]));
}

/** 그 조의 검은 건반 철자 */
function spellOf(s: ScaleDef): 'sharp' | 'flat' { return s.fifths < 0 ? 'flat' : 'sharp'; }

/** 시작 음: 오른손 가운데 도 근처, 왼손 한 옥타브 아래 */
export function scaleStart(s: ScaleDef, hand: 'R' | 'L'): number {
  const base = 60 + s.pc - (s.pc > 6 ? 12 : 0); // F#4 이상이면 한 옥타브 아래에서
  return hand === 'R' ? base : base - 12;
}

export type ScaleOpts = { hands: 'R' | 'L' | 'B'; octaves: 1 | 2; rhythm: 'q' | 'e' };

/** 음계를 올라갔다 내려오는 연습 칸 (양손이면 한 옥타브 떨어져 나란히) */
export function scaleSteps(s: ScaleDef, o: ScaleOpts): Step[] {
  const dur = o.rhythm === 'q' ? 1 : 0.5;
  const hands: ('R' | 'L')[] = o.hands === 'B' ? ['R', 'L'] : [o.hands];
  const seqs = hands.map((h) => {
    // 2옥타브 양손이면 왼손을 두 옥타브 아래에서 (낮은음자리표 안에 들어오게)
    const up = scaleNotes(s, scaleStart(s, h) - (h === 'L' && o.octaves === 2 && scaleStart(s, h) >= 48 ? 12 : 0), o.octaves);
    const fu = scaleFingers(s, h, o.octaves);
    const notes = [...up, ...up.slice(0, -1).reverse()];
    const fing = [...fu, ...fu.slice(0, -1).reverse()];
    return { h, notes, fing };
  });
  const len = seqs[0].notes.length;
  const steps: Step[] = [];
  for (let i = 0; i < len; i++) {
    const notes: PNote[] = seqs.map(({ h, notes, fing }) => ({ midi: notes[i], hand: h, finger: fing[i], ...(isBlackPc(notes[i]) ? { spell: spellOf(s) } : {}) }));
    steps.push({ beat: i * dur, dur: i === len - 1 ? dur : dur, notes });
  }
  // 마지막 음은 마디 끝까지 길게
  const total = len * dur;
  const bar = Math.ceil(total / 4 - 1e-6) * 4;
  steps[len - 1].dur = bar - (len - 1) * dur;
  return steps;
}
const isBlackPc = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

/* ── 아르페지오 (흰 건반 으뜸음 6개만: 운지가 같은 C·F·G·Am·Dm·Em) ── */
export const ARPEGGIOS = [
  { id: 'C', pc: 0, minor: false }, { id: 'F', pc: 5, minor: false }, { id: 'G', pc: 7, minor: false },
  { id: 'Am', pc: 9, minor: true }, { id: 'Dm', pc: 2, minor: true }, { id: 'Em', pc: 4, minor: true },
];
/** 2옥타브 오르내림: 오른손 1-2-3-1-2-3-5, 왼손 5-4-2-1-4-2-1 */
export function arpeggioSteps(id: string, hands: 'R' | 'L' | 'B', rhythm: 'q' | 'e' = 'e'): Step[] {
  const a = ARPEGGIOS.find((x) => x.id === id)!;
  const iv = a.minor ? [0, 3, 7] : [0, 4, 7];
  const dur = rhythm === 'q' ? 1 : 0.5;
  const hs: ('R' | 'L')[] = hands === 'B' ? ['R', 'L'] : [hands];
  const seqs = hs.map((h) => {
    const start = (h === 'R' ? 60 : 48) + a.pc - (a.pc > 6 ? 12 : 0);
    const up = [0, 1].flatMap((o) => iv.map((x) => start + 12 * o + x)).concat(start + 24);
    const fu = h === 'R' ? [1, 2, 3, 1, 2, 3, 5] : [5, 4, 2, 1, 4, 2, 1];
    return { h, notes: [...up, ...up.slice(0, -1).reverse()], fing: [...fu, ...fu.slice(0, -1).reverse()] };
  });
  const len = seqs[0].notes.length;
  const steps: Step[] = [];
  for (let i = 0; i < len; i++) steps.push({ beat: i * dur, dur, notes: seqs.map(({ h, notes, fing }) => ({ midi: notes[i], hand: h, finger: fing[i] })) });
  const bar = Math.ceil((len * dur) / 4 - 1e-6) * 4;
  steps[len - 1].dur = bar - (len - 1) * dur;
  return steps;
}

/* ── 하농 1번 (1873, 저작권 없음): 도-미-파-솔-라-솔-파-미 를 한 칸씩 올라가며, 양손 한 옥타브 차 ── */
export function hanon1(hands: 'R' | 'L' | 'B' = 'B'): Step[] {
  const white = (deg: number) => { const o = Math.floor(deg / 7); return 36 + 12 * o + MAJ[((deg % 7) + 7) % 7]; }; // deg 0 = C2 (왼손), 오른손은 한 옥타브 위
  const UP = [0, 2, 3, 4, 5, 4, 3, 2];
  const DOWN = [0, -2, -3, -4, -5, -4, -3, -2];
  const rhUp = [1, 2, 3, 4, 5, 4, 3, 2], lhUp = [5, 4, 3, 2, 1, 2, 3, 4];
  const rhDn = [5, 4, 3, 2, 1, 2, 3, 4], lhDn = [1, 2, 3, 4, 5, 4, 3, 2]; // 내려갈 때는 올라갈 때의 거울
  const steps: Step[] = [];
  let beat = 0;
  const push = (lDeg: number, fR: number, fL: number) => {
    const notes: PNote[] = [];
    if (hands !== 'L') notes.push({ midi: white(lDeg + 7), hand: 'R', finger: fR });
    if (hands !== 'R') notes.push({ midi: white(lDeg), hand: 'L', finger: fL });
    steps.push({ beat, dur: 0.5, notes });
    beat += 0.5;
  };
  // 올라가기: 도~시에서 시작하는 14 무늬, 내려가기: 꼭대기 솔에서 라까지 14 무늬, 끝 도
  for (let k = 0; k < 14; k++) UP.forEach((d, i) => push(k + d, rhUp[i], lhUp[i]));
  for (let k = 0; k < 14; k++) DOWN.forEach((d, i) => push(18 - k + d, rhDn[i], lhDn[i]));
  steps.push({ beat, dur: 4, notes: [...(hands !== 'L' ? [{ midi: white(7), hand: 'R' as const, finger: 1 }] : []), ...(hands !== 'R' ? [{ midi: white(0), hand: 'L' as const, finger: 5 }] : [])] });
  return steps;
}
