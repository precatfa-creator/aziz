/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Trash2, 
  RotateCcw, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShoppingBag, 
  Users, 
  Search,
  Filter,
  ShieldCheck,
  AlertCircle,
  Wallet,
  MessageSquare
} from 'lucide-react';

export const TrashPage: React.FC = () => {
  const { 
    trashItems, 
    restoreTrashItem, 
    permanentlyDeleteTrashItem, 
    language, 
    t 
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'future_purchase' | 'savings_group' | 'wallet' | 'comment'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Keep a local clock ticking to update count downs in real time
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000); // update every 10 seconds
    return () => clearInterval(timer);
  }, []);

  const getRemainingTime = (deletedAt: Date) => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const expiryTime = deletedAt.getTime() + threeDaysMs;
    const diff = expiryTime - now.getTime();

    if (diff <= 0) {
      return { label: t.lessThanAnHour, isUrgent: true };
    }

    const diffHours = Math.ceil(diff / (1000 * 60 * 60));
    if (diffHours < 24) {
      const hoursString = language === 'ar' 
        ? t.hoursRemaining.replace('{hours}', String(diffHours)) 
        : t.hoursRemaining.replace('{hours}', String(diffHours));
      return { label: hoursString, isUrgent: diffHours <= 6 };
    }

    const diffDays = Math.floor(diffHours / 24);
    const daysString = language === 'ar' 
      ? t.daysRemaining.replace('{days}', String(diffDays))
      : t.daysRemaining.replace('{days}', String(diffDays));
    return { label: daysString, isUrgent: false };
  };

  const getTypeDetails = (type: string) => {
    switch (type) {
      case 'income':
        return {
          icon: ArrowUpRight,
          colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
          label: language === 'ar' ? 'وارد مالي' : 'Income'
        };
      case 'expense':
        return {
          icon: ArrowDownLeft,
          colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
          label: language === 'ar' ? 'مصروف مالي' : 'Expense'
        };
      case 'future_purchase':
        return {
          icon: ShoppingBag,
          colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
          label: language === 'ar' ? 'شراء مخطط' : 'Wishlist item'
        };
      case 'savings_group':
        return {
          icon: Users,
          colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
          label: language === 'ar' ? 'جمعية' : 'Savings Group'
        };
      case 'wallet':
        return {
          icon: Wallet,
          colorClass: 'bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 border-indigo-500/25',
          label: language === 'ar' ? 'محفظة مالية' : 'Wallet'
        };
      case 'comment':
        return {
          icon: MessageSquare,
          colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
          label: language === 'ar' ? 'تعليق مضاف' : 'Comment'
        };
      default:
        return {
          icon: Trash2,
          colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/25',
          label: language === 'ar' ? 'مستند' : 'Document'
        };
    }
  };

  const getDisplayName = (item: any) => {
    const d = item.originalData;
    if (item.originalType === 'future_purchase') {
      return d.itemName || '';
    }
    if (item.originalType === 'comment') {
      return language === 'ar' ? `تعليق مضاف بواسطة ${d.userName || 'مستخدم'}` : `Comment by ${d.userName || 'User'}`;
    }
    return d.title || d.name || '';
  };

  const getDisplayDetails = (item: any) => {
    const d = item.originalData;
    const formattedAmount = d.amount || d.expectedPrice || d.totalAmount || d.initialBalance || 0;
    const currencySuffix = d.currency === 'USD' ? '$' : (language === 'ar' ? 'د.ل' : 'LYD');
    
    let subDetails = '';
    if (item.originalType === 'savings_group') {
      subDetails = language === 'ar' 
        ? `${d.numMembers} أعضاء • ${d.paymentPerMember} ${currencySuffix}/شهرياً`
        : `${d.numMembers} members • ${d.paymentPerMember} ${currencySuffix}/mo`;
    } else if (item.originalType === 'wallet') {
      subDetails = language === 'ar'
        ? `رصيد ابتدائي: ${formattedAmount} ${currencySuffix}`
        : `Initial balance: ${formattedAmount} ${currencySuffix}`;
    } else if (item.originalType === 'comment') {
      subDetails = d.text || '';
    } else {
      subDetails = d.notes ? d.notes : (d.date || '');
    }

    const amountLabel = item.originalType === 'comment'
      ? (language === 'ar' ? 'نص التعليق' : 'Comment text')
      : `${formattedAmount} ${currencySuffix}`;

    return {
      amountLabel,
      subDetails
    };
  };

  // Filter and search elements
  const filteredItems = trashItems.filter(item => {
    const matchesType = typeFilter === 'all' || item.originalType === typeFilter;
    const name = getDisplayName(item).toLowerCase();
    const notes = (item.originalData.notes || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || notes.includes(query) || item.deletedBy.toLowerCase().includes(query);
    return matchesType && matchesSearch;
  });

  const isRTL = language === 'ar';

  return (
    <div className="space-y-6 animate-fade-in" id="trash_page_container">
      {/* Decorative ambient background blur */}
      <div className="absolute top-20 left-1/3 w-72 h-72 bg-rose-400/10 dark:bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-60 right-1/4 w-80 h-80 bg-brand-teal/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Breadcrumb Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 mb-1">
            <Trash2 className="w-5 h-5" />
            <h2 className="text-xl font-black tracking-tight self-center leading-none">
              {t.trash}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {t.trashSubtitle}
          </p>
        </div>
        
        {/* Anti-accidental security status sticker */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-3 flex items-center gap-2.5 max-w-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-tight">
            {isRTL 
              ? 'حماية نشطة ضد الحذف العرضي: يمكنك استعادة أي عنصر مالي بالكامل قبل فوات الأوان.' 
              : 'Accidental loss prevention active. Restore deleted records with intact integrity before expiration.'}
          </p>
        </div>
      </div>

      {/* Control Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 p-4 rounded-3xl shadow-xs">
        {/* Search */}
        <div className="relative md:col-span-5">
          <Search className="absolute top-3.5 left-3.5 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder={isRTL ? 'ابحث في المحذوفات...' : 'Search trashed records...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-bold leading-none bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-slate-700 dark:text-slate-200 outline-hidden focus:border-rose-500/30 dark:focus:border-rose-500/30 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide md:col-span-7">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          {[
            { id: 'all', label: isRTL ? 'الكل' : 'All' },
            { id: 'income', label: isRTL ? 'الدخل' : 'Incomes' },
            { id: 'expense', label: isRTL ? 'المصاريف' : 'Expenses' },
            { id: 'future_purchase', label: isRTL ? 'قائمة الأمنيات' : 'Wishlist' },
            { id: 'savings_group', label: isRTL ? 'الجمعيات' : 'Savings' },
            { id: 'wallet', label: isRTL ? 'المحافظ' : 'Wallets' },
            { id: 'comment', label: isRTL ? 'التعليقات' : 'Comments' },
          ].map((flt) => (
            <button
              key={flt.id}
              onClick={() => setTypeFilter(flt.id as any)}
              className={`px-3 py-2 border rounded-xl text-[11px] font-black shrink-0 transition-all cursor-pointer ${
                typeFilter === flt.id
                  ? 'bg-rose-500 border-rose-500 text-white shadow-xs scale-[1.03]'
                  : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              {flt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trashed Cards List */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-[2.5rem] text-center gap-4">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-700">
            <Trash2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="font-exrabold text-sm text-slate-800 dark:text-slate-200">
              {t.trashEmpty}
            </h3>
            <p className="text-xs text-slate-400 leading-normal">
              {isRTL 
                ? 'أي مصروف، دخل، جمعية، محفظة، تعليق، أو سلعة تخطيطية تقوم بحذفها من التطبيق ستظهر فوراً في هذا المكان لمدة 72 ساعة كشبكة أمان.' 
                : 'Any expense module, income, wishlist element, wallet, comment, or savings group you delete appears right here for 72 hours under safe-custody.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const { icon: TypeIcon, colorClass, label: typeLabel } = getTypeDetails(item.originalType);
            const remaining = getRemainingTime(item.deletedAt);
            const { amountLabel, subDetails } = getDisplayDetails(item);
            const isConfirming = confirmDeleteId === item.id;

            return (
              <div 
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-5 shadow-xs transition-all hover:shadow-md hover:border-slate-200/60 dark:hover:border-slate-800 flex flex-col justify-between gap-4 group"
              >
                {/* Visual Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Circle icon with type colored boundaries */}
                    <div className={`p-2.5 border rounded-2xl ${colorClass}`}>
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div>
                      {/* Original tag title */}
                      <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 leading-tight">
                        {getDisplayName(item)}
                      </h4>
                      {/* Original document type */}
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                        {typeLabel}
                      </span>
                    </div>
                  </div>

                  {/* countdown expiration badge */}
                  <div className={`flex items-center gap-1.5 py-1 px-2.5 rounded-xl border text-[9px] font-black tracking-tight ${
                    remaining.isUrgent
                      ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 animate-pulse'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-850/60 text-slate-500'
                  }`}>
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>{remaining.label}</span>
                  </div>
                </div>

                {/* Amount Display & Metadata */}
                <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100/40 dark:border-slate-850/40 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block leading-tight">
                      {isRTL ? 'القيمة الأصلية' : 'Original Amount'}
                    </span>
                    <strong className="text-sm font-black text-rose-500 dark:text-rose-400">
                      {amountLabel}
                    </strong>
                  </div>

                  <div className="text-right sm:text-start max-w-xs">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 block leading-tight">
                      {isRTL ? 'التفاصيل / الملاحظات' : 'Details / Notes'}
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                      {subDetails}
                    </p>
                  </div>
                </div>

                {/* Deleter Metadata */}
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 dark:text-slate-500 border-t border-slate-50 dark:border-slate-850/60 pt-3">
                  <span className="truncate max-w-[150px]">
                    {isRTL ? 'حذف بواسطة:' : 'Deleted by:'} {item.deletedBy}
                  </span>
                  <span>
                    {isRTL ? 'تاريخ الحذف:' : 'Deleted at:'} {item.deletedAt.toLocaleDateString(language === 'ar' ? 'ar-LY' : 'en-US', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                </div>

                {/* Operations Actions Control Shelf */}
                <div className="flex items-center gap-2 pt-1">
                  {!isConfirming ? (
                    <>
                      {/* Restore */}
                      <button
                        onClick={() => restoreTrashItem(item.id)}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 px-3 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/15 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t.restore}</span>
                      </button>

                      {/* Manual Permanent Delete Confirmation trigger */}
                      <button
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-2 border border-slate-100 hover:border-rose-100 dark:border-slate-800 dark:hover:border-rose-950/40 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/[0.03] rounded-xl cursor-pointer transition-all shrink-0"
                        title={t.permDelete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-2xl p-3 flex flex-col gap-2.5 animate-in slide-in-from-bottom-2 duration-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-rose-700 dark:text-rose-400 font-bold leading-tight">
                          {isRTL 
                            ? 'هل أنت متأكد تماماً من حذف هذا العنصر نهائياً؟ هذا الإجراء لا يمكن التراجع عنه أبداً وسيتم تصفير أي تعليقات مرتبطة.' 
                            : 'Are you absolutely sure about permanent deletion? This action is irreversible and deletes dependent records.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 self-end">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-755 text-slate-600 dark:text-slate-200 py-1 px-2.5 rounded-lg text-[10px] font-black cursor-pointer transition-colors"
                        >
                          {isRTL ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          onClick={async () => {
                            await permanentlyDeleteTrashItem(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white py-1 px-2.5 rounded-lg text-[10px] font-black cursor-pointer transition-colors"
                        >
                          {t.permDelete}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
