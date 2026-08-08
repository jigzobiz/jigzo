import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const customers = readFileSync(resolve(here, '../src/pages/admin/Customers.jsx'), 'utf8');
const detail = readFileSync(resolve(here, '../src/pages/admin/CustomerDetail.jsx'), 'utf8');

assert.match(customers, /label: 'Actions'/, 'Customers table must expose an Actions column');
assert.match(customers, /r\.completedOrders === 0 && Number\(r\.totalSpendBHD\) === 0/, 'Delete must only be offered for zero-paid rows');
assert.match(customers, /Delete this test customer\?/, 'List delete requires a confirmation dialog');
assert.match(customers, /Paid and financial records are never deleted\./, 'Confirmation must explain financial protection');
assert.match(customers, /event\.stopPropagation\(\)/, 'Delete action must not trigger row navigation');
assert.match(customers, /setReload\(\(value\) => value \+ 1\)/, 'Successful deletion must refresh the list');
assert.match(detail, /navigate\('\/admin\/customers', \{ replace: true \}\)/, 'Detail deletion must return to the Customers list');
assert.match(detail, /Delete customer/, 'Detail confirmation must use the explicit delete label');

console.log('Admin Customer deletion frontend checks passed.');
