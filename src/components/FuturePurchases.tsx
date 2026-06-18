/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  ShoppingBag, 
  AlertCircle, 
  Calendar, 
  FileText, 
  TrendingUp, 
  ArrowRightLeft, 
  X,
  Sparkles,
  Tag,
  Layers
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const FuturePurchases: React.FC = () => {
  const { 
    t, 
    language, 
    plannedPurchases, 
    categories, 
    addFuturePurchase, 
    updateFuturePurchase, 
    deleteFuturePurchase, 
    convertPurchaseToExpense,
    addCategory
  } = useApp();

  // Dialog & Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [itemName, setItemName] = useState('');
  const [expectedPrice, setExpectedPrice] = useState('');
  const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
  const [expectedDate, setExpectedDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [notes, setNotes] = useState('');

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
  const availableCategories = categories.filter(c => (c.type === 'purchase' || c.type === 'expense') && !c.isArchived);
  
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

  const addCategoryDirectly = async (catName: string) => {
    try {
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

  // Conversion trigger
  const [convertingItem, setConvertingItem] = useState<any | null>(null);
  const [actualPrice, setActualPrice] = useState('');
  const [actualDate, setActualDate] = useState(new Date().toISOString().split('T')[0]);
  // Notes expand state by item ID
  const [expandedNotesIds, setExpandedNotesIds] = useState<Record<string, boolean>>({});

  // Sorters / Filters
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'pending' | 'purchased'>('pending');
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'history'>('overview');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !expectedPrice) return;
    const priceNum = parseFloat(expectedPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    try {
      if (editingId) {
        await updateFuturePurchase(
          editingId,
          itemName,
          priceNum,
          currency,
          expectedDate || undefined,
          priority,
          selectedCatId || undefined,
          notes || undefined
        );
      } else {
        await addFuturePurchase(
          itemName,
          priceNum,
          currency,
          expectedDate || undefined,
          priority,
          selectedCatId || undefined,
          notes || undefined
        );
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (fp: any) => {
    setEditingId(fp.id);
    setItemName(fp.itemName);
    setExpectedPrice(fp.expectedPrice.toString());
    setCurrency(fp.currency);
    setExpectedDate(fp.expectedDate || '');
    setPriority(fp.priority);
    setSelectedCatId(fp.categoryId || '');
    const catObj = categories.find(c => c.id === fp.categoryId);
    if (catObj) {
      setTypedCategoryQuery(getFullCategoryName(catObj));
    } else {
      setTypedCategoryQuery('');
    }
    setNotes(fp.notes || '');
    setShowForm(true);
    setActiveSubTab('overview');
  };

  const resetForm = () => {
    setEditingId(null);
    setItemName('');
    setExpectedPrice('');
    setCurrency('LYD');
    setExpectedDate('');
    setPriority('medium');
    setSelectedCatId('');
    setTypedCategoryQuery('');
    setNotes('');
    setShowForm(false);
  };

  // Convert submission
  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingItem || !actualPrice) return;
    const finalPrice = parseFloat(actualPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) return;

    // Resolve category or match expense categories
    const catId = convertingItem.categoryId || categories.find(c => c.type === 'expense')?.id || '';

    try {
      await convertPurchaseToExpense(convertingItem.id, finalPrice, actualDate, catId, `Converted planned purchase: ${convertingItem.itemName}`);
      setConvertingItem(null);
      setActualPrice('');
    } catch (err) {
      console.error(err);
    }
  };

  // Planned totals calculations (separated)
  const totalPlannedLYD = plannedPurchases
    .filter(p => !p.isPurchased && p.currency === 'LYD')
    .reduce((acc, curr) => acc + curr.expectedPrice, 0);

  const totalPlannedUSD = plannedPurchases
    .filter(p => !p.isPurchased && p.currency === 'USD')
    .reduce((acc, curr) => acc + curr.expectedPrice, 0);

  // Filters application
  const filteredPurchases = plannedPurchases.filter(p => {
    const matchPriority = priorityFilter === 'all' ? true : p.priority === priorityFilter;
    const matchCompletion = completionFilter === 'all' 
      ? true 
      : (completionFilter === 'purchased' ? p.isPurchased : !p.isPurchased);
    return matchPriority && matchCompletion;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16 font-sans">
      
      {/* Top navigation tabs */}
      <div className="flex justify-center mt-2 mb-6">
        <div className="inline-flex p-1.5 bg-slate-100/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/40 dark:border-slate-800/60 w-full max-w-md relative shadow-sm">
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-white dark:bg-slate-850 text-brand-slate dark:text-white shadow-md font-black'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold'
            }`}
          >
            <ShoppingBag className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'overview' ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span>{language === 'ar' ? 'التخطيط' : 'Planning'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-white dark:bg-slate-850 text-brand-slate dark:text-white shadow-md font-black'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'history' ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span>{language === 'ar' ? 'سجل المشتريات' : 'History'}</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'overview' ? (
        <div className="space-y-6 animate-fade-in">
          {/* 1. Header and quick add button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.purchasesTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'خطط لمشترياتك المستقبلية ورتب أولوياتها قبل الشراء' : 'Map and schedule future wishlist assets before buying'}
          </p>
        </div>

        {!showForm && !convertingItem && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex justify-center items-center gap-2 cursor-pointer transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addPurchase}</span>
          </button>
        )}
      </div>


      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-850 shadow-2xl overflow-hidden animate-in slide-in-from-top duration-300">
          
          {/* Header */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-teal/10 dark:bg-brand-teal/25 text-brand-teal rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-none">
                  {editingId ? t.editPurchase : t.addPurchase}
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1">
                  {language === 'ar' ? 'حدد خطتك الشرائية بدقة هنا' : 'Define your acquisition plans and budgets below'}
                </p>
              </div>
            </div>
            <button
              onClick={resetForm}
              className="p-1.5 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* A. HERO EXPECTED PRICE BOX */}
            <div className="p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 flex flex-col items-center justify-center gap-4">
              <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">
                {language === 'ar' ? 'السعر التقديري المتوقع' : 'Expected Targeted Budget Amount'}
              </label>
              
              <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                <input
                  type="number"
                  step="any"
                  required
                  value={expectedPrice}
                  onChange={e => setExpectedPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-center text-4xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-white bg-transparent border-0 outline-hidden focus:ring-0 focus:outline-hidden"
                  autoFocus
                />

                {/* Segmented Currency Controller */}
                <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/20 w-fit">
                  <button
                    type="button"
                    onClick={() => setCurrency('LYD')}
                    className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all duration-300 cursor-pointer ${
                      currency === 'LYD'
                        ? 'bg-brand-slate text-white dark:bg-white dark:text-brand-slate shadow-xs'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    LYD (د.ل)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all duration-300 cursor-pointer ${
                      currency === 'USD'
                        ? 'bg-brand-slate text-white dark:bg-white dark:text-brand-slate shadow-xs'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    USD ($)
                  </button>
                </div>
              </div>
            </div>

            {/* B. ITEM NAME & CATEGORY ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Item Name Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>{t.itemName}</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: لابتوب برمجة جديد، طقم إطارات سيارة...' : 'e.g., iPhone 17 Pro Max...'}
                    className="w-full px-4 py-3.5 text-xs font-bold bg-slate-50/75 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl outline-hidden focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
                <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'التصنيف المجموعي' : 'Target Category classification'}
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
                    placeholder={language === 'ar' ? 'اختر تصنيفاً يسهل ربطه لاحقاً أو اكتب لإنشاء جديد...' : 'Choose matching classification category or type to construct...'}
                    className="w-full px-4 py-3.5 text-xs font-bold bg-slate-50/75 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl outline-hidden focus:border-brand-teal dark:text-white"
                  />
                  <Tag className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 w-4 h-4 text-slate-400" />
                </div>

                {dropdownOpen && (
                  <div 
                    className="absolute top-20 left-0 right-0 max-h-56 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl shadow-xl z-50 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in duration-100"
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
                        onClick={() => addCategoryDirectly(typedCategoryQuery)}
                        className="w-full px-4 py-3 text-start text-xs font-bold text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{language === 'ar' ? 'إضافة تصنيف جديد مباشر' : 'Quick Create Category'}: "{typedCategoryQuery}"</span>
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

            </div>

            {/* C. EXPECTED DATE & VISUAL PRIORITY CHIPS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Expected Date Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.expectedDate} ({language === 'ar' ? 'اختياري' : 'Optional'})</span>
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={e => setExpectedDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/75 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl outline-hidden focus:border-brand-teal dark:text-white text-xs font-bold"
                />
              </div>

              {/* Priority Chips Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                  {t.priority}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => {
                    const isSelected = priority === p;
                    let colorClasses = '';
                    let label = '';
                    
                    if (p === 'high') {
                      label = t.high;
                      colorClasses = isSelected 
                        ? 'bg-rose-500 text-white border-transparent shadow-md'
                        : 'bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 border-rose-500/20';
                    } else if (p === 'medium') {
                      label = t.medium;
                      colorClasses = isSelected
                        ? 'bg-amber-500 text-slate-900 border-transparent shadow-md'
                        : 'bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 border-amber-500/20';
                    } else {
                      label = t.low;
                      colorClasses = isSelected
                        ? 'bg-blue-500 text-white border-transparent shadow-md'
                        : 'bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 border-blue-500/20';
                    }

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`py-3 text-xs font-black rounded-xl border transition-all text-center cursor-pointer ${colorClasses}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* D. NOTES EXPLANATION */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                {t.notes}
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder={t.purchaseNotesPlaceholder}
                className="w-full px-4 py-3 bg-slate-50/75 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl outline-hidden focus:border-brand-teal dark:text-white text-xs font-bold resize-none"
              />
            </div>

            {/* E. FOOTER BUTTONS */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-50 dark:border-slate-800/60">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-8 py-3.5 bg-brand-teal hover:bg-brand-teal/92 text-slate-900 dark:text-slate-900 font-black text-xs rounded-xl shadow-lg shadow-brand-teal/10 cursor-pointer transform hover:scale-[1.01] active:scale-95 transition-all"
              >
                {t.save}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* 2. Settle Totals Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-xs flex justify-between items-center relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold block">
              {t.plannedTotalSpending} (د.ل)
            </span>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
              {totalPlannedLYD.toLocaleString(undefined, { minimumFractionDigits: 2 })} {t.lydSymbol}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-xs flex justify-between items-center relative overflow-hidden">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-bold block">
              {t.plannedTotalSpending} ($)
            </span>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
              {totalPlannedUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} $
            </h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
        </div>

      </div>

        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">

      {/* 4. Convert To Expense form Sheet Overlay */}
      {convertingItem && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-rose-100 dark:border-rose-950/40 shadow-xl space-y-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex justify-between items-center border-b border-rose-50 dark:border-rose-950/20 pb-3">
            <h3 className="font-extrabold text-sm text-rose-500 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 animate-pulse" />
              {t.convertToExpense} : "{convertingItem.itemName}"
            </h3>
            <button
              onClick={() => setConvertingItem(null)}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleConvertSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-550 dark:text-slate-400">
                {language === 'ar' ? 'السعر الفعلي للشراء' : 'Actual spent price'}
              </label>
              <input
                type="number"
                step="any"
                required
                value={actualPrice}
                onChange={e => setActualPrice(e.target.value)}
                placeholder={convertingItem.expectedPrice.toString()}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-550 dark:text-slate-400">
                {language === 'ar' ? 'تاريخ الشراء الفعلي' : 'Actual purchase date'}
              </label>
              <input
                type="date"
                required
                value={actualDate}
                onChange={e => setActualDate(e.target.value)}
                className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-rose-500 outline-hidden dark:text-white"
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setConvertingItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-150 text-xs font-semibold rounded-lg"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                {language === 'ar' ? 'تأكيد الخصم المالي' : 'Confirm Purchase Dues'}
              </button>
            </div>
          </form>
        </div>
      )}

          {/* 5. Filters Rail */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
        
        {/* State filters */}
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
          {[
            { id: 'pending', label: language === 'ar' ? 'قيد التخطيط' : 'Planned' },
            { id: 'purchased', label: language === 'ar' ? 'تم شراؤها' : 'Purchased' },
            { id: 'all', label: t.all }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setCompletionFilter(opt.id as any)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                completionFilter === opt.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-650'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Priority Sorter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold uppercase">
            {t.priorityLabel}:
          </span>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl outline-hidden dark:text-white"
          >
            <option value="all">{t.all}</option>
            <option value="high">{t.high}</option>
            <option value="medium">{t.medium}</option>
            <option value="low">{t.low}</option>
          </select>
        </div>

      </div>

      {/* 6. List and grid of wish purchases */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredPurchases.length > 0 ? (
          filteredPurchases.map((item) => {
            const priorityStyles = {
              high: { 
                card: 'border-rose-100 dark:border-rose-950/40 bg-rose-50/10',
                badge: 'bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
              },
              medium: {
                card: 'border-amber-100 dark:border-amber-950/40 bg-amber-50/10',
                badge: 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
              },
              low: {
                card: 'border-slate-100 dark:border-slate-800 bg-slate-50/10',
                badge: 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400'
              }
            };

            const styles = priorityStyles[item.priority];

            return (
              <div 
                key={item.id} 
                className={`flex flex-col p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xs justify-between gap-4 relative overflow-hidden group min-h-[220px] transition-transform ${item.isPurchased ? 'opacity-55' : ''} ${styles.card}`}
              >
                {/* Completion Checkmark */}
                {item.isPurchased && (
                  <div className="absolute top-3 right-3 text-emerald-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}

                {/* Top: title and priority */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider ${styles.badge}`}>
                      {t[item.priority]}
                    </span>
                    
                    {!item.isPurchased && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditClick(item)}
                          className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-455"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            showConfirm(
                              language === 'ar' ? 'حذف من قائمة الأمنيات' : 'Remove Wishlist Item',
                              language === 'ar'
                                ? `هل أنت متأكد من حذف غرض الشراء المخطط "${item.itemName}" من قائمة أمنياتك؟`
                                : `Are you sure you want to permanently delete "${item.itemName}" from your wishlist?`,
                              async () => {
                                await deleteFuturePurchase(item.id);
                              },
                              'danger'
                            );
                          }}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="font-exrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                    {item.itemName}
                  </h3>

                  {item.notes && (
                    <p 
                      onClick={() => setExpandedNotesIds(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                      className={`text-xs text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-305 transition-colors duration-150 ${expandedNotesIds[item.id] ? "" : "line-clamp-2"}`}
                      title={language === "ar" ? "اضغط للتوسيع / الطي" : "Click to expand/collapse"}
                    >
                      {item.notes}
                    </p>
                  )}
                </div>

                {/* Middle: Details expected date */}
                {item.expectedDate && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t.expectedDate}: {item.expectedDate}</span>
                  </div>
                )}

                {/* Bottom: convert triggers */}
                <div className="border-t border-slate-100 dark:border-slate-805 pt-4 flex items-center justify-between gap-2 mt-auto">
                  <span className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white">
                    {item.expectedPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} {item.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                  </span>

                  {!item.isPurchased ? (
                    <button
                      onClick={() => {
                        setConvertingItem(item);
                        setActualPrice(item.expectedPrice.toString());
                      }}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-transform duration-100"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{t.convertToExpense}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 block italic">
                      {language === 'ar' ? 'تم شراؤها بنجاح' : 'Success fully purchased ✓'}
                    </span>
                  )}
                </div>

              </div>
            );
          })
        ) : (
          <div className="col-span-1 md:col-span-3 text-center py-16 text-xs text-slate-400 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl">
            {language === 'ar' ? 'لا توجد مشتريات تطابق معايير البحث حلياً.' : 'No wishlist items budgeting matches target.'}
          </div>
        )}
      </div>
        </div>
      )}

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
