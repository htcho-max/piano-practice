/**
 * 건반 입력을 한 곳으로 모읍니다.
 * - 디지털 피아노: Web MIDI (USB 케이블로 태블릿에 연결)
 * - 화면 건반(터치)·컴퓨터 키보드: 같은 이벤트로 흘려보냄
 * 시각은 모두 performance.now() 기준 ms.
 */
export type Source = 'midi' | 'screen' | 'keys';
export type NoteEvent = { kind: 'on' | 'off'; note: number; vel: number; time: number; source: Source };
export type PedalEvent = { kind: 'pedal'; cc: number; value: number; time: number };
export type InputEvent = NoteEvent | PedalEvent;

export type MidiStatus = 'unsupported' | 'idle' | 'asking' | 'denied' | 'ready';
export type MidiState = { status: MidiStatus; devices: string[]; error?: string };

type Listener = (e: InputEvent) => void;
const listeners = new Set<Listener>();
const held = new Map<number, Source>();
let sustain = 0;
let state: MidiState = { status: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator ? 'idle' : 'unsupported', devices: [] };
const stateListeners = new Set<() => void>();
const heldListeners = new Set<() => void>();
let heldSnap: number[] = [];

const OK_KEY = 'piano-midi-ok';

export function onInput(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emit(e: InputEvent) {
  if (e.kind === 'on') held.set(e.note, e.source);
  else if (e.kind === 'off') held.delete(e.note);
  else if (e.kind === 'pedal' && e.cc === 64) sustain = e.value;
  if (e.kind !== 'pedal') { heldSnap = [...held.keys()].sort((a, b) => a - b); heldListeners.forEach((f) => f()); }
  listeners.forEach((fn) => fn(e));
}

/** 화면 건반·키보드에서 누름 */
export function pressVirtual(note: number, source: Source = 'screen', vel = 90) {
  emit({ kind: 'on', note, vel, time: performance.now(), source });
}
export function releaseVirtual(note: number, source: Source = 'screen') {
  if (!held.has(note)) return;
  emit({ kind: 'off', note, vel: 0, time: performance.now(), source });
}

export function heldNotes(): number[] { return heldSnap; }
export function subscribeHeld(fn: () => void): () => void { heldListeners.add(fn); return () => { heldListeners.delete(fn); }; }
export function sustainValue(): number { return sustain; }

export function midiState(): MidiState { return state; }
export function subscribeMidi(fn: () => void): () => void { stateListeners.add(fn); return () => { stateListeners.delete(fn); }; }
function setState(s: Partial<MidiState>) { state = { ...state, ...s }; stateListeners.forEach((f) => f()); }

/** MIDI 바이트 → 이벤트 (테스트용으로 따로) */
export function parseMidi(data: ArrayLike<number>, time: number): InputEvent | null {
  const st = data[0] & 0xf0;
  const a = data[1] ?? 0;
  const b = data[2] ?? 0;
  if (st === 0x90 && b > 0) return { kind: 'on', note: a, vel: b, time, source: 'midi' };
  if (st === 0x80 || (st === 0x90 && b === 0)) return { kind: 'off', note: a, vel: 0, time, source: 'midi' };
  if (st === 0xb0 && (a === 64 || a === 66 || a === 67)) return { kind: 'pedal', cc: a, value: b, time };
  return null;
}

let access: MIDIAccess | null = null;
const attached = new WeakSet<MIDIInput>();

function attachAll() {
  if (!access) return;
  const names: string[] = [];
  access.inputs.forEach((inp) => {
    if (inp.state === 'disconnected') return;
    names.push(inp.name || '이름 없는 MIDI 기기');
    if (attached.has(inp)) return;
    attached.add(inp);
    inp.onmidimessage = (ev: MIDIMessageEvent) => {
      if (!ev.data) return;
      const e = parseMidi(ev.data, ev.timeStamp || performance.now());
      if (e) emit(e);
    };
  });
  setState({ status: 'ready', devices: names });
}

/** 연결 (처음엔 버튼 눌러서 → 브라우저가 허락을 물어봄) */
export async function connectMidi(): Promise<MidiState> {
  if (state.status === 'unsupported') return state;
  if (access) { attachAll(); return state; }
  setState({ status: 'asking', error: undefined });
  try {
    access = await navigator.requestMIDIAccess({ sysex: false });
    access.onstatechange = () => attachAll();
    attachAll();
    try { localStorage.setItem(OK_KEY, '1'); } catch { /* 무시 */ }
  } catch (err) {
    setState({ status: 'denied', error: String((err as Error)?.message || err) });
  }
  return state;
}

/** 전에 허락한 적이 있으면 앱을 열 때 바로 연결 */
export function autoConnect() {
  try { if (localStorage.getItem(OK_KEY) === '1') void connectMidi(); } catch { /* 무시 */ }
}

/** 지금 실제 피아노가 연결돼 있나 */
export function hasPiano(): boolean { return state.status === 'ready' && state.devices.length > 0; }
