import { leadFromAddress } from './lead-utils.js';

const NOTICES_API = 'https://thebusinessjournal.com/wp-json/wp/v2/posts';

function plainText(html = '') {
  return String(html)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8217;|&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function between(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const afterStart = text.slice(start).replace(startPattern, '').trim();
  const end = afterStart.search(endPattern);
  return (end < 0 ? afterStart : afterStart.slice(0, end)).trim();
}

function normalizeAddress(value) {
  return value.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/,\s*$/, '').trim();
}

export function parseFresnoFbnNotices(html) {
  const text = plainText(html);
  const blocks = text.split(/(?=FICTITIOUS\s+BUSINESS\s+NAME\s+STATEMENT)/i)
    .filter(block => /FICTITIOUS\s+BUSINESS\s+NAME\s+STATEMENT/i.test(block));
  const leads = [];
  for (const block of blocks) {
    const fileNumber = (block.match(/File\s+No\.?\s*([A-Z0-9-]+)/i) || [])[1];
    const name = between(
      block,
      /The following person\(s\) is \(are\) conducting business as\s*:?/i,
      /\s+(?:located\s+at|at)\s+/i
    ).replace(/\n/g, ' ').trim();
    const address = between(
      block,
      /\s+(?:located\s+at|at)\s+/i,
      /\s+(?:FRESNO\s+COUNTY|Full Name of Registrant:)/i
    );
    const filed = (block.match(/This statement filed with the Fresno County Clerk on\s*:?\s*([^\n.]+)/i) || [])[1] || '';
    const registrant = between(block, /Full Name of Registrant\s*:/i, /Registrant (?:has |commenced )/i);
    const businessType = (block.match(/This business conducted by\s*:?\s*([^\n.]+)/i) || [])[1] || '';
    if (!name || !address || !fileNumber) continue;
    const lead = leadFromAddress({
      source: 'Fresno FBN', accountKey: fileNumber, name,
      fullAddress: normalizeAddress(address), start: filed
    });
    if (lead) {
      lead.business_type = businessType.trim();
      lead.contact = registrant.replace(/\n/g, ' ').trim();
      leads.push(lead);
    }
  }
  return leads;
}

export async function downloadFresnoFbnLeads(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const query = new URLSearchParams({
    search: 'Public Notices', after: start, per_page: '100',
    _fields: 'link,date,content'
  });
  const response = await fetch(`${NOTICES_API}?${query}`);
  if (!response.ok) throw new Error(`Fresno FBN notices returned HTTP ${response.status}`);
  const posts = await response.json();
  const byFileNumber = new Map();
  for (const post of posts) {
    for (const lead of parseFresnoFbnNotices(post.content?.rendered)) {
      byFileNumber.set(lead.account_key, lead);
    }
  }
  return [...byFileNumber.values()];
}
