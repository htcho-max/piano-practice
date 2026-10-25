import { useRef, useState } from 'react';
import { BUILTIN_SONGS } from '../songs/builtin';
import { db, notify, type Song } from '../data/db';
import { useQuery, useRuns } from '../state/useDB';
import { parseMusicXML, readScoreFile } from '../music/musicxml';
import { PlayRunner, type Piece } from '../components/PlayRunner';
import { useBackLayer } from '../state/back';
import { bestScore } from '../data/progress';
import { barCount, onlyHand, totalBeats } from '../music/steps';
import { harmonize, type MelNote } from '../music/harmonize';
import { parseBarsText, barsText, leftHand, mergeHands, LEFT_KINDS, type LeftKind } from '../music/chordbook';

export const pieceOfSong = (s: Song): Piece => ({ id: `song:u${s.id}`, title: s.title, steps: s.steps, bpm: s.bpm, beats: s.beats, timeNum: s.timeNum, timeDen: s.timeDen, modes: ['wait', 'timed'], chords: s.chords, pedalAt: s.pedalAt, fifths: s.fifths });

/** 멜로디(오른손 맨 위 음) → 코드 붙이기용 음 */
function melodyOf(p: Piece): MelNote[] {
  return p.steps.flatMap((st) => {
    const r = st.notes.filter((n) => n.hand === 'R');
    if (!r.length) return [];
    const top = r.reduce((a, b) => (b.midi > a.midi ? b : a));
    return [{ midi: top.midi, beat: st.beat, dur: top.len ?? st.dur }];
  });
}

/** 코드 붙여 반주 만들기: 오른손 멜로디는 그대로, 왼손을 코드로 새로 */
function ArrangeCard({ piece, fifths, onMade }: { piece: Piece; fifths?: number; onMade: (o: Open) => void }) {
  const bars = barCount(piece.steps, piece.beats);
  const [openCard, setOpenCard] = useState(false);
  const [text, setText] = useState(() => (piece.chords?.length ? barsText(piece.chords, piece.beats, bars) : ''));
  const [kind, setKind] = useState<LeftKind>('bass');
  const [msg, setMsg] = useState<string | null>(null);
  const auto = () => {
    const mel = melodyOf(piece);
    if (!mel.length) { setMsg('오른손 멜로디가 없어요.'); return; }
    const r = harmonize(mel, { beatsPerBar: piece.beats, fifths });
    setText(barsText(r.spans, piece.beats, bars));
    setMsg(`${r.key.name} 조로 보고 코드를 붙였어요. 마음에 안 드는 마디는 고쳐 쓰세요.`);
  };
  const make = async () => {
    const { spans, errors } = parseBarsText(text, piece.beats);
    if (errors.length) { setMsg(`못 읽은 코드: ${errors.join(', ')}`); return; }
    if (!spans.length) { setMsg('코드를 적거나 자동으로 붙여 주세요.'); return; }
    const right = onlyHand(piece.steps, 'R');
    const total = Math.max(totalBeats(piece.steps), bars * piece.beats);
    const steps = mergeHands(right, leftHand(spans, kind, piece.beats), total);
    const k = LEFT_KINDS.find((x) => x.id === kind)!;
    const song: Song = { title: `${piece.title.replace(/ · 반주\(.*\)$/, '')} · 반주(${k.title})`, beats: piece.beats, timeNum: piece.timeNum ?? piece.beats, timeDen: piece.timeDen ?? 4, bpm: piece.bpm, steps, origin: 'import', createdAt: Date.now(), chords: spans, pedalAt: spans.map((s) => s.beat), fifths };
    const id = await db.songs.add(song);
    notify();
    onMade({ piece: pieceOfSong({ ...song, id }), note: '오른손 멜로디 + 왼손 반주 (내 곡에 저장됨)', fifths });
  };
  if (!openCard) return <button className="secondary wide" onClick={() => setOpenCard(true)} data-testid="arrange-open">🎹 코드 붙여 왼손 반주 만들기</button>;
  return (
    <div className="card" data-testid="arrange">
      <div className="card-head"><b>코드 붙여 반주 만들기</b><button className="mini" onClick={() => setOpenCard(false)} aria-label="닫기">✕</button></div>
      <p className="hint">마디마다 코드를 <b>|</b> 로 나눠 적어요. 한 마디에 둘이면 띄어 쓰기 (<b>Am F</b>), 앞 마디 그대로는 <b>%</b>. 찬양 악보의 코드를 그대로 옮겨 적으면 돼요.</p>
      <textarea className="chord-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="C | G | Am F | G" data-testid="arrange-text" />
      <div className="row"><button className="secondary" onClick={auto} data-testid="arrange-auto">멜로디로 코드 자동 붙이기</button></div>
      <div className="chips">{LEFT_KINDS.map((x) => <button key={x.id} className={`chip mini${kind === x.id ? ' on' : ''}`} onClick={() => setKind(x.id)} title={x.note} data-testid={`left-${x.id}`}>{x.title}</button>)}</div>
      <p className="hint">{LEFT_KINDS.find((x) => x.id === kind)!.note}</p>
      <button className="primary" onClick={() => void make()} data-testid="arrange-make">반주 악보 만들기</button>
      {msg && <p className="hint" data-testid="arrange-msg">{msg}</p>}
    </div>
  );
}

type Open = { piece: Piece; composer?: string; note?: string; warnings?: string[]; fifths?: number };

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
        <ArrangeCard piece={p} fifths={open.fifths} onMade={(o) => setOpen(o)} />
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
        await db.songs.add({ title: s.title, composer: s.composer, beats: s.beats, timeNum: s.timeNum, timeDen: s.timeDen, bpm: s.bpm ?? 80, steps: s.steps, origin: 'import', fileName: f.name, createdAt: Date.now(), warnings: s.warnings, fifths: s.fifths });
        ok.push(s.title);
      } catch (e) { bad.push(`${f.name} (${(e as Error).message})`); }
    }
    notify();
    setBusy(false);
    setMsg([ok.length ? `불러온 곡: ${ok.join(', ')}` : '', bad.length ? `못 읽은 파일: ${bad.join(', ')}` : ''].filter(Boolean).join(' · '));
    if (file.current) file.current.value = '';
  };

  const pieceOfBuiltin = (b: (typeof BUILTIN_SONGS)[number]): Piece => ({ id: `song:${b.key}`, title: b.title, steps: b.steps, bpm: b.bpm, beats: b.beats, timeNum: b.timeNum, timeDen: b.timeDen, modes: ['wait', 'timed'], chords: b.chords, fifths: b.fifths });
  
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
              <button className="ex-item" onClick={() => setOpen({ piece: p, composer: b.composer, note: b.note, fifths: b.fifths })} data-testid={`song-${b.key}`}>
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
                <button className="ex-item" onClick={() => setOpen({ piece: p, composer: s.composer, warnings: s.warnings, fifths: s.fifths })} data-testid={`mysong-${s.id}`}>
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
