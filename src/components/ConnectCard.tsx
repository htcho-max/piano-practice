import { useState } from 'react';
import { connectMidi } from '../midi/input';
import { useMidi } from '../state/live';

/** 피아노 연결 안내 + 버튼 */
export function ConnectCard({ compact = false }: { compact?: boolean }) {
  const m = useMidi();
  const [open, setOpen] = useState(!compact);
  const connected = m.status === 'ready' && m.devices.length > 0;
  return (
    <div className={`card connect ${connected ? 'ok' : ''}`} data-testid="connect-card">
      <div className="card-head">
        <b>{connected ? `🎹 ${m.devices.join(', ')}` : '피아노 연결'}</b>
        <span className={`badge ${connected ? 'good' : ''}`} data-testid="midi-status">
          {connected ? '연결됨' : m.status === 'unsupported' ? '이 브라우저는 안 돼요' : m.status === 'denied' ? '허락 안 됨' : m.status === 'asking' ? '확인 중…' : m.status === 'ready' ? '피아노를 찾는 중' : '연결 전'}
        </span>
      </div>
      {!connected && m.status !== 'unsupported' && (
        <button className="primary" onClick={() => void connectMidi()} data-testid="connect">{m.status === 'ready' ? '다시 찾기' : '피아노 연결하기'}</button>
      )}
      {m.status === 'unsupported' && <p className="hint">Web MIDI 를 지원하는 크롬(안드로이드·PC)에서 열어 주세요. 그동안은 화면 건반으로 연습할 수 있어요.</p>}
      {m.status === 'denied' && <p className="hint">브라우저가 MIDI 사용을 허락하지 않았어요. 주소창 왼쪽 자물쇠 → 사이트 설정 → MIDI 기기 → 허용 후 다시 눌러 주세요.</p>}
      {m.status === 'ready' && !connected && <p className="hint">연결된 피아노가 안 보여요. 케이블과 피아노 전원을 확인하고 &quot;다시 찾기&quot;를 눌러 주세요.</p>}
      {!connected && (compact ? <button className="link small muted" onClick={() => setOpen(!open)}>{open ? '연결 방법 접기' : '연결 방법 보기'}</button> : null)}
      {!connected && open && (
        <ol className="howto">
          <li>롤랜드 F107 밑면의 <b>USB Computer</b> 단자(네모난 B타입)에 <b>USB-B ↔ USB-C</b> 케이블을 꽂아요.</li>
          <li>반대쪽을 갤럭시 탭에 꽂고, 피아노 전원을 켜요.</li>
          <li>위의 <b>피아노 연결하기</b>를 누르고, 크롬이 MIDI 기기 사용을 물으면 <b>허용</b>.</li>
          <li>건반을 눌러 아래 화면 건반에 표시되면 끝! 다음부터는 앱을 열면 자동으로 연결돼요.</li>
        </ol>
      )}
      {connected && !compact && <p className="hint">건반을 누르면 화면에 바로 보여요. 연습할 때 소리는 피아노에서 나고, 앱은 &quot;들어 보기&quot;와 메트로놈 소리만 내요.</p>}
    </div>
  );
}
