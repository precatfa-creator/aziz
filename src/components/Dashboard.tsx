/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar, 
  ShoppingBag, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  PlusCircle, 
  FileText,
  BadgeAlert
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export interface DashboardProps {
  setCurrentTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentTab }) => {
  const { 
    t, 
    language, 
    currency: defaultCurrency, 
    exchangeRate,
    incomes, 
    expenses, 
    plannedPurchases, 
    savingsGroups, 
    categories,
    addIncome,
    addExpense,
    wallets
  } = useApp();

  const [activeCurrency, setActiveCurrency] = useState<'LYD' | 'USD' | 'MERGED'>('MERGED');
  
  // Quick add dialog toggles
  const [showQuickAdd, setShowQuickAdd] = useState<'income' | 'expense' | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCurr, setQuickCurr] = useState<'LYD' | 'USD'>('LYD');
  const [quickCat, setQuickCat] = useState('');

  // Helpers to structure numbers
  const formatMoney = (val: number, currCode: string) => {
    return new Intl.NumberFormat(language === 'ar' ? 'ar-LY' : 'en-US', {
      style: 'currency',
      currency: currCode === 'MERGED' ? 'LYD' : currCode,
      maximumFractionDigits: 2
    }).format(val);
  };

  // Convert USD to LYD or keep LYD
  const getMergedLYD = (amount: number, curr: 'LYD' | 'USD') => {
    if (curr === 'LYD') return amount;
    return amount * exchangeRate;
  };

  // Financial Stats calculation
  const getTotals = () => {
    let incVal = 0;
    let expVal = 0;

    if (activeCurrency === 'MERGED') {
      incVal = incomes.reduce((acc, curr) => acc + getMergedLYD(curr.amount, curr.currency), 0);
      expVal = expenses.reduce((acc, curr) => acc + getMergedLYD(curr.amount, curr.currency), 0);
    } else {
      incVal = incomes.filter(i => i.currency === activeCurrency).reduce((acc, curr) => acc + curr.amount, 0);
      expVal = expenses.filter(i => i.currency === activeCurrency).reduce((acc, curr) => acc + curr.amount, 0);
    }

    return {
      income: incVal,
      expense: expVal,
      balance: incVal - expVal
    };
  };

  const getWalletsBalance = () => {
    let sumBalLYD = 0;
    let sumBalUSD = 0;
    
    wallets.forEach(w => {
      if (w.isHidden) return; // Exclude hidden wallets
      
      const wIncomes = incomes.filter(inc => inc.walletId === w.id);
      const wExpenses = expenses.filter(exp => exp.walletId === w.id);
      
      const sumInc = wIncomes.reduce((acc, curr) => acc + curr.amount, 0);
      const sumExp = wExpenses.reduce((acc, curr) => acc + curr.amount, 0);
      
      const bal = w.initialBalance + sumInc - sumExp;
      
      if (w.currency === 'LYD') {
        sumBalLYD += bal;
      } else {
        sumBalUSD += bal;
      }
    });

    if (activeCurrency === 'MERGED') {
       return sumBalLYD + getMergedLYD(sumBalUSD, 'USD');
    } else if (activeCurrency === 'LYD') {
       return sumBalLYD;
    } else {
       return sumBalUSD;
    }
  };

  const stats = getTotals();
  const walletsBalance = getWalletsBalance();

  // Combine trans for recent list
  const recentTransactions = [
    ...incomes.map(i => ({ ...i, type: 'income' as const })),
    ...expenses.map(e => ({ ...e, type: 'expense' as const }))
  ].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 5);

  // Recharts: Income vs Expense by Month (Last 5 months)
  const getBarChartData = () => {
    // Collect distinct months
    const monthMap: Record<string, { income: number; expense: number }> = {};
    
    // Default months if empty
    const defaultMonths = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
    defaultMonths.forEach(m => {
      monthMap[m] = { income: 0, expense: 0 };
    });

    incomes.forEach(i => {
      const month = i.date.substring(0, 7);
      const val = activeCurrency === 'MERGED' ? getMergedLYD(i.amount, i.currency) : (i.currency === activeCurrency ? i.amount : 0);
      if (monthMap[month]) monthMap[month].income += val;
      else if (i.date.includes('2026')) monthMap[month] = { income: val, expense: 0 };
    });

    expenses.forEach(e => {
      const month = e.date.substring(0, 7);
      const val = activeCurrency === 'MERGED' ? getMergedLYD(e.amount, e.currency) : (e.currency === activeCurrency ? e.amount : 0);
      if (monthMap[month]) monthMap[month].expense += val;
      else if (e.date.includes('2026')) monthMap[month] = { income: 0, expense: val };
    });

    return Object.entries(monthMap)
      .sort((x, y) => x[0].localeCompare(y[0]))
      .slice(-5)
      .map(([month, data]) => {
        const dObj = new Date(month + '-02');
        const formattedMonth = dObj.toLocaleDateString(language === 'ar' ? 'ar-LY' : 'en-US', { month: 'short' });
        return {
          name: formattedMonth,
          [t.totalIncome]: Math.round(data.income),
          [t.totalExpenses]: Math.round(data.expense)
        };
      });
  };

  const barData = getBarChartData();

  // Recharts: Category Spending Shares
  const getPieChartData = () => {
    const expenseShares: Record<string, number> = {};
    expenses.forEach(e => {
      const val = activeCurrency === 'MERGED' ? getMergedLYD(e.amount, e.currency) : (e.currency === activeCurrency ? e.amount : 0);
      if (val > 0) {
        expenseShares[e.categoryId] = (expenseShares[e.categoryId] || 0) + val;
      }
    });

    const PIE_COLORS: Record<string, string> = {
      rose: '#f43f5e',
      amber: '#f59e0b',
      sky: '#0ea5e9',
      orange: '#f97316',
      red: '#ef4444',
      purple: '#a855f7',
      violet: '#8b5cf6',
      emerald: '#10b981',
      indigo: '#6366f1',
      slate: '#64748b'
    };

    const data = Object.entries(expenseShares).map(([catId, amount]) => {
      const cat = categories.find(c => c.id === catId);
      let catName = t.none;

      if (cat) {
        const localized = cat.name.split(' / ')[language === 'ar' ? 0 : 1] || cat.name;
        if (cat.parentId) {
          const parent = categories.find(p => p.id === cat.parentId);
          if (parent) {
            const parentLocalized = parent.name.split(' / ')[language === 'ar' ? 0 : 1] || parent.name;
            catName = `${parentLocalized} — ${localized}`;
          } else {
            catName = localized;
          }
        } else {
          catName = localized;
        }
      }

      return {
        name: catName,
        value: Math.round(amount),
        color: PIE_COLORS[cat?.color || 'slate'] || '#64748b'
      };
    });

    return data.length > 0 ? data : [{ name: t.none, value: 1, color: '#e2e8f0' }];
  };

  const pieData = getPieChartData();

  // Quick adds submit
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAmount || !quickTitle) return;
    const numericAmount = parseFloat(quickAmount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    const todayDate = new Date().toISOString().split('T')[0];

    try {
      if (showQuickAdd === 'income') {
        const catId = quickCat || categories.find(c => c.type === 'income')?.id || '';
        await addIncome(numericAmount, quickCurr, quickTitle, todayDate, catId, 'Quick Added');
      } else {
        const catId = quickCat || categories.find(c => c.type === 'expense')?.id || '';
        await addExpense(numericAmount, quickCurr, quickTitle, todayDate, catId, 'Quick Added');
      }
      
      // Reset
      setQuickTitle('');
      setQuickAmount('');
      setQuickCat('');
      setShowQuickAdd(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* 1. Dashboard Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.dashboard}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'ملخص المحفظة والجمعيات' : 'Overview of wallet balances and savings circles'}
          </p>
        </div>

        {/* Currency selectors */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800 self-stretch sm:self-auto shadow-xs">
          {[
            { id: 'MERGED', label: language === 'ar' ? 'الكل مدمج د.ل' : 'Merged LYD' },
            { id: 'LYD', label: t.lydSymbol },
            { id: 'USD', label: t.usdSymbol }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setActiveCurrency(opt.id as any)}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeCurrency === opt.id
                  ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {activeCurrency === 'MERGED' && (
        <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-2xl border border-emerald-500/10 dark:border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <BadgeAlert className="w-4 h-4 flex-shrink-0" />
          <span>
            {language === 'ar' 
              ? `يتم دمج العملات باستخدام سعر صرف مايو المالي المفعّل: 1 دولار = ${exchangeRate} د.ل` 
              : `Currencies are merged with active manual conversion rate: 1 USD = ${exchangeRate} LYD.`}
          </span>
        </div>
      )}

      {/* 2. Top Statistics Cards */}
      <div className="flex flex-col gap-5">
        
        {/* Card A: Net Current Balance (Wallets Balance) */}
        <div className="driver-tour-balance relative overflow-hidden glass-card p-6 rounded-3xl flex justify-between items-center group shadow-md shadow-brand-teal/5">
          <div className="space-y-2 relative z-10">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
              {language === 'ar' ? 'الرصيد الحالي (إجمالي المحافظ)' : 'Current Balance (Total Wallets)'}
            </span>
            <h3 className={`text-4xl md:text-5xl font-black ${walletsBalance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`}>
              {formatMoney(walletsBalance, activeCurrency)}
            </h3>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center relative z-10 ${walletsBalance >= 0 ? 'bg-brand-teal/20 text-teal-600 dark:bg-brand-teal/10 dark:text-brand-teal' : 'bg-red-50 dark:bg-red-950/45 text-red-500'}`}>
            <Wallet className="w-6 h-6" />
          </div>
          <div className="absolute left-0 right-0 bottom-0 h-1.5 opacity-60 bg-brand-teal" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card B: Income */}
          <div className="relative overflow-hidden glass-card p-6 rounded-3xl flex justify-between items-center group">
            <div className="space-y-2 relative z-10">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                {t.totalIncome}
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                {formatMoney(stats.income, activeCurrency)}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-green/20 text-emerald-600 dark:bg-brand-green/10 dark:text-brand-green flex items-center justify-center relative z-10">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="absolute left-0 right-0 bottom-0 h-1 bg-brand-green opacity-60" />
          </div>

          {/* Card C: Expenses */}
          <div className="relative overflow-hidden glass-card p-6 rounded-3xl flex justify-between items-center group">
            <div className="space-y-2 relative z-10">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">
                {t.totalExpenses}
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
                {formatMoney(stats.expense, activeCurrency)}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-550 flex items-center justify-center relative z-10">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div className="absolute left-0 right-0 bottom-0 h-1 bg-brand-slate opacity-60" />
          </div>
        </div>
      </div>

      {/* 3. Action Buttons & Quick entry */}
      <div className="driver-tour-quick-actions bg-white/70 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-100/80 dark:border-slate-850/60 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-brand-slate/5 dark:bg-white/5 rounded-xl text-slate-500 dark:text-slate-400">
              <PlusCircle className="w-4 h-4 text-brand-teal" />
            </div>
            <span className="text-xs font-black text-slate-800 dark:text-slate-205">
              {t.quickAdd}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:min-w-[320px]">
            <button
              onClick={() => {
                if (setCurrentTab) {
                  setCurrentTab('income');
                } else {
                  setShowQuickAdd('income');
                }
              }}
              className="px-5 py-3.5 bg-brand-green/10 hover:bg-brand-green/20 text-emerald-600 dark:text-brand-green border border-brand-green/20 dark:border-brand-green/10 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 active:scale-95 group hover:shadow-xs"
            >
              <span className="text-sm font-black transition-transform group-hover:scale-125 font-mono">+</span>
              <span>{t.quickIncome}</span>
            </button>
            <button
              onClick={() => {
                if (setCurrentTab) {
                  setCurrentTab('expenses');
                } else {
                  setShowQuickAdd('expense');
                }
              }}
              className="px-5 py-3.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/30 text-rose-500 border border-rose-100 dark:border-rose-900/10 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 active:scale-95 group hover:shadow-xs"
            >
              <span className="text-sm font-black transition-transform group-hover:scale-125 font-mono">-</span>
              <span>{t.quickExpense}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Quick Add Dialogue Modal Form */}
      {showQuickAdd && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center">
            <h3 className="font-exrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${showQuickAdd === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {showQuickAdd === 'income' ? t.addIncome : t.addExpense}
            </h3>
            <button
              onClick={() => setShowQuickAdd(null)}
              className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg"
            >
              {t.cancel}
            </button>
          </div>

          <form onSubmit={handleQuickAddSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'العنوان' : 'Title'}
              </label>
              <input
                type="text"
                required
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder={showQuickAdd === 'income' ? t.incomeTitleArEn : t.expenseTitlePlaceholder}
                className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.amount}
              </label>
              <input
                type="number"
                step="any"
                required
                value={quickAmount}
                onChange={e => setQuickAmount(e.target.value)}
                placeholder="0.00"
                className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.currency}
              </label>
              <select
                value={quickCurr}
                onChange={e => setQuickCurr(e.target.value as any)}
                className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              >
                <option value="LYD">LYD (د.ل)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            {/* Quick pre-filled Category match selector */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.categorySelector}
              </label>
              <select
                value={quickCat}
                onChange={e => setQuickCat(e.target.value)}
                required
                className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              >
                <option value="">{t.categorySearchPlaceholder}</option>
                {categories
                  .filter(c => c.type === (showQuickAdd === 'income' ? 'income' : 'expense'))
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name.split(' / ')[language === 'ar' ? 0 : 1] || c.name}
                    </option>
                  ))
                }
              </select>
            </div>

            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Recharts Side by Side trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Bar chart */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
            {t.monthlyTrends}
          </h3>
          <div className="h-64 w-full text-xs">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(16,185,129,0.05)' }} contentStyle={{ borderRadius: 12 }} />
                  <Bar dataKey={t.totalIncome} fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={t.totalExpenses} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                {t.noTransactionsYet}
              </div>
            )}
          </div>
        </div>

        {/* Right: Pie chart */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col space-y-4">
          <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
            {t.categorySpendingDistribution}
          </h3>
          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend list */}
          <div className="flex flex-wrap gap-2.5 justify-center overflow-y-auto max-h-20 scrollbar-none pt-2">
            {pieData.slice(0, 5).map((entry, i) => (
              <div key={i} className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 6. Upcoming Jamiya & Future Purchases lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Active Jamiya / Savings groups Overview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-emerald-500" />
              {t.upcomingJamiyaPayment}
            </h3>
            <span className="text-[10px] font-bold text-slate-400">
              {savingsGroups.filter(g => !g.isArchived).length} {t.active}
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {savingsGroups.filter(g => !g.isArchived).length > 0 ? (
              savingsGroups.filter(g => !g.isArchived).slice(0, 3).map((group) => {
                // Find next receiving member info in order of sequence
                const activeCycle = 0; // conceptually
                const nextReceiverId = group.receivingOrder[0];
                const receiverMember = group.members.find(m => m.id === nextReceiverId);

                return (
                  <div key={group.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex justify-between items-center">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {group.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {t.numMembers}: {group.numMembers} • {formatMoney(group.paymentPerMember, group.currency)}
                      </p>
                    </div>
                    {receiverMember && (
                      <div className="text-right">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-md block">
                          {t.nextReceiver}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mt-1">
                          {receiverMember.name}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                {language === 'ar' ? 'لا توجد أي جمعية قائمة بعد.' : 'No active savings groups created.'}
              </div>
            )}
          </div>
        </div>

        {/* Future Purchases Wishlist Overview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4.5 h-4.5 text-indigo-500" />
              {t.upcomingPurchases}
            </h3>
            <span className="text-[10px] font-bold text-slate-400">
              {plannedPurchases.filter(p => !p.isPurchased).length} {t.none}
            </span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto">
            {plannedPurchases.filter(p => !p.isPurchased).length > 0 ? (
              plannedPurchases.filter(p => !p.isPurchased).slice(0, 3).map((item) => {
                const priorityColors = {
                  high: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-450',
                  medium: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-450',
                  low: 'bg-slate-100 text-slate-650 dark:bg-slate-800/80 dark:text-slate-400'
                };

                return (
                  <div key={item.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex justify-between items-center">
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {item.itemName}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-450">
                        {item.expectedDate ? `${t.expectedDate}: ${item.expectedDate}` : t.notSpecified}
                      </p>
                    </div>
                    <div className="text-right space-y-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                        {formatMoney(item.expectedPrice, item.currency)}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm ${priorityColors[item.priority]}`}>
                        {t[item.priority]}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                {language === 'ar' ? 'لا توجد مصاريف مخططة بقائمة الأمنيات.' : 'No wishlist items budgeted.'}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 7. Recent Transactions List */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-4.5 h-4.5 text-slate-550 dark:text-slate-455" />
          {t.recentTransactions}
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx) => {
              const itemCat = categories.find(c => c.id === tx.categoryId);
              const isIncome = tx.type === 'income';

              return (
                <div key={tx.id} className="py-3.5 flex justify-between items-center first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl flex items-center justify-center ${
                      isIncome 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500' 
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-500'
                    }`}>
                      {isIncome ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                        {tx.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400">
                          {tx.date}
                        </span>
                        {itemCat && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold text-slate-500 bg-slate-100 dark:bg-slate-800">
                            {itemCat.name.split(' / ')[language === 'ar' ? 0 : 1] || itemCat.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${isIncome ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                    {isIncome ? '+' : '-'} {formatMoney(tx.amount, tx.currency)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              {t.noTransactionsYet}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
