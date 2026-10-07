/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../supabase';
import { restoreBackup, type AzizBackup } from '../lib/restoreBackup';
import { backupCounts, buildBackup, downloadBackup } from '../lib/exportBackup';
import { inlineReceiptsForBackup } from '../lib/receiptStorage';
import { countInlineReceipts, rowsNeedingMigration } from '../lib/receiptImages';
import { migrateReceiptsToStorage } from '../lib/migrateReceipts';
import { 
  Settings as SettingsIcon, 
  Languages, 
  Coins, 
  DollarSign, 
  User, 
  ShieldAlert, 
  LogOut, 
  Check, 
  RefreshCw,
  Sun,
  Moon,
  Fingerprint,
  DatabaseBackup,
  KeyRound,
  Download,
  HardDriveUpload
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { PASSKEY_ENABLED } from '../lib/features';

export const Settings: React.FC = () => {
  const { 
    t, 
    language, 
    setLanguage, 
    theme,
    toggleTheme,
    currency, 
    setCurrency, 
    exchangeRate, 
    setExchangeRate, 
    profile, 
    updateProfile, 
    setDefaultExpenseWallet,
    registerPasskey,
    user,
    logout,
    wallets,
    incomes,
    expenses,
    plannedPurchases,
    savingsGroups,
    categories: allCategories
  } = useApp();

  // Profile Form State
  const [profileName, setProfileName] = useState(profile?.name || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const restoreInputRef = React.useRef<HTMLInputElement>(null);

  // Receipts taken before the Storage migration are still Base64 inside the
  // transaction row, so every app start downloads all of them. Counted here so
  // the button can say what it is about to move — and so it disappears once
  // there is nothing left to move.
  const [isMigratingReceipts, setIsMigratingReceipts] = useState(false);
  const [receiptMigrationMessage, setReceiptMigrationMessage] = useState('');
  const inlineReceiptCount = countInlineReceipts([...incomes, ...expenses]);

  // Password change form
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Restore from an old-app JSON export. Destructive: clears current data first
  // (confirmed via dialog), then loads the backup. Reloads the page afterwards
  // so the AppContext bootstrap re-fetches everything cleanly.
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !user) return;

    let backup: AzizBackup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      setRestoreMessage(language === 'ar' ? 'ملف غير صالح — تعذّر قراءة JSON.' : 'Invalid file — could not parse JSON.');
      return;
    }
    const counts = `${backup.wallets?.length || 0} ${language === 'ar' ? 'محفظة' : 'wallets'}, ${backup.incomes?.length || 0} ${language === 'ar' ? 'دخل' : 'incomes'}, ${backup.expenses?.length || 0} ${language === 'ar' ? 'مصروف' : 'expenses'}`;

    showConfirm(
      language === 'ar' ? 'استعادة نسخة احتياطية' : 'Restore Backup',
      language === 'ar'
        ? `سيتم حذف كل بياناتك الحالية واستبدالها بمحتوى الملف (${counts}). لا يمكن التراجع. متابعة؟`
        : `This will delete all your current data and replace it with the file's contents (${counts}). This cannot be undone. Continue?`,
      async () => {
        setIsRestoring(true);
        setRestoreMessage('');
        try {
          const r = await restoreBackup(backup, user.id, supabase);
          setRestoreMessage(
            language === 'ar'
              ? `تمت الاستعادة: ${r.wallets} محفظة، ${r.categories} تصنيف، ${r.incomes} دخل، ${r.expenses} مصروف. جاري إعادة التحميل...`
              : `Restored: ${r.wallets} wallets, ${r.categories} categories, ${r.incomes} incomes, ${r.expenses} expenses. Reloading...`,
          );
          setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
          setRestoreMessage((language === 'ar' ? 'فشلت الاستعادة: ' : 'Restore failed: ') + (err.message || err));
        } finally {
          setIsRestoring(false);
        }
      },
      'danger',
      language === 'ar' ? 'حذف واستعادة' : 'Wipe & Restore',
    );
  };

  // Full backup: same JSON shape the restore above reads, so it round-trips.
  // Receipts live in Storage now, so they are pulled back inline first —
  // exporting bare object paths would produce a file that restores to nothing
  // in any other account.
  const handleDownloadBackup = async () => {
    let inlinedIncomes = incomes;
    let inlinedExpenses = expenses;
    try {
      setBackupMessage(language === 'ar' ? 'جارٍ تجهيز المرفقات...' : 'Collecting receipts...');
      [inlinedIncomes, inlinedExpenses] = await Promise.all([
        inlineReceiptsForBackup(incomes),
        inlineReceiptsForBackup(expenses),
      ]);
    } catch (e) {
      console.error('Backup aborted: receipts could not be collected', e);
      setBackupMessage(
        language === 'ar'
          ? 'تعذّر تنزيل النسخة: لم يتم جلب بعض المرفقات. لم يُحفظ أي ملف.'
          : 'Backup cancelled: some receipts could not be fetched. No file was written.',
      );
      return;
    }

    const backup = buildBackup({
      profile,
      language,
      currency,
      exchangeRate,
      theme,
      wallets,
      categories: allCategories,
      incomes: inlinedIncomes,
      expenses: inlinedExpenses,
      plannedPurchases,
      savingsGroups,
    });
    const c = backupCounts(backup);
    downloadBackup(backup);
    setBackupMessage(
      language === 'ar'
        ? `تم تنزيل النسخة: ${c.wallets} محفظة، ${c.categories} تصنيف، ${c.incomes} دخل، ${c.expenses} مصروف، ${c.plannedPurchases} مشترى مخطط، ${c.savingsGroups} جمعية.`
        : `Backup downloaded: ${c.wallets} wallets, ${c.categories} categories, ${c.incomes} incomes, ${c.expenses} expenses, ${c.plannedPurchases} planned purchases, ${c.savingsGroups} savings groups.`,
    );
  };

  // Moves legacy inline receipts into the Storage bucket. Re-runnable: it only
  // touches rows that still hold Base64, so restoring an older backup and
  // pressing this again works. Reloads afterwards because every migrated row is
  // now stale in memory.
  const handleMigrateReceipts = async () => {
    if (!user) return;
    setIsMigratingReceipts(true);
    setReceiptMigrationMessage(
      language === 'ar' ? 'جارٍ نقل المرفقات...' : 'Moving receipts to storage...',
    );
    try {
      const r = await migrateReceiptsToStorage(
        user.id,
        rowsNeedingMigration(incomes),
        rowsNeedingMigration(expenses),
      );
      setReceiptMigrationMessage(
        language === 'ar'
          ? `تم نقل ${r.receipts} مرفقًا في ${r.migrated} حركة.${r.failed ? ` تعذّر نقل ${r.failed} حركة — أعد المحاولة.` : ' جارٍ إعادة التحميل...'}`
          : `Moved ${r.receipts} receipts across ${r.migrated} transactions.${r.failed ? ` ${r.failed} transaction(s) failed — run it again.` : ' Reloading...'}`,
      );
      if (r.migrated > 0 && r.failed === 0) setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error('Receipt migration failed', e);
      setReceiptMigrationMessage(
        language === 'ar' ? 'فشل نقل المرفقات.' : 'Receipt migration failed.',
      );
    } finally {
      setIsMigratingReceipts(false);
    }
  };

  // Sets a new password for the already-signed-in user. No email round trip:
  // Supabase authorises this off the live session.
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    if (newPassword.length < 8) {
      setPasswordMessage(
        language === 'ar' ? 'كلمة المرور يجب ألا تقل عن 8 أحرف.' : 'Password must be at least 8 characters.',
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage(language === 'ar' ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }
    setIsChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChangingPassword(false);
    if (error) {
      setPasswordMessage((language === 'ar' ? 'فشل التغيير: ' : 'Change failed: ') + error.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage(language === 'ar' ? 'تم تحديث كلمة المرور بنجاح.' : 'Password updated successfully.');
  };

  const handleRegisterPasskey = async () => {
    setPasskeyMessage('');
    try {
      await registerPasskey();
      setPasskeyMessage(language === 'ar' ? 'تم تفعيل الدخول بالبصمة على هذا الجهاز!' : 'Fingerprint sign-in enabled on this device!');
    } catch (err: any) {
      setPasskeyMessage(err.message || (language === 'ar' ? 'فشل تفعيل البصمة' : 'Failed to enable fingerprint sign-in'));
    }
  };


  // ConfirmModal states
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info' | 'archive';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger',
    confirmText: undefined
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' | 'archive' = 'danger',
    confirmText?: string
  ) => {
    setConfirmModalState({
      isOpen: true,
      title,
      message,
      onConfirm,
      type,
      confirmText
    });
  };

  // Exchange Rate input and local validation state
  const [rateInput, setRateInput] = useState(exchangeRate.toString());
  const [rateError, setRateError] = useState<string | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    try {
      await updateProfile({ name: profileName.trim() });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRateChange = (valStr: string) => {
    setRateInput(valStr);
    const numeric = parseFloat(valStr);
    if (isNaN(numeric) || numeric <= 0) {
      setRateError(language === 'ar' ? 'سعر الصرف يجب أن يكون رقماً عشرياً موجباً.' : 'Exchange rate must be a positive decimal.');
    } else {
      setRateError(null);
      // Persist modifier
      setExchangeRate(numeric);
    }
  };

  const handleClearCache = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache', err);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 font-sans">
      
      {/* 1. Header Section */}
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.settings}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'قم بتعديل خيارات اللغة والعملة وسعر الصرف المالي للمحفظة' : 'Configure languages, currencies, and translation exchange coefficients'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Core Profile setup */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-500" />
              {t.profileSection}
            </h3>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    {language === 'ar' ? 'الاسم بالكامل' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-550">
                    {language === 'ar' ? 'البريد الإلكتروني (غير قابل للتعديل)' : 'Email (Read Only)'}
                  </label>
                  <input
                    type="email"
                    disabled
                    value={profile?.email || ''}
                    className="px-3 py-2.5 text-sm bg-slate-100 dark:bg-slate-950 border border-slate-150 rounded-xl outline-hidden text-slate-400 cursor-not-allowed"
                  />
                </div>

              </div>

              <div className="flex items-center justify-between pt-2">
                {saveSuccess && (
                  <span className="text-xs text-emerald-500 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    {language === 'ar' ? 'تم الحفظ والمزامنة بنجاح!' : 'Profile saved successfully!'}
                  </span>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer transition-transform duration-100"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>

          {/* Currency Preferences Config Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-500" />
              {language === 'ar' ? 'تفضيلات العملة و النقدية' : 'Currency & Cashflow Preferences'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Default filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'العملة الأساسية للحسابات' : 'Default Currency'}
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as any)}
                  className="px-3 py-2.5 text-sm bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/50 outline-hidden dark:text-white transition-all appearance-none cursor-pointer"
                >
                  <option value="LYD">LYD (د.ل)</option>
                  <option value="USD">USD ($)</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  {language === 'ar' ? 'سيتم استخدامها لحساب التقارير الدورية افتراضياً.' : 'Used for calculating default statement summary panels.'}
                </p>
              </div>

              {/* Conversion Factor setting fields */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'سعر صرف دولار/دينار يدوي (1 دولار = ؟ د.ل)' : 'Manual conversion coefficient (1 USD = ? LYD)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={rateInput}
                  onChange={e => handleRateChange(e.target.value)}
                  className={`px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border rounded-xl focus:border-emerald-500 outline-hidden dark:text-white ${rateError ? 'border-rose-500' : 'border-slate-200'}`}
                />
                
                {rateError ? (
                  <span className="text-[10px] font-bold text-rose-500 block">{rateError}</span>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    {language === 'ar' ? 'لتتبع دقيق لأصولك المدمجة بناءً على أسعار السوق الموازية.' : 'Allows smart merged calculations reflecting parallel bank rates.'}
                  </p>
                )}
              </div>

              {/* Default Wallet for Expense Transactions */}
              <div className="flex flex-col gap-1.5 sm:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {language === 'ar' ? 'المحفظة الافتراضية للمصروفات' : 'Default Wallet for Expense Transactions'}
                </label>
                <select
                  value={profile?.defaultExpenseWalletId || ''}
                  onChange={async e => {
                    try {
                      await setDefaultExpenseWallet(e.target.value);
                    } catch (err) {
                      console.error("Failed to update default wallet:", err);
                    }
                  }}
                  className="px-3 py-2.5 text-sm bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/50 outline-hidden dark:text-white transition-all appearance-none cursor-pointer"
                >
                  <option value="">
                    {language === 'ar' ? '— اختر محفظة افتراضية (اختياري) —' : '— Select Default Wallet (Optional) —'}
                  </option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency === 'USD' ? '$' : 'د.ل'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400">
                  {language === 'ar' ? 'سيتم اختيار هذه المحفظة تلقائياً عند إضافة مصروف جديد.' : 'This wallet will be pre-selected automatically when creating a new expense transaction.'}
                </p>
              </div>

            </div>
          </div>


        </div>

        {/* Right column: Language Selector and quick settings */}
        <div className="space-y-6">
          
          {/* Display Preferences Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Languages className="w-5 h-5 text-emerald-500" />
              {language === 'ar' ? 'خيارات العرض' : 'Display Preferences'}
            </h3>

            <div className="space-y-5">
              {/* Language Settings */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">
                  {language === 'ar' ? 'لغة الواجهة' : 'Interface Language'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setLanguage('ar')}
                    className={`py-3 font-black text-xs rounded-xl border cursor-pointer transition-colors ${
                      language === 'ar'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    العربية (RTL)
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`py-3 font-semibold text-xs rounded-xl border cursor-pointer transition-colors ${
                      language === 'en'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    English (LTR)
                  </button>
                </div>
              </div>

              {/* Theme Settings */}
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">
                  {language === 'ar' ? 'مظهر التطبيق' : 'Theme Mode'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => theme !== 'light' && toggleTheme()}
                    className={`py-3 font-black text-xs rounded-xl border cursor-pointer transition-colors flex items-center justify-center gap-2 ${
                      theme === 'light'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    {language === 'ar' ? 'فاتح' : 'Light'}
                  </button>
                  <button
                    onClick={() => theme !== 'dark' && toggleTheme()}
                    className={`py-3 font-black text-xs rounded-xl border cursor-pointer transition-colors flex items-center justify-center gap-2 ${
                      theme === 'dark'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    {language === 'ar' ? 'داكن' : 'Dark'}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 text-center leading-relaxed mt-2">
              {language === 'ar' ? 'تبديل اتجاه ومفردات التطبيق ومظهره فوري ومتناسق ١٠٠٪.' : 'Instantly flips entire interface direction, copywriting, and theme.'}
            </p>
          </div>

          {/* Quick Stats System Information */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150/40 rounded-3xl p-6 space-y-4">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5 text-indigo-500" />
              {language === 'ar' ? 'الحساب والأمان' : 'Account & Security'}
            </h4>

            {/* Change password — Supabase authorises this off the live session */}
            <form onSubmit={handleChangePassword} className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                {language === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={language === 'ar' ? 'كلمة مرور جديدة (8 أحرف على الأقل)' : 'New password (min 8 characters)'}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder={language === 'ar' ? 'تأكيد كلمة المرور' : 'Confirm password'}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isChangingPassword || !newPassword || !confirmPassword}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <KeyRound className="w-4 h-4" />
                <span>
                  {isChangingPassword
                    ? (language === 'ar' ? 'جارٍ التحديث...' : 'Updating...')
                    : (language === 'ar' ? 'تحديث كلمة المرور' : 'Update Password')}
                </span>
              </button>
              {passwordMessage && (
                <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400">{passwordMessage}</p>
              )}
            </form>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleDownloadBackup}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-transform shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>{language === 'ar' ? 'تنزيل نسخة احتياطية كاملة (JSON)' : 'Download Full Backup (JSON)'}</span>
              </button>
              {backupMessage && (
                <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{backupMessage}</p>
              )}

              {inlineReceiptCount > 0 && (
                <>
                  <button
                    onClick={handleMigrateReceipts}
                    disabled={isMigratingReceipts}
                    className="w-full py-3 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal border border-brand-teal/20 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-transform shadow-xs"
                  >
                    <HardDriveUpload className="w-4 h-4" />
                    <span>
                      {language === 'ar'
                        ? `نقل ${inlineReceiptCount} مرفقًا إلى التخزين — يسرّع فتح التطبيق`
                        : `Move ${inlineReceiptCount} receipts to storage — speeds up app loading`}
                    </span>
                  </button>
                  {receiptMigrationMessage && (
                    <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{receiptMigrationMessage}</p>
                  )}
                </>
              )}

              {PASSKEY_ENABLED && (
                <>
                  <button
                    onClick={handleRegisterPasskey}
                    className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-transform shadow-xs"
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>{language === 'ar' ? 'تفعيل الدخول بالبصمة لهذا الجهاز' : 'Enable Fingerprint Sign-In for this device'}</span>
                  </button>
                  {passkeyMessage && (
                    <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400">{passkeyMessage}</p>
                  )}
                </>
              )}

              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleRestoreFile}
                className="hidden"
              />
              <button
                onClick={() => restoreInputRef.current?.click()}
                disabled={isRestoring}
                className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-transform shadow-xs"
              >
                <DatabaseBackup className="w-4 h-4" />
                <span>{isRestoring ? (language === 'ar' ? 'جارٍ الاستعادة...' : 'Restoring...') : (language === 'ar' ? 'استعادة نسخة احتياطية (JSON)' : 'Restore from Backup (JSON)')}</span>
              </button>
              {restoreMessage && (
                <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{restoreMessage}</p>
              )}

              <button
                onClick={handleClearCache}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-transform shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{language === 'ar' ? 'تحديث التطبيق ومسح التخزين' : 'Force Update & Clear Cache'}</span>
              </button>

              <button
                onClick={() => {
                  showConfirm(
                    language === 'ar' ? 'تسجيل الخروج' : 'Sign Out',
                    language === 'ar' 
                      ? 'هل أنت متأكد من تسجيل خروجك من حسابك الحالي والعودة لصفحة الدخول؟' 
                      : 'Are you sure you want to sign out from your current wallet session?',
                    () => {
                      logout();
                    },
                    'warning',
                    language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'
                  );
                }}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-transform shadow-xs"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.signOut}</span>
              </button>
            </div>
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
        confirmText={confirmModalState.confirmText}
      />
    </div>
  );
};
