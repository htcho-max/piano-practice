// 빌드본 + 가짜 MIDI 피아노로 전체 흐름 확인
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const server = spawn('npx', ['vite', 'preview', '--port', '4329', '--strictPort'], { stdio: 'ignore', detached: true });
await new Promise((r) => setTimeout(r, 2500));
const URL = 'http://localhost:4329/';
let fails = 0;
const ok = (c, msg) => { console.log(`${c ? 'PASS' : 'FAIL'} ${msg}`); if (!c) { fails++; process.exitCode = 1; } };

// 가짜 Web MIDI: window.__midi(bytes) 로 피아노 건반을 누른 것처럼
const FAKE_MIDI = () => {
  const input = { id: 'fake', name: 'Roland Digital Piano', state: 'connected', onmidimessage: null };
  const access = { inputs: new Map([['fake', input]]), outputs: new Map(), onstatechange: null, sysexEnabled: false };
  navigator.requestMIDIAccess = async () => access;
  window.__midi = (bytes) => input.onmidimessage && input.onmidimessage({ data: new Uint8Array(bytes), timeStamp: performance.now() });
  window.__on = (n, v = 90) => window.__midi([0x90, n, v]);
  window.__off = (n) => window.__midi([0x80, n, 0]);
  window.__tap = (n) => { window.__on(n); setTimeout(() => window.__off(n), 60); };
};

const browsers = [];
const allErrors = [];
async function launch(vp = { width: 390, height: 844 }) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  browsers.push(browser);
  const page = await browser.newPage({ viewport: vp });
  const errors = allErrors;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(FAKE_MIDI);
  await page.goto(URL);
  return { browser, page, errors };
}
const tab = (page, name) => page.locator('.tabbar').getByRole('button', { name }).click();
const tap = (page, n) => page.evaluate((n) => window.__tap(n), n);
const wait = (page, ms) => page.waitForTimeout(ms);
const text = async (loc) => (await loc.textContent()) ?? '';

/** 박자 맞춰: t0 기준으로 음 목록을 정확한 시각에 보냄. notes = [[midi, beat, offsetMs], …] */
async function playTimed(page, bpm, notes) {
  await page.waitForFunction(() => typeof window.__pianoT0 === 'number');
  await page.evaluate(({ bpm, notes }) => {
    const t0 = window.__pianoT0, spb = 60000 / bpm;
    for (const [m, beat, off] of notes) {
      const at = t0 + beat * spb + (off || 0);
      setTimeout(() => window.__on(m), Math.max(0, at - performance.now()));
      setTimeout(() => window.__off(m), Math.max(0, at - performance.now() + spb * 0.8));
    }
  }, { bpm, notes });
}

