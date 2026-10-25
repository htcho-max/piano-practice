import { describe, it, expect } from 'vitest';
import { fingerStepOk, SCALES, scaleNotes, scaleFingers, scaleSteps, scaleStart, arpeggioSteps, hanon1, ARPEGGIOS } from '../src/music/scales';
import { totalBeats } from '../src/music/steps';
import { isBlack } from '../src/music/notes';

describe('음계 24조', () => {
  it('24개, 이름 겹침 없음', () => {
    expect(SCALES.length).toBe(24);
    expect(new Set(SCALES.map((s) => s.name)).size).toBe(24);
    expect(SCALES.find((s) => s.pc === 2 && s.kind === 'major')!.fifths).toBe(2);
    expect(SCALES.find((s) => s.pc === 9 && s.kind === 'minor')!.fifths).toBe(0);
    expect(SCALES.find((s) => s.pc === 5 && s.kind === 'minor')!.fifths).toBe(-4);
  });
  it('손가락 표가 규칙에 맞음: 엄지는 흰 건반, 오른손 오를 때 3·4 다음 엄지, 왼손 오를 때 엄지 다음 3·4', () => {
    for (const s of SCALES) for (const hand of ['R', 'L'] as const) {
      const notes = scaleNotes(s, scaleStart(s, hand), 2);
      const f = scaleFingers(s, hand, 2);
      expect(f.length, s.name).toBe(notes.length);
      for (let i = 0; i < notes.length; i++) {
        if (f[i] === 1) expect(isBlack(notes[i]), `${s.name} ${hand} ${i} 엄지가 검은 건반`).toBe(false);
        if (i === 0) continue;
        const a = f[i - 1], b = f[i];
        // 첫 음 다음(시작 손가락이 표 가운데에서 시작하는 경우)과 맨 위 5번은 따로 허용
        const ok = fingerStepOk(hand, a, b) || (i === notes.length - 1 && hand === 'R' && b === 5 && a === 4) || (i === 1 && hand === 'R' && a === 2 && b === 1);
        expect(ok, `${s.name} ${hand} ${i}: ${a}→${b}`).toBe(true);
      }
    }
  });
  it('장조 손가락 몇 개 확인', () => {
    const C = SCALES[0];
    expect(scaleFingers(C, 'R', 1)).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    expect(scaleFingers(C, 'L', 2)).toEqual([5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]);
    const Fm = SCALES.find((s) => s.name.startsWith('F 장조'))!;
    expect(scaleFingers(Fm, 'R', 2)).toEqual([1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4]);
  });
  it('연습 칸: 양손 나란히, 오르내림, 마디 꽉 참', () => {
    const st = scaleSteps(SCALES[1], { hands: 'B', octaves: 2, rhythm: 'e' });
    expect(st.length).toBe(29);
    expect(st[0].notes.map((n) => n.midi)).toEqual([55, 43]); // G 장조: 오른손 G3 (F# 이상은 한 옥타브 아래), 왼손 G2
    expect(st[14].notes[0].midi).toBe(79);
    expect(totalBeats(st) % 4).toBe(0);
    expect(st.find((x) => x.notes[0].midi % 12 === 6)!.notes[0].spell).toBe('sharp');
  });
});

describe('아르페지오·하농', () => {
  it('아르페지오 2옥타브', () => {
    for (const a of ARPEGGIOS) {
      const st = arpeggioSteps(a.id, 'B');
      expect(st.length).toBe(13);
      expect(totalBeats(st) % 4).toBe(0);
    }
    expect(arpeggioSteps('C', 'R')[6].notes[0]).toMatchObject({ midi: 84, finger: 5 });
  });
  it('하농 1번: 올라가고 내려와 도로 끝남', () => {
    const st = hanon1('B');
    expect(st[0].notes.map((n) => n.midi)).toEqual([48, 36]);
    expect(st[1].notes[0].midi).toBe(52); // 미
    expect(st[st.length - 1].notes.map((n) => n.midi)).toEqual([48, 36]);
    expect(Math.max(...st.map((x) => x.notes[0].midi))).toBe(79); // 오른손 꼭대기 G5
    expect(totalBeats(st) % 4).toBe(0);
  });
});
