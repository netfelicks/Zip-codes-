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

export function zipFromAddress2(address2 = '') {
  const match = String(address2).match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

export function territoryForZip(zip) {
  if (FELIX_ZIPS.has(zip)) return 'Felix';
  if (HESHAM_ZIPS.has(zip)) return 'Hesham';
  return null;
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
    name,
    address,
    address2,
    zip,
    territory,
    business_type: value(record, 'BUSINESS_TYPE', 'BUSINESS_CATEGORY', 'TYPE', 'CATEGORY'),
    contact: value(record, 'CONTACT', 'CONTACT_NAME', 'OWNER_NAME'),
    phone: value(record, 'PHONE', 'PHONE_NUMBER', 'TELEPHONE'),
    start,
    status: value(record, 'STATUS')
  };
}
