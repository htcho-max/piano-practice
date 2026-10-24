import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type KeyMark } from './Keyboard';
import { StepStrip, type StepState } from './StepStrip';
import { Staff } from './Staff';
import { useFlash } from './useFlash';
import { onInput } from '../midi/input';
import { metronome, perfToAudio } from '../audio/metronome';
import { piano } from '../audio/piano';
import { resumeAudio } from '../audio/context';
import { WaitGrader, TimedGrader, verdictLine, PASS_SCORE, type WaitResult, type TimedResult, type Verdict } from '../practice/grader';
import { allMidis, handsUsed, onlyHand, totalBeats, type Step, type Hand } from '../music/steps';
import { fitRange } from '../music/notes';
import type { Exercise, Lesson, Mode } from '../lessons/lessons';
import { addRun } from '../data/db';
import { localDate } from '../data/dates';
import { useSettings, setSettings } from '../state/settings';

type PlayEx = Extract<Exercise, { kind: 'play' }>;
type Phase = 'ready' | 'countin' | 'playing' | 'listening' | 'result';
type Hands = 'B' | Hand;

const bpmKey = (id: string) => `piano-bpm:${id}`;
function loadPref(k: string, d: string): string { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function savePref(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 무시 */ } }
function loadBpm(ex: PlayEx): number {
  try { const v = Number(localStorage.getItem(bpmKey(ex.id))); return v >= 30 && v <= 200 ? v : ex.bpm; } catch { return ex.bpm; }
}

