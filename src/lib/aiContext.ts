/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Category, Expense, Income } from '../types';

/**
 * A ledger row trimmed down to what the AI actually needs to answer questions.
 * Deliberately excludes id/userId/timestamps/imageUrl — they cost tokens, leak
 * internals, and the model can't use them.
 */
export interface LedgerRow {
  date: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  currency: string;
  category: string;
  notes?: string;
}

export interface LedgerContext {
  rows: LedgerRow[];
  /** Rows actually included (after the cap). */
  shown: number;
  /** Rows the user has in total — so the prompt can admit truncation. */
  total: number;
}

/** "Arabic / English" -> the half matching the active language. */
export function categoryName(
  categoryId: string,
  categories: Category[],
  language: 'ar' | 'en',
): string {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return '';
  return cat.name.split(' / ')[language === 'ar' ? 0 : 1] || cat.name;
}

/**
 * Flattens incomes + expenses into newest-first rows, capped so a large ledger
 * can't blow up the request body or the context window. Truncation is reported
 * via `shown`/`total` rather than hidden — a finance answer drawn from a
 * silently partial ledger is worse than no answer.
 */
export function buildLedgerContext(
  incomes: Income[],
  expenses: Expense[],
  categories: Category[],
  language: 'ar' | 'en',
  cap = 250,
): LedgerContext {
  const toRow = (r: Income | Expense, type: 'income' | 'expense'): LedgerRow => ({
    date: r.date,
    type,
    title: r.title,
    amount: r.amount,
    currency: r.currency,
    category: r.categoryName || categoryName(r.categoryId, categories, language),
    ...(r.notes ? { notes: r.notes } : {}),
  });

  const all = [
    ...incomes.map((i) => toRow(i, 'income')),
    ...expenses.map((e) => toRow(e, 'expense')),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return { rows: all.slice(0, cap), shown: Math.min(all.length, cap), total: all.length };
}
