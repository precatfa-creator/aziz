/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Search, Calendar, Trash2, Edit2, X, CreditCard, Tag, Sparkles } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const ExpenseManager: React.FC = () => {
  const { 
    t, 
    language, 
    expenses, 
    categories, 
    addExpense, 
    updateExpense, 
    deleteExpense,
    addCategory 
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
  // Notes expand state by expense ID
  const [expandedNotesIds, setExpandedNotesIds] = useState<Record<string, boolean>>({});
  
  // Dialog Toggle
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');

  // Searchable Dropdown for Categories
  const [typedCategoryQuery, setTypedCategoryQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter existing categories with current typing
  const availableCategories = categories.filter(c => c.type === 'expense' && !c.isArchived);
  
  const getLocalizedName = (cat: any) => cat.name.split(' / ')[language === 'ar' ? 0 : 1] || cat.name;

  const getFullCategoryName = (cat: any) => {
    let name = getLocalizedName(cat);
    if (cat.parentId) {
      const parent = categories.find(p => p.id === cat.parentId);
      if (parent) {
         name = `${getLocalizedName(parent)} — ${name}`;
      }
    }
    return name;
  };

  const filteredDropCategories = availableCategories.filter(c => {
    return getFullCategoryName(c).toLowerCase().includes(typedCategoryQuery.toLowerCase());
  }).sort((a,b) => {
      const aName = getFullCategoryName(a);
      const bName = getFullCategoryName(b);
      return aName.localeCompare(bName);
  });

  const exactMatchExists = availableCategories.some(c => {
    return getFullCategoryName(c).toLowerCase() === typedCategoryQuery.trim().toLowerCase();
  });

  // Handle direct addition from dropdown
  const handleAddNewCategoryInline = async () => {
    if (!typedCategoryQuery.trim()) return;
    try {
      // Build a default category object
      const catName = typedCategoryQuery.trim();
      const randomColor = ['rose', 'amber', 'sky', 'orange', 'red', 'purple', 'violet', 'emerald', 'indigo'][Math.floor(Math.random() * 9)];
      const randomIcon = ['Tag', 'Coins', 'Wallet', 'ShoppingBag', 'Home', 'Car', 'Heart', 'Smile'][Math.floor(Math.random() * 8)];
      
      const newId = await addCategory(catName, 'expense', randomColor, randomIcon);
      setSelectedCatId(newId);
      setTypedCategoryQuery(catName);
      setDropdownOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const selectCategoryFromDropdown = (cat: any) => {
    setSelectedCatId(cat.id);
    setTypedCategoryQuery(getFullCategoryName(cat));
    setDropdownOpen(false);
  };

  // Submit main ledger entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !title || !selectedCatId) return;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    try {
      if (editingId) {
        await updateExpense(editingId, numericAmount, currency, title, date, selectedCatId, notes);
      } else {
        await addExpense(numericAmount, currency, title, date, selectedCatId, notes);
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (exp: any) => {
    setEditingId(exp.id);
    setTitle(exp.title);
    setAmount(exp.amount.toString());
    setCurrency(exp.currency);
    setDate(exp.date);
    setSelectedCatId(exp.categoryId);
    const catObj = categories.find(c => c.id === exp.categoryId);
    if (catObj) {
      setTypedCategoryQuery(getFullCategoryName(catObj));
    } else {
      setTypedCategoryQuery('');
    }
    setNotes(exp.notes || '');
    setShowAddForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setCurrency('LYD');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setSelectedCatId('');
    setTypedCategoryQuery('');
    setShowAddForm(false);
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchSearch = exp.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = categoryFilter ? exp.categoryId === categoryFilter : true;
    return matchSearch && matchCat;
  });

  const getCatColorClass = (color: string) => {
    const colors: Record<string, string> = {
      rose: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-450',
      amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-450',
      sky: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-450',
      orange: 'bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-450',
      red: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-450',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-450',
      violet: 'bg-violet-100 text-violet-805 dark:bg-violet-950/40 dark:text-violet-450',
      emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-450',
      indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-450',
      slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    };
    return colors[color] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.expenseTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'سجّل وتابع نفقاتك وصنفها بدقة' : 'Track expenditures and inspect spending pools'}
          </p>
        </div>

        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/10 flex justify-center items-center gap-2 cursor-pointer transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addExpense}</span>
          </button>
        )}
      </div>

      {/* 2. Interactive Form Sheet */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-4 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-rose-500" />
              {editingId ? t.editExpense : t.addExpense}
            </h3>
            <button
              onClick={resetForm}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg cursor-pointer text-slate-400 hover:text-slate-655"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'البند / المصروف' : 'Item / Purpose'}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t.expenseTitlePlaceholder}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden dark:text-white font-medium"
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
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.currency}
              </label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as any)}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden dark:text-white"
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
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden dark:text-white"
              />
            </div>

            {/* Premium Custom Searchable dropdown with inline create */}
            <div className="flex flex-col gap-1.5 relative" ref={dropdownRef}>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.categorySelector}
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  value={typedCategoryQuery}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={e => {
                    setTypedCategoryQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  placeholder={t.categorySearchPlaceholder}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden dark:text-white"
                />
                <Tag className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 w-4 h-4 text-slate-400" />
              </div>

              {dropdownOpen && (
                <div 
                  className="absolute top-16 left-0 right-0 max-h-56 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl shadow-xl z-50 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  
                  {filteredDropCategories.map(cat => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => selectCategoryFromDropdown(cat)}
                      className={`w-full px-4 py-2.5 text-start text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-750 dark:text-slate-200 flex items-center gap-2 cursor-pointer ${cat.parentId ? 'ps-8' : ''}`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ 
                        backgroundColor: cat.color.startsWith('hsl') || cat.color.startsWith('#') ? cat.color : cat.color === 'rose' || cat.color === 'coral' ? '#f43f5e' : cat.color === 'amber' ? '#f59e0b' : cat.color === 'emerald' ? '#10b981' : cat.color === 'teal' ? '#14b8a6' : '#3b82f6' 
                      }} />
                      <span className="truncate">{getFullCategoryName(cat)}</span>
                    </button>
                  ))}

                  {typedCategoryQuery && !exactMatchExists && (
                    <button
                      type="button"
                      onClick={handleAddNewCategoryInline}
                      className="w-full px-4 py-3 bg-rose-50/70 hover:bg-rose-100/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-black text-start flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t.addCategoryDirectly}: "{typedCategoryQuery}"</span>
                    </button>
                  )}

                  {filteredDropCategories.length === 0 && !typedCategoryQuery && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      {language === 'ar' ? 'اكتب لإيجاد أو إنشاء تصنيف جديد مباشر' : 'Type to lookup or construct new categorization'}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-3">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t.notes}
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder={language === 'ar' ? 'سوبر ماركت، صيدلية طرابلس، الوقود...' : 'e.g., pharmacy item notes...'}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden dark:text-white"
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
                className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Filtering Criteria */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        
        {/* Search */}
        <div className="relative col-span-1 sm:col-span-2">
          <Search className="absolute top-3 right-3.5 text-slate-400 rtl:right-auto rtl:left-3.5 w-4.5 h-4.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchExpense}
            className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl focus:border-rose-500 outline-hidden dark:text-white"
          />
        </div>

        {/* Dropdown Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl outline-hidden dark:text-white"
          >
            <option value="">{t.filterByCategory}</option>
            {categories.filter(c => c.type === 'expense' && !c.parentId).map(parent => (
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

      {/* 4. Expenses Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-850/20">
          <span className="text-xs font-bold text-slate-400 uppercase">
            {language === 'ar' ? 'سجل المصاريف الفعالة' : 'Expense ledger list'}
          </span>
          <span className="text-xs font-bold text-slate-500">
            {filteredExpenses.length} {language === 'ar' ? 'بند' : 'Transactions'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map((exp) => {
              const cat = categories.find(c => c.id === exp.categoryId);
              const catLabel = cat ? cat.name.split(' / ')[language === 'ar' ? 0 : 1] || cat.name : t.none;

              return (
                <div key={exp.id} className="p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-all">
                  
                  {/* Info block */}
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/45 text-rose-500 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {exp.title}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getCatColorClass(cat?.color || 'slate')}`}>
                          {catLabel}
                        </span>
                      </div>

                      {exp.notes && (
                        <p 
                          onClick={() => setExpandedNotesIds(prev => ({ ...prev, [exp.id]: !prev[exp.id] }))}
                          className={`text-xs text-slate-400 dark:text-slate-500 max-w-md cursor-pointer hover:text-slate-600 dark:hover:text-slate-305 transition-colors duration-150 ${expandedNotesIds[exp.id] ? "" : "line-clamp-2"}`}
                          title={language === "ar" ? "اضغط للتوسيع / الطي" : "Click to expand/collapse"}
                        >
                          {exp.notes}
                        </p>
                      )}

                      <div className="flex gap-4 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {exp.date}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Actions */}
                  <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-3 self-stretch sm:self-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                      - {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(exp)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition-colors cursor-pointer"
                        title={t.edit}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          showConfirm(
                            language === 'ar' ? 'حذف المصروف المالي' : 'Delete Expense',
                            language === 'ar' 
                              ? `هل أنت متأكد من حذف هذا المصروف ("${exp.title}") نهائياً؟ لا يمكن التراجع عن هذا الإجراء.` 
                              : `Are you sure you want to delete this expense record ("${exp.title}")? This action cannot be undone.`,
                            async () => {
                              await deleteExpense(exp.id);
                            },
                            'danger'
                          );
                        }}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-450 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
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
