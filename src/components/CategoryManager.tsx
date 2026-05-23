/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, X, Tag, Archive, Edit2, AlertCircle, Sparkles, FolderArchive, ArrowRight, Home, Car, ShoppingBag, Heart, Wallet, Coins, Smile, Calendar, RefreshCcw, ChevronDown, ChevronRight, Folder, Trash2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

const iconMap: Record<string, React.ReactNode> = {
  Tag: <Tag className="w-4 h-4" />,
  Coins: <Coins className="w-4 h-4" />,
  Wallet: <Wallet className="w-4 h-4" />,
  ShoppingBag: <ShoppingBag className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  Car: <Car className="w-4 h-4" />,
  Heart: <Heart className="w-4 h-4" />,
  Smile: <Smile className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Calendar: <Calendar className="w-4 h-4" />
};

export const CategoryManager: React.FC = () => {
  const { 
    t, 
    language, 
    categories, 
    incomes, 
    expenses, 
    addCategory, 
    updateCategory, 
    archiveCategory,
    deleteCategory
  } = useApp();


  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState('hsl(0, 85%, 55%)');
  const [hue, setHue] = useState(0);
  const [icon, setIcon] = useState('Tag');
  const [parentId, setParentId] = useState('');

  // AI-Driven Icon Helper
  const getSuggestedIcon = (catName: string, currentIcon: string) => {
    const lowerName = catName.toLowerCase();
    if (lowerName.includes('rent') || lowerName.includes('home') || lowerName.includes('سكن') || lowerName.includes('ايجار')) return 'Home';
    if (lowerName.includes('car') || lowerName.includes('سيارة') || lowerName.includes('fuel') || lowerName.includes('وقود')) return 'Car';
    if (lowerName.includes('shop') || lowerName.includes('تسوق') || lowerName.includes('grocery') || lowerName.includes('بقالة')) return 'ShoppingBag';
    if (lowerName.includes('health') || lowerName.includes('صحة') || lowerName.includes('medical') || lowerName.includes('ادوية')) return 'Heart';
    if (lowerName.includes('salary') || lowerName.includes('راتب') || lowerName.includes('income')) return 'Wallet';
    return currentIcon;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // Auto-suggest icon based on typing
    const newIcon = getSuggestedIcon(newName, icon);
    if (newIcon !== icon) {
      setIcon(newIcon);
    }
  };

  const cycleIcon = () => {
    const currentIndex = ICONS_LIST.indexOf(icon);
    const nextIndex = (currentIndex + 1) % ICONS_LIST.length;
    setIcon(ICONS_LIST[nextIndex]);
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

  const COLOR_PALETTE = [
    { id: 'rose', label: 'Rose', bg: '#f43f5e' },
    { id: 'amber', label: 'Amber', bg: '#f59e0b' },
    { id: 'sky', label: 'Sky Blue', bg: '#0ea5e9' },
    { id: 'orange', label: 'Orange', bg: '#f97316' },
    { id: 'red', label: 'Red', bg: '#ef4444' },
    { id: 'purple', label: 'Purple', bg: '#a855f7' },
    { id: 'violet', label: 'Violet', bg: '#8b5cf6' },
    { id: 'emerald', label: 'Emerald', bg: '#10b981' },
    { id: 'indigo', label: 'Indigo', bg: '#6366f1' },
    { id: 'teal', label: 'Teal', bg: '#14b8a6' }
  ];

  const ICONS_LIST = ['Tag', 'Coins', 'Wallet', 'ShoppingBag', 'Home', 'Car', 'Heart', 'Smile', 'Sparkles', 'Calendar'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      if (editingId) {
        const catObj = categories.find(c => c.id === editingId);
        await updateCategory(editingId, name, type, color, icon, catObj ? catObj.isArchived : false, parentId || null);
      } else {
        await addCategory(name, type, color, icon, parentId || null);
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color);
    
    // Parse hue if available
    let currentHue = 0;
    if (cat.color.startsWith('hsl')) {
      const match = cat.color.match(/hsl\((\d+)/);
      if (match) currentHue = parseInt(match[1]);
    } else {
      // Find approximate hue from legacy color if possible
      const legacyColor = COLOR_PALETTE.find(cp => cp.id === cat.color);
      if (legacyColor) {
        // Just static mapping or default to 0
        if (cat.color === 'rose') currentHue = 345;
        else if (cat.color === 'amber') currentHue = 40;
        else if (cat.color === 'emerald') currentHue = 150;
        else if (cat.color === 'teal') currentHue = 175;
        else if (cat.color === 'sky') currentHue = 195;
        else if (cat.color === 'indigo') currentHue = 230;
      }
    }
    setHue(currentHue);
    
    setIcon(cat.icon || 'Tag');
    setParentId(cat.parentId || '');
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setType('expense');
    setColor('hsl(0, 85%, 55%)');
    setHue(0);
    setIcon('Tag');
    setParentId('');
    setShowForm(false);
  };

  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddChildClick = (parentCat: any) => {
    resetForm();
    setType(parentCat.type);
    setParentId(parentCat.id);
    setShowForm(true);
  };

  // Helper to check if category is linked in ledger transactions (relational lock protection)
  const isLinkedToTransactions = (categoryId: string) => {
    const hasIncome = incomes.some(i => i.categoryId === categoryId);
    const hasExpense = expenses.some(e => e.categoryId === categoryId);
    return hasIncome || hasExpense;
  };

  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const handleCategoryClick = (e: React.MouseEvent, cat: any, hasChildren: boolean) => {
    e.stopPropagation();
    // Toggle actions menu, and also toggle expanded if it's a parent
    if (activeItemId === cat.id) {
      setActiveItemId(null);
    } else {
      setActiveItemId(cat.id);
    }
  };

  const renderCategoryNode = (cat: any, filterType: 'expense' | 'income', isChild: boolean, depth: number) => {
    const children = categories.filter(c => c.parentId === cat.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedCats[cat.id] !== false; // Default to expanded unless explicitly collapsed
    const matchesNum = filterType === 'expense' 
      ? expenses.filter(e => e.categoryId === cat.id).length 
      : incomes.filter(i => i.categoryId === cat.id).length;
      
    const isActive = activeItemId === cat.id;

    // Check if can delete
    const isLinked = isLinkedToTransactions(cat.id);
    const canDelete = !isLinked && !hasChildren;

    return (
      <div key={cat.id} className="flex flex-col relative w-full mb-1">
        <div 
          className={`flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors cursor-pointer select-none ${cat.isArchived ? 'opacity-50' : ''} ${isActive ? 'bg-slate-50 dark:bg-slate-800/60 ring-1 ring-slate-100 dark:ring-slate-700/50' : ''}`}
          onClick={(e) => handleCategoryClick(e, cat, hasChildren)}
        >
          <div className="flex items-center gap-3 flex-1 overflow-hidden">
            <div 
              className={`flex items-center justify-center w-6 h-6 rounded-md text-white shadow-sm shrink-0 flex-shrink-0`}
              style={{ backgroundColor: cat.color.startsWith('hsl') || cat.color.startsWith('#') ? cat.color : COLOR_PALETTE.find(c => c.id === cat.color)?.bg || '#64748b' }}
            >
              {iconMap[cat.icon] || <Tag className="w-3 h-3" />}
            </div>
            
            <div className="flex flex-col truncate">
              <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200 truncate">
                {cat.name.split(' / ')[language === 'ar' ? 0 : 1] || cat.name}
              </span>
              {matchesNum > 0 && (
                <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                  {matchesNum} {language === 'ar' ? 'عمليات' : 'ops'}
                </span>
              )}
            </div>
          </div>

          {/* Actions are always visible when active */}
          {isActive && (
            <div className="flex items-center gap-1 shrink-0 flex-shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg px-1 py-1 animate-in fade-in zoom-in-95 duration-200 shadow-sm border border-slate-100 dark:border-slate-800">
              <button
                onClick={(e) => { e.stopPropagation(); handleAddChildClick(cat); setActiveItemId(null); }}
                className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded text-emerald-600 dark:text-emerald-400 transition-colors"
                title={language === 'ar' ? 'إضافة تصنيف فرعي' : 'Add Sub-category'}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); handleEditClick(cat); setActiveItemId(null); }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded text-slate-500 dark:text-slate-400 transition-colors"
                title={language === 'ar' ? 'تعديل' : 'Edit'}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const nextState = !cat.isArchived;
                  showConfirm(
                    language === 'ar' ? (nextState ? 'أرشفة التصنيف' : 'إلغاء الأرشفة') : (nextState ? 'Archive Category' : 'Dearchive Category'),
                    language === 'ar'
                      ? `هل أنت متأكد من تغيير حالة أرشفة تصنيف "${cat.name.split(' / ')[0] || cat.name}"؟`
                      : `Are you sure you want to toggle the archive state for category "${cat.name.split(' / ')[1] || cat.name}"?`,
                    async () => {
                      await archiveCategory(cat.id, nextState);
                      setActiveItemId(null);
                    },
                    'archive'
                  );
                }}
                className={`p-1.5 rounded transition-colors ${
                  cat.isArchived 
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20' 
                    : 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-500 hover:text-amber-600'
                }`}
                title={cat.isArchived ? 'Dearchive' : 'Archive'}
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
              
              {canDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showConfirm(
                      language === 'ar' ? 'حذف نهائي' : 'Delete Category',
                      language === 'ar'
                        ? `هل أنت متأكد من حذف التصنيف "${cat.name.split(' / ')[0] || cat.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                        : `Are you sure you want to delete category "${cat.name.split(' / ')[1] || cat.name}"? This cannot be undone.`,
                      async () => {
                        await deleteCategory(cat.id);
                        setActiveItemId(null);
                      },
                      'danger'
                    );
                  }}
                  className="p-1.5 rounded transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500 hover:text-rose-600"
                  title={language === 'ar' ? 'حذف' : 'Delete'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          
          {hasChildren && !isActive && (
             <button 
               onClick={(e) => toggleExpand(e, cat.id)}
               className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-auto"
             >
               {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className={`w-4 h-4 ${language === 'ar' ? 'rotate-180' : ''}`} />}
             </button>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className={`relative flex flex-col mt-0.5 ${language === 'ar' ? 'pr-[18px]' : 'pl-[18px]'}`}>
            {/* Vertical connector line for parent to children */}
            <div className={`absolute top-0 bottom-3 w-px bg-slate-200 dark:bg-slate-700/80 ${language === 'ar' ? 'right-[20px]' : 'left-[20px]'}`} />
            
            {children.map((child) => {
              return (
                <div key={child.id} className="relative mt-0.5">
                  {/* Horizontal connector line for each child */}
                  <div className={`absolute top-[18px] w-3 h-px bg-slate-200 dark:bg-slate-700/80 ${language === 'ar' ? 'right-0' : 'left-0'}`} />
                  <div className={`${language === 'ar' ? 'pr-4' : 'pl-4'}`}>
                    {renderCategoryNode(child, filterType, true, depth + 1)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderCategoryTree = (filterType: 'expense' | 'income') => {
    const list = categories.filter(c => c.type === filterType);
    const topLevel = list.filter(c => !c.parentId);

    return topLevel.map(parentCat => renderCategoryNode(parentCat, filterType, false, 0));
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 font-sans">
      
      {/* 1. Header with quick addition toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.categories}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'نظّم وصنّف نفقاتك وإيراداتك بمحاكاة ذكية للتصنيفات الرسمية' : 'Configure official categorize definitions supporting multiple ledger lines'}
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md flex justify-center items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'ar' ? 'إضافة تصنيف رئيسي جديد' : 'Add New Main Category'}</span>
          </button>
        )}
      </div>

      {/* 2. Custom Category Input sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div 
            className="absolute inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm cursor-pointer" 
            onClick={resetForm} 
          />
          
          <div 
            className="relative w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 dark:border-slate-800 shadow-2xl space-y-5 animate-in slide-in-from-bottom-8 zoom-in-95 duration-300"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/50 pb-4">
              <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-500">
                  <Tag className="w-5 h-5" />
                </div>
                {editingId ? t.editCategory : t.addCategoryDirectly}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500">
                    {language === 'ar' ? 'اسم التصنيف (بالعربي أو الإنجليزي)' : 'Category Name (AR or EN)'}
                  </label>
                  <div className="relative">
                    <div 
                      className="absolute top-1.5 left-1.5 rtl:left-auto rtl:right-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 group overflow-hidden shadow-sm"
                      onClick={cycleIcon}
                      title={language === 'ar' ? 'تغيير الأيقونة' : 'Change Icon'}
                    >
                      <span className="scale-110">{iconMap[icon]}</span>
                      {name.length > 0 && (
                        <RefreshCcw className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-1.5 rtl:right-auto rtl:left-1.5 bg-emerald-50 dark:bg-emerald-900 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-800" />
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={handleNameChange}
                      placeholder={language === 'ar' ? 'مثال: السكن، الأدوية، الإيجار...' : 'e.g., Medicals, Commutes...'}
                      className="w-full pl-20 rtl:pl-4 rtl:pr-20 py-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:border-emerald-500 outline-hidden dark:text-white transition-all shadow-sm font-medium placeholder:font-normal"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500">
                    {language === 'ar' ? 'نوع التصنيف الساري' : 'Ledger type'}
                  </label>
                  <div className={`flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl w-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm ${!!parentId ? 'opacity-80' : ''}`}>
                    <button
                      type="button"
                      disabled={!!parentId}
                      onClick={() => setType('expense')}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${type === 'expense' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 opacity-80 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'} ${!!parentId ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {t.expenses}
                    </button>
                    <button
                      type="button"
                      disabled={!!parentId}
                      onClick={() => setType('income')}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${type === 'income' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400 opacity-80 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'} ${!!parentId ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {t.income}
                    </button>
                  </div>
                </div>

                {parentId && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">
                      {language === 'ar' ? 'ينتمي إلى (مجموعة)' : 'Parent Group'}
                    </label>
                    <div className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl text-slate-500 flex items-center gap-3 shadow-sm font-bold">
                      <Folder className="w-5 h-5 text-emerald-500" />
                      {(() => {
                        const parent = categories.find(c => c.id === parentId);
                        if (!parent) return '';
                        return language === 'ar' ? (parent.name.split(' / ')[0] || parent.name) : (parent.name.split(' / ')[1] || parent.name);
                      })()}
                    </div>
                  </div>
                )}

              </div>

              {/* Hue Slider Picker */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 block">
                    {language === 'ar' ? 'اختر لون التصنيف المميز' : 'Choose custom color tint'}
                  </label>
                  <div className="w-8 h-8 rounded-full shadow-md border-2 border-white dark:border-slate-800" style={{ backgroundColor: color }} />
                </div>
                <div className="relative w-full flex items-center justify-center pb-2">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hue}
                    onChange={(e) => {
                      const cur = parseInt(e.target.value);
                      setHue(cur);
                      setColor(`hsl(${cur}, 85%, 55%)`);
                    }}
                    className="color-slider-hue w-full h-3.5 rounded-full appearance-none outline-hidden focus:outline-hidden shadow-inner cursor-pointer"
                    style={{
                      background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
                    }}
                  />
                  <style>{`
                    .color-slider-hue::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 26px;
                      height: 26px;
                      border-radius: 50%;
                      background: ${color};
                      border: 4px solid white;
                      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2);
                      cursor: pointer;
                      transition: transform 0.1s;
                    }
                    .color-slider-hue::-webkit-slider-thumb:hover {
                      transform: scale(1.1);
                    }
                    .color-slider-hue::-moz-range-thumb {
                      width: 26px;
                      height: 26px;
                      border-radius: 50%;
                      background: ${color};
                      border: 4px solid white;
                      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2);
                      cursor: pointer;
                      transition: transform 0.1s;
                    }
                    .color-slider-hue::-moz-range-thumb:hover {
                      transform: scale(1.1);
                    }
                  `}</style>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800/50">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-150 text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Tag className="w-4 h-4" />
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Safety Notice Block */}
      <div className="p-3.5 bg-rose-500/5 rounded-2xl border border-rose-500/10 text-xs text-rose-500 font-bold flex items-center gap-2">
        <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
        <span>
          {language === 'ar' 
            ? 'لحماية السجل التاريخي لحساباتك العزيزة؛ لا يمكن حذف الأقسام المرتبطة بعمليات مسبقة. تتوفر "أرشفة وتجميد التصنيف" كبديل آمن لحمايتها.' 
            : 'Integrity Shield Policy: Categories linked to recorded ledger items cannot be deleted. Arching is provided alternatively.'}
        </span>
      </div>

      {/* 4. Lists separated by Type: Expense or Income */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Expenses categories */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-rose-500 flex items-center gap-2 border-b border-rose-50/50 pb-2">
            <Tag className="w-4 h-4" />
            {t.expenses} {t.categories}
          </h3>

          <div className="space-y-3">
            {renderCategoryTree('expense')}
          </div>
        </div>

        {/* Incomes Categories */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-emerald-500 flex items-center gap-2 border-b border-emerald-50/50 pb-2">
            <Tag className="w-4 h-4" />
            {t.income} {t.categories}
          </h3>

          <div className="space-y-3">
            {renderCategoryTree('income')}
          </div>
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
