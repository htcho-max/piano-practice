/**
 * 코드 기호 → 음, 피아노 자리(보이싱), 진행, 반주 패턴.
 * 찬양 악보에 흔한 표기: C, Am, G7, Cmaj7, Dm7, Gsus4, C2(=add2), G/B(베이스 음), F#m, Bb, Edim, Caug, C6
 */
import type { PNote, Step } from './steps';

export const ROOT_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const ROOT_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 성질 → 근음에서의 반음 (화음 음) */
export const QUALITIES: { id: string; label: string; iv: number[] }[] = [
  { id: '', label: '장 (C)', iv: [0, 4, 7] },
  { id: 'm', label: '단 (Cm)', iv: [0, 3, 7] },
  { id: '7', label: '7 (C7)', iv: [0, 4, 7, 10] },
  { id: 'maj7', label: 'maj7', iv: [0, 4, 7, 11] },
  { id: 'm7', label: 'm7', iv: [0, 3, 7, 10] },
  { id: 'sus4', label: 'sus4', iv: [0, 5, 7] },
  { id: '2', label: '2 (add2)', iv: [0, 2, 4, 7] },
  { id: 'sus2', label: 'sus2', iv: [0, 2, 7] },
  { id: '6', label: '6', iv: [0, 4, 7, 9] },
  { id: 'm6', label: 'm6', iv: [0, 3, 7, 9] },
  { id: 'dim', label: 'dim', iv: [0, 3, 6] },
  { id: 'aug', label: 'aug', iv: [0, 4, 8] },
  { id: 'm7b5', label: 'm7♭5', iv: [0, 3, 6, 10] },
  { id: 'dim7', label: 'dim7', iv: [0, 3, 6, 9] },
];
const ALIAS: Record<string, string> = { '': '', M: '', maj: '', m: 'm', min: 'm', '-': 'm', '7': '7', dom7: '7', maj7: 'maj7', M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', m7: 'm7', min7: 'm7', '-7': 'm7', sus4: 'sus4', sus: 'sus4', '2': '2', add2: '2', add9: '2', sus2: 'sus2', '6': '6', m6: 'm6', dim: 'dim', '°': 'dim', o: 'dim', aug: 'aug', '+': 'aug', m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', dim7: 'dim7', '°7': 'dim7', o7: 'dim7', '7sus4': 'sus4', '9': '7', maj9: 'maj7', m9: 'm7' };

export type Chord = { name: string; root: number; quality: string; pcs: number[]; bass: number; flat: boolean };

