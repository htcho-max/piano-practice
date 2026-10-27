/**
 * 찬양 반주 색채: 악보 코드에 반주자가 흔히 더하는 색을 입힘 (코드 구간 → 코드 구간).
 *  - sus4 → 3 : 악절 끝(4마디마다)·곡 끝에서 으뜸으로 풀리는 딸림 코드(그 조의 V 또는 7화음)를 앞 반 sus4, 뒤 반 원래 코드로
 *  - add2     : 딸림이 아닌 장3화음에 2음 (C → C2) — 찬양 반주의 열린 소리
 *  - 지나가는 베이스 : 다음 코드 베이스까지 3도(3·4반음)면 그 사이 음을 코드 마지막 박 베이스로 (C → C/B → Am)
 */
import { parseChord, rootName, type Chord, type ChordSpan } from './chordbook';

export type ColorOpts = { sus: boolean; add2: boolean; walk: boolean };
export const COLOR_OPTS: { id: keyof ColorOpts; title: string; note: string }[] = [
  { id: 'sus', title: 'sus4 → 3', note: '딸림 코드(다음 코드로 풀리는 V)를 sus4 로 걸었다가 3음으로 풀기 — 찬양 끝맺음의 단골' },
  { id: 'add2', title: 'add2', note: 'I·IV 같은 장3화음에 2음을 더해 열린 소리 (C → C2)' },
  { id: 'walk', title: '지나가는 베이스', note: '베이스가 3도 떨어진 코드 사이에 한 음을 끼워 계단처럼 (C → C/B → Am)' },
];

const pcOf = (m: number) => ((m % 12) + 12) % 12;
/** 조표(fifths) → 장조 음계 음들 */
function scalePcs(fifths: number): number[] { const t = pcOf(fifths * 7); return [0, 2, 4, 5, 7, 9, 11].map((x) => (t + x) % 12); }

function rename(c: Chord, quality: string, bass?: number): string {
  const r = c.name.match(/^[A-Ga-g][#♯b♭]?/)![0];
  const flat = c.flat || /b|♭/.test(r);
  const b = bass === undefined || bass === c.root ? '' : `/${rootName(bass, flat)}`;
  return `${r}${quality}${b}`;
}

/** 딸림: 다음 코드로 4도 위에 풀리는 코드 중, 그 조의 V 이거나 7화음 (I → IV 같은 건 제외) */
const isDominant = (c: Chord, next: Chord | null | undefined, tonic: number) => !!next && pcOf(next.root - c.root) === 5 && ((c.quality === '' && c.root === (tonic + 7) % 12) || c.quality === '7');

/** mel: 멜로디 (있으면 sus4 자리에 멜로디가 3음이면 sus 를 안 걸음 — 부딪힘) */
export function colorize(spans: ChordSpan[], o: ColorOpts, beats: number, fifths = 0, mel: { beat: number; len: number; midi: number }[] = []): ChordSpan[] {
  const scale = scalePcs(fifths);
  const tonic = pcOf(fifths * 7);
  const out: ChordSpan[] = [];
  // sus 는 악절 끝(첫 코드부터 4마디마다)에서 으뜸으로 풀릴 때와 곡의 마지막 딸림에만 — 매번 걸면 지루함
  const origin = spans.find((x) => parseChord(x.name))?.beat ?? 0;
  const domIdx = spans.map((sp, i) => { const c = parseChord(sp.name); const n = spans[i + 1] && parseChord(spans[i + 1].name); return c && isDominant(c, n, tonic) ? i : -1; }).filter((i) => i >= 0);
  const lastDom = domIdx[domIdx.length - 1];
  const cadence = (i: number) => { const r = spans[i].beat + spans[i].dur - origin; return i === lastDom || Math.abs(r / (4 * beats) - Math.round(r / (4 * beats))) < 1e-6; };
  spans.forEach((sp, i) => {
    const c = parseChord(sp.name);
    const nextSp = spans[i + 1];
    const next = nextSp ? parseChord(nextSp.name) : null;
    if (!c) { out.push(sp); return; }
    const parts: ChordSpan[] = [];
    // 1) sus4 → 3
    // sus 자리: 두 마디 이상이면 끝에서 둘째 마디, 아니면 앞 반 (박 단위로)
    const end = sp.beat + sp.dur;
    const [s0, s1] = sp.dur >= 2 * beats - 1e-6 ? [end - 2 * beats, end - beats] : [sp.beat, sp.beat + Math.ceil(sp.dur / 2 - 1e-6)];
    const third = (c.root + 4) % 12;
    const clash = mel.some((m) => m.beat < s1 - 1e-6 && m.beat + m.len > s0 + 1e-6 && pcOf(m.midi) === third);
    if (o.sus && isDominant(c, next, tonic) && cadence(i) && sp.dur >= 2 - 1e-6 && c.bass === c.root && !clash) {
      if (s0 > sp.beat + 1e-6) parts.push({ name: sp.name, beat: sp.beat, dur: s0 - sp.beat });
      parts.push({ name: rename(c, 'sus4'), beat: s0, dur: s1 - s0 }, { name: sp.name, beat: s1, dur: end - s1 });
    } else if (o.add2 && c.quality === '' && !isDominant(c, next, tonic)) {
      // 2) add2 (슬래시 베이스는 그대로)
      parts.push({ ...sp, name: rename(c, '2', c.bass) });
    } else parts.push({ ...sp });
    // 3) 지나가는 베이스: 마지막 1박
    if (o.walk && next && sp.dur >= 2 - 1e-6 && nextSp.beat === sp.beat + sp.dur) {
      const d = pcOf(next.bass - c.bass); // 위로 반음 수
      const down = 12 - d;
      let pass: number | null = null;
      if ([3, 4].includes(down)) pass = [c.bass - 1, c.bass - 2].map(pcOf).find((p) => scale.includes(p) && p !== next.bass) ?? null;
      else if ([3, 4].includes(d)) pass = [c.bass + 1, c.bass + 2].map(pcOf).find((p) => scale.includes(p) && p !== next.bass) ?? null;
      if (pass !== null) {
        const last = parts[parts.length - 1];
        if (last.dur >= 2 - 1e-6) {
          const lc = parseChord(last.name)!;
          last.dur -= 1;
          parts.push({ name: rename(lc, lc.name.replace(/^[A-Ga-g][#♯b♭]?/, '').replace(/\/.*$/, ''), pass), beat: last.beat + last.dur, dur: 1 });
        }
      }
    }
    out.push(...parts);
  });
  return out;
}
