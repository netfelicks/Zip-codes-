import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { parseCsv, toLead } from './lead-utils.js';

const SOURCE_URL = 'https://appdev.fresno.gov/finance/businessdirectory-v2/index.php?view=new';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'data', 'leads.json');
const now = new Date();
const month = now.toLocaleString('en-US', { month: 'long', timeZone: 'America/Los_Angeles' });
const year = String(now.toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Los_Angeles' }));

async function downloadCurrentCsv() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.selectOption('#month', { label: month });
    await page.selectOption('#year', { label: year });
    await page.waitForSelector('#downloadCsv:not([disabled])', { timeout: 60000 });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#downloadCsv')
    ]);
    return await readFile(await download.path(), 'utf8');
  } finally {
    await browser.close();
  }
}

const csv = await downloadCurrentCsv();
const leads = parseCsv(csv).map(toLead).filter(Boolean).sort((a, b) =>
  (b.start || '').localeCompare(a.start || '') || a.name.localeCompare(b.name)
);
await mkdir(join(root, 'data'), { recursive: true });
await writeFile(output, `${JSON.stringify({
  updated: now.toISOString(),
  source: SOURCE_URL,
  month: `${month} ${year}`,
  leads
}, null, 2)}\n`);
console.log(`Wrote ${leads.length} territory leads for ${month} ${year}.`);