/** "G/B" → 코드. 못 읽으면 null */
export function parseChord(sym: string): Chord | null {
  const m = /^\s*([A-Ga-g])([#♯b♭]?)([^/\s]*)(?:\/([A-Ga-g])([#♯b♭]?))?\s*$/.exec(sym);
  if (!m) return null;
  const acc = (a: string) => (a === '#' || a === '♯' ? 1 : a === 'b' || a === '♭' ? -1 : 0);
  const root = (LETTER[m[1].toUpperCase()] + acc(m[2]) + 12) % 12;
  const q = ALIAS[m[3]];
  if (q === undefined) return null;
  const iv = QUALITIES.find((x) => x.id === q)!.iv;
  const bass = m[4] ? (LETTER[m[4].toUpperCase()] + acc(m[5]) + 12) % 12 : root;
  const flat = m[2] === 'b' || m[2] === '♭' || (m[5] === 'b' || m[5] === '♭');
  return { name: sym.trim(), root, quality: q, pcs: iv.map((x) => (root + x) % 12), bass, flat };
}

export function rootName(pc: number, flat = false): string { return (flat ? ROOT_NAMES_FLAT : ROOT_NAMES_SHARP)[((pc % 12) + 12) % 12]; }

/** 꼭 있어야 하는 음 (5음은 빼도 됨, 단 dim·aug·sus 는 5음이 성격이라 필요) */
function required(c: Chord): number[] {
  if (['dim', 'aug', 'sus4', 'sus2', 'm7b5', 'dim7'].includes(c.quality) || c.pcs.length === 3) return c.pcs;
  const fifth = (c.root + 7) % 12;
  return c.pcs.filter((p) => p !== fifth);
}

/**
 * 누르고 있는 음이 그 코드인가.
 * ok = 필요한 음이 다 있고 다른 음 없음(베이스 음은 허용), partial = 일부만, wrong = 코드 밖 음이 있음
 */
export function matchChord(held: number[], c: Chord): 'ok' | 'partial' | 'wrong' | 'none' {
  if (!held.length) return 'none';
  const pcs = new Set(held.map((m) => ((m % 12) + 12) % 12));
  for (const p of pcs) if (!c.pcs.includes(p) && p !== c.bass) return 'wrong';
  return required(c).every((p) => pcs.has(p)) ? 'ok' : 'partial';
}

/** 오른손 자리: 화음 음을 lo~hi 안에 촘촘히(한 옥타브 안) 놓은 것 중 prev 에 가장 가까운 것 (없으면 가운데 E4 근처) */
export function voicing(c: Chord, prev?: number[], lo = 55, hi = 79): number[] {
  const tones = c.pcs.length > 3 && c.quality !== '2' ? c.pcs.slice(0, 4) : c.pcs;
  const cands: number[][] = [];
  // 아래 음 = 화음 음 하나, 나머지는 그 위로 차례로
  for (let base = lo; base <= hi; base++) {
    if (!tones.includes(base % 12)) continue;
    const v = [base];
    let cur = base;
    for (let k = 1; k < tones.length; k++) {
      let n = cur + 1;
      while (!tones.includes(n % 12) || v.some((x) => x % 12 === n % 12)) n++;
      v.push(n); cur = n;
    }
    if (v[v.length - 1] <= hi && v[v.length - 1] - v[0] <= 12) cands.push(v);
  }
  if (!cands.length) return tones.map((p) => 60 + p);
  const dist = (v: number[]) => {
    // 처음 코드는 기본 자리(근음이 맨 아래)로 가운데 도 근처
    if (!prev?.length) return Math.abs(v.reduce((a, b) => a + b, 0) / v.length - 64) + (v[0] % 12 !== c.root ? 2 : 0);
    // 각 음이 가장 가까운 앞 음까지 움직인 거리 합 + 가운데에서 너무 멀면 조금
    return v.reduce((a, n) => a + Math.min(...prev.map((p) => Math.abs(p - n))), 0) + Math.abs(v[0] - 62) * 0.05;
  };
  return cands.sort((a, b) => dist(a) - dist(b))[0];
}

/** 오른손 손가락: 3음은 1-3-5, 위쪽 간격이 4도 이상이면 1-2-5, 4음은 1-2-3-5 */
export function rhFingers(v: number[]): number[] {
  if (v.length === 1) return [1];
  if (v.length === 2) return [1, 5];
  if (v.length === 3) return v[2] - v[1] >= 5 ? [1, 2, 5] : [1, 3, 5];
  return [1, 2, 3, 5].slice(0, v.length);
}

/** 왼손 베이스: E2~D#3 사이 */
export function bassNote(c: Chord): number { let b = 40 + ((c.bass - 4 + 12) % 12); if (b > 51) b -= 12; return b; }

/* ─────────────── 진행 ─────────────── */

/** 도수 → 장조 안 코드 (로마 숫자, 슬래시 베이스는 '/3' '/5' 같은 도수) */
const DEG: Record<string, { semi: number; q: string }> = {
  I: { semi: 0, q: '' }, ii: { semi: 2, q: 'm' }, iii: { semi: 4, q: 'm' }, IV: { semi: 5, q: '' }, V: { semi: 7, q: '' }, vi: { semi: 9, q: 'm' },
  V7: { semi: 7, q: '7' }, ii7: { semi: 2, q: 'm7' }, Imaj7: { semi: 0, q: 'maj7' }, IVmaj7: { semi: 5, q: 'maj7' }, vi7: { semi: 9, q: 'm7' },
  Isus4: { semi: 0, q: 'sus4' }, Vsus4: { semi: 7, q: 'sus4' }, I2: { semi: 0, q: '2' }, IV2: { semi: 5, q: '2' },
};
export const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]);
/** 찬양에 많이 쓰는 조 */
export const KEYS: { pc: number; name: string }[] = [0, 2, 4, 5, 7, 9, 10, 3].map((pc) => ({ pc, name: rootName(pc, FLAT_KEYS.has(pc)) }));

