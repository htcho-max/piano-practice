import { parseSteps, type Step } from '../music/steps';
import { accompany, parseBarsText, PATTERNS, type ChordSpan, type PatternId } from '../music/chordbook';
import { SCALES, scaleSteps, arpeggioSteps, hanon1 } from '../music/scales';
import { arrangeBoth, voiceItems, type TwoLevel, type VoiceItem } from '../music/melodyvoice';
import { findBuiltin } from '../songs/builtin';
import { colorize, type ColorOpts } from '../music/chordcolor';
import { onlyHand, totalBeats } from '../music/steps';

/** free = 자유 반주 (멜로디 + 코드 악보, 아래는 마음대로 코드 음) */
export type Mode = 'wait' | 'timed' | 'free';

/** 건반 찾기 문제: accept 중 need 개를 (서로 다른 건반으로) 누르면 통과 */
export type FindQuestion = { text: string; accept: number[]; need: number; hint?: string };

export type Exercise =
  | { kind: 'find'; id: string; title: string; text: string; questions: FindQuestion[] }
  | { kind: 'read'; id: string; title: string; text: string; level: string; count: number }
  /** sheet: 악보 보고 치기 (처음부터 악보 화면 + 건반 힌트 끔) */
  | { kind: 'play'; id: string; title: string; text: string; src: string; steps: Step[]; bpm: number; beats: number; modes: Mode[]; sheet?: boolean; chords?: ChordSpan[]; pedalAt?: number[]; fifths?: number }
  /** 코드 바꾸기 연습 */
  | { kind: 'chords'; id: string; title: string; text: string; chords: string[]; rounds: number; modes: Mode[]; bpm: number }
  /** 보이싱: 코드 + 맨 위 음(멜로디) → 멜로디가 맨 위인 화음 누르기 */
  | { kind: 'voice'; id: string; title: string; text: string; items: VoiceItem[] };

export type Lesson = { id: string; n: number; title: string; goal: string; body: string[]; tips: string[]; exercises: Exercise[] };

const ALL = (pcs: number, lo = 21, hi = 108) => { const r: number[] = []; for (let m = lo; m <= hi; m++) if (m % 12 === pcs) r.push(m); return r; };
const play = (id: string, title: string, text: string, src: string, opt: { bpm?: number; beats?: number; modes?: Mode[]; sheet?: boolean } = {}): Exercise =>
  ({ kind: 'play', id, title, text, src, steps: parseSteps(src), bpm: opt.bpm ?? 72, beats: opt.beats ?? 4, modes: opt.modes ?? ['wait', 'timed'], sheet: opt.sheet });
const chords = (id: string, title: string, text: string, list: string[], o: { rounds?: number; modes?: Mode[]; bpm?: number } = {}): Exercise =>
  ({ kind: 'chords', id, title, text, chords: list, rounds: o.rounds ?? 3, modes: o.modes ?? ['wait', 'timed'], bpm: o.bpm ?? 60 });
/** 마디 코드 글 + 반주 패턴 → 연주 연습 (페달 채점 포함) */
const acc = (id: string, title: string, text: string, bars: string, pat: PatternId, o: { bpm?: number; pedal?: boolean } = {}): Exercise => {
  const beats = PATTERNS.find((x) => x.id === pat)!.beats;
  const spans = parseBarsText(bars, beats).spans;
  const r = accompany(spans, pat);
  return { kind: 'play', id, title, text, src: '', steps: r.steps, bpm: o.bpm ?? 60, beats, modes: ['wait', 'timed'], sheet: true, chords: spans, pedalAt: o.pedal ? r.pedalAt : undefined };
};
/** 음계·테크닉 연습 (이미 만든 칸으로) */
const tech = (id: string, title: string, text: string, steps: Step[], o: { bpm?: number; fifths?: number; modes?: Mode[] } = {}): Exercise =>
  ({ kind: 'play', id, title, text, src: '', steps, bpm: o.bpm ?? 66, beats: 4, modes: o.modes ?? ['wait', 'timed'], sheet: true, fifths: o.fifths });
const SC = (pc: number, minor = false) => SCALES.find((x) => x.pc === pc && x.kind === (minor ? 'minor' : 'major'))!;
/** 기본 곡 멜로디 + 코드 → 양손 반주 단계 (free = 자유 반주: 멜로디 + 코드만) */
const arranged = (id: string, title: string, text: string, songKey: string, level: TwoLevel | 'free', o: { bpm?: number; color?: ColorOpts } = {}): Exercise => {
  const s = findBuiltin(songKey)!;
  const right = onlyHand(s.steps, 'R');
  const mel = right.flatMap((st) => st.notes.map((n) => ({ beat: st.beat, len: n.len ?? st.dur, midi: n.midi })));
  const chords = o.color ? colorize(s.chords!, o.color, s.beats, s.fifths ?? 0, mel) : s.chords!;
  const steps = level === 'free' ? right : arrangeBoth(right, chords, level, s.beats, totalBeats(s.steps));
  return { kind: 'play', id, title, text, src: '', steps, bpm: o.bpm ?? s.bpm, beats: s.beats, modes: level === 'free' ? ['free'] : ['wait', 'timed'], sheet: true, chords, fifths: s.fifths, pedalAt: chords.map((c) => c.beat) };
};
const voice = (id: string, title: string, text: string, chordList: string[]): Exercise => ({ kind: 'voice', id, title, text, items: voiceItems(chordList) });
const read = (id: string, title: string, text: string, level: string, count = 20): Exercise => ({ kind: 'read', id, title, text, level, count });

/* 자주 쓰는 곡 (모두 저작권이 끝난 옛 곡) */
const BIHAENGGI_R = 'R3:E4/q R2:D4/q R1:C4/q R2:D4/q | R3:E4/q R3:E4/q R3:E4/h | R2:D4/q R2:D4/q R2:D4/h | R3:E4/q R5:G4/q R5:G4/h | R3:E4/q R2:D4/q R1:C4/q R2:D4/q | R3:E4/q R3:E4/q R3:E4/q R3:E4/q | R2:D4/q R2:D4/q R3:E4/q R2:D4/q | R1:C4/w';
const BIHAENGGI_L = 'L3:E3/q L4:D3/q L5:C3/q L4:D3/q | L3:E3/q L3:E3/q L3:E3/h | L4:D3/q L4:D3/q L4:D3/h | L3:E3/q L1:G3/q L1:G3/h | L3:E3/q L4:D3/q L5:C3/q L4:D3/q | L3:E3/q L3:E3/q L3:E3/q L3:E3/q | L4:D3/q L4:D3/q L3:E3/q L4:D3/q | L5:C3/w';
const BIHAENGGI_B = 'L5:C3=w+R3:E4/q R2:D4/q R1:C4/q R2:D4/q | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L1:G3=w+R2:D4/q R2:D4/q R2:D4/h | L5:C3=w+R3:E4/q R5:G4/q R5:G4/h | L5:C3=w+R3:E4/q R2:D4/q R1:C4/q R2:D4/q | L5:C3=w+R3:E4/q R3:E4/q R3:E4/q R3:E4/q | L1:G3=w+R2:D4/q R2:D4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/w';
const JOY_R = 'R3:E4/q R3:E4/q R4:F4/q R5:G4/q | R5:G4/q R4:F4/q R3:E4/q R2:D4/q | R1:C4/q R1:C4/q R2:D4/q R3:E4/q | R3:E4/q. R2:D4/e R2:D4/h | R3:E4/q R3:E4/q R4:F4/q R5:G4/q | R5:G4/q R4:F4/q R3:E4/q R2:D4/q | R1:C4/q R1:C4/q R2:D4/q R3:E4/q | R2:D4/q. R1:C4/e R1:C4/h';
const JINGLE_B = 'L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R5:G4/q R1:C4/q. R2:D4/e | L5:C3=w+R3:E4/w | L2:F3=w+R4:F4/q R4:F4/q R4:F4/q. R4:F4/e | L5:C3=w+R4:F4/q R3:E4/q R3:E4/q R3:E4/e R3:E4/e | L1:G3=w+R3:E4/q R2:D4/q R2:D4/q R3:E4/q | L1:G3=w+R2:D4/h R5:G4/h | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R3:E4/q R3:E4/h | L5:C3=w+R3:E4/q R5:G4/q R1:C4/q. R2:D4/e | L5:C3=w+R3:E4/w | L2:F3=w+R4:F4/q R4:F4/q R4:F4/q R4:F4/q | L5:C3=w+R4:F4/q R3:E4/q R3:E4/q R3:E4/e R3:E4/e | L1:G3=w+R5:G4/q R5:G4/q R4:F4/q R2:D4/q | L5:C3=w+R1:C4/w';
const JOY_B = 'L5:C3=w+R3:E4/q R3:E4/q R4:F4/q R5:G4/q | L1:G3=w+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/q R1:C4/q R2:D4/q R3:E4/q | L1:G3=w+R3:E4/q. R2:D4/e R2:D4/h | L5:C3=w+R3:E4/q R3:E4/q R4:F4/q R5:G4/q | L1:G3=w+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/q R1:C4/q R2:D4/q R3:E4/q | L1:G3=h+R2:D4/q. R1:C4/e L5:C3=h+R1:C4/h';

