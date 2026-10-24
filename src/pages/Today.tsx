import { useRuns, useDays } from '../state/useDB';
import { todayPlan, passedSet, currentLesson, lessonDone } from '../data/progress';
import { findExercise, LESSONS } from '../lessons/lessons';
import { localDate, streak, formatDuration } from '../data/dates';
import { ConnectCard } from '../components/ConnectCard';
import { useMidi } from '../state/live';

export function Today({ openEx }: { openEx: (lessonId: string, exId?: string) => void }) {
  const runs = useRuns();
  const days = useDays();
  const midi = useMidi();
  const today = localDate();
  const plan = todayPlan(runs);
  const passed = passedSet(runs);
  const lesson = currentLesson(passed);
  const doneToday = new Set(runs.filter((r) => r.date === today).map((r) => r.exId));
  const practiced = new Set([...days.filter((d) => d.seconds > 0).map((d) => d.date), ...runs.map((r) => r.date)]);
  const st = streak(practiced, today);
  const todaySec = days.find((d) => d.date === today)?.seconds ?? 0;
  const totalPassed = LESSONS.reduce((a, l) => a + lessonDone(l, passed), 0);
  const totalEx = LESSONS.reduce((a, l) => a + l.exercises.length, 0);
  const connected = midi.status === 'ready' && midi.devices.length > 0;

  return (
    <div className="page">
      <div className="card today-stats">
        <div><div className="big" data-testid="today-time">{formatDuration(todaySec)}</div><div className="muted small">오늘 친 시간</div></div>
        <div><div className="big">{st}일</div><div className="muted small">연속 연습</div></div>
        <div><div className="big">{totalPassed}/{totalEx}</div><div className="muted small">통과한 연습</div></div>
      </div>

      {!connected && <ConnectCard compact />}

      <h3>오늘의 연습 · 약 {plan.reduce((a, p) => a + p.minutes, 0)}분</h3>
      <ol className="plan">
        {plan.map((p) => {
          const f = findExercise(p.exId);
          const done = doneToday.has(p.exId);
          return (
            <li key={p.key}>
              <button className={`plan-item${done ? ' done' : ''}`} onClick={() => f && openEx(f.lesson.id, p.exId)} data-testid={`plan-${p.key}`}>
                <span className="check">{done ? '✓' : ''}</span>
                <span className="lt"><b>{p.label}</b><small>{p.why}</small></span>
                <span className="lp">{p.minutes}분</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="card">
        <div className="card-head"><b>{lesson.n}과 · {lesson.title}</b><span className="muted small">{lessonDone(lesson, passed)}/{lesson.exercises.length}</span></div>
        <p className="hint">{lesson.goal}</p>
        <button className="secondary" onClick={() => openEx(lesson.id)}>레슨 설명 읽기</button>
      </div>
      <p className="hint">처음 피아노를 배울 땐 <b>매일 20~30분</b>이 한 번에 2시간보다 좋아요. 손이 아프거나 힘이 들어가면 쉬었다 하세요.</p>
    </div>
  );
}
