import { useSyncExternalStore } from 'react';
import { onInput, autoConnect, midiState, subscribeMidi, heldNotes, subscribeHeld, pressVirtual, releaseVirtual, type MidiState } from '../midi/input';
import { piano } from '../audio/piano';
import { getSettings } from './settings';
import { addActivity } from '../data/db';
import { localDate } from '../data/dates';

let installed = false;

/** 앱을 열 때 한 번: 피아노 연결, 앱 소리, 연습 시간 세기, 컴퓨터 키보드 */
export function installLive() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  autoConnect();

  onInput((e) => {
    const s = getSettings();
    if (e.kind === 'pedal') { if (e.cc === 64) piano.setSustain(e.value >= 64); return; }
    const sound = s.appSound === 'on' || (s.appSound === 'auto' && e.source !== 'midi');
    if (e.kind === 'on') { piano.setVolume(s.volume); if (sound) piano.noteOn(e.note, e.vel); }
    else if (sound || e.source !== 'midi') piano.noteOff(e.note);
    if (e.kind === 'on') countActivity(e.time);
  });

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', () => { for (const n of [...keyHeld.values()]) releaseVirtual(n, 'keys'); keyHeld.clear(); });
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

/* ── 연습 시간: 건반을 친 사이가 15초 안이면 그 사이를 연습 시간으로 ── */
let last = 0;
let pendSec = 0;
let pendNotes = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function countActivity(t: number) {
  if (last && t - last < 15000 && t > last) pendSec += (t - last) / 1000;
  else pendSec += 1; // 한 번 누른 것도 1초
  last = t;
  pendNotes++;
  if (!flushTimer) flushTimer = setTimeout(flush, 10000);
}
function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (pendNotes === 0) return;
  const sec = Math.round(pendSec), n = pendNotes;
  pendSec = 0; pendNotes = 0;
  void addActivity(localDate(), sec, n);
}

/* ── 컴퓨터 키보드: A W S E D F T G Y H U J K = 도~높은 도, Z/X 옥타브 ── */
const MAP: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14 };
let base = 60;
const keyHeld = new Map<string, number>();
function onKey(ev: KeyboardEvent) {
  if (!getSettings().computerKeys || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const tgt = ev.target as HTMLElement | null;
  if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable)) return;
  const k = ev.key.toLowerCase();
  if (ev.type === 'keydown' && (k === 'z' || k === 'x')) { base = Math.max(24, Math.min(96, base + (k === 'z' ? -12 : 12))); return; }
  if (!(k in MAP)) return;
  if (ev.type === 'keydown') {
    if (ev.repeat || keyHeld.has(k)) return;
    const n = base + MAP[k];
    keyHeld.set(k, n);
    pressVirtual(n, 'keys');
  } else {
    const n = keyHeld.get(k);
    keyHeld.delete(k);
    if (n !== undefined) releaseVirtual(n, 'keys');
  }
}

export function useMidi(): MidiState { return useSyncExternalStore(subscribeMidi, midiState); }
export function useHeld(): number[] { return useSyncExternalStore(subscribeHeld, heldNotes); }
