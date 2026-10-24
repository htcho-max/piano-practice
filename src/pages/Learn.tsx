import { useEffect, useState } from 'react';
import { LESSONS, findLesson, type Lesson, type Exercise } from '../lessons/lessons';
import { useRuns } from '../state/useDB';
import { passedSet, lessonDone, bestScore, currentLesson } from '../data/progress';
import { useBackLayer } from '../state/back';
import { FindRunner } from '../components/FindRunner';
import { PlayRunner } from '../components/PlayRunner';
import { Rich } from '../components/Rich';

export type LearnTarget = { lessonId: string; exId?: string; seq: number } | null;

export function Learn({ target }: { target: LearnTarget }) {
  const runs = useRuns();
  const passed = passedSet(runs);
  const [lessonId, setLessonId] = useState<string | null>(target?.lessonId ?? null);
  const [exId, setExId] = useState<string | null>(target?.exId ?? null);
  useEffect(() => { if (target) { setLessonId(target.lessonId); setExId(target.exId ?? null); } }, [target?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useBackLayer(!!lessonId, () => { setLessonId(null); setExId(null); });
  useBackLayer(!!exId, () => setExId(null));

  const lesson = lessonId ? findLesson(lessonId) : undefined;
  if (lesson && exId) {
    const idx = lesson.exercises.findIndex((e) => e.id === exId);
    const ex = lesson.exercises[idx];
    if (ex) {
      const nextEx = lesson.exercises[idx + 1];
      const nextLesson = LESSONS[lesson.n]; // 다음 레슨
      const onDone = () => { if (nextEx) setExId(nextEx.id); else if (nextLesson) { setLessonId(nextLesson.id); setExId(null); } else setExId(null); };
      return (
        <div className="page">
          <div className="crumbs"><button className="link" onClick={() => setExId(null)}>‹ {lesson.n}과 {lesson.title}</button></div>
          <div className="ex-head"><h2 data-testid="ex-title">{ex.title}</h2><p className="hint">{ex.text}</p></div>
          {ex.kind === 'find' ? <FindRunner key={ex.id} ex={ex} lesson={lesson} onDone={onDone} /> : <PlayRunner key={ex.id} ex={ex} lesson={lesson} onDone={onDone} />}
        </div>
      );
    }
  }
  if (lesson) return <LessonView lesson={lesson} passed={passed} runs={runs} open={(id) => setExId(id)} back={() => setLessonId(null)} />;

  const cur = currentLesson(passed);
  return (
    <div className="page">
      <p className="hint">처음 피아노를 배우는 순서예요. 한 레슨에 며칠씩 걸려도 괜찮아요. 연습을 모두 통과하면 ✓ 표시가 붙어요.</p>
      <ul className="lesson-list">
        {LESSONS.map((l) => {
          const done = lessonDone(l, passed);
          const all = done === l.exercises.length;
          return (
            <li key={l.id}>
              <button className={`lesson-item${l.id === cur.id ? ' current' : ''}${all ? ' done' : ''}`} onClick={() => setLessonId(l.id)} data-testid={`lesson-${l.n}`}>
                <span className="ln">{all ? '✓' : l.n}</span>
                <span className="lt"><b>{l.title}</b><small>{l.goal}</small></span>
                <span className="lp">{done}/{l.exercises.length}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">다음 단계(악보 읽기, 코드와 찬양 반주, 좋아하는 곡)는 차례로 추가돼요.</p>
    </div>
  );
}

function LessonView({ lesson, passed, runs, open, back }: { lesson: Lesson; passed: Set<string>; runs: ReturnType<typeof useRuns>; open: (id: string) => void; back: () => void }) {
  return (
    <div className="page">
      <div className="crumbs"><button className="link" onClick={back}>‹ 레슨 목록</button></div>
      <div className="card lesson-body">
        <div className="muted small">{lesson.n}과</div>
        <h2 data-testid="lesson-title">{lesson.title}</h2>
        {lesson.body.map((p, i) => <p key={i}><Rich text={p} /></p>)}
        {lesson.tips.length > 0 && <ul className="tips">{lesson.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
      </div>
      <h3>연습</h3>
      <ul className="ex-list">
        {lesson.exercises.map((e: Exercise) => {
          const best = bestScore(runs, e.id);
          return (
            <li key={e.id}>
              <button className={`ex-item${passed.has(e.id) ? ' done' : ''}`} onClick={() => open(e.id)} data-testid={`ex-${e.id}`}>
                <span className="ln">{passed.has(e.id) ? '✓' : '▶'}</span>
                <span className="lt"><b>{e.title}</b><small>{e.kind === 'find' ? '건반 찾기' : e.modes.includes('timed') ? (e.modes.includes('wait') ? '기다려 주기 → 박자 맞춰' : '박자 맞춰') : '기다려 주기'}</small></span>
                {best !== null && <span className="lp">최고 {best}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
