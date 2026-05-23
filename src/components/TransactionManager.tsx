/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";
import {
  Plus,
  Search,
  Calendar,
  Trash2,
  Edit2,
  X,
  CreditCard,
  Tag,
  Sparkles,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Image as ImageIcon,
  Upload,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Check,
  Eye,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ConfirmModal } from "./ConfirmModal";

interface TransactionManagerProps {
  defaultType?: 'income' | 'expense';
}

export const TransactionManager: React.FC<TransactionManagerProps> = ({ defaultType }) => {
  const {
    t,
    language,
    incomes,
    expenses,
    categories,
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    deleteExpense,
    addCategory,
    wallets,
    comments,
    addComment,
    deleteComment,
  } = useApp();

  // Comment expand/input state
  const [expandedCommentsTxId, setExpandedCommentsTxId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");

  // Consolidation States
  const [transactionType, setTransactionType] = useState<"income" | "expense">(
    defaultType || "expense"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [walletFilter, setWalletFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all",);

  // Tab and Subtab Toggle
  const [activeSubTab, setActiveSubTab] = useState<"new" | "history">("new");

  useEffect(() => {
    setActiveSubTab("new");
    if (defaultType) {
      setTransactionType(defaultType);
      // Reset any active editing block
      setEditingId(null);
      setEditingType(null);
    }
  }, [defaultType]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"income" | "expense" | null>(
    null,
  );

  // Form Fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"LYD" | "USD">("LYD");
  const [date, setDate] = useState(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [selectedCatId, setSelectedCatId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [imageUrl, setImageUrl] = useState<string>(""); // Base64 dataURL

  // Searchable Dropdown for Categories
  const [typedCategoryQuery, setTypedCategoryQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Custom polished dropdowns states for the filters row
  const [walletFilterOpen, setWalletFilterOpen] = useState(false);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [priorityFilterOpen, setPriorityFilterOpen] = useState(false);

  const walletFilterRef = useRef<HTMLDivElement>(null);
  const categoryFilterRef = useRef<HTMLDivElement>(null);
  const priorityFilterRef = useRef<HTMLDivElement>(null);

  // Custom states for wallet selection when we have > 4 wallets
  const [walletSelectDropdownOpen, setWalletSelectDropdownOpen] = useState(false);
  const [walletSearchQuery, setWalletSearchQuery] = useState("");
  const walletSelectDropdownRef = useRef<HTMLDivElement>(null);

  // Pagination for transactions list
  const [visibleLimit, setVisibleLimit] = useState(20);

  // Reset pagination limit when filters undergo transition
  useEffect(() => {
    setVisibleLimit(20);
  }, [searchQuery, categoryFilter, priorityFilter, walletFilter, typeFilter]);

  // Drag-and-drop state for uploads
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Detail Modal State
  const [previewImagesList, setPreviewImagesList] = useState<string[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number>(0);

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

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
      if (
        walletFilterRef.current &&
        !walletFilterRef.current.contains(target)
      ) {
        setWalletFilterOpen(false);
      }
      if (
        categoryFilterRef.current &&
        !categoryFilterRef.current.contains(target)
      ) {
        setCategoryFilterOpen(false);
      }
      if (
        priorityFilterRef.current &&
        !priorityFilterRef.current.contains(target)
      ) {
        setPriorityFilterOpen(false);
      }
      if (
        walletSelectDropdownRef.current &&
        !walletSelectDropdownRef.current.contains(target)
      ) {
        setWalletSelectDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter existing categories with current typing based on active type
  const availableCategories = categories.filter(
    (c) => c.type === transactionType && !c.isArchived,
  );

  const filteredDropCategories = availableCategories.filter((c) => {
    const localizedName =
      c.name.split(" / ")[language === "ar" ? 0 : 1] || c.name;
    return localizedName
      .toLowerCase()
      .includes(typedCategoryQuery.toLowerCase());
  });

  const exactMatchExists = availableCategories.some((c) => {
    const localizedName =
      c.name.split(" / ")[language === "ar" ? 0 : 1] || c.name;
    return (
      localizedName.toLowerCase() === typedCategoryQuery.trim().toLowerCase()
    );
  });

  // Handle direct addition from dropdown
  const handleAddNewCategoryInline = async () => {
    if (!typedCategoryQuery.trim()) return;
    try {
      const catName = typedCategoryQuery.trim();
      const colors = [
        "rose",
        "amber",
        "sky",
        "orange",
        "red",
        "purple",
        "violet",
        "emerald",
        "indigo",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const icons = [
        "Tag",
        "Coins",
        "Wallet",
        "ShoppingBag",
        "Home",
        "Car",
        "Heart",
        "Smile",
      ];
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];

      const newId = await addCategory(
        catName,
        transactionType,
        randomColor,
        randomIcon,
      );
      setSelectedCatId(newId);
      setTypedCategoryQuery(catName);
      setDropdownOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const selectCategoryFromDropdown = (cat: any) => {
    setSelectedCatId(cat.id);
    const localizedName =
      cat.name.split(" / ")[language === "ar" ? 0 : 1] || cat.name;
    setTypedCategoryQuery(localizedName);
    setDropdownOpen(false);
  };

  // Submit main consolidated ledger entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !title || !selectedCatId || !walletId) return;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    try {
      if (editingId && editingType) {
        // If they changed the type during edit, delete old and create new or update in correct type
        if (editingType !== transactionType) {
          // Type changed! Delete from previous collection and add to the new collection
          if (editingType === "income") {
            await deleteIncome(editingId);
            if (transactionType === "expense") {
              await addExpense(
                numericAmount,
                currency,
                title,
                date,
                selectedCatId,
                notes,
                imageUrl,
                priority,
                walletId,
              );
            }
          } else {
            await deleteExpense(editingId);
            if (transactionType === "income") {
              await addIncome(
                numericAmount,
                currency,
                title,
                date,
                selectedCatId,
                notes,
                imageUrl,
                priority,
                walletId,
              );
            }
          }
        } else {
          // Update in same collection
          if (transactionType === "income") {
            await updateIncome(
              editingId,
              numericAmount,
              currency,
              title,
              date,
              selectedCatId,
              notes,
              imageUrl,
              priority,
              walletId,
            );
          } else {
            await updateExpense(
              editingId,
              numericAmount,
              currency,
              title,
              date,
              selectedCatId,
              notes,
              imageUrl,
              priority,
              walletId,
            );
          }
        }
      } else {
        // Standard Add
        if (transactionType === "income") {
          await addIncome(
            numericAmount,
            currency,
            title,
            date,
            selectedCatId,
            notes,
            imageUrl,
            priority,
            walletId,
          );
        } else {
          await addExpense(
            numericAmount,
            currency,
            title,
            date,
            selectedCatId,
            notes,
            imageUrl,
            priority,
            walletId,
          );
        }
      }
      resetForm();
      setActiveSubTab("history");
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (tx: any) => {
    setEditingId(tx.id);
    setEditingType(tx.type);
    setTransactionType(tx.type);
    setTitle(tx.title);
    setAmount(tx.amount.toString());
    setCurrency(tx.currency);
    setDate(tx.date);
    setSelectedCatId(tx.categoryId);
    setWalletId(tx.walletId || "");
    setPriority(tx.priority || "medium");
    setImageUrl(tx.imageUrl || "");

    const catObj = categories.find((c) => c.id === tx.categoryId);
    if (catObj) {
      const localized =
        catObj.name.split(" / ")[language === "ar" ? 0 : 1] || catObj.name;
      setTypedCategoryQuery(localized);
    } else {
      setTypedCategoryQuery("");
    }
    setNotes(tx.notes || "");
    setActiveSubTab("new");
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingType(null);
    setTransactionType("expense");
    setTitle("");
    setAmount("");
    setCurrency("LYD");
    setDate(new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    setNotes("");
    setSelectedCatId("");
    setWalletId("");
    setTypedCategoryQuery("");
    setPriority("medium");
    setImageUrl("");
  };

  // Drag & drop file loaders
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const compressAndResizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          const maxDim = 1020; // Auto-resize large images preserving superb quality
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to lightweight JPEG at 0.82 quality
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve(dataUrl);
        };
        img.onerror = () => {
          resolve(event.target?.result as string);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const processFiles = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (validFiles.length === 0) {
      alert(
        language === "ar"
          ? "يرجى تحميل ملفات صور صالحة فقط"
          : "Please upload valid image files only",
      );
      return;
    }

    try {
      const promises = validFiles.map((file) => compressAndResizeImage(file));
      const processedImages = await Promise.all(promises);
      
      const currentArr = imageUrl ? imageUrl.split("|").filter(Boolean) : [];
      const updatedImages = [...currentArr, ...processedImages];
      setImageUrl(updatedImages.join("|"));
    } catch (error) {
      console.error("Error compressing/resizing images:", error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  // Consolidate Incomes & Expenses under a single list
  const consolidatedTransactions = [
    ...incomes.map((inc) => ({ ...inc, type: "income" as const })),
    ...expenses.map((exp) => ({ ...exp, type: "expense" as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filters application
  const filteredTransactions = consolidatedTransactions.filter((tx) => {
    const matchSearch =
      tx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = categoryFilter ? tx.categoryId === categoryFilter : true;
    const matchType = typeFilter === "all" ? true : tx.type === typeFilter;
    const matchPriority = priorityFilter ? tx.priority === priorityFilter : true;
    const matchWallet = walletFilter ? tx.walletId === walletFilter : true;
    return matchSearch && matchCat && matchType && matchPriority && matchWallet;
  });

  const getCatColorCombined = (color: string) => {
    const colors: Record<string, string> = {
      rose: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/30",
      amber:
        "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/30",
      sky: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/30",
      orange:
        "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-450 border border-orange-200/30",
      red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 border border-red-200/30",
      purple:
        "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/30",
      violet:
        "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400 border border-violet-200/30",
      emerald:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/30",
      indigo:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/30",
      slate:
        "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-700/30",
    };
    return (
      colors[color] ||
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
    );
  };

  const getPriorityLabel = (p?: string) => {
    if (p === "high")
      return language === "ar" ? "مرتفعة جداً" : "High Priority";
    if (p === "low") return language === "ar" ? "منخفضة" : "Low Priority";
    return language === "ar" ? "متوسطة" : "Medium Priority";
  };

  const getPriorityStyle = (p?: string) => {
    if (p === "high")
      return "bg-rose-100/80 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400";
    if (p === "low")
      return "bg-brand-green/20 text-emerald-700 dark:bg-brand-green/10 dark:text-brand-green";
    return "bg-brand-teal/20 text-teal-700 dark:bg-brand-teal/10 dark:text-brand-teal";
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* 1. Glassmorphic Header Banner */}

      {/* Telegram-inspired top navigation tabs (2 tabs: New and History) */}
      <div className="flex justify-center mt-2 mb-6">
        <div className="inline-flex p-1.5 bg-slate-100/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/40 dark:border-slate-800/60 w-full max-w-md relative shadow-sm">
          <button
            type="button"
            id="new-tx-tab"
            onClick={() => {
              setActiveSubTab('new');
            }}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'new'
                ? 'bg-white dark:bg-slate-850 text-brand-slate dark:text-white shadow-md font-black'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 stroke-[3] transition-transform ${activeSubTab === 'new' ? 'text-brand-teal scale-110' : 'text-slate-400'}`} />
            <span>{language === 'ar' ? 'عملية جديدة' : 'New Transaction'}</span>
          </button>
          <button
            type="button"
            id="history-tx-tab"
            onClick={() => {
              setActiveSubTab('history');
            }}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-white dark:bg-slate-850 text-brand-slate dark:text-white shadow-md font-black'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'history' ? 'text-brand-teal' : 'text-slate-400'}`} />
            <span>{language === 'ar' ? 'السجل المالي' : 'Ledger / History'}</span>
            
            {/* Elegant badge with transaction counter */}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
              activeSubTab === 'history' 
                ? 'bg-brand-teal/20 text-teal-800 dark:text-brand-teal font-black' 
                : 'bg-slate-200/50 dark:bg-slate-800 text-slate-500 font-bold'
            }`}>
              {consolidatedTransactions.length}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Glassmorphic Add/Edit Form */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'new' && (
          <motion.div
            key="new-transaction-form"
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="glass-card p-6 rounded-3xl space-y-6"
          >
            {/* Custom Header with Dynamic Accent */}
            <div className="flex justify-between items-center border-b border-white/10 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-2xl transition-colors duration-300 ${
                  transactionType === "income" 
                    ? "bg-emerald-500/10 text-emerald-500 ring-4 ring-emerald-500/5 dark:bg-emerald-500/20" 
                    : "bg-rose-500/10 text-rose-500 ring-4 ring-rose-500/5 dark:bg-rose-500/20"
                }`}>
                  {transactionType === "income" ? (
                    <Wallet className="w-5 h-5" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-brand-slate dark:text-white">
                    {editingId
                      ? language === "ar"
                        ? "تعديل المعاملة"
                        : "Modify Transaction"
                      : language === "ar"
                        ? "تسجيل معاملة مالية"
                        : "Log Transaction"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {language === "ar" ? "أدخل تفاصيل المعاملة بدقة وسلاسة" : "Record financial inflows and outflows with ease"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setActiveSubTab('history');
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Control Selector for Type - Highly Animated */}
            <div className="grid grid-cols-2 p-1.5 bg-slate-100/60 dark:bg-slate-950/80 rounded-2xl border border-white/20 dark:border-slate-800/40 relative">
              <button
                type="button"
                onClick={() => {
                  setTransactionType("expense");
                  setSelectedCatId("");
                  setTypedCategoryQuery("");
                }}
                className={`py-3 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${
                  transactionType === "expense"
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/15"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                <span>{language === "ar" ? "مصروف (صادر)" : "Expense (Outgoing)"}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransactionType("income");
                  setSelectedCatId("");
                  setTypedCategoryQuery("");
                }}
                className={`py-3 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${
                  transactionType === "income"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/15"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 stroke-[3]" />
                <span>{language === "ar" ? "دخل (وارد)" : "Income (Incoming)"}</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* HERO AMOUNT BOX - Exceptional Layout */}
              <div className="relative flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 rounded-3xl group transition-all duration-300 focus-within:ring-2 focus-within:ring-brand-teal/30 focus-within:border-transparent">
                
                {/* Visual Label */}
                <div className="absolute top-3 flex items-center gap-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                    {language === "ar" ? "المبلغ المالي" : "Transaction Amount"}
                  </span>
                </div>

                {/* Main Hero Input Row */}
                <div className="w-full flex items-center justify-center gap-3 mt-4">
                  
                  {/* Currency Indicator Switch Box (LYD / USD Toggle Coin) */}
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setCurrency(prev => prev === "LYD" ? "USD" : "LYD")}
                      className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl flex flex-col items-center justify-center border border-slate-200/60 dark:border-slate-800 shadow-sm hover:scale-105 active:scale-95 transition-all text-slate-800 dark:text-white cursor-pointer"
                      title={language === "ar" ? "تبديل العملة" : "Toggle Currency"}
                    >
                      <span className="text-sm font-black text-brand-teal">
                        {currency === "LYD" ? "د.ل" : "$"}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400">
                        {currency}
                      </span>
                    </button>
                  </div>

                  {/* Gigantic Amount Field */}
                  <div className="flex-1 max-w-md relative flex items-center justify-center">
                    <input
                      type="number"
                      step="any"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent text-center text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-white outline-none placeholder-slate-300 dark:placeholder-slate-800"
                      style={{ direction: 'ltr' }}
                    />
                  </div>

                  {/* Interactive Quick Add Pads (calculator inspiration) - Semantic Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 bg-brand-teal/5 dark:bg-brand-teal/10 rounded-2xl flex items-center justify-center border border-brand-teal/10 text-brand-teal cursor-default">
                      {transactionType === 'income' ? <ArrowDownLeft className="w-5 h-5 text-emerald-500" /> : <ArrowUpRight className="w-5 h-5 text-rose-500" />}
                    </div>
                  </div>

                </div>

                {/* Amount Guidance tag */}
                {amount && parseFloat(amount) > 0 && (
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                    <span>
                      {language === "ar" ? "سيتم تسجيل" : "Will log"}
                    </span>
                    <span className={transactionType === "income" ? "text-emerald-500 font-extrabold" : "text-rose-500 font-extrabold"}>
                      {transactionType === "income" ? "+" : "-"} {parseFloat(amount).toLocaleString()} {currency === "LYD" ? "دينار ليبي" : "$ USD"}
                    </span>
                    <span>
                      {language === "ar" ? "في السجلات." : "into statements."}
                    </span>
                  </div>
                )}
              </div>

              {/* CORE DETAILS ROW (Title & Categories) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. Meaningful Title with Icon */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>{language === "ar" ? "بيان العملية / الغرض" : "Transaction Title / Purpose"}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FileSpreadsheet className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        transactionType === "income"
                          ? t.incomeTitleArEn
                          : t.expenseTitlePlaceholder
                      }
                      className="w-full glass-input pl-10 pr-10 rtl:pr-10 rtl:pl-10 py-3.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-teal/40 dark:text-white font-medium"
                    />
                  </div>
                </div>

                {/* 2. Custom Category Selector & Quick Recs */}
                <div className="flex flex-col gap-2 relative" ref={dropdownRef}>
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>{t.categorySelector}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Tag className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      value={typedCategoryQuery}
                      onFocus={() => setDropdownOpen(true)}
                      onChange={(e) => {
                        setTypedCategoryQuery(e.target.value);
                        setDropdownOpen(true);
                      }}
                      placeholder={t.categorySearchPlaceholder}
                      className="w-full glass-input pl-10 pr-10 rtl:pr-10 rtl:pl-10 py-3.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-teal/40 dark:text-white"
                    />
                  </div>

                  {/* Filterable categories drop */}
                  {dropdownOpen && (
                    <div 
                      className="absolute top-[76px] left-0 right-0 max-h-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850 animate-in fade-in duration-100"
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                    >
                      {filteredDropCategories.map((cat) => (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => selectCategoryFromDropdown(cat)}
                          className="w-full px-4 py-3 text-start text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  cat.color.startsWith('hsl') || cat.color.startsWith('#')
                                    ? cat.color
                                    : cat.color === "rose" || cat.color === "coral"
                                    ? "#f43f5e"
                                    : cat.color === "amber"
                                      ? "#f59e0b"
                                      : cat.color === "emerald"
                                        ? "#10b981"
                                        : cat.color === "brand-teal" ||
                                            cat.color === "teal"
                                          ? "#14b8a6"
                                          : "#3b82f6",
                              }}
                            />
                            <span>
                              {cat.name.split(" / ")[
                                language === "ar" ? 0 : 1
                              ] || cat.name}
                            </span>
                          </span>
                          {selectedCatId === cat.id && (
                            <Check className="w-4 h-4 text-brand-teal" />
                          )}
                        </button>
                      ))}

                      {typedCategoryQuery && !exactMatchExists && (
                        <button
                          type="button"
                          onClick={handleAddNewCategoryInline}
                          className="w-full px-4 py-3.5 bg-brand-teal/10 hover:bg-brand-teal/20 text-teal-800 dark:text-brand-teal text-xs font-black text-start flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>
                            {t.addCategoryDirectly}: "{typedCategoryQuery}"
                          </span>
                        </button>
                      )}

                      {filteredDropCategories.length === 0 &&
                        !typedCategoryQuery && (
                          <div className="p-4 text-center text-xs text-slate-400">
                            {language === "ar"
                              ? "اكتب لإنشاء تصنيف فوري..."
                              : "Type to add categorization..."}
                          </div>
                        )}
                    </div>
                  )}
                </div>

              </div>

              {/* WALLET SELECTION ROW - Horizontally Scrollable High-Focus Cards exactly like picture */}
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>{language === "ar" ? "المحفظة المستخدمة للعملية" : "Source / Destination Wallet"}</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {walletId && wallets.find(w => w.id === walletId) && (
                    <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/5 px-2.5 py-0.5 rounded-md border border-brand-teal/10">
                      {wallets.find(w => w.id === walletId)?.name}
                    </span>
                  )}
                </div>

                {(() => {
                  const activeWallets = wallets.filter(w => !w.isHidden || w.id === walletId);
                  return activeWallets.length > 0 ? (
                    (() => {
                      const isMany = activeWallets.length > 4;
                      let displayed = activeWallets;
                      if (isMany) {
                        displayed = activeWallets.slice(0, 3);
                        if (walletId) {
                          const sel = activeWallets.find(w => w.id === walletId);
                          if (sel && !displayed.some(w => w.id === walletId)) {
                            displayed = [
                              sel,
                              ...activeWallets.filter(w => w.id !== walletId).slice(0, 2)
                            ];
                          }
                        }
                      }

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {displayed.map((w) => {
                            const isSelected = walletId === w.id;
                            return (
                              <button
                                key={w.id}
                                type="button"
                                onClick={() => setWalletId(w.id)}
                                className={`p-3.5 rounded-2xl text-start cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between border min-h-[105px] ${
                                  isSelected
                                    ? "bg-brand-slate text-white dark:bg-white dark:text-brand-slate border-transparent shadow-md scale-[1.03] ring-2 ring-brand-teal/40"
                                    : "bg-slate-50/75 dark:bg-slate-900/40 border-slate-100 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5 mb-2 w-full">
                                  <span className="text-xs font-extrabold truncate max-w-[80%]">{w.name}</span>
                                  <div className={`p-1 rounded-lg ${isSelected ? "bg-white/10 text-white dark:bg-slate-900/10 dark:text-slate-800" : "bg-slate-200/20 text-slate-400"}`}>
                                    <Wallet className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                                
                                <div className="mt-1">
                                  <p className={`text-[10px] font-medium leading-none ${isSelected ? "text-white/70 dark:text-slate-400" : "text-slate-450 dark:text-slate-400"}`}>
                                    {language === "ar" ? "الرصيد الحالي" : "Current balance"}
                                  </p>
                                  <p className="text-xs font-mono font-black mt-1">
                                    {w.initialBalance.toLocaleString()} <span className="text-[9px]">{w.currency}</span>
                                  </p>
                                </div>

                                {/* Top-right checked indicator */}
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 rtl:right-auto rtl:left-1.5 bg-brand-teal text-slate-900 dark:bg-brand-slate dark:text-white rounded-full p-0.5 shadow-xs">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}

                          {/* If isMany, show 4th cell as a custom "More..." trigger dropdown */}
                          {isMany && (
                            <div className="relative" ref={walletSelectDropdownRef}>
                              <button
                                type="button"
                                onClick={() => setWalletSelectDropdownOpen(!walletSelectDropdownOpen)}
                                className={`w-full h-full p-3.5 rounded-2xl text-start cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between border min-h-[105px] ${
                                  walletSelectDropdownOpen || (!displayed.some(w => w.id === walletId) && walletId)
                                    ? "bg-brand-teal/10 dark:bg-brand-teal/25 border-brand-teal/30 text-slate-800 dark:text-white"
                                    : "bg-slate-50/75 dark:bg-slate-900/40 border-slate-100 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5 mb-2 w-full">
                                  <span className="text-xs font-black truncate">
                                    {language === "ar" ? "محافظ أخرى..." : "Other Wallets..."}
                                  </span>
                                  <div className="p-1 rounded-lg bg-teal-500/10 text-brand-teal">
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${walletSelectDropdownOpen ? "rotate-180" : ""}`} />
                                  </div>
                                </div>

                                <div className="mt-1">
                                  <p className="text-[10px] font-bold text-slate-400">
                                    {language === "ar" ? "اختر محفظة أخرى" : "Choose from list"}
                                  </p>
                                  <p className="text-[11px] font-extrabold text-brand-teal mt-0.5">
                                    {activeWallets.length - 3} {language === "ar" ? "محافظ إضافية" : "more"}
                                  </p>
                                </div>
                              </button>

                              {/* Dropdown overlay */}
                              <AnimatePresence>
                                {walletSelectDropdownOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute bottom-full mb-2 right-0 left-auto w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-3 flex flex-col gap-2 max-h-72 overflow-y-auto"
                                  >
                                    {activeWallets.length > 4 && (
                                      <input
                                        type="text"
                                        value={walletSearchQuery}
                                        onChange={(e) => setWalletSearchQuery(e.target.value)}
                                        placeholder={language === "ar" ? "ابحث عن محفظة..." : "Search wallet..."}
                                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl outline-hidden focus:border-brand-teal dark:text-white mb-1 focus:ring-1 focus:ring-brand-teal/35"
                                      />
                                    )}

                                    <div className="flex flex-col gap-1 overflow-y-auto pr-0.5">
                                      {activeWallets
                                        .filter((w) => {
                                          // Exclude already displayed wallets
                                          if (displayed.some(d => d.id === w.id)) return false;
                                          if (!walletSearchQuery) return true;
                                          return w.name.toLowerCase().includes(walletSearchQuery.toLowerCase());
                                        })
                                        .map((w) => {
                                          const isSel = walletId === w.id;
                                          return (
                                            <button
                                              key={w.id}
                                              type="button"
                                              onClick={() => {
                                                setWalletId(w.id);
                                                setWalletSelectDropdownOpen(false);
                                                setWalletSearchQuery("");
                                              }}
                                              className={`w-full p-2.5 rounded-xl text-start text-xs font-bold transition-colors cursor-pointer flex items-center justify-between ${
                                                isSel
                                                  ? "bg-brand-teal/15 text-brand-teal dark:bg-brand-teal/25"
                                                  : "hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-200"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 truncate">
                                                <Wallet className="w-3.5 h-3.5 text-brand-teal flex-shrink-0" />
                                                <span className="truncate">{w.name} ({w.currency})</span>
                                              </div>
                                              <span className="text-[10px] font-mono font-black text-slate-400">
                                                {w.initialBalance.toLocaleString()}
                                              </span>
                                            </button>
                                          );
                                        })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-dashed border-amber-500/10 text-center text-xs text-amber-500">
                      {language === "ar" ? "لا توجد أي محافظ مفعلة. يرجى تهيئة محفظة واحدة على الأقل" : "No wallets configured. Please provision a wallet first"}
                    </div>
                  );
                })()}
              </div>

              {/* DATE, NOTES & FILE ATTACHMENTS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2 border-t border-white/10 dark:border-slate-800/50">
                
                {/* A. Date input */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                    {language === "ar" ? "التاريخ والوقت" : "Date & Time"}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 w-4.5 h-4.5 text-slate-400 bg-transparent" />
                    <input
                      type="datetime-local"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full glass-input pl-10 pr-10 rtl:pr-10 rtl:pl-10 py-3.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-teal/40 dark:text-white"
                    />
                  </div>
                </div>

                {/* B. Priority buttons */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                    {language === "ar" ? "مستوى الأولوية في الصرف" : "Outflow priority tracker"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        value: "low" as const,
                        label: language === "ar" ? "منخفضة" : "Low",
                        activeColor: "bg-emerald-500 text-white border-transparent",
                        inactiveColor: "bg-slate-100/40 dark:bg-slate-900/40 text-slate-500 border-slate-100 dark:border-slate-850 hover:bg-slate-100/60"
                      },
                      {
                        value: "medium" as const,
                        label: language === "ar" ? "متوسطة" : "Medium",
                        activeColor: "bg-brand-teal text-slate-900 border-transparent",
                        inactiveColor: "bg-slate-100/40 dark:bg-slate-900/40 text-slate-500 border-slate-100 dark:border-slate-850 hover:bg-slate-100/60"
                      },
                      {
                        value: "high" as const,
                        label: language === "ar" ? "ملحّة جداً" : "Urgent",
                        activeColor: "bg-rose-500 text-white border-transparent",
                        inactiveColor: "bg-slate-100/40 dark:bg-slate-900/40 text-slate-500 border-slate-100 dark:border-slate-850 hover:bg-slate-100/60"
                      },
                    ].map((btn) => {
                      const isActive = priority === btn.value;
                      return (
                        <button
                          key={btn.value}
                          type="button"
                          onClick={() => setPriority(btn.value)}
                          className={`py-3.5 rounded-xl text-xs font-black text-center cursor-pointer transition-all duration-200 border ${
                            isActive ? btn.activeColor + " shadow-xs scale-[1.02]" : btn.inactiveColor
                          }`}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* C. Image Upload Receipt Dropzone */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                    {language === "ar" ? "وثائق الإيصالات والفواتير" : "Doc Receipts & Invoices"}
                  </label>
                  
                  {imageUrl ? (
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <div className="flex flex-wrap gap-2.5">
                        {imageUrl.split("|").filter(Boolean).map((imgUrl, idx) => (
                          <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/50 shadow-xs transition-all hover:scale-[1.03]">
                            <img
                              src={imgUrl}
                              alt={`Receipt ${idx + 1}`}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => {
                                setPreviewImagesList([imgUrl]);
                                setCurrentPreviewIndex(0);
                              }}
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const currentArr = imageUrl.split("|").filter(Boolean);
                                currentArr.splice(idx, 1);
                                setImageUrl(currentArr.join("|"));
                              }}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white rounded-full p-1 transition-all duration-200 shadow-xs cursor-pointer flex items-center justify-center animate-none"
                              title={language === "ar" ? "حذف" : "Remove"}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}

                        {/* Inline button to add more images */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-16 h-16 rounded-xl border border-dashed border-slate-250 hover:border-brand-teal dark:border-slate-800 dark:hover:border-brand-teal/50 bg-slate-100/30 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center justify-center text-slate-400 hover:text-brand-teal transition-all cursor-pointer"
                          title={language === "ar" ? "إضافة صور أخرى" : "Add more photos"}
                        >
                          <Plus className="w-5 h-5" />
                        </button>

                        {/* Inline button to capture direct camera photo */}
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="w-16 h-16 rounded-xl border border-dashed border-slate-250 hover:border-brand-teal dark:border-slate-800 dark:hover:border-brand-teal/50 bg-slate-100/30 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center justify-center text-brand-teal hover:text-brand-teal/80 transition-all cursor-pointer"
                          title={language === "ar" ? "تصوير فوري بالكاميرا" : "Capture with Camera"}
                        >
                          <Camera className="w-5 h-5 animate-pulse" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                        {language === "ar" 
                          ? `تم إرفاق ${imageUrl.split("|").filter(Boolean).length} صور. اضغط على أي صورة لمعاينتها بنقاء.`
                          : `Attached ${imageUrl.split("|").filter(Boolean).length} documents. Click any to preview.`}
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Select from Gallery */}
                      <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`h-14 border border-dashed rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                          dragActive
                            ? "border-brand-teal bg-brand-teal/5 scale-[1.01]"
                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-900/20"
                        }`}
                      >
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] text-slate-400 font-black text-center px-2">
                          {language === "ar" ? "اختيار من الاستوديو" : "Library / Gallery"}
                        </span>
                      </div>

                      {/* Shoot directly from Camera */}
                      <div
                        onClick={() => cameraInputRef.current?.click()}
                        className="h-14 border border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-teal dark:hover:border-brand-teal/50 hover:bg-brand-teal/[0.03] rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <Camera className="w-4 h-4 text-brand-teal animate-pulse" />
                        <span className="text-[10px] text-brand-teal font-black text-center px-2">
                          {language === "ar" ? "التقاط فوري بالكاميرا" : "Capture Direct Camera"}
                        </span>
                      </div>

                      {/* Hidden inputs underneath */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

              </div>

              {/* NOTES COLUMN (Sits Full Width) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                  {t.notes}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={
                    transactionType === "income"
                      ? language === "ar"
                        ? "أدخل ملاحظات إضافية بخصوص الإيراد..."
                        : "Enter bonus details on incoming stream..."
                      : language === "ar"
                        ? "تفاصيل السوبر ماركت، صيانة الهواتف، رحلة طرابلس..."
                        : "e.g., store name, fuel receipts..."
                  }
                  className="w-full glass-input px-4 py-3 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-teal/40 dark:text-white resize-none"
                />
              </div>

              {/* ACTION COMMAND BAR */}
              <div className="flex justify-end gap-3.5 pt-3 border-t border-white/10 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 font-extrabold text-xs rounded-2xl cursor-pointer transition-all active:scale-95"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-12 py-3.5 bg-brand-slate text-white dark:bg-white dark:text-brand-slate hover:opacity-90 font-black text-xs rounded-2xl cursor-pointer transition-all active:scale-95 shadow-md shadow-brand-slate/15 dark:shadow-none"
                >
                  {t.save}
                </button>
              </div>

            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeSubTab === 'history' && (
          <motion.div
            key="history-list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* 3. High Focus Filters Bar */}
            <div className="glass-card p-4 rounded-2xl space-y-3.5">

        {/* Type & Search Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Segmented Filter control (All vs Income vs Expense) */}
          <div className="md:col-span-5 grid grid-cols-3 p-1 bg-slate-100/50 dark:bg-slate-950/50 rounded-xl border border-white/10 dark:border-slate-900/30">
            {[
              { id: "all" as const, label: language === "ar" ? "الكل" : "All" },
              {
                id: "income" as const,
                label: language === "ar" ? "الوارد فقط" : "Incomes",
              },
              {
                id: "expense" as const,
                label: language === "ar" ? "الصادر فقط" : "Expenses",
              },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setTypeFilter(pill.id)}
                className={`py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  typeFilter === pill.id
                    ? "bg-brand-slate text-white dark:bg-white dark:text-brand-slate shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Quick Search Input */}
          <div className="md:col-span-7 relative">
            <Search className="absolute top-2.5 right-3.5 rtl:right-auto rtl:left-3.5 w-4 h-4 text-slate-400 bg-transparent pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === "ar"
                  ? "بحث باسم العملية أو الملاحظة المرفقة..."
                  : "Search ledger entries by title or custom logs..."
              }
              className="w-full glass-input pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal/50 dark:text-white"
            />
          </div>
        </div>

        {/* Dropdowns filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/40">
          
          {/* 1. Custom Wallet Selection Filter */}
          <div className="relative" ref={walletFilterRef}>
            <button
              type="button"
              onClick={() => {
                setWalletFilterOpen(!walletFilterOpen);
                setCategoryFilterOpen(false);
                setPriorityFilterOpen(false);
              }}
              className="w-full px-3 py-2.5 text-xs bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-xl focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/50 outline-hidden dark:text-white transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <Wallet className="w-3.5 h-3.5 text-brand-teal flex-shrink-0" />
                <span className="font-extrabold truncate text-slate-700 dark:text-slate-200">
                  {walletFilter
                    ? wallets.find((w) => w.id === walletFilter)?.name || walletFilter
                    : language === "ar"
                      ? "تصفية حسب المحفظة..."
                      : "Filter by Wallet..."}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-250 ${walletFilterOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {walletFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-11 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-900/60"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setWalletFilter("");
                      setWalletFilterOpen(false);
                    }}
                    className="w-full px-3.5 py-3 text-start text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                  >
                    <span>{language === "ar" ? "كل المحافظ" : "All Wallets"}</span>
                    {!walletFilter && <Check className="w-3.5 h-3.5 text-brand-teal stroke-[3]" />}
                  </button>
                  {wallets.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        setWalletFilter(w.id);
                        setWalletFilterOpen(false);
                      }}
                      className="w-full px-3.5 py-3 text-start text-xs font-black text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate">{w.name} ({w.currency})</span>
                      {walletFilter === w.id && <Check className="w-3.5 h-3.5 text-brand-teal stroke-[3]" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2. Custom Category Selection Filter */}
          <div className="relative" ref={categoryFilterRef}>
            <button
              type="button"
              onClick={() => {
                setCategoryFilterOpen(!categoryFilterOpen);
                setWalletFilterOpen(false);
                setPriorityFilterOpen(false);
              }}
              className="w-full px-3 py-2.5 text-xs bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-xl focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/50 outline-hidden dark:text-white transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <Tag className="w-3.5 h-3.5 text-brand-teal flex-shrink-0" />
                <span className="font-extrabold truncate text-slate-700 dark:text-slate-200">
                  {categoryFilter
                    ? categories.find((c) => c.id === categoryFilter)?.name.split(" / ")[language === "ar" ? 0 : 1] || categoryFilter
                    : language === "ar"
                      ? "تصفية بالتصنيفات..."
                      : "Filter by categorization..."}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-250 ${categoryFilterOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {categoryFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-11 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-900/60"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter("");
                      setCategoryFilterOpen(false);
                    }}
                    className="w-full px-3.5 py-3 text-start text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                  >
                    <span>{language === "ar" ? "كل التصنيفات" : "All Categories"}</span>
                    {!categoryFilter && <Check className="w-3.5 h-3.5 text-brand-teal stroke-[3]" />}
                  </button>
                  {categories.map((c) => {
                    const isSelected = categoryFilter === c.id;
                    const cleanName = c.name.split(" / ")[language === "ar" ? 0 : 1] || c.name;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCategoryFilter(c.id);
                          setCategoryFilterOpen(false);
                        }}
                        className={`w-full px-3.5 py-3 text-start text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between ${
                          isSelected ? "text-brand-teal" : "text-slate-800 dark:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                            c.type === "income" 
                              ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" 
                              : "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400"
                          }`}>
                            {c.type === "income" ? (language === "ar" ? "وارد" : "In") : language === "ar" ? "صادر" : "Out"}
                          </span>
                          <span className="truncate">{cleanName}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-brand-teal stroke-[3] flex-shrink-0" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. Custom Priority filter */}
          <div className="relative" ref={priorityFilterRef}>
            <button
              type="button"
              onClick={() => {
                setPriorityFilterOpen(!priorityFilterOpen);
                setWalletFilterOpen(false);
                setCategoryFilterOpen(false);
              }}
              className="w-full px-3 py-2.5 text-xs bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-xl focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/50 outline-hidden dark:text-white transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-3.5 h-3.5 text-brand-teal flex-shrink-0" />
                <span className="font-extrabold truncate text-slate-700 dark:text-slate-200">
                  {priorityFilter === "high"
                    ? (language === "ar" ? "أولوية: مرتفعة جداً" : "Priority: Urgent/High")
                    : priorityFilter === "medium"
                      ? (language === "ar" ? "أولوية: متوسطة" : "Priority: General/Medium")
                      : priorityFilter === "low"
                        ? (language === "ar" ? "أولوية: منخفضة" : "Priority: Optional/Low")
                        : (language === "ar" ? "تصفية حسب الأهمية..." : "Filter by Priority...")}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-250 ${priorityFilterOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {priorityFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-11 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100/60 dark:divide-slate-900/60"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter("");
                      setPriorityFilterOpen(false);
                    }}
                    className="w-full px-3.5 py-3 text-start text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                  >
                    <span>{language === "ar" ? "كل المستويات" : "All Levels"}</span>
                    {!priorityFilter && <Check className="w-3.5 h-3.5 text-brand-teal stroke-[3]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter("high");
                      setPriorityFilterOpen(false);
                    }}
                    className="w-full px-3.5 py-3 text-start text-xs font-black text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>{language === "ar" ? "مرتفعة جداً" : "Urgent / High"}</span>
                    </div>
                    {priorityFilter === "high" && <Check className="w-3.5 h-3.5 text-rose-500 stroke-[3]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter("medium");
                      setPriorityFilterOpen(false);
                    }}
                    className="w-full px-3.5 py-3 text-start text-xs font-black text-teal-600 dark:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                      <span>{language === "ar" ? "متوسطة" : "General / Medium"}</span>
                    </div>
                    {priorityFilter === "medium" && <Check className="w-3.5 h-3.5 text-brand-teal stroke-[3]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityFilter("low");
                      setPriorityFilterOpen(false);
                    }}
                    className="w-full px-3.5 py-3 text-start text-xs font-black text-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{language === "ar" ? "منخفضة" : "Optional / Low"}</span>
                    </div>
                    {priorityFilter === "low" && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 4. Combined Chronological Ledger List */}
      <div className="glass-card rounded-3xl overflow-hidden">
        {/* Ledger Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex justify-between items-center bg-slate-550/5/30 dark:bg-slate-900/10">
          <span className="text-xs font-black text-brand-slate dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
            <span>
              {language === "ar"
                ? "كشف العمليات الموحد الزمني"
                : "Consolidated Ledger Feed"}
            </span>
          </span>
          <span className="px-2.5 py-1 text-[10px] font-bold bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-355 rounded-lg border border-white/20">
            {filteredTransactions.length}{" "}
            {language === "ar" ? "عملية مسجلة" : "Settled Entries"}
          </span>
        </div>

        {/* Ledger Items */}
        <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
          {filteredTransactions.length > 0 ? (
            <>
              {filteredTransactions.slice(0, visibleLimit).map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const catLabel = cat
                  ? cat.name.split(" / ")[language === "ar" ? 0 : 1] || cat.name
                  : t.none;

                return (
                  <div
                    key={tx.id}
                    className="hover:bg-white/30 dark:hover:bg-slate-850/5 transition-all duration-200 border-b border-slate-100/45 dark:border-slate-800/20"
                  >
                    {/* Main transaction display row */}
                    <div className="p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative">
                      {/* Left: Metadata & Status Badging */}
                      <div className="flex gap-4 items-start flex-1 min-w-0">
                        {/* Circle directional indicators */}
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs border ${
                            tx.type === "income"
                              ? "bg-brand-green/20 text-emerald-600 border-brand-green/30 dark:bg-brand-green/10 dark:text-brand-green"
                              : "bg-rose-50 dark:bg-rose-950/20 text-rose-500 border-rose-250/20 dark:border-rose-900/10"
                          }`}
                        >
                          {tx.type === "income" ? (
                            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                          ) : (
                            <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                          )}
                        </div>

                        {/* Metadata summary block */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {tx.title}
                            </h4>

                            {/* Transaction Type label */}
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                                tx.type === "income"
                                  ? "bg-brand-green/20 text-emerald-800 dark:bg-brand-green/10 dark:text-brand-green"
                                  : "bg-brand-slate text-white dark:bg-white/10 dark:text-white"
                              }`}
                            >
                              {tx.type === "income"
                                ? language === "ar"
                                  ? "وارد"
                                  : "Income"
                                : language === "ar"
                                  ? "صادر"
                                  : "Expense"}
                            </span>

                            {/* Category badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getCatColorCombined(cat?.color || "slate")}`}
                            >
                              {catLabel}
                            </span>

                            {/* Priority level */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getPriorityStyle(tx.priority)}`}
                            >
                              {getPriorityLabel(tx.priority)}
                            </span>

                            {/* Wallet badge */}
                            {tx.walletId && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                <Wallet className="w-3 h-3" />
                                {wallets.find((w) => w.id === tx.walletId)?.name ||
                                  (language === "ar"
                                    ? "محفظة محذوفة"
                                    : "Deleted Wallet")}
                              </span>
                            )}
                          </div>

                          {tx.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl line-clamp-2">
                              {tx.notes}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              <span dir="ltr">
                                {tx.date.includes('T') 
                                  ? new Date(tx.date).toLocaleString(language === 'ar' ? 'en-GB' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                                  : tx.date}
                              </span>
                            </span>

                            {tx.imageUrl && (
                              <button
                                onClick={() => {
                                  const list = tx.imageUrl ? tx.imageUrl.split("|").filter(Boolean) : [];
                                  setPreviewImagesList(list);
                                  setCurrentPreviewIndex(0);
                                }}
                                className="flex items-center gap-1 text-brand-teal hover:underline cursor-pointer"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>
                                  {language === "ar"
                                    ? `رؤية الإيصالات المرفقة (${tx.imageUrl.split("|").filter(Boolean).length})`
                                    : `Inspect Receipt documents (${tx.imageUrl.split("|").filter(Boolean).length})`}
                                </span>
                              </button>
                            )}

                            {/* Collapsible comment badge */}
                            <button
                              onClick={() => {
                                if (expandedCommentsTxId === tx.id) {
                                  setExpandedCommentsTxId(null);
                                  setNewCommentText("");
                                } else {
                                  setExpandedCommentsTxId(tx.id);
                                  setNewCommentText("");
                                }
                              }}
                              className={`flex items-center gap-1 hover:underline cursor-pointer transition-colors ${
                                expandedCommentsTxId === tx.id
                                  ? "text-brand-teal font-extrabold"
                                  : "hover:text-brand-teal text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>
                                {language === "ar"
                                  ? `التعليقات (${comments.filter(c => c.transactionId === tx.id).length})`
                                  : `Comments (${comments.filter(c => c.transactionId === tx.id).length})`}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Sum value, and actions */}
                      <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-3 self-stretch sm:self-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40">
                        <span
                          className={`font-black text-base ${
                            tx.type === "income"
                              ? "text-emerald-500" // palette custom positive green
                              : "text-brand-slate dark:text-white font-extrabold"
                          }`}
                        >
                          {tx.type === "income" ? "+" : "-"}{" "}
                          {tx.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          {tx.currency === "LYD" ? t.lydSymbol : t.usdSymbol}
                        </span>

                        {/* Actions container */}
                        <div className="flex items-center gap-1.5">
                          {tx.imageUrl && (
                            <button
                              onClick={() => {
                                const list = tx.imageUrl ? tx.imageUrl.split("|").filter(Boolean) : [];
                                setPreviewImagesList(list);
                                setCurrentPreviewIndex(0);
                              }}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-teal rounded-xl transition-colors cursor-pointer border border-transparent hover:border-brand-teal/20"
                              title={
                                language === "ar" ? "عرض المرفقات" : "Show Receipts"
                              }
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditClick(tx)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/20"
                            title={t.edit}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              showConfirm(
                                language === "ar" ? "حذف المعاملة" : "Delete Transaction",
                                language === "ar"
                                  ? `هل أنت متأكد من حذف هذه المعاملة ("${tx.title}") نهائياً؟ لا يمكن استعادة السجل المالي لاحقاً.`
                                  : `Are you sure you want to delete this transaction ("${tx.title}") permanently? This action cannot be reversed.`,
                                async () => {
                                  if (tx.type === "income") {
                                    await deleteIncome(tx.id);
                                  } else {
                                    await deleteExpense(tx.id);
                                  }
                                },
                                'danger'
                              );
                            }}
                            className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-500/10"
                            title={t.deleteBtn}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Comments accordion drawer */}
                    {expandedCommentsTxId === tx.id && (
                      <div className="px-5 pb-5 pt-1.5 border-t border-dashed border-slate-150 dark:border-slate-800/60 bg-slate-550/5 dark:bg-slate-900/10">
                        <div className="max-w-4xl space-y-4">
                          {/* Inner discussion header */}
                          <div className="flex items-center justify-between">
                            <h5 className="text-[11px] font-black text-slate-700 dark:text-slate-350 flex items-center gap-1.5 uppercase tracking-wider">
                              <MessageSquare className="w-3.5 h-3.5 text-brand-teal" />
                              {language === "ar" ? "التعليقات والملاحظات الإضافية" : "Transaction Comments & Notes Discussion"}
                            </h5>
                            <span className="text-[10px] font-black text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-full">
                              {comments.filter(c => c.transactionId === tx.id).length} {language === "ar" ? "تعليق" : "Comments"}
                            </span>
                          </div>

                          {/* List of comments */}
                          {comments.filter(c => c.transactionId === tx.id).length > 0 ? (
                            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                              {comments.filter(c => c.transactionId === tx.id).map((comment) => (
                                <div
                                  key={comment.id}
                                  className="group p-3 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/45 flex justify-between items-start gap-4 transition-all hover:border-brand-teal/15 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                                >
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                      <span className="font-extrabold text-slate-850 dark:text-slate-150">
                                        {comment.userName}
                                      </span>
                                      <span className="text-slate-400 font-medium truncate max-w-[120px] sm:max-w-none">
                                        {comment.userEmail}
                                      </span>
                                      <span className="text-slate-400">
                                        • {comment.createdAt instanceof Date ? comment.createdAt.toLocaleString(language === "ar" ? "ar-LY" : "en-US", { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : ""}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-650 dark:text-slate-300 break-words whitespace-pre-wrap">
                                      {comment.text}
                                    </p>
                                  </div>

                                  <button
                                    onClick={async () => {
                                      if (confirm(language === "ar" ? "هل تريد حذف هذا التعليق؟" : "Delete this comment?")) {
                                        await deleteComment(comment.id);
                                      }
                                    }}
                                    className="md:opacity-0 md:group-hover:opacity-100 p-1 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer flex-shrink-0"
                                    title={language === "ar" ? "حذف التعليق" : "Delete comment"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic py-1">
                              {language === "ar" ? "لا توجد تعليقات بعد في هذا السجل. كن أول من يضيف تعليقاً!" : "No recorded comments for this ledger entry. Start the discussion!"}
                            </p>
                          )}

                          {/* Submit form */}
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!newCommentText.trim()) return;
                              await addComment(tx.id, tx.type === "income" ? "income" : "expense", newCommentText.trim());
                              setNewCommentText("");
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              placeholder={language === "ar" ? "أكتب تعليقك أو ملاحظتك هنا..." : "Add your commentary or internal note here..."}
                              className="flex-1 min-w-0 px-4 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/85 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-teal/40"
                            />
                            <button
                              type="submit"
                              disabled={!newCommentText.trim()}
                              className="p-2.5 bg-brand-teal hover:bg-brand-teal/90 disabled:opacity-40 disabled:hover:scale-100 text-white rounded-xl shadow-xs hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load more trigger */}
              {filteredTransactions.length > visibleLimit && (
                <div className="p-5 flex justify-center bg-slate-50/15 dark:bg-slate-900/10 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    onClick={() => setVisibleLimit((prev) => prev + 20)}
                    className="flex items-center gap-2.5 px-6 py-3 bg-brand-teal hover:bg-brand-teal/90 text-white hover:scale-[1.01] active:scale-95 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <span>{language === "ar" ? "عرض المزيد من المعاملات..." : "Load More Transactions..."}</span>
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-black">
                      +{filteredTransactions.length - visibleLimit}
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-slate-400 text-xs font-semibold">
              {t.noTransactionsYet}
            </div>
          )}
        </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Glassmorphic Modal for receipt photo previews / slideshow gallery */}
      <AnimatePresence>
        {previewImagesList.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImagesList([])}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
            />

            {/* Modal window content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-modal max-w-2xl w-full rounded-3xl overflow-hidden p-6 z-10 flex flex-col gap-4 relative border border-white/10 shadow-2xl bg-white dark:bg-slate-900"
            >
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-brand-slate dark:text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-brand-teal" />
                  <span>
                    {language === "ar"
                      ? `مستندات المعاملات المرفقة (شريحة ${currentPreviewIndex + 1} من ${previewImagesList.length})`
                      : `Attached Receipts (${currentPreviewIndex + 1} of ${previewImagesList.length})`}
                  </span>
                </h4>
                <button
                  onClick={() => setPreviewImagesList([])}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer text-slate-400 hover:text-slate-650"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main image preview with carousel controls */}
              <div className="relative w-full flex items-center justify-center bg-black/10 dark:bg-black/40 rounded-2xl p-2 border border-slate-200/50 dark:border-slate-800 overflow-hidden min-h-[300px]">
                <img
                  src={previewImagesList[currentPreviewIndex]}
                  alt="Full Receipt Photo"
                  className="max-h-[60vh] w-auto object-contain rounded-xl shadow-xl transition-all duration-300"
                  referrerPolicy="no-referrer"
                />

                {/* Left/Right Buttons if more than 1 image */}
                {previewImagesList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPreviewIndex(
                          (prev) => (prev - 1 + previewImagesList.length) % previewImagesList.length
                        )
                      }
                      className="absolute left-4 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md hover:scale-105"
                      title={language === "ar" ? "السابق" : "Previous"}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPreviewIndex((prev) => (prev + 1) % previewImagesList.length)
                      }
                      className="absolute right-4 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all cursor-pointer shadow-md hover:scale-105"
                      title={language === "ar" ? "التالي" : "Next"}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail Gallery Row */}
              {previewImagesList.length > 1 && (
                <div 
                  className="flex justify-center gap-2 overflow-x-auto py-2 border-t border-slate-100 dark:border-slate-800/60 mt-1 max-w-full"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  {previewImagesList.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentPreviewIndex(idx)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 cursor-pointer transition-all flex-shrink-0 relative ${
                        idx === currentPreviewIndex
                          ? "border-brand-teal scale-105 shadow-md"
                          : "border-transparent opacity-50 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Slide ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/40 text-[8px] text-white text-center font-mono">
                        {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Back controls button */}
              <div className="flex justify-end pt-1 border-t border-slate-100 dark:border-slate-800/45">
                <button
                  type="button"
                  onClick={() => setPreviewImagesList([])}
                  className="px-6 py-2.5 bg-brand-slate text-white dark:bg-white dark:text-brand-slate font-extrabold text-xs rounded-xl cursor-pointer hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                >
                  {language === "ar" ? "إغلاق المعاينة" : "Close Preview"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
