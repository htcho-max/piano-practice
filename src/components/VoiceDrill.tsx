import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, type KeyMark } from './Keyboard';
import { useFlash } from './useFlash';
import { onInput, heldNotes } from '../midi/input';
import { parseChord, bassNote, rhFingers } from '../music/chordbook';
import { underVoices, judgeVoicing, isChordTone, type VoiceItem } from '../music/melodyvoice';
import { noteName, label } from '../music/notes';
import { piano } from '../audio/piano';
import { resumeAudio } from '../audio/context';
import { perfToAudio } from '../audio/metronome';
import { addRun } from '../data/db';
import { localDate } from '../data/dates';
import { useSettings } from '../state/settings';

/**
 * 보이싱 연습: 코드 + 맨 위 음(멜로디)이 주어지면, 멜로디가 맨 위인 그 코드를 누르기.
 * 통과 = 맨 위 음이 멜로디 · 코드 밖 음 없음 · 멜로디 아래 한 옥타브 안에 코드 음 둘 이상 · 3음 포함 (왼손 베이스는 자유)
 */
export function VoiceDrill({ id, lessonId, items, onDone }: { id: string; lessonId: string; items: VoiceItem[]; onDone?: () => void }) {
  const s = useSettings();
  const [idx, setIdx] = useState(0);
  const [hints, setHints] = useState(true);
  const [state, setState] = useState<{ msg: string; ok: boolean }>({ msg: '', ok: false });
  const [res, setRes] = useState<{ score: number; avg: number; wrong: number; top: number } | null>(null);
  const [flash, doFlash] = useFlash();
  const st = useRef({ shownAt: performance.now(), times: [] as number[], wrong: 0, top: 0, topNoted: false, doneAt: -Infinity, prev: null as string | null });
  const rec = useMemo(() => items.map((it) => underVoices(it.mel, parseChord(it.chord)!, 2)), [items]);

  const restart = useCallback(() => { setIdx(0); setRes(null); setState({ msg: '', ok: false }); st.current = { shownAt: performance.now(), times: [], wrong: 0, top: 0, topNoted: false, doneAt: -Infinity, prev: null }; }, []);
  useEffect(restart, [items, restart]);

  useEffect(() => onInput((e) => {
    if (e.kind === 'pedal' || res) return;
    const it = items[idx];
    if (!it) return;
    const c = parseChord(it.chord)!;
    const held = heldNotes();
    // 방금 맞힌 화음을 조금 늦게 누른 음 (0.2초 안, 앞 코드 음)은 넘어감
    if (e.kind === 'on' && st.current.prev && e.time - st.current.doneAt < 200 && isChordTone(e.note, parseChord(st.current.prev)!)) return;
    if (e.kind === 'on' && !isChordTone(e.note, c)) { st.current.wrong++; doFlash(e.note, 'bad'); }
    if (!held.length) { setState({ msg: '', ok: false }); return; }
    if (e.kind !== 'on') return; // 떼는 중에는 판정하지 않음
    const j = judgeVoicing(held, it);
    if (j.full) {
      st.current.times.push(e.time - st.current.shownAt);
      held.forEach((n) => doFlash(n, 'good'));
      setState({ msg: '좋아요!', ok: true });
      const next = idx + 1;
      if (next >= items.length) {
        const t = st.current.times;
        const avg = t.reduce((a, b) => a + b, 0) / t.length;
        const score = Math.max(0, Math.round(100 - Math.max(0, avg - 3000) / 80 - st.current.wrong * 3 - st.current.top * 3));
        setRes({ score, avg, wrong: st.current.wrong, top: st.current.top });
        void addRun({ exId: id, lessonId, date: localDate(), ts: Date.now(), mode: 'wait', hands: 'B', bpm: null, score, passed: score >= 80, seconds: Math.round(t.reduce((a, b) => a + b, 0) / 1000), detail: `보이싱 ${items.length}개 · 평균 ${(avg / 1000).toFixed(1)}초 · 틀린 음 ${st.current.wrong}` });
      } else { setIdx(next); st.current.shownAt = e.time; st.current.topNoted = false; st.current.doneAt = e.time; st.current.prev = it.chord; }
      return;
    }
    const hasMel = held.includes(it.mel);
    if (hasMel && !j.top) { if (!st.current.topNoted) { st.current.top++; st.current.topNoted = true; } setState({ msg: '멜로디보다 높은 음이 있어요 — 멜로디가 맨 위!', ok: false }); }
    else if (j.wrong.length) setState({ msg: `${j.wrong.map((m) => label(m, s.labels)).join('·')} 은(는) ${it.chord} 음이 아니에요`, ok: false });
    else if (!hasMel) setState({ msg: `맨 위 멜로디 ${label(it.mel, s.labels)}(${noteName(it.mel)})도 같이`, ok: false });
    else if (j.under < 2) setState({ msg: `멜로디 아래 코드 음을 ${2 - j.under}개 더 (한 옥타브 안)`, ok: false });
    else setState({ msg: '3음이 빠졌어요 — 장·단조 색을 내는 음', ok: false });
  }), [idx, items, res, doFlash, s.labels]);

  const it = items[idx];
  const c = it && parseChord(it.chord)!;
  const listen = async () => {
    if (!it) return;
    await resumeAudio();
    const t = performance.now() + 100;
    piano.schedule(bassNote(c!), 70, perfToAudio(t), 1.8);
    [...rec[idx], it.mel].forEach((m) => piano.schedule(m, m === it.mel ? 90 : 70, perfToAudio(t), 1.8));
  };
  const marks = new Map<number, KeyMark>();
  if (it && !res) {
    marks.set(it.mel, { hand: 'R', finger: 5, kind: state.ok ? 'ok' : 'now' }); // 멜로디는 늘 5번
    if (hints) { const f = rhFingers([...rec[idx], it.mel]); rec[idx].forEach((m, i) => marks.set(m, { hand: 'R', finger: f[i], kind: 'soon' })); marks.set(bassNote(c!), { hand: 'L', finger: 5, kind: 'soon' }); }
  }
  const next = items[idx + 1];

  return (
    <div className="runner">
      <div className="card controls">
        <div className="row-setting">
          <label className="row-setting small"><input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} data-testid="vd-hints" />추천 자리 보기</label>
          <span className="grow" />
          <button className="secondary" onClick={listen} disabled={!!res}>▶ 들어 보기</button>
        </div>
        <p className="hint">파란 건반(멜로디)을 <b>맨 위</b>로, 그 아래 한 옥타브 안에 코드 음 둘. 왼손 베이스는 넣어도 되고 빼도 돼요. 추천 자리 말고 다른 자리도 맞으면 통과!</p>
      </div>
      {!res && it && (
        <div className={`card chord-now${state.ok ? ' ok' : ''}`}>
          <div className="chord-big" data-testid="voice-chord">{it.chord}</div>
          <div className="voice-top">맨 위 <b data-testid="voice-mel">{label(it.mel, s.labels)}</b> <span className="muted">{noteName(it.mel)}</span></div>
          <div className="muted small">{idx + 1} / {items.length}{next ? <> · 다음 <b>{next.chord}</b> (맨 위 {label(next.mel, s.labels)})</> : ''}</div>
          {state.msg && <p className="hint" data-testid="voice-msg">{state.msg}</p>}
        </div>
      )}
      <div className="kb-scroll"><Keyboard lo={40} hi={76} marks={marks} flash={flash} compact={typeof window !== 'undefined' && window.innerWidth < 700} /></div>
      {res && (
        <div className={`card result ${res.score >= 80 ? 'pass' : ''}`} data-testid="result">
          <div className="result-head">
            <div className="score-big" data-testid="score">{res.score}<small>점</small></div>
            <div>
              <b>{res.score >= 80 ? '좋아요!' : '조금 더'}</b>
              <p className="hint">한 자리에 평균 {(res.avg / 1000).toFixed(1)}초 · 틀린 음 {res.wrong}번{res.top ? ` · 멜로디가 맨 위가 아님 ${res.top}번` : ''}. 3초 안에 잡으면 추천 자리를 끄고 해 보세요.</p>
            </div>
          </div>
          <div className="row">
            <button className="secondary" onClick={restart} data-testid="again">다시 하기</button>
            {onDone && <button className="primary" onClick={onDone}>다음</button>}
          </div>
        </div>
      )}
    </div>
  );
}
