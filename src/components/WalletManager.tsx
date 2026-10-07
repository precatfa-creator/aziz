import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  Wallet,
  Plus,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff,
  ArrowRightLeft,
  Layers,
  Share2,
  CreditCard,
  Banknote,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmModal } from "./ConfirmModal";
import { ShareWalletModal } from "./ShareWalletModal";
import type { Wallet as WalletRow } from "../types";
import { walletBalance, walletTotals } from "../lib/walletBalance";

interface WalletManagerProps {
  setCurrentTab?: (tab: string) => void;
}

export const WalletManager: React.FC<WalletManagerProps> = ({ setCurrentTab }) => {
  const {
    language,
    wallets,
    t,
    addWallet,
    updateWallet,
    deleteWallet,
    incomes,
    expenses,
    addTransfer,
    categories,
    selectedWalletFilter,
    setSelectedWalletFilter,
    setSelectedCompartmentFilter
  } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);
  const [sharing, setSharing] = useState<WalletRow | null>(null);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [currency, setCurrency] = useState<"LYD" | "USD">("LYD");
  const [color, setColor] = useState("slate");
  // New wallets are cash; ticking marks a card (money on it, cash withdrawn from it).
  const [isCard, setIsCard] = useState(false);

  // ConfirmModal states
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info' | 'archive';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' | 'archive' = 'danger'
  ) => {
    setConfirmModalState({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  };

  // Available colors
  const colors = [
    { id: "slate", hex: "#64748b" },
    { id: "emerald", hex: "#10b981" },
    { id: "blue", hex: "#3b82f6" },
    { id: "purple", hex: "#a855f7" },
    { id: "rose", hex: "#f43f5e" },
    { id: "amber", hex: "#f59e0b" },
  ];

  // Transfer states
  const [fromWalletId, setFromWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferTime, setTransferTime] = useState(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  });
  const [transferNotes, setTransferNotes] = useState("");
  const [transferError, setTransferError] = useState("");

  const resetTransferForm = () => {
    setFromWalletId("");
    setToWalletId("");
    setTransferAmount("");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setTransferTime(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    });
    setTransferNotes("");
    setTransferError("");
    setShowTransferForm(false);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError("");
    if (!fromWalletId || !toWalletId || !transferDate || !transferTime) return;

    if (fromWalletId === toWalletId) {
      setTransferError(language === 'ar' ? 'لا يمكن التحويل لنفس المحفظة' : 'Cannot transfer to the same wallet.');
      return;
    }

    const fromWallet = wallets.find(w => w.id === fromWalletId);
    const toWallet = wallets.find(w => w.id === toWalletId);

    if (!fromWallet || !toWallet) return;
    // Cross-currency wallet-to-wallet moves belong in the exchange tab, which
    // asks for the rate. Without one there is no honest amount to credit the
    // destination with, so this form stays same-currency.
    if (fromWallet.currency !== toWallet.currency) {
      setTransferError(
        language === 'ar'
          ? 'المحفظتان بعملتين مختلفتين. استخدم تبويب "صرافة" في المعاملات لتحديد سعر الصرف.'
          : 'These wallets use different currencies. Use the Exchange tab in Transactions to set a rate.',
      );
      return;
    }

    const stats = calculateWalletStats(fromWallet);
    
    // Determine transfer amount
    let numAmount: number;
    if (transferAmount.trim() === "") {
      // Transfer whole balance
      numAmount = stats.currentBal;
    } else {
      numAmount = parseFloat(transferAmount);
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setTransferError(
        language === 'ar' 
          ? 'المبلغ غير صالح، أو رصيد المحفظة المصدر فارغ / سالب.' 
          : 'Invalid amount or source wallet balance is empty/negative.'
      );
      return;
    }

    if (stats.currentBal < numAmount) {
      setTransferError(t.insufficientBalance || 'Insufficient balance.');
      return;
    }

    try {
      const titleExp = language === 'ar' ? `تحويل مالي إلى ${toWallet.name}` : `Transfer to ${toWallet.name}`;
      const titleInc = language === 'ar' ? `تحويل مالي قادم من ${fromWallet.name}` : `Transfer from ${fromWallet.name}`;

      // Was two independent addExpense/addIncome calls: both legs counted as
      // real spending and real income, and a failure on the second one left the
      // money having left this wallet and arrived nowhere. addTransfer pairs
      // them under one id and rolls the first back if the second fails.
      await addTransfer({
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        fromAmount: numAmount,
        toAmount: numAmount,
        fromCurrency: fromWallet.currency,
        toCurrency: toWallet.currency,
        date: `${transferDate}T${transferTime}`,
        titleOut: titleExp,
        titleIn: titleInc,
        notes: transferNotes,
      });

      resetTransferForm();
    } catch (e) {
      console.error(e);
      setTransferError(t.transferError || 'Error transferring.');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setInitialBalance("");
    setCurrency("LYD");
    setColor("slate");
    setIsCard(false);
    setShowAddForm(false);
  };

  const handleEditClick = (wallet: any) => {
    setEditingId(wallet.id);
    setName(wallet.name);
    setInitialBalance(wallet.initialBalance.toString());
    setCurrency(wallet.currency);
    setColor(wallet.color || "slate");
    setIsCard(wallet.isCard !== false);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !initialBalance) return;
    const numBalance = parseFloat(initialBalance);
    if (isNaN(numBalance)) return;

    try {
      if (editingId) {
        await updateWallet(
          editingId,
          name,
          numBalance,
          currency,
          color,
          "Wallet",
          undefined,
          isCard,
        );
      } else {
        await addWallet(name, numBalance, currency, color, "Wallet", isCard);
      }
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };

  // `currentBal` is what the wallet is worth, card plus any cash withdrawn from
  // it; `totalExpenses` is everything that came off the card, withdrawals
  // included. `others` carries the wallet's non-primary currencies so the card
  // can show them without every caller learning about multi-currency.
  const calculateWalletStats = (wallet: any) => {
    const b = walletBalance(wallet, incomes, expenses);
    const others = walletTotals(wallet, incomes, expenses).filter(
      (x) => x.currency !== wallet.currency,
    );
    return { ...b, others, currentBal: b.total, totalExpenses: b.cardConsumption };
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-brand-slate dark:text-white leading-tight flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-brand-slate text-white shadow-xl shadow-brand-slate/10 dark:bg-white dark:text-brand-slate">
              <Wallet className="w-6 h-6" />
            </span>
            <span>
              {language === "ar" ? "إدارة المحافظ" : "Wallets Management"}
            </span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 max-w-xl font-medium">
            {language === "ar"
              ? "أضف محافظك النقدية وبطاقاتك البنكية. تتبع رصيدك الابتدائي وقارنه بالمصروفات والإيرادات المرتبطة به."
              : "Add your physical wallets and bank cards. Track initial balances and monitor specific inflows and outflows."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {!showTransferForm && !showAddForm && (
            <button
               onClick={() => setShowArchived(true)}
               className="w-full md:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
               title={language === "ar" ? "المحافظ المؤرشفة" : "Archived Wallets"}
            >
               <Layers className="w-4 h-4 stroke-[3]" />
               <span className="hidden sm:inline">
                 {language === "ar" ? "الأرشيف" : "Archive"}
               </span>
            </button>
          )}

          {!showTransferForm && (
            <button
               onClick={() => { setShowTransferForm(true); setShowAddForm(false); }}
               className="w-full md:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-900 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 font-extrabold text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            >
               <ArrowRightLeft className="w-4 h-4 stroke-[3]" />
               <span>{t.transferMoney}</span>
            </button>
          )}

          {!showAddForm && (
            <button
              onClick={() => { setShowAddForm(true); setShowTransferForm(false); }}
              className="w-full md:w-auto px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-brand-slate font-extrabold text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4 text-brand-slate stroke-[3]" />
              <span>
                {language === "ar" ? "إضافة محفظة جديدة" : "Add New Wallet"}
              </span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showTransferForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6 rounded-3xl space-y-5 border-l-4 border-l-sky-500"
          >
            <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2">
               <ArrowRightLeft className="w-5 h-5 text-sky-500" />
               {t.transferMoney}
            </h3>
            {transferError && (
              <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800/50">
                {transferError}
              </div>
            )}
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t.fromWallet}
                  </label>
                  <select
                    required
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    className="glass-input px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-white dark:bg-slate-900"
                  >
                    <option value="" disabled>{language === 'ar' ? 'اختر محفظة...' : 'Select wallet...'}</option>
                    {wallets.map(w => {
                      const stats = calculateWalletStats(w);
                      const symbol = w.currency === 'LYD' ? (language === 'ar' ? 'د.ل' : 'LYD') : '$';
                      return (
                        <option key={w.id} value={w.id}>
                          {w.name} — ({stats.currentBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {symbol})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t.toWallet}
                  </label>
                  <select
                    required
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="glass-input px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-white dark:bg-slate-900"
                  >
                    <option value="" disabled>{language === 'ar' ? 'اختر محفظة...' : 'Select wallet...'}</option>
                    {wallets.map(w => {
                      const stats = calculateWalletStats(w);
                      const symbol = w.currency === 'LYD' ? (language === 'ar' ? 'د.ل' : 'LYD') : '$';
                      return (
                        <option key={w.id} value={w.id}>
                          {w.name} — ({stats.currentBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {symbol})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t.transferAmount}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder={t.transferAmountPlaceholder || "Leave empty to transfer full balance"}
                    className="glass-input px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-white placeholder:text-slate-400/70"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {t.transferDate}
                      </label>
                      <input
                        type="date"
                        required
                        value={transferDate}
                        onChange={(e) => setTransferDate(e.target.value)}
                        className="glass-input px-2 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-white text-left"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {t.transferTime}
                      </label>
                      <input
                        type="time"
                        required
                        value={transferTime}
                        onChange={(e) => setTransferTime(e.target.value)}
                        className="glass-input px-2 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-white text-left"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {t.transferNotes}
                  </label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder={language === 'ar' ? 'سبب التحويل أو ملاحظات (اختياري)' : 'Reason or notes (Optional)'}
                    className="glass-input px-3 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetTransferForm}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-6 rounded-3xl space-y-5"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === "ar"
                      ? "اسم المحفظة / الكارت"
                      : "Wallet / Card Name"}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      language === "ar"
                        ? "مثال: محفظة الكاش، حساب مصرفي..."
                        : "e.g., Cash Wallet, Bank Account..."
                    }
                    className="glass-input px-3.5 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/50 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === "ar" ? "الرصيد الافتتاحي" : "Initial Balance"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      required
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      placeholder="5000"
                      className="w-full glass-input px-3.5 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/50 dark:text-white"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                      className="glass-input px-3.5 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-teal/50 dark:text-white"
                    >
                      <option value="LYD">LYD</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === "ar" ? "لون المحفظة" : "Wallet Color"}
                  </label>
                  <div className="flex gap-3">
                    {colors.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.id)}
                        className={`w-8 h-8 rounded-full shadow-sm cursor-pointer transition-transform ${color === c.id ? "ring-2 ring-offset-2 ring-slate-800 dark:ring-white scale-110" : "opacity-80 hover:scale-110"}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                <label className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 cursor-pointer has-[:checked]:border-brand-slate dark:has-[:checked]:border-white/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-teal">
                  <input
                    type="checkbox"
                    checked={isCard}
                    onChange={(e) => setIsCard(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand-slate cursor-pointer"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                      {language === "ar" ? "هذه بطاقة" : "This is a card"}
                    </span>
                    <span className="block mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {language === "ar"
                        ? "البطاقة لها رصيد عليها، ويمكن السحب منها نقداً. بدون التحديد تُعامل المحفظة كنقد بالكامل."
                        : "A card holds a balance and can have cash withdrawn from it. Unticked, the wallet is all cash."}
                    </span>
                    {editingId && !isCard && wallets.find((x) => x.id === editingId)?.isCard !== false && (
                      <span className="block mt-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {language === "ar"
                          ? "إن كانت مشاركة «البطاقة فقط»، لن يرى المشاهد شيئاً؛ ومشاركة «النقد فقط» سيرى بها المحفظة كاملة."
                          : "If it’s shared as “Card only”, that viewer will see nothing; a “Cash only” share will see the whole wallet."}
                      </span>
                    )}
                    {editingId && !isCard && expenses.some(
                      (x) => x.walletId === editingId && (x.expenseKind === "cash_withdrawal" || x.expenseKind === "cash_spend"),
                    ) && (
                      <span className="block mt-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {language === "ar"
                          ? "لهذه المحفظة سحوبات نقدية: سيُحسب رصيد البطاقة والنقد معاً كنقد. المجموع لا يتغير."
                          : "This wallet has cash withdrawals: its card and cash balances will count together as cash. The total doesn’t change."}
                      </span>
                    )}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-brand-slate text-white dark:bg-white dark:text-brand-slate hover:opacity-90 font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-md"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallets Grid */}
      {(() => {
        const walletsWithStats = wallets.map((w) => ({ wallet: w, stats: calculateWalletStats(w) }));
        // A wallet whose LYD was exchanged into USD reads zero in its primary
        // currency while still holding money. Archiving it there would file a
        // funded wallet away as spent.
        const holdsMoney = (w: (typeof walletsWithStats)[number]) =>
          w.stats.currentBal !== 0 || w.stats.others.some((o) => o.total !== 0);
        const activeWallets = walletsWithStats.filter(holdsMoney);
        const archivedWallets = walletsWithStats.filter((w) => !holdsMoney(w));

        const renderWalletCard = ({ wallet, stats }: { wallet: any; stats: any }) => {
          const isNegative = stats.currentBal < 0;
          const bgClass = `bg-${wallet.color}-100 dark:bg-${wallet.color}-950/30 text-${wallet.color}-600 dark:text-${wallet.color}-400`;

          return (
            <div
              key={wallet.id}
              className={`glass-card rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all ${wallet.isHidden ? "opacity-60 grayscale-[30%]" : ""}`}
              onClick={() => handleEditClick(wallet)} // User asked to click wallet to configure it, so we trigger edit mode
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold shadow-inner relative"
                    style={{
                      backgroundColor:
                        colors.find((c) => c.id === wallet.color)?.hex ||
                        "#64748b",
                    }}
                  >
                    <Wallet className="w-5 h-5" />
                    {wallet.isHidden && (
                      <div className="absolute -top-1 -right-1 bg-slate-800 text-white rounded-full p-0.5">
                        <EyeOff className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white capitalize truncate max-w-[140px] flex items-center gap-1.5">
                      <span className="truncate">{wallet.name}</span>
                      <span
                        className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400"
                        title={wallet.isCard === false ? (language === "ar" ? "محفظة نقدية" : "Cash wallet") : (language === "ar" ? "بطاقة" : "Card")}
                      >
                        {wallet.isCard === false ? <Banknote className="w-2.5 h-2.5" /> : <CreditCard className="w-2.5 h-2.5" />}
                        {wallet.isCard === false ? (language === "ar" ? "نقد" : "Cash") : (language === "ar" ? "بطاقة" : "Card")}
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mapping-widest flex items-center gap-1 mt-0.5">
                      {language === "ar" ? "الافتتاحي: " : "Initial: "}
                      {wallet.initialBalance.toLocaleString()}{" "}
                      {wallet.currency}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-slate-800/60 px-1.5 py-1 rounded-xl relative z-10 border border-slate-200/20 shadow-xs">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWalletFilter(wallet.id);
                      if (setCurrentTab) {
                        setCurrentTab('transactions');
                      }
                    }}
                    className="p-1 text-slate-500 hover:text-emerald-500 dark:text-slate-400 dark:hover:text-emerald-400 rounded-lg cursor-pointer transition-colors"
                    title={language === "ar" ? "عرض معاملات هذه المحفظة فقط" : "View Only This Wallet's Transactions"}
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSharing(wallet);
                    }}
                    className="p-1 text-slate-500 hover:text-brand-teal dark:text-slate-400 rounded-lg cursor-pointer transition-colors"
                    title={language === "ar" ? "مشاركة المحفظة للمشاهدة" : "Share for viewing"}
                    aria-label={language === "ar" ? "مشاركة المحفظة للمشاهدة" : "Share for viewing"}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await updateWallet(
                        wallet.id,
                        wallet.name,
                        wallet.initialBalance,
                        wallet.currency,
                        wallet.color || "slate",
                        wallet.icon || "wallet",
                        !wallet.isHidden
                      );
                    }}
                    className="p-1 text-slate-500 hover:text-brand-teal dark:text-slate-400 dark:hover:text-brand-teal rounded-lg cursor-pointer transition-colors"
                    title={language === "ar" ? "إخفاء / إظهار من الداشبورد" : "Toggle Dashboard Visibility"}
                  >
                    {wallet.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(wallet);
                    }}
                    className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-lg cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showConfirm(
                        language === "ar" ? "حذف المحفظة" : "Delete Wallet",
                        language === "ar"
                          ? `هل أنت متأكد من حذف هذه المحفظة "${wallet.name}" نهائياً؟ سيتم إلغاء ارتباطها بمصاريفك ومواردك ولكن لن تحذف المعاملات التاريخية المرتبطة بها.`
                          : `Are you sure you want to delete this wallet "${wallet.name}" permanently? This will remove the wallet, but associated transactions will be kept.`,
                        async () => {
                          await deleteWallet(wallet.id);
                        },
                        'danger'
                      );
                    }}
                    className="p-1 text-rose-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">
                  {language === "ar"
                    ? "الرصيد المتاح (الصافي)"
                    : "Current Available Balance"}
                </p>
                <div className="flex items-end gap-2">
                  <span
                    className={`text-2xl font-black ${isNegative ? "text-rose-500" : "text-slate-800 dark:text-white"}`}
                  >
                    {stats.currentBal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-xs font-bold text-slate-400 mb-1">
                    {wallet.currency}
                  </span>
                </div>

                {/* A wallet that exchanged part of its balance holds two
                    currencies at once. Shown only when one exists, so wallets
                    that never exchanged look exactly as they did. */}
                {stats.others.filter((o) => o.total !== 0).map((o) => (
                  <div key={o.currency} className="mt-1.5 flex items-baseline gap-1.5">
                    <ArrowRightLeft className="w-3 h-3 text-brand-teal self-center shrink-0" aria-hidden="true" />
                    <span className="text-lg font-black text-brand-teal tabular-nums" style={{ direction: "ltr" }}>
                      {o.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{o.currency}</span>
                  </div>
                ))}

                {/* Split the total once part of it has been withdrawn as cash:
                    the card can read zero while the money is still in hand. */}
                {wallet.isCard !== false && stats.inCash !== 0 && (
                  <div className="mt-2 flex gap-2 text-[10px] font-bold">
                    {([
                      {
                        id: "card" as const,
                        label: language === "ar" ? "على البطاقة" : "On card",
                        value: stats.onCard,
                        tone: "text-slate-600 dark:text-slate-300",
                      },
                      {
                        id: "cash" as const,
                        label: language === "ar" ? "نقداً في اليد" : "Cash in hand",
                        value: stats.inCash,
                        tone: "text-amber-500",
                      },
                    ]).map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWalletFilter(wallet.id);
                          setSelectedCompartmentFilter(part.id);
                          setCurrentTab?.("transactions");
                        }}
                        title={language === "ar" ? "عرض معاملات هذا الجزء" : "Show these transactions"}
                        className="-mx-1 px-1 py-0.5 rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-brand-teal transition-colors"
                      >
                        <span className="text-slate-400 font-medium">{part.label}</span>{" "}
                        <span className={part.value < 0 ? "text-rose-500" : part.tone}>
                          {part.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Summary of Inflows and Outflows */}
                <div className="mt-3 flex gap-3 text-[10px] font-bold">
                  <div className="flex items-center gap-1 text-emerald-500">
                    <ArrowUpRight className="w-3 h-3" />
                    {stats.totalIncomes.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-rose-500">
                    <ArrowDownLeft className="w-3 h-3" />
                    {stats.totalExpenses.toLocaleString()}
                  </div>
                </div>

                {/* Visual Bar relative to initial balance */}
                <div className="mt-2 pt-2 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/50">
                  {stats.diff > 0 ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  ) : stats.diff < 0 ? (
                    <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />
                  )}
                  <span
                    className={`text-[10px] font-bold ${stats.diff > 0 ? "text-emerald-500" : stats.diff < 0 ? "text-rose-500" : "text-slate-400"}`}
                  >
                    {stats.diff > 0 && "+"}
                    {stats.diff.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {wallet.currency}
                    <span className="text-slate-400 font-medium ml-1">
                      ({language === "ar" ? "التغيير الإجمالي" : "Net flow"})
                    </span>
                  </span>
                </div>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              {activeWallets.length === 0 && archivedWallets.length === 0 && !showAddForm ? (
                <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
                  <Wallet className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-bold">
                    {language === "ar"
                      ? "لم تقم بتهيئة أي محافظ بعد"
                      : "No wallets configured yet"}
                  </p>
                </div>
              ) : activeWallets.length === 0 && archivedWallets.length > 0 && !showAddForm ? (
                <div className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400">
                  <p className="font-bold">
                    {language === "ar"
                      ? "جميع المحافظ مؤرشفة (فارغة)"
                      : "All wallets are archived (empty)"}
                  </p>
                </div>
              ) : (
                activeWallets.map(renderWalletCard)
              )}
            </div>

            <AnimatePresence>
              {showArchived && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowArchived(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                  >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                          <Layers className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white">
                          {language === "ar" ? "المحافظ المؤرشفة (فارغة)" : "Archived Wallets (Empty)"}
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowArchived(false)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 overflow-y-auto">
                      {archivedWallets.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                          <p className="font-bold">
                            {language === "ar" ? "لا توجد محافظ مؤرشفة" : "No archived wallets"}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {archivedWallets.map(renderWalletCard)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}

      {sharing && <ShareWalletModal wallet={sharing} onClose={() => setSharing(null)} />}

      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
        type={confirmModalState.type}
      />
    </div>
  );
};