export type Progression = { id: string; title: string; degs: string[]; note: string };
export const PROGRESSIONS: Progression[] = [
  { id: 'basic', title: 'I – IV – V – I', degs: ['I', 'IV', 'V', 'I'], note: '주요 3화음. 모든 반주의 뼈대' },
  { id: 'pop', title: 'I – V – vi – IV', degs: ['I', 'V', 'vi', 'IV'], note: '찬양·가요에서 가장 흔한 진행' },
  { id: 'worship', title: 'IV – I – V – vi', degs: ['IV', 'I', 'V', 'vi'], note: '후렴에 자주 나오는 진행' },
  { id: 'six', title: 'vi – IV – I – V', degs: ['vi', 'IV', 'I', 'V'], note: '단조 느낌으로 시작' },
  { id: 'down', title: 'I – V/7 – vi – I/5 – IV – I/3 – ii – V', degs: ['I', 'V/7', 'vi', 'I/5', 'IV', 'I/3', 'ii', 'V'], note: '베이스가 한 음씩 내려가는 진행 (찬양 반주 단골)' },
  { id: 'twofive', title: 'ii7 – V7 – Imaj7', degs: ['ii7', 'V7', 'Imaj7', 'Imaj7'], note: '7화음 맛보기' },
];

/** 진행 → 코드 이름들 (V/7 같은 슬래시는 그 조에서 계산) */
export function progressionChords(p: Progression, key: number): string[] {
  return p.degs.map((d) => {
    const [base, slash] = d.split('/');
    const x = DEG[base];
    const flat = FLAT_KEYS.has(key);
    const name = rootName(key + x.semi, flat) + x.q;
    if (!slash) return name;
    // 슬래시 뒤 숫자 = 그 코드의 몇 음을 베이스로 (3 = 3음, 5 = 5음, 7 = 그 조의 이끎음)
    const c = parseChord(name)!;
    const bassPc = slash === '3' ? c.pcs[1] : slash === '5' ? c.pcs[2] : slash === '7' ? (key + 11) % 12 : c.root;
    return `${name}/${rootName(bassPc, flat)}`;
  });
}

/* ─────────────── 반주 패턴 ─────────────── */

export type PatternId = 'block' | 'half' | 'quarter' | 'arp' | 'eight' | 'waltz';
export const PATTERNS: { id: PatternId; title: string; note: string; beats: number; level: number }[] = [
  { id: 'block', title: '① 길게 누르기', note: '왼손 베이스 + 오른손 코드를 코드마다 한 번', beats: 4, level: 1 },
  { id: 'half', title: '② 두 박마다', note: '왼손은 길게, 오른손 코드를 2박마다', beats: 4, level: 1 },
  { id: 'quarter', title: '③ 한 박마다', note: '왼손은 길게, 오른손 코드를 박마다 (4비트)', beats: 4, level: 2 },
  { id: 'arp', title: '④ 왼손 펼친화음', note: '왼손 근음-5음-옥타브-5음, 오른손 코드는 길게', beats: 4, level: 2 },
  { id: 'eight', title: '⑤ 8비트', note: '오른손 코드를 8분음표로, 왼손 근음은 1·3박', beats: 4, level: 3 },
  { id: 'waltz', title: '⑥ 3박자 (왈츠)', note: '왼손 근음 1박, 오른손 코드 2·3박', beats: 3, level: 2 },
];

export type ChordSpan = { name: string; beat: number; dur: number };