export function PlayRunner({ ex, lesson, onDone }: { ex: PlayEx; lesson: Lesson; onDone?: () => void }) {
  const settings = useSettings();
  const used = handsUsed(ex.steps);
  const [mode, setMode] = useState<Mode>(ex.modes[0]);
  const [hands, setHands] = useState<Hands>('B');
  const [bpm, setBpmState] = useState(() => loadBpm(ex));
  const [phase, setPhase] = useState<Phase>('ready');
  const [cur, setCur] = useState(0); // 지금 칸
  const [hitNow, setHitNow] = useState<number[]>([]); // 기다려 주기: 지금 칸에서 누른 음
  const [states, setStates] = useState<StepState[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [result, setResult] = useState<WaitResult | TimedResult | null>(null);
  const [errors, setErrors] = useState(0);
  const [flash, doFlash] = useFlash();
  // 보기: 악보 / 이름 칸, 건반 힌트(칠 건반 색칠) — 연습마다 기억
  const [view, setViewState] = useState<'staff' | 'names'>(() => loadPref(`piano-view:${ex.id}`, ex.sheet ? 'staff' : 'names') as 'staff' | 'names');
  const [hints, setHintsState] = useState<boolean>(() => loadPref(`piano-hints:${ex.id}`, ex.sheet ? 'off' : 'on') === 'on');
  const setView = (v: 'staff' | 'names') => { setViewState(v); savePref(`piano-view:${ex.id}`, v); };
  const setHints = (v: boolean) => { setHintsState(v); savePref(`piano-hints:${ex.id}`, v ? 'on' : 'off'); };

  const steps: Step[] = useMemo(() => (hands === 'B' ? ex.steps : onlyHand(ex.steps, hands)), [ex, hands]);
  const range = useMemo(() => fitRange(allMidis(ex.steps), 15), [ex]);
  const wait = useRef<WaitGrader | null>(null);
  const timed = useRef<TimedGrader | null>(null);
  const raf = useRef(0);
  const unsubTick = useRef<(() => void) | null>(null);

  const setBpm = (v: number) => { const b = Math.max(30, Math.min(200, Math.round(v))); setBpmState(b); try { localStorage.setItem(bpmKey(ex.id), String(b)); } catch { /* 무시 */ } };

  const stopAll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    metronome.stop();
    unsubTick.current?.(); unsubTick.current = null;
    piano.allOff();
    setCount(null);
  }, []);

  /** 기다려 주기 시작 (바로 첫 음을 기다림) */
  const startWait = useCallback(() => {
    stopAll();
    wait.current = new WaitGrader(steps);
    timed.current = null;
    setCur(wait.current.idx); setHitNow([]); setStates(steps.map(() => 'todo')); setErrors(0); setResult(null);
    setPhase('playing');
  }, [steps, stopAll]);

  // 연습을 열거나 모드·손을 바꾸면 기다려 주기는 바로 준비, 박자 맞춰는 시작 버튼 대기
  useEffect(() => {
    if (mode === 'wait') startWait();
    else { stopAll(); wait.current = null; timed.current = null; setPhase('ready'); setCur(-1); setStates(steps.map(() => 'todo')); setResult(null); }
    return stopAll;
  }, [mode, steps, startWait, stopAll]);

  const save = useCallback((r: WaitResult | TimedResult) => {
    const full = hands === 'B' || used.length === 1;
    const needTimed = ex.modes.includes('timed');
    const passed = full && r.score >= PASS_SCORE && (!needTimed || r.mode === 'timed');
    void addRun({
      exId: ex.id, lessonId: lesson.id, date: localDate(), ts: Date.now(), mode: r.mode, hands, bpm: r.mode === 'timed' ? r.bpm : null,
      score: r.score, passed, seconds: Math.round(r.mode === 'wait' ? r.seconds : (totalBeats(steps) * 60) / r.bpm), detail: verdictLine(r, needTimed),
    });
  }, [ex, lesson, hands, used.length, steps]);

  /** 박자 맞춰 시작: 한 마디 세고 → 채점 */
  const startTimed = async () => {
    stopAll();
    await resumeAudio();
    setResult(null); setErrors(0); setStates(steps.map(() => 'todo'));
    metronome.volume = settings.clickVolume;
    const first = await metronome.start({ bpm, beats: ex.beats });
    const spb = 60000 / bpm;
    const t0 = first + ex.beats * spb + settings.latencyMs; // 기기 지연 보정 (설정)
    const g = new TimedGrader(steps, bpm, t0);
    timed.current = g; wait.current = null;
    (window as unknown as { __pianoT0?: number }).__pianoT0 = t0; // 스모크 시험용
    setPhase('countin'); setCur(-1);
    unsubTick.current = metronome.onTick((t) => { if (t.index < ex.beats) setCount(ex.beats - t.index); else setCount(null); });
    // 한 손만 칠 때 다른 손은 앱이 소리 냄
    if (hands !== 'B') {
      const other = onlyHand(ex.steps, hands === 'R' ? 'L' : 'R');
      other.forEach((s) => s.notes.forEach((n) => piano.schedule(n.midi, 70, perfToAudio(t0 + s.beat * spb), (s.dur * spb) / 1000 - 0.03)));
    }
    const loop = () => {
      const now = performance.now();
      if (now >= t0 - 50) setPhase((p) => (p === 'countin' ? 'playing' : p));
      setCur(g.stepAt(now));
      const missed = g.sweep(now);
      if (missed.length) setStates((ss) => mark(ss, g));
      if (now > g.endTime + g.window) {
        stopAll();
        const r = g.finish();
        setStates(mark(steps.map(() => 'todo'), g));
        setResult(r); setPhase('result'); save(r);
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  // 건반 입력
  useEffect(() => onInput((e) => {
    if (e.kind === 'pedal') return;
    const w = wait.current;
    if (w && phase === 'playing') {
      if (e.kind === 'off') { w.noteOff(e.note); setHitNow([...w.hit]); return; }
      const f = w.noteOn(e.note, e.time);
      if (f.kind === 'wrong') { doFlash(e.note, 'bad'); setErrors((x) => x + 1); setStates((ss) => ss.map((s, i) => (i === f.step ? 'wrong' : s))); }
      else if (f.kind === 'hit' || f.kind === 'step' || f.kind === 'done') {
        doFlash(e.note, 'good');
        if (f.kind !== 'hit') setStates((ss) => ss.map((s, i) => (i === f.step ? (w.errorsPerStep[i] ? 'fixed' : 'good') : s)));
      }
      setCur(w.idx); setHitNow([...w.hit]);
      if (f.kind === 'done') { const r = w.result(e.time); setResult(r); setPhase('result'); save(r); }
      return;
    }
    const g = timed.current;
    if (g && (phase === 'playing' || phase === 'countin') && e.kind === 'on') {
      const f = g.noteOn(e.note, e.time);
      if (f.kind === 'match') { doFlash(e.note, 'good'); setStates((ss) => mark(ss, g)); }
      else { doFlash(e.note, 'bad'); setErrors((x) => x + 1); }
    }
  }), [phase, doFlash, save]);

  /** 들어 보기: 앱이 끝까지 쳐 줌 (건반·칸 따라감) */
  const listen = async () => {
    stopAll();
    await resumeAudio();
    wait.current = null; timed.current = null;
    setPhase('listening'); setResult(null); setStates(ex.steps.map(() => 'todo'));
    const spb = 60000 / bpm;
    const t0 = performance.now() + 300;
    ex.steps.forEach((s) => s.notes.forEach((n) => piano.schedule(n.midi, n.hand === 'R' ? 85 : 65, perfToAudio(t0 + s.beat * spb), (s.dur * spb) / 1000 - 0.03)));
    const end = t0 + totalBeats(ex.steps) * spb;
    const loop = () => {
      const now = performance.now();
      const beat = (now - t0) / spb;
      let k = -1; ex.steps.forEach((s, i) => { if (s.beat <= beat) k = i; });
      setCur(k);
      if (now > end + 300) { stopAll(); setCur(-1); if (mode === 'wait') startWait(); else setPhase('ready'); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };
  const stopListen = () => { stopAll(); setCur(-1); if (mode === 'wait') startWait(); else setPhase('ready'); };

  // 건반 표시: 지금 칸(진하게) + 다음 칸(옅게)
  const showSteps = phase === 'listening' ? ex.steps : steps;
  const marks = new Map<number, KeyMark>();
  // 힌트를 꺼도: 들어 보기 중이거나, 기다려 주기에서 지금 칸을 한 번 틀리면 보여 줌
  const showHints = hints || phase === 'listening' || (mode === 'wait' && cur >= 0 && (wait.current?.errorsPerStep[cur] ?? 0) > 0);
  const nextIdx = nextNonRest(showSteps, cur + 1);
  if (showHints && nextIdx >= 0 && phase !== 'result') showSteps[nextIdx].notes.forEach((n) => marks.set(n.midi, { hand: n.hand, finger: n.finger, kind: 'soon' }));
  const curStep = cur >= 0 ? showSteps[cur] : undefined;
  if (curStep && phase !== 'result') curStep.notes.forEach((n) => { const ok = hitNow.includes(n.midi) && mode === 'wait'; if (showHints || ok) marks.set(n.midi, { hand: n.hand, finger: n.finger, kind: ok ? 'ok' : 'now' }); });
  if (showHints && phase === 'ready' && mode === 'timed') { const f = nextNonRest(steps, 0); if (f >= 0) steps[f].notes.forEach((n) => marks.set(n.midi, { hand: n.hand, finger: n.finger, kind: 'now' })); }

  const timedLike = mode === 'timed';
  const running = phase === 'countin' || (phase === 'playing' && timedLike);

  return (
    <div className="runner">
      <div className="card controls">
        {ex.modes.length > 1 && (
          <div className="segmented" role="group" aria-label="연습 방법">
            <button className={mode === 'wait' ? 'on' : ''} onClick={() => setMode('wait')} data-testid="mode-wait" disabled={running}>기다려 주기</button>
            <button className={mode === 'timed' ? 'on' : ''} onClick={() => setMode('timed')} data-testid="mode-timed" disabled={running}>박자 맞춰</button>
          </div>
        )}
        {used.length > 1 && (
          <div className="segmented small" role="group" aria-label="손">
            <button className={hands === 'B' ? 'on' : ''} onClick={() => setHands('B')} disabled={running} data-testid="hands-B">양손</button>
            <button className={hands === 'R' ? 'on' : ''} onClick={() => setHands('R')} disabled={running} data-testid="hands-R">오른손만</button>
            <button className={hands === 'L' ? 'on' : ''} onClick={() => setHands('L')} disabled={running} data-testid="hands-L">왼손만</button>
          </div>
        )}
        <div className="row-setting">
          <span className="muted small">템포</span>
          <button className="mini" onClick={() => setBpm(bpm - 4)} disabled={running} aria-label="느리게">−</button>
          <b className="bpm-num" data-testid="bpm">♩{bpm}</b>
          <button className="mini" onClick={() => setBpm(bpm + 4)} disabled={running} aria-label="빠르게">+</button>
          {bpm !== ex.bpm && <button className="link small muted" onClick={() => setBpm(ex.bpm)} disabled={running}>기본 {ex.bpm}</button>}
          <span className="grow" />
          {phase === 'listening'
            ? <button className="secondary" onClick={stopListen} data-testid="listen-stop">■ 그만 듣기</button>
            : <button className="secondary" onClick={listen} disabled={running} data-testid="listen">▶ 들어 보기</button>}
        </div>
        {timedLike && phase !== 'listening' && (
          running
            ? <button className="primary wide stop" onClick={() => { stopAll(); setPhase('ready'); setCur(-1); }} data-testid="timed-stop">■ 멈추기</button>
            : <button className="primary wide" onClick={startTimed} data-testid="timed-start">{phase === 'result' ? '다시 치기' : '시작 (한 마디 세고 시작)'}</button>
        )}
        {!timedLike && phase === 'playing' && <p className="hint" data-testid="wait-hint">{cur <= nextNonRest(steps, 0) && errors === 0 ? '준비되면 초록·파란 건반을 누르세요. 맞게 누를 때까지 기다려요.' : `틀린 건반 ${errors}번`}</p>}
        {hands !== 'B' && timedLike && <p className="hint">{hands === 'R' ? '왼손' : '오른손'}은 앱이 소리를 내 줘요.</p>}
      </div>

      {count !== null && <div className="countin" data-testid="countin">{count}</div>}

      <div className="view-bar">
        <div className="segmented small" role="group" aria-label="보기">
          <button className={view === 'staff' ? 'on' : ''} onClick={() => setView('staff')} data-testid="view-staff">악보</button>
          <button className={view === 'names' ? 'on' : ''} onClick={() => setView('names')} data-testid="view-names">이름 칸</button>
        </div>
        <label className="row-setting small"><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} data-testid="hints" />건반 힌트</label>
      </div>
      {view === 'staff'
        ? <Staff steps={showSteps} beats={ex.beats} mode={used.length === 1 ? (used[0] === 'R' ? 'treble' : 'bass') : 'grand'} cur={cur} states={phase === 'listening' ? [] : states} fingers={settings.fingers && hints} />
        : <StepStrip steps={showSteps} cur={cur} states={phase === 'listening' ? [] : states} beats={ex.beats} />}
      <div className="kb-scroll"><Keyboard lo={range[0]} hi={range[1]} marks={marks} flash={flash} names={hints ? undefined : 'c'} /></div>

      {result && phase === 'result' && <ResultCard r={result} hands={hands} needTimed={ex.modes.includes('timed')} onAgain={() => (mode === 'wait' ? startWait() : startTimed())} onTimed={ex.modes.includes('timed') && mode === 'wait' ? () => setMode('timed') : undefined} onDone={onDone} />}
    </div>
  );
}

function nextNonRest(steps: Step[], from: number): number {
  for (let i = Math.max(0, from); i < steps.length; i++) if (steps[i].notes.length) return i;
  return -1;
}

/** 박자 채점 결과 → 칸 색 */
function mark(prev: StepState[], g: TimedGrader): StepState[] {
  return prev.map((s, i) => {
    const vs = g.expected.filter((e) => e.step === i).map((e) => e.verdict);
    if (!vs.length || vs.some((v) => v === null)) return vs.some((v) => v !== null) ? worst(vs) : s;
    return worst(vs);
  });
}
function worst(vs: (Verdict | null)[]): StepState {
  if (vs.includes('miss')) return 'miss';
  if (vs.includes('early')) return 'early';
  if (vs.includes('late')) return 'late';
  if (vs.includes('good')) return 'good';
  return 'todo';
}

function ResultCard({ r, hands, needTimed, onAgain, onTimed, onDone }: { r: WaitResult | TimedResult; hands: Hands; needTimed: boolean; onAgain: () => void; onTimed?: () => void; onDone?: () => void }) {
  const pass = r.score >= PASS_SCORE;
  return (
    <div className={`card result ${pass ? 'pass' : ''}`} data-testid="result">
      <div className="result-head">
        <div className="score-big" data-testid="score">{r.score}<small>점</small></div>
        <div>
          <b>{!pass ? '조금 더' : needTimed && r.mode === 'wait' ? '음은 다 익혔어요' : hands === 'B' ? '통과!' : '한 손 통과'}</b>
          <p className="hint" data-testid="verdict">{verdictLine(r, needTimed)}</p>
        </div>
      </div>
      {r.mode === 'timed' && (
        <div className="stats">
          <span className="st good">딱 맞음 {r.good}</span>
          <span className="st early">빠름 {r.early}</span>
          <span className="st late">늦음 {r.late}</span>
          <span className="st miss">놓침 {r.miss}</span>
          {r.extra > 0 && <span className="st bad">틀린 건반 {r.extra}</span>}
          <span className="muted small">평균 어긋남 {r.meanAbsMs}ms{r.handGapMs !== null ? ` · 양손 ${r.handGapMs}ms` : ''}</span>
        </div>
      )}
      {r.mode === 'timed' && <Calibrate r={r} />}
      {r.mode === 'wait' && <div className="muted small">걸린 시간 {Math.round(r.seconds)}초 · 틀린 건반 {r.errors}번</div>}
      {hands !== 'B' && pass && <p className="hint">한 손이 되면 양손으로 해 보세요. 통과는 양손으로 칠 때 기록돼요.</p>}
      <div className="row">
        <button className="secondary" onClick={onAgain} data-testid="again">다시 하기</button>
        {onTimed && pass && <button className="primary" onClick={onTimed}>박자 맞춰 치기</button>}
        {onDone && (!onTimed || !pass) && <button className={pass ? 'primary' : 'secondary'} onClick={onDone}>다음</button>}
      </div>
    </div>
  );
}

/** 늘 한쪽으로 쏠리면 기기 지연일 수 있음 → 보정 제안 */
function Calibrate({ r }: { r: TimedResult }) {
  const s = useSettings();
  const [done, setDone] = useState(false);
  const hits = r.good + r.early + r.late;
  if (hits < 4 || Math.abs(r.meanMs) < 45 || r.meanAbsMs - Math.abs(r.meanMs) > 40) return null; // 고르게 쏠렸을 때만
  const next = Math.max(-250, Math.min(250, Math.round((s.latencyMs + r.meanMs) / 5) * 5));
  return (
    <p className="hint calib">
      {r.meanMs > 0 ? `늘 ${r.meanMs}ms 늦게` : `늘 ${-r.meanMs}ms 빠르게`}채점됐어요. 태블릿 소리가 늦게 나오는 탓일 수도 있어요.{' '}
      {done ? <b>보정 {next}ms 적용됨</b> : <button className="link" onClick={() => { setSettings({ latencyMs: next }); setDone(true); }} data-testid="calibrate">박자 보정 {next}ms 적용</button>}
    </p>
  );
}
