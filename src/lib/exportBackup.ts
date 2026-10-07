/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AzizBackup } from './restoreBackup';
import type {
  Category,
  Expense,
  FuturePurchase,
  Income,
  SavingsGroup,
  UserProfile,
  Wallet,
} from '../types';

export interface BackupInput {
  profile: UserProfile | null;
  language: 'ar' | 'en';
  currency: 'LYD' | 'USD';
  exchangeRate: number;
  theme: 'light' | 'dark';
  wallets: Wallet[];
  categories: Category[];
  incomes: Income[];
  expenses: Expense[];
  plannedPurchases: FuturePurchase[];
  savingsGroups: SavingsGroup[];
}

/**
 * Builds the same JSON shape `restoreBackup` reads, so a backup taken here can
 * be loaded straight back in. Deliberately covers exactly the six collections
 * restore supports — notifications, comments and trash are not included,
 * because restore drops them and a backup that silently omits what it claims to
 * carry is worse than one with a stated scope.
 */
export function buildBackup(data: BackupInput): AzizBackup {
  return {
    app: 'aziz',
    version: '1',
    exportedAt: new Date().toISOString(),
    profile: {
      name: data.profile?.name,
      email: data.profile?.email,
      defaultExpenseWalletId: data.profile?.defaultExpenseWalletId,
    },
    preferences: {
      language: data.language,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      theme: data.theme,
    },
    wallets: data.wallets,
    categories: data.categories,
    incomes: data.incomes,
    expenses: data.expenses,
    plannedPurchases: data.plannedPurchases,
    savingsGroups: data.savingsGroups,
  } as AzizBackup;
}

/** Row counts for the confirmation message. */
export function backupCounts(backup: AzizBackup) {
  return {
    wallets: backup.wallets?.length || 0,
    categories: backup.categories?.length || 0,
    incomes: backup.incomes?.length || 0,
    expenses: backup.expenses?.length || 0,
    plannedPurchases: backup.plannedPurchases?.length || 0,
    savingsGroups: backup.savingsGroups?.length || 0,
  };
}

/** Triggers a browser download of the backup as a dated .json file. */
export function downloadBackup(backup: AzizBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `aziz-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
