import type { Step, PNote, Hand } from './steps';

/**
 * MusicXML(.musicxml / .xml, 압축된 .mxl) → 연습 칸.
 * - 피아노 악보(한 파트, 오선 2개): 1번 오선 = 오른손, 2번 = 왼손
 * - 파트가 둘 이상이고 각각 오선 하나면: 첫 파트 오른손, 둘째 파트 왼손 (나머지 파트는 무시)
 * - 오선 하나짜리 멜로디: 낮은음자리표면 왼손, 아니면 오른손
 * - 붙임줄은 한 음으로 합침, 꾸밈음·큐 음 무시, 도돌이표는 펼치지 않음(안내만)
 * 박(beat)은 4분음표 = 1.
 */
export type ParsedSong = {
  title: string; composer: string; beats: number; timeNum: number; timeDen: number; bpm: number | null;
  steps: Step[]; bars: number; warnings: string[]; fifths?: number;
};

type Ev = { beat: number; len: number; midi: number; hand: Hand; finger?: number; spell?: 'sharp' | 'flat'; tieStop: boolean; tieStart: boolean; voiceKey: string };

const STEP_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function txt(el: Element | null | undefined, sel: string): string | null {
  const x = el?.querySelector(sel);
  return x ? (x.textContent ?? '').trim() : null;
}
function kids(el: Element, name: string): Element[] { return Array.from(el.children).filter((c) => c.tagName === name); }

