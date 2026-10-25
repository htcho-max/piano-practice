import { useMemo, useState } from 'react';
import { Keyboard, type KeyMark } from '../components/Keyboard';
import { ChordDrill } from '../components/ChordDrill';
import { VoiceDrill } from '../components/VoiceDrill';
import { voiceItems } from '../music/melodyvoice';
import { PlayRunner, type Piece } from '../components/PlayRunner';
import { Play } from './Play';
import { QUALITIES, KEYS, PROGRESSIONS, PATTERNS, parseChord, matchChord, rhFingers, bassNote, rootName, progressionChords, accompany, FLAT_KEYS, type PatternId } from '../music/chordbook';
import { useHeld } from '../state/live';
import { useRuns } from '../state/useDB';
import { SCALES, findScale, scaleId, scaleSteps, arpeggioSteps, hanon1, ARPEGGIOS } from '../music/scales';
import { piano } from '../audio/piano';
import { resumeAudio } from '../audio/context';
import { perfToAudio } from '../audio/metronome';

type Sub = 'dict' | 'drill' | 'voice' | 'acc' | 'scales' | 'free';
const SUBS: { id: Sub; label: string }[] = [{ id: 'dict', label: '코드 사전' }, { id: 'drill', label: '코드 바꾸기' }, { id: 'voice', label: '보이싱' }, { id: 'acc', label: '반주 패턴' }, { id: 'scales', label: '음계' }, { id: 'free', label: '자유 연주' }];

function load<T extends string>(k: string, d: T): T { try { return (localStorage.getItem(k) as T) || d; } catch { return d; } }
function save(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 무시 */ } }

export function Chords() {
  const [sub, setSubState] = useState<Sub>(() => load('piano-chords-sub', 'dict'));
  const setSub = (s: Sub) => { setSubState(s); save('piano-chords-sub', s); };
  return (
    <div className="page">
      <div className="segmented small subtabs" role="tablist">
        {SUBS.map((s) => <button key={s.id} className={sub === s.id ? 'on' : ''} onClick={() => setSub(s.id)} data-testid={`sub-${s.id}`}>{s.label}</button>)}
      </div>
      {sub === 'dict' && <Dict />}
      {sub === 'drill' && <Drill />}
      {sub === 'voice' && <Voice />}
      {sub === 'acc' && <Acc />}
      {sub === 'scales' && <Scales />}
      {sub === 'free' && <Play />}
    </div>
  );
}

