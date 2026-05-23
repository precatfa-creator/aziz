/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Settings as SettingsIcon, Languages, Coins, DollarSign, User, ShieldAlert, Sparkles, LogOut, Check, RefreshCw } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export const Settings: React.FC = () => {
  const { 
    t, 
    language, 
    setLanguage, 
    currency, 
    setCurrency, 
    exchangeRate, 
    setExchangeRate, 
    profile, 
    updateProfile, 
    logout 
  } = useApp();

  // Profile Form State
  const [profileName, setProfileName] = useState(profile?.name || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

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

            </div>
          </div>

        </div>

        {/* Right column: Language Selector and quick settings */}
        <div className="space-y-6">
          
          {/* Language Selector Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Languages className="w-5 h-5 text-emerald-500" />
              {t.language}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLanguage('ar')}
                className={`py-3 font-black text-xs rounded-xl border cursor-pointer transition-colors ${
                  language === 'ar'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                العربية (RTL)
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`py-3 font-semibold text-xs rounded-xl border cursor-pointer transition-colors ${
                  language === 'en'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-605'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                English (LTR)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center leading-relaxed">
              {language === 'ar' ? 'تبديل اتجاه ومفردات التطبيق فوري ومتناسق ١٠٠٪.' : 'Instantly flips entire interface direction and copywriting.'}
            </p>
          </div>

          {/* Quick Stats System Information */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150/40 rounded-3xl p-6 space-y-4">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5 text-indigo-505" />
              {language === 'ar' ? 'تفاصيل المزامنة العزيزة' : 'Sync Integration Details'}
            </h4>

            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Database Client:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Firestore (Rules v2)</span>
              </div>
              <div className="flex justify-between">
                <span>Auth Provider:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Firebase Native auth</span>
              </div>
              <div className="flex justify-between">
                <span>Secure Isolation:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">Confirmed ✓</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
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
                      ? 'هل أنت متأكد من تسجيل خروجك من محفظتك الحالية والعودة لصفحة الدخول؟' 
                      : 'Are you sure you want to sign out from your current wallet session?',
                    () => {
                      logout();
                    },
                    'warning'
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
      />
    </div>
  );
};