export function parseMusicXML(xml: string): ParsedSong {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('MusicXML 파일을 읽을 수 없어요 (XML 형식 오류).');
  const root = doc.documentElement;
  if (root.tagName === 'score-timewise') throw new Error('timewise 형식은 아직 못 읽어요. 악보 프로그램에서 일반(partwise) MusicXML 로 내보내 주세요.');
  if (root.tagName !== 'score-partwise') throw new Error('MusicXML 악보가 아니에요.');
  const warnings: string[] = [];
  const title = txt(root, 'work > work-title') || txt(root, 'movement-title') || txt(root, 'credit > credit-words') || '제목 없는 곡';
  const composer = Array.from(root.querySelectorAll('identification > creator')).find((c) => c.getAttribute('type') === 'composer')?.textContent?.trim() ?? '';
  const parts = Array.from(root.querySelectorAll(':scope > part'));
  if (!parts.length) throw new Error('악보에 파트가 없어요.');

  // 파트마다 오선 수
  const staffCount = (p: Element) => Number(txt(p, 'attributes > staves') ?? '1') || 1;
  let use: { part: Element; handOf: (staff: number) => Hand | null }[];
  if (staffCount(parts[0]) >= 2) {
    use = [{ part: parts[0], handOf: (s) => (s === 1 ? 'R' : s === 2 ? 'L' : null) }];
    if (parts.length > 1) warnings.push(`파트가 ${parts.length}개라 첫 파트(피아노)만 가져왔어요.`);
  } else if (parts.length >= 2) {
    use = [{ part: parts[0], handOf: () => 'R' }, { part: parts[1], handOf: () => 'L' }];
    if (parts.length > 2) warnings.push(`파트가 ${parts.length}개라 앞의 두 파트만 가져왔어요 (위 = 오른손, 아래 = 왼손).`);
  } else {
    const clef = txt(parts[0], 'attributes > clef > sign');
    const h: Hand = clef === 'F' ? 'L' : 'R';
    use = [{ part: parts[0], handOf: () => h }];
  }

  let timeNum = 4, timeDen = 4, bpm: number | null = null;
  let barBeats = 4;
  const evs: Ev[] = [];
  let bars = 0;
  let sawRepeat = false;
  let firstTime = true;
  let fifths: number | undefined;

  for (const { part, handOf } of use) {
    let divisions = 1;
    let measureStart = 0; // 박
    let localBars = 0;
    for (const m of kids(part, 'measure')) {
      localBars++;
      let cursor = 0; // 마디 안 divisions
      let lastOnset = 0;
      let maxCursor = 0;
      for (const el of Array.from(m.children)) {
        const tag = el.tagName;
        if (tag === 'attributes') {
          const d = txt(el, 'divisions'); if (d) divisions = Number(d) || divisions;
          const kf = txt(el, 'key > fifths'); if (kf !== null && fifths === undefined) fifths = Number(kf);
          const b = txt(el, 'time > beats'); const bt = txt(el, 'time > beat-type');
          if (b && bt) {
            const nb = Number(b.split('+').reduce((a, x) => a + Number(x), 0));
            if (firstTime || measureStart === 0) { timeNum = nb; timeDen = Number(bt); }
            else if (nb !== timeNum || Number(bt) !== timeDen) warnings.push('곡 중간에 박자표가 바뀌어요. 처음 박자표로 마디선을 그려요.');
            barBeats = (nb * 4) / Number(bt);
            firstTime = false;
          }
        } else if (tag === 'direction' || tag === 'sound') {
          const snd = tag === 'sound' ? el : el.querySelector('sound');
          const t = snd?.getAttribute('tempo');
          if (t && bpm === null) bpm = Math.round(Number(t));
          if (bpm === null) {
            const pm = txt(el, 'metronome > per-minute');
            const unit = txt(el, 'metronome > beat-unit');
            if (pm) bpm = Math.round(Number(pm) * (unit === 'half' ? 2 : unit === 'eighth' ? 0.5 : 1) * (el.querySelector('metronome > beat-unit-dot') ? 1.5 : 1));
          }
        } else if (tag === 'barline') {
          if (el.querySelector('repeat') || el.querySelector('ending')) sawRepeat = true;
        } else if (tag === 'backup') {
          cursor -= Number(txt(el, 'duration') ?? 0);
        } else if (tag === 'forward') {
          cursor += Number(txt(el, 'duration') ?? 0);
          maxCursor = Math.max(maxCursor, cursor);
        } else if (tag === 'note') {
          if (el.querySelector('grace') || el.querySelector('cue')) continue;
          const dur = Number(txt(el, 'duration') ?? 0);
          const isChord = !!el.querySelector('chord');
          const onset = isChord ? lastOnset : cursor;
          if (!isChord) { lastOnset = cursor; cursor += dur; maxCursor = Math.max(maxCursor, cursor); }
          if (el.querySelector('rest')) continue;
          const step = txt(el, 'pitch > step');
          const oct = txt(el, 'pitch > octave');
          if (!step || oct === null) continue; // 타악기 등
          const alter = Math.round(Number(txt(el, 'pitch > alter') ?? 0));
          const midi = (Number(oct) + 1) * 12 + STEP_PC[step] + alter;
          const staff = Number(txt(el, 'staff') ?? '1');
          const hand = handOf(staff);
          if (!hand) continue;
          const ties = Array.from(el.querySelectorAll(':scope > tie')).map((t) => t.getAttribute('type'));
          const fing = txt(el, 'notations > technical > fingering');
          const f = fing ? Number(fing.replace(/[^1-5].*$/, '').slice(0, 1)) : NaN;
          evs.push({
            beat: r3(measureStart + onset / divisions), len: r3(dur / divisions), midi, hand,
            finger: f >= 1 && f <= 5 ? f : undefined, spell: alter > 0 ? 'sharp' : alter < 0 ? 'flat' : undefined,
            tieStop: ties.includes('stop'), tieStart: ties.includes('start'), voiceKey: `${hand}${staff}`,
          });
        }
      }
      // 못갖춘마디(implicit)는 실제 길이만큼, 아니면 박자표 길이만큼
      const real = maxCursor / divisions;
      const implicit = m.getAttribute('implicit') === 'yes';
      measureStart = r3(measureStart + (implicit && real > 0 ? real : Math.max(real, barBeats)));
    }
    bars = Math.max(bars, localBars);
  }
  if (sawRepeat) warnings.push('도돌이표·괄호는 펼치지 않고 적힌 순서대로 한 번만 쳐요.');

  // 붙임줄 합치기: tieStop 음은 같은 손·같은 음의 앞 음(끝이 맞닿은)에 길이를 더함
  evs.sort((a, b) => a.beat - b.beat || a.midi - b.midi);
  const kept: Ev[] = [];
  const open = new Map<string, Ev>();
  for (const e of evs) {
    const key = `${e.hand}:${e.midi}`;
    const prev = open.get(key);
    if (e.tieStop && prev && Math.abs(prev.beat + prev.len - e.beat) < 0.01) {
      prev.len = r3(prev.len + e.len);
      if (!e.tieStart) open.delete(key);
      continue;
    }
    kept.push(e);
    if (e.tieStart) open.set(key, e); else open.delete(key);
  }

  // 같은 시작 박끼리 한 칸
  const byBeat = new Map<number, Ev[]>();
  for (const e of kept) { const a = byBeat.get(e.beat) ?? []; a.push(e); byBeat.set(e.beat, a); }
  const onsets = [...byBeat.keys()].sort((a, b) => a - b);
  const end = Math.max(0, ...kept.map((e) => e.beat + e.len));
  const total = Math.ceil(r3(end / barBeats) - 1e-6) * barBeats;
  const steps: Step[] = [];
  // 첫 음 앞이 비면 쉼표 칸
  if (onsets.length && onsets[0] > 0) steps.push({ beat: 0, dur: onsets[0], notes: [] });
  onsets.forEach((b, i) => {
    const next = onsets[i + 1] ?? total;
    const es = byBeat.get(b)!;
    const dur = r3(next - b);
    const notes: PNote[] = es.map((e) => {
      const n: PNote = { midi: e.midi, hand: e.hand };
      if (e.finger) n.finger = e.finger;
      if (e.spell) n.spell = e.spell;
      if (Math.abs(e.len - dur) > 0.01) n.len = e.len;
      return n;
    }).sort((a, c) => a.midi - c.midi);
    steps.push({ beat: b, dur, notes });
  });
  if (!kept.length) throw new Error('악보에서 음을 찾지 못했어요.');
  return { title, composer, beats: barBeats, timeNum, timeDen, bpm, steps, bars, warnings, fifths };
}

