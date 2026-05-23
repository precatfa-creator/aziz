/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  preferredLanguage: 'ar' | 'en';
  preferredCurrency: 'LYD' | 'USD';
  exchangeRateUSD_LYD: number; // custom conversion rate (e.g. 1 USD = 6.15 LYD)
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  userId: string; // "system" means preloaded, otherwise user uid
  name: string; // Format "Arabic Name / English Name"
  type: 'income' | 'expense' | 'purchase';
  color: string; // Tailwind color name (e.g. "emerald", "red", "indigo")
  icon: string; // Lucide icon name
  isArchived: boolean;
  parentId?: string | null;
  createdAt: Date;
}

export interface Income {
  id: string;
  userId: string;
  amount: number;
  currency: 'LYD' | 'USD';
  title: string;
  date: string; // YYYY-MM-DD
  categoryId: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrl?: string;
  priority?: 'low' | 'medium' | 'high';
  walletId?: string;
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  currency: 'LYD' | 'USD';
  title: string;
  date: string; // YYYY-MM-DD
  categoryId: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrl?: string;
  priority?: 'low' | 'medium' | 'high';
  walletId?: string;
}

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  initialBalance: number;
  currency: 'LYD' | 'USD';
  color: string;
  icon: string;
  isHidden?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FuturePurchase {
  id: string;
  userId: string;
  itemName: string;
  expectedPrice: number;
  currency: 'LYD' | 'USD';
  expectedDate?: string; // YYYY-MM-DD (optional)
  priority: 'low' | 'medium' | 'high';
  categoryId?: string;
  notes?: string;
  isPurchased: boolean;
  matchedExpenseId?: string; // linkage to actual expense when converted
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsGroupMember {
  id: string; // e.g., member index or custom id
  name: string;
  phone?: string;
  notes?: string;
  isReceived: boolean;
  receiveCycleIndex: number; // 0-indexed order (0 = first mouth, 1 = second, etc.)
  paidCycles: number[]; // track indexes of cycles/rounds paid
}

export interface SavingsGroupPayment {
  cycleIndex: number; // cycle/month sequence (e.g. Month 1, Month 2)
  memberId: string;
  amountPaid: number;
  paymentDate: string; // YYYY-MM-DD
  isLate: boolean;
}

export interface SavingsGroup {
  id: string;
  userId: string;
  name: string;
  currency: 'LYD' | 'USD';
  totalAmount: number;
  numMembers: number;
  paymentPerMember: number;
  paymentCycle: 'monthly' | 'weekly' | 'custom';
  startDate: string; // YYYY-MM-DD
  members: SavingsGroupMember[]; // List of Jamiya members
  receivingOrder: string[]; // member IDs in order of collection
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  // History is derived or kept as subfields
}

export interface JamiyaNotification {
  id: string;
  userId: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  type: 'general' | 'saving_group' | 'purchase' | 'budget';
  date: Date;
  isRead: boolean;
  createdAt: Date;
}

export interface TransactionComment {
  id: string;
  userId: string;
  transactionId: string;
  transactionType: 'income' | 'expense';
  userName: string;
  userEmail: string;
  text: string;
  createdAt: Date;
}

