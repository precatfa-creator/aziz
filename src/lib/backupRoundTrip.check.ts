/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Round-trip check: what `buildBackup` writes must be exactly what
 * `restoreBackup` can read back. A backup file that silently fails to restore
 * is the worst outcome this feature has, and nothing else tests the two halves
 * against each other.
 *
 * Run: node --experimental-strip-types src/lib/backupRoundTrip.check.ts
 */

import assert from 'node:assert';
import { buildBackup } from './exportBackup.ts';
import { restoreBackup } from './restoreBackup.ts';

// Minimal supabase stub: records inserts, swallows deletes/updates.
function stubClient() {
  const inserted: Record<string, any[]> = {};
  const client: any = {
    from(table: string) {
      return {
        insert(rows: any[]) {
          (inserted[table] ||= []).push(...rows);
          return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
  };
  return { client, inserted };
}

const now = new Date();
const input = {
  profile: {
    uid: 'u1',
    name: 'Omar',
    email: 'o@example.com',
    preferredLanguage: 'ar',
    preferredCurrency: 'LYD',
    exchangeRateUSD_LYD: 6.15,
    defaultExpenseWalletId: 'w1',
    createdAt: now,
    updatedAt: now,
  },
  language: 'ar',
  currency: 'LYD',
  exchangeRate: 6.15,
  theme: 'dark',
  wallets: [
    { id: 'w1', userId: 'u1', name: 'Cash', initialBalance: 500, currency: 'LYD', color: 'emerald', icon: 'Wallet', createdAt: now, updatedAt: now },
  ],
  categories: [
    { id: 'c1', userId: 'u1', name: 'طعام / Food', type: 'expense', color: 'rose', icon: 'Utensils', isArchived: false, createdAt: now },
    { id: 'c2', userId: 'u1', name: 'راتب / Salary', type: 'income', color: 'emerald', icon: 'Coins', isArchived: false, parentId: 'c1', createdAt: now },
  ],
  incomes: [
    { id: 'i1', userId: 'u1', amount: 1200, currency: 'LYD', title: 'Salary', date: '2026-01-01', categoryId: 'c2', walletId: 'w1', notes: 'monthly', createdAt: now, updatedAt: now },
  ],
  expenses: [
    { id: 'e1', userId: 'u1', amount: 40, currency: 'LYD', title: 'Lunch', date: '2026-01-02', categoryId: 'c1', walletId: 'w1', isRefunded: false, createdAt: now, updatedAt: now },
  ],
  plannedPurchases: [
    { id: 'p1', userId: 'u1', itemName: 'Laptop', expectedPrice: 3000, currency: 'LYD', priority: 'high', categoryId: 'c1', isPurchased: false, createdAt: now, updatedAt: now },
  ],
  savingsGroups: [
    { id: 'g1', userId: 'u1', name: 'Jamiya', currency: 'LYD', totalAmount: 6000, numMembers: 6, paymentPerMember: 1000, paymentCycle: 'monthly', startDate: '2026-01-01', members: [], receivingOrder: [], isArchived: false, createdAt: now, updatedAt: now },
  ],
} as any;

const backup = buildBackup(input);

// Survives serialisation — this is what actually lands on disk.
const onDisk = JSON.parse(JSON.stringify(backup));
assert.equal(onDisk.app, 'aziz');
assert.ok(onDisk.exportedAt, 'exportedAt missing');

const { client, inserted } = stubClient();
const result = await restoreBackup(onDisk, 'u2', client);

// Every collection makes it back with the right count.
assert.deepEqual(result, {
  wallets: 1,
  categories: 2,
  incomes: 1,
  expenses: 1,
  plannedPurchases: 1,
  savingsGroups: 1,
});

// Field mapping actually resolved — not just row counts. A camelCase/snake_case
// mismatch would leave these null while the counts still looked right.
assert.equal(inserted.wallets[0].name, 'Cash');
assert.equal(inserted.wallets[0].initial_balance, 500);
assert.equal(inserted.wallets[0].user_id, 'u2');
assert.equal(inserted.incomes[0].title, 'Salary');
assert.equal(inserted.incomes[0].amount, 1200);
assert.equal(inserted.expenses[0].amount, 40);
assert.equal(inserted.future_purchases[0].item_name, 'Laptop');
assert.equal(inserted.savings_groups[0].total_amount, 6000);

// Foreign keys were remapped to the new uuids, not left pointing at old ids.
const walletId = inserted.wallets[0].id;
const foodId = inserted.categories.find((c: any) => c.name.includes('Food')).id;
assert.equal(inserted.incomes[0].wallet_id, walletId);
assert.equal(inserted.expenses[0].category_id, foodId);
assert.equal(inserted.future_purchases[0].category_id, foodId);
assert.notEqual(walletId, 'w1');

// Self-referencing category parent survives the remap.
const salary = inserted.categories.find((c: any) => c.name.includes('Salary'));
assert.equal(salary.parent_id, foodId);

console.log('backupRoundTrip: all checks passed');
