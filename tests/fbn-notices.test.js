import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFresnoFbnNotices } from '../scripts/fbn-notices.js';

test('parses a territory FBN notice without using the registrant address', () => {
  const parsed = parseFresnoFbnNotices(`
    <p>FICTITIOUS BUSINESS NAME STATEMENT<br>File No. 2202610003617<br>
    The following person(s) is (are) conducting business as:<br>
    Rapid Urgent Care and Clinic located at 2151 Herndon Avenue, Suite 102, Clovis, CA, 93611, FRESNO COUNTY<br>
    Full Name of Registrant:<br>Rapid Urgent Care, 2151 Herndon Ave, Ste 102, Clovis, CA 93611.<br>
    Registrant has not yet commenced to transact business under the Fictitious Business Name listed-above.<br>
    This business conducted by: A Corporation<br>
    This statement filed with the Fresno County Clerk on: 08/04/2026.</p>`);
  const [lead] = parsed;
  assert.deepEqual(lead, {
    account_key: 'Fresno FBN:2202610003617', source: 'Fresno FBN', name: 'Rapid Urgent Care and Clinic',
    address: '2151 Herndon Avenue', address2: 'Suite 102, Clovis, CA, 93611', zip: '93611', territory: 'Hesham',
    business_type: 'A Corporation', contact: 'Rapid Urgent Care, 2151 Herndon Ave, Ste 102, Clovis, CA 93611.', email: '',
    phone: '', start: '2026-08-04', status: ''
  });
});
