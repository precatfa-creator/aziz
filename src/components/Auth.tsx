/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Wallet, 
  Globe, 
  Shield, 
  Coins, 
  Sparkles, 
  TrendingUp, 
  Plus, 
  Check, 
  ArrowRight, 
  Lock, 
  Users, 
  Layers, 
  Activity, 
  Calendar, 
  BarChart3, 
  Target, 
  CheckCircle2, 
  Languages, 
  Clock, 
  HelpCircle,
  PiggyBank,
  CheckCircle,
  Eye,
  Menu,
  X
} from 'lucide-react';

export const Auth: React.FC = () => {
  const { loginWithGoogle, language, setLanguage, t } = useApp();
  const [activePreviewTab, setActivePreviewTab] = useState<'dashboard' | 'expenses' | 'jamiya' | 'purchases' | 'reports'>('dashboard');
  const [previewCurrency, setPreviewCurrency] = useState<'LYD' | 'USD'>('LYD');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll handler helper to smooth scroll to landing IDs
  const scrollToId = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Localized landing content dictionary to support beautiful translations
  const text = {
    ar: {
      features: "المميزات",
      howItWorks: "طريقة العمل",
      associations: "الجمعيات التشاركية",
      securityCount: "أمانك المالي",
      startNow: "ابدأ الآن",
      heroTitle: "رتّب دخلك، مصروفاتك، وجمعياتك في مكان واحد",
      heroSecondary: "مع عزيز، قراراتك المالية تصبح أوضح",
      heroSubtitle: "عزيز يساعدك على تسجيل دخلك ومصاريفك، متابعة مشترياتك القادمة، إدارة الجمعيات التشاركية، ومراقبة أموالك بالدينار الليبي والدولار بطريقة سهلة وآمنة.",
      ctaGoogle: "ابدأ مجاناً باستخدام Google",
      ctaWatch: "شاهد كيف يعمل عزيز",
      currencyLyd: "رؤية الأرصدة بـ د.ل",
      currencyUsd: "رؤية الأرصدة بـ $",
      previewTitle: "معاينة لوحة التحكم التفاعلية",
      monthlyIncome: "الدخل الشهري",
      monthlyExpenses: "المصاريف الشهرية",
      remainingBalance: "الرصيد المتبقي",
      upcomingPurchases: "مشتريات قادمة",
      upcomingPurchasesDesc: "مخطط للشراء قريباً",
      activeJamiya: "الجمعية النشطة",
      activeJamiyaDesc: "جمعية الأصدقاء",
      valueProps: {
        expense: {
          title: "تتبع ذكي للمصاريف",
          desc: "سجّل كل مصروف حسب الفئة، الملاحظات، والتاريخ المعين بضغطة واحدة."
        },
        jamiya: {
          title: "إدارة الجمعيات",
          desc: "نظّم الأعضاء، الدفعات، الأدوار، ومواعيد الاستلام دون الحاجة لدفتر ورقي."
        },
        future: {
          title: "مشتريات مستقبلية",
          desc: "خطط لشراء الأشياء المهمة بسعر متوقع وراقب نسبة تقدم ادخارك لها."
        },
        currency: {
          title: "عملتان بنقرة واحدة",
          desc: "تابع أموالك بالدينار الليبي والدولار الأمريكي بسهولة وبسعر صرف مخصص."
        }
      },
      featuresTitle: "كل ما تحتاجه لإدارة مالك اليومي",
      featuresSubtitle: "أدوات متكاملة مصممة خصيصاً لتناسب احتياجات الأفراد والأسر في ليبيا والمنطقة العربية",
      featuresList: [
        {
          title: "تسجيل الدخل والموارد",
          desc: "أضف مصادر دخلك الشهرية الثابتة أو الأرباح المتغيرة مع ربطها بمحفظة نقدية مخصصة."
        },
        {
          title: "تسجيل فوري للمصاريف",
          desc: "حدد القيمة، الشرح، نوعية التصنيف، تاريخ الصرف، وطريقة الدفع المتبعة بكل مرونة."
        },
        {
          title: "تصنيفات ذكية ومرنة",
          desc: "اختر من تصنيفاتنا الجاهزة أو أنشئ تصنيفاً مبتكراً بأي اسم ولون تفضله أثناء تسجيل عملياتك."
        },
        {
          title: "الجمعيات التشاركية الدوارة",
          desc: "نظام متكامل لتصميم الجمعيات، تحديد حصة المساهم، شهور الدوران، وترتيب حجز الاستلام."
        },
        {
          title: "قائمة الأمنيات (المشتريات)",
          desc: "رتب أهدافك الاستهلاكية القادمة مع تسعير متوقع ومستوى ملاءمة تمويلي لحساب الادخار."
        },
        {
          title: "تقارير وتحليلات مبسطة",
          desc: "شاهد رسومات بيانية واضحة لأكثر الأصناف صرفاً لتعرف تحديداً أين تذهب مرتباتك."
        },
        {
          title: "توازن LYD و USD",
          desc: "نظّم حساباتك بالعملة المحلية والأجنبية مع تتبع سعر الصرف المعمول به في السوق الموازي لتقييم ثروتك."
        },
        {
          title: "أمان وخصوصية تامة",
          desc: "بياناتك مشفرة ومؤمنة في تخزين سحابي محمي بالكامل، ولا يتم استعراض أو مشاركة معلوماتك مع أي طرف."
        }
      ],
      workflowTitle: "كيف يعمل عزيز؟",
      workflowSubtitle: "أربع خطوات بسيطة تفصلك عن حريتك واستقرارك المالي والمنزلي",
      workflowSteps: [
        {
          step: "الخطوة الأولى",
          title: "سجّل دخولك فوراً",
          desc: "اربط حسابك المسجل مسبقاً لدى Google بضغطة زر واحدة وآمنة دون تعقيد كلمات المرور الجديدة."
        },
        {
          step: "الخطوة الثانية",
          title: "أضف دخلك ومصاريفك",
          desc: "سجّل العمليات اليومية والشهرية مع إسنادها للتصنيفات المناسبة (طعام، سيارة، إيجار)."
        },
        {
          step: "الخطوة الثالثة",
          title: "نظّم جمعياتك ومشترياتك",
          desc: "أنشئ جمعيتك النشطة مع الأصدقاء، وخطط للمقتنيات الكبيرة القادمة في قائمة الأمنيات."
        },
        {
          step: "الخطوة الرابعة",
          title: "راقب تحسن ذكائك المالي",
          desc: "تابع منحنى الميزانية واستشر النصائح التلقائية للمدرب المالي لتقليص الهدر التدريجي لوعيك المالي."
        }
      ],
      previewSectionTitle: "نظرة داخل قمرة قيادة عزيز",
      previewSectionSubtitle: "استمتع بمشاهدة لقطات تفاعلية حية من التصميم الداخلي المريح جداً للعين قبل اتخاذ قرارك",
      previewTabs: {
        dashboard: "الرئيسية",
        expenses: "المصاريف",
        jamiya: "الجمعيات التشاركية",
        purchases: "المشتريات والخطط",
        reports: "التحليلات والمحاسبة"
      },
      previewData: {
        dashboard: {
          balance: "الرصيد الكلي الحالي",
          inc: "إجمالي المقبوضات",
          exp: "إجمالي المدفوعات",
          remain: "المتبقي الصافي",
          saved: "نسبة الحفظ والإدخار للمصاريف الشهرية"
        },
        expenses: {
          title: "آخر المعاملات المسجلة",
          headers: ["المعاملة", "التصنيف", "تاريخ العملية", "القيمة المطلقة"]
        },
        jamiya: {
          name: "جمعية الأصدقاء المكتبية",
          members: "عدد المشتركين",
          rate: "قسط المشارك الشهري",
          currentTurn: "دور الاستلام للشهر الحالي",
          status: "دورة دورية مستمرة"
        },
        purchases: {
          title: "سلة التخطيط والمشتريات المعلقة",
          priority: "الأولوية",
          high: "ضرورية جداً",
          medium: "غير مستعجلة",
          low: "ثانوية ترفيهية"
        },
        reports: {
          topCats: "توزيع السيولة حسب فئات الاستهلاك الأكثر طلباً",
          comp: "مقارنة سيولة الصادر المالي مقابل الوارد المالي"
        }
      },
      jamiyaExplanationTitle: "إدارة الجمعيات التشاركية بدون فوضى المفكرات",
      jamiyaExplanationSubtitle: "تتبع نظام (التشاركية الدوارة) الأكثر شهرة في ليبيا والشرق الأوسط، بتنظيم رقمي دقيق ومتطور يمنع الإحراج ويعزز الشفافية.",
      jamiyaExplanationText1: "سواء كانت الجمعية بين الأصدقاء، العائلات، أو زملاء العمل في المكتب، يساعدك عزيز على إدارتها بالكامل: تتبع الأقساط الشهرية، تسجيل أسماء وهواتف المشتركين، وإسناد أدوار الاستلام، مع تنبيهات ذكية تذكيرية عند حلول موعد قسط كل مشترك.",
      jamiyaExplanationExampleTitle: "مثال توضيحي بالأرقام:",
      jamiyaExplanationExampleText: "عند تنظيم جمعية بقيمة كلية 5,000 د.ل وبخمسة أعضاء مشتركين، يدفع كل عضو 1,000 د.ل في دورة شهرية مستمرة لـ 5 أشهر، ويحصل عضو مختلف على الـ 5,000 د.ل مجتمعة كل شهر بالتتابع المعتمد.",
      jamiyaExplanationBtn: "أنشئ أو شارك في جمعيتك الأولى اليوم",
      securityTitle: "خصوصيتك أمانة مقدسة ومحمية بأقصى المعايير",
      securityDesc: "تم تصميم البنية البرمجية لعزيز لتوفير خصوصية غامرة وحماية صارمة لبيانات ثرواتك.",
      securityList: [
        {
          title: "بوابة توثيق معتمدة وآمنة بواسطة Google",
          desc: "نعتمد كلياً على بروتوكولات حماية Google لتسجيل الدخول بأمان دون الاحتفاظ بأي كلمة مرور خاصة بك لدينا."
        },
        {
          title: "تشفير وحماية البيانات السحابية",
          desc: "يتم الاحتفاظ بسجلاتك بشكل مؤمن وسري تماماً في نظام حماية قواعد البيانات Firestore المعزول والمعقد برمجياً."
        },
        {
          title: "ملكيتك الحرة لبياناتك بكل حرية ومرونة",
          desc: "أنت المالك الوحيد لبياناتك الشخصية. نوفر لك القدرة الفورية على تحميل تصديراتها في جداول Excel أو حذفها بالكامل."
        },
        {
          title: "بيئة نظيفة آمنة من التعقب التجاري والإعلانات",
          desc: "عزيز تطبيق خال تماماً من شبكات الإعلانات والبيع التجاري للبيانات. هدفنا مساعدتك لا تحويل معلوماتك إلى سلعة."
        }
      ],
      finalCtaTitle: "ابدأ تنظيم أمورك المالية بطريقة ذكية اليوم",
      finalCtaSubtitle: "خطوة واحدة تضمن لك راحة البال ومراقبة مصروفاتك بشكل مرتب وبسيط.",
      finalCtaBtn: "تسجيل الدخول الآمن بواسطة Google",
      finalCtaNote: "مجاني وبسيط للبدء — لا توجد أي بطاقات مصرفية مطلوبة.",
      rights: "جميع الحقوق محفوظة لعزيز © 2026. رتب دخلك ومستقبلك بحكمة.",
      aboutTitle: "عزيز: رفيقك المالي العربي",
      aboutDesc: "تم تطوير هذا التطبيق لمساعدة المجتمعات في منطقة شمال أفريقيا والشرق الأوسط على تحسين رفاهيتهم وتوطيد مبدأ الإدخار والتكافل التشاركي."
    },
    en: {
      features: "Features",
      howItWorks: "How It Works",
      associations: "Rotating Savings (Jamiya)",
      securityCount: "Financial Security",
      startNow: "Start Free",
      heroTitle: "Host your income, expenses, and savings groups in one place",
      heroSecondary: "With Aziz, your daily financial choices become clearer",
      heroSubtitle: "Aziz helps you manage your streams of income, logs daily expenditures, plans long-term wishlist targets, hosts rotating collaborative savings circles, and keeps dual cash tabs in Libyan Dinars & USD.",
      ctaGoogle: "Start Free with Google Sign In",
      ctaWatch: "See How It Works",
      currencyLyd: "Display in LYD (د.ل)",
      currencyUsd: "Display in USD ($)",
      previewTitle: "Live Ledger Analytics Dashboard Mockup",
      monthlyIncome: "Monthly Income",
      monthlyExpenses: "Monthly Expenses",
      remainingBalance: "Net Remaining Balance",
      upcomingPurchases: "Wishlist Goals",
      upcomingPurchasesDesc: "Planned target items",
      activeJamiya: "Active Saving Jamiya",
      activeJamiyaDesc: "Friends Office Circle",
      valueProps: {
        expense: {
          title: "Clean Expense Logging",
          desc: "Itemize and categorize every single transaction with labels and helpful tags."
        },
        jamiya: {
          title: "Rotating Savings (Jamiya)",
          desc: "Govern rotating credit circles, member payouts, monthly cues, and cycles dynamically."
        },
        future: {
          title: "Wishlist Targets",
          desc: "Estimate prices and schedule savings progress targets for essential future purchases."
        },
        currency: {
          title: "Bi-Currency Ledger",
          desc: "Support both Libyan Dinar & US Dollars cleanly with simple toggled exchange viewing rules."
        }
      },
      featuresTitle: "Everything You Need to Master Your Personal Funds",
      featuresSubtitle: "SaaS-caliber utilities engineered for families and forward-looking individuals in Libya and MENA",
      featuresList: [
        {
          title: "Income Tracking",
          desc: "Log continuous monthly salary deposits or variable trade receipts tagged to separate vaults."
        },
        {
          title: "Swift Expense Items",
          desc: "Control cash flow output with item descriptions, colors, categories, payment types, and dates."
        },
        {
          title: "Smart Elastic Tags",
          desc: "Enjoy comprehensive built-in categories or construct personalized ones during any fast log flow."
        },
        {
          title: "ROTATING SAVINGS (JAMIYA)",
          desc: "Define cycle intervals, member phones, target savings milestones, and payout order queues."
        },
        {
          title: "Forthcoming Wishlist Items",
          desc: "Tidy up your future commodity procurement plans with priorities and custom targeted dates."
        },
        {
          title: "Analytical Snapshots",
          desc: "Keep eye-ball contact with smart category allocations through modern, clear financial proportions charts."
        },
        {
          title: "LYD & USD Support",
          desc: "Add items in either of the two currencies, using manually synced parallel rates for dual monitoring."
        },
        {
          title: "Guaranteed Privacy",
          desc: "Your records are strictly locked. We never trade, share, or monetize any of your confidential balances."
        }
      ],
      workflowTitle: "How Does Aziz Work?",
      workflowSubtitle: "Four simplistic steps to fully command and double your daily savings rate",
      workflowSteps: [
        {
          step: "Step 1",
          title: "Sign In Securely",
          desc: "Connect your existing Google identity with a single risk-free click without password fatigue."
        },
        {
          step: "Step 2",
          title: "Log Inbound & Spending",
          desc: "List recurring earnings and log outgoing expenses tagged with matching visual categories."
        },
        {
          step: "Step 3",
          title: "Build Saving Jamiyas",
          desc: "Launch collaborative saving rotations with relatives or colleagues and record wishlist items."
        },
        {
          step: "Step 4",
          title: "Observe Growth Curves",
          desc: "Browse clean bar-charts, evaluate savings rates, and review helpful financial advisor summaries."
        }
      ],
      previewSectionTitle: "A Detailed Look inside Aziz",
      previewSectionSubtitle: "A premium interactive preview demonstrating how our clean, lightweight application handles daily assets",
      previewTabs: {
        dashboard: "Dashboard Overview",
        expenses: "Expense Ledger",
        jamiya: "Savings Circles (Jamiya)",
        purchases: "Wishlist Goals",
        reports: "Accounting Reports"
      },
      previewData: {
        dashboard: {
          balance: "Available Account Balance",
          inc: "Inbound Earnings Total",
          exp: "Outbound Expenditure",
          remain: "Net Remaining Surplus",
          saved: "Aggregate Monthly Savings Progress"
        },
        expenses: {
          title: "Latest Ledger Logs",
          headers: ["Description", "Category Tag", "Transaction Date", "Cash Transacted"]
        },
        jamiya: {
          name: "Office Friends Collaborative Saving",
          members: "Active Members",
          rate: "Monthly Quota per Head",
          currentTurn: "Payout Receiver of the Month",
          status: "Ongoing Active Cycle"
        },
        purchases: {
          title: "Upcoming Wishlist Goals Ledger",
          priority: "Priority Tag",
          high: "High Essential",
          medium: "Secondary Goal",
          low: "Non-Urgent Fun"
        },
        reports: {
          topCats: "Distribution of Cash Across Spending Categories",
          comp: "Income Earnings Influx vs. Expenses Outflow"
        }
      },
      jamiyaExplanationTitle: "Collaborative Rotating Savings (Jamiya) Without Paper Mess",
      jamiyaExplanationSubtitle: "Run rotating savings groups (the traditional Jamiya cyclic pool) securely with flawless transparent status tables.",
      jamiyaExplanationText1: "Whether establishing circles with neighbors, friends, or trusted professional peers, Aziz tracks monthly collections, member schedules, payout numbers, and reminds participants cleanly.",
      jamiyaExplanationExampleTitle: "Simulated Arithmetic Example:",
      jamiyaExplanationExampleText: "In a 5-month collaborative pool totaling 5,000 LYD with 5 partners, each contributes 1,000 LYD monthly, and a designated participant receives the total 5,000 LYD payout on their designated month.",
      jamiyaExplanationBtn: "Set Up Your First Saving Circle Now",
      securityTitle: "Your Privacy is Secured and Encrypted Fully",
      securityDesc: "We implement defense-grade systems to shield your money flows with clear codes.",
      securityList: [
        {
          title: "Certified Security by Google OAuth Gateway",
          desc: "Zero passwords stored in our systems. Safe authentication with Google API protects your workspace."
        },
        {
          title: "Encrypted Firestore Cloud Databases",
          desc: "Your records are tightly isolated with security rules in highly resilient Firestore instances."
        },
        {
          title: "Absolute Ledger Sovereignty",
          desc: "You have complete authority. Instantly export all your operations as clean Excel or permanently delete logs."
        },
        {
          title: "Pragmatic, No-Ad Transparent Stance",
          desc: "We never participate in advertising trackers or broker profiles. We prioritize helping, not tracking."
        }
      ],
      finalCtaTitle: "Take Control of Your Personal Wealth Today with Aziz",
      finalCtaSubtitle: "A single clean click connects you to modern income monitors, savings coordinators, and smart reports.",
      finalCtaBtn: "Embark safely via Google",
      finalCtaNote: "Completely free to start — no payment credentials, bank cards or subscription required.",
      rights: "All Rights Reserved to Aziz © 2026. Conscious wealth building.",
      aboutTitle: "Aziz: Your Friendly Financial Assistant",
      aboutDesc: "Designed to help users in North Africa and the Middle East enhance financial literacy, build savings, and collaborate in rotating saving Jamiyas."
    }
  };

  const currentLangText = text[language];
  const isRtl = language === 'ar';

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 font-sans transition-all duration-300 flex flex-col antialiased">
      
      {/* 1. Header & Navigation Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-900/40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="bg-emerald-500 text-white p-2.5 rounded-2xl flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-xl text-slate-900 dark:text-white transition-colors tracking-tight flex items-center gap-1.5 font-sans">
              <span>{language === 'ar' ? 'عزيز' : 'Aziz'}</span>
              <span className="text-emerald-500 font-bold">|</span>
              <span className="text-slate-400 text-xs font-semibold">{language === 'ar' ? 'عزيز' : 'az-Ziz'}</span>
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => scrollToId('features')} 
              className="text-slate-600 dark:text-slate-350 hover:text-emerald-500 dark:hover:text-emerald-400 font-medium text-sm transition-colors cursor-pointer"
            >
              {currentLangText.features}
            </button>
            <button 
              onClick={() => scrollToId('how-it-works')} 
              className="text-slate-600 dark:text-slate-350 hover:text-emerald-500 dark:hover:text-emerald-400 font-medium text-sm transition-colors cursor-pointer"
            >
              {currentLangText.howItWorks}
            </button>
            <button 
              onClick={() => scrollToId('associations')} 
              className="text-slate-600 dark:text-slate-350 hover:text-emerald-500 dark:hover:text-emerald-400 font-medium text-sm transition-colors cursor-pointer"
            >
              {currentLangText.associations}
            </button>
            <button 
              onClick={() => scrollToId('security')} 
              className="text-slate-600 dark:text-slate-350 hover:text-emerald-500 dark:hover:text-emerald-400 font-medium text-sm transition-colors cursor-pointer"
            >
              {currentLangText.securityCount}
            </button>
          </nav>

          {/* Language Switch & CTA button */}
          <div className="hidden md:flex items-center gap-4">
            {/* Language Switcher */}
            <button 
              onClick={() => {
                const nextLang = language === 'ar' ? 'en' : 'ar';
                setLanguage(nextLang);
              }}
              className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-all"
              title={language === 'ar' ? 'Switch to English' : 'العربية'}
            >
              <Languages className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                {language === 'ar' ? 'English' : 'عربي'}
              </span>
            </button>

            {/* Quick App Login */}
            <button 
              onClick={loginWithGoogle}
              className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-2xl font-bold text-sm shadow-md shadow-slate-900/10 transition-all cursor-pointer hover:-translate-y-0.5"
            >
              {currentLangText.startNow}
            </button>
          </div>

          {/* Burger menu on Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button 
              onClick={() => {
                setLanguage(language === 'ar' ? 'en' : 'ar');
              }}
              className="p-2 border border-slate-250 dark:border-slate-800 rounded-lg"
            >
              <Languages className="w-4 h-4 text-emerald-500" />
            </button>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 dark:text-slate-300 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Tray */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900 absolute top-full inset-x-0 py-6 px-4 space-y-4 shadow-xl flex flex-col animate-in fade-in slide-in-from-top-4 duration-200">
            <button 
              onClick={() => scrollToId('features')} 
              className="text-start py-2 text-slate-700 dark:text-slate-300 font-semibold text-sm border-b border-slate-50 dark:border-slate-900"
            >
              {currentLangText.features}
            </button>
            <button 
              onClick={() => scrollToId('how-it-works')} 
              className="text-start py-2 text-slate-700 dark:text-slate-300 font-semibold text-sm border-b border-slate-50 dark:border-slate-900"
            >
              {currentLangText.howItWorks}
            </button>
            <button 
              onClick={() => scrollToId('associations')} 
              className="text-start py-2 text-slate-700 dark:text-slate-300 font-semibold text-sm border-b border-slate-50 dark:border-slate-900"
            >
              {currentLangText.associations}
            </button>
            <button 
              onClick={() => scrollToId('security')} 
              className="text-start py-2 text-slate-700 dark:text-slate-300 font-semibold text-sm border-b border-slate-50 dark:border-slate-900"
            >
              {currentLangText.securityCount}
            </button>

            <button 
              onClick={loginWithGoogle}
              className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-bold text-center shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              {currentLangText.finalCtaBtn}
            </button>
          </div>
        )}
      </header>

      {/* 2. Hero Section */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Hero Left: Headlines & Dynamic Actions */}
          <div className="lg:col-span-7 flex flex-col space-y-6 text-start">
            
            <div className="inline-flex self-start items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تطبيق المستشار المالي الأول في ليبيا' : 'The First Trusted Financial App in Libya'}</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-950 dark:text-white leading-tight tracking-tight">
                {currentLangText.heroTitle}
              </h1>
              <h2 className="text-xl md:text-2xl font-bold text-emerald-500 dark:text-emerald-400">
                {currentLangText.heroSecondary}
              </h2>
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl font-medium">
              {currentLangText.heroSubtitle}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <button
                onClick={loginWithGoogle}
                className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all text-base cursor-pointer"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#FFFFFF"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 7.99 12.5a5.99 5.99 0 0 1 6.002-6.015c1.614 0 3.084.623 4.194 1.638l3.221-3.22C19.458 3.12 16.03 2 12 2 6.477 2 2 6.477 2 12s4.477 10 10 10c5.5 0 10-4.5 10-10a9.7 9.7 0 0 0-.25-2.285H12.24Z"
                  />
                </svg>
                <span>{currentLangText.ctaGoogle}</span>
              </button>

              <button
                onClick={() => scrollToId('how-it-works')}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-850 dark:text-slate-200 font-bold rounded-2xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer text-base"
              >
                <span>{currentLangText.ctaWatch}</span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </button>
            </div>

            {/* Micro proof badges */}
            <div className="pt-2 flex items-center gap-6 text-slate-400 dark:text-slate-500 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ar' ? 'حفظ مشفر سحابي' : 'Cloud encrypted ledger'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{language === 'ar' ? 'دعم كامل لدينار ليبيا' : 'Full Libyan Dinar alignment'}</span>
              </span>
            </div>
          </div>

          {/* Hero Right: Large Interactive Dashboard Mockup Preview */}
          <div className="lg:col-span-5 relative mt-6 lg:mt-0">
            {/* Ambient decorative glow */}
            <div className="absolute -inset-4 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-3xl blur-2xl -z-10" />

            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-[2.5rem] shadow-2xl p-6 sm:p-7 relative overflow-hidden transition-all hover:scale-[1.01]">
              
              {/* Fake Desktop Header */}
              <div className="flex items-center justify-between border-b border-slate-150/40 dark:border-slate-800/50 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center font-bold text-xs text-emerald-600">
                    ع
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {language === 'ar' ? 'مرحبا عمر العيساوي!' : 'Hi Omar Al-Asawi!'}
                    </h4>
                    <p className="text-[10px] text-slate-400">{language === 'ar' ? 'شريك الادخار الذكي' : 'Saving Partner'}</p>
                  </div>
                </div>

                {/* Live Currency Selector */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button 
                    onClick={() => setPreviewCurrency('LYD')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      previewCurrency === 'LYD' 
                        ? 'bg-emerald-500 text-white shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    LYD
                  </button>
                  <button 
                    onClick={() => setPreviewCurrency('USD')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                      previewCurrency === 'USD' 
                        ? 'bg-emerald-500 text-white shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    USD
                  </button>
                </div>
              </div>

              {/* Main numerical showcase widgets */}
              <div className="grid grid-cols-2 gap-3.5 mb-5">
                
                {/* IncomeWidget */}
                <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 rounded-2xl relative">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">
                    {currentLangText.monthlyIncome}
                  </span>
                  <p className="text-base sm:text-lg font-black text-emerald-500 font-mono">
                    {previewCurrency === 'LYD' ? '6,150 د.ل' : '$1,000'}
                  </p>
                  <span className="text-[9px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded-md absolute top-3 end-3 font-bold">
                    +15%
                  </span>
                </div>

                {/* ExpenseWidget */}
                <div className="p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850/60 rounded-2xl relative">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    {currentLangText.monthlyExpenses}
                  </span>
                  <p className="text-base sm:text-lg font-black text-rose-500 font-mono">
                    {previewCurrency === 'LYD' ? '3,075 د.ل' : '$500'}
                  </p>
                  <span className="text-[9px] text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded-md absolute top-3 end-3 font-bold">
                    -8%
                  </span>
                </div>

              </div>

              {/* Combined Net Balance Widget */}
              <div className="p-4 bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl mb-5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {currentLangText.remainingBalance}
                  </span>
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <p className="text-2xl font-black text-slate-900 dark:text-white font-sans">
                  {previewCurrency === 'LYD' ? '3,075 د.ل' : '$500'}
                </p>
                <div className="mt-2 text-[9px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-emerald-500" />
                  <span>
                    {language === 'ar' 
                      ? `ما يعادل تقريباً ${previewCurrency === 'LYD' ? '$500 دولار أمريكي' : '3,075 دينار ليبي'}` 
                      : `Appx. equivalent to ${previewCurrency === 'LYD' ? '$500 US Dollars' : '3,075 Libyan Dinar'}`}
                  </span>
                </div>
              </div>

              {/* Jamiya & Purchases Mini Grid inside Mockup */}
              <div className="space-y-3">
                
                {/* Mini Jamiya tracking slider */}
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{currentLangText.activeJamiya}</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                      {previewCurrency === 'LYD' ? '12,300 د.ل' : '$2,000'}
                    </span>
                  </div>
                  {/* Contribution bar indicator */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: '60%' }} />
                  </div>
                  <div className="flex justify-between items-center mt-1.5 text-[8.5px] text-slate-400 font-bold">
                    <span>{language === 'ar' ? 'الشهر 3 من 5 (60%)' : 'Month 3 of 5 (60%)'}</span>
                    <span>{language === 'ar' ? 'مساهمة: 1,230 د.ل' : 'Fee: $200'}</span>
                  </div>
                </div>

                {/* Upcoming wishlist priorities */}
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-500/10 text-amber-500 p-1.5 rounded-xl">
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block leading-tight">{currentLangText.upcomingPurchases}</span>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">iPhone 15 Pro</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="text-[11px] font-black text-slate-900 dark:text-white font-mono block leading-tight">
                      {previewCurrency === 'LYD' ? '4,920 د.ل' : '$800'}
                    </span>
                    <span className="text-[8px] px-1 bg-amber-500/10 text-amber-600 rounded-sm font-bold uppercase leading-tight">
                      {language === 'ar' ? 'مرتفع' : 'High'}
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 3. Trust / Value Cards */}
      <section className="py-8 bg-slate-50/20 dark:bg-slate-950/30 border-y border-slate-150/40 dark:border-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Value 1: Expenses */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2.5xl border border-slate-100 dark:border-slate-850 shadow-sm flex gap-3.5 hover:shadow-md transition-shadow">
              <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-2xl self-start">
                <Activity className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {currentLangText.valueProps.expense.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  {currentLangText.valueProps.expense.desc}
                </p>
              </div>
            </div>

            {/* Value 2: Jamiya */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2.5xl border border-slate-100 dark:border-slate-850 shadow-sm flex gap-3.5 hover:shadow-md transition-shadow">
              <div className="bg-blue-500/10 text-indigo-500 p-3 rounded-2xl self-start">
                <Users className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {currentLangText.valueProps.jamiya.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  {currentLangText.valueProps.jamiya.desc}
                </p>
              </div>
            </div>

            {/* Value 3: Wishlist */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2.5xl border border-slate-100 dark:border-slate-850 shadow-sm flex gap-3.5 hover:shadow-md transition-shadow">
              <div className="bg-amber-500/10 text-amber-500 p-3 rounded-2xl self-start">
                <Target className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {currentLangText.valueProps.future.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  {currentLangText.valueProps.future.desc}
                </p>
              </div>
            </div>

            {/* Value 4: Currency */}
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2.5xl border border-slate-100 dark:border-slate-850 shadow-sm flex gap-3.5 hover:shadow-md transition-shadow">
              <div className="bg-indigo-500/10 text-indigo-500 p-3 rounded-2xl self-start">
                <Globe className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  {currentLangText.valueProps.currency.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                  {currentLangText.valueProps.currency.desc}
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Features Section */}
      <section id="features" className="py-20 md:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-emerald-500 font-black text-xs uppercase tracking-widest block bg-emerald-500/10 w-fit mx-auto px-3.5 py-1.5 rounded-full">
            {language === 'ar' ? 'أقسام متكاملة' : 'Meticulous Modules'}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            {currentLangText.featuresTitle}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-semibold">
            {currentLangText.featuresSubtitle}
          </p>
        </div>

        {/* Feature Cards Grid (8 items) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {currentLangText.featuresList.map((item, idx) => {
            // Give specific icons based on idx to add rich designs
            const featureIcons = [
              <Wallet className="w-5 h-5" />,
              <TrendingUp className="w-5 h-5" />,
              <Layers className="w-5 h-5" />,
              <Users className="w-5 h-5" />,
              <Target className="w-5 h-5" />,
              <BarChart3 className="w-5 h-5" />,
              <Globe className="w-5 h-5" />,
              <Lock className="w-5 h-5" />
            ];

            const iconColors = [
              'bg-emerald-500/10 text-emerald-500',
              'bg-rose-500/10 text-rose-500',
              'bg-teal-500/10 text-teal-500',
              'bg-indigo-500/10 text-indigo-500',
              'bg-amber-500/10 text-amber-500',
              'bg-blue-500/10 text-blue-500',
              'bg-violet-500/10 text-violet-500',
              'bg-emerald-500/10 text-emerald-500'
            ];

            return (
              <div 
                key={idx} 
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-[2rem] p-6 hover:-translate-y-1 hover:shadow-xl transition-all flex flex-col items-start gap-4"
              >
                <div className={`p-3 rounded-2xl ${iconColors[idx]}`}>
                  {featureIcons[idx] || <Check className="w-5 h-5" />}
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Workflow Timeline Section */}
      <section id="how-it-works" className="py-20 bg-slate-100/40 dark:bg-slate-900/10 border-y border-slate-100 dark:border-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Timeline title */}
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <span className="text-emerald-500 font-extrabold text-xs tracking-widest uppercase block bg-emerald-500/10 w-fit mx-auto px-3.5 py-1.5 rounded-full">
              {language === 'ar' ? 'سلسلة تبدأ بخطوة' : 'A Simple 4-Step Cycle'}
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 dark:text-white">
              {currentLangText.workflowTitle}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-semibold">
              {currentLangText.workflowSubtitle}
            </p>
          </div>

          {/* Grid workflow connectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            
            {currentLangText.workflowSteps.map((item, idx) => {
              const stepBadgeColors = [
                'bg-emerald-500 text-white',
                'bg-emerald-500 text-white',
                'bg-indigo-500 text-white',
                'bg-amber-500 text-white'
              ];

              return (
                <div key={idx} className="relative flex flex-col items-center text-center group bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900/60 p-6 rounded-[2rem] shadow-xs">
                  
                  {/* Step Number Sphere */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xs mb-4 shadow-md ${stepBadgeColors[idx]}`}>
                    {idx + 1}
                  </div>

                  <span className="text-[10px] uppercase font-mono font-black text-slate-400 mb-1 block">
                    {item.step}
                  </span>

                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    {item.desc}
                  </p>

                  {/* Horizontal visual indicator line on desktops only */}
                  {idx < 3 && (
                    <div className={`hidden lg:block absolute top-10 ${isRtl ? '-start-4 transform translate-x-1/2' : '-end-4 transform -translate-x-1/2'} w-8 h-0.5 border-t border-dashed border-slate-200 dark:border-slate-800 -z-5`} />
                  )}
                </div>
              );
            })}

          </div>

        </div>
      </section>

      {/* 6. App Views / Screens Preview Section */}
      <section className="py-20 md:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <span className="text-emerald-500 font-extrabold text-xs uppercase block bg-emerald-500/10 w-fit mx-auto px-3 py-1.5 rounded-full">
            {language === 'ar' ? 'واجهات مصممة بعناية' : 'Polished Interfaces'}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 dark:text-white">
            {currentLangText.previewSectionTitle}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold">
            {currentLangText.previewSectionSubtitle}
          </p>
        </div>

        {/* Tab Controls Selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10 max-w-5xl mx-auto">
          {Object.entries(currentLangText.previewTabs).map(([key, value]) => {
            const isActive = activePreviewTab === key;
            return (
              <button
                key={key}
                onClick={() => setActivePreviewTab(key as any)}
                className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10' 
                    : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-100 dark:border-slate-850'
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>

        {/* Clickable Tab Screen Body Presentation mockup */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-805 rounded-[2.5rem] shadow-2xl p-6 md:p-8 overflow-hidden min-h-[360px] flex flex-col justify-between relative">
          
          {/* Glowing gradient background indicator */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -z-5" />

          {activePreviewTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-850 pb-4">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  <span>{currentLangText.previewTabs.dashboard}</span>
                </span>
                <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg font-black font-mono">
                  {language === 'ar' ? 'مزامنة نشطة الآن' : 'Cloud Sync Live'}
                </span>
              </div>

              {/* Stats simulations */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Available Cache card */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    {currentLangText.previewData.dashboard.balance}
                  </span>
                  <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    {previewCurrency === 'LYD' ? '4,525 د.ل' : '$735'}
                  </p>
                </div>
                {/* Total incomes */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    {currentLangText.previewData.dashboard.inc}
                  </span>
                  <p className="text-xl font-black text-emerald-505 text-emerald-500 font-mono">
                    {previewCurrency === 'LYD' ? '8,000 د.ل' : '$1,300'}
                  </p>
                </div>
                {/* Expenses */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    {currentLangText.previewData.dashboard.exp}
                  </span>
                  <p className="text-xl font-black text-rose-500 font-mono">
                    {previewCurrency === 'LYD' ? '3,475 د.ل' : '$565'}
                  </p>
                </div>
              </div>

              {/* Dynamic visual slider */}
              <div className="space-y-2 p-5 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-2xl">
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-350">
                  <span>{currentLangText.previewData.dashboard.remain}</span>
                  <span className="font-mono text-emerald-500">{previewCurrency === 'LYD' ? '3,525 د.ل' : '$573'}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '56.5%' }} />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold italic text-start">
                  {language === 'ar' ? 'لقد احتفظت بنسبة 56% من قيمة عوائدك لشهر مايو بنجاح!' : 'You successfully retained 56% of your aggregate incomes for May!'}
                </p>
              </div>
            </div>
          )}

          {activePreviewTab === 'expenses' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-850 pb-4">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-rose-500" />
                  <span>{currentLangText.previewData.expenses.title}</span>
                </span>
                <span className="text-xs text-slate-400 font-sans">{language === 'ar' ? 'فواتير ومشتريات ومصارف' : 'Receipts & accounts'}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-start">
                      <th className="py-2.5 text-start">{currentLangText.previewData.expenses.headers[0]}</th>
                      <th className="py-2.5 text-start">{currentLangText.previewData.expenses.headers[1]}</th>
                      <th className="py-2.5 text-start">{currentLangText.previewData.expenses.headers[2]}</th>
                      <th className="py-2.5 text-start">{currentLangText.previewData.expenses.headers[3]}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-850 font-medium">
                    <tr>
                      <td className="py-3 text-start font-bold">
                        {language === 'ar' ? 'فاتورة بقالة تموين الشهر' : 'Monthly Premium Groceries'}
                      </td>
                      <td className="py-3 text-start">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-sm font-bold text-[10px]">
                          {language === 'ar' ? 'البيت والمطبخ' : 'Groceries'}
                        </span>
                      </td>
                      <td className="py-3 text-start font-mono text-slate-400">2026-05-24</td>
                      <td className="py-3 text-start font-mono text-rose-500 text-base font-bold">
                        {previewCurrency === 'LYD' ? '245 د.ل' : '$40'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 text-start font-bold">
                        {language === 'ar' ? 'صيانة دورية فرامل سيارة' : 'Scheduled Brake Maintenance'}
                      </td>
                      <td className="py-3 text-start">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-sm font-bold text-[10px]">
                          {language === 'ar' ? 'صيانة وسيارة' : 'Auto & Parts'}
                        </span>
                      </td>
                      <td className="py-3 text-start font-mono text-slate-400">2026-05-21</td>
                      <td className="py-3 text-start font-mono text-rose-500 text-base font-bold">
                        {previewCurrency === 'LYD' ? '460 د.ل' : '$75'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 text-start font-bold">
                        {language === 'ar' ? 'شحن رصيد باقة هاتف ليبيانا' : 'Libyana Internet Top-up'}
                      </td>
                      <td className="py-3 text-start">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-sm font-bold text-[10px]">
                          {language === 'ar' ? 'اتصالات وانترنت' : 'Telecom'}
                        </span>
                      </td>
                      <td className="py-3 text-start font-mono text-slate-400">2026-05-18</td>
                      <td className="py-3 text-start font-mono text-rose-500 text-base font-bold">
                        {previewCurrency === 'LYD' ? '61.5 د.ل' : '$10'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activePreviewTab === 'jamiya' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-850 pb-4">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <span>{currentLangText.previewData.jamiya.name}</span>
                </span>
                <span className="text-xs px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg font-bold">
                  {currentLangText.previewData.jamiya.status}
                </span>
              </div>

              {/* Members matrix log preview */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold text-slate-600 dark:text-slate-350">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{currentLangText.previewData.jamiya.members}</span>
                    <span className="text-slate-800 dark:text-slate-250 font-sans">5 {language === 'ar' ? 'أعضاء' : 'Members'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{currentLangText.previewData.jamiya.rate}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">
                      {previewCurrency === 'LYD' ? '1,000 د.ل/شهر' : '$160/mo'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 block">{currentLangText.previewData.jamiya.currentTurn}</span>
                    <span className="text-slate-800 dark:text-slate-250 font-extrabold text-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping" />
                      <span>{language === 'ar' ? 'سالم البوعيشي (الدور الثالث)' : 'Salem Al-Bouaishi (Turn 3)'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Member payment status table bar */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-slate-450 block text-start">{language === 'ar' ? 'متابعة سداد واشتراك المشتركون:' : 'Participant contributions check:'}</span>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {[
                    { name: 'محمد', turn: 'الشهر 1', status: 'paid' },
                    { name: 'أنت (عمر)', turn: 'الشهر 2', status: 'paid' },
                    { name: 'سالم', turn: 'الشهر 3 - استلام', status: 'paid' },
                    { name: 'أشرف', turn: 'الشهر 4', status: 'unpaid' },
                    { name: 'أيمن', turn: 'الشهر 5', status: 'unpaid' }
                  ].map((m, i) => (
                    <div key={i} className={`p-2.5 border rounded-xl flex items-center justify-between text-start ${m.status === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                      <div>
                        <span className="text-[11px] font-black block text-slate-800 dark:text-slate-200">{m.name}</span>
                        <span className="text-[8.5px] text-slate-400 block leading-tight">{m.turn}</span>
                      </div>
                      <div>
                        {m.status === 'paid' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-350 dark:border-slate-800 inline-block" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activePreviewTab === 'purchases' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-850 pb-4">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-500" />
                  <span>{currentLangText.previewData.purchases.title}</span>
                </span>
                <span className="text-xs px-2.5 py-0.5 bg-amber-50 text-amber-600 rounded-lg font-bold">
                  {language === 'ar' ? 'ادخار ذكي مستهدف' : 'Targeted Goal-Based Savings'}
                </span>
              </div>

              {/* Checklist simulation */}
              <div className="space-y-3">
                
                {/* 1 */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
                        {language === 'ar' ? 'اشتراك منصة تعليمية للتطوير' : 'Advanced Cloud Coding Course'}
                      </h4>
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{language === 'ar' ? 'سعر مخصص وهامش ادخار مكتمل ٢٠٢٦-٠٦' : 'Full storage completed ready to buy 2026-06'}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 font-mono block">
                      {previewCurrency === 'LYD' ? '1,230 د.ل' : '$200'}
                    </span>
                    <span className="text-[8.5px] px-1 bg-emerald-500/10 text-emerald-600 rounded-sm font-bold uppercase">
                      {language === 'ar' ? 'جاهز للشراء ✓' : 'Completed ✓'}
                    </span>
                  </div>
                </div>

                {/* 2 */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full border border-amber-500/40 inline-block text-center flex-shrink-0" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 leading-tight">
                        {language === 'ar' ? 'جهاز تكييف غسالة منزلية كبرى' : 'Dual Inverter Household Air Conditioner'}
                      </h4>
                      <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{language === 'ar' ? 'أولوية قصوى - لابد من الشراء قبل الصيف' : 'Summer urgent preparation goal'}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 font-mono block">
                      {previewCurrency === 'LYD' ? '2,767 د.ل' : '$450'}
                    </span>
                    <span className="text-[8.5px] px-1 bg-amber-500/10 text-amber-600 rounded-sm font-bold uppercase">
                      70% {language === 'ar' ? 'ادخار' : 'collected'}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {activePreviewTab === 'reports' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-850 pb-4">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-505 text-indigo-500" />
                  <span>{currentLangText.previewData.reports.topCats}</span>
                </span>
                <span className="text-xs text-slate-400">{language === 'ar' ? 'تحاليل محاسبة ذكية' : 'Intelligent cost audits'}</span>
              </div>

              {/* Simulated horizontal bars */}
              <div className="space-y-4">
                {[
                  { cat: language === 'ar' ? 'البيت والوجبات والمطبخ' : 'Household, Kitchen & Meals', percent: 45, color: 'bg-emerald-550 bg-emerald-500' },
                  { cat: language === 'ar' ? 'السيارة والوقود والصيانة' : 'Automobile & Transportation Fuel', percent: 25, color: 'bg-amber-500' },
                  { cat: language === 'ar' ? 'الاشتراكات والخدمات الرقمية' : 'Digital Platform & Software Bills', percent: 18, color: 'bg-indigo-500' },
                  { cat: language === 'ar' ? 'الصحة والطبابة والطوارئ' : 'Emergency & Medical services', percent: 12, color: 'bg-rose-500' },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-650 text-slate-600 dark:text-slate-350">
                      <span>{item.cat}</span>
                      <span className="font-mono text-[11px] font-black">{item.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-850 rounded-full h-2">
                      <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-50 dark:border-slate-850 text-start">
                <p className="text-xs font-medium text-slate-550 text-slate-500 leading-relaxed italic">
                  {language === 'ar' 
                    ? '💡 نصيحة خبير عزيز المالي: معدل استهلاكك على متطلبات البيت والتموين أعلى بنسبة ٧٪ من المتوسط المقترح لميزانيتك. يُنصح بالاستفادة من الشراء بأسعار الجملة لتوفير ما يقارب ١٢٠ د.ل شهرياً.'
                    : '💡 Aziz Advisory Insight: Grocery expenditure ranges 7% higher than your strict budget template threshold. Consider collective wholesale bulk purchases to save approximately $25 monthly.'}
                </p>
              </div>
            </div>
          )}

          {/* Prompt action under the preview box */}
          <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4 text-start">
            <div>
              <h5 className="text-xs font-black text-slate-800 dark:text-slate-205 text-slate-200">
                {language === 'ar' ? 'أعجبتك هذه الواجهات الفاخرة؟' : 'Love these elegant, minimal panels?'}
              </h5>
              <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">
                {language === 'ar' ? 'سجل معنا الآن بضغطة واحدة واكتشف لوحة تحكمك الكاملة فوراً' : 'Complete a one-click signup and deploy your master workspace instantly'}
              </p>
            </div>
            <button 
              onClick={loginWithGoogle}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/10"
            >
              <span>{currentLangText.ctaGoogle}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>

        </div>
      </section>

      {/* 7. Associations / Jamiya Deep Dive Explanation Section */}
      <section id="associations" className="py-20 md:py-28 bg-white dark:bg-slate-950/60 border-y border-slate-150/40 dark:border-slate-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Info Column */}
            <div className="lg:col-span-6 space-y-6 text-start">
              <span className="text-indigo-650 text-indigo-500 font-extrabold text-xs tracking-wider uppercase bg-indigo-500/10 px-3.5 py-1.5 rounded-full inline-block">
                {language === 'ar' ? 'الجمعية التشاركية الدوارة' : 'Collaborative Banking Circle'}
              </span>

              <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 dark:text-white leading-tight">
                {currentLangText.jamiyaExplanationTitle}
              </h2>

              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-wider block leading-relaxed">
                {currentLangText.jamiyaExplanationSubtitle}
              </p>

              <div className="border-l-4 border-emerald-500 ps-4 space-y-2 mt-2">
                <p className="text-slate-600 dark:text-slate-350 text-sm leading-relaxed font-semibold">
                  {currentLangText.jamiyaExplanationText1}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={loginWithGoogle}
                  className="px-6 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 font-black rounded-2xl shadow-lg shadow-slate-900/15 cursor-pointer text-sm"
                >
                  {currentLangText.jamiyaExplanationBtn}
                </button>
              </div>
            </div>

            {/* Right Interactive Example Graphic */}
            <div className="lg:col-span-6">
              <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900 border border-slate-150/40 dark:border-slate-800/80 rounded-[2.5rem] shadow-xl relative">
                
                <h4 className="text-sm font-black text-slate-850 dark:text-slate-150 flex items-center gap-1.5 mb-4 text-start">
                  <PiggyBank className="w-5 h-5 text-emerald-500" />
                  <span>{currentLangText.jamiyaExplanationExampleTitle}</span>
                </h4>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-semibold mb-6 text-start">
                  {currentLangText.jamiyaExplanationExampleText}
                </p>

                {/* Simulated circle of members payout flow */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{language === 'ar' ? 'العضو الأول (الشهر الأول)' : 'Member One (Month 1)'}</span>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black font-mono">
                      + 5,000 د.ل
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl opacity-80">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{language === 'ar' ? 'العضو الثاني (الشهر الثاني)' : 'Member Two (Month 2)'}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-black font-mono">
                      + 5,000 د.ل
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl opacity-50">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{language === 'ar' ? 'العضو الثالث إلخ...' : 'Member Three, etc...'}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      ...
                    </span>
                  </div>
                </div>

                {/* Subtext info */}
                <div className="mt-5 text-[10px] text-slate-400 font-bold leading-relaxed text-center bg-slate-100/60 dark:bg-slate-950/40 py-2 px-3 rounded-lg">
                  {language === 'ar' 
                    ? '💡 هل تعلم؟ يقوم عزيز بحساب الأقساط أوتوماتيكياً وتسجيل مصفوفات الانتظام بفاعلية مطلقة.' 
                    : '💡 Did you know? Aziz calculates custom cyclic dues & records attendance columns with zero error.'}
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 8. Security Section */}
      <section id="security" className="py-20 md:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-emerald-500 font-black text-xs uppercase block bg-emerald-500/10 w-fit mx-auto px-3.5 py-1.5 rounded-full">
            {language === 'ar' ? 'حصن وحماية معتمدة' : 'Continuous Protection layers'}
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-950 dark:text-white">
            {currentLangText.securityTitle}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-semibold">
            {currentLangText.securityDesc}
          </p>
        </div>

        {/* Security Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {currentLangText.securityList.map((item, idx) => {
            const protectionIcons = [
              <Lock className="w-6 h-6 text-emerald-500" />,
              <Shield className="w-6 h-6 text-indigo-500" />,
              <Calendar className="w-6 h-6 text-amber-500" />,
              <Eye className="w-6 h-6 text-rose-500" />
            ];

            return (
              <div 
                key={idx} 
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-[2rem] p-6 lg:p-8 flex gap-5 hover:shadow-xl transition-all"
              >
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl self-start h-fit flex-shrink-0">
                  {protectionIcons[idx] || <Lock className="w-6 h-6 text-emerald-500" />}
                </div>

                <div className="space-y-2 text-start">
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {item.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. Final Grand Call-to-Action Card */}
      <section className="py-16 md:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative mb-12">
        
        {/* Visual card content */}
        <div className="p-8 sm:p-12 md:p-16 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 dark:from-slate-900 dark:to-slate-950 text-white rounded-[3rem] text-center space-y-8 shadow-2xl relative overflow-hidden border border-emerald-500/20">
          
          {/* Neon background circle decoration */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] bg-emerald-500/5 rounded-full blur-[120px] -z-1" />

          <div className="max-w-3xl mx-auto space-y-4">
            <span className="text-emerald-400 font-black text-xs uppercase block bg-emerald-400/10 w-fit mx-auto px-3.5 py-1.5 rounded-full">
              {language === 'ar' ? 'التطبيق متاح وجاهز مجاناً' : 'Free Workspace Ready'}
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
              {currentLangText.finalCtaTitle}
            </h2>
            <p className="text-slate-350 dark:text-slate-400 text-sm sm:text-base md:text-lg max-w-xl mx-auto leading-relaxed font-medium">
              {currentLangText.finalCtaSubtitle}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <button
              onClick={loginWithGoogle}
              className="px-8 py-5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2.5xl flex items-center gap-3 shadow-xl shadow-emerald-500/15 hover:-translate-y-0.5 transition-all text-base sm:text-lg cursor-pointer cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#FFFFFF"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 7.99 12.5a5.99 5.99 0 0 1 6.002-6.015c1.614 0 3.084.623 4.194 1.638l3.221-3.22C19.458 3.12 16.03 2 12 2 6.477 2 2 6.477 2 12s4.477 10 10 10c5.5 0 10-4.5 10-10a9.7 9.7 0 0 0-.25-2.285H12.24Z"
                />
              </svg>
              <span>{currentLangText.finalCtaBtn}</span>
            </button>
            <p className="text-xs text-slate-400 font-bold leading-relaxed block">
              {currentLangText.finalCtaNote}
            </p>
          </div>

        </div>
      </section>

      {/* 10. Footer Section */}
      <footer className="mt-auto py-12 border-t border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 text-white rounded-lg flex items-center justify-center font-bold text-xs">
              ع
            </div>
            <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1 font-sans">
              <span>{language === 'ar' ? 'عزيز المالي' : 'Aziz Finance'}</span>
            </span>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold max-w-md text-center sm:text-end">
            {currentLangText.rights}
          </p>

        </div>
      </footer>

    </div>
  );
};
