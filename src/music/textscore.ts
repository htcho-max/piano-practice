/**
 * 앱 글 악보: 사진 악보를 Claude 에게 옮겨 달라고 할 때 쓰는 간단한 글 형식.
 *
 *   @TITLE 주님의 은혜
 *   @COMPOSER 작곡가
 *   @TIME 4/4          (3/4, 6/8 …)
 *   @KEY G             (조: C G D A E B F# F Bb Eb Ab Db, 단조는 Am Em … 또는 숫자 1, -2)
 *   @BPM 72
 *   @CHORDS G | D/F# | Em C | D       (마디마다 코드, 없어도 됨)
 *   R: D4/q | G4/h B4/e G4/e | B4/h A4/q
 *   L: r/q | G2/h. | G2/h. | C3/h.
 *
 * - 손 줄(R: / L:)은 여러 번 써도 이어서 붙음. 마디는 | 로 (박 수가 안 맞으면 알려 줌)
 * - 음: 이름+옥타브 (C4 = 가운데 도, F#3, Bb4), 길이: w h q e s (+ '.' 점, 't' 셋잇단 3분의 1)
 * - 화음은 + (C4+E4+G4/h), 쉼표 r/q, 붙임줄은 길이 뒤 ~ (E4/h~ E4/q = 3박), 손가락은 음 앞 숫자와 : (3:E4/q)
 */
import { parseNote } from './notes';
import type { PNote, Step } from './steps';
import { parseBarsText, type ChordSpan } from './chordbook';

export type TextScore = { title: string; composer: string; timeNum: number; timeDen: number; beats: number; fifths: number; bpm: number; steps: Step[]; chords: ChordSpan[]; warnings: string[] };

const KEY_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
  Am: 0, Em: 1, Bm: 2, 'F#m': 3, 'C#m': 4, 'G#m': 5, 'D#m': 6, Dm: -1, Gm: -2, Cm: -3, Fm: -4, Bbm: -5, Ebm: -6,
};
const DUR: Record<string, number> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
const r3 = (x: number) => Math.round(x * 1000) / 1000;

type Ev = { beat: number; len: number; notes: PNote[] };

function parseDur(d: string): number | null {
  const m = /^([whqes])(\.?)(t?)$/.exec(d);
  if (!m) return null;
  let v = DUR[m[1]];
  if (m[2]) v *= 1.5;
  if (m[3]) v = (v * 2) / 3;
  return v;
}

