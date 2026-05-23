/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart3, 
  ShoppingBag, 
  Users, 
  Tags, 
  Sparkles, 
  Settings as SettingsIcon, 
  Layers,
  Wallet
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { language, t, notifications } = useApp();
  const navRef = React.useRef<HTMLElement>(null);

  // Unread notification count
  const unreadCount = notifications.filter(n => !n.isRead).length;

  React.useEffect(() => {
    if (navRef.current) {
      const activeElement = navRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeElement) {
        const container = navRef.current;
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeElement.getBoundingClientRect();
        
        // Calculate the difference between the center of the active element and the center of the container
        const offset = (activeRect.left + activeRect.width / 2) - (containerRect.left + containerRect.width / 2);
        
        container.scrollBy({
          left: offset,
          behavior: 'smooth'
        });
      }
    }
  }, [currentTab]);

  const menuItems = [
    { id: 'futurePurchases', label: t.futurePurchases, icon: ShoppingBag },
    { id: 'savingsGroups', label: t.savingsGroups, icon: Users },
    { id: 'wallets', label: language === 'ar' ? 'المحافظ' : 'Wallets', icon: Wallet },
    { id: 'dashboard', label: t.dashboard, icon: BarChart3 },
    { id: 'transactions', label: language === 'ar' ? 'العمليات' : 'Ledger', icon: Layers },
    { id: 'categories', label: t.categories, icon: Tags },
    { id: 'reports', label: t.reports, icon: Sparkles },
    { id: 'settings', label: t.settings, icon: SettingsIcon },
  ];

  return (
    <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full md:w-auto max-w-full">
      <nav 
        ref={navRef}
        className="driver-tour-sidebar glass-modal shadow-2xl rounded-[2rem] mx-auto flex items-center justify-start md:justify-center gap-1 sm:gap-2 px-3 py-2.5 overflow-x-auto scrollbar-hide max-w-full border border-white/40 dark:border-slate-800/60 transition-colors"
        style={{ paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom))' }}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id || (item.id === 'transactions' && (currentTab === 'income' || currentTab === 'expenses'));
          return (
            <button
              key={item.id}
              data-active={isActive ? "true" : "false"}
              onClick={() => setCurrentTab(item.id)}
              className={`relative flex flex-col items-center justify-center p-2.5 min-w-[70px] sm:min-w-[80px] rounded-2xl transition-all duration-300 cursor-pointer flex-shrink-0 group ${
                isActive 
                  ? 'bg-brand-slate text-white dark:bg-white dark:text-brand-slate shadow-xl scale-[1.05] ring-2 ring-brand-slate/20 dark:ring-white/20' 
                  : 'text-slate-500 hover:text-brand-slate dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
              }`}
              title={item.label}
            >
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 ${isActive ? 'scale-110 mb-1' : 'group-hover:scale-110 mb-1'}`} />
              <span className={`text-[10px] sm:text-[11px] font-bold transition-all duration-300 ${isActive ? 'opacity-100 max-h-4' : 'opacity-70 max-h-4 sm:opacity-0 sm:max-h-0 sm:group-hover:opacity-100 sm:group-hover:max-h-4'}`}>
                {item.label}
              </span>

              {item.id === 'reports' && !isActive && (
                <span className="absolute top-1.5 right-2 sm:right-3 w-2 h-2 bg-brand-teal rounded-full animate-ping" />
              )}
              {item.id === 'settings' && unreadCount > 0 && (
                <span className="absolute top-1.5 right-2 sm:right-3 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
