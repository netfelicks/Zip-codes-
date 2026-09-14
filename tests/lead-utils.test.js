import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, territoryForZip, toLead, zipFromAddress2 } from '../scripts/lead-utils.js';

test('extracts a five-digit ZIP from ADDRESS2', () => {
  assert.equal(zipFromAddress2('FRESNO CA 93727-5260'), '93727');
  assert.equal(zipFromAddress2('FRESNO CA 93720'), '93720');
  assert.equal(zipFromAddress2('FRESNO CA'), null);
});

test('keeps only ZIPs assigned to a territory', () => {
  assert.equal(territoryForZip('93727'), 'Hesham');
  assert.equal(territoryForZip('93704'), 'Felix');
  assert.equal(territoryForZip('99999'), null);
});

test('parses quoted CSV and builds a lead using ADDRESS2', () => {
  const [record] = parseCsv('BUSINESS_NAME,ADDRESS1,ADDRESS2,PHONE\n"ACME, LLC",123 Main,"FRESNO CA 93727-5260",555-0100\n');
  assert.deepEqual(toLead(record), {
    account_key: 'ACME, LLC|123 Main|93727', name: 'ACME, LLC', address: '123 Main',
    address2: 'FRESNO CA 93727-5260', zip: '93727', territory: 'Hesham',
    business_type: '', contact: '', phone: '555-0100', start: '', status: ''
  });
});
