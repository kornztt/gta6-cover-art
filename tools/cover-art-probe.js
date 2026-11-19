// Verification probe for Sunset Cover Studio (cover-art-01).
// Serves app/ via serve.ts, drives it in headed Firefox under Xvfb, checks the
// editor flows and PNG exports, then takes the shots.json screenshots.
// Usage: node tools/cover-art-probe.js   (run under xvfb-run)
import { firefox } from '/home/hatch/workspace/pw-test/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ENTRY = '/home/hatch/workspace/makefun-cover-art/entry';
const SHOTS = JSON.parse(readFileSync(`${ENTRY}/shots.json`, 'utf8'));
const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };
let failures = 0;
const check = (name, ok, extra = '') => { log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`.trim()); if (!ok) failures++; };

// 0. Recorder must be alive before we start.
try {
  execSync('ps -p 25998 -o pid= ', { stdio: 'pipe' });
  log('PASS recorder pid 25998 alive');
} catch {
  log('FAIL recorder pid 25998 is GONE — stopping');
  writeFileSync(`${ENTRY}/tools/cover-art-probe.out`, out.join('\n') + '\n');
  process.exit(2);
}

// 1. Serve app/.
const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: ENTRY, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const results = { failures: 0 };
let browser;
try {
  browser = await firefox.launch({
    headless: false,
    firefoxUserPrefs: {
      'webgl.force-enabled': true,
      'webgl.software-webgl': true,
      'gfx.webrender.software': true,
    },
    env: { ...process.env, LIBGL_ALWAYS_SOFTWARE: '1', GALLIUM_DRIVER: 'llvmpipe', MOZ_DISABLE_CONTENT_SANDBOX: '1' },
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  // 2. Editor loads.
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  check('editor loads, canvas present', await page.$('#cover') !== null);
  check('title input default', (await page.inputValue('#title')) === 'Sunset Heist');

  // 3. Sample photo into panel 1.
  await page.click('#sample-pier');
  await page.waitForTimeout(800);
  let st = await page.evaluate(() => window.__coverState);
  check('pier photo loaded into panel 1', !!st.photos[0].img);

  // 4. Split layout + second photo into panel 2.
  await page.click('[data-layout="split"]');
  await page.click('[data-slot="1"]');
  await page.click('#sample-boulevard');
  await page.waitForTimeout(800);
  st = await page.evaluate(() => window.__coverState);
  check('boulevard photo loaded into panel 2', !!st.photos[1].img);
  check('layout is split', st.layout === 'split');

  // 5. Drag to pan panel 1.
  await page.click('[data-slot="0"]');
  const box = await (await page.$('#cover')).boundingBox();
  const cx = box.x + box.width * 0.3, cy = box.y + box.height * 0.5;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  st = await page.evaluate(() => window.__coverState);
  check('drag pans photo (ox changed)', Math.abs(st.photos[0].ox) > 1, `ox=${st.photos[0].ox}`);

  // 6. Zoom slider.
  await page.fill('#zoom', '1.8');
  await page.dispatchEvent('#zoom', 'input');
  await page.waitForTimeout(300);
  st = await page.evaluate(() => window.__coverState);
  check('zoom slider sets zoom', Math.abs(st.photos[0].zoom - 1.8) < 0.01, `zoom=${st.photos[0].zoom}`);
  await page.click('#recenter');
  await page.waitForTimeout(200);
  st = await page.evaluate(() => window.__coverState);
  check('recenter resets zoom/pan', st.photos[0].zoom === 1 && st.photos[0].ox === 0);

  // 7. Caption edit + grade + title position.
  await page.fill('#title', 'Neon Nights');
  await page.fill('#subtitle', 'City after dark');
  await page.click('[data-grade="neon"]');
  await page.click('[data-titlepos="top"]');
  await page.waitForTimeout(300);
  st = await page.evaluate(() => window.__coverState);
  check('caption edit applied', st.title === 'Neon Nights' && st.subtitle === 'City after dark');
  check('grade neon + title top', st.grade === 'neon' && st.titlePos === 'top');

  // 8. PNG exports at all three sizes (capture the download, verify PNG + IHDR).
  async function exportAndCheck(sizeKey, w, h) {
    await page.click(`[data-size="${sizeKey}"]`);
    await page.waitForTimeout(400);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#export'),
    ]);
    const path = `/tmp/cover-export-${sizeKey}.png`;
    await dl.saveAs(path);
    const buf = readFileSync(path);
    const pngSig = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const iw = buf.readUInt32BE(16), ih = buf.readUInt32BE(20);
    check(`export ${sizeKey} is a real PNG ${iw}x${ih}`, pngSig && iw === w && ih === h, `bytes=${buf.length}`);
  }
  await exportAndCheck('square', 1080, 1080);
  await exportAndCheck('portrait', 1080, 1350);
  await exportAndCheck('story', 1080, 1920);

  // 9. Grid layout renders with a title card.
  await page.click('[data-size="square"]');
  await page.click('[data-layout="grid"]');
  await page.click('[data-grade="dusk"]');
  await page.waitForTimeout(400);
  st = await page.evaluate(() => window.__coverState);
  check('grid layout selected', st.layout === 'grid');

  check('zero page errors', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
  check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 300));

  // 10. Screenshots from shots.json.
  for (const shot of SHOTS) {
    const p2 = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
    p2.on('pageerror', (e) => pageErrors.push(`shot ${shot.name}: ${e}`));
    await p2.goto(`http://127.0.0.1:8080/${shot.query}`, { waitUntil: 'load' });
    try {
      await p2.waitForFunction(() => window.__shotReady === true, { timeout: 15000 });
    } catch {
      log(`FAIL shot ${shot.name} __shotReady never fired`);
      failures++;
    }
    await p2.waitForTimeout(400);
    const file = `${ENTRY}/screenshots/${shot.name}`;
    await p2.screenshot({ path: file, type: 'jpeg', quality: 85 });
    const sz = statSync(file).size;
    check(`screenshot ${shot.name} <=256KiB`, sz <= 262144, `${sz} B`);
    await p2.close();
  }
  check('zero page errors after shots', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 800));
}

try {
  const left = execSync('pgrep -f "firefox.*8080|playwright" || true', { encoding: 'utf8' }).trim();
  log('leftover firefox/playwright processes: ' + (left || 'none'));
} catch { log('leftover check skipped'); }

results.failures = failures;
log(`\nTOTAL: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`);
writeFileSync(`${ENTRY}/tools/cover-art-probe.out`, out.join('\n') + '\n');
process.exit(failures === 0 ? 0 : 1);