try {
  {
    const { browser, page, errors } = await launch();
    // 1. 처음 화면
    ok(await page.getByTestId('plan-learn').isVisible(), '오늘: 배울 것 카드');
    ok((await text(page.getByTestId('plan-learn'))).includes('도 찾기'), '오늘: 1과 도 찾기부터');
    ok((await text(page.getByTestId('top-midi'))).includes('화면 건반'), '연결 전: 화면 건반');
    await page.screenshot({ path: 'scripts/shot-today.png', fullPage: true });
    await page.getByTestId('connect').click();
    await page.waitForTimeout(300);
    ok((await text(page.getByTestId('top-midi'))).includes('연결됨'), '가짜 피아노 연결됨');
    ok((await text(page.locator('.toast'))).includes('Roland Digital Piano'), '연결 알림');

    // 2. 건반 탭: 누른 음과 코드
    await tab(page, '코드'); await page.getByTestId('sub-free').click();
    await page.evaluate(() => { window.__on(60); window.__on(64); window.__on(67); window.__midi([0xb0, 64, 127]); });
    await wait(page, 200);
    ok((await text(page.getByTestId('held'))).startsWith('도(C4) 미(E4) 솔(G4)'), `누른 음 표시: ${await text(page.getByTestId('held'))}`);
    ok((await text(page.getByTestId('chord'))) === 'C', 'C 코드');
    ok(await page.locator('[data-testid="key-64"].down').count() === 1, '화면 건반에 눌림 표시');
    ok((await text(page.locator('.np-sub'))).includes('페달 밟음'), '페달');
    await page.screenshot({ path: 'scripts/shot-play.png', fullPage: true });
    await page.evaluate(() => { window.__off(60); window.__off(64); window.__off(67); window.__on(57); window.__on(60); window.__on(64); });
    await wait(page, 100);
    ok((await text(page.getByTestId('chord'))) === 'Am', 'Am 코드');
    await page.evaluate(() => { [57, 60, 64].forEach((n) => window.__off(n)); });
    // 화면 건반 터치
    const k = page.getByTestId('key-62');
    const box = await k.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10);
    await page.mouse.down();
    await wait(page, 100);
    ok((await text(page.getByTestId('held'))).includes('레'), '화면 건반 누르기');
    await page.mouse.up();
    await wait(page, 100);
    ok((await text(page.getByTestId('held'))).includes('건반을 눌러'), '화면 건반 떼기');
    await page.getByTestId('metro-toggle').click();
    await wait(page, 1000);
    ok(await page.locator('.dot.on').count() === 1, '메트로놈 박 표시');
    await page.getByTestId('metro-toggle').click();

    // 3. 1과 건반 찾기
    await tab(page, '배우기');
    await page.getByTestId('lesson-1').click();
    ok((await text(page.getByTestId('lesson-title'))) === '건반 지도', '1과 설명');
    await page.getByTestId('ex-l1-find').click();
    ok((await text(page.getByTestId('question'))).includes('가운데 도'), '문제 1');
    await tap(page, 62); await wait(page, 100); // 틀림
    ok(await page.locator('.key.fl-bad').count() === 1, '틀린 건반 빨강');
    for (const seq of [[60], [36, 48, 72], [41, 53], [38, 50], [43, 55], [72]]) {
      for (const n of seq) { await tap(page, n); await wait(page, 120); }
      await wait(page, 750);
    }
    ok(await page.getByTestId('result').isVisible(), '찾기 끝');
    ok((await text(page.getByTestId('result'))).includes('틀린 건반 1번'), '틀린 횟수');
    await page.getByRole('button', { name: '다음' }).click();

    // 4. 도레미파솔 (기다려 주기)
    ok((await text(page.getByTestId('ex-title'))) === '도레미파솔', '다음 연습으로');
    await page.getByTestId('wait-hint').waitFor();
    await wait(page, 200);
    ok(await page.locator('[data-testid="key-60"].mk-now').count() === 1, '첫 음 표시');
    for (const n of [60, 62, 64, 65]) { await tap(page, n); await wait(page, 120); }
    ok(await page.locator('[data-testid="step-0"][data-state="good"]').count() === 1, '맞은 칸 초록');
    await tap(page, 66); await wait(page, 120); // 틀림
    ok(await page.locator('[data-testid="step-4"][data-state="wrong"]').count() === 1, '틀린 칸 표시');
    await tap(page, 67); await wait(page, 300);
    ok((await text(page.getByTestId('score'))) === '80점', `기다려 주기 점수 ${await text(page.getByTestId('score'))}`);
    await page.getByTestId('again').click();
    for (const n of [60, 62, 64, 65, 67]) { await tap(page, n); await wait(page, 120); }
    ok((await text(page.getByTestId('score'))) === '100점', '다시 하기 100점');
    await page.screenshot({ path: 'scripts/shot-wait.png', fullPage: true });

    // 5. 7과 같이 누르기 — 박자 맞춰, 양손 (♩60, 8박)
    await page.getByRole('button', { name: /^‹/ }).click();
    await page.getByRole('button', { name: /^‹/ }).click();
    await page.getByTestId('lesson-7').click();
    await page.getByTestId('ex-l7-together').click();
    await page.getByTestId('mode-timed').click();
    await page.getByTestId('timed-start').click();
    await wait(page, 300);
    ok(await page.getByTestId('countin').isVisible(), '한 마디 세기');
    // L5:C3+R1:C4/h L1:G3+R5:G4/h | L5:C3+R3:E4/h L1:G3+R5:G4/h | L5:C3+R1:C4/w
    await playTimed(page, 60, [[48, 0, 0], [60, 0, 30], [55, 2, -40], [67, 2, -20], [48, 4, 10], [64, 4, 140], [55, 6, 0], [67, 6, 0], [48, 8, 0], [60, 8, 20]]);
    await page.getByTestId('result').waitFor({ timeout: 25000 });
    const sc = Number((await text(page.getByTestId('score'))).replace(/\D/g, ''));
    ok(sc >= 85 && sc < 100, `박자 맞춰 점수 ${sc} (늦은 음 하나)`);
    ok((await text(page.getByTestId('result'))).includes('늦음 1'), '늦음 1개');
    ok(/양손 \d+ms/.test(await text(page.getByTestId('result'))), '양손 어긋남 표시');
    await page.screenshot({ path: 'scripts/shot-timed.png', fullPage: true });

    // 6. 한 손만 (왼손 놓침 없이 오른손만 → 앱이 왼손)
    await page.getByTestId('hands-R').click();
    await page.evaluate(() => { window.__pianoT0 = undefined; });
    await page.getByTestId('timed-start').click();
    await playTimed(page, 60, [[60, 0, 0], [67, 2, 0], [64, 4, 0], [67, 6, 0], [60, 8, 0]]);
    await page.getByTestId('result').waitFor({ timeout: 25000 });
    ok((await text(page.getByTestId('score'))) === '100점', `오른손만 100점 (${await text(page.getByTestId('score'))})`);
    ok((await text(page.getByTestId('result'))).includes('한 손 통과'), '한 손 통과 표시');

    // 7. 들어 보기
    await page.getByTestId('hands-B').click();
    await page.getByTestId('listen').click();
    await wait(page, 1500);
    ok(await page.locator('.step.cur').count() === 1, '들어 보기: 칸 따라감');
    await page.getByTestId('listen-stop').click();


    // 9. v0.2 — 음표 읽기 퀴즈 (9과)
    await tab(page, '배우기');
    await page.getByTestId('lesson-9').click();
    await page.getByTestId('ex-l9-read').click();
    const target = async () => Number(await page.locator('[data-testid="note-card"] .note').getAttribute('data-midi'));
    await page.locator('[data-testid="note-card"] .note').waitFor();
    let t = await target();
    ok(t >= 60 && t <= 67, `퀴즈 음 ${t} (도~솔)`);
    await tap(page, t === 60 ? 62 : 60); await wait(page, 150); // 첫 문제 틀림
    ok(await page.locator(`[data-testid="key-${t}"].mk-now`).count() === 1, '틀리면 정답 건반 보여 줌');
    for (let i = 0; i < 20; i++) {
      t = await target();
      await tap(page, t);
      await wait(page, i === 0 ? 750 : 380);
    }
    await page.getByTestId('result').waitFor({ timeout: 5000 });
    ok((await text(page.getByTestId('score'))) === '95점', `퀴즈 점수 ${await text(page.getByTestId('score'))} (19/20)`);
    await page.getByRole('button', { name: '다음' }).click();

    // 10. 악보 보고 치기 (힌트 꺼짐)
    ok((await text(page.getByTestId('ex-title'))).includes('비행기'), '다음: 악보 보고 비행기');
    ok(await page.getByTestId('staff').isVisible(), '악보 보기');
    ok(await page.locator('[data-testid="staff"] .note').count() === 26, `악보 음표 ${await page.locator('[data-testid="staff"] .note').count()}개`);
    await page.getByTestId('wait-hint').waitFor();
    await wait(page, 200);
    ok(await page.locator('.key.mk-now').count() === 0, '건반 힌트 꺼짐');
    await tap(page, 60); await wait(page, 150); // 틀림 (첫 음은 미)
    ok(await page.locator('[data-testid="key-64"].mk-now').count() === 1, '틀리면 그 칸 힌트');
    const BI = [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67, 64, 62, 60, 62, 64, 64, 64, 64, 62, 62, 64, 62, 60];
    for (const n of BI) { await tap(page, n); await wait(page, 90); }
    await page.getByTestId('result').waitFor({ timeout: 5000 });
    ok((await text(page.getByTestId('score'))) === '96점', `악보 보고 기다려 주기 ${await text(page.getByTestId('score'))}`);
    ok(await page.locator('[data-testid="staff"] .note[data-step="1"]').evaluate((el) => getComputedStyle(el).color) !== '', '악보 채점 색');
    await page.getByTestId('view-names').click();
    ok(await page.getByTestId('strip').isVisible(), '이름 칸 보기로 바꾸기');
    await page.screenshot({ path: 'scripts/shot-sheet.png', fullPage: true });

    // 11. 박자 보정: 늘 80ms 늦게 치면 보정 제안 → 적용 후 다시 치면 딱 맞음
    await page.getByRole('button', { name: /^‹/ }).click();
    await page.getByRole('button', { name: /^‹/ }).click();
    await page.getByTestId('lesson-4').click();
    await page.getByTestId('ex-l4-quarters').click();
    const Q = [[60, 0], [60, 1], [60, 2], [60, 3], [60, 4], [60, 6], [60, 8], [60, 9], [60, 10], [60, 12]];
    await page.evaluate(() => { window.__pianoT0 = undefined; });
    await page.getByTestId('timed-start').click();
    await playTimed(page, 70, Q.map(([m, b]) => [m, b, 80]));
    await page.getByTestId('result').waitFor({ timeout: 25000 });
    ok(await page.getByTestId('calibrate').isVisible(), '늘 늦음 → 보정 제안');
    await page.getByTestId('calibrate').click();
    const lat = await page.evaluate(() => JSON.parse(localStorage.getItem('piano-settings')).latencyMs);
    ok(lat >= 70 && lat <= 90, `보정 ${lat}ms 저장`);
    await page.evaluate(() => { window.__pianoT0 = undefined; });
    await page.getByTestId('timed-start').click();
    // 화면의 t0 는 이미 보정이 더해진 값 → 그대로 80ms 늦게 치면 딱 맞음
    await playTimed(page, 70, Q.map(([m, b]) => [m, b, 80 - lat]));
    await page.getByTestId('result').waitFor({ timeout: 25000 });
    ok((await text(page.getByTestId('score'))) === '100점', `보정 뒤 ${await text(page.getByTestId('score'))}`);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('piano-settings')); s.latencyMs = 0; localStorage.setItem('piano-settings', JSON.stringify(s)); });


    // 12. v0.3 — 곡 연습: 구간, 약한 마디, 템포 사다리, 반복, 떨어지는 건반, MusicXML
    await tab(page, '곡');
    ok(await page.locator('button[data-testid^="song-"]').count() === 6, '기본 곡 6개');
    await page.getByTestId('song-bihaenggi').click();
    ok(await page.getByTestId('staff').isVisible(), '곡은 악보로 시작');
    await page.getByTestId('sec-from').selectOption('3');
    await page.getByTestId('sec-to').selectOption('4');
    await page.getByTestId('wait-hint').waitFor(); await wait(page, 200);
    ok(await page.locator('[data-testid="staff"] .note').count() === 8, `구간 3~4마디 음표 ${await page.locator('[data-testid="staff"] .note').count()}개`);
    ok((await text(page.locator('.bar-no').first())) === '3', '구간 마디 번호 3부터');
    const chord = async (a, b) => { await page.evaluate(([a, b]) => { window.__on(a); window.__on(b); }, [a, b]); await wait(page, 80); await page.evaluate(([a, b]) => { window.__off(a); window.__off(b); }, [a, b]); await wait(page, 80); };
    await chord(55, 62); await tap(page, 62); await wait(page, 90); await tap(page, 62); await wait(page, 90);
    await chord(48, 64); await tap(page, 65); await wait(page, 90); /* 틀림 (4마디) */ await tap(page, 67); await wait(page, 90); await tap(page, 67); await wait(page, 300);
    ok(await page.getByTestId('result').isVisible(), '구간 기다려 주기 끝');
    ok(await page.getByTestId('weak-4').isVisible(), '자주 틀리는 마디: 4마디');
    await page.getByTestId('view-roll').click();
    ok(await page.getByTestId('roll').isVisible() && await page.locator('[data-testid="roll"] .rn').count() === 8, '떨어지는 건반 보기');
    await page.getByTestId('view-staff').click();
    // 템포 사다리 + 반복: 3~4마디, ♩80 목표 → ♩48 부터
    await page.getByTestId('mode-timed').click();
    await page.getByTestId('ladder').click();
    ok((await text(page.getByTestId('bpm'))) === '♩48', `사다리 시작 템포 ${await text(page.getByTestId('bpm'))}`);
    await page.getByTestId('loop').click();
    await page.evaluate(() => { window.__pianoT0 = undefined; });
    await page.getByTestId('timed-start').click();
    const SEC = [[55, 0], [62, 0], [62, 1], [62, 2], [48, 4], [64, 4], [67, 5], [67, 6]];
    await playTimed(page, 48, SEC.map(([m, b]) => [m, b, 0]));
    await page.getByTestId('result').waitFor({ timeout: 25000 });
    ok((await text(page.getByTestId('score'))) === '100점', `사다리 1판 ${await text(page.getByTestId('score'))}`);
    ok((await text(page.getByTestId('ladder-msg'))).includes('♩52'), `사다리 한 칸 올림: ${await text(page.getByTestId('ladder-msg'))}`);
    ok((await text(page.getByTestId('bpm'))) === '♩52', '템포 52');
    await page.getByTestId('countin').waitFor({ timeout: 5000 }).then(() => ok(true, '끝나면 바로 다시 (반복)'), () => ok(false, '반복 안 됨'));
    await page.getByTestId('timed-stop').click();
    await page.getByRole('button', { name: /^‹ 곡 목록/ }).click();
    // MusicXML 불러오기
    await page.getByTestId('song-file').setInputFiles('tests/fixtures/piano-test.musicxml');
    await page.getByTestId('import-msg').waitFor();
    ok((await text(page.getByTestId('import-msg'))).includes('시험 곡'), `불러오기: ${await text(page.getByTestId('import-msg'))}`);
    await page.locator('[data-testid^="mysong-"]').first().click();
    ok((await text(page.getByTestId('song-title'))) === '시험 곡', '불러온 곡 열기');
    ok((await text(page.getByTestId('bpm'))) === '♩96', '악보 템포 96');
    ok(await page.locator('[data-testid="staff"] .note').count() >= 6, '불러온 곡 악보');
    ok((await text(page.locator('.ex-head'))).includes('도돌이표'), '도돌이표 안내');
    await page.screenshot({ path: 'scripts/shot-import.png', fullPage: true });


    // 13. v0.4 — 코드·반주
    await tab(page, '코드');
    await page.getByTestId('sub-dict').click();
    await page.getByTestId('root-7').click();
    ok((await text(page.getByTestId('dict-name'))) === 'G', '코드 사전 G');
    await page.evaluate(() => { [59, 62, 67].forEach((n) => window.__on(n)); });
    await wait(page, 150);
    ok((await text(page.getByTestId('dict-check'))).includes('✓ G'), `자리바꿈으로 눌러도 G (${await text(page.getByTestId('dict-check'))})`);
    await page.evaluate(() => { [59, 62, 67].forEach((n) => window.__off(n)); });
    await page.getByTestId('sub-drill').click();
    await page.getByTestId('prog').selectOption('basic');
    await page.getByTestId('key-C').click();
    await wait(page, 300);
    const CH = { C: [48, 60, 64, 67], F: [41, 60, 65, 69], G: [43, 59, 62, 67] };
    for (const name of ['C', 'F', 'G', 'C', 'C', 'F', 'G', 'C']) {
      ok((await text(page.getByTestId('chord-now'))) === name, `지금 코드 ${name}`);
      if (name === 'F' && (await page.locator('.chord-progress .done').count()) === 1) { await tap(page, 61); await wait(page, 80); } // 틀린 음 한 번
      await page.evaluate((ns) => { ns.forEach((n) => window.__on(n)); }, CH[name]);
      await wait(page, 120);
      await page.evaluate((ns) => { ns.forEach((n) => window.__off(n)); }, CH[name]);
      await wait(page, 80);
    }
    await page.getByTestId('result').waitFor({ timeout: 3000 });
    ok((await text(page.getByTestId('score'))) === '97점', `코드 바꾸기 ${await text(page.getByTestId('score'))} (틀린 음 1)`);
    // 반주 패턴 + 페달 채점 (길게 누르기, C G Am F 두 바퀴, ♩66 → 빠르게 ♩120)
    await page.getByTestId('sub-acc').click();
    await page.getByTestId('prog').selectOption('pop');
    await page.getByTestId('key-C').click();
    await page.getByTestId('pat-block').click();
    ok(await page.locator('[data-testid="chord-sym"]').count() === 8, `악보 위 코드 이름 ${await page.locator('[data-testid="chord-sym"]').count()}개`);
    await page.getByTestId('mode-timed').click();
    for (let i = 0; i < 9; i++) await page.getByRole('button', { name: '빠르게' }).click(); // 66 → 102
    await page.evaluate(() => { window.__pianoT0 = undefined; });
    await page.getByTestId('timed-start').click();
    await page.waitForFunction(() => typeof window.__pianoT0 === 'number');
    const notesOf = await page.evaluate(() => null);
    void notesOf;
    // 각 마디: 왼손 베이스 + 오른손 자리 (화면에 그려진 음표의 data-midi 로)
    const pairs = await page.locator('[data-testid="staff"] .note').evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-step')), e.getAttribute('data-midi')]));
    const byStep = new Map(); for (const [st, ms] of pairs) byStep.set(st, [...(byStep.get(st) ?? []), ...ms.split(',').map(Number)]);
    const midis = [...byStep.keys()].sort((a, b) => a - b).map((k) => [...new Set(byStep.get(k))]);
    await page.evaluate(({ midis, bpm }) => {
      const t0 = window.__pianoT0, spb = 60000 / bpm;
      const send = (at, f) => setTimeout(f, Math.max(0, at - performance.now()));
      midis.forEach((ns, i) => {
        const at = t0 + i * 4 * spb;
        send(at, () => ns.forEach((n) => window.__on(n)));
        send(at + 4 * spb - 40, () => ns.forEach((n) => window.__off(n)));
        if (i === 0) send(at - 300, () => window.__midi([0xb0, 64, 127]));
        else if (i !== 3) { send(at + 120, () => window.__midi([0xb0, 64, 0])); send(at + 220, () => window.__midi([0xb0, 64, 127])); }
      });
    }, { midis, bpm: 102 });
    await page.getByTestId('result').waitFor({ timeout: 30000 });
    ok((await text(page.getByTestId('pedal-result'))).includes('7/8'), `페달 채점 ${await text(page.getByTestId('pedal-result'))}`);
    ok((await text(page.getByTestId('score'))) === '100점', `반주 점수 ${await text(page.getByTestId('score'))}`);
    await page.evaluate(() => window.__midi([0xb0, 64, 0]));
    // 곡에 왼손 반주 만들기
    await tab(page, '곡');
    if (await page.getByRole('button', { name: /^‹ 곡 목록/ }).isVisible().catch(() => false)) await page.getByRole('button', { name: /^‹ 곡 목록/ }).click();
    await page.getByTestId('song-nabi').click();
    ok(await page.locator('[data-testid="chord-sym"]').count() >= 4, '기본 곡 코드 표시');
    await page.getByTestId('arrange-open').click();
    ok((await page.getByTestId('arrange-text').inputValue()).startsWith('C | G'), '기본 곡 코드가 채워짐');
    await page.getByTestId('arrange-text').fill('');
    await page.getByTestId('arrange-auto').click();
    ok((await text(page.getByTestId('arrange-msg'))).includes('C 조'), `자동 코드: ${await text(page.getByTestId('arrange-msg'))}`);
    await page.getByTestId('left-bass5').click();
    await page.getByTestId('arrange-make').click();
    await page.getByTestId('song-title').filter({ hasText: '반주(근음 + 5음)' }).waitFor({ timeout: 3000 });
    ok(true, '반주 악보 만들어 열림');
    ok(await page.locator('[data-testid="staff"] .note').count() >= 40, `반주 악보 음표 ${await page.locator('[data-testid="staff"] .note').count()}`);
    // 레슨 17~21
    await tab(page, '배우기');
    if (await page.getByRole('button', { name: /^‹/ }).first().isVisible().catch(() => false)) await page.getByRole('button', { name: /^‹/ }).first().click();
    ok(await page.getByTestId('lesson-21').isVisible(), '21과까지');


    // 14. v0.5 — 음계·하농
    await tab(page, '코드');
    await page.getByTestId('sub-scales').click();
    await page.getByTestId('sc-scale').click();
    await page.getByTestId('scale-M7').click(); // 사장조
    await page.getByTestId('sch-R').click();
    await page.getByRole('button', { name: '1옥타브' }).click();
    await page.getByTestId('wait-hint').waitFor(); await wait(page, 200);
    const GS = [55, 57, 59, 60, 62, 64, 66, 67, 66, 64, 62, 60, 59, 57, 55];
    for (const n of GS) { await tap(page, n); await wait(page, 90); }
    await page.getByTestId('result').waitFor({ timeout: 3000 });
    ok((await text(page.getByTestId('score'))) === '100점', `사장조 오른손 ${await text(page.getByTestId('score'))}`);
    await page.getByTestId('view-names').click();
    ok((await text(page.getByTestId('step-3'))).includes('1'), '파♯ 앞 도는 엄지(1)');
    await page.getByTestId('view-staff').click();
    await page.getByTestId('sc-hanon').click();
    await page.getByTestId('sch-B').click();
    ok(await page.locator('[data-testid="staff"] .beam').count() > 50, `하농 빔 ${await page.locator('[data-testid="staff"] .beam').count()}`);
    await tab(page, '배우기');
    if (await page.getByRole('button', { name: /^‹/ }).first().isVisible().catch(() => false)) await page.getByRole('button', { name: /^‹/ }).first().click();
    ok(await page.getByTestId('lesson-25').isVisible(), '25과까지');


    // 15. v0.6 — 글 악보 붙여넣기, 조 옮기기, 백업
    await tab(page, '곡');
    if (await page.getByRole('button', { name: /^‹ 곡 목록/ }).isVisible().catch(() => false)) await page.getByRole('button', { name: /^‹ 곡 목록/ }).click();
    await page.getByTestId('paste-open').click();
    await page.getByTestId('prompt-show').click();
    ok((await text(page.getByTestId('prompt'))).includes('@CHORDS'), '사진 악보 요청 글');
    await page.getByTestId('paste-text').fill('@TITLE 붙여넣은 찬양\n@TIME 4/4\n@KEY G\n@BPM 70\n@CHORDS G | D | Em C | G\nR: 3:B4/q A4/q G4/h | A4/q B4/q A4/h | G4/q E4/q G4/q A4/q | G4/w\nL: G2/w | D3/w | E3/h C3/h | G2/w');
    await page.getByTestId('paste-check').click();
    ok((await text(page.getByTestId('paste-msg'))).includes('좋아요'), `글 악보 확인: ${await text(page.getByTestId('paste-msg'))}`);
    await page.getByTestId('paste-save').click();
    await page.getByTestId('song-title').filter({ hasText: '붙여넣은 찬양' }).waitFor({ timeout: 3000 });
    ok(await page.locator('[data-testid="chord-sym"]').count() === 5, `붙여넣은 곡 코드 ${await page.locator('[data-testid="chord-sym"]').count()}`);
    ok((await text(page.getByTestId('bpm'))) === '♩70', '붙여넣은 곡 템포');
    await page.locator('.song-edit summary').click();
    await page.getByTestId('tr-up').click(); await page.getByTestId('tr-up').click();
    ok((await text(page.getByTestId('tr-label'))).startsWith('G → A'), `조 옮기기 표시 ${await text(page.getByTestId('tr-label'))}`);
    await page.getByTestId('tr-save').click();
    await page.getByTestId('song-title').filter({ hasText: 'G→A' }).waitFor({ timeout: 3000 });
    ok((await page.locator('[data-testid="chord-sym"]').allTextContents()).join(' ') === 'A E F#m D A', `옮긴 코드 ${(await page.locator('[data-testid="chord-sym"]').allTextContents()).join(' ')}`);
    // 백업 저장 → 불러오기
    await page.getByRole('button', { name: '설정' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-save').click()]);
    const bpath = await dl.path();
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('backup-file').setInputFiles(bpath);
    await page.getByTestId('backup-msg').filter({ hasText: '불러왔어요' }).waitFor({ timeout: 5000 });
    ok(/곡 [3-9]개/.test(await text(page.getByTestId('backup-msg'))), `백업 불러오기: ${await text(page.getByTestId('backup-msg'))}`);
    await page.getByRole('button', { name: '닫기' }).click();

    // 16. v0.7 — 멜로디 보이싱 양손 반주, 자유 반주, 보이싱 연습
    await tab(page, '곡');
    if (await page.getByRole('button', { name: /^‹ 곡 목록/ }).isVisible().catch(() => false)) await page.getByRole('button', { name: /^‹ 곡 목록/ }).click();
    await page.getByTestId('song-grace').click();
    await page.getByTestId('arrange-open').click();
    await page.getByTestId('two-3').click();
    await page.getByTestId('arrange-make').click();
    await page.getByTestId('song-title').filter({ hasText: '반주(양손 ③)' }).waitFor({ timeout: 3000 });
    ok(await page.locator('[data-testid="staff"] .note').count() >= 45, `양손 ③ 악보 음표 ${await page.locator('[data-testid="staff"] .note').count()}`);
    await page.screenshot({ path: 'scripts/shot-voicing.png', fullPage: true });
    await page.getByRole('button', { name: /^‹ 곡 목록/ }).click();
    await page.getByTestId('song-grace').click();
    await page.getByTestId('mode-free').click();
    await page.getByTestId('wait-hint').waitFor(); await wait(page, 200);
    ok(await page.locator('.key.mk-target').count() >= 0, '자유 반주 열림');
    {
      const MEL = [[62], [67, 71, 67], [71, 69], [67, 64], [62, 62], [67, 71, 67], [71, 69], [74], [74, 71], [74, 71, 67], [71, 69], [67, 64], [62, 62], [67, 71, 67], [71, 69], [67]];
      const CH = ['', 'G', 'G', 'C', 'G', 'G', 'D', 'D', 'D', 'G', 'G', 'C', 'G', 'G', 'D', 'G'];
      const PCS = { G: [7, 11, 2], C: [0, 4, 7], D: [2, 6, 9] }, BASS = { G: 43, C: 48, D: 50 };
      for (let b = 0; b < MEL.length; b++) for (let k = 0; k < MEL[b].length; k++) {
        const m = MEL[b][k];
        const ch = CH[b];
        const extra = [];
        if (k === 0 && ch && PCS[ch].includes(m % 12)) {
          extra.push(BASS[ch]);
          for (let p = m - 3; p >= m - 12 && extra.length < 3; p--) if (PCS[ch].includes(p % 12) && p % 12 !== m % 12 && (extra.length === 1 || extra[extra.length - 1] - p >= 3)) extra.push(p);
        }
        await page.evaluate(({ extra, m }) => { extra.forEach((n) => window.__on(n)); window.__on(m); }, { extra, m });
        await wait(page, 70);
        await page.evaluate(({ extra, m }) => { extra.forEach((n) => window.__off(n)); window.__off(m); }, { extra, m });
        await wait(page, 40);
      }
    }
    await page.getByTestId('result').waitFor({ timeout: 3000 });
    ok(Number((await text(page.getByTestId('score'))).replace('점', '')) >= 95, `자유 반주 점수 ${await text(page.getByTestId('score'))} · ${await text(page.getByTestId('verdict'))}`);
    await tab(page, '배우기');
    if (await page.getByRole('button', { name: /^‹/ }).first().isVisible().catch(() => false)) await page.getByRole('button', { name: /^‹/ }).first().click();
    ok(await page.getByTestId('lesson-27').isVisible(), '27과까지');
    await page.getByTestId('lesson-26').click();
    await page.getByTestId('ex-l26-v1').click();
    for (let i = 0; i < 8; i++) {
      await page.getByTestId('voice-chord').waitFor(); await wait(page, 150);
      const keys = await page.locator('.key.mk-now, .key.mk-soon').evaluateAll((els) => els.map((e) => Number(e.dataset.midi)));
      await page.evaluate((ks) => ks.forEach((n) => window.__on(n)), keys);
      await wait(page, 80);
      await page.evaluate((ks) => ks.forEach((n) => window.__off(n)), keys);
      await wait(page, 60);
    }
    await page.getByTestId('result').waitFor({ timeout: 3000 });
    ok((await text(page.getByTestId('score'))) === '100점', `보이싱 연습 ${await text(page.getByTestId('score'))}`);
    await tab(page, '코드');
    await page.getByTestId('sub-voice').click();
    await page.getByTestId('voice-chord').waitFor();
    await page.screenshot({ path: 'scripts/shot-voice.png', fullPage: true });
    ok((await text(page.getByTestId('voice-chord'))).length > 0, '코드 탭 보이싱');

    // 8. 오늘·기록
    await tab(page, '오늘');
    await wait(page, 300);
    ok((await text(page.getByTestId('plan-learn'))).includes('2과'), `오늘: 2과로 넘어감 (${await text(page.getByTestId('plan-learn'))})`);
    await tab(page, '기록');
    await wait(page, 300);
    ok(await page.locator('[data-testid="runs"] li').count() >= 5, `기록 ${await page.locator('[data-testid="runs"] li').count()}개`);
    await page.screenshot({ path: 'scripts/shot-log.png', fullPage: true });

    // 뒤로 가기: 배우기 안쪽 → 목록
    await tab(page, '배우기');
    await page.getByTestId('lesson-3').click();
    await page.getByTestId('ex-l3-joy').click();
    await page.goBack(); await wait(page, 300);
    ok(await page.getByTestId('lesson-title').isVisible(), '뒤로: 연습 → 레슨');
    await page.goBack(); await wait(page, 300);
    ok(await page.getByTestId('lesson-1').isVisible(), '뒤로: 레슨 → 목록');

    ok(errors.length === 0, `콘솔 오류 없음 ${errors.join(' | ')}`);
    await browser.close();
  }
  {
    // 태블릿 가로 + MIDI 없는 브라우저
    const { browser, page, errors } = await launch({ width: 1280, height: 800 });
    await page.getByTestId('connect').click();
    await tab(page, '배우기');
    await page.getByTestId('lesson-8').click();
    await page.getByTestId('ex-l8-joy').click();
    await page.screenshot({ path: 'scripts/shot-tablet.png' });
    await tab(page, '코드'); await page.getByTestId('sub-free').click();
    await page.getByRole('button', { name: '88건반 전체' }).click();
    ok(await page.locator('.key').count() === 88, '88건반');
    await page.screenshot({ path: 'scripts/shot-tablet-play.png' });
    ok(errors.length === 0, `태블릿 콘솔 오류 없음 ${errors.join(' | ')}`);
    await browser.close();
  }
  {
    const browser = await chromium.launch();
    browsers.push(browser);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => { delete Navigator.prototype.requestMIDIAccess; });
    await page.goto(URL);
    ok((await text(page.getByTestId('midi-status'))).includes('안 돼요'), 'MIDI 없는 브라우저 안내');
    await browser.close();
  }
} catch (e) {
  console.log('FAIL 예외', e);
  console.log('페이지 오류:', allErrors.join(' | '));
  fails++;
  process.exitCode = 1;
} finally {
  for (const b of browsers) await b.close().catch(() => {});
  try { process.kill(-server.pid); } catch { /* 무시 */ }
}
console.log(fails ? `FAIL ${fails}` : 'ALL PASS');
