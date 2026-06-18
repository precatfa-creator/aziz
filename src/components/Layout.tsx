/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sidebar } from './Sidebar';
import { Auth } from './Auth';
import { Dashboard } from './Dashboard';
import { TransactionManager } from './TransactionManager';
import { FuturePurchases } from './FuturePurchases';
import { SavingsGroups } from './SavingsGroups';
import { CategoryManager } from './CategoryManager';
import { Reports } from './Reports';
import { Settings } from './Settings';
import { WalletManager } from './WalletManager';
import { TrashPage } from './TrashPage';
import { Coins, Loader2, Bell, Info, Trash2, CheckCheck, Languages } from 'lucide-react';
import { AboutModal } from './AboutModal';
import { ProductTour } from './ProductTour';

export const Layout: React.FC = () => {
  const { 
    user, 
    loading, 
    language, 
    profile, 
    t, 
    notifications,
    markNotificationRead,
    clearAllNotifications,
    setLanguage
  } = useApp();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || touchStartY === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = touchStart - touchEnd;
    const diffY = touchStartY - touchEndY;
    const threshold = 70; // minimum swiping distance in pixels

    // Verify it is a horizontal swipe and not a vertical scroll
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
      const swipeableTabs = [
        'futurePurchases',
        'savingsGroups',
        'wallets',
        'dashboard',
        'transactions',
        'categories',
        'reports',
        'settings'
      ];
      
      let tabKey = currentTab;
      if (currentTab === 'income' || currentTab === 'expenses') {
        tabKey = 'transactions';
      }
      
      const currentIndex = swipeableTabs.indexOf(tabKey);
      if (currentIndex !== -1) {
        const isRtl = language === 'ar';
        const goNext = isRtl ? diffX < 0 : diffX > 0;
        
        if (goNext) {
          const nextIndex = currentIndex + 1;
          if (nextIndex < swipeableTabs.length) {
            setCurrentTab(swipeableTabs[nextIndex]);
          }
        } else {
          const prevIndex = currentIndex - 1;
          if (prevIndex >= 0) {
            setCurrentTab(swipeableTabs[prevIndex]);
          }
        }
      }
    }
    
    setTouchStart(null);
    setTouchStartY(null);
  };

  const unreadCount = notifications ? notifications.filter(n => !n.isRead).length : 0;

  // 1. Interactive heartbeat loader while Firebase is fetching user sessions
  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-950 font-sans gap-4 animate-fade-in text-center p-6">
        <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center animate-bounce shadow-xl shadow-emerald-500/10">
          <Coins className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-1">
          <h2 className="font-exrabold text-base text-slate-800 dark:text-slate-100">
            {language === 'ar' ? 'تحميل البيانات بأمان...' : 'Securing local records...'}
          </h2>
          <p className="text-xs text-slate-400">
            {language === 'ar' ? 'نظام عزيز المالي الشخصي التفاعلي بالكامل' : 'Aziz personal budgeting expert system'}
          </p>
        </div>
      </div>
    );
  }

  // 2. Not logged in: Redirect instantly to fintech marketing Auth screen
  if (!user) {
    return <Auth />;
  }

  // 3. Render active Tab selector helper
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard setCurrentTab={setCurrentTab} />;
      case 'transactions':
        return <TransactionManager />;
      case 'income':
        return <TransactionManager defaultType="income" />;
      case 'expenses':
        return <TransactionManager defaultType="expense" />;
      case 'futurePurchases':
        return <FuturePurchases />;
      case 'savingsGroups':
        return <SavingsGroups />;
      case 'wallets':
        return <WalletManager setCurrentTab={setCurrentTab} />;
      case 'categories':
        return <CategoryManager />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'trash':
        return <TrashPage />;
      default:
        return <Dashboard />;
    }
  };

  const isRTL = language === 'ar';

  return (
    <div 
      className="min-h-screen w-full overflow-x-hidden bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 relative flex flex-col" 
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <ProductTour />
      {/* Floating Minimal Header */}
      <header className="sticky top-0 z-40 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md border-b border-white/40 dark:border-slate-800/60 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
         <div className="flex items-center gap-3">
           <div className="bg-brand-slate text-white dark:bg-white dark:text-brand-slate p-2 rounded-xl flex items-center justify-center shadow-lg">
             <Coins className="w-4.5 h-4.5" />
           </div>
           <div>
             <h1 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
               {t.appName}
             </h1>
             <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">
               {language === 'ar' ? 'الرفيق المالي' : 'Finance Engine'}
             </p>
           </div>
         </div>
         
         <div className="flex items-center gap-3 sm:gap-4">
            {/* Language Switcher */}
            <button 
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="p-2 text-slate-400 hover:text-brand-slate dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-black uppercase bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-xl px-2.5 py-1.5"
              title={language === 'ar' ? 'English (LTR)' : 'العربية (RTL)'}
            >
              <Languages className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">{language === 'ar' ? 'en' : 'ar'}</span>
            </button>

            {/* About Developer */}
            <button 
              onClick={() => setShowAboutModal(true)}
              className="p-2 text-slate-400 hover:text-brand-slate dark:hover:text-white transition-colors cursor-pointer"
              title={language === 'ar' ? 'حول المطور' : 'About Developer'}
            >
              <Info className="w-4.5 h-4.5" />
            </button>

                       {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                  showNotificationDropdown 
                    ? 'bg-brand-teal/10 text-brand-teal' 
                    : 'text-slate-400 hover:text-brand-slate dark:hover:text-white'
                }`}
                title={language === 'ar' ? 'الإشعارات والتنبيهات' : 'Notifications & Alerts'}
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white dark:border-slate-900" />
                )}
              </button>

              {/* Float List Dropdown Tray */}
              {showNotificationDropdown && (
                <div 
                  className={`absolute top-12 ${isRTL ? 'left-0' : 'right-0'} w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-3 max-h-96 overflow-y-auto duration-200`}
                >
                  <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-850 pb-2.5">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-brand-teal" />
                      {language === 'ar' ? 'الإشعارات والتنبيهات' : 'Notifications & Alerts'}
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={async () => {
                          await clearAllNotifications();
                          setShowNotificationDropdown(false);
                        }}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1 px-2 py-1 bg-rose-50 dark:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        {language === 'ar' ? 'مسح الكل' : 'Clear All'}
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-50 dark:divide-slate-850/60 mt-2 max-h-64 overflow-y-auto scrollbar-thin">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          onClick={async () => {
                            if (!notif.isRead) {
                              await markNotificationRead(notif.id);
                            }
                          }}
                          className={`py-3 flex flex-col gap-1 text-right sm:text-start cursor-pointer group transition-all rounded-xl px-2 hover:bg-slate-50 dark:hover:bg-slate-850/60 ${notif.isRead ? '' : 'bg-amber-500/[0.03] dark:bg-brand-teal/[0.02]'}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className={`text-[11px] font-black leading-snug ${notif.isRead ? 'text-slate-800 dark:text-slate-200 font-bold' : 'text-brand-teal font-black'}`}>
                              {language === 'ar' ? notif.titleAr : notif.titleEn}
                            </span>
                            {!notif.isRead && (
                              <span className="w-1.5 h-1.5 bg-brand-teal rounded-full mt-1.5 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            {language === 'ar' ? notif.messageAr : notif.messageEn}
                          </p>
                          <span className="text-[8px] text-slate-400 font-mono mt-0.5">
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleDateString(language === 'ar' ? 'ar-LY' : 'en-US', {hour: '2-digit', minute: '2-digit'}) : ''}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-400 font-bold">
                        {language === 'ar' ? 'لا توجد تنبيهات جديدة.' : 'No new notifications.'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
           
           {/* Avatar */}
           <button onClick={() => { setCurrentTab('settings'); setShowNotificationDropdown(false); }} className="w-9 h-9 rounded-full bg-brand-teal/20 hover:bg-brand-teal/30 text-teal-700 dark:text-brand-teal font-extrabold flex items-center justify-center text-xs shadow-inner cursor-pointer transition-colors" title={language === 'ar' ? 'الملف الشخصي والبيانات' : 'Profile Settings'}>
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </button>
         </div>
      </header>

      {/* Mirrorable responsive navigation rail - now floating dock */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* About Developer Modal */}
      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />

      {/* Master central panel view */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-8 py-6 relative scrollbar-thin pb-32"
      >
        <div className="max-w-7xl mx-auto">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};
