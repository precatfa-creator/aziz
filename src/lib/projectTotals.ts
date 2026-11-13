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

/** One counted money row of a project, whatever it is stored as. */
export interface ProjectMoney {
  kind: 'expense' | 'income';
  amount: number;
  currency: Currency;
  projectId: string;
  settled: boolean;
  /** YYYY-MM-DD, possibly followed by a time. */
  date: string;
}

/**
 * Every row that counts for `projectIds`: linked costs and earnings plus
 * project-only entries. Withdrawals, transfers and openings never count.
 */
export function projectMoney(
  projectIds: Set<string>,
  incomes: Income[],
  expenses: Expense[],
  projects: Pick<Project, 'id' | 'entries'>[] = [],
): ProjectMoney[] {
  const out: ProjectMoney[] = [];
  for (const e of expenses)
    if (e.projectId && projectIds.has(e.projectId) && isProjectCost(e))
      out.push({ kind: 'expense', amount: e.amount, currency: e.currency, projectId: e.projectId, settled: !!e.projectSettled, date: e.date });
  for (const i of incomes)
    if (i.projectId && projectIds.has(i.projectId) && isEarning(i))
      out.push({ kind: 'income', amount: i.amount, currency: i.currency, projectId: i.projectId, settled: !!i.projectSettled, date: i.date });
  for (const p of projects) {
    if (!projectIds.has(p.id)) continue;
    for (const e of p.entries || [])
      out.push({ kind: e.kind, amount: e.amount, currency: e.currency, projectId: p.id, settled: !!e.settled, date: e.date });
  }
  return out;
}

const convertedTotal = (m: Record<Currency, number>, currency: Currency, rate: number) =>
  roundMoney((Object.keys(m) as Currency[]).reduce((s, c) => s + convertAmount(m[c], c, currency, rate), 0));

/**
 * `projectIds`: one project's own figures, or a whole `projectFamily`.
 * `projects` supplies their project-only entries, which count like linked rows.
 */
export function projectTotals(
  projectIds: Set<string>,
  incomes: Income[],
  expenses: Expense[],
  currency: Currency,
  rateLydPerUsd: number,
  projects: Pick<Project, 'id' | 'entries'>[] = [],
): ProjectTotals {
  const spent: Record<Currency, number> = { LYD: 0, USD: 0 };
  const earned: Record<Currency, number> = { LYD: 0, USD: 0 };
  for (const m of projectMoney(projectIds, incomes, expenses, projects)) (m.kind === 'income' ? earned : spent)[m.currency] += m.amount;
  const spentTotal = convertedTotal(spent, currency, rateLydPerUsd);
  const earnedTotal = convertedTotal(earned, currency, rateLydPerUsd);
  return { spent, earned, spentTotal, earnedTotal, net: roundMoney(earnedTotal - spentTotal) };
}

export interface ShareTotals {
  /** Whether any project in scope is shared; when not, the rest is moot. */
  anyShared: boolean;
  /** The user's part: half of a shared row, all of an unshared one. Converted. */
  mySpent: number;
  myEarned: number;
  myNet: number;
  /** The partner's half of shared rows. Converted. */
  partnerSpent: number;
  partnerEarned: number;
  /** Half of every shared expense not done: the user paid it all. */
  owedToMe: Record<Currency, number>;
  owedToMeTotal: number;
  /** Half of every shared income not done: the user received it all. */
  iOwe: Record<Currency, number>;
  iOweTotal: number;
}

/**
 * Each row is split by its own project's `isShared`, so a shared sub-project
 * under an unshared parent halves only its own rows. The two balances are kept
 * apart: an unpaid income never cancels an unpaid expense.
 */
export function shareTotals(
  projectIds: Set<string>,
  incomes: Income[],
  expenses: Expense[],
  currency: Currency,
  rateLydPerUsd: number,
  projects: Pick<Project, 'id' | 'entries' | 'isShared'>[],
): ShareTotals {
  const shared = new Set(projects.filter((p) => p.isShared && projectIds.has(p.id)).map((p) => p.id));
  const zero = (): Record<Currency, number> => ({ LYD: 0, USD: 0 });
  const mine = { expense: zero(), income: zero() };
  const partner = { expense: zero(), income: zero() };
  const owedToMe = zero();
  const iOwe = zero();
  for (const m of projectMoney(projectIds, incomes, expenses, projects)) {
    if (!shared.has(m.projectId)) {
      mine[m.kind][m.currency] += m.amount;
      continue;
    }
    const half = m.amount / 2;
    mine[m.kind][m.currency] += half;
    partner[m.kind][m.currency] += half;
    if (!m.settled) (m.kind === 'expense' ? owedToMe : iOwe)[m.currency] += half;
  }
  const c = (m: Record<Currency, number>) => convertedTotal(m, currency, rateLydPerUsd);
  const mySpent = c(mine.expense);
  const myEarned = c(mine.income);
  for (const m of [owedToMe, iOwe]) for (const k of Object.keys(m) as Currency[]) m[k] = roundMoney(m[k]);
  return {
    anyShared: shared.size > 0,
    mySpent,
    myEarned,
    myNet: roundMoney(myEarned - mySpent),
    partnerSpent: c(partner.expense),
    partnerEarned: c(partner.income),
    owedToMe,
    owedToMeTotal: c(owedToMe),
    iOwe,
    iOweTotal: c(iOwe),
  };
}

export interface NetPoint {
  date: string; // YYYY-MM-DD
  /** Running earned − spent, converted. */
  net: number;
  /** The same for the user's part only (half of shared rows). */
  mine: number;
}

/** The project's running net position, one point per day with money. */
export function netSeries(
  projectIds: Set<string>,
  incomes: Income[],
  expenses: Expense[],
  currency: Currency,
  rateLydPerUsd: number,
  projects: Pick<Project, 'id' | 'entries' | 'isShared'>[],
): NetPoint[] {
  const shared = new Set(projects.filter((p) => p.isShared).map((p) => p.id));
  const byDay = new Map<string, { net: number; mine: number }>();
  for (const m of projectMoney(projectIds, incomes, expenses, projects)) {
    const v = convertAmount(m.amount, m.currency, currency, rateLydPerUsd) * (m.kind === 'income' ? 1 : -1);
    const day = m.date.slice(0, 10);
    const d = byDay.get(day) || { net: 0, mine: 0 };
    d.net += v;
    d.mine += shared.has(m.projectId) ? v / 2 : v;
    byDay.set(day, d);
  }
  let net = 0;
  let mine = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, net: roundMoney((net += d.net)), mine: roundMoney((mine += d.mine)) }));
}

export type Range = '1M' | '3M' | '1Y' | 'ALL';
export const RANGE_DAYS: Record<Range, number> = { '1M': 30, '3M': 91, '1Y': 365, ALL: 0 };

/**
 * The points inside `range`, led by the position just before it (zero for the
 * whole history) and carried flat to `today`, so any project with money draws
 * a line even when nothing moved inside the range.
 */
export function inRange(series: NetPoint[], range: Range, today = new Date().toISOString().slice(0, 10)): NetPoint[] {
  if (!series.length) return [];
  const days = RANGE_DAYS[range];
  const cutoff = days ? new Date(Date.parse(today) - days * 864e5).toISOString().slice(0, 10) : '';
  const before = series.filter((p) => p.date < cutoff).at(-1);
  const out = [
    before ? { ...before, date: cutoff } : { date: cutoff || series[0].date, net: 0, mine: 0 },
    ...series.filter((p) => p.date >= cutoff),
  ];
  const last = out[out.length - 1];
  if (last.date < today) out.push({ ...last, date: today });
  return out;
}
