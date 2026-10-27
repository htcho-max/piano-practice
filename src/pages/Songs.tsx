import { useRef, useState } from 'react';
import { BUILTIN_SONGS } from '../songs/builtin';
import { db, notify, type Song } from '../data/db';
import { useQuery, useRuns } from '../state/useDB';
import { parseMusicXML, readScoreFile } from '../music/musicxml';
import { parseTextScore, PHOTO_PROMPT, type TextScore } from '../music/textscore';
import { transposeFifths, transposeSteps, transposeChords, keyName } from '../music/transpose';
import { PlayRunner, type Piece } from '../components/PlayRunner';
import { useBackLayer } from '../state/back';
import { bestScore } from '../data/progress';
import { barCount, onlyHand, totalBeats } from '../music/steps';
import { harmonize, type MelNote } from '../music/harmonize';
import { parseBarsText, barsText, leftHand, mergeHands, LEFT_KINDS, type LeftKind } from '../music/chordbook';
import { arrangeBoth, TWO_LEVELS, type TwoLevel } from '../music/melodyvoice';
import { colorize, COLOR_OPTS, type ColorOpts } from '../music/chordcolor';
import type { Mode } from '../lessons/lessons';

/** 코드가 있는 곡은 자유 반주도 */
const modesOf = (chords?: unknown[]): Mode[] => (chords?.length ? ['wait', 'timed', 'free'] : ['wait', 'timed']);

export const pieceOfSong = (s: Song): Piece => ({ id: `song:u${s.id}`, title: s.title, steps: s.steps, bpm: s.bpm, beats: s.beats, timeNum: s.timeNum, timeDen: s.timeDen, modes: modesOf(s.chords), chords: s.chords, pedalAt: s.pedalAt, fifths: s.fifths });

/** 멜로디(오른손 맨 위 음) → 코드 붙이기용 음 */
function melodyOf(p: Piece): MelNote[] {
  return p.steps.flatMap((st) => {
    const r = st.notes.filter((n) => n.hand === 'R');
    if (!r.length) return [];
    const top = r.reduce((a, b) => (b.midi > a.midi ? b : a));
    return [{ midi: top.midi, beat: st.beat, dur: top.len ?? st.dur }];
  });
}

type Kind = LeftKind | `two${TwoLevel}`;
const isTwo = (k: Kind): k is `two${TwoLevel}` => k.startsWith('two');

