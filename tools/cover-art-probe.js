// Sunset Cover Studio probe: loads the editor in headed Firefox under Xvfb,
// exercises photo/layout/grade/caption/crop/zoom/export, and takes the four
// screenshots from shots.json as genuine renders of the app.
// Run: NODE_PATH=/home/hatch/workspace/pw-test/node_modules xvfb-run -a -s "-screen 0 1280x720x24" node tools/cover-art-probe.js
const { spawn } = require('node:child_process');
const { mkdirSync, statSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { firefox } = require('playwright');

const ROOT = join(__dirname, '..');
const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = JSON.parse(readFileSync(join(ROOT, 'shots.json'), 'utf8'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    browser = await firefox.launch({
      headless: false,
      firefoxUserPrefs: {
        'webgl.force-enabled': true,
        'webgl.software-webgl': true,
        'gfx.webrender.software': true,
      },
      env: {
        ...process.env,
        LIBGL_ALWAYS_SOFTWARE: '1',
        GALLIUM_DRIVER: 'llvmpipe',
        MOZ_DISABLE_CONTENT_SANDBOX: '1',
      },
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });

    await page.goto(`${BASE}index.html`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__cover && window.__cover.ready, null, { timeout: 20000 });
    check('page loads and renders', true);

    // Layout switch.
    await page.click('[data-layout="grid"]');
    await page.waitForTimeout(400);
    check('layout switches to grid', (await page.evaluate(() => window.__cover.state.layout)) === 'grid');

    // Grade switch.
    await page.click('[data-grade="neon"]');
    await page.waitForTimeout(400);
    check('grade switches to neon', (await page.evaluate(() => window.__cover.state.grade)) === 'neon');

    // Caption edit.
    await page.fill('#title', 'NEON NIGHTS');
    await page.waitForTimeout(500);
    check('caption edit applies', (await page.evaluate(() => window.__cover.state.title)) === 'NEON NIGHTS');

    // Photo pick for panel 2.
    await page.click('.slot[data-panel="1"]');
    await page.click('[data-sample="boulevard"]');
    await page.waitForTimeout(500);
    check(
      'panel 2 photo set to boulevard',
      (await page.evaluate(() => window.__cover.state.panels[1].photo)) === 'boulevard',
    );

    // Zoom panel 0 first: a square photo in a square panel has no slack to
    // pan, so the drag test below needs the zoom to create some.
    await page.click('.slot[data-panel="0"]');
    await page.$eval('#zoom', (el) => {
      el.value = '1.8';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    check('zoom sets to 1.8', (await page.evaluate(() => window.__cover.state.panels[0].zoom)) === 1.8);

    // Drag to crop panel 0.
    const before = await page.evaluate(() => window.__cover.state.panels[0].ox);
    const box = await page.locator('#preview').boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.3, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__cover.state.panels[0].ox);
    check('drag pans the photo', after !== before, `ox ${before} -> ${after}`);

    // Recenter.
    await page.click('#recenter');
    await page.waitForTimeout(400);
    const rec = await page.evaluate(() => {
      const p = window.__cover.state.panels[0];
      return { ox: p.ox, oy: p.oy, zoom: p.zoom };
    });
    check('recenter resets the panel', rec.ox === 0 && rec.oy === 0 && rec.zoom === 1, JSON.stringify(rec));

    // PNG exports at all three sizes: real PNGs, exact dimensions.
    for (const size of ['square', 'portrait', 'story']) {
      const r = await page.evaluate(async (s) => {
        const out = await window.__cover.exportPng(s);
        const buf = new Uint8Array(await out.blob.arrayBuffer());
        return { len: buf.length, magic: [...buf.slice(0, 4)], w: out.w, h: out.h };
      }, size);
      const want = { square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920] }[size];
      check(
        `export PNG ${size} ${want[0]}x${want[1]}`,
        r.magic.join(',') === '137,80,78,71' && r.w === want[0] && r.h === want[1] && r.len > 100000,
        `${r.w}x${r.h}, ${r.len} bytes`,
      );
    }

    check('zero page/console errors so far', errors.length === 0, errors.slice(0, 3).join(' | '));

    // Screenshots from shots.json.
    mkdirSync(join(ROOT, 'screenshots'), { recursive: true });
    for (const shot of SHOTS) {
      const shotPage = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
      const shotErrors = [];
      shotPage.on('pageerror', (e) => shotErrors.push(e.message));
      await shotPage.goto(`${BASE}index.html${shot.query}`, { waitUntil: 'load', timeout: 30000 });
      await shotPage.waitForFunction(() => window.__cover && window.__cover.ready, null, { timeout: 20000 });
      await shotPage.waitForTimeout(600);
      const path = join(ROOT, 'screenshots', shot.name);
      let quality = 85;
      await shotPage.screenshot({ path, type: 'jpeg', quality, fullPage: true });
      let size = statSync(path).size;
      if (size > 262144) {
        quality = 70;
        await shotPage.screenshot({ path, type: 'jpeg', quality, fullPage: true });
        size = statSync(path).size;
      }
      check(`screenshot ${shot.name} <=256 KiB`, size <= 262144, `${size} bytes at quality ${quality}`);
      check(`screenshot ${shot.name} no page errors`, shotErrors.length === 0, shotErrors.slice(0, 2).join(' | '));
      await shotPage.close();
    }

    check('zero page/console errors overall', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (err) {
    check(`probe crashed: ${err.message}`, false);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const out = results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`).join('\n');
  writeFileSync(join(ROOT, 'tools', 'cover-art-probe.out'), `${out}\n${passed} passed, ${failed} failed\n`);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
