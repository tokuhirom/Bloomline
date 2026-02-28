import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createServer } from 'vite';

const STORAGE_KEY = 'bloomline-data';
const PORT = Number(process.env.SCREENSHOT_PORT ?? 4174);
const VIEWPORT = {
  width: Number(process.env.SCREENSHOT_WIDTH ?? 1660),
  height: Number(process.env.SCREENSHOT_HEIGHT ?? 1040),
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const demoStatePath = path.join(projectRoot, 'scripts', 'demo-state.json');
const outputPath = path.join(projectRoot, 'docs', 'images', 'readme-demo.png');

const stateRaw = await readFile(demoStatePath, 'utf-8');
JSON.parse(stateRaw);

const server = await createServer({
  root: projectRoot,
  logLevel: 'error',
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
  },
});

let browser;

try {
  await server.listen();
  const origin = `http://127.0.0.1:${PORT}`;

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });

  await context.addInitScript(
    ({ storageKey, payload }) => {
      window.localStorage.setItem(storageKey, payload);
    },
    { storageKey: STORAGE_KEY, payload: stateRaw },
  );

  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForSelector('#node-root .node-item');

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  await page.waitForTimeout(250);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await page.screenshot({ path: outputPath, fullPage: false });

  console.log(`Saved screenshot to ${path.relative(projectRoot, outputPath)}`);
} finally {
  if (browser) {
    await browser.close();
  }
  await server.close();
}
