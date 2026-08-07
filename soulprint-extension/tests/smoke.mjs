import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const extensionPath = path.resolve('dist');
function findChromeForTesting(directory) {
  if (!fs.existsSync(directory)) return null;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findChromeForTesting(candidate);
      if (nested) return nested;
    } else if (entry.name === 'chrome.exe' && candidate.includes('chrome-win')) return candidate;
  }
  return null;
}

const executablePath = process.env.CHROME_PATH || findChromeForTesting(path.resolve('chrome')) || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await puppeteer.launch({
  executablePath,
  headless: false,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-first-run'],
});

try {
  const workerTarget = await browser.waitForTarget((target) => target.type() === 'service_worker' && target.url().startsWith('chrome-extension://'), { timeout: 10000 });
  assert.ok(workerTarget, 'Background service worker should start');

  const page = await browser.newPage();
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#soulprint-sidebar-root', { timeout: 10000 });
  const hasShadowUi = await page.$eval('#soulprint-sidebar-root', (host) => Boolean(host.shadowRoot?.querySelector('.sp-sidebar')));
  assert.equal(hasShadowUi, true, 'Sidebar should mount inside a shadow root');

  const extensionId = new URL(workerTarget.url()).host;
  const popup = await browser.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForSelector('.popup', { timeout: 10000 });
  assert.match(await popup.title(), /SoulPrint/i);
  console.log(`SoulPrint extension smoke test passed (${extensionId}).`);
} finally {
  await browser.close();
}
