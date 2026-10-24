import { useSyncExternalStore } from 'react';
import type { LabelStyle } from '../music/notes';

export type Settings = {
  labels: LabelStyle; // 건반 위 이름: 도레미 / C D E
  appSound: 'auto' | 'on' | 'off'; // auto = 피아노가 연결되면 앱은 소리 안 냄(들어 보기만)
  volume: number; // 0~1 (앱 소리)
  clickVolume: number; // 0~1 (메트로놈)
  fingers: boolean; // 건반 위 손가락 번호
  allNames: boolean; // 모든 흰 건반에 이름 (꺼지면 도만)
  computerKeys: boolean; // 컴퓨터 키보드로 치기 (A S D F …)
  latencyMs: number; // 박자 채점 보정: 메트로놈이 귀에 들리는 시각이 늦으면 + (ms)
};

const KEY = 'piano-settings';
const DEFAULT: Settings = { labels: 'solfa', appSound: 'auto', volume: 0.7, clickVolume: 0.8, fingers: true, allNames: true, computerKeys: true, latencyMs: 0 };

function load(): Settings {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT; }
}
let cur: Settings = typeof window === 'undefined' ? DEFAULT : load();
const subs = new Set<() => void>();

export function getSettings(): Settings { return cur; }
export function setSettings(p: Partial<Settings>) {
  cur = { ...cur, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* 무시 */ }
  subs.forEach((f) => f());
}
export function useSettings(): Settings {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cur);
}
