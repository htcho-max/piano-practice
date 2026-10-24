import { useEffect, useMemo, useRef } from 'react';
import { GLYPHS } from '../music/glyphs';
import { layoutSteps, type Clef, type StaffMode, type LItem } from '../music/layout';
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

/**
 * 큰보표(또는 한 오선) 악보. 지금 칸은 주황, 채점한 칸은 결과 색.
 * 넓으면 가로로 스크롤하고, 지금 칸을 따라감.
 */
export function Staff({ steps, beats = 4, mode = 'grand', cur = -1, states = [], fingers = false, total, highlight, testid = 'staff', bare = false }: {
  steps: Step[]; beats?: number; mode?: StaffMode; cur?: number; states?: StepState[]; fingers?: boolean; total?: number;
  highlight?: (step: number) => string | undefined; testid?: string;
  /** 음표 읽기용: 박자표·쉼표 없이 음만 */
  bare?: boolean;
}) {
  const lay = useMemo(() => layoutSteps(steps, beats, mode, total), [steps, beats, mode, total]);
  const box = useRef<HTMLDivElement>(null);
  const top = (c: Clef) => (lay.staves.length === 2 && c === 'bass' ? TOP + 4 * SP + GAP : TOP);
  const height = top(lay.staves[lay.staves.length - 1]) + 4 * SP + 40;

  // 박 → x
  const { xOf, width, barX } = useMemo(() => {
    const xs = new Map<number, number>();
    const barSet = new Set(lay.bars);
    let x = bare ? 84 : 84;
    const barX: number[] = [];
    const onsets = lay.onsets;
    onsets.forEach((b, i) => {
      if (barSet.has(b)) { barX.push(x - 6); x += 12; }
      const hasAcc = lay.items.some((it) => it.beat === b && it.kind === 'chord' && it.notes.some((n) => n.acc));
      if (hasAcc) x += 10;
      xs.set(b, x);
      const next = onsets[i + 1] ?? lay.total;
      x += bare ? 44 : 16 + 26 * Math.pow(Math.max(0.25, next - b), 0.62);
    });
    return { xOf: (b: number) => xs.get(b) ?? 0, width: x + (bare ? 0 : 14), barX };
  }, [lay, bare]);

  const stepX = useMemo(() => {
    const m = new Map<number, number>();
    lay.items.forEach((it) => { if (it.kind === 'chord') it.notes.forEach((n) => { if (!m.has(n.step)) m.set(n.step, xOf(it.beat)); }); });
    return m;
  }, [lay, xOf]);

  useEffect(() => {
    const b = box.current;
    if (!b || cur < 0) return;
    const x = stepX.get(cur);
    if (x === undefined) return;
    const left = x - b.clientWidth * 0.3;
    if (Math.abs(b.scrollLeft - left) > b.clientWidth * 0.25 || x < b.scrollLeft || x > b.scrollLeft + b.clientWidth - 30) b.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [cur, stepX]);

  const colorOf = (step: number): string | undefined => highlight?.(step) ?? (step === cur ? 'var(--accent)' : COLOR[states[step] ?? 'todo']);

  const lines = lay.staves.flatMap((c) => [0, 1, 2, 3, 4].map((k) => <line key={`${c}${k}`} x1={12} x2={width - 4} y1={top(c) + k * SP} y2={top(c) + k * SP} className="staff-line" />));
  const yTop = top(lay.staves[0]);
  const yBot = top(lay.staves[lay.staves.length - 1]) + 4 * SP;

  return (
    <div className="staff-box" ref={box} data-testid={testid}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="staff-svg" role="img" aria-label="악보">
        {lines}
        <line x1={12} x2={12} y1={yTop} y2={yBot} className="bar-line" />
        {lay.staves.length === 2 && <path d={`M9 ${yTop} Q1 ${(yTop + yBot) / 2} 9 ${yBot}`} className="brace" />}
        {lay.staves.map((c) => (
          <g key={c}>
            <G name={c === 'treble' ? 'gClef' : 'fClef'} x={18} y={top(c) + (c === 'treble' ? 3 : 1) * SP} />
            {!bare && <G name={`timeSig${beats}`} x={54} y={top(c) + SP} />}
            {!bare && <G name="timeSig4" x={54} y={top(c) + 3 * SP} />}
          </g>
        ))}
        {barX.map((x) => <line key={x} x1={x} x2={x} y1={yTop} y2={yBot} className="bar-line" />)}
        {!bare && <line x1={width - 8} x2={width - 8} y1={yTop} y2={yBot} className="bar-line" />}
        {!bare && <line x1={width - 4} x2={width - 4} y1={yTop} y2={yBot} className="bar-line end" />}
        {lay.items.filter((it) => !bare || it.kind === 'chord').map((it, i) => <Item key={i} it={it} x={xOf(it.beat)} top={top(it.staff)} colorOf={colorOf} fingers={fingers} />)}
      </svg>
    </div>
  );
}

function Item({ it, x, top, colorOf, fingers }: { it: LItem; x: number; top: number; colorOf: (s: number) => string | undefined; fingers: boolean }) {
  if (it.kind === 'rest') {
    const d = it.dur;
    if (d >= 4 || d === 3) return <G name="restWhole" x={x} y={top + SP} />;
    if (d >= 2) return <G name="restHalf" x={x} y={top + 2 * SP} />;
    if (d >= 1) return <G name="restQuarter" x={x} y={top + 2 * SP} />;
    return <G name="rest8th" x={x} y={top + 2 * SP} />;
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
      {d < 4 && <line x1={sx} x2={sx} y1={it.stemUp ? yLo : yHi} y2={it.stemUp ? yHi - 3.4 * SP : yLo + 3.4 * SP} className="stem" />}
      {d < 1 && <G name={it.stemUp ? 'flag8thUp' : 'flag8thDown'} x={sx - 0.6} y={it.stemUp ? yHi - 3.4 * SP : yLo + 3.4 * SP} />}
      {fingers && it.notes.some((n) => n.finger) && (
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
