import { useSettings, setSettings } from '../state/settings';
import { piano } from '../audio/piano';
import { resumeAudio } from '../audio/context';
import { useMidi } from '../state/live';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const m = useMidi();
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="설정">
        <div className="card-head"><b>설정</b><button className="mini" onClick={onClose} aria-label="닫기">✕</button></div>
        <div className="row-setting col"><span>건반 이름</span>
          <div className="segmented small">
            <button className={s.labels === 'solfa' ? 'on' : ''} onClick={() => setSettings({ labels: 'solfa' })}>도 레 미</button>
            <button className={s.labels === 'letter' ? 'on' : ''} onClick={() => setSettings({ labels: 'letter' })}>C D E</button>
          </div>
        </div>
        <label className="row-setting"><input type="checkbox" checked={s.allNames} onChange={(e) => setSettings({ allNames: e.target.checked })} />모든 흰 건반에 이름 (끄면 도만)</label>
        <label className="row-setting"><input type="checkbox" checked={s.fingers} onChange={(e) => setSettings({ fingers: e.target.checked })} />손가락 번호 보이기</label>
        <div className="row-setting col"><span>앱 소리 (건반 칠 때)</span>
          <div className="segmented small">
            <button className={s.appSound === 'auto' ? 'on' : ''} onClick={() => setSettings({ appSound: 'auto' })}>자동</button>
            <button className={s.appSound === 'on' ? 'on' : ''} onClick={() => setSettings({ appSound: 'on' })}>항상</button>
            <button className={s.appSound === 'off' ? 'on' : ''} onClick={() => setSettings({ appSound: 'off' })}>끔</button>
          </div>
          <span className="hint">자동: 피아노를 치면 소리는 피아노에서만, 화면 건반을 누를 때는 앱이 소리를 내요.</span>
        </div>
        <label className="row-setting">앱 소리 크기<input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => { setSettings({ volume: Number(e.target.value) }); piano.setVolume(Number(e.target.value)); }} onPointerUp={async () => { await resumeAudio(); piano.noteOn(60, 80); setTimeout(() => piano.noteOff(60), 400); }} /></label>
        <label className="row-setting">메트로놈 크기<input type="range" min={0} max={1} step={0.05} value={s.clickVolume} onChange={(e) => setSettings({ clickVolume: Number(e.target.value) })} /></label>
        <label className="row-setting"><input type="checkbox" checked={s.computerKeys} onChange={(e) => setSettings({ computerKeys: e.target.checked })} />컴퓨터 키보드로 치기</label>
        <p className="hint">피아노: {m.status === 'ready' ? (m.devices.length ? m.devices.join(', ') : '연결된 기기 없음') : m.status === 'unsupported' ? 'Web MIDI 미지원 브라우저' : '연결 전'}</p>
        <p className="muted small">버전 {__APP_VERSION__}</p>
      </div>
    </div>
  );
}