/* ── 코드 사전 ── */
function Dict() {
  const [root, setRoot] = useState(0);
  const [q, setQ] = useState('');
  const [inv, setInv] = useState(0);
  const [flat, setFlat] = useState(false);
  const held = useHeld();
  const name = rootName(root, flat) + q;
  const c = parseChord(name)!;
  // 자리바꿈: 기본(근음 아래) → 1전위(3음 아래) → 2전위(5음 아래)
  const v = useMemo(() => {
    // 기본 자리: 근음을 솔3~파#4 사이에 두고 위로 쌓기
    const r = 55 + ((c.root - 55 % 12 + 12) % 12);
    const out = (c.pcs.length > 3 && c.quality !== '2' ? c.pcs.slice(0, 4) : c.pcs).map((p) => { let m = r + ((p - c.root + 12) % 12); if (p !== c.root && m <= r) m += 12; return m; }).sort((a, b) => a - b);
    for (let k = 0; k < inv; k++) { const lo = out.shift()!; out.push(lo + 12); }
    while (out[0] > 64) out.forEach((_, i) => (out[i] -= 12));
    return out;
  }, [c, inv]);
  const f = rhFingers(v);
  const marks = new Map<number, KeyMark>();
  v.forEach((m, i) => marks.set(m, { hand: 'R', finger: f[i], kind: 'now' }));
  marks.set(bassNote(c), { hand: 'L', finger: 5, kind: 'now' });
  const m = matchChord(held, c);
  const play = async () => {
    await resumeAudio();
    const t = performance.now() + 100;
    piano.schedule(bassNote(c), 70, perfToAudio(t), 1.6);
    v.forEach((n, i) => piano.schedule(n, 75, perfToAudio(t + 250 + i * 180), 1.2 - i * 0.18));
    v.forEach((n) => piano.schedule(n, 80, perfToAudio(t + 1100), 1.2));
  };
  const invNames = v.length === 3 ? ['기본 자리', '1전위', '2전위'] : ['기본 자리', '1전위', '2전위', '3전위'];
  return (
    <>
      <div className="card">
        <div className="root-grid">
          {Array.from({ length: 12 }, (_, i) => (
            <button key={i} className={`chip mini${root === i ? ' on' : ''}`} onClick={() => { setRoot(i); setInv(0); }} data-testid={`root-${i}`}>{rootName(i, flat || FLAT_KEYS.has(i) && [1, 3, 8, 10].includes(i))}</button>
          ))}
        </div>
        <label className="row-setting small"><input type="checkbox" checked={flat} onChange={(e) => setFlat(e.target.checked)} />검은 건반을 ♭ 이름으로</label>
        <div className="chips">
          {QUALITIES.map((x) => <button key={x.id} className={`chip mini${q === x.id ? ' on' : ''}`} onClick={() => { setQ(x.id); setInv(0); }}>{x.label}</button>)}
        </div>
      </div>
      <div className={`card chord-now${m === 'ok' ? ' ok' : ''}`}>
        <div className="chord-big" data-testid="dict-name">{name}</div>
        <div className="muted small">구성음: {c.pcs.map((p) => rootName(p, flat || c.flat)).join(' · ')} · 오른손 {f.join('-')}번, 왼손 근음</div>
        <div className="segmented small">{invNames.map((n, i) => <button key={n} className={inv === i ? 'on' : ''} onClick={() => setInv(i)}>{n}</button>)}</div>
        <div className="row"><button className="secondary" onClick={play}>▶ 들어 보기</button>
          <span className="muted small" data-testid="dict-check">{held.length === 0 ? '피아노로 눌러 보세요' : m === 'ok' ? `✓ ${name} 맞아요` : m === 'partial' ? '조금 모자라요' : '다른 음이 섞였어요'}</span></div>
      </div>
      <div className="kb-scroll"><Keyboard lo={36} hi={84} marks={marks} /></div>
    </>
  );
}

/* ── 코드 바꾸기 ── */
function Drill() {
  const [prog, setProg] = useState<string>(() => load('piano-drill-prog', 'basic'));
  const [key, setKey] = useState(() => Number(load('piano-drill-key', '0')));
  const p = PROGRESSIONS.find((x) => x.id === prog) ?? PROGRESSIONS[0];
  const chords = progressionChords(p, key);
  return (
    <>
      <ProgPicker prog={prog} setProg={(v) => { setProg(v); save('piano-drill-prog', v); }} keyPc={key} setKey={(v) => { setKey(v); save('piano-drill-key', String(v)); }} />
      <p className="hint">{p.note}. 진행: <b>{chords.join(' – ')}</b> (두 바퀴)</p>
      <ChordDrill key={`${prog}:${key}`} id={`chord:${prog}:${key}`} lessonId="chords" chords={chords} rounds={2} />
    </>
  );
}

/* ── 보이싱: 멜로디(맨 위 음)가 주어진 코드 ── */
function Voice() {
  const [prog, setProg] = useState<string>(() => load('piano-voice-prog', 'basic'));
  const [key, setKey] = useState(() => Number(load('piano-voice-key', '0')));
  const p = PROGRESSIONS.find((x) => x.id === prog) ?? PROGRESSIONS[0];
  const items = useMemo(() => voiceItems([...progressionChords(p, key), ...progressionChords(p, key)]), [p, key]);
  return (
    <>
      <ProgPicker prog={prog} setProg={(v) => { setProg(v); save('piano-voice-prog', v); }} keyPc={key} setKey={(v) => { setKey(v); save('piano-voice-key', String(v)); }} />
      <p className="hint">찬양 반주처럼 <b>멜로디를 맨 위</b>에 두는 연습. 맨 위 음이 바뀌면 같은 코드도 자리가 달라져요. 진행: <b>{items.map((x) => x.chord).join(' – ')}</b></p>
      <VoiceDrill key={`${prog}:${key}`} id={`voice:${prog}:${key}`} lessonId="chords" items={items} />
    </>
  );
}

