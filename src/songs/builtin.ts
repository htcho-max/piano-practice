import { parseSteps, type Step } from '../music/steps';
import { parseBarsText, type ChordSpan } from '../music/chordbook';

/** 앱에 들어 있는 곡 (모두 저작권이 끝난 옛 곡·찬송, 쉬운 편곡) */
export type BuiltinSong = { key: string; title: string; composer: string; note: string; beats: number; timeNum: number; timeDen: number; bpm: number; steps: Step[]; level: 1 | 2 | 3; chords?: ChordSpan[] };

const S = (key: string, title: string, composer: string, note: string, src: string, o: { beats?: number; bpm: number; level: 1 | 2 | 3 }): BuiltinSong => {
  const beats = o.beats ?? 4;
  return { key, title, composer, note, beats, timeNum: beats, timeDen: 4, bpm: o.bpm, steps: parseSteps(src), level: o.level };
};

export const BUILTIN_SONGS: BuiltinSong[] = [
  S('bihaenggi', '떴다 떴다 비행기', '미국 민요', '도 자리, 왼손 도·솔', 'L5:C3=w+R3:E4/q R2:D4/q R1:C4/q R2:D4/q | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L1:G3=w+R2:D4/q R2:D4/q R2:D4/h | L5:C3=w+R3:E4/q R5:G4/q R5:G4/h | L5:C3=w+R3:E4/q R2:D4/q R1:C4/q R2:D4/q | L5:C3=w+R3:E4/q R3:E4/q R3:E4/q R3:E4/q | L1:G3=w+R2:D4/q R2:D4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/w', { bpm: 80, level: 1 }),
  S('nabi', '나비야', '독일 민요', '도 자리, 왼손 도·솔', 'L5:C3=w+R5:G4/q R3:E4/q R3:E4/h | L1:G3=w+R4:F4/q R2:D4/q R2:D4/h | L5:C3=w+R1:C4/q R2:D4/q R3:E4/q R4:F4/q | L5:C3=w+R5:G4/q R5:G4/q R5:G4/h | L5:C3=w+R5:G4/q R3:E4/q R3:E4/h | L1:G3=w+R4:F4/q R2:D4/q R2:D4/h | L5:C3=w+R1:C4/q R3:E4/q R5:G4/q R5:G4/q | L5:C3=w+R1:C4/w', { bpm: 88, level: 1 }),
  S('twinkle', '반짝반짝 작은 별', '프랑스 민요', '오른손 라에서 손을 살짝 벌림, 왼손 도·파·솔', 'L5:C3=w+R:C4/q R:C4/q R:G4/q R:G4/q | L2:F3=h+R:A4/q R:A4/q L5:C3=h+R:G4/h | L2:F3=h+R:F4/q R:F4/q L5:C3=h+R:E4/q R:E4/q | L1:G3=h+R:D4/q R:D4/q L5:C3=h+R:C4/h | L5:C3=h+R:G4/q R:G4/q L2:F3=h+R:F4/q R:F4/q | L5:C3=h+R:E4/q R:E4/q L1:G3=h+R:D4/h | L5:C3=h+R:G4/q R:G4/q L2:F3=h+R:F4/q R:F4/q | L5:C3=h+R:E4/q R:E4/q L1:G3=h+R:D4/h | L5:C3=w+R:C4/q R:C4/q R:G4/q R:G4/q | L2:F3=h+R:A4/q R:A4/q L5:C3=h+R:G4/h | L2:F3=h+R:F4/q R:F4/q L5:C3=h+R:E4/q R:E4/q | L1:G3=h+R:D4/q R:D4/q L5:C3=h+R:C4/h', { bpm: 84, level: 2 }),
  S('joy', '환희의 송가', '베토벤', '도 자리 양손 16마디', 'L5:C3=w+R3:E4/q R3:E4/q R4:F4/q R5:G4/q | L1:G3=w+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/q R1:C4/q R2:D4/q R3:E4/q | L1:G3=w+R3:E4/q. R2:D4/e R2:D4/h | L5:C3=w+R3:E4/q R3:E4/q R4:F4/q R5:G4/q | L1:G3=w+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/q R1:C4/q R2:D4/q R3:E4/q | L1:G3=h+R2:D4/q. R1:C4/e L5:C3=h+R1:C4/h | L1:G3=w+R2:D4/q R2:D4/q R3:E4/q R1:C4/q | L1:G3=w+R2:D4/q R3:E4/e R4:F4/e R3:E4/q R1:C4/q | L1:G3=w+R2:D4/q R3:E4/e R4:F4/e R3:E4/q R2:D4/q | L5:C3=h+R1:C4/q R2:D4/q L1:G3=h+R5:G4/h | L5:C3=w+R3:E4/q R3:E4/q R4:F4/q R5:G4/q | L1:G3=w+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/q R1:C4/q R2:D4/q R3:E4/q | L1:G3=h+R2:D4/q. R1:C4/e L5:C3=h+R1:C4/h', { bpm: 72, level: 2 }),
  S('jingle', '징글벨 (후렴)', 'J. 피어폰트', '도 자리, 왼손 도·파·솔', 'L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R5:G4/q R1:C4/q. R2:D4/e | L5:C3=w+R3:E4/w | L2:F3=w+R4:F4/q R4:F4/q R4:F4/q. R4:F4/e | L5:C3=w+R4:F4/q R3:E4/q R3:E4/q R3:E4/e R3:E4/e | L1:G3=w+R3:E4/q R2:D4/q R2:D4/q R3:E4/q | L1:G3=w+R2:D4/h R5:G4/h | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R5:G4/q R1:C4/q. R2:D4/e | L5:C3=w+R3:E4/w | L2:F3=w+R4:F4/q R4:F4/q R4:F4/q R4:F4/q | L5:C3=w+R4:F4/q R3:E4/q R3:E4/q R3:E4/e R3:E4/e | L1:G3=w+R5:G4/q R5:G4/q R4:F4/q R2:D4/q | L5:C3=w+R1:C4/w', { bpm: 92, level: 2 }),
  S('grace', '나 같은 죄인 살리신 (Amazing Grace)', '찬송가 305장 · 미국 민요', '사장조 3/4, 못갖춘마디로 시작. 왼손은 마디 첫 박에 솔·도·레', 'r/h R:D4/q | L:G2=h.+R:G4/h R:B4/e R:G4/e | L:G2=h.+R:B4/h R:A4/q | L:C3=h.+R:G4/h R:E4/q | L:G2=h.+R:D4/h R:D4/q | L:G2=h.+R:G4/h R:B4/e R:G4/e | L:D3=h.+R:B4/h R:A4/q | L:D3=h.+R:D5/h. | L:D3=h.+R:D5/h R:B4/q | L:G2=h.+R:D5/h R:B4/e R:G4/e | L:G2=h.+R:B4/h R:A4/q | L:C3=h.+R:G4/h R:E4/q | L:G2=h.+R:D4/h R:D4/q | L:G2=h.+R:G4/h R:B4/e R:G4/e | L:D3=h.+R:B4/h R:A4/q | L:G2=h.+R:G4/h.', { beats: 3, bpm: 76, level: 3 }),
];

/** 기본 곡 코드 (마디 글) */
const CHORDS: Record<string, string> = {
  bihaenggi: 'C | C | G | C | C | C | G | C',
  nabi: 'C | G | C | C | C | G | C | C',
  twinkle: 'C | F C | F C | G C | C F | C G | C F | C G | C | F C | F C | G C',
  joy: 'C | G | C | G | C | G | C | G C | G | G | G | C G | C | G | C | G C',
  jingle: 'C | C | C | C | F | C | G | G | C | C | C | C | F | C | G | C',
  grace: '. | G | G | C | G | G | D | D | D | G | G | C | G | G | D | G',
};
for (const s of BUILTIN_SONGS) if (CHORDS[s.key]) s.chords = parseBarsText(CHORDS[s.key], s.beats).spans;

export function findBuiltin(key: string): BuiltinSong | undefined { return BUILTIN_SONGS.find((s) => s.key === key); }
