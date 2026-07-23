/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useApp } from '../context/AppContext';

export const ProductTour: React.FC = () => {
  const { language } = useApp();
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // Check if tour was already completed
    const hasCompletedTour = localStorage.getItem('aziz_tour_completed');
    if (hasCompletedTour) return;

    if (hasStarted) return;
    setHasStarted(true);

    // We use a small delay to ensure the DOM is fully rendered
    const timeout = setTimeout(() => {
      const isRtl = language === 'ar';

      const driverObj = driver({
        showProgress: true,
        animate: true,
        popoverClass: 'driverjs-theme',
        nextBtnText: isRtl ? 'التالي &' : 'Next &rarr;',
        prevBtnText: isRtl ? '&larr; السابق' : '&larr; Previous',
        doneBtnText: isRtl ? 'إنهاء' : 'Done',
        onDestroyStarted: () => {
          if (!driverObj.hasNextStep() || confirm(isRtl ? 'هل أنت متأكد من تخطي الجولة؟' : 'Are you sure you want to skip the tour?')) {
             localStorage.setItem('aziz_tour_completed', 'true');
             driverObj.destroy();
          }
        },
        steps: [
          {
            element: 'header',
            popover: {
              title: isRtl ? 'مرحباً بك في التطبيق' : 'Welcome to the App',
              description: isRtl ? 'نظامك المالي الشخصي. دعنا نأخذ جولة سريعة للتعرف على الميزات الرئيسية.' : 'Your personal finance engine. Let\'s take a quick tour to explore the key features.',
              align: 'start'
            }
          },
          {
            element: '.driver-tour-sidebar',
            popover: {
              title: isRtl ? 'القائمة الرئيسية' : 'Main Navigation',
              description: isRtl ? 'من هنا يمكنك التنقل بين المحافظ، المصاريف، والإعدادات. اسحب لليمين واليسار لاستكشاف المزيد!' : 'From here you can navigate between wallets, expenses, and settings. Swipe left and right to explore more!',
              align: 'center'
            }
          },
          {
            element: '.driver-tour-balance',
            popover: {
              title: isRtl ? 'الرصيد الإجمالي' : 'Total Balance',
              description: isRtl ? 'يعرض إجمالي الرصيد المتوفر في كافة محافظك المالية الحالية.' : 'Displays the combined balance available across all your wallets.',
              align: 'start'
            }
          },
          {
            element: '.driver-tour-quick-actions',
            popover: {
              title: isRtl ? 'إجراءات سريعة' : 'Quick Actions',
              description: isRtl ? 'أضف دخل أو مصروف جديد بشكل مباشر وبسهولة تامة من هذا الشريط.' : 'Add new income, expenses, or transfers directly from this quick access bar.',
              align: 'start'
            }
          }
        ]
      });

      driverObj.drive();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [language, hasStarted]);

  return null;
};