/** 코드 구간 → 반주 칸 (오른손 코드 + 왼손 베이스). 페달 바꿀 박도 같이 */
export function accompany(spans: ChordSpan[], pattern: PatternId): { steps: Step[]; pedalAt: number[] } {
  const ev: { beat: number; notes: PNote[] }[] = [];
  let prev: number[] | undefined;
  const pedalAt: number[] = [];
  for (const sp of spans) {
    const c = parseChord(sp.name);
    if (!c) continue;
    pedalAt.push(sp.beat);
    const v = voicing(c, prev);
    prev = v;
    const f = rhFingers(v);
    const bass = bassNote(c);
    const rh = (len: number): PNote[] => v.map((m, i) => ({ midi: m, hand: 'R', finger: f[i], len, ...(spell(m, c)) }));
    const lh = (m: number, len: number, finger = 5): PNote => ({ midi: m, hand: 'L', finger, len, ...(spell(m, c)) });
    const at = (b: number, notes: PNote[]) => { if (b < sp.beat + sp.dur - 1e-6) ev.push({ beat: b, notes }); };
    const d = sp.dur, b0 = sp.beat;
    if (pattern === 'block') at(b0, [lh(bass, d), ...rh(d)]);
    else if (pattern === 'half') for (let t = 0; t < d - 1e-6; t += 2) at(b0 + t, t === 0 ? [lh(bass, d), ...rh(Math.min(2, d - t))] : rh(Math.min(2, d - t)));
    else if (pattern === 'quarter') for (let t = 0; t < d - 1e-6; t += 1) at(b0 + t, t === 0 ? [lh(bass, d), ...rh(1)] : rh(1));
    else if (pattern === 'eight') for (let t = 0; t < d - 1e-6; t += 0.5) at(b0 + t, [...(t % 2 === 0 ? [lh(bass, Math.min(2, d - t))] : []), ...rh(0.5)]);
    else if (pattern === 'waltz') for (let t = 0; t < d - 1e-6; t += 1) at(b0 + t, t % 3 === 0 ? [lh(bass, 1)] : rh(1));
    else if (pattern === 'arp') {
      const fifth = bass + 7, oct = bass + 12;
      const seq = [[bass, 5], [fifth, 2], [oct, 1], [fifth, 2]];
      for (let t = 0; t < d - 1e-6; t += 1) {
        const [m, fi] = seq[t % 4];
        at(b0 + t, t === 0 ? [lh(m, 1, fi), ...rh(d)] : [lh(m, 1, fi)]);
      }
    }
  }
  ev.sort((a, b) => a.beat - b.beat);
  const total = spans.length ? spans[spans.length - 1].beat + spans[spans.length - 1].dur : 0;
  const steps: Step[] = ev.map((e, i) => {
    const dur = (ev[i + 1]?.beat ?? total) - e.beat;
    return { beat: e.beat, dur, notes: e.notes.map((n) => (n.len !== undefined && Math.abs(n.len - dur) < 1e-6 ? { ...n, len: undefined } : n)).map(stripUndef) };
  });
  return { steps, pedalAt };
}
function stripUndef(n: PNote): PNote { const o = { ...n }; if (o.len === undefined) delete o.len; if (o.spell === undefined) delete o.spell; return o; }
function spell(m: number, c: Chord): { spell?: 'sharp' | 'flat' } {
  const p = ((m % 12) + 12) % 12;
  if (![1, 3, 6, 8, 10].includes(p)) return {};
  return { spell: c.flat || FLAT_KEYS.has(c.root) ? 'flat' : 'sharp' };
}

/** "C | G | Am F | G7" 같은 마디 글 → 코드 구간 (한 마디 안 여럿이면 똑같이 나눔, '.' 은 앞 코드 이어짐, '%' 는 앞 마디 그대로) */
export function parseBarsText(text: string, beats: number): { spans: ChordSpan[]; errors: string[] } {
  const bars = text.split('|').map((b) => b.trim()).filter((b, i, a) => b || (i > 0 && i < a.length - 1));
  const spans: ChordSpan[] = [];
  const errors: string[] = [];
  let lastBar: string[] = [];
  bars.forEach((bar, bi) => {
    let toks = bar.split(/\s+/).filter(Boolean);
    if (toks.length === 1 && toks[0] === '%') toks = lastBar;
    if (!toks.length) toks = ['.'];
    const each = beats / toks.length;
    toks.forEach((t, k) => {
      const beat = bi * beats + k * each;
      if (t === '.' || t === '-') { const p = spans[spans.length - 1]; if (p) p.dur += each; return; }
      if (!parseChord(t)) { errors.push(`${bi + 1}마디 "${t}"`); return; }
      const p = spans[spans.length - 1];
      if (p && p.name === t && Math.abs(p.beat + p.dur - beat) < 1e-6) { p.dur += each; return; }
      spans.push({ name: t, beat, dur: each });
    });
    lastBar = toks;
  });
  return { spans, errors };
}

