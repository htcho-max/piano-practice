import { parseSteps, type Step } from '../music/steps';

export type Mode = 'wait' | 'timed';

/** 건반 찾기 문제: accept 중 need 개를 (서로 다른 건반으로) 누르면 통과 */
export type FindQuestion = { text: string; accept: number[]; need: number; hint?: string };

export type Exercise =
  | { kind: 'find'; id: string; title: string; text: string; questions: FindQuestion[] }
  | { kind: 'read'; id: string; title: string; text: string; level: string; count: number }
  /** sheet: 악보 보고 치기 (처음부터 악보 화면 + 건반 힌트 끔) */
  | { kind: 'play'; id: string; title: string; text: string; src: string; steps: Step[]; bpm: number; beats: number; modes: Mode[]; sheet?: boolean };

export type Lesson = { id: string; n: number; title: string; goal: string; body: string[]; tips: string[]; exercises: Exercise[] };

const ALL = (pcs: number, lo = 21, hi = 108) => { const r: number[] = []; for (let m = lo; m <= hi; m++) if (m % 12 === pcs) r.push(m); return r; };
const play = (id: string, title: string, text: string, src: string, opt: { bpm?: number; beats?: number; modes?: Mode[]; sheet?: boolean } = {}): Exercise =>
  ({ kind: 'play', id, title, text, src, steps: parseSteps(src), bpm: opt.bpm ?? 72, beats: opt.beats ?? 4, modes: opt.modes ?? ['wait', 'timed'], sheet: opt.sheet });
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
];

export function findLesson(id: string): Lesson | undefined { return LESSONS.find((l) => l.id === id); }
export function findExercise(id: string): { lesson: Lesson; ex: Exercise } | undefined {
  for (const lesson of LESSONS) { const ex = lesson.exercises.find((e) => e.id === id); if (ex) return { lesson, ex }; }
  return undefined;
}
