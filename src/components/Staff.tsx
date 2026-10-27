import { useEffect, useMemo, useRef, useState } from 'react';
import { GLYPHS } from '../music/glyphs';
import { layoutSteps, type Clef, type StaffMode, type LItem, type Beam } from '../music/layout';
import type { Step } from '../music/steps';
import type { StepState } from './StepStrip';

const SP = 10; // 오선 한 칸 px
const K = SP / 250; // 글꼴 단위 → px
const HEAD = 295 * K; // 음표 머리 너비
const TOP = 38; // 높은음자리표 맨 윗줄 y
const GAP = 64; // 두 오선 사이

const COLOR: Partial<Record<StepState, string>> = { good: 'var(--good)', fixed: 'var(--warn)', early: 'var(--warn)', late: 'var(--warn)', wrong: 'var(--bad)', miss: 'var(--bad)' };

function G({ name, x, y, fill }: { name: string; x: number; y: number; fill?: string }) {
  const g = GLYPHS[name];
  if (!g) return null;
  return <path d={g.d} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${K})`} fill={fill ?? 'currentColor'} />;
}

type Sys = { from: number; to: number; x0: number; first: boolean };

/**
 * 큰보표(또는 한 오선) 악보. 지금 칸은 주황, 채점한 칸은 결과 색.
 * wrap 이면 화면 폭에 맞춰 여러 줄(태블릿에서 곡 전체가 한눈에), 아니면 한 줄로 가로 스크롤.
 */
export function Staff({ steps, beats = 4, timeNum, timeDen = 4, mode = 'grand', cur = -1, states = [], fingers = false, total, highlight, testid = 'staff', bare = false, wrap = false, barOffset = 0, chords, fifths = 0 }: {
  /** 조표 (#=+, b=−) */
  fifths?: number;
  /** 악보 위 코드 이름 */
  chords?: { beat: number; name: string }[];
  steps: Step[]; beats?: number; timeNum?: number; timeDen?: number; mode?: StaffMode; cur?: number; states?: StepState[]; fingers?: boolean; total?: number;
  highlight?: (step: number) => string | undefined; testid?: string;
  /** 음표 읽기용: 박자표·쉼표 없이 음만 */
  bare?: boolean;
  /** 화면 폭에 맞춰 줄 바꿈 */
  wrap?: boolean;
  /** 마디 번호 더하기 (구간 연습일 때 원래 번호) */
  barOffset?: number;
}) {
  // 6/8·9/8·12/8 은 점4분음표마다 빔
  const unit = timeDen === 8 && (timeNum ?? 0) % 3 === 0 ? 1.5 : 1;
  const lay = useMemo(() => layoutSteps(steps, beats, mode, total, fifths, unit), [steps, beats, mode, total, fifths, unit]);
  const nAcc = Math.min(7, Math.abs(fifths));
  const KS = nAcc * 9; // 조표 너비
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const b = box.current;
    if (!b || !wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxW(b.clientWidth));
    ro.observe(b);
    setBoxW(b.clientWidth);
    return () => ro.disconnect();
  }, [wrap]);
  const T0 = TOP + (chords?.length ? 16 : 0); // 코드 이름 자리
  const top = (c: Clef) => (lay.staves.length === 2 && c === 'bass' ? T0 + 4 * SP + GAP : T0);
  const height = top(lay.staves[lay.staves.length - 1]) + 4 * SP + 40;
  const num = timeNum ?? beats;
  const HEAD_X = (bare ? 84 : 92) + KS; // 첫 줄 머리(자리표+박자표) 너비
  const HEAD_X2 = 56 + KS; // 다음 줄 머리(자리표 + 조표)

  // 박 → x (한 줄로 늘어놓았을 때)
  const { xs, width, barList } = useMemo(() => {
    const xs = new Map<number, number>();
    const barSet = new Set(lay.bars);
    let x = HEAD_X;
    const barList: { beat: number; x: number }[] = [];
    const onsets = lay.onsets;
    onsets.forEach((b, i) => {
      if (barSet.has(b)) { barList.push({ beat: b, x: x - 6 }); x += 12; }
      const hasAcc = lay.items.some((it) => it.beat === b && it.kind === 'chord' && it.notes.some((n) => n.acc));
      if (hasAcc) x += 10;
      xs.set(b, x);
      const next = onsets[i + 1] ?? lay.total;
      x += bare ? 44 : 16 + 26 * Math.pow(Math.max(0.25, next - b), 0.62);
    });
    return { xs, width: x + (bare ? 0 : 14), barList };
  }, [lay, bare, HEAD_X]);

  // 줄 나누기: 마디 경계에서, 폭을 넘으면 다음 줄
  const systems: Sys[] = useMemo(() => {
    // 휴대폰처럼 좁으면(600px 미만) 한 줄로 가로 스크롤
    if (!wrap || boxW < 600 || width <= boxW) return [{ from: 0, to: lay.total, x0: 0, first: true }];
    const out: Sys[] = [];
    let from = 0, startX = 0, first = true;
    const ends = [...barList, { beat: lay.total, x: width - 14 }];
    let lastFit: { beat: number; x: number } | null = null;
    for (const b of ends) {
      const head = first ? 0 : HEAD_X2 - 12;
      if (b.x - startX + head + 14 > boxW && lastFit) {
        out.push({ from, to: lastFit.beat, x0: startX, first });
        from = lastFit.beat; startX = lastFit.x; first = false; lastFit = null;
      }
      lastFit = b;
    }
    out.push({ from, to: lay.total, x0: startX, first });
    return out;
  }, [wrap, boxW, width, barList, lay.total, HEAD_X2]);

  const stepBeat = useMemo(() => {
    const m = new Map<number, number>();
    lay.items.forEach((it) => { if (it.kind === 'chord') it.notes.forEach((n) => { if (!m.has(n.step)) m.set(n.step, it.beat); }); });
    return m;
  }, [lay]);

  useEffect(() => {
    const b = box.current;
    if (!b || cur < 0) return;
    const beat = stepBeat.get(cur);
    if (beat === undefined) return;
    if (systems.length > 1) {
      const k = systems.findIndex((sy) => beat >= sy.from - 1e-6 && beat < sy.to - 1e-6);
      const el = b.querySelectorAll<SVGElement>('svg')[k];
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const x = xs.get(beat) ?? 0;
    const left = x - b.clientWidth * 0.3;
    if (Math.abs(b.scrollLeft - left) > b.clientWidth * 0.25 || x < b.scrollLeft || x > b.scrollLeft + b.clientWidth - 30) b.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [cur, stepBeat, xs, systems]);

  const colorOf = (step: number): string | undefined => highlight?.(step) ?? (step === cur ? 'var(--accent)' : COLOR[states[step] ?? 'todo']);
  const yTop = top(lay.staves[0]);
  const yBot = top(lay.staves[lay.staves.length - 1]) + 4 * SP;

  return (
    <div className={`staff-box${systems.length > 1 ? ' wrapped' : ''}`} ref={box} data-testid={testid}>
      {systems.map((sy, k) => {
        const shift = sy.first ? 0 : HEAD_X2 - sy.x0;
        const last = k === systems.length - 1;
        const w = sy.first && systems.length === 1 ? width : (last ? width - 14 : (barList.find((b) => b.beat === sy.to)?.x ?? width)) + shift + (last ? 14 : 2);
        const inRange = (b: number) => b >= sy.from - 1e-6 && b < sy.to - 1e-6;
        // 빔 묶음: 기둥 x, 빔 선 (살짝 기울게, 기둥은 2.5칸 이상)
        const geo = new Map<Beam, { sx: number[]; y: (x: number) => number }>();
        for (const bm of lay.beams) {
          if (!inRange(bm.items[0].beat)) continue;
          const t = top(bm.staff);
          const sx = bm.items.map((c) => (xs.get(c.beat) ?? 0) + shift + (bm.stemUp ? HEAD - 0.6 : 0.6));
          const ext = bm.items.map((c) => { const ys = c.notes.map((n) => t + n.y * SP); return bm.stemUp ? Math.min(...ys) : Math.max(...ys); });
          const dx = sx[sx.length - 1] - sx[0] || 1;
          const k = Math.max(-SP, Math.min(SP, ext[ext.length - 1] - ext[0])) / dx;
          const dir = bm.stemUp ? -1 : 1;
          let y0 = ext[0] + dir * 3.2 * SP;
          // 모든 기둥이 2.5칸 이상 되게 빔을 옮김
          bm.items.forEach((_, i) => {
            const need = ext[i] + dir * 2.5 * SP;
            const at = y0 + k * (sx[i] - sx[0]);
            if (bm.stemUp ? at > need : at < need) y0 += need - at;
          });
          geo.set(bm, { sx, y: (x) => y0 + k * (x - sx[0]) });
        }
        const tipOf = (it: LItem): number | undefined => {
          if (it.kind !== 'chord' || it.beam === undefined) return undefined;
          const bm = lay.beams[it.beam];
          const g = bm && geo.get(bm);
          if (!g) return undefined;
          return g.y(g.sx[bm.items.indexOf(it)]);
        };
        const barNo = Math.round(sy.from / beats) + 1 + barOffset;
        return (
          <svg key={k} width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="staff-svg" role="img" aria-label={`악보 ${barNo}마디부터`}>
            {lay.staves.flatMap((c) => [0, 1, 2, 3, 4].map((q) => <line key={`${c}${q}`} x1={12} x2={w - (last && !bare ? 4 : 1)} y1={top(c) + q * SP} y2={top(c) + q * SP} className="staff-line" />))}
            <line x1={12} x2={12} y1={yTop} y2={yBot} className="bar-line" />
            {lay.staves.length === 2 && <path d={`M9 ${yTop} Q1 ${(yTop + yBot) / 2} 9 ${yBot}`} className="brace" />}
            {!bare && (k > 0 || barOffset > 0) && <text x={14} y={yTop - 14} className="bar-no">{barNo}</text>}
            {lay.staves.map((c) => (
              <g key={c}>
                <G name={c === 'treble' ? 'gClef' : 'fClef'} x={18} y={top(c) + (c === 'treble' ? 3 : 1) * SP} />
                {keySig(c, fifths).map((y, i) => <G key={`k${i}`} name={fifths > 0 ? 'accidentalSharp' : 'accidentalFlat'} x={50 + i * 9} y={top(c) + y * SP} />)}
                {!bare && sy.first && <G name={`timeSig${num}`} x={56 + KS} y={top(c) + SP} />}
                {!bare && sy.first && <G name={`timeSig${timeDen}`} x={56 + KS} y={top(c) + 3 * SP} />}
              </g>
            ))}
            {barList.filter((b) => b.beat > sy.from + 1e-6 && b.beat < sy.to - 1e-6).map((b) => <line key={b.beat} x1={b.x + shift} x2={b.x + shift} y1={yTop} y2={yBot} className="bar-line" />)}
            {(() => {
              // 코드 이름이 겹치면 오른쪽으로 밀기
              let right = -Infinity;
              return chords?.filter((c) => inRange(c.beat)).map((c) => {
                const at = lay.onsets.find((o) => o >= c.beat - 1e-6) ?? c.beat;
                const x = Math.max((xs.get(at) ?? 0) + shift, right + 6);
                right = x + c.name.length * 8.6;
                return <text key={`c${c.beat}`} x={x} y={16} className="chord-sym" data-testid="chord-sym">{c.name}</text>;
              });
            })()}
            {!last && <line x1={w - 1} x2={w - 1} y1={yTop} y2={yBot} className="bar-line" />}
            {last && !bare && <line x1={w - 8} x2={w - 8} y1={yTop} y2={yBot} className="bar-line" />}
            {last && !bare && <line x1={w - 4} x2={w - 4} y1={yTop} y2={yBot} className="bar-line end" />}
            {lay.items.filter((it) => (!bare || it.kind === 'chord') && inRange(it.beat)).map((it, i) => <Item key={i} it={it} x={(xs.get(it.beat) ?? 0) + shift} tieX={it.kind === 'chord' && it.tieTo !== undefined ? (inRange(it.tieTo) ? (xs.get(it.tieTo) ?? 0) + shift : w - 2) : undefined} tip={tipOf(it)} top={top(it.staff)} colorOf={colorOf} fingers={fingers} />)}
            {[...geo.entries()].map(([bm, g], bi) => {
              const off = (bm.stemUp ? 1 : -1) * 0.75 * SP;
              const seg = (x1: number, x2: number, o: number, key: string) => <line key={key} x1={x1} x2={x2} y1={g.y(x1) + o} y2={g.y(x2) + o} className="beam" />;
              return (
                <g key={`b${bi}`} className="beams">
                  {seg(g.sx[0], g.sx[g.sx.length - 1], 0, 'p')}
                  {bm.sub.map(([a, b]) => seg(g.sx[a], g.sx[b], off, `s${a}`))}
                  {bm.stubs.map(({ i, dir }) => seg(g.sx[i], g.sx[i] + dir * 8, off, `t${i}`))}
                </g>
              );
            })}
          </svg>
        );
      })}
    </div>
  );
}

/** 조표 자리 (오선 맨 윗줄 0, 칸 단위) */
function keySig(c: Clef, fifths: number): number[] {
  const n = Math.min(7, Math.abs(fifths));
  // 높은음자리표 F5 C5 G5 D5 A4 E5 B4 / B4 E5 A4 D5 G4 C5 F4 (낮은음자리표는 같은 모양으로 한 칸 아래)
  const sharpT = [0, 1.5, -0.5, 1, 2.5, 0.5, 2], flatT = [2, 0.5, 2.5, 1, 3, 1.5, 3.5];
  const base = fifths > 0 ? sharpT : flatT;
  return base.slice(0, n).map((y) => y + (c === 'bass' ? 1 : 0));
}

function Item({ it, x, top, colorOf, fingers, tieX, tip }: { it: LItem; x: number; top: number; colorOf: (s: number) => string | undefined; fingers: boolean; tieX?: number; tip?: number }) {
  if (it.kind === 'rest') {
    const d = it.dur;
    if (d >= 4 || d === 3) return <G name="restWhole" x={x} y={top + SP} />;
    if (d >= 2) return <G name="restHalf" x={x} y={top + 2 * SP} />;
    if (d >= 1) return <G name="restQuarter" x={x} y={top + 2 * SP} />;
    if (d >= 0.5) return <G name="rest8th" x={x} y={top + 2 * SP} />;
    return <G name="rest16th" x={x} y={top + 2 * SP} />;
  }
  const d = it.dur;
  const head = d >= 4 ? 'noteheadWhole' : d >= 2 ? 'noteheadHalf' : 'noteheadBlack';
  const dotted = [3, 1.5, 0.75, 6].includes(d);
  const ys = it.notes.map((n) => top + n.y * SP);
  const yHi = Math.min(...ys), yLo = Math.max(...ys);
  const color = colorOf(it.notes[0].step);
  const sx = it.stemUp ? x + HEAD - 0.6 : x + 0.6;
  // 2도 화음은 머리를 옆으로
  const shift = it.notes.map((n, i) => (i > 0 && Math.abs(n.y - it.notes[i - 1].y) === 0.5 ? (it.stemUp ? HEAD : -HEAD) : 0));
  return (
    <g className="note" data-step={it.notes[0].step} data-midi={it.notes.map((n) => n.midi).join(",")} style={color ? { color } : undefined}>
      {it.ledgers.map((ly) => <line key={ly} x1={x - 4} x2={x + (d >= 4 ? 422 * K : HEAD) + 4} y1={top + ly * SP} y2={top + ly * SP} className="ledger" />)}
      {it.notes.map((n, i) => (
        <g key={i}>
          {n.acc && <G name={n.acc === 'sharp' ? 'accidentalSharp' : n.acc === 'flat' ? 'accidentalFlat' : 'accidentalNatural'} x={x - 11} y={top + n.y * SP} />}
          <G name={head} x={x + shift[i]} y={top + n.y * SP} />
          {dotted && <G name="augmentationDot" x={x + (d >= 4 ? 422 * K : HEAD) + 3} y={top + (Number.isInteger(n.y) ? n.y - 0.5 : n.y) * SP} />}
        </g>
      ))}
      {d < 4 && <line x1={sx} x2={sx} y1={it.stemUp ? yLo : yHi} y2={tip ?? (it.stemUp ? yHi - 3.4 * SP : yLo + 3.4 * SP)} className="stem" />}
      {d < 1 && tip === undefined && <G name={d < 0.4 ? (it.stemUp ? 'flag16thUp' : 'flag16thDown') : it.stemUp ? 'flag8thUp' : 'flag8thDown'} x={sx - 0.6} y={it.stemUp ? yHi - 3.4 * SP : yLo + 3.4 * SP} />}
      {tieX !== undefined && it.notes.map((n, i) => {
        const y = top + n.y * SP + (it.stemUp ? 7 : -7);
        const x1 = x + HEAD + 1, x2 = tieX - 1, bend = it.stemUp ? 6 : -6;
        return <path key={`t${i}`} d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y + bend} ${x2} ${y}`} className="tie" />;
      })}
      {fingers && !it.cont && it.notes.some((n) => n.finger) && (
        <text x={x + HEAD / 2} y={it.staff === 'treble' ? Math.min(top - 8, yHi - (it.stemUp ? 3.4 * SP + 6 : 8)) : Math.max(top + 4 * SP + 16, yLo + (it.stemUp ? 16 : 3.4 * SP + 14))} className="fingering" textAnchor="middle">
          {it.notes.filter((n) => n.finger).map((n) => n.finger).join(' ')}
        </text>
      )}
    </g>
  );
}

/** 음 하나(또는 화음 하나)를 크게 — 음표 읽기 퀴즈용 */
export function NoteCard({ steps, mode, highlight }: { steps: Step[]; mode: StaffMode; highlight?: (s: number) => string | undefined }) {
  return <div className="note-card"><Staff steps={steps} mode={mode} beats={4} total={4} highlight={highlight} testid="note-card" bare /></div>;
}
