import { registerSW } from 'virtual:pwa-register';
import { metronome } from '../audio/metronome';

const KEY = 'piano-app-version';

/** 새 버전은 받아 두었다가, 메트로놈·채점 중이 아닐 때 새로고침 */
export function setupUpdates(): { updatedFrom: string | null } {
  let waiting: ReturnType<typeof setInterval> | null = null;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (waiting) return;
      const tryApply = () => { if (metronome.running) return; if (waiting) clearInterval(waiting); updateSW(true); };
      waiting = setInterval(tryApply, 5000);
      tryApply();
    },
    onRegisteredSW(_url, reg) { if (reg) setInterval(() => { reg.update().catch(() => {}); }, 60 * 60 * 1000); },
  });
  if ('serviceWorker' in navigator) {
    const had = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had || reloading) return;
      reloading = true;
      const tryReload = () => { if (metronome.running) { setTimeout(tryReload, 5000); return; } location.reload(); };
      tryReload();
    });
  }
  let prev: string | null = null;
  try { prev = localStorage.getItem(KEY); localStorage.setItem(KEY, __APP_VERSION__); } catch { /* 무시 */ }
  return { updatedFrom: prev && prev !== __APP_VERSION__ ? prev : null };
}
