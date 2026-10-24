import { useEffect, useRef, useState } from 'react';
import { Keyboard } from './Keyboard';
import { useFlash } from './useFlash';
import { onInput } from '../midi/input';
import type { Exercise, Lesson } from '../lessons/lessons';
import { addRun } from '../data/db';
import { localDate } from '../data/dates';

type FindEx = Extract<Exercise, { kind: 'find' }>;

/** 건반 찾기: 문제마다 맞는 건반을 need 개 누르면 다음 문제 */
export function FindRunner({ ex, lesson, onDone }: { ex: FindEx; lesson: Lesson; onDone?: () => void }) {
  const [q, setQ] = useState(0);
  const [found, setFound] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const [flash, doFlash] = useFlash();
  const st = useRef({ q: 0, found: [] as number[], wrong: 0, start: 0, busy: false });

  useEffect(() => onInput((e) => {
    if (e.kind !== 'on') return;
    const s = st.current;
    if (s.q >= ex.questions.length || s.busy) return;
    if (!s.start) s.start = e.time;
    const qq = ex.questions[s.q];
    if (qq.accept.includes(e.note)) {
      doFlash(e.note, 'good');
      if (s.found.includes(e.note)) return;
      s.found = [...s.found, e.note];
      setFound(s.found);
      if (s.found.length >= qq.need) {
        s.busy = true;
        setTimeout(() => {
          s.busy = false;
          s.q++; s.found = [];
          setQ(s.q); setFound([]); setShowHint(false);
          if (s.q >= ex.questions.length) {
            setFinished(true);
            const score = Math.max(0, 100 - s.wrong * 5);
            void addRun({ exId: ex.id, lessonId: lesson.id, date: localDate(), ts: Date.now(), mode: 'find', hands: 'B', bpm: null, score, passed: true, seconds: Math.round((performance.now() - s.start) / 1000), detail: `틀린 건반 ${s.wrong}번` });
          }
        }, 650);
      }
    } else {
      doFlash(e.note, 'bad');
      s.wrong++;
      setWrong(s.wrong);
      if (s.wrong % 2 === 0) setShowHint(true);
    }
  }), [ex, lesson, doFlash]);

  const restart = () => { st.current = { q: 0, found: [], wrong: 0, start: 0, busy: false }; setQ(0); setFound([]); setWrong(0); setFinished(false); setShowHint(false); };
  const cur = ex.questions[q];
  const marks = new Map(found.map((m) => [m, { kind: 'ok' as const }]));

  return (
    <div className="runner">
      {finished ? (
        <div className="card result" data-testid="result">
          <div className="score-big">완료!</div>
          <p>{wrong === 0 ? '한 번도 틀리지 않았어요. 건반 지도가 머릿속에 생겼네요.' : `틀린 건반 ${wrong}번. 검은 건반 묶음을 기준으로 보면 금방 익숙해져요.`}</p>
          <div className="row"><button className="secondary" onClick={restart}>다시 하기</button>{onDone && <button className="primary" onClick={onDone}>다음</button>}</div>
        </div>
      ) : (
        <div className="card question">
          <div className="muted small">문제 {q + 1} / {ex.questions.length}</div>
          <div className="q-text" data-testid="question">{cur.text}</div>
          <div className="q-progress">{Array.from({ length: cur.need }, (_, i) => <span key={i} className={i < found.length ? 'pip on' : 'pip'} />)}</div>
          {showHint && cur.hint ? <p className="hint">힌트: {cur.hint}</p> : <button className="link small muted" onClick={() => setShowHint(true)}>힌트 보기</button>}
          {wrong > 0 && <div className="muted small">틀린 건반 {wrong}번</div>}
        </div>
      )}
      <div className="kb-scroll"><Keyboard lo={36} hi={96} marks={marks} flash={flash} /></div>
    </div>
  );
}
