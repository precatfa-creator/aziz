/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Expense, Income, Project } from '../types';
import { convertAmount, isEarning, roundMoney, type Currency } from './walletBalance';

/**
 * What one expense cost the project. Unlike `isSpending`, a part paid outside
 * the app (gold) counts: it moves no wallet, but it is still money the project
 * consumed. A withdrawal or a transfer only moves money the user still owns.
 */
export const isProjectCost = (e: Expense): boolean =>
  (e.expenseKind ?? 'wallet_spend') !== 'cash_withdrawal' && !e.transferId;

/**
 * The project and every project below it, at any depth. Guards against a
 * cycle (A under B under A), which the database cannot rule out on its own.
 */
export function projectFamily(projects: Project[], rootId: string): Set<string> {
  const family = new Set([rootId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of projects) {
      if (p.parentId && family.has(p.parentId) && !family.has(p.id)) {
        family.add(p.id);
        grew = true;
      }
    }
  }
  return family;
}

export interface ProjectTotals {
  /** Per currency, as recorded — never converted. */
  spent: Record<Currency, number>;
  earned: Record<Currency, number>;
  /** Everything converted into `currency` at the profile's rate. */
  spentTotal: number;
  earnedTotal: number;
  net: number;
}

/** `projectIds`: one project's own figures, or a whole `projectFamily`. */
export function projectTotals(
  projectIds: Set<string>,
  incomes: Income[],
  expenses: Expense[],
  currency: Currency,
  rateLydPerUsd: number,
): ProjectTotals {
  const spent: Record<Currency, number> = { LYD: 0, USD: 0 };
  const earned: Record<Currency, number> = { LYD: 0, USD: 0 };
  for (const e of expenses) {
    if (e.projectId && projectIds.has(e.projectId) && isProjectCost(e)) spent[e.currency] += e.amount;
  }
  for (const i of incomes) {
    if (i.projectId && projectIds.has(i.projectId) && isEarning(i)) earned[i.currency] += i.amount;
  }
  const total = (m: Record<Currency, number>) =>
    roundMoney(
      (Object.keys(m) as Currency[]).reduce((s, c) => s + convertAmount(m[c], c, currency, rateLydPerUsd), 0),
    );
  const spentTotal = total(spent);
  const earnedTotal = total(earned);
  return { spent, earned, spentTotal, earnedTotal, net: roundMoney(earnedTotal - spentTotal) };
}
