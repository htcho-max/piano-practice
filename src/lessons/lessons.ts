import { parseSteps, type Step } from '../music/steps';

export type Mode = 'wait' | 'timed';

/** 건반 찾기 문제: accept 중 need 개를 (서로 다른 건반으로) 누르면 통과 */
export type FindQuestion = { text: string; accept: number[]; need: number; hint?: string };

export type Exercise =
  | { kind: 'find'; id: string; title: string; text: string; questions: FindQuestion[] }
  | { kind: 'play'; id: string; title: string; text: string; src: string; steps: Step[]; bpm: number; beats: number; modes: Mode[] };

export type Lesson = { id: string; n: number; title: string; goal: string; body: string[]; tips: string[]; exercises: Exercise[] };

const ALL = (pcs: number, lo = 21, hi = 108) => { const r: number[] = []; for (let m = lo; m <= hi; m++) if (m % 12 === pcs) r.push(m); return r; };
const play = (id: string, title: string, text: string, src: string, opt: { bpm?: number; beats?: number; modes?: Mode[] } = {}): Exercise =>
  ({ kind: 'play', id, title, text, src, steps: parseSteps(src), bpm: opt.bpm ?? 72, beats: opt.beats ?? 4, modes: opt.modes ?? ['wait', 'timed'] });

/* 자주 쓰는 곡 (모두 저작권이 끝난 옛 곡) */
const BIHAENGGI_R = 'R3:E4/q R2:D4/q R1:C4/q R2:D4/q | R3:E4/q R3:E4/q R3:E4/h | R2:D4/q R2:D4/q R2:D4/h | R3:E4/q R5:G4/q R5:G4/h | R3:E4/q R2:D4/q R1:C4/q R2:D4/q | R3:E4/q R3:E4/q R3:E4/q R3:E4/q | R2:D4/q R2:D4/q R3:E4/q R2:D4/q | R1:C4/w';
const BIHAENGGI_L = 'L3:E3/q L4:D3/q L5:C3/q L4:D3/q | L3:E3/q L3:E3/q L3:E3/h | L4:D3/q L4:D3/q L4:D3/h | L3:E3/q L1:G3/q L1:G3/h | L3:E3/q L4:D3/q L5:C3/q L4:D3/q | L3:E3/q L3:E3/q L3:E3/q L3:E3/q | L4:D3/q L4:D3/q L3:E3/q L4:D3/q | L5:C3/w';
const BIHAENGGI_B = 'L5:C3+R3:E4/q R2:D4/q R1:C4/q R2:D4/q | L5:C3+R3:E4/q R3:E4/q R3:E4/h | L1:G3+R2:D4/q R2:D4/q R2:D4/h | L5:C3+R3:E4/q R5:G4/q R5:G4/h | L5:C3+R3:E4/q R2:D4/q R1:C4/q R2:D4/q | L5:C3+R3:E4/q R3:E4/q R3:E4/q R3:E4/q | L1:G3+R2:D4/q R2:D4/q R3:E4/q R2:D4/q | L5:C3+R1:C4/w';
const JOY_R = 'R3:E4/q R3:E4/q R4:F4/q R5:G4/q | R5:G4/q R4:F4/q R3:E4/q R2:D4/q | R1:C4/q R1:C4/q R2:D4/q R3:E4/q | R3:E4/q. R2:D4/e R2:D4/h | R3:E4/q R3:E4/q R4:F4/q R5:G4/q | R5:G4/q R4:F4/q R3:E4/q R2:D4/q | R1:C4/q R1:C4/q R2:D4/q R3:E4/q | R2:D4/q. R1:C4/e R1:C4/h';
const JOY_B = 'L5:C3+R3:E4/q R3:E4/q R4:F4/q R5:G4/q | L1:G3+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3+R1:C4/q R1:C4/q R2:D4/q R3:E4/q | L1:G3+R3:E4/q. R2:D4/e R2:D4/h | L5:C3+R3:E4/q R3:E4/q R4:F4/q R5:G4/q | L1:G3+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3+R1:C4/q R1:C4/q R2:D4/q R3:E4/q | L1:G3+R2:D4/q. R1:C4/e L5:C3+R1:C4/h';

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
      play('l7-hold', '왼손 받치기', '왼손 도는 한 마디 내내 누르고, 오른손이 움직여요.', 'L5:C3+R1:C4/q R2:D4/q R3:E4/q R2:D4/q | L5:C3+R1:C4/q R3:E4/q R5:G4/h | L1:G3+R5:G4/q R4:F4/q R3:E4/q R2:D4/q | L5:C3+R1:C4/w', { bpm: 60 }),
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
];

export function findLesson(id: string): Lesson | undefined { return LESSONS.find((l) => l.id === id); }
export function findExercise(id: string): { lesson: Lesson; ex: Exercise } | undefined {
  for (const lesson of LESSONS) { const ex = lesson.exercises.find((e) => e.id === id); if (ex) return { lesson, ex }; }
  return undefined;
}
