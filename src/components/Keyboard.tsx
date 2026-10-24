import { useRef } from 'react';
import { isBlack, pc, label, noteName } from '../music/notes';
import { pressVirtual, releaseVirtual } from '../midi/input';
import { useHeld } from '../state/live';
import { useSettings } from '../state/settings';
import type { Hand } from '../music/steps';

export type KeyMark = { hand?: Hand; finger?: number; kind: 'now' | 'soon' | 'ok' | 'target' };
export type Flash = 'good' | 'bad';

/**
 * 화면 건반. 눌린 건반(피아노·화면 모두), 칠 건반(손 색 + 손가락 번호), 맞음/틀림 반짝임을 보여 줌.
 * 터치하면 그 음을 누른 것으로 (피아노가 없을 때).
 */
export function Keyboard({ lo, hi, marks, flash, interactive = true, compact = false }: {
  lo: number; hi: number; marks?: Map<number, KeyMark>; flash?: Map<number, Flash>; interactive?: boolean; compact?: boolean;
}) {
  const held = useHeld();
  const s = useSettings();
  const heldSet = new Set(held);
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) whites.push(m);
  const W = 100 / whites.length;
  const pointers = useRef(new Map<number, number>());

  const down = (m: number) => (ev: React.PointerEvent) => {
    if (!interactive) return;
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
    pointers.current.set(ev.pointerId, m);
    pressVirtual(m, 'screen');
  };
  const up = (ev: React.PointerEvent) => {
    const m = pointers.current.get(ev.pointerId);
    if (m === undefined) return;
    pointers.current.delete(ev.pointerId);
    if (![...pointers.current.values()].includes(m)) releaseVirtual(m, 'screen');
  };
  // 손가락을 미끄러뜨리면 옆 건반으로 (글리산도)
  const enter = (m: number) => (ev: React.PointerEvent) => {
    if (!interactive || ev.buttons === 0) return;
    const prev = pointers.current.get(ev.pointerId);
    if (prev === undefined || prev === m) return;
    pointers.current.set(ev.pointerId, m);
    if (![...pointers.current.values()].includes(prev)) releaseVirtual(prev, 'screen');
    pressVirtual(m, 'screen');
  };

  const keyClass = (m: number, black: boolean) => {
    const mk = marks?.get(m);
    const f = flash?.get(m);
    return [
      'key', black ? 'black' : 'white',
      heldSet.has(m) ? 'down' : '',
      mk ? `mk-${mk.kind}` : '', mk?.hand ? `hand-${mk.hand}` : '',
      f ? `fl-${f}` : '',
      m === 60 ? 'middle-c' : '',
    ].filter(Boolean).join(' ');
  };
  const nameOf = (m: number) => {
    if (s.allNames || pc(m) === 0) return s.labels === 'solfa' ? label(m, 'solfa') : noteName(m);
    return '';
  };

  return (
    <div className={`keyboard${compact ? ' compact' : ''}`} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} onContextMenu={(e) => e.preventDefault()} data-testid="keyboard">
      {whites.map((m, i) => {
        const mk = marks?.get(m);
        return (
          <div key={m} className={keyClass(m, false)} style={{ left: `${i * W}%`, width: `${W}%` }} onPointerDown={down(m)} onPointerEnter={enter(m)} data-midi={m} data-testid={`key-${m}`} aria-label={noteName(m)} role="button">
            {mk?.finger && s.fingers ? <span className="finger">{mk.finger}</span> : null}
            <span className="kname">{nameOf(m)}{pc(m) === 0 && s.labels === 'solfa' && !compact ? <small>{noteName(m).slice(1)}</small> : null}</span>
          </div>
        );
      })}
      {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k).filter(isBlack).map((m) => {
        const i = whites.findIndex((w) => w > m); // 오른쪽 흰 건반 자리
        const mk = marks?.get(m);
        return (
          <div key={m} className={keyClass(m, true)} style={{ left: `${i * W - W * 0.3}%`, width: `${W * 0.6}%` }} onPointerDown={down(m)} onPointerEnter={enter(m)} data-midi={m} data-testid={`key-${m}`} aria-label={noteName(m)} role="button">
            {mk?.finger && s.fingers ? <span className="finger">{mk.finger}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