/** 코드로 반주 만들기: 오른손 멜로디는 그대로, 양손(멜로디 위 화음) 또는 왼손만 코드로 새로 */
function ArrangeCard({ piece, fifths, onMade }: { piece: Piece; fifths?: number; onMade: (o: Open) => void }) {
  const bars = barCount(piece.steps, piece.beats);
  const [openCard, setOpenCard] = useState(false);
  const [text, setText] = useState(() => (piece.chords?.length ? barsText(piece.chords, piece.beats, bars) : ''));
  const [kind, setKind] = useState<Kind>('two1');
  const [msg, setMsg] = useState<string | null>(null);
  const [col, setCol] = useState<ColorOpts>({ sus: true, add2: false, walk: true });
  const auto = () => {
    const mel = melodyOf(piece);
    if (!mel.length) { setMsg('오른손 멜로디가 없어요.'); return; }
    const r = harmonize(mel, { beatsPerBar: piece.beats, fifths });
    setText(barsText(r.spans, piece.beats, bars));
    setMsg(`${r.key.name} 조로 보고 코드를 붙였어요. 마음에 안 드는 마디는 고쳐 쓰세요.`);
  };
  /** 찬양 색채를 코드 글에 입힘 (고칠 수 있게 글로 보여 줌) */
  const paint = () => {
    const { spans, errors } = parseBarsText(text, piece.beats);
    if (errors.length || !spans.length) { setMsg(errors.length ? `못 읽은 코드: ${errors.join(', ')}` : '코드를 먼저 적어 주세요.'); return; }
    const mel = melodyOf(piece).filter((m): m is { midi: number; beat: number; dur: number } => m.midi !== null).map((m) => ({ beat: m.beat, len: m.dur, midi: m.midi }));
    const out = colorize(spans, col, piece.beats, fifths ?? 0, mel);
    const t = barsText(out, piece.beats, bars);
    setMsg(t === text ? '바꿀 곳이 없었어요.' : '색을 입혔어요. 마음에 안 드는 곳은 글에서 고쳐 쓰세요.');
    setText(t);
  };
  const make = async () => {
    const { spans, errors } = parseBarsText(text, piece.beats);
    if (errors.length) { setMsg(`못 읽은 코드: ${errors.join(', ')}`); return; }
    if (!spans.length) { setMsg('코드를 적거나 자동으로 붙여 주세요.'); return; }
    const right = onlyHand(piece.steps, 'R');
    const total = Math.max(totalBeats(piece.steps), bars * piece.beats);
    const lv = isTwo(kind) ? (Number(kind.slice(3)) as TwoLevel) : null;
    const steps = lv ? arrangeBoth(right, spans, lv, piece.beats, total, piece.timeDen) : mergeHands(right, leftHand(spans, kind as LeftKind, piece.beats), total);
    const label = lv ? `양손 ${'①②③④⑤'[lv - 1]}` : LEFT_KINDS.find((x) => x.id === kind)!.title;
    const song: Song = { title: `${piece.title.replace(/ · 반주\(.*\)$/, '')} · 반주(${label})`, beats: piece.beats, timeNum: piece.timeNum ?? piece.beats, timeDen: piece.timeDen ?? 4, bpm: piece.bpm, steps, origin: 'import', createdAt: Date.now(), chords: spans, pedalAt: spans.map((s) => s.beat), fifths };
    const id = await db.songs.add(song);
    notify();
    onMade({ piece: pieceOfSong({ ...song, id }), note: lv ? `멜로디가 맨 위인 양손 반주 ${'①②③④⑤'[lv - 1]} (내 곡에 저장됨)` : '오른손 멜로디 + 왼손 반주 (내 곡에 저장됨)', fifths });
  };
  if (!openCard) return <button className="secondary wide" onClick={() => setOpenCard(true)} data-testid="arrange-open">🎹 코드로 반주 만들기 (양손·왼손)</button>;
  return (
    <div className="card" data-testid="arrange">
      <div className="card-head"><b>코드 붙여 반주 만들기</b><button className="mini" onClick={() => setOpenCard(false)} aria-label="닫기">✕</button></div>
      <p className="hint">마디마다 코드를 <b>|</b> 로 나눠 적어요. 한 마디에 둘이면 띄어 쓰기 (<b>Am F</b>), 앞 마디 그대로는 <b>%</b>. 찬양 악보의 코드를 그대로 옮겨 적으면 돼요.</p>
      <textarea className="chord-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="C | G | Am F | G" data-testid="arrange-text" />
      <div className="row"><button className="secondary" onClick={auto} data-testid="arrange-auto">멜로디로 코드 자동 붙이기</button></div>
      <div className="arr-group">
        <span className="muted small">찬양 색 더하기</span>
        <div className="chips">
          {COLOR_OPTS.map((x) => <label key={x.id} className="chip mini check" title={x.note}><input type="checkbox" checked={col[x.id]} onChange={(e) => setCol({ ...col, [x.id]: e.target.checked })} data-testid={`col-${x.id}`} />{x.title}</label>)}
          <button className="secondary mini" onClick={paint} data-testid="arrange-paint">코드에 입히기</button>
        </div>
        <p className="hint small">{COLOR_OPTS.filter((x) => col[x.id]).map((x) => x.note).join(' · ') || '고른 색이 없어요'}</p>
      </div>
      <div className="arr-group">
        <span className="muted small">양손 — 멜로디가 맨 위인 화음 (단계별로)</span>
        <div className="chips">{TWO_LEVELS.map((x) => <button key={x.id} className={`chip mini${kind === `two${x.id}` ? ' on' : ''}`} onClick={() => setKind(`two${x.id}`)} title={x.note} data-testid={`two-${x.id}`}>{x.title}</button>)}</div>
      </div>
      <div className="arr-group">
        <span className="muted small">왼손만 (오른손은 멜로디)</span>
        <div className="chips">{LEFT_KINDS.map((x) => <button key={x.id} className={`chip mini${kind === x.id ? ' on' : ''}`} onClick={() => setKind(x.id)} title={x.note} data-testid={`left-${x.id}`}>{x.title}</button>)}</div>
      </div>
      <p className="hint">{isTwo(kind) ? TWO_LEVELS.find((x) => `two${x.id}` === kind)!.note : LEFT_KINDS.find((x) => x.id === kind)!.note}</p>
      {isTwo(kind) && <p className="hint">만든 반주는 <b>①부터 차례로</b>. 익숙해지면 연습 방법의 <b>자유 반주</b>로 악보 없이 내 화음을 넣어 봐요.</p>}
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
  const [paste, setPaste] = useState(false);
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
        <SongEdit open={open} onMade={(o) => setOpen(o)} />
      </div>
    );
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    const ok: string[] = [], bad: string[] = [];
    for (const f of Array.from(files)) {
      try {
        if (/\.txt$/i.test(f.name)) {
          const t = parseTextScore(await f.text());
          await db.songs.add(songOfText(t, f.name));
          ok.push(t.title);
          continue;
        }
        const xml = await readScoreFile(f);
        const s = parseMusicXML(xml);
        await db.songs.add({ title: s.title, composer: s.composer, beats: s.beats, timeNum: s.timeNum, timeDen: s.timeDen, bpm: s.bpm ?? 80, steps: s.steps, origin: 'import', fileName: f.name, createdAt: Date.now(), warnings: s.warnings, fifths: s.fifths, chords: s.chords.length ? s.chords : undefined });
        ok.push(s.title);
      } catch (e) { bad.push(`${f.name} (${(e as Error).message})`); }
    }
    notify();
    setBusy(false);
    setMsg([ok.length ? `불러온 곡: ${ok.join(', ')}` : '', bad.length ? `못 읽은 파일: ${bad.join(', ')}` : ''].filter(Boolean).join(' · '));
    if (file.current) file.current.value = '';
  };

  const pieceOfBuiltin = (b: (typeof BUILTIN_SONGS)[number]): Piece => ({ id: `song:${b.key}`, title: b.title, steps: b.steps, bpm: b.bpm, beats: b.beats, timeNum: b.timeNum, timeDen: b.timeDen, modes: modesOf(b.chords), chords: b.chords, fifths: b.fifths });
  
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
        <input ref={file} type="file" accept=".musicxml,.xml,.mxl,.txt,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml,text/plain" multiple hidden onChange={(e) => void onFiles(e.target.files)} data-testid="song-file" />
        <div className="row">
          <button className="secondary" onClick={() => file.current?.click()} disabled={busy}>{busy ? '읽는 중…' : '＋ 악보 파일 불러오기'}</button>
          <button className="secondary" onClick={() => setPaste(!paste)} data-testid="paste-open">✎ 글 악보 붙여넣기</button>
        </div>
        {paste && <PasteCard onSaved={(o) => { setPaste(false); setOpen(o); }} />}
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

