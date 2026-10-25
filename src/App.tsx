import { useEffect, useState } from 'react';
import { TabBar, type TabId } from './components/TabBar';
import { SettingsSheet } from './components/SettingsSheet';
import { Today } from './pages/Today';
import { Learn, type LearnTarget } from './pages/Learn';
import { Play } from './pages/Play';
import { Songs } from './pages/Songs';
import { Log } from './pages/Log';
import { useBackLayer, setExitWarning, restoreGuard } from './state/back';
import { useMidi } from './state/live';

const TITLES: Record<TabId, string> = { today: '오늘의 연습', learn: '배우기', songs: '곡 연습', play: '건반', log: '연습 기록' };

export function App({ updatedFrom = null }: { updatedFrom?: string | null }) {
  const [toast, setToast] = useState<string | null>(updatedFrom ? `새 버전으로 업데이트됐어요 · ${__APP_VERSION__}` : null);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 6000); return () => clearTimeout(id); }, [toast]);
  const [tab, setTab] = useState<TabId>(() => { try { return (localStorage.getItem('piano-tab') as TabId) || 'today'; } catch { return 'today'; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [target, setTarget] = useState<LearnTarget>(null);
  const midi = useMidi();
  const connected = midi.status === 'ready' && midi.devices.length > 0;
  const go = (t: TabId) => { setTab(t); try { localStorage.setItem('piano-tab', t); } catch { /* 무시 */ } };
  useBackLayer(tab !== 'today', () => go('today'));
  useBackLayer(settingsOpen, () => setSettingsOpen(false));
  useEffect(() => {
    setExitWarning(() => setToast('뒤로 버튼을 한 번 더 누르면 앱이 닫혀요'));
    const again = () => restoreGuard();
    window.addEventListener('pointerdown', again);
    return () => { setExitWarning(null); window.removeEventListener('pointerdown', again); };
  }, []);
  // 연결되면 한 번 알려 줌
  const [wasConnected, setWasConnected] = useState(connected);
  useEffect(() => { if (connected && !wasConnected) setToast(`🎹 ${midi.devices[0]} 연결됨`); setWasConnected(connected); }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEx = (lessonId: string, exId?: string) => { setTarget({ lessonId, exId, seq: Date.now() }); go('learn'); };

  return (
    <div className="app">
      <header className="topbar">
        <h1>{TITLES[tab]}</h1>
        <div className="top-right">
          <button className={`pill${connected ? ' ok' : ''}`} onClick={() => go('play')} data-testid="top-midi">{connected ? '🎹 연결됨' : '🎹 화면 건반'}</button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="설정">⚙</button>
        </div>
      </header>
      <main>
        {tab === 'today' && <Today openEx={openEx} />}
        {tab === 'learn' && <Learn target={target} />}
        {tab === 'songs' && <Songs />}
        {tab === 'play' && <Play />}
        {tab === 'log' && <Log />}
      </main>
      <TabBar tab={tab} onChange={(t) => { if (t === 'learn' && tab === 'learn') setTarget({ lessonId: '', seq: Date.now() }); go(t); }} />
      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {toast && <div className="toast" role="status" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}
