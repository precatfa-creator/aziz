/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Settings as SettingsIcon, 
  Languages, 
  Coins, 
  DollarSign, 
  User, 
  ShieldAlert, 
  Sparkles, 
  LogOut, 
  Check, 
  RefreshCw,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  X 
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { read, utils } from 'xlsx';

interface ParsedEntry {
  date: string;
  title: string;
  amount: number;
  currency: "LYD" | "USD";
  categoryName: string;
  type: "income" | "expense";
  notes?: string;
}

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
    logout,
    categories,
    addCategory,
    addIncome,
    addExpense
  } = useApp();

  // Profile Form State
  const [profileName, setProfileName] = useState(profile?.name || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Historical Import States
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [isAIAnalyzing, setIsAIAnalyzing] = useState(false);
  const [aiStep, setAiStep] = useState(0);
  const [aiExplanation, setAiExplanation] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Parse table pasted data
  const parseData = (text: string): ParsedEntry[] => {
    if (!text || !text.trim()) return [];
    const lines = text.trim().split("\n");
    const parsed: ParsedEntry[] = [];

    const firstLine = lines[0].toLowerCase();
    const headers = firstLine.split(/\t|,|;/);

    let dateIdx = -1;
    let titleIdx = -1;
    let amountIdx = -1;
    let currencyIdx = -1;
    let categoryIdx = -1;
    let typeIdx = -1;
    let notesIdx = -1;

    const dateSynonyms = ['date', 'تاريخ', 'التاريخ', 'day', 'time'];
    const titleSynonyms = ['title', 'عنوان', 'العنوان', 'description', 'البيان', 'البيانات', 'بيان', 'البيان/الوصف', 'وصف', 'نام', 'item', 'عملية'];
    const amountSynonyms = ['amount', 'قيمة', 'القيمة', 'مبلغ', 'المبلغ', 'سعر', 'price', 'value', 'الكمية'];
    const currencySynonyms = ['currency', 'عمللة', 'العملة', 'coin', 'وحدة'];
    const categorySynonyms = ['category', 'تصنيف', 'التصنيف', 'نوع التصنيف', 'family', 'group'];
    const typeSynonyms = ['type', 'نوع', 'النوع', 'اتجاه', 'classification'];
    const notesSynonyms = ['notes', 'ملاحظات', 'الملاحظات', 'تفاصيل', 'بيانات', 'details', 'comment'];

    headers.forEach((h, i) => {
      const cleanH = h.trim();
      if (dateSynonyms.some(s => cleanH.includes(s))) dateIdx = i;
      else if (titleSynonyms.some(s => cleanH.includes(s))) titleIdx = i;
      else if (amountSynonyms.some(s => cleanH.includes(s))) amountIdx = i;
      else if (currencySynonyms.some(s => cleanH.includes(s))) currencyIdx = i;
      else if (categorySynonyms.some(s => cleanH.includes(s))) categoryIdx = i;
      else if (typeSynonyms.some(s => cleanH.includes(s))) typeIdx = i;
      else if (notesSynonyms.some(s => cleanH.includes(s))) notesIdx = i;
    });

    const isHeaderValid = dateIdx !== -1 || titleIdx !== -1 || amountIdx !== -1;
    const startIndex = isHeaderValid ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cells = line.split(/\t|,|;/);
      if (cells.length < 2) continue;

      const dVal = dateIdx !== -1 ? (cells[dateIdx] || '').trim() : (cells[0] || '').trim();
      const tVal = titleIdx !== -1 ? (cells[titleIdx] || '').trim() : (cells[1] || '').trim();
      const aVal = amountIdx !== -1 ? (cells[amountIdx] || '').trim() : (cells[2] || '').trim();
      const cVal = currencyIdx !== -1 ? (cells[currencyIdx] || '').trim() : (cells[3] || '').trim();
      const catVal = categoryIdx !== -1 ? (cells[categoryIdx] || '').trim() : (cells[4] || '').trim();
      const typeVal = typeIdx !== -1 ? (cells[typeIdx] || '').trim() : (cells[5] || '').trim();
      const nVal = notesIdx !== -1 ? (cells[notesIdx] || '').trim() : (cells[6] || '').trim();

      const parsedAmount = parseFloat(aVal.replace(/[^0-9.-]+/g, ""));
      if (isNaN(parsedAmount) || !tVal) continue;

      let finalDate = dVal;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
        finalDate = new Date().toISOString().split('T')[0];
      }

      let finalCurrency: "LYD" | "USD" = "LYD";
      const lowerC = cVal.toLowerCase();
      if (lowerC.includes('$') || lowerC.includes('usd') || lowerC.includes('دولار')) {
        finalCurrency = "USD";
      }

      let finalType: "income" | "expense" = "expense";
      const lowerType = typeVal.toLowerCase();
      if (
        lowerType.includes('وارد') || 
        lowerType.includes('income') || 
        lowerType.includes('دخل') || 
        lowerType.includes('deposit') || 
        lowerType.includes('إيداع')
      ) {
        finalType = "income";
      }

      parsed.push({
        date: finalDate,
        title: tVal,
        amount: parsedAmount,
        currency: finalCurrency,
        categoryName: catVal || "",
        type: finalType,
        notes: nVal || ""
      });
    }

    return parsed;
  };

  // Resolve Category name to existing ID, or create one programmatically
  const matchOrCreateCategory = async (catName: string, type: "income" | "expense"): Promise<string> => {
    const cleanName = (catName || "").trim().toLowerCase();
    if (!cleanName) {
      const fallbackName = type === 'income' 
        ? "وارد غير مصنف / Uncategorized Income"
        : "مصروف غير مصنف / Uncategorized Expense";
      const matched = categories.find(c => c.type === type && c.name === fallbackName);
      if (matched) return matched.id;
      return await addCategory(fallbackName, type, type === 'income' ? '#10b981' : '#f43f5e', type === 'income' ? 'TrendingUp' : 'TrendingDown');
    }

    const matched = categories.find(c => {
      if (c.type !== type) return false;
      const originalName = c.name.toLowerCase();
      if (originalName === cleanName) return true;
      const parts = originalName.split(/\s*\/\s*/);
      return parts.some(part => part === cleanName);
    });

    if (matched) {
      return matched.id;
    }

    // Auto-create category formatted as "Arabic Name / English Name"
    const formattedName = language === 'ar' ? `${catName} / Historical` : `Historical / ${catName}`;
    const newId = await addCategory(
      formattedName,
      type,
      type === 'income' ? '#34d399' : '#f87171',
      type === 'income' ? 'TrendingUp' : 'TrendingDown'
    );
    return newId;
  };

  // Save parsed entries to Firestore ledger
  const handleSaveImport = async () => {
    if (parsedEntries.length === 0) return;
    setIsImporting(true);
    setImportError("");
    setImportSuccess("");

    try {
      let savedCount = 0;
      for (const entry of parsedEntries) {
        const catId = await matchOrCreateCategory(entry.categoryName, entry.type);
        if (entry.type === "income") {
          await addIncome(
            entry.amount,
            entry.currency,
            entry.title,
            entry.date,
            catId,
            entry.notes || (language === "ar" ? "عملية مستوردة تاريخياً" : "Historically imported ledger row"),
            undefined,
            "medium",
            undefined,
            true, // isHistorical: true!
            entry.categoryName
          );
        } else {
          await addExpense(
            entry.amount,
            entry.currency,
            entry.title,
            entry.date,
            catId,
            entry.notes || (language === "ar" ? "عملية مستوردة تاريخياً" : "Historically imported ledger row"),
            undefined,
            "medium",
            undefined,
            true, // isHistorical: true!
            entry.categoryName
          );
        }
        savedCount++;
      }

      setImportSuccess(
        language === "ar"
          ? `نجاح! تم استيراد ومزامنة ${savedCount} عملية تاريخية وحفظها في محفظتك بنجاح.`
          : `Success! Imported and synced ${savedCount} historical items to your wallet successfully.`
      );
      setParsedEntries([]);
      setImportText("");
      setAiExplanation("");
    } catch (err: any) {
      console.error("Save import error:", err);
      setImportError(
        language === "ar"
          ? `حدث خطأ أثناء حفظ العمليات: ${err.message}`
          : `Error saving imported transactions: ${err.message}`
      );
    } finally {
      setIsImporting(false);
    }
  };

  // AI-powered analysis with Gemini API via backend proxy
  const handleAIAnalyze = async () => {
    if (!importText.trim()) return;
    setIsAIAnalyzing(true);
    setImportError("");
    setAiExplanation("");
    setAiStep(0);

    const stepInterval = setInterval(() => {
      setAiStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1500);

    try {
      const response = await fetch("/api/ai/analyze-sheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: importText,
          language,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const result = await response.json();
      setParsedEntries(result.entries || []);
      setAiExplanation(result.explanation || "");
    } catch (err: any) {
      console.error("AI Analysis error:", err);
      setImportError(
        language === "ar"
          ? `فشل استدعاء ذكاء عزيز الاصطناعي: ${err.message}`
          : `Aziz AI analysis request failed: ${err.message}`
      );
    } finally {
      clearInterval(stepInterval);
      setIsAIAnalyzing(false);
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

            </div>
          </div>

          {/* Migrations Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                {language === 'ar' ? 'بيانات الترحيل والأرشيف التاريخي' : 'Migrations & Historical Ledger Import'}
              </h3>
              <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                {language === 'ar' ? 'بذكاء عزيز AI' : 'AI Powered by Aziz'}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {language === 'ar'
                ? "ارفع مستنداتك القديمة (Excel أو CSV) أو ألصق الجداول مباشرة لتنظيمها وتصنيفها كأرشيف تاريخي معزول وآمن. يضمن لك هذا بقاء الأرصدة والجمعيات الحالية بمنأى عن عملياتك السابقة."
                : "Upload ancient CSV worksheets or drag-drop spreadsheet tables (Excel) to migrate legacy finance logs. Imported history is safely isolated to prevent skewing active wallet metrics."}
            </p>

            {importSuccess && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/45 border border-emerald-250/20 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold leading-relaxed">
                {importSuccess}
              </div>
            )}

            {importError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/45 border border-rose-250/20 rounded-2xl text-rose-500 text-xs font-bold leading-relaxed flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>{importError}</span>
              </div>
            )}

            {parsedEntries.length === 0 ? (
              <div className="space-y-4">
                {/* Text area for table rows */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">
                    {language === "ar" ? "لصق بيانات الجدول المنسوخة" : "Paste Table Rows Content"}
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={5}
                    placeholder={
                      language === "ar"
                        ? "تاريخ\tعنوان\tقيمة\tعملة\tتصنيف\tنوع\n2025-11-20\tمشتريات قديمة\t250\tLYD\tملابس\tمصروف"
                        : "Date\tTitle\tAmount\tCurrency\tCategory\tType\n2025-11-20\tLegacy Expense\t250\tLYD\tClothes\texpense"
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 p-4 text-xs rounded-2xl border border-slate-100 dark:border-slate-800/80 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:text-white font-mono resize-none leading-relaxed"
                  />
                </div>

                {/* Drag component */}
                <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        const nameLower = file.name.toLowerCase();
                        setImportError("");
                        if (nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls")) {
                          reader.onload = (event) => {
                            try {
                              const data = new Uint8Array(event.target?.result as ArrayBuffer);
                              const workbook = read(data, { type: "array" });
                              const firstSheetName = workbook.SheetNames[0];
                              const worksheet = workbook.Sheets[firstSheetName];
                              const csv = utils.sheet_to_csv(worksheet);
                              setImportText(csv || "");
                            } catch (err: any) {
                              console.error("Error reading Excel file:", err);
                              setImportError(
                                language === "ar"
                                  ? `فشل قراءة ملف إكسل: ${err.message}`
                                  : `Failed to read Excel workbook: ${err.message}`
                              );
                            }
                          };
                          reader.readAsArrayBuffer(file);
                        } else {
                          reader.onload = (event) => {
                            const text = event.target?.result as string;
                            setImportText(text || "");
                          };
                          reader.readAsText(file);
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    {language === "ar" ? "تحميل ملف إكسل أو CSV مباشرة" : "Upload Excel or CSV records file"}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {language === "ar" ? "انقر هنا لتحديد الملف (.csv, .xlsx, .xls)" : "Click here to select file (.csv, .xlsx, .xls)"}
                  </span>
                </div>

                {/* Analyzer buttons */}
                {importText.trim().length > 0 && (
                  <div className="space-y-3 pt-2">
                    {isAIAnalyzing && (
                      <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-2.5 shadow-sm transition-all animate-pulse">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>
                          {language === "ar" ? (
                            aiStep === 0 ? "عزيز يقرأ الملف الآن وينظف العناوين وهيكل الأعمدة..." :
                            aiStep === 1 ? "يتم الآن تمييز التواريخ والمبالغ وتحديد العملات المناسبة..." :
                            aiStep === 2 ? "مطابقة وتصنيف الحقول وترتيب الملاحظات المرفقة..." :
                            "عزيز يجمع البيانات النهائية ويقوم بصياغة مصفوفة الـ JSON..."
                          ) : (
                            aiStep === 0 ? "Aziz is reading the file and analyzing column headers..." :
                            aiStep === 1 ? "Identifying dates, decimal amounts, and currencies..." :
                            aiStep === 2 ? "Mapping categories and preserving raw line details..." :
                            "Aziz is compiling transaction array into custom JSON structure..."
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        disabled={isAIAnalyzing}
                        onClick={() => {
                          const parsed = parseData(importText);
                          setParsedEntries(parsed);
                          setAiExplanation("");
                        }}
                        className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl cursor-pointer disabled:opacity-55 transition-all text-center leading-none"
                      >
                        {language === 'ar' ? 'تشغيل التحليل التقليدي الفوري' : 'Run Basic Parser'}
                      </button>

                      <button
                        type="button"
                        disabled={isAIAnalyzing}
                        onClick={handleAIAnalyze}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-black text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-all shadow-sm leading-none"
                      >
                        {isAIAnalyzing ? (
                          <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span>{language === 'ar' ? 'جاري التحليل بـ AI...' : 'AI Arranging Fields...'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 fill-white animate-pulse" />
                            <span>{language === 'ar' ? 'ترتيب بذكاء عزيز ✨' : 'Arrange with Aziz AI ✨'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {aiExplanation && (
                  <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-xs leading-relaxed space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" />
                      <span>{language === 'ar' ? 'تقرير عزيز للترتيب والربط الذكي:' : 'Aziz Smart Mapping Report:'}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{aiExplanation}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-350">
                    {language === "ar" ? `تم الكشف عن ${parsedEntries.length} عملية بنجاح:` : `Detected ${parsedEntries.length} entries:`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedEntries([]);
                      setImportText("");
                      setAiExplanation("");
                    }}
                    className="text-[10px] font-black text-rose-500 hover:underline cursor-pointer"
                  >
                    {language === "ar" ? "مسح وإعادة المحاولة" : "Clear & Restart"}
                  </button>
                </div>

                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[10px] leading-normal">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-500">
                        <th className="p-3 font-extrabold">{language === "ar" ? "العنوان" : "Title"}</th>
                        <th className="p-3 font-extrabold">{language === "ar" ? "التاريخ" : "Date"}</th>
                        <th className="p-3 font-extrabold">{language === "ar" ? "القيمة" : "Amount"}</th>
                        <th className="p-3 font-extrabold">{language === "ar" ? "التصنيف" : "Category"}</th>
                        <th className="p-3 font-extrabold">{language === "ar" ? "النوع" : "Type"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedEntries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <td className="p-3 font-semibold dark:text-white truncate max-w-[120px]" dir="auto">{entry.title}</td>
                          <td className="p-3 text-slate-500 font-mono">{entry.date}</td>
                          <td className="p-3 font-extrabold dark:text-white font-mono">
                            {entry.amount.toLocaleString()} {entry.currency}
                          </td>
                          <td className="p-3 text-slate-450 italic truncate max-w-[80px]" dir="auto">{entry.categoryName || "—"}</td>
                          <td className="p-3">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              entry.type === 'income' 
                                ? 'bg-emerald-500/10 text-emerald-600' 
                                : 'bg-rose-500/10 text-rose-500'
                            }`}>
                              {entry.type === 'income' 
                                ? (language === 'ar' ? 'وارد' : 'Income') 
                                : (language === 'ar' ? 'صادر' : 'Expense')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedEntries([]);
                      setImportText("");
                      setAiExplanation("");
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleSaveImport}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {isImporting ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isImporting 
                        ? (language === 'ar' ? "ترحيل وبناء..." : "Integrating...") 
                        : (language === 'ar' ? `ترحيل (${parsedEntries.length} عملية)` : `Migrate (${parsedEntries.length} rows)`)}
                    </span>
                  </button>
                </div>
              </div>
            )}
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
