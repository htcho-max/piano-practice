import { useRuns, useDays } from '../state/useDB';
import { findExercise } from '../lessons/lessons';
import { formatDuration, localDate, addDays } from '../data/dates';

export function Log() {
  const runs = useRuns();
  const days = useDays();
  const today = localDate();
  // 최근 14일 막대
  const last = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const secOf = (d: string) => days.find((x) => x.date === d)?.seconds ?? 0;
  const maxSec = Math.max(600, ...last.map(secOf));
  const week = last.slice(7).reduce((a, d) => a + secOf(d), 0);
  const recent = [...runs].reverse().slice(0, 40);
  return (
    <div className="page">
      <div className="card">
        <div className="card-head"><b>최근 2주</b><span className="muted small">이번 7일 {formatDuration(week)}</span></div>
        <div className="bars" data-testid="bars">
          {last.map((d) => {
            const s = secOf(d);
            return (
              <div key={d} className="bar-col" title={`${d} ${formatDuration(s)}`}>
                <div className="bar" style={{ height: `${Math.round((s / maxSec) * 100)}%` }} />
                <span className={`bar-d${d === today ? ' today' : ''}`}>{Number(d.slice(8))}</span>
              </div>
            );
          })}
        </div>
      </div>
      <h3>연습 기록</h3>
      {recent.length === 0 ? <p className="hint">아직 기록이 없어요. 배우기 탭에서 1과부터 시작해 보세요.</p> : (
        <ul className="run-list" data-testid="runs">
          {recent.map((r) => {
            const f = findExercise(r.exId);
            return (
              <li key={r.id} className={r.passed ? 'passed' : ''}>
                <div className="rl-top"><b>{f ? `${f.lesson.n}과 · ${f.ex.title}` : r.exId}</b><span className="score">{r.score}점</span></div>
                <div className="muted small">{r.date.slice(5).replace('-', '/')} · {r.mode === 'timed' ? `박자 맞춰 ♩${r.bpm}` : r.mode === 'wait' ? '기다려 주기' : '건반 찾기'}{r.hands !== 'B' ? ` · ${r.hands === 'R' ? '오른손' : '왼손'}만` : ''}{r.passed ? ' · 통과' : ''}</div>
                {r.detail && <div className="small">{r.detail}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
