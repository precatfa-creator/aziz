/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart3, 
  Download, 
  Sparkles, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  FileSpreadsheet, 
  HelpCircle,
  Clock,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const Reports: React.FC = () => {
  const { 
    t, 
    language, 
    currency: defaultCurrency,
    incomes: allIncomes, 
    expenses: allExpenses, 
    savingsGroups, 
    plannedPurchases, 
    categories,
    hideHistoricalData,
    setHideHistoricalData
  } = useApp();

  const incomes = hideHistoricalData ? allIncomes.filter(i => !i.isHistorical) : allIncomes;
  const expenses = hideHistoricalData ? allExpenses.filter(e => !e.isHistorical) : allExpenses;

  const [activeGrouping, setActiveGrouping] = useState<'week' | 'month' | 'year'>('month');
  const [activeCurrency, setActiveCurrency] = useState<'LYD' | 'USD'>('LYD');

  // AI Advisor States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Time Utility: Get week number from date
  const getWeekNumber = (dStr: string) => {
    const d = new Date(dStr);
    const dateCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = dateCopy.getUTCDay() || 7;
    dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((dateCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${dateCopy.getUTCFullYear()}-W${weekNo}`;
  };

  // Aggregated grouped data
  const getAggregatedData = () => {
    const reportList: Record<string, { income: number; expense: number; txs: any[] }> = {};

    // Inward Incomes
    incomes.filter(i => i.currency === activeCurrency).forEach(inc => {
      let groupKey = inc.date.substring(0, 4); // default year
      if (activeGrouping === 'month') {
        groupKey = inc.date.substring(0, 7); // YYYY-MM
      } else if (activeGrouping === 'week') {
        groupKey = getWeekNumber(inc.date);
      }

      if (!reportList[groupKey]) {
        reportList[groupKey] = { income: 0, expense: 0, txs: [] };
      }
      reportList[groupKey].income += inc.amount;
      reportList[groupKey].txs.push({ ...inc, type: 'income' });
    });

    // Outward Expenses
    expenses.filter(e => e.currency === activeCurrency).forEach(exp => {
      let groupKey = exp.date.substring(0, 4);
      if (activeGrouping === 'month') {
        groupKey = exp.date.substring(0, 7);
      } else if (activeGrouping === 'week') {
        groupKey = getWeekNumber(exp.date);
      }

      if (!reportList[groupKey]) {
        reportList[groupKey] = { income: 0, expense: 0, txs: [] };
      }
      reportList[groupKey].expense += exp.amount;
      reportList[groupKey].txs.push({ ...exp, type: 'expense' });
    });

    return Object.entries(reportList)
      .sort((x, y) => y[0].localeCompare(x[0])) // sorted DESC by date key
      .map(([key, value]) => ({
        key,
        income: value.income,
        expense: value.expense,
        net: value.income - value.expense,
        txs: value.txs.sort((a,b) => b.date.localeCompare(a.date))
      }));
  };

  const groupedReport = getAggregatedData();

  // Export CSV functional utility
  const exportToCSV = () => {
    // Collect headers based on active language
    const headers = language === 'ar' 
      ? 'التاريخ,النوع,العنوان,القيمة,العملة,التصنيف,الملاحظات\n'
      : 'Date,Type,Title,Amount,Currency,Category,Notes\n';

    // Build lines
    let csvContent = '\uFEFF' + headers; // Add BOM for excel Arabic encoding

    const allRecords = [
      ...incomes.map(i => ({ ...i, type: language === 'ar' ? 'إيراد' : 'Income' })),
      ...expenses.map(e => ({ ...e, type: language === 'ar' ? 'مصروف' : 'Expense' }))
    ].sort((x, y) => x.date.localeCompare(y.date));

    allRecords.forEach(rec => {
      const catObj = categories.find(c => c.id === rec.categoryId);
      const catName = catObj ? catObj.name.split(' / ')[language === 'ar' ? 0 : 1] || catObj.name : '';
      const notesClean = (rec.notes || '').replace(/,/g, ' ');
      
      const line = `${rec.date},${rec.type},${rec.title.replace(/,/g, ' ')},${rec.amount},${rec.currency},${catName},${notesClean}\n`;
      csvContent += line;
    });

    // Download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Aziz-Finance-Report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ASK AI ADVISOR SERVER-SIDE TRIGGER (Conforming strictly to full-stack Gemini instructions)
  const triggerAiAdvisory = async () => {
    setAiLoading(true);
    setAiResponse(null);
    setAiError(null);

    try {
      const response = await fetch('/api/ai/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomes: incomes.filter(i => i.currency === activeCurrency),
          expenses: expenses.filter(e => e.currency === activeCurrency),
          jamiyaCount: savingsGroups.filter(g => !g.isArchived).length,
          wishlistCount: plannedPurchases.filter(p => !p.isPurchased).length,
          language,
          defaultCurrency: activeCurrency
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Server rejected requesting advisor.');
      }

      setAiResponse(resData.advice);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Failed connecting with AI Advisor.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* 1. Header & CSV export button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.reports}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'تحليلات تفصيلية واستشارة مالية فورية بالذكاء الاصطناعي' : 'Advanced statements and Gemini prompt analysis'}
          </p>
        </div>

        <button
          onClick={exportToCSV}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-transform self-stretch sm:self-auto justify-center"
        >
          <Download className="w-4 h-4" />
          <span>{t.exportCSV}</span>
        </button>
      </div>

      {/* 2. PREMIUM AI ADVISOR CARD - "Advisor's Corner" */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 p-6 rounded-3xl border border-emerald-500/20 shadow-xl text-white space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <h3 className="font-exrabold text-sm sm:text-base text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-5 h-5 animate-pulse" />
              {language === 'ar' ? 'زاوية عزيز الفكرية | مستشارك المالي' : "Aziz's Advisor Corner"}
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              {language === 'ar'
                ? 'مستشارك الشخصي الجاهز لتحليل السجل ومصاريفك الحالية، وتقديم توصيات مخصصة للتحوط والادخار بلمسة واحدة.'
                : 'Your dedicated AI accountant. Aziz reads your ledger to generate bespoke recommendations on dynamic circles and savings.'}
            </p>
          </div>

          <button
            onClick={triggerAiAdvisory}
            disabled={aiLoading}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{aiLoading ? (language === 'ar' ? 'تحليل...' : 'Drafting...') : (language === 'ar' ? 'استشارة فورية' : 'Ask Advisor')}</span>
          </button>
        </div>

        {/* AI Loading Progress Bar */}
        {aiLoading && (
          <div className="space-y-2 py-4 text-center">
            <Clock className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
            <p className="text-[11px] text-slate-400 animate-pulse italic">
              {language === 'ar'
                ? 'يقوم عزيز الآن بمطابقة الحسابات وحصيلة النقدية لصياغة توجيه مالي استراتيجي...'
                : 'Aziz is compiling balances and wishlist goals to draft custom financial advice...'}
            </p>
          </div>
        )}

        {/* AI Returns rendering with Markdown support */}
        {aiResponse && (
          <div className="p-5 bg-white/5 border border-white/10 rounded-2xl text-xs sm:text-sm text-slate-200 space-y-2 animate-in fade-in duration-300">
            <div className="markdown-body">
              <ReactMarkdown>{aiResponse}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Error message */}
        {aiError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        <div className="absolute right-0 bottom-0 top-0 w-32 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />
      </div>

      {/* 3. Aggregation Filters Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        
        {/* Toggle Week/Month/Year */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
          {[
            { id: 'week', label: language === 'ar' ? 'أسبوعياً' : 'Weekly' },
            { id: 'month', label: language === 'ar' ? 'شهرياً' : 'Monthly' },
            { id: 'year', label: language === 'ar' ? 'سنوياً' : 'Yearly' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setActiveGrouping(opt.id as any)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeGrouping === opt.id
                  ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-650'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Active Currency selector */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
          {[
            { id: 'LYD', label: 'د.ل (LYD)' },
            { id: 'USD', label: '$ (USD)' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setActiveCurrency(opt.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeCurrency === opt.id
                  ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-650'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Hide Historical Data Toggle */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-105/90 dark:bg-slate-950/95 rounded-xl cursor-pointer shadow-xs">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer flex items-center gap-2 select-none">
            <span>{language === 'ar' ? 'إخفاء البيانات القديمة' : 'Hide Historical'}</span>
            <input
              type="checkbox"
              checked={hideHistoricalData}
              onChange={(e) => setHideHistoricalData(e.target.checked)}
              className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
            />
          </label>
        </div>

      </div>

      {/* 4. Grouped Reports Accordions list */}
      <div className="space-y-4">
        {groupedReport.length > 0 ? (
          groupedReport.map((grp) => {
            const isDeficit = grp.net < 0;

            return (
              <div 
                key={grp.key} 
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden"
              >
                {/* Header Summary row */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-850/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500/80 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                        {grp.key}
                      </h4>
                      <p className="text-[10px] text-slate-405 text-slate-400">
                        {grp.txs.length} {language === 'ar' ? 'عمليات مستقرة' : 'Transactions grouped'}
                      </p>
                    </div>
                  </div>

                  {/* Cashflow totals panel */}
                  <div className="grid grid-cols-3 gap-6 text-center md:text-right">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-450 block font-bold uppercase">{t.totalIncome}</span>
                      <span className="font-bold text-xs sm:text-sm text-emerald-500">
                        + {grp.income.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">{t.totalExpenses}</span>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        - {grp.expense.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">{language === 'ar' ? 'الصافي' : 'Net Flow'}</span>
                      <span className={`font-black text-xs sm:text-sm ${isDeficit ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {grp.net.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-transactions grouped expanded content list */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                  {grp.txs.map((tx: any) => {
                    const isInc = tx.type === 'income';
                    return (
                      <div key={tx.id} className="p-4 flex justify-between items-center text-xs hover:bg-slate-55/10">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white" dir="auto">
                              {tx.title}
                            </span>
                            {tx.isHistorical && (
                              <span className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-250/20 dark:border-amber-900/10">
                                {language === 'ar' ? 'بيانات قديمة/مستوردة' : 'Imported'}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block pb-0.5">
                            {tx.date}
                            {(() => {
                              const parsedCat = categories.find(c => c.id === tx.categoryId);
                              const catLabel = tx.categoryName || (parsedCat ? parsedCat.name.split(' / ')[language === 'ar' ? 0 : 1] || parsedCat.name : '');
                              return catLabel ? ` • ${catLabel}` : '';
                            })()}
                          </span>
                        </div>

                        <span className={`font-black ${isInc ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-205'}`}>
                          {isInc ? '+' : '-'} {tx.amount.toLocaleString()} {activeCurrency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                        </span>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })
        ) : (
          <div className="text-center py-16 text-xs text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl">
            {language === 'ar' ? 'لا تتوفر أي عمليات في عملة البحث النشطة لإعداد تقرير.' : 'No statements matching criteria currently active.'}
          </div>
        )}
      </div>

    </div>
  );
};
