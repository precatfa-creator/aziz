/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One wallet, two compartments, and now more than one currency.
 *
 * A prepaid card wallet measures how much came off the card, but the money that
 * comes off it does not always disappear — withdrawing the remaining balance as
 * physical cash keeps it, in a different form. `expenseKind` on each expense row
 * says which of the three things happened.
 *
 * Exchanging part of that balance for another currency keeps it too. Every
 * expense and income row already carries its own `currency`, so a wallet holding
 * 88 LYD and 100 USD needs no new storage — only the willingness to read its
 * rows one currency at a time. `wallet.currency` therefore no longer means "the
 * only currency this wallet can hold"; it means the primary one, the currency
 * `initialBalance` is denominated in. Rows in any other currency contribute to
 * that currency's balance and to nothing else.
 *
 * Balance used to be computed inline in Dashboard, WalletManager and
 * TransactionManager, three times, slightly differently. It lives here now
 * because the compartments mean different screens want *different* numbers out
 * of it (net worth wants `total`, the wallet card wants `onCard` and `inCash`
 * side by side), and a single number cannot serve both.
 */

import type { Expense, Income, Wallet } from '../types.ts';

export type Currency = 'LYD' | 'USD';

/** Every currency the app knows. A wallet may hold any subset of these. */
export const CURRENCIES: Currency[] = ['LYD', 'USD'];

/** Null means `wallet_spend`: every row written before the compartments existed. */
export type ExpenseKind = 'wallet_spend' | 'cash_withdrawal' | 'cash_spend';

export interface WalletBalance {
  /** Which currency these numbers are denominated in. */
  currency: Currency;
  /** Money still on the instrument itself. */
  onCard: number;
  /** Withdrawn as cash and not yet spent. */
  inCash: number;
  /** What the wallet is actually worth in this currency: `onCard + inCash`. */
  total: number;
  /** How much has come off the card in total — spending, withdrawals, transfers out. */
  cardConsumption: number;
  /** Money genuinely gone. Withdrawals move it, transfers move it; neither spends it. */
  actualSpending: number;
  /** Money genuinely earned. Opening rows and transfers in are not earnings. */
  totalIncomes: number;
  /** Arrived from another wallet or another currency of this one. */
  transferIn: number;
  /** Left for another wallet or another currency of this one. */
  transferOut: number;
  /** Real earnings minus real spending: `totalIncomes - actualSpending`. */
  diff: number;
}

const kindOf = (e: Expense): ExpenseKind => e.expenseKind ?? 'wallet_spend';

/** The two compartments of a wallet, as the history filter names them. */
export type Compartment = 'card' | 'cash';

/**
 * Whether a ledger row moves money in this compartment — the rows whose sum
 * reconciles to `onCard` or `inCash`. Incomes always land on the card. A
 * withdrawal is in both: it leaves the card and arrives as cash, so dropping it
 * from either list would leave that list unable to add up to its balance.
 */
export const inCompartment = (
  tx: { expenseKind?: ExpenseKind },
  type: 'income' | 'expense',
  compartment: Compartment,
): boolean => {
  if (type === 'income') return compartment === 'card';
  const kind = tx.expenseKind ?? 'wallet_spend';
  if (kind === 'cash_withdrawal') return true;
  return compartment === 'cash' ? kind === 'cash_spend' : kind === 'wallet_spend';
};

/**
 * A withdrawal moves money between one wallet's own compartments and a transfer
 * moves it between wallets or currencies. Neither is spending, so neither
 * belongs in a spending total, a spending chart, or an overspending alert.
 */
export const isSpending = (e: Expense): boolean =>
  kindOf(e) !== 'cash_withdrawal' && !e.transferId;

/**
 * The income mirror of `isSpending`. An opening row restates a balance rather
 * than adding to it, and the receiving half of a transfer is money that was
 * already owned a moment earlier under a different name.
 */
export const isEarning = (i: Income): boolean => !i.isOpening && !i.transferId;