export function parseTextScore(text: string): TextScore {
  const warnings: string[] = [];
  let title = '제목 없는 곡', composer = '', timeNum = 4, timeDen = 4, fifths = 0, bpm = 72;
  let chordsText = '';
  const lines: Record<'R' | 'L', string[]> = { R: [], L: [] };
  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) return;
    const head = /^@(\w+)\s*(.*)$/.exec(line);
    if (head) {
      const [, k, v] = head;
      const key = k.toUpperCase();
      if (key === 'TITLE') title = v.trim() || title;
      else if (key === 'COMPOSER') composer = v.trim();
      else if (key === 'TIME') { const m = /^(\d+)\s*\/\s*(\d+)$/.exec(v.trim()); if (m) { timeNum = Number(m[1]); timeDen = Number(m[2]); } else warnings.push(`${i + 1}줄: 박자표를 못 읽음 (${v})`); }
      else if (key === 'KEY') { const t = v.trim(); if (/^-?\d+$/.test(t)) fifths = Number(t); else if (t in KEY_FIFTHS) fifths = KEY_FIFTHS[t]; else warnings.push(`${i + 1}줄: 조를 못 읽음 (${t})`); }
      else if (key === 'BPM') bpm = Number(v) || bpm;
      else if (key === 'CHORDS') chordsText += (chordsText ? ' | ' : '') + v.trim().replace(/^\||\|$/g, '');
      return;
    }
    const hand = /^([RL])\s*[:|]\s*(.*)$/i.exec(line);
    if (hand) { lines[hand[1].toUpperCase() as 'R' | 'L'].push(hand[2]); return; }
    warnings.push(`${i + 1}줄: 무슨 줄인지 모름 — R: / L: / @ 로 시작해야 해요`);
  });
  const beats = r3((timeNum * 4) / timeDen);

  const parseHand = (hand: 'R' | 'L'): Ev[] => {
    const evs: Ev[] = [];
    let beat = 0, barStart = 0, barNo = 1;
    let tiePending: PNote[] | null = null;
    const src = lines[hand].join(' | ').replace(/\|\s*\|/g, '|');
    for (const tok of src.split(/\s+/).filter(Boolean)) {
      if (tok === '|') {
        const got = r3(beat - barStart);
        if (got > 0 && Math.abs(got - beats) > 0.01 && !(barNo === 1 && got < beats)) warnings.push(`${hand === 'R' ? '오른손' : '왼손'} ${barNo}마디: ${got}박 (박자표는 ${beats}박)`);
        if (got > 0) { barNo++; barStart = beat; }
        continue;
      }
      const tie = tok.endsWith('~');
      const t = tie ? tok.slice(0, -1) : tok;
      const slash = t.lastIndexOf('/');
      const len = slash > 0 ? parseDur(t.slice(slash + 1)) : null;
      if (len === null) { warnings.push(`${hand}: "${tok}" 길이를 못 읽음`); continue; }
      const body = t.slice(0, slash);
      if (body === 'r') { beat = beat + len; tiePending = null; continue; }
      const notes: PNote[] = [];
      let bad = false;
      for (const part of body.split('+')) {
        const m = /^(?:([1-5]):)?([A-Ga-g][#b♯♭]?-?\d)$/.exec(part);
        if (!m) { warnings.push(`${hand}: "${part}" 음을 못 읽음`); bad = true; break; }
        const n: PNote = { midi: parseNote(m[2]), hand };
        if (m[1]) n.finger = Number(m[1]);
        if (/[#♯]/.test(m[2])) n.spell = 'sharp'; else if (/[b♭]-?\d/.test(m[2].slice(1))) n.spell = 'flat';
        notes.push(n);
      }
      if (bad) { beat = beat + len; continue; }
      // 붙임줄: 앞 음과 같은 음이면 길이만 늘림
      if (tiePending && tiePending.length === notes.length && tiePending.every((p, k) => p.midi === notes[k].midi)) {
        const prev = evs[evs.length - 1];
        prev.len = prev.len + len;
      } else evs.push({ beat: r3(beat), len, notes });
      tiePending = tie ? notes : null;
      beat = beat + len;
    }
    return evs;
  };

  const all = [...parseHand('R'), ...parseHand('L')];
  if (!all.length) throw new Error('음이 없어요. "R:" 이나 "L:" 줄에 음을 적어 주세요.');
  const end = Math.max(...all.map((e) => e.beat + e.len));
  const total = Math.ceil(r3(end / beats) - 1e-6) * beats;
  const map = new Map<number, PNote[]>();
  for (const e of all) map.set(e.beat, [...(map.get(e.beat) ?? []), ...e.notes.map((n) => ({ ...n, len: r3(e.len) }))]);
  const onsets = [...map.keys()].sort((a, b) => a - b);
  const steps: Step[] = [];
  if (onsets[0] > 0) steps.push({ beat: 0, dur: onsets[0], notes: [] });
  onsets.forEach((b, i) => {
    const dur = r3((onsets[i + 1] ?? total) - b);
    steps.push({ beat: b, dur, notes: map.get(b)!.map((n) => { const o = { ...n }; if (Math.abs((o.len ?? 0) - dur) < 0.01) delete o.len; return o; }).sort((x, y) => x.midi - y.midi) });
  });
  let chords: ChordSpan[] = [];
  if (chordsText) {
    const r = parseBarsText(chordsText, beats);
    chords = r.spans;
    r.errors.forEach((e) => warnings.push(`코드 ${e} 를 못 읽음`));
  }
  return { title, composer, timeNum, timeDen, beats, fifths, bpm, steps, chords, warnings };
}

/** 사진 악보를 Claude 에게 보낼 때 같이 붙일 요청 글 */
export const PHOTO_PROMPT = `이 악보 사진을 피아노 연습 앱의 "글 악보" 형식으로 옮겨 주세요.

형식:
@TITLE 곡 제목
@COMPOSER 작사·작곡 (있으면)
@TIME 4/4
@KEY G            (조표의 조. 단조면 Em 처럼)
@BPM 72           (적혀 있지 않으면 알맞게)
@CHORDS G | D/F# | Em C | D      (코드가 적혀 있으면 마디마다, 한 마디에 둘이면 띄어 쓰기)
R: 오른손(높은음자리표) 음들, 마디는 |
L: 왼손(낮은음자리표) 음들, 마디는 |

음 쓰는 법:
- 음 이름 + 옥타브: C4 = 가운데 도, F#3, Bb4 (조표의 ♯·♭도 음마다 적기)
- 길이: w 온음표, h 2분, q 4분, e 8분, s 16분, 점음표는 뒤에 . (h.), 셋잇단은 t (et)
- 화음은 + 로 (C4+E4+G4/h), 쉼표 r/q, 붙임줄은 길이 뒤 ~ (E4/h~ | E4/q)
- 손가락 번호가 인쇄돼 있으면 음 앞에 (3:E4/q)
- 멜로디만 있는 악보(찬양 악보 등)는 R: 만 적고, 코드는 @CHORDS 에
- 못갖춘마디는 앞을 쉼표로 채워 첫 마디를 박자표 길이로 (예: 4/4 에 한 박 시작 → r/h. D4/q)
- 도돌이표·D.S.·괄호는 연주 순서대로 펼쳐서 적기
- 잘 안 보이는 곳은 맨 끝에 // 로 적어 주세요 (// 7마디 둘째 음 불확실)

결과는 앱에 붙여 넣을 수 있게 코드 블록 하나로 주세요.`;
