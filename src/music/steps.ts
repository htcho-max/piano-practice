import { parseNote } from './notes';

export type Hand = 'R' | 'L';
/** spell: 검은 건반을 ♯/♭ 중 무엇으로 적을지, len: 칸 길이와 다른 음 길이(왼손이 길게 누를 때 등) */
export type PNote = { midi: number; hand: Hand; finger?: number; spell?: 'sharp' | 'flat'; len?: number };
/** 한 번에 누르는 음들 (빈 notes = 쉼표). beat = 시작 박(0부터), dur = 박 수 */
export type Step = { beat: number; dur: number; notes: PNote[] };

const DUR: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

/**
 * 짧은 글 → 음 목록.
 *   "R1:C4/q R2:D4/q L5:C3+R3:E4/h r/q"
 *   손(R/L) + 손가락(1~5, 생략 가능) + ':' + 음, 동시에 누르는 음은 '+', '/' 뒤는 길이 (w h q e s, 점은 '.')
 *   'r/q' = 쉼표, '|' 는 마디 구분(읽기 쉽게, 무시)
 *   음 뒤 '=길이' 는 그 음만 따로 길게: 'L5:C3=w+R3:E4/q' (왼손 온음표, 다음 칸은 4분 뒤)
 */
export function parseSteps(src: string): Step[] {
  const steps: Step[] = [];
  let beat = 0;
  for (const tok of src.split(/\s+/).filter(Boolean)) {
    if (tok === '|') continue;
    const slash = tok.lastIndexOf('/');
    if (slash < 0) throw new Error(`길이가 없어요: ${tok}`);
    const body = tok.slice(0, slash);
    const d = tok.slice(slash + 1);
    const base = DUR[d[0]];
    if (base === undefined) throw new Error(`길이를 읽을 수 없어요: ${tok}`);
    const dur = d.endsWith('.') ? base * 1.5 : base;
    const notes: PNote[] = [];
    if (body !== 'r') {
      for (const part of body.split('+')) {
        const m = /^([RL])([1-5]?):([^=]+)(?:=([whqes]\.?))?$/.exec(part);
        if (!m) throw new Error(`음을 읽을 수 없어요: ${part}`);
        const n: PNote = { hand: m[1] as Hand, finger: m[2] ? Number(m[2]) : undefined, midi: parseNote(m[3]) };
        if (/[#♯]/.test(m[3])) n.spell = 'sharp';
        else if (/[b♭]\d/.test(m[3])) n.spell = 'flat';
        if (m[4]) n.len = DUR[m[4][0]] * (m[4].endsWith('.') ? 1.5 : 1);
        notes.push(n);
      }
    }
    steps.push({ beat, dur, notes });
    beat += dur;
  }
  return steps;
}

export function totalBeats(steps: Step[]): number {
  const last = steps[steps.length - 1];
  return last ? last.beat + last.dur : 0;
}

export function allMidis(steps: Step[]): number[] {
  return steps.flatMap((s) => s.notes.map((n) => n.midi));
}

/** 한 손만 남기기 (다른 손 음은 빼고, 비면 쉼표) */
export function onlyHand(steps: Step[], hand: Hand): Step[] {
  return steps.map((s) => ({ ...s, notes: s.notes.filter((n) => n.hand === hand) }));
}

export function handsUsed(steps: Step[]): Hand[] {
  const set = new Set(steps.flatMap((s) => s.notes.map((n) => n.hand)));
  return (['R', 'L'] as Hand[]).filter((h) => set.has(h));
}

export function barCount(steps: Step[], beats: number): number {
  return Math.max(1, Math.ceil(totalBeats(steps) / beats - 1e-6));
}

/**
 * from~to 마디(1부터, 둘 다 포함)만 잘라 0박부터 시작하게.
 * 앞 마디에서 이어 누르는 음은 빼고, 구간 끝을 넘는 길이는 자름.
 */
export function sliceBars(steps: Step[], beats: number, from: number, to: number): Step[] {
  const s = (from - 1) * beats, e = to * beats;
  const out: Step[] = [];
  for (const st of steps) {
    if (st.beat < s - 1e-6 || st.beat >= e - 1e-6) continue;
    const beat = st.beat - s;
    const dur = Math.min(st.dur, e - st.beat);
    out.push({ beat, dur, notes: st.notes.map((n) => (n.len !== undefined ? { ...n, len: Math.min(n.len, e - st.beat) } : n)) });
  }
  if (!out.length || out[0].beat > 1e-6) out.unshift({ beat: 0, dur: out.length ? out[0].beat : e - s, notes: [] });
  return out;
}

/** 칸 번호 → 마디 번호(1부터) */
export function barOf(step: Step, beats: number): number { return Math.floor(step.beat / beats + 1e-6) + 1; }