function songOfText(t: TextScore, fileName?: string): Song {
  return { title: t.title, composer: t.composer, beats: t.beats, timeNum: t.timeNum, timeDen: t.timeDen, bpm: t.bpm, steps: t.steps, origin: 'import', fileName, createdAt: Date.now(), warnings: t.warnings.length ? t.warnings : undefined, fifths: t.fifths, chords: t.chords.length ? t.chords : undefined, pedalAt: undefined };
}

/** 글 악보 붙여넣기 (사진 악보를 Claude 가 옮긴 것) */
function PasteCard({ onSaved }: { onSaved: (o: Open) => void }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const save = async () => {
    try {
      const t = parseTextScore(text);
      const song = songOfText(t);
      const id = await db.songs.add(song);
      notify();
      onSaved({ piece: pieceOfSong({ ...song, id }), composer: t.composer, warnings: t.warnings, fifths: t.fifths });
    } catch (e) { setMsg((e as Error).message); }
  };
  const check = () => { try { const t = parseTextScore(text); setMsg(t.warnings.length ? `확인할 곳: ${t.warnings.join(' / ')}` : `좋아요: ${t.title} · ${t.timeNum}/${t.timeDen} · 음 ${t.steps.reduce((a, s) => a + s.notes.length, 0)}개`); } catch (e) { setMsg((e as Error).message); } };
  return (
    <div className="card paste" data-testid="paste">
      <p className="hint"><b>사진 악보 → 앱 악보</b>: 악보 사진을 Claude 에게 보내며 아래 요청 글을 같이 붙이면, 이 칸에 넣을 글 악보로 옮겨 줘요. 찬양 악보(멜로디 + 코드)도 돼요.</p>
      <div className="row">
        <button className="secondary" onClick={() => setShowPrompt(!showPrompt)} data-testid="prompt-show">📷 요청 글 보기</button>
        <button className="secondary" onClick={() => { void navigator.clipboard?.writeText(PHOTO_PROMPT).then(() => setMsg('요청 글을 복사했어요. Claude 에게 사진과 함께 붙여 넣으세요.'), () => setShowPrompt(true)); }}>요청 글 복사</button>
      </div>
      {showPrompt && <pre className="prompt" data-testid="prompt">{PHOTO_PROMPT}</pre>}
      <textarea className="chord-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'@TITLE 곡 제목\n@TIME 4/4\n@KEY G\n@CHORDS G | D | Em C | D\nR: D4/q G4/q B4/q G4/q | ...\nL: G2/w | ...'} data-testid="paste-text" />
      <div className="row"><button className="secondary" onClick={check} data-testid="paste-check">확인</button><button className="primary" onClick={() => void save()} data-testid="paste-save">곡으로 저장</button></div>
      {msg && <p className="hint" data-testid="paste-msg">{msg}</p>}
    </div>
  );
}

