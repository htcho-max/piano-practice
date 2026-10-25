import { useRef, useState } from 'react';
import { BUILTIN_SONGS } from '../songs/builtin';
import { db, notify, type Song } from '../data/db';
import { useQuery, useRuns } from '../state/useDB';
import { parseMusicXML, readScoreFile } from '../music/musicxml';
import { PlayRunner, type Piece } from '../components/PlayRunner';
import { useBackLayer } from '../state/back';
import { bestScore } from '../data/progress';
import { barCount } from '../music/steps';

type Open = { piece: Piece; composer?: string; note?: string; warnings?: string[] };

export function Songs() {
  const runs = useRuns();
  const songs = useQuery(() => db.songs.orderBy('createdAt').reverse().toArray(), [] as Song[]);
  const [open, setOpen] = useState<Open | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useBackLayer(!!open, () => setOpen(null));

  if (open) {
    const p = open.piece;
    return (
      <div className="page">
        <div className="crumbs"><button className="link" onClick={() => setOpen(null)}>‹ 곡 목록</button></div>
        <div className="ex-head">
          <h2 data-testid="song-title">{p.title}</h2>
          <p className="hint">{[open.composer, `${p.timeNum ?? p.beats}/${p.timeDen ?? 4}박자`, `${barCount(p.steps, p.beats)}마디`, open.note].filter(Boolean).join(' · ')}</p>
          {open.warnings?.map((w) => <p key={w} className="hint">⚠ {w}</p>)}
        </div>
        <PlayRunner key={p.id} ex={p} lessonId="song" song />
      </div>
    );
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const ok: string[] = [], bad: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const xml = await readScoreFile(f);
        const s = parseMusicXML(xml);
        await db.songs.add({ title: s.title, composer: s.composer, beats: s.beats, timeNum: s.timeNum, timeDen: s.timeDen, bpm: s.bpm ?? 80, steps: s.steps, origin: 'import', fileName: f.name, createdAt: Date.now(), warnings: s.warnings });
        ok.push(s.title);
      } catch (e) { bad.push(`${f.name} (${(e as Error).message})`); }
    }
    notify();
    setBusy(false);
    setMsg([ok.length ? `불러온 곡: ${ok.join(', ')}` : '', bad.length ? `못 읽은 파일: ${bad.join(', ')}` : ''].filter(Boolean).join(' · '));
    if (file.current) file.current.value = '';
  };

  const pieceOfBuiltin = (b: (typeof BUILTIN_SONGS)[number]): Piece => ({ id: `song:${b.key}`, title: b.title, steps: b.steps, bpm: b.bpm, beats: b.beats, timeNum: b.timeNum, timeDen: b.timeDen, modes: ['wait', 'timed'] });
  const pieceOfSong = (s: Song): Piece => ({ id: `song:u${s.id}`, title: s.title, steps: s.steps, bpm: s.bpm, beats: s.beats, timeNum: s.timeNum, timeDen: s.timeDen, modes: ['wait', 'timed'] });
  const meta = (id: string) => {
    const rs = runs.filter((r) => r.exId === id);
    if (!rs.length) return null;
    const best = bestScore(runs, id);
    return `최고 ${best}점 · ${rs.length}번 연습`;
  };

  return (
    <div className="page">
      <p className="hint">곡은 <b>기다려 주기</b>로 음을 익히고 → 어려운 마디만 <b>구간</b>으로 → <b>템포 사다리</b>로 느리게부터 올려 가며 박자 맞춰 치세요.</p>
      <h3>기본 곡</h3>
      <ul className="ex-list">
        {BUILTIN_SONGS.map((b) => {
          const p = pieceOfBuiltin(b);
          const m = meta(p.id);
          return (
            <li key={b.key}>
              <button className="ex-item" onClick={() => setOpen({ piece: p, composer: b.composer, note: b.note })} data-testid={`song-${b.key}`}>
                <span className="ln">{'★'.repeat(b.level)}</span>
                <span className="lt"><b>{b.title}</b><small>{b.composer} · {b.note}</small></span>
                {m && <span className="lp">{m}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <h3>내 곡</h3>
      <div className="card">
        <p className="hint">MusicXML 악보(.musicxml · .xml · .mxl)를 불러와 연습할 수 있어요. 뮤즈스코어 같은 악보 프로그램에서 &quot;내보내기 → MusicXML&quot;로 만든 파일이면 돼요. 피아노 악보는 위 오선 = 오른손, 아래 오선 = 왼손으로 읽어요.</p>
        <input ref={file} type="file" accept=".musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml" multiple hidden onChange={(e) => void onFiles(e.target.files)} data-testid="song-file" />
        <button className="secondary" onClick={() => file.current?.click()} disabled={busy}>{busy ? '읽는 중…' : '＋ 악보 파일 불러오기'}</button>
        {msg && <p className="hint" data-testid="import-msg">{msg}</p>}
      </div>
      {songs.length > 0 && (
        <ul className="ex-list">
          {songs.map((s) => {
            const p = pieceOfSong(s);
            const m = meta(p.id);
            return (
              <li key={s.id} className="song-row">
                <button className="ex-item" onClick={() => setOpen({ piece: p, composer: s.composer, warnings: s.warnings })} data-testid={`mysong-${s.id}`}>
                  <span className="ln">♪</span>
                  <span className="lt"><b>{s.title}</b><small>{[s.composer, s.fileName].filter(Boolean).join(' · ')}</small></span>
                  {m && <span className="lp">{m}</span>}
                </button>
                <button className="mini danger" aria-label={`${s.title} 지우기`} onClick={async () => { if (confirm(`"${s.title}"을(를) 지울까요? 연습 기록은 남아요.`)) { await db.songs.delete(s.id!); notify(); } }}>✕</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
