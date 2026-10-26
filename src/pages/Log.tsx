import { useRuns, useDays } from '../state/useDB';
import { findExercise } from '../lessons/lessons';
import { formatDuration, localDate, addDays } from '../data/dates';
import { findBuiltin } from '../songs/builtin';
import { findLevel } from '../practice/reading';
import { PROGRESSIONS, PATTERNS, FLAT_KEYS, rootName } from '../music/chordbook';
import { findScale } from '../music/scales';
import { db, type Song } from '../data/db';
import { useQuery } from '../state/useDB';

const songName = (raw: string, mine: Map<number, string>): string => {
  const free = raw.endsWith(':free');
  const id = free ? raw.slice(0, -5) : raw;
  const tail = free ? ' (자유 반주)' : '';
  if (id.startsWith('song:u')) return `곡 · ${mine.get(Number(id.slice(6))) ?? '지운 곡'}${tail}`;
  if (id.startsWith('song:')) return `곡 · ${findBuiltin(id.slice(5))?.title ?? '곡'}${tail}`;
  const prog = (pid: string, key: string) => `${PROGRESSIONS.find((p) => p.id === pid)?.title ?? pid} · ${rootName(Number(key), FLAT_KEYS.has(Number(key)))}`;
  const [kind, a, b, c] = id.split(':');
  if (kind === 'chord') return `코드 바꾸기 · ${prog(a, b)}`;
  if (kind === 'voice') return `보이싱 · ${prog(a, b)}`;
  if (kind === 'acc') return `반주 패턴 · ${prog(a, b)}${c ? ` · ${PATTERNS.find((p) => p.id === c)?.title ?? c}` : ''}`;
  if (kind === 'scale') return `음계 · ${findScale(a)?.name ?? a}`;
  if (kind === 'arp') return `아르페지오 · ${a}`;
  if (kind === 'hanon1') return '하농 1번';
  if (id.startsWith('read-')) return `음표 읽기 · ${findLevel(id.slice(5))?.title ?? ''}`;
  return id;
};

export function Log() {
  const runs = useRuns();
  const days = useDays();
  const songs = useQuery(() => db.songs.toArray(), [] as Song[]);
  const mine = new Map(songs.map((x) => [x.id!, x.title]));
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
                <div className="rl-top"><b>{f ? `${f.lesson.n}과 · ${f.ex.title}` : songName(r.exId, mine)}</b><span className="score">{r.score}점</span></div>
                <div className="muted small">{r.date.slice(5).replace('-', '/')} · {r.mode === 'timed' ? `박자 맞춰 ♩${r.bpm}` : r.mode === 'wait' ? '기다려 주기' : r.mode === 'free' ? '자유 반주' : r.mode === 'read' ? '음표 읽기' : '건반 찾기'}{r.section && r.lessonId === 'song' ? ` · ${r.section[0]}~${r.section[1]}마디` : ''}{r.hands !== 'B' ? ` · ${r.hands === 'R' ? '오른손' : '왼손'}만` : ''}{r.passed ? ' · 통과' : ''}</div>
                {r.detail && <div className="small">{r.detail}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
