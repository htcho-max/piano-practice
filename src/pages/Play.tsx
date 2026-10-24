import { useEffect, useState } from 'react';
import { Keyboard } from '../components/Keyboard';
import { ConnectCard } from '../components/ConnectCard';
import { useHeld, useMidi } from '../state/live';
import { label, noteName } from '../music/notes';
import { useSettings } from '../state/settings';
import { metronome, type Tick } from '../audio/metronome';
import { onInput, sustainValue } from '../midi/input';
import { chordName } from '../music/chords';

/** 자유롭게 치기: 연결 확인, 누른 음·화음 이름, 메트로놈 */
export function Play() {
  const held = useHeld();
  const s = useSettings();
  const midi = useMidi();
  const [oct, setOct] = useState<'small' | 'full'>(() => (window.innerWidth >= 900 ? 'full' : 'small'));
  const [vel, setVel] = useState<number | null>(null);
  const [pedal, setPedal] = useState(sustainValue());
  useEffect(() => onInput((e) => { if (e.kind === 'on') setVel(e.vel); if (e.kind === 'pedal' && e.cc === 64) setPedal(e.value); }), []);
  const range: [number, number] = oct === 'full' ? [21, 108] : [48, 84];
  const chord = chordName(held);
  return (
    <div className="page">
      <ConnectCard compact={midi.status === 'ready' && midi.devices.length > 0} />
      <div className="card now-playing">
        <div className="np-notes" data-testid="held">{held.length ? held.map((m) => `${label(m, s.labels)}${s.labels === 'solfa' ? `(${noteName(m)})` : ''}`).join(' ') : '건반을 눌러 보세요'}</div>
        <div className="np-sub">
          {chord && <span className="badge good" data-testid="chord">{chord}</span>}
          {vel !== null && <span className="muted small">세기 {vel}/127</span>}
          <span className="muted small">페달 {pedal >= 64 ? '밟음' : pedal > 0 ? `반 (${pedal})` : '뗌'}</span>
        </div>
      </div>
      <div className="segmented small">
        <button className={oct === 'small' ? 'on' : ''} onClick={() => setOct('small')}>3옥타브</button>
        <button className={oct === 'full' ? 'on' : ''} onClick={() => setOct('full')}>88건반 전체</button>
      </div>
      <div className="kb-scroll"><Keyboard lo={range[0]} hi={range[1]} compact={oct === 'full'} /></div>
      <MetronomeCard />
      {s.computerKeys && <p className="hint">컴퓨터에서는 A W S E D F T G Y H U J K 키로도 칠 수 있어요 (Z/X 옥타브).</p>}
    </div>
  );
}

function MetronomeCard() {
  const [bpm, setBpm] = useState(80);
  const [beats, setBeats] = useState(4);
  const [on, setOn] = useState(metronome.running);
  const [beat, setBeat] = useState(-1);
  const s = useSettings();
  useEffect(() => metronome.onTick((t: Tick) => setBeat(t.beat)), []);
  useEffect(() => () => { metronome.stop(); }, []);
  const restart = (b: number, n: number) => { if (on) { metronome.volume = s.clickVolume; void metronome.start({ bpm: b, beats: n }); } };
  const change = (d: number) => { const b = Math.max(30, Math.min(220, bpm + d)); setBpm(b); restart(b, beats); };
  return (
    <div className="card">
      <div className="card-head"><b>메트로놈</b>
        <div className="beats">{Array.from({ length: beats }, (_, i) => <span key={i} className={`dot${i === 0 ? ' first' : ''}${on && beat === i ? ' on' : ''}`} />)}</div>
      </div>
      <div className="row-setting">
        <button className="mini" onClick={() => change(-5)}>−5</button>
        <button className="mini" onClick={() => change(-1)}>−1</button>
        <b className="bpm-num" data-testid="metro-bpm">♩{bpm}</b>
        <button className="mini" onClick={() => change(1)}>+1</button>
        <button className="mini" onClick={() => change(5)}>+5</button>
        <select value={beats} onChange={(e) => { const n = Number(e.target.value); setBeats(n); restart(bpm, n); }} aria-label="박자">
          {[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}/4</option>)}
        </select>
      </div>
      <button className={`primary wide${on ? ' stop' : ''}`} data-testid="metro-toggle" onClick={async () => {
        if (on) { metronome.stop(); setOn(false); setBeat(-1); } else { metronome.volume = s.clickVolume; await metronome.start({ bpm, beats }); setOn(true); }
      }}>{on ? '■ 멈추기' : '▶ 시작'}</button>
    </div>
  );
}
