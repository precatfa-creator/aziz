/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
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
} from "../types";
import { translations } from "../translations";

interface AppContextProps {
  user: FirebaseUser | null;
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
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;

  // Preferences Update
  updatePreferences: (
    lang: "ar" | "en",
    curr: "LYD" | "USD",
    rate: number,
  ) => Promise<void>;
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
  ) => Promise<void>;
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
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // App Config Settings (Default Fallbacks)
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [currency, setCurrency] = useState<"LYD" | "USD">("LYD");
  const [exchangeRate, setExchangeRate] = useState<number>(6.15); // Default Libya-friendly standard (1 USD = 6.15 Lyd)
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  // Read local theme fallback on start
  useEffect(() => {
    const savedTheme = localStorage.getItem("aziz_theme") as
      | "light"
      | "dark"
      | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("aziz_theme", nextTheme);
  };

  // Seeding Default Base Categories when user triggers first signup
  const seedDefaultCategories = async (uid: string) => {
    const path = "categories";
    const presets = [
      // Income
      {
        name: "راتب / Salary",
        type: "income",
        color: "emerald",
        icon: "Wallet",
      },
      {
        name: "عمل إضافي أو مستقل / Side Hustle",
        type: "income",
        color: "teal",
        icon: "Coins",
      },
      {
        name: "استثمارات وعوائد / Investments",
        type: "income",
        color: "indigo",
        icon: "TrendingUp",
      },
      {
        name: "مدخرات أو هدايا / Other Savings",
        type: "income",
        color: "cyan",
        icon: "Gift",
      },

      // Expenses
      {
        name: "إيجار وسكن / Rent & Housing",
        type: "expense",
        color: "rose",
        icon: "Home",
      },
      {
        name: "تموين ومواد غذائية / Groceries & Food",
        type: "expense",
        color: "amber",
        icon: "ShoppingBag",
      },
      {
        name: "فواتير وخدمات / Bills & Utilities",
        type: "expense",
        color: "sky",
        icon: "Zap",
      },
      {
        name: "مواصلات ووقود / Fuel & Cars",
        type: "expense",
        color: "orange",
        icon: "Car",
      },
      {
        name: "علاج وصحة / Medical & Healthcare",
        type: "expense",
        color: "red",
        icon: "Heart",
      },
      {
        name: "ترفيه وعائلة / Recreation & Family",
        type: "expense",
        color: "purple",
        icon: "Smile",
      },
      {
        name: "دراسة وتدريب / Studies & Training",
        type: "expense",
        color: "violet",
        icon: "BookOpen",
      },
      {
        name: "نفقات أخرى / Other Expenses",
        type: "expense",
        color: "slate",
        icon: "BadgeAlert",
      },

      // Wishlist Purchases Planning
      {
        name: "إلكترونيات وهواتف / Electronics & Phones",
        type: "purchase",
        color: "indigo",
        icon: "Smartphone",
      },
      {
        name: "سيارات وصيانة / Vehicles & Auto",
        type: "purchase",
        color: "amber",
        icon: "Key",
      },
      {
        name: "منزل وأثاث / Home & Furniture",
        type: "purchase",
        color: "emerald",
        icon: "Bed",
      },
      {
        name: "سفر وتجوال / Travel & Trips",
        type: "purchase",
        color: "purple",
        icon: "Compass",
      },
      {
        name: "أخرى / Other Purchases",
        type: "purchase",
        color: "slate",
        icon: "Box",
      },
    ];

    try {
      for (const p of presets) {
        const docId = `${uid}_${p.type}_${p.color}_${Math.random().toString(36).substring(2, 7)}`;
        await setDoc(doc(db, path, docId), {
          id: docId,
          userId: uid,
          name: p.name,
          type: p.type,
          color: p.color,
          icon: p.icon,
          isArchived: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  // Auth Subscription
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);

        // Fetch or create customer profile
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const loadedProfile: UserProfile = {
              uid: data.uid,
              name: data.name,
              email: data.email,
              preferredLanguage: data.preferredLanguage || "ar",
              preferredCurrency: data.preferredCurrency || "LYD",
              exchangeRateUSD_LYD: data.exchangeRateUSD_LYD || 6.15,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
            setProfile(loadedProfile);
            setLanguage(loadedProfile.preferredLanguage);
            setCurrency(loadedProfile.preferredCurrency);
            setExchangeRate(loadedProfile.exchangeRateUSD_LYD);
          } else {
            // Profile does not exist yet. Seed new user profile
            const freshProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || "مستخدم عزيز",
              email: firebaseUser.email || "",
              preferredLanguage: "ar",
              preferredCurrency: "LYD",
              exchangeRateUSD_LYD: 6.15,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            await setDoc(userDocRef, {
              uid: freshProfile.uid,
              name: freshProfile.name,
              email: freshProfile.email,
              preferredLanguage: freshProfile.preferredLanguage,
              preferredCurrency: freshProfile.preferredCurrency,
              exchangeRateUSD_LYD: freshProfile.exchangeRateUSD_LYD,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            setProfile(freshProfile);

            // Seed base system categories immediately for instant usability
            await seedDefaultCategories(firebaseUser.uid);
          }
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.GET,
            `users/${firebaseUser.uid}`,
          );
        }
      } else {
        setUser(null);
        setProfile(null);
        // Clear lists
        setCategories([]);
        setIncomes([]);
        setExpenses([]);
        setPlannedPurchases([]);
        setSavingsGroups([]);
        setNotifications([]);
        setWallets([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to User Core Lists
  useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    // A. Listen categories
    const qCategories = query(
      collection(db, "categories"),
      where("userId", "==", uid),
    );
    const unsubCategories = onSnapshot(
      qCategories,
      (snap) => {
        const items: Category[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          items.push({
            id: raw.id,
            userId: raw.userId,
            name: raw.name,
            type: raw.type,
            color: raw.color,
            icon: raw.icon,
            isArchived: !!raw.isArchived,
            parentId: raw.parentId || null,
            createdAt: raw.createdAt?.toDate() || new Date(),
          });
        });
        setCategories(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "categories");
      },
    );

    // B. Listen Incomes
    const qIncomes = query(
      collection(db, "incomes"),
      where("userId", "==", uid),
    );
    const unsubIncomes = onSnapshot(
      qIncomes,
      (snap) => {
        const items: Income[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          items.push({
            id: raw.id,
            userId: raw.userId,
            amount: Number(raw.amount),
            currency: raw.currency,
            title: raw.title,
            date: raw.date,
            categoryId: raw.categoryId,
            notes: raw.notes || "",
            createdAt: raw.createdAt?.toDate() || new Date(),
            updatedAt: raw.updatedAt?.toDate() || new Date(),
            walletId: raw.walletId || "",
            priority: raw.priority || "medium",
            imageUrl: raw.imageUrl || "",
          });
        });
        setIncomes(items.sort((x, y) => y.date.localeCompare(x.date)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "incomes");
      },
    );

    // C. Listen Expenses
    const qExpenses = query(
      collection(db, "expenses"),
      where("userId", "==", uid),
    );
    const unsubExpenses = onSnapshot(
      qExpenses,
      (snap) => {
        const items: Expense[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          items.push({
            id: raw.id,
            userId: raw.userId,
            amount: Number(raw.amount),
            currency: raw.currency,
            title: raw.title,
            date: raw.date,
            categoryId: raw.categoryId,
            notes: raw.notes || "",
            createdAt: raw.createdAt?.toDate() || new Date(),
            updatedAt: raw.updatedAt?.toDate() || new Date(),
            walletId: raw.walletId || "",
            priority: raw.priority || "medium",
            imageUrl: raw.imageUrl || "",
          });
        });
        setExpenses(items.sort((x, y) => y.date.localeCompare(x.date)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "expenses");
      },
    );

    // D. Listen Wishlist Planned Purchases
    const qPurchases = query(
      collection(db, "futurePurchases"),
      where("userId", "==", uid),
    );
    const unsubPurchases = onSnapshot(
      qPurchases,
      (snap) => {
        const items: FuturePurchase[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          items.push({
            id: raw.id,
            userId: raw.userId,
            itemName: raw.itemName,
            expectedPrice: Number(raw.expectedPrice),
            currency: raw.currency,
            expectedDate: raw.expectedDate || "",
            priority: raw.priority,
            categoryId: raw.categoryId || "",
            notes: raw.notes || "",
            isPurchased: !!raw.isPurchased,
            matchedExpenseId: raw.matchedExpenseId || "",
            createdAt: raw.createdAt?.toDate() || new Date(),
            updatedAt: raw.updatedAt?.toDate() || new Date(),
          });
        });
        setPlannedPurchases(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "futurePurchases");
      },
    );

    // E. Listen Rotating Jamiya Savings Groups
    const qGroups = query(
      collection(db, "savingsGroups"),
      where("userId", "==", uid),
    );
    const unsubGroups = onSnapshot(
      qGroups,
      (snap) => {
        const items: SavingsGroup[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          // Convert dates in nested payment histories inside members if necessary
          items.push({
            id: raw.id,
            userId: raw.userId,
            name: raw.name,
            currency: raw.currency,
            totalAmount: Number(raw.totalAmount),
            numMembers: Number(raw.numMembers),
            paymentPerMember: Number(raw.paymentPerMember),
            paymentCycle: raw.paymentCycle,
            startDate: raw.startDate,
            members: (raw.members || []).map((m: any) => ({
              id: m.id,
              name: m.name,
              phone: m.phone || "",
              notes: m.notes || "",
              isReceived: !!m.isReceived,
              receiveCycleIndex: Number(m.receiveCycleIndex ?? -1),
              paidCycles: m.paidCycles || [], // array of cycle indexes
            })),
            receivingOrder: raw.receivingOrder || [],
            isArchived: !!raw.isArchived,
            createdAt: raw.createdAt?.toDate() || new Date(),
            updatedAt: raw.updatedAt?.toDate() || new Date(),
          });
        });
        setSavingsGroups(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "savingsGroups");
      },
    );

    // F. Listen In-App Notifications
    const qNotify = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
    );
    const unsubNotify = onSnapshot(
      qNotify,
      (snap) => {
        const items: JamiyaNotification[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          items.push({
            id: raw.id,
            userId: raw.userId,
            titleAr: raw.titleAr,
            titleEn: raw.titleEn,
            messageAr: raw.messageAr,
            messageEn: raw.messageEn,
            type: raw.type,
            date: raw.date?.toDate() || new Date(),
            isRead: !!raw.isRead,
            createdAt: raw.createdAt?.toDate() || new Date(),
          });
        });
        setNotifications(
          items.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime()),
        );
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "notifications");
      },
    );

    // G. Listen Wallets
    const qWallets = query(
      collection(db, "wallets"),
      where("userId", "==", uid),
    );
    const unsubWallets = onSnapshot(
      qWallets,
      (snap) => {
        const items: Wallet[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          items.push({
            id: raw.id,
            userId: raw.userId,
            name: raw.name,
            initialBalance: Number(raw.initialBalance),
            currency: raw.currency,
            color: raw.color || "slate",
            icon: raw.icon || "Wallet",
            isHidden: raw.isHidden,
            createdAt: raw.createdAt?.toDate() || new Date(),
            updatedAt: raw.updatedAt?.toDate() || new Date(),
          });
        });
        setWallets(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "wallets");
      },
    );

    // H. Listen Comments
    const qComments = query(
      collection(db, "comments"),
      where("userId", "==", uid),
    );
    const unsubComments = onSnapshot(
      qComments,
      (snap) => {
        const items: TransactionComment[] = [];
        snap.forEach((d) => {
          const raw = d.data();
          items.push({
            id: raw.id,
            userId: raw.userId,
            transactionId: raw.transactionId,
            transactionType: raw.transactionType,
            userName: raw.userName || "",
            userEmail: raw.userEmail || "",
            text: raw.text || "",
            createdAt: raw.createdAt?.toDate() || new Date(),
          });
        });
        setComments(items.sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime()));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "comments");
      },
    );

    return () => {
      unsubCategories();
      unsubIncomes();
      unsubExpenses();
      unsubPurchases();
      unsubGroups();
      unsubNotify();
      unsubWallets();
      unsubComments();
    };
  }, [user]);

  // Auth Operations
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Core Sign-In error:", e);
      throw e;
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  // Preference Updates
  const updatePreferences = async (
    lang: "ar" | "en",
    curr: "LYD" | "USD",
    rate: number,
  ) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        preferredLanguage: lang,
        preferredCurrency: curr,
        exchangeRateUSD_LYD: rate,
        updatedAt: serverTimestamp(),
      });
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
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const updateProfile = async (data: { name: string }) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: data.name,
        updatedAt: serverTimestamp(),
      });
      if (profile) {
        setProfile({ ...profile, name: data.name, updatedAt: new Date() });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const changeLanguage = async (lang: "ar" | "en") => {
    setLanguage(lang);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        preferredLanguage: lang,
        updatedAt: serverTimestamp(),
      });
      if (profile) {
        setProfile({
          ...profile,
          preferredLanguage: lang,
          updatedAt: new Date(),
        });
      }
    }
  };

  const changeCurrency = async (curr: "LYD" | "USD") => {
    setCurrency(curr);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        preferredCurrency: curr,
        updatedAt: serverTimestamp(),
      });
      if (profile) {
        setProfile({
          ...profile,
          preferredCurrency: curr,
          updatedAt: new Date(),
        });
      }
    }
  };

  const changeExchangeRate = async (rate: number) => {
    setExchangeRate(rate);
    if (user) {
      await updateDoc(doc(db, "users", user.uid), {
        exchangeRateUSD_LYD: rate,
        updatedAt: serverTimestamp(),
      });
      if (profile) {
        setProfile({
          ...profile,
          exchangeRateUSD_LYD: rate,
          updatedAt: new Date(),
        });
      }
    }
  };

  // CATEGORY OPERATIONS
  const addCategory = async (
    name: string,
    type: "income" | "expense" | "purchase",
    color: string,
    icon: string,
    parentId?: string | null,
  ): Promise<string> => {
    if (!user) throw new Error("Unauthorized");
    const path = "categories";
    const id = `${user.uid}_${Math.random().toString(36).substring(2, 9)}`;
    try {
      await setDoc(doc(db, path, id), {
        id,
        userId: user.uid,
        name,
        type,
        color,
        icon,
        isArchived: false,
        parentId: parentId || null,
        createdAt: serverTimestamp(),
      });
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const archiveCategory = async (id: string, isArchived: boolean) => {
    const path = `categories/${id}`;
    try {
      await updateDoc(doc(db, "categories", id), { isArchived });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const deleteCategory = async (id: string) => {
    const path = `categories/${id}`;
    // Check if category has dependent incomes or expenses
    const usedInIncomes = incomes.some((inc) => inc.categoryId === id);
    const usedInExpenses = expenses.some((exp) => exp.categoryId === id);
    if (usedInIncomes || usedInExpenses) {
      throw new Error(t.cannotDeleteUsed);
    }
    try {
      await deleteDoc(doc(db, "categories", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
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
    const path = `categories/${id}`;
    try {
      await updateDoc(doc(db, "categories", id), {
        name,
        type,
        color,
        icon,
        isArchived,
        parentId: parentId || null,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
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
  ) => {
    if (!user) return;
    const path = "incomes";
    const id = `inc_${Math.random().toString(36).substring(2, 9)}`;
    const payload: Omit<Income, "createdAt" | "updatedAt"> & {
      createdAt: any;
      updatedAt: any;
    } = {
      id,
      userId: user.uid,
      amount,
      currency,
      title,
      date,
      categoryId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (notes) payload.notes = notes;
    if (imageUrl) payload.imageUrl = imageUrl;
    if (priority) payload.priority = priority;
    if (walletId) payload.walletId = walletId;
    try {
      await setDoc(doc(db, "incomes", id), payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
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
    const path = `incomes/${id}`;
    const payload: Record<string, any> = {
      amount,
      currency,
      title,
      date,
      categoryId,
      updatedAt: serverTimestamp(),
    };
    if (notes !== undefined) payload.notes = notes;
    if (imageUrl !== undefined) payload.imageUrl = imageUrl;
    if (priority !== undefined) payload.priority = priority;
    if (walletId !== undefined) payload.walletId = walletId;
    try {
      await updateDoc(doc(db, "incomes", id), payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const deleteIncome = async (id: string) => {
    const path = `incomes/${id}`;
    try {
      await deleteDoc(doc(db, "incomes", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
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
  ): Promise<string> => {
    if (!user) throw new Error("Unauthorized");
    const path = "expenses";
    const id = `exp_${Math.random().toString(36).substring(2, 9)}`;
    const payload: Omit<Expense, "createdAt" | "updatedAt"> & {
      createdAt: any;
      updatedAt: any;
    } = {
      id,
      userId: user.uid,
      amount,
      currency,
      title,
      date,
      categoryId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (notes) payload.notes = notes;
    if (imageUrl) payload.imageUrl = imageUrl;
    if (priority) payload.priority = priority;
    if (walletId) payload.walletId = walletId;
    try {
      await setDoc(doc(db, "expenses", id), payload);

      // Budget Exceeded Reminders Alert Trigger check
      if (amount >= 1000) {
        await addNotificationArEn(
          "تنبيه مصروف مرتفع",
          "High Expense Alert",
          `تم تسجيل مصروف بقيمة عالية: ${amount} ${currency === "LYD" ? "د.ل" : "$"} لـ "${title}"`,
          `A substantial expense was logged: ${amount} ${currency} for "${title}"`,
          "budget",
        );
      }
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
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
  ) => {
    const path = `expenses/${id}`;
    const payload: Record<string, any> = {
      amount,
      currency,
      title,
      date,
      categoryId,
      updatedAt: serverTimestamp(),
    };
    if (notes !== undefined) payload.notes = notes;
    if (imageUrl !== undefined) payload.imageUrl = imageUrl;
    if (priority !== undefined) payload.priority = priority;
    if (walletId !== undefined) payload.walletId = walletId;
    try {
      await updateDoc(doc(db, "expenses", id), payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const deleteExpense = async (id: string) => {
    const path = `expenses/${id}`;
    try {
      await deleteDoc(doc(db, "expenses", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
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
    const path = "futurePurchases";
    const id = `fp_${Math.random().toString(36).substring(2, 9)}`;
    const payload: Record<string, any> = {
      id,
      userId: user.uid,
      itemName,
      expectedPrice,
      currency,
      priority,
      isPurchased: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (expectedDate) payload.expectedDate = expectedDate;
    if (categoryId) payload.categoryId = categoryId;
    if (notes) payload.notes = notes;

    try {
      await setDoc(doc(db, "futurePurchases", id), payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
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
    const path = `futurePurchases/${id}`;
    const payload: Record<string, any> = {
      itemName,
      expectedPrice,
      currency,
      priority,
      updatedAt: serverTimestamp(),
    };
    if (expectedDate !== undefined) payload.expectedDate = expectedDate;
    if (categoryId !== undefined) payload.categoryId = categoryId;
    if (notes !== undefined) payload.notes = notes;

    try {
      await updateDoc(doc(db, "futurePurchases", id), payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const purchaseWishlistItemChange = async (
    id: string,
    isPurchased: boolean,
  ) => {
    const path = `futurePurchases/${id}`;
    try {
      await updateDoc(doc(db, "futurePurchases", id), {
        isPurchased,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
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
    const path = `futurePurchases/${purchaseId}`;
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
      await updateDoc(doc(db, "futurePurchases", purchaseId), {
        isPurchased: true,
        matchedExpenseId: expId,
        updatedAt: serverTimestamp(),
      });

      // 4. Trigger alert
      await addNotificationArEn(
        "تم إنجاز غرض الشراء المخطط!",
        "Wishlist Purchase Realized!",
        `مبارك! تم تحويل "${targetPurchase.itemName}" إلى سجل المصاريف الفعلي بقيمة ${actualPrice} ${targetPurchase.currency === "LYD" ? "د.ل" : "$"}.`,
        `Congrats! "${targetPurchase.itemName}" was converted into actual expenses with value of ${actualPrice} ${targetPurchase.currency}.`,
        "purchase",
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const deleteFuturePurchase = async (id: string) => {
    const path = `futurePurchases/${id}`;
    try {
      await deleteDoc(doc(db, "futurePurchases", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
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
    const path = "savingsGroups";
    const id = `jam_${Math.random().toString(36).substring(2, 9)}`;
    const paymentPerMember = totalAmount / numMembers;

    // Structure mapped members list with arrays
    const finalMembers: SavingsGroupMember[] = membersIn.map((m, idx) => {
      const recIndex = receivingOrder.indexOf(m.id);
      return {
        id: m.id,
        name: m.name,
        phone: m.phone || "",
        notes: m.notes || "",
        isReceived: recIndex === 0, // initially, if receivingOrder index 0, they might receive on first cycle
        receiveCycleIndex: recIndex,
        paidCycles: [] as number[], // paid cycle indexes
      } as any;
    });

    try {
      await setDoc(doc(db, "savingsGroups", id), {
        id,
        userId: user.uid,
        name,
        currency,
        totalAmount,
        numMembers,
        paymentPerMember,
        paymentCycle,
        startDate,
        members: finalMembers,
        receivingOrder,
        isArchived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addNotificationArEn(
        `تأسيس جمعية جديدة: ${name}`,
        `New Savings Group Created: ${name}`,
        `تم تأسيس جمعيتك بـ ${numMembers} مشاركين بقيمة سهم تبلغ ${paymentPerMember} ${currency === "LYD" ? "د.ل" : "$"} شهرياً.`,
        `Your savings circle is hosted with ${numMembers} participants. The cycle dues are ${paymentPerMember} ${currency} per round.`,
        "saving_group",
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
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
    const path = `savingsGroups/${id}`;
    const paymentPerMember = totalAmount / numMembers;
    try {
      await updateDoc(doc(db, "savingsGroups", id), {
        name,
        currency,
        totalAmount,
        numMembers,
        paymentPerMember,
        paymentCycle,
        startDate,
        members: updatedMembers,
        receivingOrder,
        isArchived,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const toggleMemberPaidCycle = async (
    groupId: string,
    memberId: string,
    cycleIndex: number,
  ) => {
    const path = `savingsGroups/${groupId}`;
    try {
      const group = savingsGroups.find((g) => g.id === groupId);
      if (!group) return;

      const updatedMembers = group.members.map((m) => {
        if (m.id === memberId) {
          const currentPaid: number[] = (m as any).paidCycles || [];
          const exists = currentPaid.includes(cycleIndex);
          const nextPaid = exists
            ? currentPaid.filter((c) => c !== cycleIndex)
            : [...currentPaid, cycleIndex];
          return {
            ...m,
            paidCycles: nextPaid,
          };
        }
        return m;
      });

      await updateDoc(doc(db, "savingsGroups", groupId), {
        members: updatedMembers,
        updatedAt: serverTimestamp(),
      });

      // Optional trigger alert if they marked it as paid
      const targetMember = group.members.find((m) => m.id === memberId);
      if (targetMember) {
        const wasUnpaid = !((targetMember as any).paidCycles || []).includes(
          cycleIndex,
        );
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
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const toggleMemberReceivedState = async (
    groupId: string,
    memberId: string,
    isReceived: boolean,
    cycleIndex: number,
  ) => {
    const path = `savingsGroups/${groupId}`;
    try {
      const group = savingsGroups.find((g) => g.id === groupId);
      if (!group) return;

      const updatedMembers = group.members.map((m) => {
        if (m.id === memberId) {
          return {
            ...m,
            isReceived,
            receiveCycleIndex: cycleIndex,
          };
        }
        return m;
      });

      await updateDoc(doc(db, "savingsGroups", groupId), {
        members: updatedMembers,
        updatedAt: serverTimestamp(),
      });

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
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const archiveSavingsGroup = async (id: string, isArchived: boolean) => {
    const path = `savingsGroups/${id}`;
    try {
      await updateDoc(doc(db, "savingsGroups", id), {
        isArchived,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const deleteSavingsGroup = async (id: string) => {
    const path = `savingsGroups/${id}`;
    try {
      await deleteDoc(doc(db, "savingsGroups", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

  // NOTIFICATION MANAGEMENT
  const addNotificationArEn = async (
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    type: "general" | "saving_group" | "purchase" | "budget",
  ) => {
    if (!user) return;
    const path = "notifications";
    const id = `notif_${Math.random().toString(36).substring(2, 9)}`;
    try {
      await setDoc(doc(db, "notifications", id), {
        id,
        userId: user.uid,
        titleAr,
        titleEn,
        messageAr,
        messageEn,
        type,
        date: Timestamp.now(),
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const markNotificationRead = async (id: string) => {
    const path = `notifications/${id}`;
    try {
      await updateDoc(doc(db, "notifications", id), { isRead: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const clearAllNotifications = async () => {
    if (!user) return;
    // Walk over and delete all user notifications or mark all read
    for (const n of notifications) {
      try {
        await deleteDoc(doc(db, "notifications", n.id));
      } catch (e) {
        console.error("Failed notification deletion", e);
      }
    }
  };

  // COMMENT OPERATIONS
  const addComment = async (
    transactionId: string,
    transactionType: "income" | "expense",
    text: string,
  ) => {
    if (!user) return;
    const path = "comments";
    const id = `com_${Math.random().toString(36).substring(2, 9)}`;
    const payload = {
      id,
      userId: user.uid,
      transactionId,
      transactionType,
      userName: user.displayName || user.email?.split("@")[0] || "User",
      userEmail: user.email || "",
      text,
      createdAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "comments", id), payload);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const deleteComment = async (id: string) => {
    const path = `comments/${id}`;
    try {
      await deleteDoc(doc(db, "comments", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
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
    const path = "wallets";
    const id = `wal_${Math.random().toString(36).substring(2, 9)}`;
    try {
      await setDoc(doc(db, "wallets", id), {
        id,
        userId: user.uid,
        name,
        initialBalance,
        currency,
        color,
        icon,
        isHidden: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
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
    const path = `wallets/${id}`;
    try {
      const updates: any = {
        name,
        initialBalance,
        currency,
        color,
        icon,
        updatedAt: serverTimestamp(),
      };
      if (isHidden !== undefined) {
          updates.isHidden = isHidden;
      }
      await updateDoc(doc(db, "wallets", id), updates);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const deleteWallet = async (id: string) => {
    const path = `wallets/${id}`;
    // Optionally check if used in incomes/expenses, or cascade set to null?
    // We'll just allow deletion, as walletId isn't universally strictly enforced
    try {
      await deleteDoc(doc(db, "wallets", id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

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

        t,

        addComment,
        deleteComment,

        loginWithGoogle,
        logout,

        updatePreferences,
        toggleTheme,

        addCategory,
        archiveCategory,
        deleteCategory,

        addIncome,
        updateIncome,
        deleteIncome,

        addExpense,
        updateExpense,
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
        updateCategory,
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
