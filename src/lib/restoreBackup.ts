/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Shape of the JSON exported by the old (Firebase) Aziz app. Only the fields we
// restore are typed; the export carries a few extras (walletName, categoryName)
// that the new fixed-column schema doesn't have — they're dropped on the way in.
export interface AzizBackup {
  app?: string;
  version?: string;
  profile?: { name?: string; email?: string; defaultExpenseWalletId?: string };
  preferences?: { language?: 'ar' | 'en'; currency?: 'LYD' | 'USD'; exchangeRate?: number; theme?: 'light' | 'dark' };
  wallets?: any[];
  categories?: any[];
  incomes?: any[];
  expenses?: any[];
  plannedPurchases?: any[];
  savingsGroups?: any[];
}

export interface RestoreResult {
  wallets: number;
  categories: number;
  incomes: number;
  expenses: number;
  plannedPurchases: number;
  savingsGroups: number;
}

const CHUNK = 200;

async function insertChunked(supabase: SupabaseClient, table: string, rows: any[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`insert ${table}: ${error.message}`);
  }
}

/**
 * Clean-replace restore: wipes the signed-in user's rows, then loads the backup.
 * Old client-generated string IDs (wal_*, inc_*, category ids, jam_*) are
 * remapped to fresh uuids so the new schema's FKs line up. Idempotent enough to
 * re-run (it clears first). Not a single DB transaction — supabase-js has no
 * multi-statement transaction from the browser — but the clear+insert order is
 * FK-safe and a re-run simply reclears, so a mid-way failure is recoverable by
 * running it again.
 *
 * ponytail: client-generated uuids (crypto.randomUUID) instead of a server RPC,
 * because the 8.5MB backup (base64 receipt images) is happier as chunked table
 * inserts than as one giant jsonb RPC body. Upgrade to an RPC only if atomicity
 * across the whole restore becomes a hard requirement.
 */
