import { useEffect, useMemo, useRef } from 'react';
import { isBlack } from '../music/notes';
import type { Step } from '../music/steps';

/** 건반 위치 (Keyboard 와 같은 계산): 왼쪽·너비 % */
export function keyBox(m: number, lo: number, hi: number): { left: number; width: number } {
  const whites: number[] = [];
  for (let k = lo; k <= hi; k++) if (!isBlack(k)) whites.push(k);
  const W = 100 / whites.length;
  if (!isBlack(m)) return { left: whites.indexOf(m) * W, width: W };
  const i = whites.findIndex((w) => w > m);
  return { left: i * W - W * 0.3, width: W * 0.6 };
}

const PPB = 56; // 1박 = 56px

/**
 * 떨어지는 건반: 음이 위에서 내려와 아래 선(건반 윗면)에 닿을 때 치기.
 * clock() = 지금 박 (React 다시 그리기 없이 rAF 로 움직임). 기다려 주기에서는 지금 칸 박으로 부드럽게 따라감.
 */
export function Roll({ steps, lo, hi, clock, minWidth, height = 240 }: { steps: Step[]; lo: number; hi: number; clock: () => number; minWidth: number; height?: number }) {
  const inner = useRef<HTMLDivElement>(null);
  const notes = useMemo(() => steps.flatMap((s, i) => s.notes.filter((n) => n.midi >= lo && n.midi <= hi).map((n) => ({ ...n, beat: s.beat, len: n.len ?? s.dur, step: i }))), [steps, lo, hi]);
  useEffect(() => {
    let raf = 0;
    let shown = clock();
    const tick = () => {
      const target = clock();
      // 크게 뛰면(처음·되감기) 바로, 아니면 부드럽게
      shown = Math.abs(target - shown) > 8 ? target : shown + (target - shown) * 0.25;
      if (inner.current) inner.current.style.transform = `translateY(${(shown * PPB).toFixed(1)}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock]);
  return (
    <div className="roll" style={{ height, minWidth }} data-testid="roll">
      {/* 흰 건반 경계 안내선 */}
      <div className="roll-inner" ref={inner} style={{ top: height }}>
        {notes.map((n, k) => {
          const b = keyBox(n.midi, lo, hi);
          return (
            <div key={k} className={`rn hand-${n.hand}${isBlack(n.midi) ? ' blk' : ''}`} data-step={n.step}
              style={{ left: `${b.left}%`, width: `${b.width}%`, top: -(n.beat + n.len) * PPB + 1, height: Math.max(6, n.len * PPB - 3) }}>
              {n.finger ? <span>{n.finger}</span> : null}
            </div>
          );
        })}
      </div>
      <div className="roll-hit" />
    </div>
  );
}
