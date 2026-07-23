/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, Calendar, FileText, Trash2, Edit2, X, Wallet } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const IncomeManager: React.FC = () => {
  const { 
    t, 
    language, 
    incomes, 
    categories, 
    addIncome, 
    updateIncome, 
    deleteIncome 
  } = useApp();

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

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Notes expand state by income ID
  const [expandedNotesIds, setExpandedNotesIds] = useState<Record<string, boolean>>({});
  
  // Form States
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');

  // Submit trigger
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !title || !categoryId) return;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    try {
      if (editingId) {
        await updateIncome(editingId, numericAmount, currency, title, date, categoryId, notes);
      } else {
        await addIncome(numericAmount, currency, title, date, categoryId, notes);
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (inc: any) => {
    setEditingId(inc.id);
    setTitle(inc.title);
    setAmount(inc.amount.toString());
    setCurrency(inc.currency);
    setDate(inc.date);
    setCategoryId(inc.categoryId);
    setNotes(inc.notes || '');
    setShowAddForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setCurrency('LYD');
    setDate(new Date().toISOString().split('T')[0]);
    setCategoryId('');
    setNotes('');
    setShowAddForm(false);
  };

  // Filter & Search Calculations
  const filteredIncomes = incomes.filter(inc => {
    const matchSearch = inc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (inc.notes && inc.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = categoryFilter ? inc.categoryId === categoryFilter : true;
    return matchSearch && matchCat;
  });

  const getCatColorClass = (color: string) => {
    const colors: Record<string, string> = {
      emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450',
      teal: 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-450',
      indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-450',
      cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-450',
      rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-450',
      amber: 'bg-amber-100 text-amber-805 dark:bg-amber-950/40 dark:text-amber-450'
    };
    return colors[color] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.incomeTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'سجّل وراجع مصادر إيراداتك المالية' : 'Record and manage your monetary sources'}
          </p>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/10 flex justify-center items-center gap-2 cursor-pointer transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addIncome}</span>
          </button>
        )}
      </div>

      {/* 2. Interactive Add/Edit Form Card */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" />
              {editingId ? t.editIncome : t.addIncome}
            </h3>
            <button
              onClick={resetForm}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg cursor-pointer text-slate-400 hover:text-slate-650"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'العنوان / المصدر' : 'Title / Source'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t.incomeTitleArEn}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
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
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.currency}
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as any)}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              >
                <option value="LYD">LYD (د.ل)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.date}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.categorySelector}
              </label>
              <select
                required
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              >
                <option value="">{t.categorySearchPlaceholder}</option>
                {categories.filter(c => c.type === 'income' && !c.parentId && !c.isArchived).map(parent => (
                  <optgroup key={parent.id} label={parent.name.split(' / ')[language === 'ar' ? 0 : 1] || parent.name}>
                    <option value={parent.id}>{parent.name.split(' / ')[language === 'ar' ? 0 : 1] || parent.name} — {language === 'ar' ? '(رئيسي)' : '(Main)'}</option>
                    {categories.filter(c => c.parentId === parent.id && !c.isArchived).map(child => (
                      <option key={child.id} value={child.id}>
                        {child.name.split(' / ')[language === 'ar' ? 0 : 1] || child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-3">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.notes}
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder={language === 'ar' ? 'مثال: مكافأة المشروع البرمجي الإضافي للشركة الفرعية...' : 'e.g., programming bonus notes...'}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
              />
            </div>

            <div className="md:col-span-3 flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Filtering & Search Rail */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        
        {/* Search Input */}
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="absolute top-3 leading-none right-3.5 sm:right-3.5 w-4.5 h-4.5 text-slate-400 rtl:right-auto rtl:left-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchIncome}
            className="w-full pl-10 pr-4 py-2.5 rtl:pr-10 rtl:pl-4 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
          />
        </div>

        {/* Category Dropdown Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl outline-hidden dark:text-white"
          >
            <option value="">{t.filterByCategory}</option>
            {categories.filter(c => c.type === 'income' && !c.parentId).map(parent => (
              <optgroup key={parent.id} label={parent.name.split(' / ')[language === 'ar' ? 0 : 1] || parent.name}>
                <option value={parent.id}>{parent.name.split(' / ')[language === 'ar' ? 0 : 1] || parent.name} — {language === 'ar' ? '(رئيسي)' : '(Main)'}</option>
                {categories.filter(c => c.parentId === parent.id).map(child => (
                  <option key={child.id} value={child.id}>
                    {child.name.split(' / ')[language === 'ar' ? 0 : 1] || child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

      </div>

      {/* 4. Main Incomes Table / List */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
          <span className="text-xs font-bold text-slate-400 uppercase">
            {language === 'ar' ? 'سجلات المعاملات المستوفاة' : 'Settled Transactions'}
          </span>
          <span className="text-xs font-bold text-slate-500">
            {filteredIncomes.length} {language === 'ar' ? 'معاملة' : 'Records'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredIncomes.length > 0 ? (
            filteredIncomes.map((inc) => {
              const cat = categories.find(c => c.id === inc.categoryId);
              const catLabel = cat ? cat.name.split(' / ')[language === 'ar' ? 0 : 1] || cat.name : t.none;

              return (
                <div key={inc.id} className="p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-all">
                  
                  {/* Left: Info Grid */}
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center flex-shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {inc.title}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getCatColorClass(cat?.color || 'slate')}`}>
                          {catLabel}
                        </span>
                      </div>

                      {inc.notes && (
                        <p 
                          onClick={() => setExpandedNotesIds(prev => ({ ...prev, [inc.id]: !prev[inc.id] }))}
                          className={`text-xs text-slate-400 dark:text-slate-500 max-w-md cursor-pointer hover:text-slate-600 dark:hover:text-slate-305 transition-colors duration-150 ${expandedNotesIds[inc.id] ? "" : "line-clamp-2"}`}
                          title={language === "ar" ? "اضغط للتوسيع / الطي" : "Click to expand/collapse"}
                        >
                          {inc.notes}
                        </p>
                      )}

                      <div className="flex gap-4 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {inc.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions and price */}
                  <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-3 self-stretch sm:self-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <span className="font-black text-sm sm:text-base text-emerald-500">
                      + {inc.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {inc.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(inc)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition-colors cursor-pointer"
                        title={t.edit}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          showConfirm(
                            language === 'ar' ? 'حذف الإيراد المالي' : 'Delete Income',
                            language === 'ar' 
                              ? `هل أنت متأكد من حذف هذا الإيراد ("${inc.title}") نهائياً؟ لا يمكن التراجع عن هذا الإجراء.` 
                              : `Are you sure you want to delete this income record ("${inc.title}")? This action cannot be undone.`,
                            async () => {
                              await deleteIncome(inc.id);
                            },
                            'danger'
                          );
                        }}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                        title={t.deleteBtn}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs">
              {t.noTransactionsYet}
            </div>
          )}
        </div>
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
