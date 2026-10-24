import { useCallback, useEffect, useRef, useState } from 'react';
import type { Flash } from './Keyboard';

/** 건반 반짝임 (맞음 초록 / 틀림 빨강, 0.3초) */
export function useFlash(): [Map<number, Flash>, (note: number, f: Flash) => void] {
  const [map, setMap] = useState<Map<number, Flash>>(new Map());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const flash = useCallback((note: number, f: Flash) => {
    setMap((m) => new Map(m).set(note, f));
    const old = timers.current.get(note);
    if (old) clearTimeout(old);
    timers.current.set(note, setTimeout(() => {
      timers.current.delete(note);
      setMap((m) => { const n = new Map(m); n.delete(note); return n; });
    }, 320));
  }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  return [map, flash];
}
