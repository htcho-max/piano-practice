import { useEffect, useRef } from 'react';
import type { Step } from '../music/steps';
import { label } from '../music/notes';
import { useSettings } from '../state/settings';

export type StepState = 'todo' | 'good' | 'fixed' | 'wrong' | 'early' | 'late' | 'miss';
const MARK: Partial<Record<StepState, string>> = { early: '◀', late: '▶', miss: '✕', wrong: '!' };

/**
 * 칠 음들을 왼쪽에서 오른쪽으로 (칸 너비 = 길이). 위 줄 오른손, 아래 줄 왼손.
 * 지금 칸은 테두리, 지난 칸은 결과 색.
 */
export function StepStrip({ steps, cur, states, beats = 4 }: { steps: Step[]; cur: number; states: StepState[]; beats?: number }) {
  const s = useSettings();
  const box = useRef<HTMLDivElement>(null);
  const two = steps.some((st) => st.notes.some((n) => n.hand === 'L')) && steps.some((st) => st.notes.some((n) => n.hand === 'R'));

  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('.step.cur');
    const b = box.current;
    if (!el || !b) return;
    const left = el.offsetLeft - b.clientWidth * 0.3;
    b.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [cur]);

  let bar = 0;
  return (
    <div className="strip" ref={box} data-testid="strip">
      {steps.map((st, i) => {
        const state = states[i] ?? 'todo';
        const newBar = Math.floor(st.beat / beats + 1e-6) !== bar || i === 0;
        bar = Math.floor(st.beat / beats + 1e-6);
        const r = st.notes.filter((n) => n.hand === 'R');
        const l = st.notes.filter((n) => n.hand === 'L');
        const cell = (ns: typeof r) => ns.length ? ns.map((n) => (
          <span key={n.midi} className={`sn hand-${n.hand}`}>{label(n.midi, s.labels)}{n.finger && s.fingers ? <sup>{n.finger}</sup> : null}</span>
        )) : <span className="sn empty" />;
        return (
          <div key={i} className={`step st-${state}${i === cur ? ' cur' : ''}${newBar && i > 0 ? ' barline' : ''}${st.notes.length === 0 ? ' rest' : ''}`} style={{ minWidth: `${Math.max(40, 46 * st.dur)}px` }} data-testid={`step-${i}`} data-state={state}>
            {st.notes.length === 0 ? <span className="sn rest-mark">쉼</span> : two ? <>{<div className="sr">{cell(r)}</div>}<div className="sl">{cell(l)}</div></> : cell(st.notes)}
            <span className="dur">{durName(st.dur)}</span>
            {MARK[state] && <span className="vmark">{MARK[state]}</span>}
          </div>
        );
      })}
    </div>
  );
}

function durName(d: number): string {
  return ({ 4: '온', 3: '2.', 2: '2', 1.5: '4.', 1: '4', 0.75: '8.', 0.5: '8', 0.25: '16' } as Record<number, string>)[d] ?? String(d);
}
