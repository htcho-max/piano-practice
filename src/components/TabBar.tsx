export type TabId = 'today' | 'learn' | 'play' | 'log';
export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today', label: '오늘', icon: '◎' },
  { id: 'learn', label: '배우기', icon: '♪' },
  { id: 'play', label: '건반', icon: '▥' },
  { id: 'log', label: '기록', icon: '▦' },
];

export function TabBar({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.id} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => onChange(t.id)} aria-current={t.id === tab}>
          <span className="tab-icon" aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
