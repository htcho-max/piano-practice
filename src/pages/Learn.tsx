import { useEffect, useState } from 'react';
import { LESSONS, findLesson, type Lesson, type Exercise } from '../lessons/lessons';
import { useRuns } from '../state/useDB';
import { passedSet, lessonDone, bestScore, currentLesson } from '../data/progress';
import { useBackLayer } from '../state/back';
import { FindRunner } from '../components/FindRunner';
import { PlayRunner } from '../components/PlayRunner';
import { Rich } from '../components/Rich';
import { ReadRunner } from '../components/ReadRunner';
import { ChordDrill } from '../components/ChordDrill';
import { VoiceDrill } from '../components/VoiceDrill';
import { READ_LEVELS, findLevel } from '../practice/reading';

function exKind(e: Exercise): string {
  if (e.kind === 'find') return '건반 찾기';
  if (e.kind === 'read') return '음표 읽기 퀴즈';
  if (e.kind === 'chords') return '코드 바꾸기';
  if (e.kind === 'voice') return '보이싱 (멜로디 맨 위)';
  if (e.modes[0] === 'free') return '자유 반주';
  const how = e.modes.includes('timed') ? (e.modes.includes('wait') ? '기다려 주기 → 박자 맞춰' : '박자 맞춰') : '기다려 주기';
  return e.sheet ? `악보 보고 · ${how}` : how;
}

export type LearnTarget = { lessonId: string; exId?: string; seq: number } | null;

export function Learn({ target }: { target: LearnTarget }) {
  const runs = useRuns();
  const passed = passedSet(runs);
  const [lessonId, setLessonId] = useState<string | null>(target?.lessonId ?? null);
  const [exId, setExId] = useState<string | null>(target?.exId ?? null);
  useEffect(() => { if (target) { setLessonId(target.lessonId); setExId(target.exId ?? null); } }, [target?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useBackLayer(!!lessonId, () => { setLessonId(null); setExId(null); });
  useBackLayer(!!exId, () => setExId(null));

  const [readLevel, setReadLevel] = useState<string | null>(null);
  useBackLayer(!!readLevel, () => setReadLevel(null));
  if (readLevel) {
    const lv = findLevel(readLevel)!;
    return (
      <div className="page">
        <div className="crumbs"><button className="link" onClick={() => setReadLevel(null)}>‹ 배우기</button></div>
        <div className="ex-head"><h2 data-testid="ex-title">음표 읽기 · {lv.title}</h2><p className="hint">{lv.desc}</p></div>
        <ReadRunner key={readLevel} levelId={readLevel} count={20} onDone={() => setReadLevel(null)} />
      </div>
    );
  }
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
          {ex.kind === 'find' ? <FindRunner key={ex.id} ex={ex} lesson={lesson} onDone={onDone} /> : ex.kind === 'chords' ? <ChordDrill key={ex.id} id={ex.id} lessonId={lesson.id} chords={ex.chords} rounds={ex.rounds} modes={ex.modes} bpm={ex.bpm} onDone={onDone} /> : ex.kind === 'voice' ? <VoiceDrill key={ex.id} id={ex.id} lessonId={lesson.id} items={ex.items} onDone={onDone} /> : ex.kind === 'read' ? <ReadRunner key={ex.id} levelId={ex.level} count={ex.count} exId={ex.id} lesson={lesson} onDone={onDone} /> : <PlayRunner key={ex.id} ex={ex} lessonId={lesson.id} onDone={onDone} />}
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
      <h3>음표 읽기 연습 (언제든)</h3>
      <ul className="levels">
        {READ_LEVELS.map((lv) => {
          const best = bestScore(runs, `read-${lv.id}`);
          return (
            <li key={lv.id}>
              <button className="ex-item" onClick={() => setReadLevel(lv.id)} data-testid={`level-${lv.id}`}>
                <span className="ln">𝅘𝅥</span>
                <span className="lt"><b>{lv.title}</b><small>{lv.desc}</small></span>
                {best !== null && <span className="lp">최고 {best}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">다음 단계(음계와 넘기기)는 차례로 추가돼요. 곡은 ♫ 곡 탭, 코드·반주 패턴은 ▥ 코드 탭에서도 연습해요.</p>
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
                <span className="lt"><b>{e.title}</b><small>{exKind(e)}</small></span>
                {best !== null && <span className="lp">최고 {best}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