export async function restoreBackup(
  backup: AzizBackup,
  userId: string,
  supabase: SupabaseClient,
): Promise<RestoreResult> {
  const walletMap = new Map<string, string>();
  const categoryMap = new Map<string, string>();
  const newId = () => crypto.randomUUID();

  (backup.wallets || []).forEach((w) => walletMap.set(w.id, newId()));
  (backup.categories || []).forEach((c) => categoryMap.set(c.id, newId()));

  // --- Clear existing rows, FK-safe order (children before parents) ---
  // Detach the profile's wallet ref first so wallets can be deleted.
  await supabase.from('profiles').update({ default_expense_wallet_id: null }).eq('id', userId);
  for (const table of ['comments', 'trash', 'future_purchases', 'incomes', 'expenses', 'savings_groups', 'notifications', 'categories', 'wallets']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`clear ${table}: ${error.message}`);
  }

  // --- Wallets ---
  const walletRows = (backup.wallets || []).map((w) => ({
    id: walletMap.get(w.id),
    user_id: userId,
    name: w.name,
    initial_balance: w.initialBalance ?? 0,
    currency: w.currency,
    color: w.color || 'slate',
    icon: w.icon || 'Wallet',
    is_hidden: !!w.isHidden,
  }));
  await insertChunked(supabase, 'wallets', walletRows);

  // --- Categories (single insert; self parent_id FK is satisfied within the
  // statement since every id is pre-generated above) ---
  const categoryRows = (backup.categories || []).map((c) => ({
    id: categoryMap.get(c.id),
    user_id: userId,
    name: c.name,
    type: c.type,
    color: c.color || 'slate',
    icon: c.icon || 'Box',
    is_archived: !!c.isArchived,
    parent_id: c.parentId ? categoryMap.get(c.parentId) || null : null,
  }));
  await insertChunked(supabase, 'categories', categoryRows);

  // --- Incomes ---
  const incomeRows = (backup.incomes || []).map((t) => ({
    id: newId(),
    user_id: userId,
    amount: t.amount ?? 0,
    currency: t.currency,
    title: t.title,
    date: t.date,
    category_id: t.categoryId ? categoryMap.get(t.categoryId) || null : null,
    wallet_id: t.walletId ? walletMap.get(t.walletId) || null : null,
    notes: t.notes || null,
    image_url: t.imageUrl || null,
    priority: t.priority || null,
    is_historical: t.isHistorical ?? null,
    is_opening: t.isOpening ?? null,
    category_name: t.categoryName || null,
  }));
  await insertChunked(supabase, 'incomes', incomeRows);

  // --- Expenses ---
  const expenseRows = (backup.expenses || []).map((t) => ({
    id: newId(),
    user_id: userId,
    amount: t.amount ?? 0,
    currency: t.currency,
    title: t.title,
    date: t.date,
    category_id: t.categoryId ? categoryMap.get(t.categoryId) || null : null,
    wallet_id: t.walletId ? walletMap.get(t.walletId) || null : null,
    notes: t.notes || null,
    image_url: t.imageUrl || null,
    priority: t.priority || null,
    is_historical: t.isHistorical ?? null,
    category_name: t.categoryName || null,
    original_amount: t.originalAmount ?? null,
    is_refunded: t.isRefunded ?? null,
    refunded_at: t.refundedAt || null,
    is_due: t.isDue ?? null,
  }));
  await insertChunked(supabase, 'expenses', expenseRows);

  // --- Future purchases (empty in this export, but handle generally) ---
  const purchaseRows = (backup.plannedPurchases || []).map((p) => ({
    id: newId(),
    user_id: userId,
    item_name: p.itemName,
    expected_price: p.expectedPrice ?? 0,
    currency: p.currency,
    priority: p.priority || 'medium',
    is_purchased: !!p.isPurchased,
    expected_date: p.expectedDate || null,
    category_id: p.categoryId ? categoryMap.get(p.categoryId) || null : null,
    notes: p.notes || null,
    // matched_expense_id intentionally dropped: it referenced an old expense id
    // that no longer exists after remap; the link is non-essential history.
  }));
  await insertChunked(supabase, 'future_purchases', purchaseRows);

  // --- Savings groups (members/receiving_order are self-contained JSONB) ---
  const groupRows = (backup.savingsGroups || []).map((g) => ({
    id: newId(),
    user_id: userId,
    name: g.name,
    currency: g.currency,
    total_amount: g.totalAmount ?? 0,
    num_members: g.numMembers ?? (g.members?.length || 2),
    payment_per_member: g.paymentPerMember ?? (g.numMembers ? (g.totalAmount || 0) / g.numMembers : 0),
    payment_cycle: g.paymentCycle || 'monthly',
    start_date: g.startDate,
    members: g.members || [],
    receiving_order: g.receivingOrder || [],
    is_archived: !!g.isArchived,
  }));
  await insertChunked(supabase, 'savings_groups', groupRows);

  // --- Profile + preferences ---
  const p = backup.profile || {};
  const prefs = backup.preferences || {};
  const profileUpdate: Record<string, any> = {};
  if (p.name) profileUpdate.name = p.name;
  if (prefs.language) profileUpdate.preferred_language = prefs.language;
  if (prefs.currency) profileUpdate.preferred_currency = prefs.currency;
  if (prefs.exchangeRate) profileUpdate.exchange_rate_usd_lyd = prefs.exchangeRate;
  if (p.defaultExpenseWalletId) {
    profileUpdate.default_expense_wallet_id = walletMap.get(p.defaultExpenseWalletId) || null;
  }
  if (Object.keys(profileUpdate).length) {
    const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
    if (error) throw new Error(`update profile: ${error.message}`);
  }

  return {
    wallets: walletRows.length,
    categories: categoryRows.length,
    incomes: incomeRows.length,
    expenses: expenseRows.length,
    plannedPurchases: purchaseRows.length,
    savingsGroups: groupRows.length,
  };
}
