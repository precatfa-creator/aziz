/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Expense, Income } from '../types';
import { convertAmount, isEarning, roundMoney, type Currency } from './walletBalance';

/**
 * What one expense cost the project. Unlike `isSpending`, a part paid outside
 * the app (gold) counts: it moves no wallet, but it is still money the project
 * consumed. A withdrawal or a transfer only moves money the user still owns.
 */
export const isProjectCost = (e: Expense): boolean =>
  (e.expenseKind ?? 'wallet_spend') !== 'cash_withdrawal' && !e.transferId;

export interface ProjectTotals {
  /** Per currency, as recorded — never converted. */
  spent: Record<Currency, number>;
  earned: Record<Currency, number>;
  /** Everything converted into `currency` at the profile's rate. */
  spentTotal: number;
  earnedTotal: number;
  net: number;
}

export function projectTotals(
  projectId: string,
  incomes: Income[],
  expenses: Expense[],
  currency: Currency,
  rateLydPerUsd: number,
): ProjectTotals {
  const spent: Record<Currency, number> = { LYD: 0, USD: 0 };
  const earned: Record<Currency, number> = { LYD: 0, USD: 0 };
  for (const e of expenses) {
    if (e.projectId === projectId && isProjectCost(e)) spent[e.currency] += e.amount;
  }
  for (const i of incomes) {
    if (i.projectId === projectId && isEarning(i)) earned[i.currency] += i.amount;
  }
  const total = (m: Record<Currency, number>) =>
    roundMoney(
      (Object.keys(m) as Currency[]).reduce((s, c) => s + convertAmount(m[c], c, currency, rateLydPerUsd), 0),
    );
  const spentTotal = total(spent);
  const earnedTotal = total(earned);
  return { spent, earned, spentTotal, earnedTotal, net: roundMoney(earnedTotal - spentTotal) };
}
