import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { leadFromAddress, parseCsv, toLead } from './lead-utils.js';

const SOURCE_URL = 'https://appdev.fresno.gov/finance/businessdirectory-v2/index.php?view=new';
const CLOVIS_URL = 'https://businesslicense.cityofclovis.com/Search/';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'data', 'leads.json');
const now = new Date();
const month = now.toLocaleString('en-US', { month: 'long', timeZone: 'America/Los_Angeles' });
const year = String(now.toLocaleString('en-US', { year: 'numeric', timeZone: 'America/Los_Angeles' }));

function pacificParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

async function downloadFresnoCsv(page) {
  await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.selectOption('#month', { label: month });
  await page.selectOption('#year', { label: year });
  await page.waitForSelector('#downloadCsv:not([disabled])', { timeout: 60000 });
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#downloadCsv')]);
  return readFile(await download.path(), 'utf8');
}

async function scrapeClovis(page) {
  const { year: y, month: m } = pacificParts(now);
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const from = `${m}/01/${y}`;
  const to = `${m}/${String(lastDay).padStart(2, '0')}/${y}`;
  await page.goto(CLOVIS_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('a[href="#"]').click();
  await page.locator('#FromDate').fill(from);
  await page.locator('#ToDate').fill(to);
  await page.locator('#searchByType').click();
  await page.waitForSelector('table tr:nth-child(2)', { timeout: 60000 });
  const rows = await page.locator('table tr').evaluateAll(trs => trs.slice(1).map(tr =>
    Array.from(tr.querySelectorAll('td'), td => td.textContent.trim())
  ));
  return rows.map(([accountKey, name, start, , fullAddress]) => leadFromAddress({
    source: 'Clovis', accountKey, name, fullAddress, start
  })).filter(Boolean);
}

const browser = await chromium.launch({ headless: true });
let clovisLeads = [];
let clovisError = null;
try {
  const page = await browser.newPage();
  const csv = await downloadFresnoCsv(page);
  clovisLeads = await scrapeClovis(page).catch(error => {
    clovisError = error.message;
    return [];
  });
  var fresnoLeads = parseCsv(csv).map(toLead).filter(Boolean);
} finally {
  await browser.close();
}

const leads = [...fresnoLeads, ...clovisLeads].sort((a, b) =>
  (b.start || '').localeCompare(a.start || '') || a.name.localeCompare(b.name)
);
await mkdir(join(root, 'data'), { recursive: true });
await writeFile(output, `${JSON.stringify({
  updated: now.toISOString(),
  sources: { Fresno: SOURCE_URL, Clovis: CLOVIS_URL },
  warnings: clovisError ? [`Clovis import skipped: ${clovisError}`] : [],
  month: `${month} ${year}`,
  leads
}, null, 2)}\n`);
console.log(`Wrote ${leads.length} territory leads for ${month} ${year} (${clovisLeads.length} from Clovis).`);
