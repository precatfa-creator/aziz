/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import {
  UserProfile,
  Category,
  Income,
  Expense,
  FuturePurchase,
  SavingsGroup,
  SavingsGroupMember,
  JamiyaNotification,
  Wallet,
  TransactionComment,
  TrashItem,
} from "../types";
import type { ExpenseKind } from "../lib/walletBalance";
import { translations } from "../translations";

function logSupabaseError(error: unknown, context: string) {
  console.error(`Supabase error [${context}]:`, error);
}

// ---------------------------------------------------------------------------
// Row -> app-type mappers. Postgres snake_case -> the camelCase shapes the
// rest of the app already expects (unchanged from the Firestore version).
// ---------------------------------------------------------------------------

function mapProfile(row: any): UserProfile {
  return {
    uid: row.id,
    name: row.name,
    email: row.email,
    preferredLanguage: row.preferred_language,
    preferredCurrency: row.preferred_currency,
    exchangeRateUSD_LYD: Number(row.exchange_rate_usd_lyd),
    defaultExpenseWalletId: row.default_expense_wallet_id || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapCategory(row: any): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    color: row.color,
    icon: row.icon,
    isArchived: !!row.is_archived,
    parentId: row.parent_id || null,
    createdAt: new Date(row.created_at),
  };
}

function mapIncome(row: any): Income {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    currency: row.currency,
    title: row.title,
    date: row.date,
    categoryId: row.category_id,
    notes: row.notes || "",
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    walletId: row.wallet_id || "",
    priority: row.priority || "medium",
    imageUrl: row.image_url || "",
    isHistorical: !!row.is_historical,
    categoryName: row.category_name || "",
    isOpening: !!row.is_opening,
    transferId: row.transfer_id || undefined,
    hiddenFromViewers: !!row.hidden_from_viewers,
  };
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    userId: row.user_id,
    amount: row.is_refunded ? 0 : Number(row.amount),
    originalAmount:
      row.original_amount !== null && row.original_amount !== undefined
        ? Number(row.original_amount)
        : Number(row.amount),
    isRefunded: !!row.is_refunded,
    refundedAt: row.refunded_at || undefined,
    isDue: !!row.is_due,
    currency: row.currency,
    title: row.title,
    date: row.date,
    categoryId: row.category_id,
    notes: row.notes || "",
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    walletId: row.wallet_id || "",
    priority: row.priority || "medium",
    imageUrl: row.image_url || "",
    isHistorical: !!row.is_historical,
    categoryName: row.category_name || "",
    expenseKind: row.expense_kind || undefined,
    transferId: row.transfer_id || undefined,
    hiddenFromViewers: !!row.hidden_from_viewers,
  };
}

