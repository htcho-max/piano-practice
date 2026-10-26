/**
 * 멜로디 보이싱 반주: 멜로디를 오른손 맨 위에 두고, 그 아래에 코드 음을 채워 양손으로 반주.
 * (찬양 반주자가 흔히 치는 방식 — 왼손 베이스 + 오른손 "멜로디가 맨 위인 화음")
 *
 * 단계
 *  1. 멜로디 + 베이스      : 오른손 멜로디만, 왼손 근음(슬래시 코드는 그 베이스) 길게
 *  2. 멜로디 + 한 음       : 중요한 멜로디 음 아래 3도·6도 하나
 *  3. 멜로디가 맨 위 화음  : 중요한 멜로디 음 아래 코드 음 둘 (3음 화음), 왼손 근음+5음
 *  4. 화음 + 왼손 펼침     : 3단계 오른손 + 왼손 근음-5음-옥타브 펼친화음
 *
 * "중요한 음" = 코드가 바뀌는 첫 음, 마디 첫 박·가운데 박, 한 박 이상 긴 음 — 그 음이 코드 음일 때만.
 * 경과음(코드 밖 음)은 멜로디만 치고, 아래 음은 그 멜로디 음 길이만큼 (이어지는 소리는 페달로).
 */
import { parseChord, bassNote, type Chord, type ChordSpan } from './chordbook';
import type { PNote, Step } from './steps';

export type TwoLevel = 1 | 2 | 3 | 4;
export const TWO_LEVELS: { id: TwoLevel; title: string; note: string }[] = [
  { id: 1, title: '① 멜로디 + 베이스', note: '오른손은 멜로디만, 왼손은 코드의 베이스 한 음. 양손 반주의 첫걸음.' },
  { id: 2, title: '② 멜로디 + 한 음', note: '중요한 멜로디 음 아래에 코드 음 하나(3도·6도). 소리가 두꺼워지기 시작해요.' },
  { id: 3, title: '③ 멜로디 맨 위 화음', note: '멜로디 아래 코드 음 둘 → 오른손 3음 화음. 왼손은 근음+5음.' },
  { id: 4, title: '④ 화음 + 왼손 펼침', note: '③의 오른손 + 왼손 근음-5음-옥타브 펼친화음. 찬양 반주에 가까운 소리.' },
];

const EPS = 1e-6;
const pcOf = (m: number) => ((m % 12) + 12) % 12;
const ivOf = (c: Chord, iv: number[]) => c.pcs.find((p) => iv.includes((p - c.root + 12) % 12)) ?? null;
/** 3음 (sus 코드는 없음), 7음 */
export const thirdOf = (c: Chord) => ivOf(c, [3, 4]);
const seventhOf = (c: Chord) => ivOf(c, [10, 11]);

/** 멜로디 음이 그 코드의 음인가 (슬래시 베이스 음도 포함) */
export function isChordTone(m: number, c: Chord): boolean { return c.pcs.includes(pcOf(m)) || c.bass === pcOf(m); }

/** beat 에 울리는 코드 구간 */
export function spanAt(spans: ChordSpan[], beat: number): ChordSpan | undefined {
  return spans.find((s) => beat >= s.beat - EPS && beat < s.beat + s.dur - EPS);
}

/**
 * 멜로디 아래에 둘 코드 음 (낮은 음부터).
 * count=1: 3도(3·4반음) → 6도(8·9반음) → 4도 → 5도 순으로 하나
 * count=2: 멜로디 아래 한 옥타브 안에서 2도(1·2반음)로 붙지 않는 두 음 — 근음·3음(·7음)이 다 들어가고 좁게 모인 것
 */
export function underVoices(mel: number, c: Chord, count: 1 | 2, floor = 55): number[] {
  const cands: number[] = [];
  for (let p = mel - 3; p >= Math.max(floor, mel - 12); p--) if (c.pcs.includes(pcOf(p)) && pcOf(p) !== pcOf(mel)) cands.push(p);
  if (!cands.length) return [];
  if (count === 1) {
    for (const want of [[3, 4], [8, 9], [5], [7]]) { const p = cands.find((x) => want.includes(mel - x)); if (p !== undefined) return [p]; }
    return [cands[0]];
  }
  const third = thirdOf(c), seventh = seventhOf(c);
  let best: number[] = [], bs = -Infinity;
  // sus·add2 코드는 2도로 붙은 소리가 그 코드의 색이라 허용
  const minGap = ['sus4', 'sus2', '2'].includes(c.quality) ? 2 : 3;
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
    const hi = cands[i], lo = cands[j];
    if (hi - lo < minGap || pcOf(hi) === pcOf(lo)) continue;
    const have = new Set([pcOf(mel), pcOf(hi), pcOf(lo)]);
    const sc = (have.has(c.root) ? 2 : 0) + (third !== null && have.has(third) ? 3 : 0) + (seventh !== null && have.has(seventh) ? 1 : 0) - (mel - lo) * 0.15;
    if (sc > bs) { bs = sc; best = [lo, hi]; }
  }
  return best.length ? best : [cands[0]];
}

