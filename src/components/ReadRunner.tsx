import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type KeyMark } from './Keyboard';
import { NoteCard } from './Staff';
import { useFlash } from './useFlash';
import { onInput } from '../midi/input';
import { findLevel, pickNote, updateStat, readScore, READ_PASS, type ReadNote, type ReadStats } from '../practice/reading';
import { fitRange, label, noteName } from '../music/notes';
import { addRun, getKV, setKV } from '../data/db';
import { localDate } from '../data/dates';
import type { Step } from '../music/steps';
import type { Lesson } from '../lessons/lessons';
import { useSettings } from '../state/settings';

const STATS_KEY = 'read-stats';

/** 음표 읽기: 오선의 음을 보고 그 건반을 누름 (옥타브까지) */
export function ReadRunner({ levelId, count = 20, exId, lesson, onDone }: { levelId: string; count?: number; exId?: string; lesson?: Lesson; onDone?: () => void }) {
  const level = findLevel(levelId)!;
  const s = useSettings();
  const [stats, setStats] = useState<ReadStats | null>(null);
  const [q, setQ] = useState<ReadNote | null>(null);
  const [n, setN] = useState(0); // 푼 문제 수
  const [first, setFirst] = useState(0); // 한 번에 맞힌 수
  const [missed, setMissed] = useState(false); // 지금 문제를 한 번 틀렸나
  const [state, setState] = useState<'ask' | 'right' | 'done'>('ask');
  const [names, setNames] = useState<'c' | 'none'>('c');
  const [flash, doFlash] = useFlash();
  const st = useRef({ asked: 0, times: [] as number[], busy: false, prev: null as string | null, start: 0 });
  const range = useMemo(() => fitRange(level.pool.map((p) => p.midi), 15), [level]);

  useEffect(() => { let alive = true; getKV<ReadStats>(STATS_KEY, {}).then((x) => { if (alive) { setStats(x); next(x); } }); return () => { alive = false; }; }, [levelId]); // eslint-disable-line react-hooks/exhaustive-deps

  function next(sts: ReadStats) {
    const p = pickNote(level.pool, sts, st.current.prev);
    st.current.prev = p.key;
    st.current.asked = performance.now();
    if (!st.current.start) st.current.start = st.current.asked;
    setQ(p); setMissed(false); setState('ask');
  }

  useEffect(() => onInput((e) => {
    if (e.kind !== 'on' || !q || !stats || state === 'done' || st.current.busy) return;
    const ms = e.time - st.current.asked;
    if (e.note === q.midi) {
      doFlash(e.note, 'good');
      const sts = updateStat(stats, q.key, missed, ms);
      setStats(sts);
      st.current.times.push(Math.max(0, ms));
      const done = n + 1;
      const firstNow = first + (missed ? 0 : 1);
      setN(done); setFirst(firstNow); setState('right');
      st.current.busy = true;
      setTimeout(() => {
        st.current.busy = false;
        if (done >= count) {
          setState('done');
          void setKV(STATS_KEY, sts);
          const avg = st.current.times.reduce((a, b) => a + b, 0) / st.current.times.length;
          const score = readScore(firstNow, done, avg);
          void addRun({ exId: exId ?? `read-${level.id}`, lessonId: lesson?.id ?? 'read', date: localDate(), ts: Date.now(), mode: 'read', hands: 'B', bpm: null, score, passed: score >= READ_PASS, seconds: Math.round((performance.now() - st.current.start) / 1000), detail: `${level.title} · 한 번에 ${firstNow}/${done} · 평균 ${(avg / 1000).toFixed(1)}초` });
        } else next(sts);
      }, missed ? 600 : 280);
    } else {
      doFlash(e.note, 'bad');
      if (!missed) { setMissed(true); setStats(updateStat(stats, q.key, true, ms)); }
    }
  }), [q, stats, state, missed, n, first, count, level, exId, lesson, doFlash]);

  const restart = () => { st.current = { asked: 0, times: [], busy: false, prev: null, start: 0 }; setN(0); setFirst(0); if (stats) next(stats); };

  const steps: Step[] = q ? [{ beat: 0, dur: 4, notes: [{ midi: q.midi, spell: q.spell, hand: level.mode === 'bass' || (level.mode === 'grand' && q.midi < 60) ? 'L' : 'R' }] }] : [];
  const marks = new Map<number, KeyMark>();
  if (q && missed) marks.set(q.midi, { kind: 'now', hand: steps[0]?.notes[0].hand });
  if (q && state === 'right') marks.set(q.midi, { kind: 'ok' });

  if (state === 'done') {
    const avg = st.current.times.reduce((a, b) => a + b, 0) / Math.max(1, st.current.times.length);
    const score = readScore(first, n, avg);
    const weak = stats ? level.pool.map((p) => ({ p, s: stats[p.key] })).filter((x) => x.s && (x.s.err > 0.2 || x.s.ms > 3000)).sort((a, b) => b.s!.err - a.s!.err || b.s!.ms - a.s!.ms).slice(0, 3) : [];
    return (
      <div className={`card result ${score >= READ_PASS ? 'pass' : ''}`} data-testid="result">
        <div className="result-head">
          <div className="score-big" data-testid="score">{score}<small>점</small></div>
          <div><b>{score >= READ_PASS ? '통과!' : '조금 더'}</b><p className="hint">한 번에 맞힘 {first}/{n} · 평균 {(avg / 1000).toFixed(1)}초</p></div>
        </div>
        {weak.length > 0 && <p className="hint">더 볼 음: {weak.map((w) => `${label(w.p.midi, s.labels)}(${noteName(w.p.midi)})`).join(', ')} — 다음 퀴즈에서 더 자주 나와요.</p>}
        <div className="row"><button className="secondary" onClick={restart} data-testid="again">다시 하기</button>{onDone && <button className={score >= READ_PASS ? 'primary' : 'secondary'} onClick={onDone}>다음</button>}</div>
      </div>
    );
  }

  return (
    <div className="runner">
      <div className="card read-q">
        <div className="card-head"><span className="muted small">{level.title}</span><span className="muted small" data-testid="read-progress">{n + 1} / {count} · 한 번에 {first}</span></div>
        {q && <NoteCard steps={steps} mode={level.mode} highlight={() => (state === 'right' ? 'var(--good)' : missed ? 'var(--bad)' : undefined)} />}
        <p className="hint">{missed ? `정답은 ${label(q!.midi, s.labels)} (${noteName(q!.midi)}) — 파란 건반을 눌러요.` : '이 음을 피아노에서 눌러 보세요. 옥타브(높이)까지 맞아야 해요.'}</p>
      </div>
      <div className="segmented small">
        <button className={names === 'c' ? 'on' : ''} onClick={() => setNames('c')}>건반에 도만 표시</button>
        <button className={names === 'none' ? 'on' : ''} onClick={() => setNames('none')}>이름 없이</button>
      </div>
      <div className="kb-scroll"><Keyboard lo={range[0]} hi={range[1]} marks={marks} flash={flash} names={names} /></div>
    </div>
  );
}
