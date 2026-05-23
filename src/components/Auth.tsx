/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { Wallet, Globe, Shield, Coins, Sparkles, TrendingUp } from 'lucide-react';

export const Auth: React.FC = () => {
  const { loginWithGoogle, language, updatePreferences, t } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      {/* Top language switch */}
      <div className="absolute top-6 right-6 left-6 flex justify-center items-center max-w-7xl mx-auto w-full px-4">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 text-white p-2 rounded-xl flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white transition-colors">
            {language === 'ar' ? 'عزيز | Aziz' : 'Aziz | عزيز'}
          </span>
        </div>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center mt-12">
        {/* Left Side: Illustration / Brand intro */}
        <div className="md:col-span-7 flex flex-col justify-center space-y-6 text-slate-800 dark:text-slate-100 p-4 md:p-8">
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-slate-950 dark:text-white">
              {language === 'ar' ? (
                <span>ترتيب أمورك المالية، صار <span className="text-emerald-500 font-black">أسهل مع عزيز</span></span>
              ) : (
                <span>Organize your finances, <span className="text-emerald-500 font-extrabold">made easy with Aziz</span></span>
              )}
            </h1>
          </div>
          
          <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg max-w-lg leading-relaxed">
            {t.authSlogan}
          </p>

          {/* Quick value props / Bento style */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div className="p-4 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex gap-3 shadow-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950 text-emerald-500 p-2.5 rounded-xl self-start">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'ar' ? "مزامنة آمنة" : "Secure Sync"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'ar' ? "بياناتك مشفرة ومؤمنة في حسابك السحابي دائماً" : "Your data is always encrypted and stored safely."}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex gap-3 shadow-xs">
              <div className="bg-indigo-50 dark:bg-indigo-950 text-indigo-505 p-2.5 rounded-xl self-start text-indigo-550">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {language === 'ar' ? "الجمعيات التشاركية" : "Savings Groups"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {language === 'ar' ? "أقوى نظام تتبع وإرسال للتشاركيات من طرابلس إلى بنغازي" : "Modern ROSCA Jamiya organizer supporting cyclic roles."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Sign-in Card */}
        <div className="md:col-span-5 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col justify-center space-y-6">
          <div className="text-center md:text-start space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {t.greeting}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {language === 'ar' 
                ? "ابدأ رحلة الإدارة المالية الحكيمة اليوم مجاناً" 
                : "Initiate smart financial tracking today for free"}
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-2" />

          {/* Social login Button */}
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-slate-700 dark:text-slate-100 font-semibold text-base shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 7.99 12.5a5.99 5.99 0 0 1 6.002-6.015c1.614 0 3.084.623 4.194 1.638l3.221-3.22C19.458 3.12 16.03 2 12 2 6.477 2 2 6.477 2 12s4.477 10 10 10c5.5 0 10-4.5 10-10a9.7 9.7 0 0 0-.25-2.285H12.24Z"
              />
            </svg>
            <span>{t.signInGoogle}</span>
          </button>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
            {language === 'ar' ? (
              <span>عند تسجيل الدخول، فإنك توافق على تخزين بيانات المالية بشكل مشفر وآمن بالكامل مخصصة لشخصك فقط. عزيز يلتزم بخصوصيتك ولا يشارك أي ملف مالي مع طرف آخر.</span>
            ) : (
              <span>Upon signing in, you consent to store your financial records securely wrapped for your private account only. Aziz commits to zero telemetry sharing or audits.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
