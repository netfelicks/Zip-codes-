const { execFileSync } = require('node:child_process');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const repo = path.resolve(__dirname, '..');
const git = 'C:\\Users\\felix\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe';
const edge = 'C:\\Progra~2\\Microsoft\\Edge\\Application\\msedge.exe';
const clovisUrl = 'https://businesslicense.cityofclovis.com/Search/';

function pacificParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

function runGit(...args) {
  return execFileSync(git, args, { cwd: repo, stdio: 'pipe', encoding: 'utf8' });
}

async function getClovisLeads() {
  const { leadFromAddress } = await import('./lead-utils.js');
  const now = new Date();
  const { year, month } = pacificParts(now);
  const from = `${month}/01/${year}`;
  const to = `${month}/${String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, '0')}/${year}`;
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(clovisUrl, { waitUntil: 'networkidle', timeout: 60000 });
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
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!process.env.DRY_RUN) runGit('-c', 'http.sslBackend=openssl', 'pull', '--ff-only', 'origin', 'main');
  const clovisLeads = await getClovisLeads();
  console.log(`Found ${clovisLeads.length} Clovis leads in the territory.`);
  if (process.env.DRY_RUN) return;

  const dataPath = path.join(repo, 'data', 'leads.json');
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const leads = [...(data.leads || []).filter(lead => lead.source !== 'Clovis'), ...clovisLeads]
    .sort((a, b) => (b.start || '').localeCompare(a.start || '') || a.name.localeCompare(b.name));
  await writeFile(dataPath, `${JSON.stringify({
    ...data,
    updated: new Date().toISOString(),
    sources: { ...(data.sources || {}), Clovis: clovisUrl },
    leads
  }, null, 2)}\n`);
  runGit('add', 'data/leads.json');
  try {
    runGit('diff', '--cached', '--quiet');
    console.log('No Clovis lead changes to publish.');
  } catch {
    runGit('commit', '-m', 'Update Clovis new-business leads');
    runGit('-c', 'http.sslBackend=openssl', 'push', 'origin', 'main');
    console.log('Published Clovis lead update.');
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