/** 곡 정보: 이름 바꾸기(내 곡), 조 옮기기(새 곡으로 저장) */
function SongEdit({ open, onMade }: { open: Open; onMade: (o: Open) => void }) {
  const p = open.piece;
  const uid = p.id.startsWith('song:u') ? Number(p.id.slice(6)) : null;
  const [title, setTitle] = useState(p.title);
  const [n, setN] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const f0 = open.fifths ?? 0;
  const f1 = transposeFifths(f0, n);
  const rename = async () => { if (uid === null || !title.trim()) return; await db.songs.update(uid, { title: title.trim() }); notify(); setMsg('이름을 바꿨어요.'); };
  const transpose = async () => {
    if (!n) return;
    const song: Song = { title: `${p.title} (${keyName(f0)}→${keyName(f1)})`, composer: open.composer, beats: p.beats, timeNum: p.timeNum ?? p.beats, timeDen: p.timeDen ?? 4, bpm: p.bpm, steps: transposeSteps(p.steps, n, f1), origin: 'import', createdAt: Date.now(), chords: transposeChords(p.chords, n, f1), pedalAt: p.pedalAt, fifths: f1 };
    const id = await db.songs.add(song);
    notify();
    onMade({ piece: pieceOfSong({ ...song, id }), composer: open.composer, note: `${keyName(f0)} → ${keyName(f1)} 로 옮김 (내 곡에 저장됨)`, fifths: f1 });
  };
  return (
    <details className="card song-edit">
      <summary>곡 정보 · 조 옮기기</summary>
      {uid !== null && (
        <div className="row-setting"><input className="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="곡 이름" /><button className="secondary" onClick={() => void rename()}>이름 바꾸기</button></div>
      )}
      <div className="row-setting">
        <span className="muted small">조 옮기기</span>
        <button className="mini" onClick={() => setN(n - 1)} data-testid="tr-down">−</button>
        <b data-testid="tr-label">{keyName(f0)} → {keyName(f1)} ({n > 0 ? '+' : ''}{n})</b>
        <button className="mini" onClick={() => setN(n + 1)} data-testid="tr-up">+</button>
        <button className="secondary" onClick={() => void transpose()} disabled={!n} data-testid="tr-save">옮긴 악보 저장</button>
      </div>
      <p className="hint">찬양 인도자와 조가 다를 때, 또는 노래하기 편한 높이로. 코드 이름도 함께 바뀌어요.</p>
      {msg && <p className="hint">{msg}</p>}
    </details>
  );
}