/** 코드 구간 → 마디 글 */
export function barsText(spans: ChordSpan[], beats: number, bars: number): string {
  const out: string[] = [];
  for (let b = 0; b < bars; b++) {
    const s = b * beats;
    const inBar = spans.filter((x) => x.beat < s + beats - 1e-6 && x.beat + x.dur > s + 1e-6);
    const starts = inBar.filter((x) => x.beat >= s - 1e-6);
    if (!starts.length) out.push(inBar[0]?.name ?? '.');
    else if (starts.length === 1 && starts[0].beat <= s + 1e-6) out.push(starts[0].name);
    else {
      // 반 마디 단위로
      const half = beats / 2;
      const at = (t: number) => (spans.find((x) => t >= x.beat - 1e-6 && t < x.beat + x.dur - 1e-6)?.name ?? '.');
      const a = at(s), c = at(s + half);
      out.push(a === c ? a : `${a} ${c}`);
    }
  }
  return out.join(' | ');
}

/* ─────────────── 멜로디 + 왼손 반주 ─────────────── */

export type LeftKind = 'bass' | 'bass5' | 'arp' | 'block';
export const LEFT_KINDS: { id: LeftKind; title: string; note: string }[] = [
  { id: 'bass', title: '근음 길게', note: '코드마다 왼손 한 음 (가장 쉬움)' },
  { id: 'bass5', title: '근음 + 5음', note: '반 마디씩 근음 → 5음' },
  { id: 'block', title: '왼손 화음', note: '왼손으로 코드 세 음을 길게' },
  { id: 'arp', title: '펼친화음', note: '근음-5음-옥타브-5음 (4분음표)' },
];

/** 코드 구간 → 왼손 음들 */
export function leftHand(spans: ChordSpan[], kind: LeftKind, beats: number): { beat: number; notes: PNote[] }[] {
  const out: { beat: number; notes: PNote[] }[] = [];
  let prev: number[] | undefined;
  for (const sp of spans) {
    const c = parseChord(sp.name);
    if (!c) continue;
    const bass = bassNote(c);
    const n = (m: number, len: number, finger?: number): PNote => ({ midi: m, hand: 'L', len, ...(finger ? { finger } : {}), ...spell(m, c) });
    const end = sp.beat + sp.dur;
    if (kind === 'bass') out.push({ beat: sp.beat, notes: [n(bass, sp.dur, 5)] });
    else if (kind === 'block') {
      const v = voicing(c, prev, 43, 60).slice(0, 3);
      prev = v;
      const f = v.length === 3 ? (v[1] - v[0] >= 5 ? [5, 2, 1] : [5, 3, 1]) : [5, 1];
      out.push({ beat: sp.beat, notes: v.map((m, i) => n(m, sp.dur, f[i])) });
    } else if (kind === 'bass5') {
      const half = beats % 2 === 0 ? beats / 2 : beats;
      for (let t = sp.beat, k = 0; t < end - 1e-6; t += half, k++) out.push({ beat: t, notes: [n(k % 2 ? bass + 7 : bass, Math.min(half, end - t), k % 2 ? 1 : 5)] });
    } else {
      const seq: [number, number][] = [[bass, 5], [bass + 7, 2], [bass + 12, 1], [bass + 7, 2]];
      for (let t = sp.beat, k = 0; t < end - 1e-6; t += 1, k++) out.push({ beat: t, notes: [n(seq[k % 4][0], Math.min(1, end - t), seq[k % 4][1])] });
    }
  }
  return out;
}

/** 오른손 칸 + 왼손 음들 → 한 줄 칸 (같은 박은 합침) */
export function mergeHands(right: Step[], left: { beat: number; notes: PNote[] }[], total: number): Step[] {
  const map = new Map<number, PNote[]>();
  const key = (b: number) => Math.round(b * 1000) / 1000;
  for (const s of right) {
    const rs = s.notes.filter((n) => n.hand === 'R').map((n) => (n.len === undefined ? { ...n, len: s.dur } : n));
    if (rs.length) map.set(key(s.beat), [...(map.get(key(s.beat)) ?? []), ...rs]);
  }
  for (const e of left) map.set(key(e.beat), [...(map.get(key(e.beat)) ?? []), ...e.notes]);
  const beats = [...map.keys()].sort((a, b) => a - b);
  const out: Step[] = [];
  if (beats.length && beats[0] > 0) out.push({ beat: 0, dur: beats[0], notes: [] });
  beats.forEach((b, i) => {
    const dur = key((beats[i + 1] ?? total) - b);
    const notes = map.get(b)!.map((n) => (n.len !== undefined && Math.abs(n.len - dur) < 1e-6 ? stripUndef({ ...n, len: undefined }) : n)).sort((x, y) => x.midi - y.midi);
    out.push({ beat: b, dur, notes });
  });
  return out;
}