export const LESSONS: Lesson[] = [
  {
    id: 'l1', n: 1, title: '건반 지도', goal: '검은 건반 묶음으로 도·레·파를 바로 찾기',
    body: [
      '피아노 건반은 **흰 건반 7개(도레미파솔라시)**가 계속 되풀이돼요. 길을 잃지 않는 방법은 **검은 건반 묶음**을 보는 거예요.',
      '검은 건반은 **2개 묶음**과 **3개 묶음**이 번갈아 있어요. **2개 묶음 바로 왼쪽 흰 건반이 도**, 3개 묶음 바로 왼쪽이 **파**예요. 2개 묶음 가운데 흰 건반은 **레**.',
      '피아노 한가운데(보통 상표 이름 아래)에 있는 도를 **가운데 도(C4)**라고 불러요. 악보와 이 앱에서 기준이 되는 음이에요.',
    ],
    tips: ['의자는 팔꿈치가 건반 높이와 비슷하게', '건반 앞에서 가운데 도가 몸 한가운데 오도록 앉기'],
    exercises: [
      { kind: 'find', id: 'l1-find', title: '도 찾기', text: '앱이 말하는 건반을 피아노에서 눌러 보세요. 맞으면 초록색으로 바뀌어요.', questions: [
        { text: '가운데 도(C4)를 눌러 보세요', accept: [60], need: 1, hint: '피아노 가운데쯤, 검은 건반 2개 묶음 바로 왼쪽' },
        { text: '아무 도나 3개 눌러 보세요 (서로 다른 자리)', accept: ALL(0), need: 3, hint: '검은 건반 2개 묶음 바로 왼쪽' },
        { text: '파를 2개 찾아 보세요', accept: ALL(5), need: 2, hint: '검은 건반 3개 묶음 바로 왼쪽' },
        { text: '레를 2개 찾아 보세요', accept: ALL(2), need: 2, hint: '검은 건반 2개 묶음 사이' },
        { text: '솔을 2개 찾아 보세요', accept: ALL(7), need: 2, hint: '파 바로 오른쪽' },
        { text: '가운데 도보다 한 옥타브 높은 도(C5)', accept: [72], need: 1, hint: '가운데 도에서 흰 건반 7개 오른쪽' },
      ] },
      play('l1-scale', '도레미파솔', '가운데 도부터 흰 건반 다섯 개를 차례로. 손가락은 아직 신경 쓰지 않아도 돼요.', 'R:C4/q R:D4/q R:E4/q R:F4/q | R:G4/w', { modes: ['wait'] }),
    ],
  },
  {
    id: 'l2', n: 2, title: '손 모양과 손가락 번호', goal: '둥근 손으로 손가락 하나씩 또박또박',
    body: [
      '양손 모두 **엄지가 1번, 새끼가 5번**이에요. 악보나 화면 건반 위 작은 숫자가 손가락 번호예요.',
      '손은 **달걀을 살짝 쥔 듯 둥글게**, 손가락 끝(손톱 바로 아래)으로 눌러요. 손목은 건반과 같은 높이로, 어깨와 팔은 힘을 빼요.',
      '오른손을 **도 자리**에 놓아요: 엄지(1)는 가운데 도, 검지(2) 레, 중지(3) 미, 약지(4) 파, 새끼(5) 솔. 손가락이 건반 하나씩 맡는 거예요.',
      '약지(4)는 원래 혼자 움직이기 어려워요. 처음엔 느리게, 다른 손가락이 따라 눌리지 않는지 보세요.',
    ],
    tips: ['누른 손가락 말고 나머지는 건반 위에 가볍게 올려 두기', '소리는 크게보다 고르게'],
    exercises: [
      play('l2-up', '1-2-3-4-5', '오른손 도 자리. 화면의 손가락 번호대로 올라갔다 내려와요.', 'R1:C4/q R2:D4/q R3:E4/q R4:F4/q R5:G4/q R4:F4/q R3:E4/q R2:D4/q | R1:C4/w', { bpm: 60 }),
      play('l2-skip', '건너뛰기 1-3-5', '한 칸씩 건너뛰어도 손은 그대로 도 자리에 있어요.', 'R1:C4/q R3:E4/q R5:G4/q R3:E4/q | R1:C4/q R3:E4/q R5:G4/h | R5:G4/q R3:E4/q R1:C4/q R3:E4/q | R1:C4/w', { bpm: 60 }),
      play('l2-pairs', '손가락 짝 2-3, 3-4, 4-5', '이웃한 손가락끼리 번갈아. 특히 4-5는 천천히.', 'R2:D4/q R3:E4/q R2:D4/q R3:E4/q | R3:E4/q R4:F4/q R3:E4/q R4:F4/q | R4:F4/q R5:G4/q R4:F4/q R5:G4/q | R1:C4/w', { bpm: 60 }),
    ],
  },
  {
    id: 'l3', n: 3, title: '오른손으로 첫 곡', goal: '도 자리에서 손을 옮기지 않고 멜로디 치기',
    body: [
      '도 자리(도~솔)만으로도 칠 수 있는 노래가 꽤 있어요. 손을 옮기지 않으니 **건반을 보지 않고 화면만 보며** 쳐 보는 연습도 돼요.',
      '처음엔 **기다려 주기**로 음을 익히고, 틀리지 않게 되면 **박자 맞춰**로 메트로놈과 함께 쳐요.',
    ],
    tips: ['같은 음이 이어질 때(미 미 미)는 손가락을 살짝 들었다가 다시', '긴 음(2분음표)은 끝까지 누르고 있기'],
    exercises: [
      play('l3-bihaenggi', '떴다 떴다 비행기', '미레도레 미미미 — 엄지는 도, 중지는 미예요.', BIHAENGGI_R, { bpm: 80 }),
      play('l3-joy', '환희의 송가 (오른손)', '베토벤 교향곡 9번의 그 멜로디. 4번째 마디의 점4분음표는 1박 반이에요.', JOY_R, { bpm: 72 }),
    ],
  },
  {
    id: 'l4', n: 4, title: '박자 세기', goal: '음 길이를 세며 메트로놈에 맞추기',
    body: [
      '**4분음표 = 1박**, **2분음표 = 2박**, **온음표 = 4박**. 쉼표는 그만큼 쉬는 거예요. 4/4 박자는 한 마디에 4박이에요.',
      '소리 내어 **"하나 둘 셋 넷"**을 세며 치면 금방 익어요. 박자 맞춰로 시작하면 메트로놈이 한 마디(4번)를 먼저 세어 줘요.',
      '건반은 가운데 도 하나만 써요. 박에 **딱 맞으면 초록**, 빠르면 ◀ 늦으면 ▶ 표시가 나와요.',
    ],
    tips: ['긴 음은 다음 박이 올 때까지 누르고 있기', '틀려도 멈추지 말고 다음 박에 맞춰 이어 가기'],
    exercises: [
      play('l4-quarters', '4분음표와 2분음표', '한 박에 하나씩, 2분음표는 두 박.', 'R1:C4/q R1:C4/q R1:C4/q R1:C4/q | R1:C4/h R1:C4/h | R1:C4/q R1:C4/q R1:C4/h | R1:C4/w', { bpm: 70, modes: ['timed'] }),
      play('l4-rests', '쉼표 넣기', '쉼표(r)에서는 손을 떼고 쉬어요.', 'R1:C4/q r/q R1:C4/q r/q | R1:C4/h r/h | R1:C4/q R1:C4/q r/q R1:C4/q | R1:C4/w', { bpm: 70, modes: ['timed'] }),
      play('l4-mixed', '섞어서 (도·미·솔)', '박을 세면서 음도 바꿔요.', 'R1:C4/h R3:E4/h | R5:G4/q R5:G4/q R3:E4/h | R1:C4/q r/q R3:E4/q r/q | R1:C4/w', { bpm: 70, modes: ['timed'] }),
    ],
  },
  {
    id: 'l5', n: 5, title: '왼손 도 자리', goal: '왼손도 손가락 번호대로',
    body: [
      '왼손은 **새끼(5)가 낮은 도(C3)**, 엄지(1)가 솔(G3)이에요. 가운데 도에서 한 옥타브 아래 도에 새끼손가락을 놓아요.',
      '번호가 오른손과 **거꾸로** 가서 헷갈려요. 화면 건반의 초록 숫자(왼손)를 보며 천천히.',
      '왼손은 나중에 반주(코드·베이스)를 맡아요. 지금 왼손이 편해지면 찬양 반주가 훨씬 쉬워져요.',
    ],
    tips: ['왼손 새끼는 약하기 쉬워요 — 끝마디가 꺾이지 않게', '오른손은 무릎 위에 편하게'],
    exercises: [
      play('l5-down', '5-4-3-2-1', '왼손 도 자리에서 도부터 솔까지 올라갔다 내려오기.', 'L5:C3/q L4:D3/q L3:E3/q L2:F3/q L1:G3/q L2:F3/q L3:E3/q L4:D3/q | L5:C3/w', { bpm: 60 }),
      play('l5-skip', '왼손 1-3-5', '도-미-솔: 나중에 C 코드가 되는 세 음이에요.', 'L5:C3/q L3:E3/q L1:G3/q L3:E3/q | L5:C3/q L3:E3/q L1:G3/h | L1:G3/q L3:E3/q L5:C3/q L3:E3/q | L5:C3/w', { bpm: 60 }),
      play('l5-bihaenggi', '왼손 비행기', '3과에서 친 노래를 한 옥타브 아래 왼손으로.', BIHAENGGI_L, { bpm: 72 }),
    ],
  },
  {
    id: 'l6', n: 6, title: '양손 번갈아', goal: '오른손 → 왼손으로 자연스럽게 넘기기',
    body: [
      '양손을 **동시에** 치기 전에, **번갈아** 치며 두 손을 다 건반 위에 준비해 두는 연습을 해요.',
      '한 손이 칠 때 다른 손은 **자기 자리에서 기다려요**. 차례가 오면 바로 칠 수 있게.',
    ],
    tips: ['두 손 모두 도 자리: 오른손 엄지 C4, 왼손 새끼 C3', '넘어가는 곳에서 박이 늘어지지 않게'],
    exercises: [
      play('l6-relay', '주고받기', '오른손이 올라가면 왼손이 내려와요.', 'R1:C4/q R2:D4/q R3:E4/q R4:F4/q | R5:G4/w | L1:G3/q L2:F3/q L3:E3/q L4:D3/q | L5:C3/w', { bpm: 66 }),
      play('l6-echo', '메아리', '오른손이 부르면 왼손이 한 옥타브 아래에서 똑같이.', 'R3:E4/q R2:D4/q R1:C4/h | L3:E3/q L4:D3/q L5:C3/h | R3:E4/q R5:G4/q R5:G4/h | L3:E3/q L1:G3/q L1:G3/h | R2:D4/q R2:D4/q R3:E4/q R2:D4/q | L4:D3/q L4:D3/q L3:E3/q L4:D3/q | R1:C4/w | L5:C3/w', { bpm: 72 }),
    ],
  },
  {
    id: 'l7', n: 7, title: '양손 함께', goal: '두 손을 동시에 누르기',
    body: [
      '이제 두 손을 **같은 순간**에 눌러요. 처음엔 왼손이 한 음을 길게 누르고, 오른손이 그 위에서 움직이는 형태부터.',
      '기다려 주기에서는 **두 음을 다 누르고 있어야** 다음으로 넘어가요. 박자 맞춰에서는 두 손이 얼마나 어긋났는지(ms)도 알려 줘요.',
      '어려우면 곡 화면에서 **한 손씩** 먼저 연습하세요. 박자 맞춰로 한 손만 치면 다른 손은 앱이 소리를 내 줘요.',
    ],
    tips: ['한 손씩 → 양손 아주 느리게 → 템포 올리기', '왼손 긴 음은 다음 왼손 음까지 누른 채로'],
    exercises: [
      play('l7-together', '같이 누르기', '왼손 도·솔과 오른손 도·솔을 함께.', 'L5:C3+R1:C4/h L1:G3+R5:G4/h | L5:C3+R3:E4/h L1:G3+R5:G4/h | L5:C3+R1:C4/w', { bpm: 60 }),
      play('l7-hold', '왼손 받치기', '왼손 도는 한 마디 내내 누르고, 오른손이 움직여요.', 'L5:C3=w+R1:C4/q R2:D4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/q R3:E4/q R5:G4/h | L1:G3=w+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/w', { bpm: 60 }),
      play('l7-bihaenggi', '양손 비행기', '마디 첫 박에 왼손 도(또는 솔)를 함께.', BIHAENGGI_B, { bpm: 66 }),
    ],
  },
  {
    id: 'l8', n: 8, title: '첫 양손 곡', goal: '환희의 송가를 양손으로 끝까지',
    body: [
      '3과에서 오른손으로 친 환희의 송가에 **왼손 도·솔**을 더해요. 멜로디가 도·미 쪽이면 왼손 도, 레·솔 쪽이면 왼손 솔.',
      '이렇게 멜로디 아래에 맞는 음을 받치는 것이 **반주**의 시작이에요. 다음 단계(코드)에서 이 두 음이 C 코드·G 코드로 커져요.',
    ],
    tips: ['4마디·8마디 점4분음표에서 서두르지 않기', '처음엔 템포 50~60, 통과하면 조금씩 올리기'],
    exercises: [
      play('l8-joy', '환희의 송가 (양손)', '오른손 멜로디 + 마디마다 왼손 한 음.', JOY_B, { bpm: 60 }),
    ],
  },
  {
    id: 'l9', n: 9, title: '높은음자리표 읽기', goal: '오른손 음을 악보에서 바로 찾기',
    body: [
      '악보는 **줄 5개(오선)**에 음표를 그려요. 위로 갈수록 높은 음, **줄과 칸이 번갈아** 한 음씩 올라가요 (줄 → 칸 → 줄 …).',
      '**높은음자리표(𝄞)**는 둘째 줄을 감아 돌아요. 그 줄이 **솔(G4)**이에요. 오른손은 주로 이 오선을 봐요.',
      '**가운데 도(C4)**는 오선 아래 **짧은 덧줄** 위에 있어요. 거기서 레(아랫줄 밑 칸), 미(첫째 줄), 파(첫째 칸), 솔(둘째 줄).',
      '외우는 법: 줄은 아래부터 **미 솔 시 레 파**, 칸은 **파 라 도 미**. 처음엔 가운데 도에서 세어 올라가도 괜찮아요.',
    ],
    tips: ['건반 대신 악보를 보며 치기 — 건반은 곁눈으로만', '틀리면 정답 건반이 파랗게 보여요'],
    exercises: [
      read('l9-read', '음표 읽기: 도~솔', '오선의 음을 보고 그 건반을 눌러요. 20문제, 약한 음이 더 자주 나와요.', 'r1'),
      play('l9-bihaenggi', '악보 보고: 비행기', '3과에서 친 곡을 이번엔 악보만 보고. 건반 힌트는 꺼져 있어요(틀리면 보여 줘요).', BIHAENGGI_R, { bpm: 80, sheet: true }),
      read('l9-read2', '음표 읽기: 한 옥타브', '가운데 도부터 높은 도까지. 라·시·도는 손을 조금 벌려야 하는 자리예요.', 'r2'),
    ],
  },
  {
    id: 'l10', n: 10, title: '낮은음자리표 읽기', goal: '왼손 음을 악보에서 바로 찾기',
    body: [
      '**낮은음자리표(𝄢)**는 두 점 사이 넷째 줄이 **파(F3)**예요. 왼손은 주로 이 오선을 봐요.',
      '줄은 아래부터 **솔 시 레 파 라**, 칸은 **라 도 미 솔**. 높은음자리표와 한 칸씩 어긋나 있어서 처음엔 헷갈려요.',
      '왼손 도 자리의 **낮은 도(C3)**는 둘째 칸, **솔(G3)**은 맨 윗칸. **가운데 도**는 위쪽 덧줄이에요.',
    ],
    tips: ['높은음자리표 읽는 버릇으로 한 칸 틀리기 쉬워요 — 파 줄(두 점)을 기준으로', '읽기 → 손 → 소리 순서로 천천히'],
    exercises: [
      read('l10-read', '음표 읽기: 낮은 도~솔', '낮은음자리표 도 자리 다섯 음.', 'r3'),
      play('l10-five', '악보 보고: 왼손 5-4-3-2-1', '5과의 왼손 연습을 악보로.', 'L5:C3/q L4:D3/q L3:E3/q L2:F3/q | L1:G3/q L2:F3/q L3:E3/q L4:D3/q | L5:C3/q L3:E3/q L1:G3/q L3:E3/q | L5:C3/w', { bpm: 66, sheet: true }),
      play('l10-bihaenggi', '악보 보고: 왼손 비행기', '낮은음자리표로 쓴 비행기.', BIHAENGGI_L, { bpm: 72, sheet: true }),
      read('l10-read2', '음표 읽기: 낮은 도~가운데 도', '낮은음자리표 한 옥타브.', 'r4'),
    ],
  },
  {
    id: 'l11', n: 11, title: '큰보표', goal: '두 오선을 한눈에 — 양손 악보 읽기',
    body: [
      '피아노 악보는 높은음자리표와 낮은음자리표를 **묶은 큰보표**예요. 위는 오른손, 아래는 왼손.',
      '**같은 세로줄에 있는 음은 같이** 눌러요. 아래 오선에 긴 음(온음표)이 있으면 위에서 음이 바뀌는 동안 계속 누르고 있어요.',
      '가운데 도는 두 오선 **사이**에 있어서 위 오선 아래 덧줄에도, 아래 오선 위 덧줄에도 쓸 수 있어요.',
    ],
    tips: ['한 마디씩: 먼저 왼손(아래) 첫 음을 확인하고 오른손 읽기', '마디선(세로줄) 단위로 눈을 옮기기'],
    exercises: [
      read('l11-read', '음표 읽기: 큰보표', '위아래 오선을 섞어서. 어느 오선인지 먼저 보고 읽어요.', 'r5'),
      play('l11-hold', '악보 보고: 왼손 받치기', '7과의 연습을 큰보표로. 왼손 온음표는 마디 끝까지.', 'L5:C3=w+R1:C4/q R2:D4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/q R3:E4/q R5:G4/h | L1:G3=w+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3=w+R1:C4/w', { bpm: 60, sheet: true }),
      play('l11-joy', '악보 보고: 환희의 송가 (양손)', '8과의 곡을 이번엔 악보만 보며.', JOY_B, { bpm: 60, sheet: true }),
    ],
  },
  {
    id: 'l12', n: 12, title: '점음표와 3박자', goal: '점2분음표·3/4 박자 읽고 치기',
    body: [
      '음표 옆 **점은 원래 길이의 반을 더해요**. 점2분음표 = 2 + 1 = **3박**, 점4분음표 = 1 + ½ = **1박 반**.',
      '**3/4 박자**는 한 마디에 3박. "하나 둘 셋"으로 세고, 첫 박을 조금 무겁게 — 왈츠 느낌이에요. 찬양에도 3박자 곡이 많아요.',
      '쉼표도 길이가 있어요: 4분쉼표(1박, 번개 모양), 2분쉼표(2박, 셋째 줄 위 모자), 온쉼표(한 마디, 넷째 줄에 매달림).',
    ],
    tips: ['점2분음표는 세 박을 다 세고 떼기', '3박자에서 셋째 박이 짧아지지 않게'],
    exercises: [
      play('l12-rhythm', '악보 보고: 리듬 읽기', '도·미·솔로 점음표와 쉼표 읽기 (4/4).', 'R1:C4/h. R3:E4/q | R5:G4/q r/q R5:G4/h | R3:E4/q. R2:D4/e R1:C4/h | R1:C4/q r/q r/h | R3:E4/h. r/q | R1:C4/w', { bpm: 66, sheet: true, modes: ['timed'] }),
      play('l12-waltz', '악보 보고: 첫 왈츠 (3/4)', '오른손 멜로디, 왼손은 마디 첫 박에 점2분음표.', 'L5:C3=h.+R1:C4/q R3:E4/q R5:G4/q | L5:C3=h.+R5:G4/h. | L1:G3=h.+R4:F4/q R3:E4/q R2:D4/q | L5:C3=h.+R3:E4/h. | L1:G3=h.+R2:D4/q R4:F4/q R3:E4/q | L1:G3=h.+R2:D4/q R1:C4/q R2:D4/q | L5:C3=h.+R1:C4/h. | L5:C3=h.+R1:C4/h.', { bpm: 90, beats: 3, sheet: true }),
    ],
  },
  {
    id: 'l13', n: 13, title: '새 손 자리: 솔 자리', goal: '손을 옮겨 다른 다섯 음 치기',
    body: [
      '손은 도 자리에만 있지 않아요. 오른손 엄지를 **솔(G4)**에 두면 **솔 라 시 도 레**를 1~5번이 맡아요. 왼손은 새끼를 **낮은 솔(G2)**에.',
      '곡이 시작하기 전에 **첫 음과 손 자리**를 먼저 확인하는 버릇을 들이세요. 악보 첫 음의 손가락 번호가 힌트예요.',
    ],
    tips: ['자리를 옮길 때는 손 모양을 그대로 들어서 옮기기', '오른손 엄지 = 솔, 새끼 = 레'],
    exercises: [
      read('l13-read', '음표 읽기: 솔 자리', '오른손 솔~레, 왼손 낮은 솔~레.', 'r6'),
      play('l13-five', '솔 자리 1-2-3-4-5', '오른손 엄지를 솔에.', 'R1:G4/q R2:A4/q R3:B4/q R4:C5/q | R5:D5/q R4:C5/q R3:B4/q R2:A4/q | R1:G4/q R3:B4/q R5:D5/q R3:B4/q | R1:G4/w', { bpm: 66, sheet: true }),
      play('l13-nabi', '악보 보고: 나비야', '솔 자리로 옮겨 친 나비야. 엄지는 솔.', 'R5:D5/q R3:B4/q R3:B4/h | R4:C5/q R2:A4/q R2:A4/h | R1:G4/q R2:A4/q R3:B4/q R4:C5/q | R5:D5/q R5:D5/q R5:D5/h | R5:D5/q R3:B4/q R3:B4/h | R4:C5/q R2:A4/q R2:A4/h | R1:G4/q R3:B4/q R5:D5/q R5:D5/q | R1:G4/w', { bpm: 80, sheet: true }),
      play('l13-left', '왼손 솔 자리', '왼손 새끼를 낮은 솔(G2)에.', 'L5:G2/q L4:A2/q L3:B2/q L2:C3/q | L1:D3/q L2:C3/q L3:B2/q L4:A2/q | L5:G2/q L3:B2/q L1:D3/q L3:B2/q | L5:G2/w', { bpm: 66, sheet: true }),
    ],
  },
  {
    id: 'l14', n: 14, title: '샵과 플랫', goal: '검은 건반 이름 알고 악보에서 읽기',
    body: [
      '**샵(♯)**은 반음 올림 — 바로 오른쪽 건반, **플랫(♭)**은 반음 내림 — 바로 왼쪽 건반이에요. 그래서 도♯과 레♭은 **같은 검은 건반**이에요.',
      '임시표는 **그 마디 끝까지** 효력이 있어요. 마디선을 지나면 다시 원래 음. **제자리표(♮)**는 올림·내림을 취소해요.',
      '**레 자리**(레 미 파♯ 솔 라)를 쳐 봐요. 셋째 손가락이 검은 건반 파♯에 올라가요. 손을 조금 앞으로(건반 안쪽으로) 넣으면 편해요.',
    ],
    tips: ['검은 건반은 손가락 끝을 세워서', '♯이 붙은 음은 마디 안에서 계속 ♯'],
    exercises: [
      read('l14-read', '음표 읽기: 샵·플랫', '같은 건반이 두 이름(♯·♭)으로 나와요.', 'r7'),
      play('l14-dpos', '레 자리 1-2-3-4-5', '레(D4)에 엄지, 셋째 손가락은 파♯.', 'R1:D4/q R2:E4/q R3:F#4/q R4:G4/q | R5:A4/q R4:G4/q R3:F#4/q R2:E4/q | R1:D4/q R3:F#4/q R5:A4/q R3:F#4/q | R1:D4/w', { bpm: 66, sheet: true }),
      play('l14-echo', '악보 보고: 파와 파♯', '같은 마디 안 ♯과 제자리표에 주의.', 'R1:D4/q R3:F#4/q R3:F4/q R2:E4/q | R1:D4/h R5:A4/h | R4:G4/q R3:F#4/q R2:E4/q R3:F#4/q | R1:D4/w', { bpm: 60, sheet: true }),
    ],
  },
  {
    id: 'l15', n: 15, title: '건너뛰기와 첫 화음', goal: '음 사이 간격을 보고 손 모양 잡기',
    body: [
      '악보에서 **줄 → 바로 위 칸**은 이웃 건반(2도), **줄 → 다음 줄**은 하나 건너뛰기(3도), 줄 → 줄 → 줄은 다섯 번째 건반(5도)이에요.',
      '음 이름을 하나하나 읽지 않아도 **모양(간격)**만 보고 손가락을 정할 수 있어요. 빨리 읽는 사람들의 비법이에요.',
      '**도·미·솔**을 한꺼번에 누르면 **C 코드(화음)**. 악보에서는 음표 머리 세 개가 눈사람처럼 쌓여 있어요 (1·3·5번 손가락).',
    ],
    tips: ['세 음 화음은 세 손가락이 동시에 닿게', '손목을 떨어뜨리듯 무게로 누르기'],
    exercises: [
      play('l15-steps', '악보 보고: 이웃과 건너뛰기', '2도(이웃)와 3도(건너뛰기)를 섞어서.', 'R1:C4/q R2:D4/q R3:E4/q R1:C4/q | R3:E4/q R5:G4/q R3:E4/h | R2:D4/q R4:F4/q R3:E4/q R1:C4/q | R2:D4/q R5:G4/q R1:C4/h', { bpm: 72, sheet: true }),
      play('l15-chord', '악보 보고: 첫 화음', '오른손 세 음을 한꺼번에: 도·미·솔(C 화음)과 레·솔 / 레·파·솔(G 화음 느낌), 왼손은 도·솔.', 'L5:C3=h+R1:C4+R3:E4+R5:G4/h L1:G3=h+R2:D4+R5:G4/h | L5:C3=h+R1:C4+R3:E4+R5:G4/h L1:G3=h+R2:D4+R4:F4+R5:G4/h | L5:C3=w+R1:C4+R3:E4+R5:G4/w', { bpm: 60, sheet: true }),
    ],
  },
  {
    id: 'l16', n: 16, title: '악보 보고 양손 곡', goal: '처음 보는 곡을 악보로 끝까지',
    body: [
      '지금까지 배운 것을 다 써요: 큰보표, 점음표, 온음표 받치기, 손 자리. 왼손은 마디마다 한 음(도·파·솔)을 길게 눌러요.',
      '처음 보는 악보는 **① 박자표와 첫 음 손 자리 → ② 한 손씩 기다려 주기 → ③ 양손 느리게 → ④ 박자 맞춰** 순서로.',
    ],
    tips: ['8분음표 두 개(♫)는 한 박을 반씩', '왼손 파(F3)는 2번 손가락'],
    exercises: [
      play('l16-jingle', '악보 보고: 징글벨', '후렴 16마디. 왼손은 도(5)·파(2)·솔(1).', JINGLE_B, { bpm: 92, sheet: true }),
    ],
  },
  {
    id: 'l17', n: 17, title: '주요 3화음 C·F·G', goal: '코드 세 개로 반주의 뼈대 만들기',
    body: [
      '**코드(화음)**는 건반을 하나씩 건너뛴 세 음이에요. **C = 도·미·솔**, **F = 파·라·도**, **G = 솔·시·레**.',
      '다장조에서 이 셋을 **I(1도)·IV(4도)·V(5도)**라고 불러요. 찬양 대부분이 이 세 코드에 몇 개를 더한 것이라, 이것만 손에 익어도 반주를 시작할 수 있어요.',
      '오른손은 세 음을 **1·3·5번** 손가락으로 함께, 왼손은 코드 이름의 음(근음) 하나를 낮게 눌러요. 화면 아래 "코드" 탭의 코드 사전에서 모든 코드를 찾아볼 수 있어요.',
    ],
    tips: ['세 손가락이 동시에 닿게 — 손목을 살짝 떨어뜨리듯', '코드를 바꿀 때 손 모양은 그대로 들어 옮기기'],
    exercises: [
      chords('l17-drill', '코드 누르기: C F G', '화면의 코드를 누르면 다음으로 넘어가요. 자리는 아무 자리나 괜찮아요(아래 추천 자리 참고).', ['C', 'F', 'G', 'C'], { rounds: 3 }),
      play('l17-block', '기본 자리로 C – F – G – C', '오른손 기본 자리(1-3-5), 왼손 근음. 손이 크게 움직여요.', 'L5:C3+R1:C4+R3:E4+R5:G4/w | L5:F2+R1:F4+R3:A4+R5:C5/w | L5:G2+R1:G4+R3:B4+R5:D5/w | L5:C3+R1:C4+R3:E4+R5:G4/w', { bpm: 60, sheet: true }),
    ],
  },
  {
    id: 'l18', n: 18, title: '자리바꿈', goal: '손을 덜 움직이고 코드 바꾸기',
    body: [
      '코드 음의 **순서를 바꿔 쌓는 것**을 자리바꿈(전위)이라고 해요. 도·미·솔을 미·솔·도나 솔·도·미로 눌러도 여전히 C 코드예요.',
      '자리바꿈을 쓰면 **가까운 음끼리 이어져서** 손이 거의 안 움직여요: C(도미솔) → F(도파라) → G(시레솔) → C. 같은 음(도)은 그대로 두고 나머지만 옮기는 게 요령.',
      '손가락: 위쪽 간격이 넓으면(4도) **1·2·5번**, 아래쪽이 넓으면 **1·3·5번**. 화면이 추천해 줘요.',
    ],
    tips: ['같은 음은 손가락을 떼지 말고 그대로', '눈은 다음 코드 이름에, 손은 가까운 자리로'],
    exercises: [
      acc('l18-close', '가까운 자리 C – F – G – C', '왼손 근음 + 오른손 가까운 자리. 기본 자리보다 훨씬 편할 거예요.', 'C | F | G | C | C | F | G | C', 'block', { bpm: 60 }),
      chords('l18-drill', '코드 바꾸기: C G Am F', '가장 흔한 진행 I–V–vi–IV. Am = 라·도·미.', ['C', 'G', 'Am', 'F'], { rounds: 3 }),
    ],
  },
  {
    id: 'l19', n: 19, title: '반주 패턴', goal: '같은 코드를 리듬으로 채우기',
    body: [
      '코드를 길게 누르기만 하면 심심해요. 같은 코드를 **2박마다, 박마다** 다시 누르거나, 왼손을 **근음-5음-옥타브-5음**으로 펼치면 반주가 살아나요.',
      '처음엔 느리게 기다려 주기로 손 순서를 익히고, 박자 맞춰로 템포를 올려요. "코드" 탭의 반주 패턴에서 다른 진행·조로도 연습할 수 있어요.',
    ],
    tips: ['오른손 코드는 가볍게, 왼손 근음은 조금 더 깊게', '펼친화음은 손목을 부드럽게 굴리듯'],
    exercises: [
      acc('l19-half', '두 박마다: C G Am F', '왼손은 마디 내내, 오른손 코드는 2박마다.', 'C | G | Am | F | C | G | Am | F', 'half', { bpm: 66 }),
      acc('l19-arp', '왼손 펼친화음: C G Am F', '왼손 5-2-1-2 번 손가락으로 근음-5음-옥타브-5음.', 'C | G | Am | F | C | G | Am | F', 'arp', { bpm: 60 }),
    ],
  },
  {
    id: 'l20', n: 20, title: '페달', goal: '코드가 끊기지 않게 이어 주기',
    body: [
      '오른발 **댐퍼 페달**을 밟으면 손을 떼도 소리가 남아요. 그런데 계속 밟고 있으면 코드끼리 섞여 탁해져요.',
      '**레가토 페달**: 새 코드를 **누른 바로 다음에** 페달을 뗐다가 곧바로 다시 밟아요. "누르고 → 떼고·밟고". 페달이 손보다 반 박쯤 늦게 따라간다고 생각하세요.',
      '롤랜드 F107 은 페달을 얼마나 밟았는지까지 앱에 알려 줘요. 박자 맞춰로 치면 코드마다 페달을 제때 바꿨는지 채점해요.',
    ],
    tips: ['발뒤꿈치는 바닥에 붙이고 발 앞쪽으로만', '처음엔 손 없이 메트로놈에 맞춰 페달만 연습'],
    exercises: [
      acc('l20-block', '페달 바꾸기: C F G C', '코드는 길게, 바뀔 때마다 페달을 뗐다 다시 밟기.', 'C | F | G | C | C | F | G | C', 'block', { bpm: 56, pedal: true }),
      acc('l20-quarter', '페달 + 4비트: C Am F G', '오른손은 박마다, 페달은 코드가 바뀔 때만.', 'C | Am | F | G | C | Am | F | G', 'quarter', { bpm: 66, pedal: true }),
    ],
  },
  {
    id: 'l21', n: 21, title: '찬양 반주 시작', goal: '찬양에 많은 조·진행으로 반주하기',
    body: [
      '찬양은 **G·D·A·E 장조**가 많아요. 같은 I–V–vi–IV 도 G 장조에서는 **G – D – Em – C**.',
      '베이스가 한 음씩 내려가는 **C – G/B – Am – C/G – F – C/E – Dm – G** 같은 진행도 단골이에요. **G/B** 는 "G 코드인데 왼손은 시(B)"라는 뜻이에요.',
      '곡 탭에서 찬양 악보(MusicXML)를 불러오고 **"코드 붙여 왼손 반주 만들기"**에 악보의 코드를 적으면, 오른손 멜로디 + 왼손 반주 악보가 만들어져요.',
    ],
    tips: ['코드 이름 뒤 /음 은 왼손 베이스', '8비트는 오른손을 가볍게, 1·3박 왼손에 무게'],
    exercises: [
      chords('l21-drill', '코드 바꾸기: G D Em C', 'G 장조의 I–V–vi–IV. Em = 미·솔·시, D = 레·파♯·라.', ['G', 'D', 'Em', 'C'], { rounds: 3 }),
      chords('l21-down', '내려가는 베이스', '왼손이 도-시-라-솔-파-미-레-솔로 내려가요.', ['C', 'G/B', 'Am', 'C/G', 'F', 'C/E', 'Dm', 'G'], { rounds: 2 }),
      acc('l21-eight', '8비트: G D Em C', '오른손 코드를 8분음표로, 왼손 근음은 1·3박.', 'G | D | Em | C | G | D | Em | C', 'eight', { bpm: 72 }),
    ],
  },
  {
    id: 'l22', n: 22, title: '엄지 밑으로 넘기기', goal: '다섯 손가락 밖으로 — 음계의 시작',
    body: [
      '손가락은 다섯 개인데 음계는 여덟 음이에요. 그래서 **엄지가 손바닥 밑으로 지나가** 다음 자리로 옮겨요 (오른손 올라갈 때: 1-2-3 → 엄지가 3번 밑으로 → 1-2-3-4-5).',
      '내려올 때는 반대로 **3번이 엄지 위로 건너가요**. 왼손은 거울처럼: 올라갈 때 3번이 엄지 위로, 내려올 때 엄지가 밑으로.',
      '요령: 엄지는 미리 손바닥 밑으로 **준비**해 두고, 넘어갈 때 **손목이 들리거나 팔꿈치가 튀지 않게**. 소리가 고르게 나는지 귀로 들어요.',
    ],
    tips: ['처음엔 아주 느리게 — 넘어가는 곳에서 멈칫하지 않는 것이 목표', '손목은 수평으로 미끄러지듯'],
    exercises: [
      play('l22-thumb', '엄지 넘기기 준비', '도레미 다음 엄지가 밑으로 가서 파. 다시 3번이 엄지 위로 건너 미.', 'R1:C4/q R2:D4/q R3:E4/q R1:F4/q | R3:E4/q R2:D4/q R1:C4/h | R1:C4/q R2:D4/q R3:E4/q R1:F4/q | R2:G4/q R1:F4/q R3:E4/h | R2:D4/q R3:E4/q R1:F4/q R3:E4/q | R2:D4/q R3:E4/q R2:D4/q R1:C4/q | R1:C4/w', { bpm: 66, sheet: true }),
      tech('l22-crh', '다장조 음계 (오른손)', '1-2-3, 엄지 넘겨 1-2-3-4-5. 내려올 때 3번이 건너감.', scaleSteps(SC(0), { hands: 'R', octaves: 1, rhythm: 'q' }), { bpm: 66 }),
      tech('l22-clh', '다장조 음계 (왼손)', '5-4-3-2-1, 3번이 엄지 위로 건너 3-2-1.', scaleSteps(SC(0), { hands: 'L', octaves: 1, rhythm: 'q' }), { bpm: 66 }),
    ],
  },
  {
    id: 'l23', n: 23, title: '양손 음계', goal: '두 손이 다른 곳에서 넘어가는 것 맞추기',
    body: [
      '양손으로 음계를 치면 **엄지가 넘어가는 곳이 서로 달라요** (다장조: 오른손은 파, 왼손은 솔·라). 그래서 처음엔 꽤 헷갈려요.',
      '방법: 한 손씩 완전히 익힌 뒤 → 양손 **기다려 주기** → 박자 맞춰 느리게. 넘어가는 곳에서 두 손이 어긋나면 양손 ms 로 알려 줘요.',
      '**사장조**는 파♯ 하나 (조표 ♯ 하나). 손가락은 다장조와 똑같고, 파♯은 4번(오른손)·2번(왼손)이에요.',
    ],
    tips: ['도·파(오른손 엄지), 솔(왼손 엄지) — 엄지가 언제 오는지 소리 내어 세어 보기', '조표를 보고 파는 늘 파♯'],
    exercises: [
      tech('l23-c', '다장조 양손', '한 옥타브, 두 손이 한 옥타브 떨어져서 나란히.', scaleSteps(SC(0), { hands: 'B', octaves: 1, rhythm: 'q' }), { bpm: 60 }),
      tech('l23-g', '사장조 양손', '조표 ♯ 하나 (파♯).', scaleSteps(SC(7), { hands: 'B', octaves: 1, rhythm: 'q' }), { bpm: 60, fifths: 1 }),
    ],
  },
  {
    id: 'l24', n: 24, title: '단음계와 아르페지오', goal: '단조 소리와 화음을 펼쳐 넓게 치기',
    body: [
      '**가단조(Am)**는 조표가 없는 단조예요. 이 앱은 7음을 올린 **화성단음계**를 써요: 라 시 도 레 미 파 **솔♯** 라 — 끝에서 독특한 소리가 나요.',
      '**아르페지오**는 코드 음을 하나씩 펼쳐 여러 옥타브를 오르내리는 것. 반주에서 왼손 펼친화음, 찬양 간주·엔딩에 자주 써요. 오른손 1-2-3 다음 엄지가 넘어가 1-2-3-5.',
    ],
    tips: ['아르페지오는 간격이 넓어서 엄지 넘기기를 더 일찍 준비', '팔을 옆으로 부드럽게 옮기며 손목은 수평'],
    exercises: [
      tech('l24-am', '가단조 화성단음계 (오른손)', '솔♯ 에 주의. 손가락은 다장조와 같아요.', scaleSteps(SC(9, true), { hands: 'R', octaves: 1, rhythm: 'q' }), { bpm: 66 }),
      tech('l24-arp', 'C 아르페지오 (오른손)', '도-미-솔-도-미-솔-도, 2옥타브 오르내림.', arpeggioSteps('C', 'R', 'q'), { bpm: 66 }),
      tech('l24-arp2', 'Am 아르페지오 (양손)', '왼손은 5-4-2-1, 4-2-1.', arpeggioSteps('Am', 'B', 'q'), { bpm: 56 }),
    ],
  },
  {
    id: 'l25', n: 25, title: '하농과 여러 조', goal: '매일 손가락 운동 + 찬양에 많은 조 익히기',
    body: [
      '**하농 1번**은 150년 넘게 쓰인 손가락 운동이에요. 도-미-파-솔-라-솔-파-미 무늬를 한 칸씩 올라갔다 내려와요. 다섯 손가락 모두 **고르고 독립적으로** 움직이게 해 줘요.',
      '찬양에 많은 **바장조(F, ♭ 하나)**와 **라장조(D, ♯ 둘)**도 쳐 봐요. 바장조 오른손은 1-2-3-4, 1-2-3-4 (시♭ 에 4번).',
      '이제 "코드·음계" 탭의 **음계 24조**에서 모든 조를 연습할 수 있어요. 박자 맞춰 80점을 넘은 조는 초록으로 표시돼요.',
    ],
    tips: ['하농은 매일 2~3분, 처음 ♩60 → 조금씩', '조표를 먼저 보고 어느 검은 건반을 쓰는지 확인'],
    exercises: [
      tech('l25-hanon', '하농 1번 (양손)', '8분음표로 고르게. 처음엔 기다려 주기로 무늬를 익혀요.', hanon1('B'), { bpm: 56 }),
      tech('l25-f', '바장조 양손', '오른손 1234 1234, 왼손 54321 321.', scaleSteps(SC(5), { hands: 'B', octaves: 1, rhythm: 'q' }), { bpm: 60, fifths: -1 }),
      tech('l25-d', '라장조 양손', '파♯·도♯. 손가락은 다장조와 같아요.', scaleSteps(SC(2), { hands: 'B', octaves: 1, rhythm: 'q' }), { bpm: 60, fifths: 2 }),
    ],
  },
  {
    id: 'l26', n: 26, title: '멜로디 위에 화음 쌓기', goal: '멜로디를 맨 위에 두고 그 아래를 코드 음으로',
    body: [
      '지금까지는 오른손이 코드, 왼손이 베이스였어요. 찬양 반주자는 보통 **오른손 맨 위(5번 손가락)로 멜로디**를 치고, 그 아래를 코드 음으로 채워요. 반주만 들어도 노래가 들리고, 소리도 훨씬 풍성해져요.',
      '방법: ① 지금 멜로디 음이 **그 코드의 음**인지 봐요 (C 코드면 도·미·솔). ② 맞으면 멜로디에서 **아래로 내려가며 코드 음 둘**을 골라요. 멜로디가 미면 솔-도-**미**, 솔이면 도-미-**솔**, 도면 미-솔-**도**. 멜로디가 자리바꿈을 정해 주는 거예요.',
      '멜로디가 코드 음이 아니면(지나가는 음) **멜로디만** 쳐요. 그리고 모든 음에 화음을 넣지 않아요 — **코드가 바뀌는 곳, 마디 첫 박, 긴 음**에만. 빠른 음까지 다 넣으면 무겁고 손도 바빠져요.',
      '처음엔 멜로디 아래 **한 음(3도·6도)**만 넣어도 충분해요. 두 음이 다 되면 3음 화음.',
    ],
    tips: ['멜로디(5번)는 조금 세게, 아래 음은 가볍게 — 노래가 위에서 들리게', '아래 음은 멜로디에서 한 옥타브 안에서'],
    exercises: [
      voice('l26-v1', '멜로디가 맨 위인 C·F·G', '코드와 맨 위 음이 나오면 그 아래 코드 음 둘을 같이. 맨 위 음이 바뀌면 자리도 바뀌어요.', ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C']),
      arranged('l26-bi2', '비행기: 멜로디 + 한 음', '코드가 바뀌는 곳과 마디 첫 박에만 멜로디 아래 한 음. 왼손은 베이스 한 음.', 'bihaenggi', 2, { bpm: 72 }),
      arranged('l26-gr3', '나 같은 죄인: 멜로디 맨 위 화음', '오른손 3음 화음(멜로디가 맨 위) + 왼손 근음·5음. 소리를 잇는 건 손이 아니라 페달 — 코드가 바뀔 때 뗐다 밟기.', 'grace', 3, { bpm: 60 }),
    ],
  },
  {
    id: 'l27', n: 27, title: '찬양 양손 반주', goal: '왼손 베이스 + 오른손 멜로디 화음, 그리고 내 마음대로',
    body: [
      '왼손은 **근음**(슬래시 코드는 **/ 뒤 음**: D/F# 이면 파♯). 익숙해지면 **근음+5음**, 그다음 **근음-5음-옥타브 펼침**으로 넓혀요.',
      '곡 탭에서 찬양 악보(글 악보·MusicXML)를 불러와 **"코드로 반주 만들기" → 양손 ①~④**를 고르면 그 곡의 단계별 반주 악보가 만들어져요. ①부터 차례로.',
      '마지막은 **자유 반주**: 악보에는 멜로디와 코드만 있어요. 멜로디를 맨 위로 치면서 아래를 **내 마음대로** 채우면, 앱이 코드 밖 음·멜로디가 맨 위인지·코드가 바뀌는 곳에 화음을 넣었는지 채점해요. 정답이 하나가 아니라 원리로 치는 연습이에요.',
      '기다리며 익숙해지면 자유 반주의 **박자 맞춰**로: 메트로놈에 맞춰 멜로디 박자와 화음, 코드가 바뀔 때 페달까지 채점해요. 실제 예배 반주와 가장 가까운 연습이에요.',
    ],
    tips: ['자유 반주에서 보라 건반 = 지금 쓸 수 있는 코드 음', '막히면 ① 멜로디 + 베이스로 돌아가도 괜찮아요'],
    exercises: [
      voice('l27-v', '사장조 보이싱: G D Em C', '찬양에 많은 G 장조. D/F# 처럼 슬래시 코드는 왼손으로 / 뒤 음을 쳐도 돼요.', ['G', 'D', 'Em', 'C', 'G', 'D/F#', 'Em', 'C']),
      arranged('l27-gr4', '나 같은 죄인: 왼손 펼침 + 화음', '③의 오른손에 왼손 근음-5음-옥타브 펼친화음.', 'grace', 4, { bpm: 60 }),
      arranged('l27-free', '나 같은 죄인: 자유 반주', '멜로디와 코드만 보고 내 화음으로. 코드가 바뀌는 음마다 멜로디 아래 두 음 이상이면 ●.', 'grace', 'free', { bpm: 60 }),
    ],
  },
  {
    id: 'l28', n: 28, title: '리듬 반주와 찬양 색채', goal: '긴 음을 리듬으로 채우고, 코드에 찬양다운 색 더하기',
    body: [
      '멜로디가 길게 끌리거나 쉬는 곳에서 반주가 멈추면 노래가 비어 들려요. **⑤ 리듬 반주**는 그런 박마다 오른손 화음을 다시 쳐요 (멜로디 음도 맨 위에서 같이). 왼손은 박자에 따라 리듬: **4/4 는 8비트** (근음 ♩. → 5음 ♪ → 옥타브 𝅗𝅥), **3/4 는 왈츠** (왼손 첫 박, 오른손 둘·셋째 박), **6/8 은 점4분 둘** (오른손 8분 "쿵-짝-짝").',
      '**sus4 → 3**: 끝맺기 전 V 코드(G 장조면 D)를 Dsus4(레·솔·라)로 걸었다가 D(레·파♯·라)로 풀어요. 4음이 3음으로 반음 내려가며 "아멘" 같은 해결감이 나요.',
      '**add2**: I·IV 같은 장3화음에 2음을 더하면(G2 = 솔·라·시·레) 찬양 반주 특유의 열린 소리가 나요. 2음과 3음이 붙어도 괜찮은 코드예요.',
      '**지나가는 베이스**: 베이스가 3도 떨어진 코드 사이(C → Am)에 한 음을 끼워 C → C/B → Am 처럼 계단으로 내려가요. 마지막 박에 왼손만 바꾸면 돼요.',
      '곡 탭 "코드로 반주 만들기"의 **찬양 색 더하기 → 코드에 입히기**로 내 곡 코드에 이 색들을 입힐 수 있어요. 입힌 코드는 글로 보이니 마음에 안 드는 곳은 고쳐 쓰세요.',
    ],
    tips: ['리듬 반주는 오른손 화음을 가볍게, 멜로디(5번)만 조금 더 세게', 'sus4 → 3 은 4번 손가락이 3번으로 반음 내려오는 느낌'],
    exercises: [
      voice('l28-v', 'sus4 와 add2 보이싱 (사장조)', '2음·sus4 가 섞인 진행. Dsus4 → D 에서 솔이 파♯으로 내려오는 걸 들어 봐요.', ['G2', 'Dsus4', 'D', 'Em7', 'C2', 'Dsus4', 'D', 'G2']),
      arranged('l28-gr5', '나 같은 죄인: 왈츠 리듬 + 색채', '왼손 첫 박, 오른손 둘·셋째 박 화음. sus4 → 3·지나가는 베이스를 입혔어요.', 'grace', 5, { bpm: 60, color: { sus: true, add2: true, walk: true } }),
      arranged('l28-joy5', '환희의 송가: 8비트', '왼손 근음 ♩. → 5음 ♪ → 옥타브 𝅗𝅥. 멜로디가 긴 곳은 오른손 화음으로 채워요.', 'joy', 5, { bpm: 72, color: { sus: true, add2: false, walk: true } }),
    ],
  },
];

export function findLesson(id: string): Lesson | undefined { return LESSONS.find((l) => l.id === id); }
export function findExercise(id: string): { lesson: Lesson; ex: Exercise } | undefined {
  for (const lesson of LESSONS) { const ex = lesson.exercises.find((e) => e.id === id); if (ex) return { lesson, ex }; }
  return undefined;
}