function mapFuturePurchase(row: any): FuturePurchase {
  return {
    id: row.id,
    userId: row.user_id,
    itemName: row.item_name,
    expectedPrice: Number(row.expected_price),
    currency: row.currency,
    expectedDate: row.expected_date || "",
    priority: row.priority,
    categoryId: row.category_id || "",
    notes: row.notes || "",
    isPurchased: !!row.is_purchased,
    matchedExpenseId: row.matched_expense_id || "",
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapSavingsGroup(row: any): SavingsGroup {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    currency: row.currency,
    totalAmount: Number(row.total_amount),
    numMembers: Number(row.num_members),
    paymentPerMember: Number(row.payment_per_member),
    paymentCycle: row.payment_cycle,
    startDate: row.start_date,
    members: (row.members || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      phone: m.phone || "",
      notes: m.notes || "",
      isReceived: !!m.isReceived,
      receiveCycleIndex: Number(m.receiveCycleIndex ?? -1),
      paidCycles: m.paidCycles || [],
    })),
    receivingOrder: row.receiving_order || [],
    isArchived: !!row.is_archived,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapNotification(row: any): JamiyaNotification {
  return {
    id: row.id,
    userId: row.user_id,
    titleAr: row.title_ar,
    titleEn: row.title_en,
    messageAr: row.message_ar,
    messageEn: row.message_en,
    type: row.type,
    date: new Date(row.date),
    isRead: !!row.is_read,
    createdAt: new Date(row.created_at),
  };
}

function mapWallet(row: any): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    initialBalance: Number(row.initial_balance),
    currency: row.currency,
    color: row.color || "slate",
    icon: row.icon || "Wallet",
    isHidden: row.is_hidden,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapComment(row: any): TransactionComment {
  return {
    id: row.id,
    userId: row.user_id,
    transactionId: row.transaction_id,
    transactionType: row.transaction_type,
    userName: row.user_name || "",
    userEmail: row.user_email || "",
    text: row.text || "",
    createdAt: new Date(row.created_at),
  };
}

function mapTrash(row: any): TrashItem {
  return {
    id: row.id,
    userId: row.user_id,
    deletedAt: new Date(row.deleted_at),
    deletedBy: row.deleted_by || "",
    originalId: row.original_id,
    originalType: row.original_type,
    originalData: row.original_data,
  };
}

type RealtimeTable =
  | "profiles"
  | "categories"
  | "incomes"
  | "expenses"
  | "future_purchases"
  | "savings_groups"
  | "notifications"
  | "wallets"
  | "comments"
  | "trash";

const REALTIME_TABLES: RealtimeTable[] = [
  "profiles",
  "categories",
  "incomes",
  "expenses",
  "future_purchases",
  "savings_groups",
  "notifications",
  "wallets",
  "comments",
  "trash",
];

function getBroadcastTable(message: unknown): RealtimeTable | null {
  const value = message as {
    table?: unknown;
    payload?: {
      table?: unknown;
      payload?: { table?: unknown };
    };
  };
  const table =
    value?.payload?.table ??
    value?.payload?.payload?.table ??
    value?.table;

  return typeof table === "string" &&
    REALTIME_TABLES.includes(table as RealtimeTable)
    ? (table as RealtimeTable)
    : null;
}

/**
 * One movement of money, written as two rows.
 *
 * A same-currency wallet-to-wallet transfer and a currency exchange are the
 * same operation — the exchange simply has a rate other than 1, and an exchange
 * inside a single wallet has `fromWalletId === toWalletId`. Naming them
 * separately would mean two code paths that must stay in sync forever.
 */
export interface TransferInput {
  fromWalletId: string;
  toWalletId: string;
  fromAmount: number;
  fromCurrency: "LYD" | "USD";
  toAmount: number;
  toCurrency: "LYD" | "USD";
  /** YYYY-MM-DD, or the YYYY-MM-DDTHH:mm the wallet transfer form produces. */
  date: string;
  titleOut: string;
  titleIn: string;
  categoryId?: string;
  notes?: string;
  imageUrl?: string;
  /** Which compartment of the source wallet the money leaves. */
  fromKind?: ExpenseKind;
}

interface AppContextProps {
  user: SupabaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  language: "ar" | "en";
  currency: "LYD" | "USD";
  exchangeRate: number; // 1 USD = X LYD
  theme: "light" | "dark";
  categories: Category[];
  incomes: Income[];
  expenses: Expense[];
  plannedPurchases: FuturePurchase[];
  savingsGroups: SavingsGroup[];
  notifications: JamiyaNotification[];
  wallets: Wallet[];
  comments: TransactionComment[];
  trashItems: TrashItem[];

  // Translation Helper
  t: typeof translations.en;

  // Comment Functions
  addComment: (
    transactionId: string,
    transactionType: "income" | "expense",
    text: string,
  ) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;

  // Auth Functions
  loginWithPassword: (email: string, password: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  logout: () => Promise<void>;

  // Preferences Update
  updatePreferences: (
    lang: "ar" | "en",
    curr: "LYD" | "USD",
    rate: number,
  ) => Promise<void>;
  setDefaultExpenseWallet: (walletId: string) => Promise<void>;
  toggleTheme: () => void;

  // Category CRU
  addCategory: (
    name: string,
    type: "income" | "expense" | "purchase",
    color: string,
    icon: string,
    parentId?: string | null,
  ) => Promise<string>;
  archiveCategory: (id: string, isArchived: boolean) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Income CRUD
  addIncome: (
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
    isHistorical?: boolean,
    categoryName?: string,
    isOpening?: boolean,
  ) => Promise<void>;
  updateIncome: (
    id: string,
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
  ) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;

  // Expense CRUD
  addExpense: (
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
    isHistorical?: boolean,
    categoryName?: string,
    expenseKind?: ExpenseKind,
  ) => Promise<string>;
  updateExpense: (
    id: string,
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
    expenseKind?: ExpenseKind,
  ) => Promise<void>;
  addTransfer: (t: TransferInput) => Promise<void>;
  toggleExpenseRefund: (id: string, isRefunded: boolean) => Promise<void>;
  toggleExpenseDue: (id: string, isDue: boolean) => Promise<void>;
  recoverDue: (id: string, paidAmount: number) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Wallet CRUD
  addWallet: (
    name: string,
    initialBalance: number,
    currency: "LYD" | "USD",
    color: string,
    icon: string,
  ) => Promise<string>;
  updateWallet: (
    id: string,
    name: string,
    initialBalance: number,
    currency: "LYD" | "USD",
    color: string,
    icon: string,
    isHidden?: boolean,
  ) => Promise<void>;
  deleteWallet: (id: string) => Promise<void>;

  // Future Purchase CRU
  addFuturePurchase: (
    itemName: string,
    expectedPrice: number,
    currency: "LYD" | "USD",
    expectedDate?: string,
    priority?: "low" | "medium" | "high",
    categoryId?: string,
    notes?: string,
  ) => Promise<void>;
  updateFuturePurchase: (
    id: string,
    itemName: string,
    expectedPrice: number,
    currency: "LYD" | "USD",
    expectedDate?: string,
    priority?: "low" | "medium" | "high",
    categoryId?: string,
    notes?: string,
  ) => Promise<void>;
  purchaseWishlistItemChange: (
    id: string,
    isPurchased: boolean,
  ) => Promise<void>;
  convertPurchaseToExpense: (
    purchaseId: string,
    actualPrice: number,
    actualDate: string,
    categoryId: string,
    notes?: string,
  ) => Promise<void>;
  deleteFuturePurchase: (id: string) => Promise<void>;

  // Savings Group CRU
  addSavingsGroup: (
    name: string,
    currency: "LYD" | "USD",
    totalAmount: number,
    numMembers: number,
    paymentCycle: "monthly" | "weekly" | "custom",
    startDate: string,
    members: Omit<
      SavingsGroupMember,
      "isReceived" | "receiveCycleIndex" | "paidCycles"
    >[],
    receivingOrder: string[],
  ) => Promise<void>;
  updateSavingsGroup: (
    id: string,
    name: string,
    currency: "LYD" | "USD",
    totalAmount: number,
    numMembers: number,
    paymentCycle: "monthly" | "weekly" | "custom",
    startDate: string,
    updatedMembers: SavingsGroupMember[],
    receivingOrder: string[],
    isArchived: boolean,
  ) => Promise<void>;
  toggleMemberPaidCycle: (
    groupId: string,
    memberId: string,
    cycleIndex: number,
  ) => Promise<void>;
  toggleMemberReceivedState: (
    groupId: string,
    memberId: string,
    isReceived: boolean,
    cycleIndex: number,
  ) => Promise<void>;
  archiveSavingsGroup: (id: string, isArchived: boolean) => Promise<void>;
  deleteSavingsGroup: (id: string) => Promise<void>;

  // Notification Management
  addNotificationArEn: (
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    type: "general" | "saving_group" | "purchase" | "budget",
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;

  setLanguage: (lang: "ar" | "en") => void;
  setCurrency: (curr: "LYD" | "USD") => void;
  setExchangeRate: (rate: number) => void;
  updateProfile: (data: { name: string }) => Promise<void>;
  updateCategory: (
    id: string,
    name: string,
    type: "income" | "expense" | "purchase",
    color: string,
    icon: string,
    isArchived: boolean,
    parentId?: string | null,
  ) => Promise<void>;
  hideHistoricalData: boolean;
  setHideHistoricalData: (val: boolean) => void;

  // Trash Operations
  restoreTrashItem: (id: string) => Promise<void>;
  permanentlyDeleteTrashItem: (id: string) => Promise<void>;
  cleanupExpiredTrashItems: () => Promise<void>;

  // Custom Wallet Filter crossing views
  selectedWalletFilter: string;
  setSelectedWalletFilter: (val: string) => void;
  selectedCompartmentFilter: "" | "card" | "cash";
  setSelectedCompartmentFilter: (val: "" | "card" | "cash") => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // SIGNED_IN is also emitted when Supabase re-confirms the existing session
  // after a hidden tab becomes visible (for example, after using the camera).
  // Keep the active id outside React state so the auth callback can distinguish
  // that refocus event from a genuine account change without a stale closure.
  const activeUserIdRef = React.useRef<string | null>(null);

  // App Config Settings (Default Fallbacks)
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [currency, setCurrency] = useState<"LYD" | "USD">("LYD");
  const [exchangeRate, setExchangeRate] = useState<number>(6.15); // Default Libya-friendly standard (1 USD = 6.15 Lyd)
  // Initialised from localStorage so the first sync effect agrees with the
  // pre-paint script in index.html — otherwise dark users get a light flash.
  // Without a saved choice, follow the OS, as the pre-paint script does.
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("aziz_theme");
      if (saved === "light" || saved === "dark") return saved;
      return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  // Database lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [plannedPurchases, setPlannedPurchases] = useState<FuturePurchase[]>(
    [],
  );
  const [savingsGroups, setSavingsGroups] = useState<SavingsGroup[]>([]);
  const [notifications, setNotifications] = useState<JamiyaNotification[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [comments, setComments] = useState<TransactionComment[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string>("");
  const [selectedCompartmentFilter, setSelectedCompartmentFilter] = useState<"" | "card" | "cash">("");

  // Select literal translation matching current language state
  const t = translations[language];

  // Set visual HTML orientation root dir appropriately
  useEffect(() => {
    const dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  // Sync mode with HTML class
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("aziz_theme", nextTheme);
  };

  const [hideHistoricalData, setHideHistoricalDataState] = useState<boolean>(false);

  useEffect(() => {
    const savedHide = localStorage.getItem("aziz_hide_historical") === "true";
    setHideHistoricalDataState(savedHide);
  }, []);

  const setHideHistoricalData = (val: boolean) => {
    setHideHistoricalDataState(val);
    localStorage.setItem("aziz_hide_historical", val ? "true" : "false");
  };

  // Fetch every table for initial hydration and realtime reconnect recovery.
  // Sort orders mirror the old onSnapshot listeners.
  const fetchAllData = async () => {
    const [
      categoriesRes,
      incomesRes,
      expensesRes,
      purchasesRes,
      groupsRes,
      notifyRes,
      walletsRes,
      commentsRes,
      trashRes,
    ] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("incomes").select("*"),
      supabase.from("expenses").select("*"),
      supabase.from("future_purchases").select("*"),
      supabase.from("savings_groups").select("*"),
      supabase.from("notifications").select("*"),
      supabase.from("wallets").select("*"),
      supabase.from("comments").select("*"),
      supabase.from("trash").select("*"),
    ]);

    if (categoriesRes.error) logSupabaseError(categoriesRes.error, "categories/list");
    else setCategories((categoriesRes.data || []).map(mapCategory));

    if (incomesRes.error) logSupabaseError(incomesRes.error, "incomes/list");
    else setIncomes((incomesRes.data || []).map(mapIncome).sort((x, y) => y.date.localeCompare(x.date)));

    if (expensesRes.error) logSupabaseError(expensesRes.error, "expenses/list");
    else setExpenses((expensesRes.data || []).map(mapExpense).sort((x, y) => y.date.localeCompare(x.date)));

    if (purchasesRes.error) logSupabaseError(purchasesRes.error, "future_purchases/list");
    else setPlannedPurchases((purchasesRes.data || []).map(mapFuturePurchase));

    if (groupsRes.error) logSupabaseError(groupsRes.error, "savings_groups/list");
    else setSavingsGroups((groupsRes.data || []).map(mapSavingsGroup));

    if (notifyRes.error) logSupabaseError(notifyRes.error, "notifications/list");
    else
      setNotifications(
        (notifyRes.data || [])
          .map(mapNotification)
          .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()),
      );

    if (walletsRes.error) logSupabaseError(walletsRes.error, "wallets/list");
    else setWallets((walletsRes.data || []).map(mapWallet));

    if (commentsRes.error) logSupabaseError(commentsRes.error, "comments/list");
    else
      setComments(
        (commentsRes.data || [])
          .map(mapComment)
          .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()),
      );

    if (trashRes.error) logSupabaseError(trashRes.error, "trash/list");
    else
      setTrashItems(
        (trashRes.data || [])
          .map(mapTrash)
          .sort((x, y) => y.deletedAt.getTime() - x.deletedAt.getTime()),
      );
  };

  const refetchOne = async <T,>(
    table: string,
    mapper: (row: any) => T,
    setter: (items: T[]) => void,
    sort?: (a: T, b: T) => number,
  ) => {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      logSupabaseError(error, `${table}/refetch`);
      return;
    }
    const items = (data || []).map(mapper);
    setter(sort ? items.sort(sort) : items);
  };

  const refreshRealtimeTable = async (
    table: RealtimeTable,
    uid: string,
  ) => {
    const ownerColumn = table === "profiles" ? "id" : "user_id";
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(ownerColumn, uid);

    if (error) {
      logSupabaseError(error, `${table}/realtime-refetch`);
      return;
    }
    // A response started for the previous account must never land after logout
    // or an account switch.
    if (activeUserIdRef.current !== uid) return;

    const rows = data || [];
    switch (table) {
      case "profiles": {
        if (!rows[0]) return;
        const loadedProfile = mapProfile(rows[0]);
        setProfile(loadedProfile);
        setLanguage(loadedProfile.preferredLanguage);
        setCurrency(loadedProfile.preferredCurrency);
        setExchangeRate(loadedProfile.exchangeRateUSD_LYD);
        break;
      }
      case "categories":
        setCategories(rows.map(mapCategory));
        break;
      case "incomes":
        setIncomes(
          rows.map(mapIncome).sort((x, y) => y.date.localeCompare(x.date)),
        );
        break;
      case "expenses":
        setExpenses(
          rows.map(mapExpense).sort((x, y) => y.date.localeCompare(x.date)),
        );
        break;
      case "future_purchases":
        setPlannedPurchases(rows.map(mapFuturePurchase));
        break;
      case "savings_groups":
        setSavingsGroups(rows.map(mapSavingsGroup));
        break;
      case "notifications":
        setNotifications(
          rows
            .map(mapNotification)
            .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()),
        );
        break;
      case "wallets":
        setWallets(rows.map(mapWallet));
        break;
      case "comments":
        setComments(
          rows
            .map(mapComment)
            .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()),
        );
        break;
      case "trash":
        setTrashItems(
          rows
            .map(mapTrash)
            .sort((x, y) => y.deletedAt.getTime() - x.deletedAt.getTime()),
        );
        break;
    }
  };

  const loadProfileAndData = async (uid: string) => {
    // Profile and table data are independent — fire both together so the
    // loading screen costs one round trip instead of two.
    const [{ data, error }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      fetchAllData(),
    ]);
    if (error) {
      logSupabaseError(error, "profiles/get");
    } else if (data) {
      const loadedProfile = mapProfile(data);
      setProfile(loadedProfile);
      setLanguage(loadedProfile.preferredLanguage);
      setCurrency(loadedProfile.preferredCurrency);
      setExchangeRate(loadedProfile.exchangeRateUSD_LYD);
    }
  };

  const clearAllData = () => {
    setProfile(null);
    setCategories([]);
    setIncomes([]);
    setExpenses([]);
    setPlannedPurchases([]);
    setSavingsGroups([]);
    setNotifications([]);
    setWallets([]);
    setComments([]);
    setTrashItems([]);
  };

  // Auth bootstrap + subscription
  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!active) return;
        if (session?.user) {
          activeUserIdRef.current = session.user.id;
          setUser(session.user);
          await loadProfileAndData(session.user.id);
        }
      })
      // A throw anywhere above used to leave the loader spinning forever.
      .catch((err) => console.error("Auth bootstrap failed:", err))
      .finally(() => setLoading(false));

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          // App swaps a viewer over to ViewerPortal; there is no owner data to load.
          if (session.user.app_metadata?.role === "viewer") return;
          const userChanged = activeUserIdRef.current !== session.user.id;
          activeUserIdRef.current = session.user.id;
          // Keep refreshed auth metadata, but do not show the global loader or
          // remount the app when the same session is merely re-confirmed.
          setUser(session.user);
          if (!userChanged) return;

          setLoading(true);
          void loadProfileAndData(session.user.id)
            .catch((err) => console.error("Auth sign-in hydration failed:", err))
            .finally(() => {
              if (active && activeUserIdRef.current === session.user.id) {
                setLoading(false);
              }
            });
        } else if (event === "SIGNED_OUT") {
          activeUserIdRef.current = null;
          setLoading(false);
          setUser(null);
          clearAllData();
        }
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Subscribe every signed-in device to one private, per-account topic.
  // Each event refetches only its affected table; reconnecting refetches all
  // tables so changes made while the device was offline are also reconciled.
  useEffect(() => {
    if (!user) return;

    const uid = user.id;
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const refreshTimers = new Map<
      RealtimeTable,
      ReturnType<typeof setTimeout>
    >();

    const scheduleRefresh = (table: RealtimeTable) => {
      const existingTimer = refreshTimers.get(table);
      if (existingTimer) clearTimeout(existingTimer);

      const timer = setTimeout(() => {
        refreshTimers.delete(table);
        if (!disposed && activeUserIdRef.current === uid) {
          void refreshRealtimeTable(table, uid);
        }
      }, 120);
      refreshTimers.set(table, timer);
    };

    const scheduleAllRefreshes = () => {
      REALTIME_TABLES.forEach(scheduleRefresh);
    };

    const handleDatabaseChange = (message: unknown) => {
      const table = getBroadcastTable(message);
      if (table) scheduleRefresh(table);
      else scheduleAllRefreshes();
    };

    void (async () => {
      try {
        // With no explicit token argument, supabase-js continues using its auth
        // callback and automatically supplies refreshed JWTs to Realtime.
        await supabase.realtime.setAuth();
        if (disposed || activeUserIdRef.current !== uid) return;

        channel = supabase
          .channel(`aziz:user:${uid}`, { config: { private: true } })
          .on("broadcast", { event: "INSERT" }, handleDatabaseChange)
          .on("broadcast", { event: "UPDATE" }, handleDatabaseChange)
          .on("broadcast", { event: "DELETE" }, handleDatabaseChange)
          .subscribe((status, error) => {
            if (status === "SUBSCRIBED") {
              scheduleAllRefreshes();
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT"
            ) {
              console.error(`Realtime ${status}:`, error);
            }
          });
      } catch (error) {
        console.error("Realtime setup failed:", error);
      }
    })();

    return () => {
      disposed = true;
      refreshTimers.forEach(clearTimeout);
      refreshTimers.clear();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Auth Operations
  const loginWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  // WebAuthn passkey ("finger touch") sign-in — requires Passkeys enabled on
  // the Supabase project (Dashboard -> Authentication -> Passkeys). Throws
  // Supabase's own descriptive error otherwise, surfaced to the caller as-is.
  const loginWithPasskey = async () => {
    const { error } = await supabase.auth.signInWithPasskey();
    if (error) throw error;
  };

  // Registers a passkey for the current device against the already-signed-in
  // user (password login happens first, then the user opts into fingerprint
  // unlock for that device).
  const registerPasskey = async () => {
    const { error } = await supabase.auth.registerPasskey();
    if (error) throw error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Preference Updates
  const updatePreferences = async (
    lang: "ar" | "en",
    curr: "LYD" | "USD",
    rate: number,
  ) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          preferred_language: lang,
          preferred_currency: curr,
          exchange_rate_usd_lyd: rate,
        })
        .eq("id", user.id);
      if (error) throw error;
      setLanguage(lang);
      setCurrency(curr);
      setExchangeRate(rate);
      if (profile) {
        setProfile({
          ...profile,
          preferredLanguage: lang,
          preferredCurrency: curr,
          exchangeRateUSD_LYD: rate,
          updatedAt: new Date(),
        });
      }
    } catch (e) {
      logSupabaseError(e, `profiles/${user.id}`);
    }
  };

  const updateProfile = async (data: { name: string }) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: data.name })
        .eq("id", user.id);
      if (error) throw error;
      if (profile) {
        setProfile({ ...profile, name: data.name, updatedAt: new Date() });
      }
    } catch (e) {
      logSupabaseError(e, `profiles/${user.id}`);
    }
  };

  const setDefaultExpenseWallet = async (walletId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ default_expense_wallet_id: walletId || null })
        .eq("id", user.id);
      if (error) throw error;
      if (profile) {
        setProfile({
          ...profile,
          defaultExpenseWalletId: walletId || undefined,
          updatedAt: new Date(),
        });
      }
    } catch (e) {
      logSupabaseError(e, `profiles/${user.id}`);
    }
  };

  const changeLanguage = async (lang: "ar" | "en") => {
    setLanguage(lang);
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_language: lang })
        .eq("id", user.id);
      if (error) logSupabaseError(error, `profiles/${user.id}`);
      else if (profile) {
        setProfile({ ...profile, preferredLanguage: lang, updatedAt: new Date() });
      }
    }
  };

  const changeCurrency = async (curr: "LYD" | "USD") => {
    setCurrency(curr);
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_currency: curr })
        .eq("id", user.id);
      if (error) logSupabaseError(error, `profiles/${user.id}`);
      else if (profile) {
        setProfile({ ...profile, preferredCurrency: curr, updatedAt: new Date() });
      }
    }
  };

  const changeExchangeRate = async (rate: number) => {
    setExchangeRate(rate);
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ exchange_rate_usd_lyd: rate })
        .eq("id", user.id);
      if (error) logSupabaseError(error, `profiles/${user.id}`);
      else if (profile) {
        setProfile({ ...profile, exchangeRateUSD_LYD: rate, updatedAt: new Date() });
      }
    }
  };

  // CATEGORY OPERATIONS
  /** The shared home for both legs of every transfer, created on first use. */
  const getOrCreateTransferCategory = async (): Promise<string> => {
    const existing = categories.find(
      (c) => c.name.includes("تحويل") || c.name.includes("Transfer"),
    );
    if (existing) return existing.id;
    return addCategory(
      "تحويل بين المحافظ / Transfer",
      "expense",
      "sky",
      "ArrowRightLeft",
    );
  };

  const addCategory = async (
    name: string,
    type: "income" | "expense" | "purchase",
    color: string,
    icon: string,
    parentId?: string | null,
  ): Promise<string> => {
    if (!user) throw new Error("Unauthorized");
    const { data, error } = await supabase
      .from("categories")
      .insert({
        user_id: user.id,
        name,
        type,
        color,
        icon,
        is_archived: false,
        parent_id: parentId || null,
      })
      .select()
      .single();
    if (error) {
      logSupabaseError(error, "categories/create");
      throw error;
    }
    const created = mapCategory(data);
    setCategories((prev) => [...prev, created]);
    return created.id;
  };

  const archiveCategory = async (id: string, isArchived: boolean) => {
    try {
      const { error } = await supabase
        .from("categories")
        .update({ is_archived: isArchived })
        .eq("id", id);
      if (error) throw error;
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isArchived } : c)),
      );
    } catch (e) {
      logSupabaseError(e, `categories/${id}`);
    }
  };

  const deleteCategory = async (id: string) => {
    // Check if category has dependent incomes or expenses
    const usedInIncomes = incomes.some((inc) => inc.categoryId === id);
    const usedInExpenses = expenses.some((exp) => exp.categoryId === id);
    if (usedInIncomes || usedInExpenses) {
      throw new Error(t.cannotDeleteUsed);
    }
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      logSupabaseError(e, `categories/${id}`);
    }
  };

  const updateCategory = async (
    id: string,
    name: string,
    type: "income" | "expense" | "purchase",
    color: string,
    icon: string,
    isArchived: boolean,
    parentId?: string | null,
  ) => {
    try {
      const { error } = await supabase
        .from("categories")
        .update({ name, type, color, icon, is_archived: isArchived, parent_id: parentId || null })
        .eq("id", id);
      if (error) throw error;
      setCategories((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, name, type, color, icon, isArchived, parentId: parentId || null }
            : c,
        ),
      );
    } catch (e) {
      logSupabaseError(e, `categories/${id}`);
    }
  };

  // NOTIFICATION MANAGEMENT (declared early — used by many mutation functions below)
  const addNotificationArEn = async (
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    type: "general" | "saving_group" | "purchase" | "budget",
  ) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          user_id: user.id,
          title_ar: titleAr,
          title_en: titleEn,
          message_ar: messageAr,
          message_en: messageEn,
          type,
          is_read: false,
        })
        .select()
        .single();
      if (error) throw error;
      const created = mapNotification(data);
      setNotifications((prev) => [created, ...prev]);
    } catch (e) {
      logSupabaseError(e, "notifications/create");
    }
  };

  // INCOME OPERATIONS
  const addIncome = async (
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
    isHistorical?: boolean,
    categoryName?: string,
    isOpening?: boolean,
  ) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("incomes")
        .insert({
          user_id: user.id,
          amount,
          currency,
          title,
          date,
          category_id: categoryId,
          notes: notes || null,
          image_url: imageUrl || null,
          priority: priority || null,
          wallet_id: walletId || null,
          is_historical: isHistorical ?? null,
          category_name: categoryName ?? null,
          is_opening: isOpening ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      const created = mapIncome(data);
      setIncomes((prev) => [created, ...prev].sort((x, y) => y.date.localeCompare(x.date)));
    } catch (e) {
      logSupabaseError(e, "incomes/create");
    }
  };

  const updateIncome = async (
    id: string,
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from("incomes")
        .update({
          amount,
          currency,
          title,
          date,
          category_id: categoryId,
          notes: notes ?? null,
          image_url: imageUrl ?? null,
          priority: priority ?? null,
          wallet_id: walletId ?? null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapIncome(data);
      setIncomes((prev) =>
        prev.map((i) => (i.id === id ? updated : i)).sort((x, y) => y.date.localeCompare(x.date)),
      );
    } catch (e) {
      logSupabaseError(e, `incomes/${id}`);
      // See updateExpense: a silent failure here reads as a successful save.
      throw e;
    }
  };

  /**
   * Sends the other half of a transfer to the trash alongside the half the user
   * clicked. Deleting one leg alone leaves the money having left one wallet and
   * never arrived in the other — a silent, permanent hole in net worth. A
   * transfer is one movement and is only ever deleted as one.
   */
  const trashTransferSibling = async (
    transferId: string | undefined,
    deletedLeg: "income" | "expense",
  ) => {
    if (!transferId || !user) return;
    const siblingType = deletedLeg === "expense" ? "income" : "expense";
    const sibling =
      deletedLeg === "expense"
        ? incomes.find((i) => i.transferId === transferId)
        : expenses.find((e) => e.transferId === transferId);
    if (!sibling) return;

    const { error } = await supabase.rpc("move_to_trash", {
      p_type: siblingType,
      p_id: sibling.id,
      p_deleted_by: user.email || "User",
    });
    if (error) {
      logSupabaseError(error, `transfers/${transferId}/delete-sibling`);
      return;
    }
    if (siblingType === "income") setIncomes((prev) => prev.filter((i) => i.id !== sibling.id));
    else setExpenses((prev) => prev.filter((e) => e.id !== sibling.id));
  };

  const deleteIncome = async (id: string) => {
    if (!user) return;
    try {
      const item = incomes.find((i) => i.id === id);
      if (!item) return;

      const { error } = await supabase.rpc("move_to_trash", {
        p_type: "income",
        p_id: id,
        p_deleted_by: user.email || "User",
      });
      if (error) throw error;

      setIncomes((prev) => prev.filter((i) => i.id !== id));
      await trashTransferSibling(item.transferId, "income");
      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      await addNotificationArEn(
        "تم نقل عنصر إلى السلة",
        "Moved to Trash",
        `تم نقل الوارد المالي "${item.title}" إلى سلة المحذوفات. متاح للاستعادة لمدة 3 أيام.`,
        `Successfully moved income "${item.title}" to Trash. It remains recoverable for 3 days.`,
        "general",
      );
    } catch (e) {
      logSupabaseError(e, `incomes/${id}`);
    }
  };

  /**
   * Writes both legs of a transfer or exchange under one `transfer_id`.
   *
   * Inserts directly rather than going through addExpense/addIncome: those
   * raise a high-expense notification and would announce a 912 LYD exchange as
   * overspending, and neither of them can undo the other's row.
   */
  const addTransfer = async (t: TransferInput) => {
    if (!user) throw new Error("Unauthorized");
    const transferId = crypto.randomUUID();
    // Both entry points — the wallet transfer form and the exchange tab — file
    // their legs under one shared category, so the category filter keeps working
    // as an escape hatch for finding movements. Resolved here rather than by
    // each caller, which is how the two of them drifted apart before.
    const categoryId = t.categoryId ?? (await getOrCreateTransferCategory());
    const shared = {
      user_id: user.id,
      date: t.date,
      category_id: categoryId || null,
      notes: t.notes || null,
      image_url: t.imageUrl || null,
      transfer_id: transferId,
    };

    const { data: outRow, error: outError } = await supabase
      .from("expenses")
      .insert({
        ...shared,
        amount: t.fromAmount,
        currency: t.fromCurrency,
        title: t.titleOut,
        wallet_id: t.fromWalletId,
        expense_kind: t.fromKind ?? null,
      })
      .select()
      .single();
    if (outError) {
      logSupabaseError(outError, "transfers/out");
      throw outError;
    }

    const { data: inRow, error: inError } = await supabase
      .from("incomes")
      .insert({
        ...shared,
        amount: t.toAmount,
        currency: t.toCurrency,
        title: t.titleIn,
        wallet_id: t.toWalletId,
      })
      .select()
      .single();

    if (inError) {
      // The money has left the source wallet and arrived nowhere. A half-written
      // transfer destroys value rather than duplicating it, so the first leg is
      // removed outright — it never legitimately existed, and sending it to the
      // trash would leave it restorable as a phantom expense.
      const { error: rollbackError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", outRow.id);
      if (rollbackError) logSupabaseError(rollbackError, "transfers/rollback");
      logSupabaseError(inError, "transfers/in");
      throw inError;
    }

    setExpenses((prev) => [mapExpense(outRow), ...prev].sort((x, y) => y.date.localeCompare(x.date)));
    setIncomes((prev) => [mapIncome(inRow), ...prev].sort((x, y) => y.date.localeCompare(x.date)));
  };

  // EXPENSE OPERATIONS
  const addExpense = async (
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
    isHistorical?: boolean,
    categoryName?: string,
    expenseKind?: ExpenseKind,
  ): Promise<string> => {
    if (!user) throw new Error("Unauthorized");
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: user.id,
        amount,
        currency,
        title,
        date,
        category_id: categoryId,
        notes: notes || null,
        image_url: imageUrl || null,
        priority: priority || null,
        wallet_id: walletId || null,
        is_historical: isHistorical ?? null,
        category_name: categoryName ?? null,
        expense_kind: expenseKind ?? null,
      })
      .select()
      .single();
    if (error) {
      logSupabaseError(error, "expenses/create");
      throw error;
    }
    const created = mapExpense(data);
    setExpenses((prev) => [created, ...prev].sort((x, y) => y.date.localeCompare(x.date)));

    // Budget Exceeded Reminders Alert Trigger check. A withdrawal moves money
    // between the wallet's own compartments, so a large one is not overspending.
    if (amount >= 1000 && expenseKind !== "cash_withdrawal") {
      await addNotificationArEn(
        "تنبيه مصروف مرتفع",
        "High Expense Alert",
        `تم تسجيل مصروف بقيمة عالية: ${amount} ${currency === "LYD" ? "د.ل" : "$"} لـ "${title}"`,
        `A substantial expense was logged: ${amount} ${currency} for "${title}"`,
        "budget",
      );
    }
    return created.id;
  };

  const updateExpense = async (
    id: string,
    amount: number,
    currency: "LYD" | "USD",
    title: string,
    date: string,
    categoryId: string,
    notes?: string,
    imageUrl?: string,
    priority?: "low" | "medium" | "high",
    walletId?: string,
    expenseKind?: ExpenseKind,
  ) => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .update({
          amount,
          currency,
          title,
          date,
          category_id: categoryId,
          notes: notes ?? null,
          image_url: imageUrl ?? null,
          priority: priority ?? null,
          wallet_id: walletId ?? null,
          expense_kind: expenseKind ?? null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapExpense(data);
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? updated : e)).sort((x, y) => y.date.localeCompare(x.date)),
      );
    } catch (e) {
      logSupabaseError(e, `expenses/${id}`);
      // Swallowing this made a rejected update (an oversized image_url, say)
      // look like a successful save: the form reset and switched tabs anyway.
      throw e;
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    try {
      const item = expenses.find((e) => e.id === id);
      if (!item) return;

      const { error } = await supabase.rpc("move_to_trash", {
        p_type: "expense",
        p_id: id,
        p_deleted_by: user.email || "User",
      });
      if (error) throw error;

      setExpenses((prev) => prev.filter((e) => e.id !== id));
      await trashTransferSibling(item.transferId, "expense");
      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      await addNotificationArEn(
        "تم نقل عنصر إلى السلة",
        "Moved to Trash",
        `تم نقل المصروف المالي "${item.title}" إلى سلة المحذوفات. متاح للاستعادة لمدة 3 أيام.`,
        `Successfully moved expense "${item.title}" to Trash. It remains recoverable for 3 days.`,
        "general",
      );
    } catch (e) {
      logSupabaseError(e, `expenses/${id}`);
    }
  };

  const toggleExpenseRefund = async (id: string, isRefunded: boolean) => {
    try {
      if (!isRefunded) {
        const { data: current, error: readError } = await supabase
          .from("expenses")
          .select("original_amount")
          .eq("id", id)
          .single();
        if (readError) throw readError;
        if (current && current.original_amount !== null) {
          const { data, error } = await supabase
            .from("expenses")
            .update({
              amount: Number(current.original_amount),
              original_amount: null,
              is_refunded: false,
              is_due: true,
              refunded_at: null,
            })
            .eq("id", id)
            .select()
            .single();
          if (error) throw error;
          const updated = mapExpense(data);
          setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
          return;
        }
      }
      const { data, error } = await supabase
        .from("expenses")
        .update({
          is_refunded: isRefunded,
          refunded_at: isRefunded ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapExpense(data);
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (e) {
      logSupabaseError(e, `expenses/${id}`);
    }
  };

  const toggleExpenseDue = async (id: string, isDue: boolean) => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .update({ is_due: isDue })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapExpense(data);
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (e) {
      logSupabaseError(e, `expenses/${id}`);
    }
  };

  const recoverDue = async (id: string, paidAmount: number) => {
    const exp = expenses.find((e) => e.id === id);
    if (!exp) return;

    const currentAmount = exp.amount;
    const originalAmount = exp.originalAmount || currentAmount;
    const newAmount = Math.max(0, currentAmount - paidAmount);

    const payload: Record<string, any> = {
      amount: newAmount,
      original_amount: originalAmount,
    };
    if (newAmount <= 0) {
      payload.is_due = false;
      payload.is_refunded = true;
      payload.refunded_at = new Date().toISOString();
    }

    try {
      const { data, error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapExpense(data);
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
    } catch (e) {
      logSupabaseError(e, `expenses/${id}`);
    }
  };

  // FUTURE PURCHASES OPERATIONS
  const addFuturePurchase = async (
    itemName: string,
    expectedPrice: number,
    currency: "LYD" | "USD",
    expectedDate?: string,
    priority: "low" | "medium" | "high" = "medium",
    categoryId?: string,
    notes?: string,
  ) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("future_purchases")
        .insert({
          user_id: user.id,
          item_name: itemName,
          expected_price: expectedPrice,
          currency,
          priority,
          is_purchased: false,
          expected_date: expectedDate || null,
          category_id: categoryId || null,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      setPlannedPurchases((prev) => [...prev, mapFuturePurchase(data)]);
    } catch (e) {
      logSupabaseError(e, "future_purchases/create");
    }
  };

  const updateFuturePurchase = async (
    id: string,
    itemName: string,
    expectedPrice: number,
    currency: "LYD" | "USD",
    expectedDate?: string,
    priority: "low" | "medium" | "high" = "medium",
    categoryId?: string,
    notes?: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from("future_purchases")
        .update({
          item_name: itemName,
          expected_price: expectedPrice,
          currency,
          priority,
          expected_date: expectedDate ?? null,
          category_id: categoryId ?? null,
          notes: notes ?? null,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapFuturePurchase(data);
      setPlannedPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      logSupabaseError(e, `future_purchases/${id}`);
    }
  };

  const purchaseWishlistItemChange = async (id: string, isPurchased: boolean) => {
    try {
      const { data, error } = await supabase
        .from("future_purchases")
        .update({ is_purchased: isPurchased })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapFuturePurchase(data);
      setPlannedPurchases((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (e) {
      logSupabaseError(e, `future_purchases/${id}`);
    }
  };

  const convertPurchaseToExpense = async (
    purchaseId: string,
    actualPrice: number,
    actualDate: string,
    categoryId: string,
    notes?: string,
  ) => {
    if (!user) return;
    try {
      // 1. Fetch current purchase object for its title
      const targetPurchase = plannedPurchases.find((p) => p.id === purchaseId);
      if (!targetPurchase) return;

      // 2. Insert corresponding actual expense
      const title = `${t.appName} (شراء مخطّط): ${targetPurchase.itemName}`;
      const expId = await addExpense(
        actualPrice,
        targetPurchase.currency,
        title,
        actualDate,
        categoryId || targetPurchase.categoryId || "",
        notes || targetPurchase.notes || "",
      );

      // 3. Mark the planned purchase as completed with reference ID
      const { data, error } = await supabase
        .from("future_purchases")
        .update({ is_purchased: true, matched_expense_id: expId })
        .eq("id", purchaseId)
        .select()
        .single();
      if (error) throw error;
      const updated = mapFuturePurchase(data);
      setPlannedPurchases((prev) => prev.map((p) => (p.id === purchaseId ? updated : p)));

      // 4. Trigger alert
      await addNotificationArEn(
        "تم إنجاز غرض الشراء المخطط!",
        "Wishlist Purchase Realized!",
        `مبارك! تم تحويل "${targetPurchase.itemName}" إلى سجل المصاريف الفعلي بقيمة ${actualPrice} ${targetPurchase.currency === "LYD" ? "د.ل" : "$"}.`,
        `Congrats! "${targetPurchase.itemName}" was converted into actual expenses with value of ${actualPrice} ${targetPurchase.currency}.`,
        "purchase",
      );
    } catch (e) {
      logSupabaseError(e, `future_purchases/${purchaseId}`);
    }
  };

  const deleteFuturePurchase = async (id: string) => {
    if (!user) return;
    try {
      const item = plannedPurchases.find((p) => p.id === id);
      if (!item) return;

      const { error } = await supabase.rpc("move_to_trash", {
        p_type: "future_purchase",
        p_id: id,
        p_deleted_by: user.email || "User",
      });
      if (error) throw error;

      setPlannedPurchases((prev) => prev.filter((p) => p.id !== id));
      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      await addNotificationArEn(
        "تم نقل غرض مخطط إلى السلة",
        "Moved to Trash",
        `تم نقل الشراء المخطط "${item.itemName}" إلى سلة المحذوفات. متاح للاستعادة لمدة 3 أيام.`,
        `Successfully moved planned purchase "${item.itemName}" to Trash. It remains recoverable for 3 days.`,
        "general",
      );
    } catch (e) {
      logSupabaseError(e, `future_purchases/${id}`);
    }
  };

  // SAVINGS GROUPS (الجمعيات) OPERATIONS
  const addSavingsGroup = async (
    name: string,
    currency: "LYD" | "USD",
    totalAmount: number,
    numMembers: number,
    paymentCycle: "monthly" | "weekly" | "custom",
    startDate: string,
    membersIn: Omit<
      SavingsGroupMember,
      "isReceived" | "receiveCycleIndex" | "paidCycles"
    >[],
    receivingOrder: string[],
  ) => {
    if (!user) return;
    const paymentPerMember = totalAmount / numMembers;

    const finalMembers = membersIn.map((m) => {
      const recIndex = receivingOrder.indexOf(m.id);
      return {
        id: m.id,
        name: m.name,
        phone: m.phone || "",
        notes: m.notes || "",
        isReceived: recIndex === 0,
        receiveCycleIndex: recIndex,
        paidCycles: [] as number[],
      };
    });

    try {
      const { data, error } = await supabase
        .from("savings_groups")
        .insert({
          user_id: user.id,
          name,
          currency,
          total_amount: totalAmount,
          num_members: numMembers,
          payment_per_member: paymentPerMember,
          payment_cycle: paymentCycle,
          start_date: startDate,
          members: finalMembers,
          receiving_order: receivingOrder,
          is_archived: false,
        })
        .select()
        .single();
      if (error) throw error;
      setSavingsGroups((prev) => [...prev, mapSavingsGroup(data)]);

      await addNotificationArEn(
        `تأسيس جمعية جديدة: ${name}`,
        `New Savings Group Created: ${name}`,
        `تم تأسيس جمعيتك بـ ${numMembers} مشاركين بقيمة سهم تبلغ ${paymentPerMember} ${currency === "LYD" ? "د.ل" : "$"} شهرياً.`,
        `Your savings circle is hosted with ${numMembers} participants. The cycle dues are ${paymentPerMember} ${currency} per round.`,
        "saving_group",
      );
    } catch (e) {
      logSupabaseError(e, "savings_groups/create");
    }
  };

  const updateSavingsGroup = async (
    id: string,
    name: string,
    currency: "LYD" | "USD",
    totalAmount: number,
    numMembers: number,
    paymentCycle: "monthly" | "weekly" | "custom",
    startDate: string,
    updatedMembers: SavingsGroupMember[],
    receivingOrder: string[],
    isArchived: boolean,
  ) => {
    const paymentPerMember = totalAmount / numMembers;
    try {
      const { data, error } = await supabase
        .from("savings_groups")
        .update({
          name,
          currency,
          total_amount: totalAmount,
          num_members: numMembers,
          payment_per_member: paymentPerMember,
          payment_cycle: paymentCycle,
          start_date: startDate,
          members: updatedMembers,
          receiving_order: receivingOrder,
          is_archived: isArchived,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapSavingsGroup(data);
      setSavingsGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } catch (e) {
      logSupabaseError(e, `savings_groups/${id}`);
    }
  };

  const toggleMemberPaidCycle = async (
    groupId: string,
    memberId: string,
    cycleIndex: number,
  ) => {
    try {
      const group = savingsGroups.find((g) => g.id === groupId);
      if (!group) return;

      const updatedMembers = group.members.map((m) => {
        if (m.id === memberId) {
          const currentPaid: number[] = m.paidCycles || [];
          const exists = currentPaid.includes(cycleIndex);
          const nextPaid = exists
            ? currentPaid.filter((c) => c !== cycleIndex)
            : [...currentPaid, cycleIndex];
          return { ...m, paidCycles: nextPaid };
        }
        return m;
      });

      const { data, error } = await supabase
        .from("savings_groups")
        .update({ members: updatedMembers })
        .eq("id", groupId)
        .select()
        .single();
      if (error) throw error;
      const updated = mapSavingsGroup(data);
      setSavingsGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));

      const targetMember = group.members.find((m) => m.id === memberId);
      if (targetMember) {
        const wasUnpaid = !(targetMember.paidCycles || []).includes(cycleIndex);
        if (wasUnpaid) {
          await addNotificationArEn(
            `استلام سهم من ${targetMember.name}`,
            `Contribution received from ${targetMember.name}`,
            `تم استلام قسط الدورة رقم ${cycleIndex + 1} بنجاح من العضو "${targetMember.name}" لجمعية "${group.name}".`,
            `Marked cycle round ${cycleIndex + 1} dues as paid by "${targetMember.name}" for group "${group.name}".`,
            "saving_group",
          );
        }
      }
    } catch (e) {
      logSupabaseError(e, `savings_groups/${groupId}`);
    }
  };

  const toggleMemberReceivedState = async (
    groupId: string,
    memberId: string,
    isReceived: boolean,
    cycleIndex: number,
  ) => {
    try {
      const group = savingsGroups.find((g) => g.id === groupId);
      if (!group) return;

      const updatedMembers = group.members.map((m) =>
        m.id === memberId ? { ...m, isReceived, receiveCycleIndex: cycleIndex } : m,
      );

      const { data, error } = await supabase
        .from("savings_groups")
        .update({ members: updatedMembers })
        .eq("id", groupId)
        .select()
        .single();
      if (error) throw error;
      const updated = mapSavingsGroup(data);
      setSavingsGroups((prev) => prev.map((g) => (g.id === groupId ? updated : g)));

      if (isReceived) {
        const targetMember = group.members.find((m) => m.id === memberId);
        if (targetMember) {
          await addNotificationArEn(
            `تسليم الجمعية لـ ${targetMember.name}!`,
            `Payout delivered to ${targetMember.name}!`,
            `مبارك! استلم العضو "${targetMember.name}" الرول الدوار للجمعية بأكملها بقية قدرها ${group.totalAmount} ${group.currency === "LYD" ? "د.ل" : "$"}.`,
            `Congratulations! "${targetMember.name}" has collected the total rotating pool jackpot of ${group.totalAmount} ${group.currency}.`,
            "saving_group",
          );
        }
      }
    } catch (e) {
      logSupabaseError(e, `savings_groups/${groupId}`);
    }
  };

  const archiveSavingsGroup = async (id: string, isArchived: boolean) => {
    try {
      const { data, error } = await supabase
        .from("savings_groups")
        .update({ is_archived: isArchived })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapSavingsGroup(data);
      setSavingsGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
    } catch (e) {
      logSupabaseError(e, `savings_groups/${id}`);
    }
  };

  const deleteSavingsGroup = async (id: string) => {
    if (!user) return;
    try {
      const item = savingsGroups.find((g) => g.id === id);
      if (!item) return;

      const { error } = await supabase.rpc("move_to_trash", {
        p_type: "savings_group",
        p_id: id,
        p_deleted_by: user.email || "User",
      });
      if (error) throw error;

      setSavingsGroups((prev) => prev.filter((g) => g.id !== id));
      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      await addNotificationArEn(
        "تم نقل الجمعية إلى السلة",
        "Moved to Trash",
        `تم نقل الجمعية المشتركة "${item.name}" إلى سلة المحذوفات ورصيدها. متاح للاستعادة لمدة 3 أيام.`,
        `Successfully moved Savings Group "${item.name}" to Trash. It remains recoverable for 3 days.`,
        "general",
      );
    } catch (e) {
      logSupabaseError(e, `savings_groups/${id}`);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (e) {
      logSupabaseError(e, `notifications/${id}`);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
      if (error) throw error;
      setNotifications([]);
    } catch (e) {
      logSupabaseError(e, "notifications/clear");
    }
  };

  // COMMENT OPERATIONS
  const addComment = async (
    transactionId: string,
    transactionType: "income" | "expense",
    text: string,
  ) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: user.id,
          transaction_id: transactionId,
          transaction_type: transactionType,
          user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
          user_email: user.email || "",
          text,
        })
        .select()
        .single();
      if (error) throw error;
      const created = mapComment(data);
      setComments((prev) => [...prev, created].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()));
    } catch (e) {
      logSupabaseError(e, "comments/create");
    }
  };

  const deleteComment = async (id: string) => {
    if (!user) return;
    try {
      const item = comments.find((c) => c.id === id);
      if (!item) return;

      const { error } = await supabase.rpc("move_to_trash", {
        p_type: "comment",
        p_id: id,
        p_deleted_by: user.email || "User",
      });
      if (error) throw error;

      setComments((prev) => prev.filter((c) => c.id !== id));
      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      await addNotificationArEn(
        "تم نقل التعليق إلى السلة",
        "Comment Moved to Trash",
        `تم نقل تعليق العنصر بكاتبه "${item.userName}" إلى سلة المحذوفات. متاح للاستعادة خلال 3 أيام.`,
        `Successfully moved comment by "${item.userName}" to Trash. It remains recoverable for 3 days.`,
        "general",
      );
    } catch (e) {
      logSupabaseError(e, `comments/${id}`);
    }
  };

  // WALLET OPERATIONS
  const addWallet = async (
    name: string,
    initialBalance: number,
    currency: "LYD" | "USD",
    color: string,
    icon: string,
  ): Promise<string> => {
    if (!user) throw new Error("Unauthorized");
    const { data, error } = await supabase
      .from("wallets")
      .insert({
        user_id: user.id,
        name,
        initial_balance: initialBalance,
        currency,
        color,
        icon,
        is_hidden: false,
      })
      .select()
      .single();
    if (error) {
      logSupabaseError(error, "wallets/create");
      throw error;
    }
    const created = mapWallet(data);
    setWallets((prev) => [...prev, created]);
    return created.id;
  };

  const updateWallet = async (
    id: string,
    name: string,
    initialBalance: number,
    currency: "LYD" | "USD",
    color: string,
    icon: string,
    isHidden?: boolean,
  ) => {
    try {
      const updates: Record<string, any> = {
        name,
        initial_balance: initialBalance,
        currency,
        color,
        icon,
      };
      if (isHidden !== undefined) updates.is_hidden = isHidden;
      const { data, error } = await supabase
        .from("wallets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      const updated = mapWallet(data);
      setWallets((prev) => prev.map((w) => (w.id === id ? updated : w)));
    } catch (e) {
      logSupabaseError(e, `wallets/${id}`);
    }
  };

  const deleteWallet = async (id: string) => {
    if (!user) return;
    try {
      const item = wallets.find((w) => w.id === id);
      if (!item) return;

      const { error } = await supabase.rpc("move_to_trash", {
        p_type: "wallet",
        p_id: id,
        p_deleted_by: user.email || "User",
      });
      if (error) throw error;

      setWallets((prev) => prev.filter((w) => w.id !== id));
      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      await addNotificationArEn(
        "تم نقل المحفظة إلى السلة",
        "Wallet Moved to Trash",
        `تم نقل المحفظة المالية "${item.name}" إلى سلة المحذوفات. متاح للاستعادة خلال 3 أيام.`,
        `Successfully moved wallet "${item.name}" to Trash. It remains recoverable for 3 days.`,
        "general",
      );
    } catch (e) {
      logSupabaseError(e, `wallets/${id}`);
    }
  };

  // TRASH MANAGEMENT PIPELINE
  const sourceTableFor = (originalType: TrashItem["originalType"]) =>
    originalType === "income"
      ? { table: "incomes", mapper: mapIncome, setter: setIncomes as (v: any[]) => void, sort: (a: Income, b: Income) => b.date.localeCompare(a.date) }
      : originalType === "expense"
        ? { table: "expenses", mapper: mapExpense, setter: setExpenses as (v: any[]) => void, sort: (a: Expense, b: Expense) => b.date.localeCompare(a.date) }
        : originalType === "future_purchase"
          ? { table: "future_purchases", mapper: mapFuturePurchase, setter: setPlannedPurchases as (v: any[]) => void, sort: undefined }
          : originalType === "savings_group"
            ? { table: "savings_groups", mapper: mapSavingsGroup, setter: setSavingsGroups as (v: any[]) => void, sort: undefined }
            : originalType === "wallet"
              ? { table: "wallets", mapper: mapWallet, setter: setWallets as (v: any[]) => void, sort: undefined }
              : { table: "comments", mapper: mapComment, setter: setComments as (v: any[]) => void, sort: (a: TransactionComment, b: TransactionComment) => a.createdAt.getTime() - b.createdAt.getTime() };

  /**
   * Brings a transfer's other leg back with it.
   *
   * The harder half of paired deletion: restoring one leg on its own recreates
   * the same hole that deleting one leg does, only in the opposite direction.
   * Returns false when the sibling is gone for good — the 3-day purge can take
   * one leg while the user still holds the other in the trash — so the caller
   * can say so rather than silently restoring half a movement.
   */
  const restoreTransferSibling = async (
    transferId: string | undefined,
    restoredType: TrashItem["originalType"],
  ): Promise<boolean> => {
    if (!transferId) return true;
    const sibling = trashItems.find(
      (itm) => itm.originalType !== restoredType && itm.originalData?.transfer_id === transferId,
    );
    if (!sibling) return false;

    const { error } = await supabase.rpc("restore_from_trash", { p_trash_id: sibling.id });
    if (error) {
      logSupabaseError(error, `transfers/${transferId}/restore-sibling`);
      return false;
    }
    const dest = sourceTableFor(sibling.originalType);
    await refetchOne(dest.table, dest.mapper, dest.setter, dest.sort as any);
    return true;
  };

  const restoreTrashItem = async (id: string) => {
    if (!user) return;
    try {
      const trashItem = trashItems.find((itm) => itm.id === id);
      if (!trashItem) return;

      const { error } = await supabase.rpc("restore_from_trash", { p_trash_id: id });
      if (error) throw error;

      const dest = sourceTableFor(trashItem.originalType);
      await refetchOne(dest.table, dest.mapper, dest.setter, dest.sort as any);
      const transferId = trashItem.originalData?.transfer_id as string | undefined;
      const pairRestored = await restoreTransferSibling(transferId, trashItem.originalType);
      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

      if (transferId && !pairRestored) {
        await addNotificationArEn(
          "تم استعادة نصف تحويل فقط",
          "Only half a transfer was restored",
          "الطرف الآخر من هذا التحويل لم يعد في السلة، لذلك تمت استعادة هذا الطرف وحده. راجع أرصدة المحفظتين وأضف الطرف الناقص يدوياً.",
          "The other leg of this transfer is no longer in the trash, so this leg was restored on its own. Check both wallet balances and re-enter the missing leg manually.",
          "general",
        );
      }

      const titleToShow =
        trashItem.originalData.name ||
        trashItem.originalData.title ||
        trashItem.originalData.itemName ||
        (trashItem.originalType === "comment" ? (language === "ar" ? "تعليق" : "Comment") : "");

      await addNotificationArEn(
        "تم استعادة عنصر بنجاح!",
        "Item Restored Successfully!",
        `تم استعادة العنصر "${titleToShow}" إلى سجلاته ودمجه في الحسابات الفورية للأرصدة بنجاح!`,
        `Successfully restored "${titleToShow}" back into ledger indexes.`,
        "general",
      );
    } catch (e) {
      logSupabaseError(e, `trash/${id}`);
    }
  };

  const permanentlyDeleteTrashItem = async (id: string) => {
    if (!user) return;
    try {
      const trashItem = trashItems.find((itm) => itm.id === id);
      if (!trashItem) return;

      const { error } = await supabase.rpc("permanently_delete_trash", { p_trash_id: id });
      if (error) throw error;

      setTrashItems((prev) => prev.filter((t) => t.id !== id));
      if (trashItem.originalType === "income" || trashItem.originalType === "expense") {
        await refetchOne("comments", mapComment, setComments, (a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }
    } catch (e) {
      logSupabaseError(e, `trash/${id}`);
    }
  };

  const cleanupExpiredTrashItems = async () => {
    if (!user) return;
    const now = new Date();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const expiredItems = trashItems.filter(
      (item) => now.getTime() - item.deletedAt.getTime() > threeDaysMs,
    );

    if (expiredItems.length > 0) {
      console.log(`Starting scheduled auto-cleanup of ${expiredItems.length} expired trash items...`);
      let hadIncomeOrExpense = false;
      for (const item of expiredItems) {
        try {
          const { error } = await supabase.rpc("permanently_delete_trash", { p_trash_id: item.id });
          if (error) throw error;
          if (item.originalType === "income" || item.originalType === "expense") {
            hadIncomeOrExpense = true;
          }
        } catch (err) {
          console.error(`Scheduled automatic cleanup failed for trash item ${item.id}:`, err);
        }
      }

      await refetchOne("trash", mapTrash, setTrashItems, (a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
      if (hadIncomeOrExpense) {
        await refetchOne("comments", mapComment, setComments, (a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }

      await addNotificationArEn(
        "تنظيف آلي لسلة المحذوفات",
        "Automated Trash Purge",
        `تم تنظيف عدد ${expiredItems.length} من العناصر التالفة والمحذوفة التي انقضت مهلة استعادتها (3 أيام).`,
        `Successfully purged ${expiredItems.length} expired trash items older than 3 days automatically.`,
        "general",
      );
    }
  };

  // Run the 3-day purge once the trash rows are actually in state. It can't be
  // called from loadProfileAndData: setTrashItems hasn't landed yet in that
  // async flow, so it would read an empty list and silently no-op. The ref
  // keeps it to one run per session — the cleanup refetches trash, which would
  // otherwise re-trigger this effect.
  const cleanupRan = React.useRef(false);
  useEffect(() => {
    if (loading || !user || cleanupRan.current) return;
    cleanupRan.current = true;
    cleanupExpiredTrashItems();
  }, [loading, user, trashItems]);

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        loading,
        language,
        currency,
        exchangeRate,
        theme,
        categories,
        incomes,
        expenses,
        plannedPurchases,
        savingsGroups,
        notifications,
        wallets,
        comments,
        trashItems,

        t,

        addComment,
        deleteComment,

        loginWithPassword,
        loginWithPasskey,
        registerPasskey,
        logout,

        updatePreferences,
        toggleTheme,

        addCategory,
        archiveCategory,
        deleteCategory,

        addIncome,
        addTransfer,
        updateIncome,
        deleteIncome,

        addExpense,
        updateExpense,
        toggleExpenseRefund,
        toggleExpenseDue,
        recoverDue,
        deleteExpense,

        addWallet,
        updateWallet,
        deleteWallet,

        addFuturePurchase,
        updateFuturePurchase,
        purchaseWishlistItemChange,
        convertPurchaseToExpense,
        deleteFuturePurchase,

        addSavingsGroup,
        updateSavingsGroup,
        toggleMemberPaidCycle,
        toggleMemberReceivedState,
        archiveSavingsGroup,
        deleteSavingsGroup,

        addNotificationArEn,
        markNotificationRead,
        clearAllNotifications,

        setLanguage: changeLanguage,
        setCurrency: changeCurrency,
        setExchangeRate: changeExchangeRate,
        updateProfile,
        setDefaultExpenseWallet,
        updateCategory,
        hideHistoricalData,
        setHideHistoricalData,

        // Trash Operations
        restoreTrashItem,
        permanentlyDeleteTrashItem,
        cleanupExpiredTrashItems,

        // Custom Wallet Filter crossing views
        selectedWalletFilter,
        setSelectedWalletFilter,
        selectedCompartmentFilter,
        setSelectedCompartmentFilter,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used inside an AppProvider");
  }
  return context;
};
