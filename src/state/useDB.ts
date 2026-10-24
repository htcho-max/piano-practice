import { useEffect, useState, useSyncExternalStore } from 'react';
import { db, subscribeDB, dbVersion, type Run, type Day } from '../data/db';

/** DB 가 바뀌면 다시 읽는 훅 */
export function useQuery<T>(fn: () => Promise<T>, init: T): T {
  const v = useSyncExternalStore(subscribeDB, dbVersion);
  const [val, setVal] = useState<T>(init);
  useEffect(() => { let alive = true; fn().then((x) => { if (alive) setVal(x); }).catch(() => {}); return () => { alive = false; }; }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return val;
}

export function useRuns(): Run[] { return useQuery(() => db.runs.orderBy('ts').toArray(), [] as Run[]); }
export function useDays(): Day[] { return useQuery(() => db.days.orderBy('date').toArray(), [] as Day[]); }
