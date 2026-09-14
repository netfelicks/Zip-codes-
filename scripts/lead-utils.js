const FELIX_ZIPS = new Set([
  '93202','93204','93230','93234','93239','93242','93245','93266','93277',
  '93291','93529','93608','93609','93610','93614','93616','93620','93622',
  '93624','93625','93627','93630','93631','93636','93637','93638','93640',
  '93648','93652','93656','93660','93662','93666','93668','93673','93701',
  '93702','93704','93705','93706','93721','93723','93725','93728','95223','95311'
]);

const HESHAM_ZIPS = new Set([
  '93262','93602','93603','93611','93612','93615','93618','93619','93621',
  '93626','93628','93633','93641','93643','93644','93646','93647','93650',
  '93651','93654','93657','93667','93675','93703','93710','93711','93720',
  '93722','93726','93727','93730'
]);

const JOHNNY_ZIPS = new Set([
  '93512','93514','93517','93541','93546','93601','93604','93605','93606','93623',
  '93634','93635','93645','93653','93661','93664','93665','93669','95202','95203',
  '95204','95205','95207','95209','95210','95211','95212','95215','95220','95228',
  '95230','95231','95236','95237','95240','95242','95247','95258','95301','95303',
  '95305','95306','95307','95310','95312','95313','95315','95316','95317','95318',
  '95319','95320','95321','95322','95323','95324','95326','95327','95328','95329',
  '95333','95334','95335','95336','95337','95338','95340','95341','95343','95344',
  '95345','95346','95348','95350','95351','95354','95355','95356','95357','95358',
  '95360','95361','95363','95364','95365','95366','95367','95368','95369','95370',
  '95372','95374','95379','95380','95382','95383','95386','95388','95389','96107',
  '96133'
]);

export function zipFromAddress2(address2 = '') {
  const match = String(address2).match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

export function territoryForZip(zip) {
  if (FELIX_ZIPS.has(zip)) return 'Felix';
  if (HESHAM_ZIPS.has(zip)) return 'Hesham';
  if (JOHNNY_ZIPS.has(zip)) return 'Johnny';
  return null;
}

export function dateToIso(value = '') {
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return String(value).trim();
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

// The public city directories return simple HTML tables rather than CSV files.
// Keep this parser small and shared so each source is tested the same way.
export function parseHtmlTableRows(html, expectedColumns) {
  const text = value => String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(match =>
    [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => text(cell[1]))
  ).filter(row => row.length === expectedColumns);
}

export function leadFromAddress({ source, accountKey, name, fullAddress, start = '' }) {
  const [address = '', ...location] = String(fullAddress).split(/,\s*/);
  const address2 = location.join(', ');
  const zip = zipFromAddress2(address2);
  const territory = territoryForZip(zip);
  if (!territory) return null;
  return {
    account_key: `${source}:${accountKey || `${name}|${address}|${zip}`}`,
    source,
    name: String(name).trim(),
    address: address.trim(),
    address2,
    zip,
    territory,
    business_type: '',
    contact: '',
    email: '',
    phone: '',
    start: dateToIso(start),
    status: ''
  };
}

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const [headers = [], ...values] = rows;
  return values.filter(r => r.some(value => value.trim())).map(r => Object.fromEntries(
    headers.map((header, index) => [header.trim().toUpperCase(), (r[index] || '').trim()])
  ));
}

export function value(record, ...names) {
  return names.map(name => record[name]).find(value => value !== undefined && value !== '') || '';
}

export function toLead(record) {
  const address2 = value(record, 'ADDRESS2', 'ADDRESS_2', 'CITY_STATE_ZIP');
  const zip = zipFromAddress2(address2);
  const territory = territoryForZip(zip);
  if (!territory) return null;
  const name = value(record, 'BUSINESS_NAME', 'BUSINESS', 'NAME', 'DBA_NAME');
  const address = value(record, 'ADDRESS1', 'ADDRESS_1', 'ADDRESS', 'STREET_ADDRESS');
  const start = value(record, 'START_DATE', 'STARTDATE', 'LICENSE_START_DATE', 'DATE_STARTED');
  return {
    account_key: value(record, 'ACCOUNT_KEY', 'ACCOUNTNUMBER', 'ACCOUNT_NUMBER') || `${name}|${address}|${zip}`,
    source: 'Fresno',
    name,
    address,
    address2,
    zip,
    territory,
    business_type: value(record, 'BUSINESS_TYPE', 'BUSINESS_CATEGORY', 'TYPE', 'CATEGORY'),
    contact: value(record, 'CONTACT', 'CONTACT_NAME', 'OWNER_NAME'),
    email: value(record, 'EMAIL', 'EMAIL_ADDRESS', 'BUSINESS_EMAIL'),
    phone: value(record, 'PHONE', 'PHONE_NUMBER', 'TELEPHONE'),
    start: dateToIso(start),
    status: value(record, 'STATUS')
  };
}
