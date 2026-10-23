/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account statements (كشف حساب): one per wallet, per currency it holds, and per
 * compartment — a card that has seen cash gets a card statement and a cash
 * statement, because they are two different places the money sits.
 *
 * Every statement reconciles: opening + earnings - deductions = closing, where
 * opening and closing are walletBalance() on either side of the period. The
 * rows are exactly the ones inCompartment() puts in that compartment, so a
 * statement adds up to the same number the wallet card shows.
 */

import type { Expense, Income, Wallet } from '../types.ts';
import {
  inCompartment,
  walletBalance,
  walletCurrencies,
  type Compartment,
  type Currency,
  type WalletBalance,
} from './walletBalance.ts';

export interface StatementRow {
  id: string;
  /** As stored: YYYY-MM-DD or YYYY-MM-DDTHH:mm. */
  date: string;
  title: string;
  /** For the show-details print; the name is resolved against live categories. */
  categoryId: string;
  categoryName: string;
  notes: string;
  /** Money arriving in this compartment (earning) rather than leaving it (deduction). */
  credit: boolean;
  amount: number;
  /** The compartment's balance after this row. */
  balance: number;
  isTransfer: boolean;
  /** "معاملة N" position for the hidden-details print, oldest first; transfers have none. */
  n?: number;
}

export interface Statement {
  wallet: Wallet;
  currency: Currency;
  compartment: Compartment;
  /** When the opening balance stood: YYYY-MM-DD or YYYY-MM-DDTHH:mm, like row dates. */
  openingDate: string;
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  rows: StatementRow[];
}

const day = (d: string) => d.slice(0, 10);

/** A Date as the local YYYY-MM-DDTHH:mm the transaction form stores. */
const localStamp = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/**
 * Statements for one wallet between `from` and `to` (YYYY-MM-DD, inclusive;
 * '' for no limit). A currency or compartment with no rows and nothing in it
 * is left out rather than printed as an empty page.
 */
export function buildStatements(
  wallet: Wallet,
  incomes: Income[],
  expenses: Expense[],
  from: string,
  to: string,
): Statement[] {
  const isCard = wallet.isCard !== false;
  const mine = <T extends { walletId?: string }>(rows: T[]) => rows.filter((r) => r.walletId === wallet.id);
  const myIncomes = mine(incomes);
  const myExpenses = mine(expenses);

  const hasCash =
    myExpenses.some((e) => e.expenseKind === 'cash_withdrawal' || e.expenseKind === 'cash_spend') ||
    myIncomes.some((i) => i.incomeKind === 'cash');
  const compartments: Compartment[] = !isCard ? ['cash'] : hasCash ? ['card', 'cash'] : ['card'];

  // The wallet opened when its opening entry says (the date the user typed when
  // creating it with a top-up), or else when the wallet row was created. With a
  // start date, the opening is simply the balance on that day.
  const openingEntry = myIncomes.filter((i) => i.isOpening).sort((a, b) => a.date.localeCompare(b.date))[0];
  const walletOpened = openingEntry?.date ?? localStamp(wallet.createdAt);

  const inPeriod = (d: string) => (!from || day(d) >= from) && (!to || day(d) <= to);
  const before = (r: { date: string }) => !!from && day(r.date) < from;
  const upTo = (r: { date: string }) => !to || day(r.date) <= to;

  const out: Statement[] = [];
  for (const currency of walletCurrencies(wallet, incomes, expenses)) {
    const pick = (b: WalletBalance, c: Compartment) => (c === 'card' ? b.onCard : b.inCash);
    const atStart = walletBalance(wallet, myIncomes.filter(before), myExpenses.filter(before), currency);
    const atEnd = walletBalance(wallet, myIncomes.filter(upTo), myExpenses.filter(upTo), currency);

    for (const compartment of compartments) {
      const moves = [
        ...myIncomes
          .filter((i) => i.currency === currency && !i.isOpening && inPeriod(i.date))
          .filter((i) => inCompartment(i, 'income', compartment, isCard))
          .map((i) => ({ r: i, credit: true })),
        ...myExpenses
          .filter((e) => e.currency === currency && inPeriod(e.date) && e.amount !== 0)
          // In a cash wallet a withdrawal moves nothing: it leaves and arrives
          // in the same place, so walletBalance nets it to zero.
          .filter((e) => isCard || e.expenseKind !== 'cash_withdrawal')
          .filter((e) => inCompartment(e, 'expense', compartment, isCard))
          .map((e) => ({ r: e, credit: compartment === 'cash' && e.expenseKind === 'cash_withdrawal' })),
      ].sort(
        (a, b) =>
          a.r.date.localeCompare(b.r.date) || a.r.createdAt.getTime() - b.r.createdAt.getTime() || a.r.id.localeCompare(b.r.id),
      );

      const opening = pick(atStart, compartment);
      let balance = opening;
      let totalIn = 0;
      let totalOut = 0;
      let n = 0;
      const rows: StatementRow[] = moves.map(({ r, credit }) => {
        balance += credit ? r.amount : -r.amount;
        if (credit) totalIn += r.amount;
        else totalOut += r.amount;
        const isTransfer = !!r.transferId;
        return {
          id: r.id,
          date: r.date,
          title: r.title,
          categoryId: r.categoryId,
          categoryName: r.categoryName || '',
          notes: r.notes || '',
          credit,
          amount: r.amount,
          balance,
          isTransfer,
          ...(isTransfer ? {} : { n: ++n }),
        };
      });

      const closing = pick(atEnd, compartment);
      if (rows.length === 0 && opening === 0 && closing === 0) continue;
      out.push({ wallet, currency, compartment, openingDate: from || walletOpened, opening, totalIn, totalOut, closing, rows });
    }
  }
  return out;
}