type Mel = { beat: number; len: number; note: PNote };

/** 오른손 칸 → 멜로디 (칸마다 오른손 맨 위 음) */
export function melodyNotes(right: Step[]): Mel[] {
  const out: Mel[] = [];
  for (const s of right) {
    const r = s.notes.filter((n) => n.hand === 'R');
    if (!r.length) continue;
    const top = r.reduce((a, b) => (b.midi > a.midi ? b : a));
    out.push({ beat: s.beat, len: top.len ?? s.dur, note: { ...top, len: undefined } });
  }
  return out;
}

/** 멜로디만 남긴 칸 (자유 반주 연습용) */
export function melodySteps(steps: Step[]): Step[] {
  return steps.map((s) => {
    const r = s.notes.filter((n) => n.hand === 'R');
    if (!r.length) return { ...s, notes: [] };
    const top = r.reduce((a, b) => (b.midi > a.midi ? b : a));
    const n: PNote = { midi: top.midi, hand: 'R' };
    if (top.spell) n.spell = top.spell;
    if (top.finger) n.finger = top.finger;
    if (top.len !== undefined) n.len = top.len;
    return { ...s, notes: [n] };
  });
}

function spellFor(m: number, c: Chord): Pick<PNote, 'spell'> {
  if (![1, 3, 6, 8, 10].includes(pcOf(m))) return {};
  return { spell: c.flat || [5, 10, 3, 8, 1].includes(c.root) ? 'flat' : 'sharp' };
}

/** 코드 구간을 마디 줄에서 나눔 (왼손은 마디마다 다시 침) */
function splitAtBars(spans: ChordSpan[], beats: number): ChordSpan[] {
  const out: ChordSpan[] = [];
  for (const s of spans) {
    let t = s.beat;
    const end = s.beat + s.dur;
    while (t < end - EPS) {
      const barEnd = (Math.floor(t / beats + EPS) + 1) * beats;
      const e = Math.min(end, barEnd);
      out.push({ name: s.name, beat: t, dur: e - t });
      t = e;
    }
  }
  return out;
}

/** 낮은 베이스 (근음+5음이 오른손과 안 부딪히게 C#3 이상이면 한 옥타브 내림) */
function lowBass(c: Chord): number { const b = bassNote(c); return b > 47 ? b - 12 : b; }

/** 왼손 */
function leftPart(spans: ChordSpan[], level: TwoLevel, beats: number): { beat: number; notes: PNote[] }[] {
  const out: { beat: number; notes: PNote[] }[] = [];
  for (const sp of splitAtBars(spans, beats)) {
    const c = parseChord(sp.name);
    if (!c) continue;
    const n = (m: number, len: number, finger?: number): PNote => ({ midi: m, hand: 'L', len, ...(finger ? { finger } : {}), ...spellFor(m, c) });
    if (level <= 2) { out.push({ beat: sp.beat, notes: [n(bassNote(c), sp.dur, 5)] }); continue; }
    const b = lowBass(c);
    const slash = c.bass !== c.root;
    if (level === 3) {
      out.push({ beat: sp.beat, notes: slash ? [n(b, sp.dur, 5)] : [n(b, sp.dur, 5), n(b + 7, sp.dur, 1)] });
      continue;
    }
    // 4: 펼친화음 — 베이스 → 그 위 5도쯤의 코드 음 → 그 위 코드 음
    const up = (from: number, gap: number) => { let m = from + gap; while (!c.pcs.includes(pcOf(m))) m++; return m; };
    const t2 = slash ? up(b, 5) : b + 7;
    const t3 = slash ? up(t2, 3) : b + 12;
    const seq: [number, number][] = beats % 3 === 0 ? [[b, 5], [t2, 2], [t3, 1]] : [[b, 5], [t2, 2], [t3, 1], [t2, 2]];
    for (let t = sp.beat, k = 0; t < sp.beat + sp.dur - EPS; t += 1, k++) {
      const [m, f] = seq[k % seq.length];
      out.push({ beat: t, notes: [n(m, Math.min(1, sp.beat + sp.dur - t), f)] });
    }
  }
  return out;
}

/** 이 멜로디 음 아래에 화음을 넣을 자리인가 */
function important(m: Mel, sp: ChordSpan, beats: number): boolean {
  if (Math.abs(m.beat - sp.beat) < EPS) return true; // 코드가 바뀌는 음
  const onBeat = Math.abs(m.beat - Math.round(m.beat)) < EPS;
  if (!onBeat) return false;
  const pos = ((m.beat % beats) + beats) % beats;
  if (pos < EPS) return true; // 마디 첫 박
  if (beats % 2 === 0 && Math.abs(pos - beats / 2) < EPS) return true; // 4/4 셋째 박
  return m.len >= 1 - EPS;
}

/**
 * 오른손 멜로디 + 코드 → 양손 반주 칸.
 * total: 곡 전체 박 수 (마지막 마디 끝까지)
 */