/* ── .mxl (zip) 풀기: 브라우저 DecompressionStream('deflate-raw') ── */
export async function unzipMxl(buf: ArrayBuffer): Promise<string> {
  const v = new DataView(buf);
  const u8 = new Uint8Array(buf);
  // 중앙 디렉터리 끝 찾기
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('.mxl 압축 파일을 읽을 수 없어요.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const entries: { name: string; method: number; csize: number; local: number }[] = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    entries.push({ name: dec.decode(u8.subarray(p + 46, p + 46 + nlen)), method, csize, local });
    p += 46 + nlen + xlen + clen;
  }
  const read = async (name: string): Promise<string> => {
    const e = entries.find((x) => x.name === name);
    if (!e) throw new Error(`압축 안에 ${name} 이 없어요.`);
    const lp = e.local;
    const start = lp + 30 + v.getUint16(lp + 26, true) + v.getUint16(lp + 28, true);
    const data = u8.slice(start, start + e.csize);
    if (e.method === 0) return dec.decode(data);
    if (e.method !== 8) throw new Error('지원하지 않는 압축 방식이에요.');
    const ds = new DecompressionStream('deflate-raw');
    const out = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
    return dec.decode(out);
  };
  let rootName = entries.find((e) => !e.name.startsWith('META-INF') && /\.(musicxml|xml)$/i.test(e.name))?.name;
  if (entries.some((e) => e.name === 'META-INF/container.xml')) {
    const c = await read('META-INF/container.xml');
    const m = /full-path="([^"]+)"/.exec(c);
    if (m) rootName = m[1];
  }
  if (!rootName) throw new Error('압축 안에서 악보 파일을 찾지 못했어요.');
  return read(rootName);
}

/** 파일 → 텍스트 (.mxl 이면 풀어서) */
export async function readScoreFile(file: File): Promise<string> {
  if (/\.mxl$/i.test(file.name)) return unzipMxl(await file.arrayBuffer());
  return file.text();
}