export function walletBalance(
  wallet: Wallet,
  incomes: Income[],
  expenses: Expense[],
  currency: Currency = wallet.currency,
): WalletBalance {
  // A row belongs to this calculation only if it sits in this wallet and is
  // denominated in the currency being asked about. `initialBalance` is stated in
  // the wallet's primary currency, so it opens that bucket and no other.
  const mine = (r: { walletId?: string; currency: string }) =>
    r.walletId === wallet.id && r.currency === currency;
  const opening = currency === wallet.currency ? wallet.initialBalance : 0;

  let earned = 0;
  let transferIn = 0;
  for (const i of incomes) {
    if (!mine(i) || i.isOpening) continue;
    if (i.transferId) transferIn += i.amount;
    else earned += i.amount;
  }

  let spend = 0;
  let drawn = 0;
  let cashSpend = 0;
  let outCard = 0;
  let outCash = 0;
  for (const e of expenses) {
    if (!mine(e)) continue;
    const kind = kindOf(e);
    // A transfer still leaves the compartment `expenseKind` names — it just
    // leaves as a movement rather than as spending, so it needs its own
    // accumulator. Folding it into `spend` would reduce the balance correctly
    // and inflate `actualSpending` while doing it.
    if (kind === 'cash_withdrawal') drawn += e.amount;
    else if (kind === 'cash_spend') e.transferId ? (outCash += e.amount) : (cashSpend += e.amount);
    else e.transferId ? (outCard += e.amount) : (spend += e.amount);
  }

  // Deliberately unclamped: onCard + inCash then equals
  // opening + incomes - everything that left, exactly, whatever the rows say. A
  // negative compartment means rows are mis-tagged (cash spent that was never
  // withdrawn), and showing that is more use than hiding it behind a max(0, …)
  // that would silently break the identity.
  const onCard = opening + earned + transferIn - spend - drawn - outCard;
  const inCash = drawn - cashSpend - outCash;
  const actualSpending = spend + cashSpend;

  return {
    currency,
    onCard,
    inCash,
    total: onCard + inCash,
    cardConsumption: spend + drawn + outCard,
    actualSpending,
    totalIncomes: earned,
    transferIn,
    transferOut: outCard + outCash,
    // Movements are excluded from both sides: exchanging 912 LYD for 100 USD
    // neither earned nor spent anything, so it must not move net flow at all.
    diff: earned - actualSpending,
  };
}

/**
 * Converts between the two currencies at a stated rate.
 *
 * `rateLydPerUsd` is the rate as the settings screen states it — how many LYD
 * one USD costs — because that is the number the user maintains and the only
 * one they can sanity-check against a real exchange.
 */
export const convertAmount = (
  amount: number,
  from: Currency,
  to: Currency,
  rateLydPerUsd: number,
): number =>
  from === to ? amount : from === 'USD' ? amount * rateLydPerUsd : amount / rateLydPerUsd;

/**
 * Rounds to the cent, and it is load-bearing rather than cosmetic.
 *
 * 912 / 9.12 is 100.00000000000001 in binary floating point. Storing that as an
 * exchange's receiving leg would make the wallet hold an amount no one can type,
 * print as 100.00 while comparing unequal to 100, and derive a rate of
 * 9.119999999999999 back out of the pair. The stored legs are rounded so the
 * rate stays reproducible from them.
 */
export const roundMoney = (amount: number): number => Math.round(amount * 100) / 100;

/**
 * Which currencies this wallet actually holds or has moved, primary first.
 *
 * Drives progressive disclosure — a wallet that has never seen a second
 * currency should not grow a second row, a currency picker, or an empty bucket
 * on its card just because the app supports one.
 */
export function walletCurrencies(
  wallet: Wallet,
  incomes: Income[],
  expenses: Expense[],
): Currency[] {
  const active = CURRENCIES.filter((c) => {
    if (c === wallet.currency) return true;
    const touches = (r: { walletId?: string; currency: string }) =>
      r.walletId === wallet.id && r.currency === c;
    return incomes.some(touches) || expenses.some(touches);
  });
  // Primary first so every list, picker and card leads with the same currency.
  return active.sort((a, b) => (a === wallet.currency ? -1 : b === wallet.currency ? 1 : 0));
}

/** Every active currency's balance in one call, primary first. */
export function walletTotals(
  wallet: Wallet,
  incomes: Income[],
  expenses: Expense[],
): WalletBalance[] {
  return walletCurrencies(wallet, incomes, expenses).map((c) =>
    walletBalance(wallet, incomes, expenses, c),
  );
}
