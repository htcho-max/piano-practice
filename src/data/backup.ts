import { db, notify } from './db';

/** 기록·곡·설정을 한 파일로 (기기를 바꾸거나 브라우저 정리 대비) */
export async function exportBackup(): Promise<Blob> {
  const data = {
    app: 'piano-practice', version: 1, at: new Date().toISOString(),
    runs: await db.runs.toArray(), days: await db.days.toArray(), songs: await db.songs.toArray(), kv: await db.kv.toArray(),
    local: Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('piano-')).map((k) => [k, localStorage.getItem(k)])),
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export async function importBackup(text: string): Promise<{ runs: number; songs: number }> {
  const d = JSON.parse(text);
  if (d?.app !== 'piano-practice') throw new Error('피아노 연습 도우미 백업 파일이 아니에요.');
  await db.transaction('rw', [db.runs, db.days, db.songs, db.kv], async () => {
    await Promise.all([db.runs.clear(), db.days.clear(), db.songs.clear(), db.kv.clear()]);
    await db.runs.bulkAdd(d.runs ?? []);
    await db.days.bulkAdd(d.days ?? []);
    await db.songs.bulkAdd(d.songs ?? []);
    await db.kv.bulkAdd(d.kv ?? []);
  });
  try { for (const [k, v] of Object.entries(d.local ?? {})) if (typeof v === 'string') localStorage.setItem(k, v); } catch { /* 무시 */ }
  notify();
  return { runs: (d.runs ?? []).length, songs: (d.songs ?? []).length };
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