export function arrangeBoth(right: Step[], spans: ChordSpan[], level: TwoLevel, beats: number, total: number): Step[] {
  const mel = melodyNotes(right);
  const left = leftPart(spans, level, beats);
  // 오른손 아래 음은 그때 왼손 가장 높은 음보다 위 (G3 이상)
  const floorAt = (b0: number, b1: number) => {
    let top = 0;
    for (const e of left) for (const n of e.notes) if (e.beat < b1 - EPS && e.beat + (n.len ?? 1) > b0 + EPS) top = Math.max(top, n.midi);
    return Math.max(55, top + 1);
  };
  // 화음 넣을 음 고르기
  type H = { i: number; under: number[]; c: Chord; sp: ChordSpan };
  const hs: H[] = [];
  if (level >= 2) mel.forEach((m, i) => {
    let sp = spanAt(spans, m.beat);
    let imp = !!sp && important(m, sp, beats);
    // 당김음: 코드가 바뀌기 반 박 안쪽 앞에서 시작해 바뀌는 박을 넘어 이어지는 음은 새 코드로
    const next = spans.find((x) => x.beat > m.beat + EPS && x.beat <= m.beat + 0.5 + EPS && x.beat < m.beat + m.len - EPS);
    if (next && !mel.some((o) => Math.abs(o.beat - next.beat) < EPS)) { sp = next; imp = true; }
    const c = sp && parseChord(sp.name);
    if (!sp || !c || !imp || !isChordTone(m.note.midi, c)) return;
    const under = underVoices(m.note.midi, c, level === 2 ? 1 : 2, floorAt(m.beat, Math.max(sp.beat + sp.dur, m.beat + m.len)));
    if (under.length) hs.push({ i, under, c, sp });
  });
  const ev = new Map<number, PNote[]>();
  const key = (b: number) => Math.round(b * 1000) / 1000;
  const add = (b: number, ns: PNote[]) => ev.set(key(b), [...(ev.get(key(b)) ?? []), ...ns]);
  mel.forEach((m) => add(m.beat, [{ ...m.note, len: m.len }]));
  // 아래 음은 멜로디 음과 같은 길이 (악보에 보이는 대로 치기 — 이어지는 소리는 페달로)
  hs.forEach((h) => {
    const m = mel[h.i];
    add(m.beat, h.under.map((u) => ({ midi: u, hand: 'R' as const, len: m.len, ...spellFor(u, h.c) })));
  });
  for (const e of left) add(e.beat, e.notes);
  const beatsSorted = [...ev.keys()].sort((a, b) => a - b);
  const out: Step[] = [];
  if (beatsSorted.length && beatsSorted[0] > EPS) out.push({ beat: 0, dur: beatsSorted[0], notes: [] });
  beatsSorted.forEach((b, i) => {
    const dur = key((beatsSorted[i + 1] ?? total) - b);
    const notes = ev.get(b)!.map((n) => {
      const o = { ...n };
      if (o.len !== undefined && Math.abs(o.len - dur) < 1e-3) delete o.len;
      if (o.len === undefined) delete o.len;
      return o;
    }).sort((x, y) => x.midi - y.midi);
    // 같은 건반이 두 번 들어가면 하나만
    out.push({ beat: b, dur, notes: notes.filter((n, k) => notes.findIndex((x) => x.midi === n.midi) === k) });
  });
  return out;
}

/* ─────────────── 보이싱 연습 문제 ─────────────── */

export type VoiceItem = { chord: string; mel: number };

/**
 * 코드 진행 → 보이싱 문제 (멜로디 = 맨 위 음).
 * 맨 위 음은 E4~D5 사이 코드 음 중 앞 문제의 맨 위 음과 가까운 것 (같은 음은 두 번까지)
 */
export function voiceItems(chords: string[], start = 67): VoiceItem[] {
  let prev = start;
  let same = 0;
  return chords.map((name) => {
    const c = parseChord(name)!;
    const cands: number[] = [];
    for (let m = 64; m <= 74; m++) if (c.pcs.includes(pcOf(m))) cands.push(m);
    cands.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev) || b - a);
    let mel = cands[0];
    if (mel === prev) { same++; if (same >= 2 && cands[1] !== undefined) { mel = cands[1]; same = 0; } } else same = 0;
    prev = mel;
    return { chord: name, mel };
  });
}

/** 누르고 있는 음이 "멜로디가 맨 위인 그 코드"인가: top = 맨 위 음이 멜로디, notes = 오른손(멜로디 아래 한 옥타브 안) 코드 음 수 */
export function judgeVoicing(held: number[], item: VoiceItem): { top: boolean; wrong: number[]; under: number; full: boolean } {
  const c = parseChord(item.chord)!;
  const hs = [...new Set(held)].sort((a, b) => a - b);
  const top = hs.length > 0 && hs[hs.length - 1] === item.mel;
  const wrong = hs.filter((m) => !isChordTone(m, c));
  const under = hs.filter((m) => m < item.mel && m >= item.mel - 12 && c.pcs.includes(pcOf(m))).length;
  const pcs = new Set(hs.map(pcOf));
  const third = thirdOf(c);
  const full = top && wrong.length === 0 && under >= 2 && (third === null || pcs.has(third));
  return { top, wrong, under, full };
}
