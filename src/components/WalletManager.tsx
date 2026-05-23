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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmModal } from "./ConfirmModal";

export const WalletManager: React.FC = () => {
  const {
    language,
    wallets,
    t,
    addWallet,
    updateWallet,
    deleteWallet,
    incomes,
    expenses,
  } = useApp();
  const [showAddForm, setShowAddForm] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [currency, setCurrency] = useState<"LYD" | "USD">("LYD");
  const [color, setColor] = useState("slate");

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

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setInitialBalance("");
    setCurrency("LYD");
    setColor("slate");
    setShowAddForm(false);
  };

  const handleEditClick = (wallet: any) => {
    setEditingId(wallet.id);
    setName(wallet.name);
    setInitialBalance(wallet.initialBalance.toString());
    setCurrency(wallet.currency);
    setColor(wallet.color || "slate");
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
        );
      } else {
        await addWallet(name, numBalance, currency, color, "Wallet");
      }
      resetForm();
    } catch (error) {
      console.error(error);
    }
  };

  // Calculate current balance for a wallet
  const calculateWalletStats = (wallet: any) => {
    const wIncomes = incomes.filter(
      (inc) => inc.walletId === wallet.id && inc.currency === wallet.currency,
    );
    const wExpenses = expenses.filter(
      (exp) => exp.walletId === wallet.id && exp.currency === wallet.currency,
    );

    const totalIncomes = wIncomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpenses = wExpenses.reduce((acc, curr) => acc + curr.amount, 0);

    return {
      currentBal: wallet.initialBalance + totalIncomes - totalExpenses,
      totalIncomes,
      totalExpenses,
      diff: totalIncomes - totalExpenses
    };
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

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full md:w-auto px-5 py-3 bg-brand-teal hover:bg-brand-teal/90 text-brand-slate font-extrabold text-xs rounded-2xl shadow-lg shadow-brand-teal/20 flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 text-brand-slate stroke-[3]" />
            <span>
              {language === "ar" ? "إضافة محفظة جديدة" : "Add New Wallet"}
            </span>
          </button>
        )}
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {wallets.length === 0 && !showAddForm ? (
          <div className="col-span-full py-16 text-center text-slate-500 dark:text-slate-400">
            <Wallet className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold">
              {language === "ar"
                ? "لم تقم بتهيئة أي محافظ بعد"
                : "No wallets configured yet"}
            </p>
          </div>
        ) : (
          wallets.map((wallet) => {
            const stats = calculateWalletStats(wallet);
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
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white capitalize truncate max-w-[140px]">
                        {wallet.name}
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
          })
        )}
      </div>

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
