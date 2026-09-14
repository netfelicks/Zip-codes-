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

function htmlText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function clovisRows(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(match =>
    [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => htmlText(cell[1]))
  ).filter(row => row.length === 5);
}

async function scrapeClovis() {
  const { year: y, month: m } = pacificParts(now);
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const from = `${m}/01/${y}`;
  const to = `${m}/${String(lastDay).padStart(2, '0')}/${y}`;
  const body = new URLSearchParams({
    SelectedSearchType: 'Business Name', SearchString: '', FromDate: from, ToDate: to,
    BusinessTypeId: '0', CustomFieldId: '0', IsYesNo: 'False', hiddenListVal: '', submitButton: 'Search'
  });
  const response = await fetch(`${CLOVIS_URL}SearchBy`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body
  });
  if (!response.ok) throw new Error(`Clovis returned HTTP ${response.status}`);
  const rows = clovisRows(await response.text());
  if (!rows.length) throw new Error('Clovis returned no business-search rows');
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
  clovisLeads = await scrapeClovis().catch(error => {
    clovisError = error.message;
    return [];
  });
  var fresnoLeads = parseCsv(csv).map(toLead).filter(Boolean);
} finally {
  await browser.close();
}

let previousClovisLeads = [];
try {
  const previous = JSON.parse(await readFile(output, 'utf8'));
  previousClovisLeads = (previous.leads || []).filter(lead => lead.source === 'Clovis');
} catch {
  // First run: there is no prior local-source data to preserve.
}
const effectiveClovisLeads = clovisError ? previousClovisLeads : clovisLeads;
const leads = [...fresnoLeads, ...effectiveClovisLeads].sort((a, b) =>
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
console.log(`Wrote ${leads.length} territory leads for ${month} ${year} (${effectiveClovisLeads.length} from Clovis).`);
