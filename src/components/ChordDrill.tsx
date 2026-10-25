import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type KeyMark } from './Keyboard';
import { useFlash } from './useFlash';
import { onInput, heldNotes } from '../midi/input';
import { parseChord, matchChord, voicing, rhFingers, bassNote, type Chord } from '../music/chordbook';
import { metronome } from '../audio/metronome';
import { resumeAudio } from '../audio/context';
import { piano } from '../audio/piano';
import { perfToAudio } from '../audio/metronome';
import { addRun } from '../data/db';
import { localDate } from '../data/dates';
import { useSettings } from '../state/settings';
import type { Mode } from '../lessons/lessons';

type Phase = 'ready' | 'countin' | 'playing' | 'result';
type Res = { mode: Mode; score: number; times: number[]; wrong: number; good: number; late: number; miss: number };

/**
 * 코드 바꾸기 연습: 진행을 몇 바퀴 돌며 코드를 누름.
 * 기다려 주기 = 맞게 누를 때까지 (걸린 시간), 박자 맞춰 = 코드마다 n박, 바뀌는 박에 맞춰 누르기
 * 자리바꿈은 아무거나 괜찮고(베이스 음도 허용), 화면에는 가까운 자리를 추천
 */
export function ChordDrill({ id, lessonId, chords, rounds = 2, beatsPerChord = 4, bpm: bpm0 = 60, modes = ['wait', 'timed'], onDone }: {
  id: string; lessonId: string; chords: string[]; rounds?: number; beatsPerChord?: number; bpm?: number; modes?: Mode[]; onDone?: () => void;
}) {
  const s = useSettings();
  const seq: Chord[] = useMemo(() => Array.from({ length: rounds }, () => chords).flat().map((c) => parseChord(c)!).filter(Boolean), [chords, rounds]);
  const voicings = useMemo(() => { let prev: number[] | undefined; return seq.map((c) => { const v = voicing(c, prev); prev = v; return v; }); }, [seq]);
  const [mode, setMode] = useState<Mode>(modes[0]);
  const [bpm, setBpm] = useState(bpm0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const [hints, setHints] = useState(true);
  const [res, setRes] = useState<Res | null>(null);
  const [okNow, setOkNow] = useState(false);
  const [flash, doFlash] = useFlash();
  const st = useRef({ shownAt: 0, times: [] as number[], wrong: 0, t0: 0, hits: [] as (number | null)[], raf: 0, unsub: null as null | (() => void) });

  const stop = useCallback(() => { cancelAnimationFrame(st.current.raf); metronome.stop(); st.current.unsub?.(); st.current.unsub = null; setCount(null); }, []);
  useEffect(() => stop, [stop]);

  const finish = useCallback((r: Res) => {
    stop(); setRes(r); setPhase('result');
    const avg = r.times.length ? r.times.reduce((a, b) => a + b, 0) / r.times.length : 0;
    void addRun({ exId: id, lessonId, date: localDate(), ts: Date.now(), mode: r.mode, hands: 'B', bpm: r.mode === 'timed' ? bpm : null, score: r.score, passed: r.score >= 80 && (r.mode === 'timed' || !modes.includes('timed')), seconds: Math.round(r.times.reduce((a, b) => a + b, 0) / 1000), detail: r.mode === 'wait' ? `코드 ${seq.length}개 · 평균 ${(avg / 1000).toFixed(1)}초 · 틀린 음 ${r.wrong}` : `코드 ${seq.length}개 · 제때 ${r.good} · 늦게 ${r.late} · 놓침 ${r.miss}` });
  }, [stop, id, lessonId, bpm, seq.length, modes]);

  const startWait = () => { stop(); setRes(null); setIdx(0); setOkNow(false); st.current.times = []; st.current.wrong = 0; st.current.shownAt = performance.now(); setPhase('playing'); };
  const startTimed = async () => {
    stop(); await resumeAudio(); setRes(null); setIdx(0); setOkNow(false);
    metronome.volume = s.clickVolume;
    const first = await metronome.start({ bpm, beats: beatsPerChord });
    const spb = 60000 / bpm, span = spb * beatsPerChord;
    const t0 = first + beatsPerChord * spb + s.latencyMs;
    st.current.t0 = t0; st.current.hits = seq.map(() => null); st.current.wrong = 0; st.current.times = [];
    (window as unknown as { __pianoT0?: number }).__pianoT0 = t0;
    setPhase('countin');
    st.current.unsub = metronome.onTick((t) => setCount(t.index < beatsPerChord ? beatsPerChord - t.index : null));
    const loop = () => {
      const now = performance.now();
      const k = Math.floor((now - t0 + 250) / span); // 바뀌기 0.25초 전부터 다음 코드로 봄
      if (now >= t0 - 250) setPhase('playing');
      const ki = Math.max(0, Math.min(seq.length - 1, k));
      setIdx(ki);
      if (k >= 0 && k < seq.length && st.current.hits[k] === null && matchChord(heldNotes(), seq[k]) === 'ok') st.current.hits[k] = now - (t0 + k * span);
      if (now > t0 + seq.length * span + 200) {
        const hits = st.current.hits;
        const good = hits.filter((h) => h !== null && h <= 250).length;
        const late = hits.filter((h) => h !== null && h > 250).length;
        const miss = hits.filter((h) => h === null).length;
        const score = Math.max(0, Math.round((100 * (good + 0.5 * late)) / seq.length - Math.min(20, st.current.wrong * 2)));
        finish({ mode: 'timed', score, times: hits.filter((h): h is number => h !== null).map((h) => Math.max(0, h)), wrong: st.current.wrong, good, late, miss });
        return;
      }
      st.current.raf = requestAnimationFrame(loop);
    };
    st.current.raf = requestAnimationFrame(loop);
  };

  useEffect(() => { if (mode === 'wait') startWait(); else { stop(); setPhase('ready'); setIdx(0); setRes(null); } }, [mode, seq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => onInput((e) => {
    if (e.kind === 'pedal' || phase !== 'playing') return;
    const c = seq[idx];
    if (!c) return;
    if (e.kind === 'on' && !c.pcs.includes(e.note % 12) && c.bass !== e.note % 12) { st.current.wrong++; doFlash(e.note, 'bad'); }
    if (mode !== 'wait') return;
    const m = matchChord(heldNotes(), c);
    setOkNow(m === 'ok');
    if (m === 'ok' && e.kind === 'on') {
      st.current.times.push(e.time - st.current.shownAt);
      heldNotes().forEach((n) => doFlash(n, 'good'));
      const next = idx + 1;
      if (next >= seq.length) {
        const t = st.current.times;
        const avg = t.reduce((a, b) => a + b, 0) / t.length;
        // 평균 2초 안이면 100점, 느릴수록·틀릴수록 깎음
        const score = Math.max(0, Math.round(100 - Math.max(0, avg - 2000) / 60 - st.current.wrong * 3));
        finish({ mode: 'wait', score, times: t, wrong: st.current.wrong, good: seq.length, late: 0, miss: 0 });
      } else { setIdx(next); st.current.shownAt = e.time; setOkNow(false); }
    }
  }), [phase, idx, seq, mode, doFlash, finish]);

  const listen = async () => {
    await resumeAudio();
    const spb = 60000 / bpm, t0 = performance.now() + 200;
    seq.slice(0, chords.length).forEach((c, i) => {
      const at = perfToAudio(t0 + i * spb * 2);
      piano.schedule(bassNote(c), 70, at, (spb * 2) / 1000 - 0.05);
      voicings[i].forEach((m) => piano.schedule(m, 80, at, (spb * 2) / 1000 - 0.05));
    });
  };

  const c = seq[idx];
  const v = voicings[idx] ?? [];
  const marks = new Map<number, KeyMark>();
  if (c && hints && phase !== 'result') {
    const f = rhFingers(v);
    v.forEach((m, i) => marks.set(m, { hand: 'R', finger: f[i], kind: okNow ? 'ok' : 'now' }));
    marks.set(bassNote(c), { hand: 'L', finger: 5, kind: okNow ? 'ok' : 'now' });
  }
  const running = phase === 'countin' || (phase === 'playing' && mode === 'timed');
  const next = seq[idx + 1];

  return (
    <div className="runner">
      <div className="card controls">
        {modes.length > 1 && (
          <div className="segmented" role="group" aria-label="연습 방법">
            <button className={mode === 'wait' ? 'on' : ''} onClick={() => setMode('wait')} disabled={running} data-testid="cd-wait">기다려 주기</button>
            <button className={mode === 'timed' ? 'on' : ''} onClick={() => setMode('timed')} disabled={running} data-testid="cd-timed">박자 맞춰</button>
          </div>
        )}
        <div className="row-setting">
          {mode === 'timed' && <><span className="muted small">템포</span><button className="mini" onClick={() => setBpm(Math.max(30, bpm - 4))} disabled={running}>−</button><b className="bpm-num">♩{bpm}</b><button className="mini" onClick={() => setBpm(bpm + 4)} disabled={running}>+</button><span className="muted small">코드마다 {beatsPerChord}박</span></>}
          <span className="grow" />
          <label className="row-setting small"><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} />자리 보기</label>
          <button className="secondary" onClick={listen} disabled={running}>▶ 들어 보기</button>
        </div>
        {mode === 'timed' && phase !== 'result' && (running
          ? <button className="primary wide stop" onClick={() => { stop(); setPhase('ready'); }}>■ 멈추기</button>
          : <button className="primary wide" onClick={startTimed} data-testid="cd-start">시작 (한 마디 세고)</button>)}
      </div>
      {count !== null && <div className="countin">{count}</div>}
      {phase !== 'result' && c && (
        <div className={`card chord-now${okNow ? ' ok' : ''}`}>
          <div className="chord-big" data-testid="chord-now">{c.name}</div>
          <div className="muted small">{idx + 1} / {seq.length}{next ? <> · 다음 <b>{next.name}</b></> : ''}</div>
          <div className="chord-progress">{seq.map((x, i) => <span key={i} className={i < idx ? 'done' : i === idx ? 'cur' : ''}>{x.name}</span>)}</div>
        </div>
      )}
      <div className="kb-scroll"><Keyboard lo={36} hi={84} marks={marks} flash={flash} /></div>
      {res && phase === 'result' && (
        <div className={`card result ${res.score >= 80 ? 'pass' : ''}`} data-testid="result">
          <div className="result-head">
            <div className="score-big" data-testid="score">{res.score}<small>점</small></div>
            <div>
              <b>{res.score >= 80 ? '좋아요!' : '조금 더'}</b>
              <p className="hint">{res.mode === 'wait'
                ? `코드 하나에 평균 ${(res.times.reduce((a, b) => a + b, 0) / Math.max(1, res.times.length) / 1000).toFixed(1)}초 · 틀린 음 ${res.wrong}번. 2초 안에 바꾸면 박자 맞춰로!`
                : `제때 ${res.good} · 늦게 ${res.late} · 놓침 ${res.miss} · 틀린 음 ${res.wrong}`}</p>
            </div>
          </div>
          <div className="row">
            <button className="secondary" onClick={() => (mode === 'wait' ? startWait() : startTimed())} data-testid="again">다시 하기</button>
            {modes.includes('timed') && mode === 'wait' && <button className="primary" onClick={() => setMode('timed')}>박자 맞춰 하기</button>}
            {onDone && <button className="secondary" onClick={onDone}>다음</button>}
          </div>
        </div>
      )}
    </div>
  );
}
