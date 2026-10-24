/** 누른 음들 → 코드 이름 (C, Am, G7, C/E …). 모르는 조합은 '' */
export const ROOTS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const TEMPLATES: [string, number[]][] = [
  ['', [0, 4, 7]], ['m', [0, 3, 7]], ['dim', [0, 3, 6]], ['aug', [0, 4, 8]], ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]],
  ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['6', [0, 4, 7, 9]], ['m6', [0, 3, 7, 9]],
  ['m7♭5', [0, 3, 6, 10]], ['dim7', [0, 3, 6, 9]], ['add9', [0, 2, 4, 7]], ['7', [0, 4, 10]], ['maj7', [0, 4, 11]], ['5', [0, 7]],
];

export function chordName(notes: number[]): string {
  if (notes.length < 2) return '';
  const pcs = [...new Set(notes.map((n) => ((n % 12) + 12) % 12))].sort((a, b) => a - b);
  const bass = ((Math.min(...notes) % 12) + 12) % 12;
  // 베이스음을 근음으로 보는 것을 먼저, 그다음 다른 음
  const order = [bass, ...pcs.filter((p) => p !== bass)];
  for (const root of order) {
    const rel = pcs.map((p) => (p - root + 12) % 12).sort((a, b) => a - b);
    for (const [suf, t] of TEMPLATES) {
      if (t.length === rel.length && t.every((x, i) => x === rel[i])) {
        return ROOTS[root] + suf + (root !== bass ? `/${ROOTS[bass]}` : '');
      }
    }
  }
  return '';
}