function ProgPicker({ prog, setProg, keyPc, setKey }: { prog: string; setProg: (v: string) => void; keyPc: number; setKey: (v: number) => void }) {
  return (
    <div className="card">
      <div className="row-setting col"><span className="muted small">진행</span>
        <select value={prog} onChange={(e) => setProg(e.target.value)} data-testid="prog">{PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
      </div>
      <div className="row-setting"><span className="muted small">조</span>
        <div className="chips">{KEYS.map((k) => <button key={k.pc} className={`chip mini${keyPc === k.pc ? ' on' : ''}`} onClick={() => setKey(k.pc)} data-testid={`key-${k.name}`}>{k.name}</button>)}</div>
      </div>
    </div>
  );
}

/* ── 반주 패턴 ── */
function Acc() {
  const [prog, setProg] = useState<string>(() => load('piano-acc-prog', 'pop'));
  const [key, setKey] = useState(() => Number(load('piano-acc-key', '0')));
  const [pat, setPat] = useState<PatternId>(() => load('piano-acc-pat', 'block') as PatternId);
  const p = PROGRESSIONS.find((x) => x.id === prog) ?? PROGRESSIONS[0];
  const pi = PATTERNS.find((x) => x.id === pat)!;
  const piece: Piece = useMemo(() => accPiece(progressionChords(p, key), pat, `acc:${prog}:${key}:${pat}`, `${p.title} · ${pi.title}`), [p, key, pat, prog, pi.title]);
  return (
    <>
      <ProgPicker prog={prog} setProg={(v) => { setProg(v); save('piano-acc-prog', v); }} keyPc={key} setKey={(v) => { setKey(v); save('piano-acc-key', String(v)); }} />
      <div className="card">
        <div className="chips">{PATTERNS.map((x) => <button key={x.id} className={`chip mini${pat === x.id ? ' on' : ''}`} onClick={() => { setPat(x.id); save('piano-acc-pat', x.id); }} data-testid={`pat-${x.id}`}>{x.title}</button>)}</div>
        <p className="hint">{pi.note}. 코드가 바뀌는 곳에서 페달을 뗐다 다시 밟으면 페달도 채점해요.</p>
      </div>
      <PlayRunner key={piece.id} ex={piece} lessonId="acc" song />
    </>
  );
}

/** 코드들(한 마디씩, 두 바퀴) + 패턴 → 연습 */
export function accPiece(chords: string[], pat: PatternId, id: string, title: string, bpm = 66): Piece {
  const beats = PATTERNS.find((x) => x.id === pat)!.beats;
  const all = [...chords, ...chords];
  const spans = all.map((name, i) => ({ name, beat: i * beats, dur: beats }));
  const { steps, pedalAt } = accompany(spans, pat);
  return { id, title, steps, bpm, beats, timeNum: beats, timeDen: 4, modes: ['wait', 'timed'], chords: spans, pedalAt: pat === 'eight' ? undefined : pedalAt };
}

/* ── 음계·아르페지오·하농 ── */
function Scales() {
  const runs = useRuns();
  const [what, setWhat] = useState<'scale' | 'arp' | 'hanon'>(() => load('piano-sc-what', 'scale') as 'scale' | 'arp' | 'hanon');
  const [sid, setSid] = useState<string>(() => load('piano-sc-id', 'M0'));
  const [arp, setArp] = useState<string>(() => load('piano-sc-arp', 'C'));
  const [hands, setHands] = useState<'R' | 'L' | 'B'>(() => load('piano-sc-hands', 'R') as 'R' | 'L' | 'B');
  const [oct, setOct] = useState<1 | 2>(() => (load<string>('piano-sc-oct', '1') === '2' ? 2 : 1));
  const set = <T,>(k: string, f: (v: T) => void) => (v: T) => { f(v); save(k, String(v)); };
  const sc = findScale(sid) ?? SCALES[0];
  const best = (prefix: string) => { const xs = runs.filter((r) => r.exId.startsWith(prefix) && r.mode === 'timed').map((r) => r.score); return xs.length ? Math.max(...xs) : null; };
  const piece: Piece = useMemo(() => {
    if (what === 'hanon') return { id: `hanon1:${hands}`, title: '하농 1번', steps: hanon1(hands), bpm: 60, beats: 4, modes: ['wait', 'timed'], sheet: true };
    if (what === 'arp') return { id: `arp:${arp}:${hands}`, title: `${arp} 아르페지오`, steps: arpeggioSteps(arp, hands), bpm: 60, beats: 4, modes: ['wait', 'timed'], sheet: true, fifths: ({ C: 0, F: -1, G: 1, Am: 0, Dm: -1, Em: 1 } as Record<string, number>)[arp] };
    return { id: `scale:${sid}:${hands}:${oct}`, title: sc.name, steps: scaleSteps(sc, { hands, octaves: oct, rhythm: oct === 2 ? 'e' : 'q' }), bpm: oct === 2 ? 60 : 72, beats: 4, modes: ['wait', 'timed'], sheet: true, fifths: sc.fifths };
  }, [what, sid, arp, hands, oct, sc]);
  return (
    <>
      <div className="segmented small">
        {(['scale', 'arp', 'hanon'] as const).map((w) => <button key={w} className={what === w ? 'on' : ''} onClick={() => set('piano-sc-what', setWhat)(w)} data-testid={`sc-${w}`}>{{ scale: '음계 24조', arp: '아르페지오', hanon: '하농 1번' }[w]}</button>)}
      </div>
      <div className="card">
        {what === 'scale' && (
          <>
            <div className="scale-grid">
              {SCALES.map((x) => {
                const b = best(`scale:${scaleId(x)}:`);
                return <button key={scaleId(x)} className={`chip mini${sid === scaleId(x) ? ' on' : ''}${b !== null && b >= 80 ? ' done' : ''}`} onClick={() => set('piano-sc-id', setSid)(scaleId(x))} data-testid={`scale-${scaleId(x)}`} title={b !== null ? `최고 ${b}점` : ''}>{x.name.replace(' 장조', '').replace(' 단조', '')}</button>;
              })}
            </div>
            <p className="hint">윗줄 장조, 아랫줄 화성단음계 (조표 순서). 박자 맞춰 80점을 넘으면 초록. 오른손 {sc.rh.join('')} · 왼손 {sc.lh.join('')}</p>
          </>
        )}
        {what === 'arp' && <div className="chips">{ARPEGGIOS.map((a) => <button key={a.id} className={`chip mini${arp === a.id ? ' on' : ''}`} onClick={() => set('piano-sc-arp', setArp)(a.id)}>{a.id}</button>)}</div>}
        {what === 'hanon' && <p className="hint">샤를루이 하농 『60개의 연습곡』 1번 (1873). 다섯 손가락을 고르게 — 처음엔 ♩60 기다려 주기로, 손목은 가만히, 손가락만 또박또박.</p>}
        <div className="row-setting">
          <div className="segmented small">{(['R', 'L', 'B'] as const).map((h) => <button key={h} className={hands === h ? 'on' : ''} onClick={() => set('piano-sc-hands', setHands)(h)} data-testid={`sch-${h}`}>{{ R: '오른손', L: '왼손', B: '양손' }[h]}</button>)}</div>
          {what === 'scale' && <div className="segmented small">{([1, 2] as const).map((o) => <button key={o} className={oct === o ? 'on' : ''} onClick={() => set('piano-sc-oct', setOct)(o)}>{o}옥타브</button>)}</div>}
        </div>
        {what === 'scale' && <p className="hint">엄지는 <b>손바닥 밑으로</b> 미리 가져가 두고, 3·4번이 엄지 위로 <b>건너갈 때</b> 손목이 튀지 않게.</p>}
      </div>
      <PlayRunner key={piece.id} ex={piece} lessonId="tech" song />
    </>
  );
}
