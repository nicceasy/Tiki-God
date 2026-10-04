#!/usr/bin/env node
// Screenshots a built review gallery into contact sheets of 8 drinks each (2 rows × 4).
//   node scripts/review/shoot.mjs <dir-with-review.html>
// Needs Playwright (globally installed in the dev container).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const dir = process.argv[2];
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1296, height: 1200 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('file://' + dir + '/review.html');
await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 120000 });
await page.waitForTimeout(800);
const cards = await page.$$('.card');
const boxes = [];
for (const c of cards) boxes.push(await c.boundingBox());
let sheet = 0;
for (let i = 0; i < boxes.length; i += 8) {
  const group = boxes.slice(i, i + 8);
  const y0 = Math.min(...group.map(b => b.y)) - 8, y1 = Math.max(...group.map(b => b.y + b.height)) + 8;
  await page.screenshot({ path: `${dir}/sheet-${String(++sheet).padStart(2, '0')}.png`, clip: { x: 0, y: y0, width: 1296, height: y1 - y0 }, fullPage: true });
}
console.log(`${cards.length} drinks → ${sheet} sheets in ${dir}`);
if (errs.length) console.log('page errors:\n' + errs.join('\n'));
await browser.close();
