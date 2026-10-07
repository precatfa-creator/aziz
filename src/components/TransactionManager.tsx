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
  Wallet,
  ArrowUpRight,
  ArrowRightLeft,
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
  SlidersHorizontal,
  Lock,
  LockOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { ConfirmModal } from "./ConfirmModal";
import { isInlineReceipt, packReceiptImages, receiptEntries } from "../lib/receiptImages";
import { supabase } from "../supabase";
import { resolveReceiptUrls, uploadReceipt } from "../lib/receiptStorage";
import { fileToReceiptJpeg } from "../lib/imageDownscale";
import {
  convertAmount,
  inCompartment,
  roundMoney,
  walletBalance,
  walletCurrencies,
  walletTotals,
  type ExpenseKind,
} from "../lib/walletBalance";

interface TransactionManagerProps {
  defaultType?: 'income' | 'expense';
}

export const TransactionManager: React.FC<TransactionManagerProps> = ({ defaultType }) => {
  const {
    t,
    language,
    profile,
    incomes,
    expenses,
    categories,
    addIncome,
    updateIncome,
    deleteIncome,
    addExpense,
    updateExpense,
    toggleExpenseRefund,
    toggleExpenseDue,
    recoverDue,
    deleteExpense,
    addCategory,
    wallets,
    comments,
    addComment,
    deleteComment,
    hideHistoricalData,
    setHideHistoricalData,
    addWallet,
    selectedWalletFilter,
    setSelectedWalletFilter,
    selectedCompartmentFilter,
    setSelectedCompartmentFilter,
    setTransactionHidden,
    currency: globalCurrency,
    exchangeRate,
    setExchangeRate,
    addTransfer,
    user,
  } = useApp();

  // Comment expand/input state
  const [expandedCommentsTxId, setExpandedCommentsTxId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  // Notes expand state by transaction ID
  const [expandedNotesTxIds, setExpandedNotesTxIds] = useState<Record<string, boolean>>({});
  // Titles expand state by transaction ID
  const [expandedTitlesTxIds, setExpandedTitlesTxIds] = useState<Record<string, boolean>>({});

  // Consolidation States
  const [transactionType, setTransactionType] = useState<"income" | "expense" | "exchange">(
    defaultType || "expense"
  );
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>("wallet_spend");
  // Exchange only. The amount field stays the "from" side, so the rate is the
  // single extra input and the "to" side is always derived from the two.
  const [exchangeRateInput, setExchangeRateInput] = useState("");
  // A wallet holding 88 LYD and 100 USD is worth 1000 LYD only if the dashboard
  // converts at the rate actually paid. Defaulting this on keeps the merged
  // total honest; unticking it leaves the display rate alone.
  const [syncDisplayRate, setSyncDisplayRate] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [walletFilter, setWalletFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense" | "transfer">("all",);
  const [compartmentFilter, setCompartmentFilter] = useState<"all" | "card" | "cash">("all");
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

  // Derived filter metrics
  const activeFiltersCount = 
    (searchQuery ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (walletFilter ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (compartmentFilter !== "all" ? 1 : 0);

  // Tab and Subtab Toggle
  const [activeSubTab, setActiveSubTab] = useState<"new" | "history" | "refunds" | "dues">("new");

  useEffect(() => {
    setActiveSubTab("new");
    if (defaultType) {
      setTransactionType(defaultType);
      // Reset any active editing block
      setEditingId(null);
      setEditingType(null);
      // Clearing editingId re-arms the compartment auto-preselect, so the kind
      // has to go back to the default with it — otherwise a withdrawal that was
      // open for editing leaves its kind behind on the next expense typed here.
      setExpenseKind("wallet_spend");
    }
  }, [defaultType]);

  // Wallet cards and the dashboard open the history pre-filtered: by wallet,
  // by compartment, or both. Either arriving alone resets the other, so a
  // "cash in hand" tap never inherits a wallet picked on an earlier visit.
  useEffect(() => {
    if (selectedWalletFilter || selectedCompartmentFilter) {
      setWalletFilter(selectedWalletFilter);
      setCompartmentFilter(selectedCompartmentFilter || "all");
      setActiveSubTab("history");
      setSelectedWalletFilter("");
      setSelectedCompartmentFilter("");
      setIsFiltersExpanded(true);
    }
  }, [selectedWalletFilter, setSelectedWalletFilter, selectedCompartmentFilter, setSelectedCompartmentFilter]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"income" | "expense" | null>(
    null,
  );
  
  // Due Recovery Modal state
  const [recoverDueId, setRecoverDueId] = useState<string | null>(null);
  const [recoverDueAmount, setRecoverDueAmount] = useState("");
  const [recoverDueMax, setRecoverDueMax] = useState(0);

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

  // Option to create a new wallet on income addition
  const [createAndTopupWallet, setCreateAndTopupWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletColor, setNewWalletColor] = useState("emerald");

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

  // Pre-select default wallet for expense transactions
  useEffect(() => {
    if (!editingId) {
      if (transactionType === "expense") {
        if (profile?.defaultExpenseWalletId) {
          const existsAndActive = wallets.some(w => w.id === profile.defaultExpenseWalletId && !w.isHidden);
          if (existsAndActive) {
            setWalletId(profile.defaultExpenseWalletId);
            const matchedWallet = wallets.find(w => w.id === profile.defaultExpenseWalletId);
            if (matchedWallet) {
              setCurrency(matchedWallet.currency);
            }
          }
        }
      } else {
        setWalletId("");
      }
    }
  }, [transactionType, profile?.defaultExpenseWalletId, editingId, wallets]);

  // Custom states for wallet selection when we have > 4 wallets
  const [walletSelectDropdownOpen, setWalletSelectDropdownOpen] = useState(false);
  const [walletSearchQuery, setWalletSearchQuery] = useState("");
  const walletSelectDropdownRef = useRef<HTMLDivElement>(null);

  // Pagination for transactions list
  const [visibleLimit, setVisibleLimit] = useState(20);

  // Reset pagination limit when filters undergo transition
  useEffect(() => {
    setVisibleLimit(20);
  }, [searchQuery, categoryFilter, priorityFilter, walletFilter, typeFilter, compartmentFilter]);

  // Drag-and-drop state for uploads
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Detail Modal State
  const [previewImagesList, setPreviewImagesList] = useState<string[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState<number>(0);

  // image_url holds Storage object paths, which no <img> can read directly.
  // Sign whatever is on screen — the form's attachments plus the open preview —
  // in one batched call. Only paths go through here: legacy Base64 entries are
  // already displayable, and keying the effect on them would mean splitting and
  // re-joining a megabyte of it on every keystroke in the form.
  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  const [signedReceipts, setSignedReceipts] = useState<Record<string, string>>({});
  const [receiptsUnavailable, setReceiptsUnavailable] = useState(false);
  const pathsToSign = [...receiptEntries(imageUrl), ...previewImagesList].filter(
    (entry) => !isInlineReceipt(entry),
  );
  const signKey = pathsToSign.join("|");

  useEffect(() => {
    const paths = signKey.split("|").filter(Boolean);
    if (paths.length === 0) return;
    let active = true;
    resolveReceiptUrls(paths)
      .then(({ urls, missing }) => {
        if (!active) return;
        setSignedReceipts((prev) => ({ ...prev, ...urls }));
        setReceiptsUnavailable(missing > 0);
      })
      .catch((err) => {
        console.error("Could not sign receipt URLs:", err);
        if (active) setReceiptsUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [signKey]);

  // undefined means "not signed yet". Rendering <img src=""> instead would make
  // the browser re-request the page and paint a broken tile for every receipt.
  const receiptSrc = (entry: string): string | undefined =>
    isInlineReceipt(entry) ? entry : signedReceipts[entry];

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

  // Overdraft Wallet Selection State
  const [overdraftModalOpen, setOverdraftModalOpen] = useState(false);
  const [overdraftData, setOverdraftData] = useState<{
    originalWallet: any;
    currentBalance: number;
    remainingAmount: number;
    availableWallets: any[];
    numericAmount: number;
  } | null>(null);
  const [selectedAlternativeWalletId, setSelectedAlternativeWalletId] = useState("");

  const walletStats = (wallet: any, curr: "LYD" | "USD" = wallet.currency) =>
    walletBalance(wallet, incomes, expenses, curr);

  const convertTo = (v: number, from: "LYD" | "USD", to: "LYD" | "USD") =>
    convertAmount(v, from, to, exchangeRate);

  // Only two currencies exist, so the destination of an exchange is whichever
  // one the amount is not in. No second picker, and no way to pick the same
  // currency on both sides.
  const exchangeTo: "LYD" | "USD" = currency === "LYD" ? "USD" : "LYD";
  const exchangeRateValue = parseFloat(exchangeRateInput);
  const hasValidRate = !isNaN(exchangeRateValue) && exchangeRateValue > 0;
  // The rate is always stated the way the settings screen states it: how many
  // LYD one USD costs. Which side of the division that lands on is exactly what
  // convertAmount already decides, at the typed rate rather than the saved one.
  const exchangeResult =
    hasValidRate && amount && parseFloat(amount) > 0
      ? convertAmount(parseFloat(amount), currency, exchangeTo, exchangeRateValue)
      : null;
  // Stored to 2dp, so the derived rate stays reproducible from the two legs.
  const exchangeToAmount = exchangeResult === null ? null : roundMoney(exchangeResult);

  // Picking a drained card that still holds withdrawn cash pre-selects "paid
  // from cash", because there is nothing left on the card to spend. Only a
  // suggestion — the kind is stored on the row, never re-derived from the
  // balance, so back-dating an edit cannot silently retag old expenses.
  useEffect(() => {
    if (editingId || !walletId) return;
    const w = wallets.find((x) => x.id === walletId);
    if (!w) return;
    // Per currency: a wallet can be out of LYD while still holding USD cash,
    // and the compartment to suggest depends on which one is being spent.
    const { onCard, inCash } = walletStats(w, currency);
    setExpenseKind(onCard <= 0 && inCash > 0 ? "cash_spend" : "wallet_spend");
    // transactionType is a dependency because the exchange tab offers no
    // "cash withdrawal" option; carrying that choice over from an expense would
    // leave the form holding a kind its own picker cannot show.
  }, [walletId, editingId, currency, transactionType]);

  // Start an exchange from the rate the dashboard already uses, so the common
  // case is a correction rather than a blank field.
  useEffect(() => {
    if (transactionType === "exchange" && !exchangeRateInput) {
      setExchangeRateInput(String(exchangeRate));
    }
  }, [transactionType]);

  // What the wallet is worth in total. Pickers and archive checks want this, so
  // that a card sitting at zero with cash withdrawn from it stays selectable.
  // Sums every currency it holds, converted at the display rate — otherwise a
  // wallet that exchanged all its LYD into USD would read as empty and archive
  // itself out of the list.
  const getWalletCurrentBalance = (wallet: any) =>
    walletTotals(wallet, incomes, expenses).reduce(
      (acc, b) => acc + (b.currency === wallet.currency ? b.total : convertTo(b.total, b.currency, wallet.currency)),
      0,
    );

  // What an expense of this kind can actually draw on, in the currency being
  // spent. Cash already withdrawn cannot be spent off the card again, USD
  // cannot be spent out of the LYD bucket, and vice versa.
  const availableFor = (wallet: any, kind: ExpenseKind, curr: "LYD" | "USD" = currency) =>
    kind === "cash_spend" ? walletStats(wallet, curr).inCash : walletStats(wallet, curr).onCard;

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

      // Check if the click is inside any portal-rendered filter modal
      let isInsidePortalFilter = false;
      if (target instanceof Element) {
        isInsidePortalFilter = !!target.closest(".filter-modal-container");
      } else if (target.nodeType === Node.TEXT_NODE && target.parentElement) {
        isInsidePortalFilter = !!target.parentElement.closest(".filter-modal-container");
      }

      if (!isInsidePortalFilter) {
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
        transactionType === "exchange" ? "expense" : transactionType,
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

  // A failed save used to only reach the console, so the form reset and jumped
  // to the history tab as if it had worked and the entry was simply gone.
  const reportSaveFailure = (err: unknown) => {
    console.error(err);
    alert(
      language === "ar"
        ? "تعذّر حفظ الحركة. لم يتم تسجيل أي شيء — حاول مجددًا، وإذا كانت هناك صور مرفقة فجرّب إزالة بعضها."
        : "The transaction could not be saved. Nothing was recorded — try again, and if receipts are attached try removing some.",
    );
  };

  /**
   * Records an exchange as one movement: both legs land in the same wallet,
   * in different currencies, under one transfer id.
   *
   * Validation is against the compartment the money actually leaves, not the
   * wallet total — a card at zero holding withdrawn cash cannot be swiped, and
   * a wallet holding only USD cannot pay out LYD.
   */
  const handleExchangeSubmit = async (numericAmount: number) => {
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet || exchangeToAmount === null || exchangeToAmount <= 0) return;

    const available = availableFor(wallet, expenseKind, currency);
    if (available < numericAmount) {
      alert(
        language === "ar"
          ? `الرصيد المتاح بالـ${currency} هو ${available.toLocaleString()} فقط، وهو أقل من ${numericAmount.toLocaleString()}.`
          : `Only ${available.toLocaleString()} ${currency} is available to exchange, less than ${numericAmount.toLocaleString()}.`,
      );
      return;
    }

    const rateLabel = (numericAmount / exchangeToAmount).toFixed(2);
    const fallbackOut =
      language === "ar"
        ? `صرافة ${numericAmount} ${currency} إلى ${exchangeToAmount} ${exchangeTo}`
        : `Exchange ${numericAmount} ${currency} to ${exchangeToAmount} ${exchangeTo}`;

    try {
      await addTransfer({
        fromWalletId: wallet.id,
        toWalletId: wallet.id,
        fromAmount: numericAmount,
        fromCurrency: currency,
        toAmount: exchangeToAmount,
        toCurrency: exchangeTo,
        date,
        titleOut: title.trim() || fallbackOut,
        titleIn: title.trim() || fallbackOut,
        notes: notes
          ? `${notes}\n(${currency}→${exchangeTo} @ ${rateLabel})`
          : `(${currency}→${exchangeTo} @ ${rateLabel})`,
        imageUrl,
        fromKind: expenseKind,
      });

      // Only after both legs are safely written: a rate change that outlived a
      // failed exchange would silently re-value every USD row for nothing.
      if (syncDisplayRate && hasValidRate && exchangeRateValue !== exchangeRate) {
        await setExchangeRate(exchangeRateValue);
      }

      resetForm();
      setActiveSubTab("history");
    } catch (err) {
      reportSaveFailure(err);
    }
  };

  // Submit main consolidated ledger entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Disabling the save button is not enough: pressing Enter in any field
    // submits the form directly, which would save the transaction without the
    // photo that is still on its way to the bucket.
    if (uploadingReceipts) {
      alert(
        language === "ar"
          ? "جارٍ رفع الصور — انتظر حتى ينتهي الرفع قبل الحفظ."
          : "Receipts are still uploading — wait for them to finish before saving.",
      );
      return;
    }
    const isNewWalletOptionActive = createAndTopupWallet && transactionType === "income" && !editingId;
    // An exchange has no category of the user's choosing — both legs are filed
    // under the shared transfer category — and its title is generated, so it
    // requires only a wallet, an amount and a rate.
    const requiredFieldsMissing =
      transactionType === "exchange"
        ? !amount || !walletId || !hasValidRate
        : !amount || !title || !selectedCatId || (!isNewWalletOptionActive && !walletId);
    if (requiredFieldsMissing) return;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    if (transactionType === "exchange") {
      await handleExchangeSubmit(numericAmount);
      return;
    }

    try {
      let finalWalletId = walletId;
      if (isNewWalletOptionActive) {
        if (!newWalletName.trim()) return;
        finalWalletId = await addWallet(
          newWalletName.trim(),
          numericAmount,
          currency,
          newWalletColor || "emerald",
          "Wallet",
        );
      }

      // Check for expense exceeding wallet balance on Standard Add
      if (!editingId && transactionType === "expense") {
        const w = wallets.find((w) => w.id === finalWalletId);
        if (w) {
          // Against the compartment being drawn on, not the wallet total: a card
          // at zero holding withdrawn cash must not look like it can be swiped.
          const currentBal = availableFor(w, expenseKind);
          if (currentBal < numericAmount) {
            const remainingAmount = currentBal > 0 ? numericAmount - currentBal : numericAmount;
            // In the currency actually being spent, not the wallet's headline
            // total: a wallet holding 88 LYD and 100 USD cannot cover a 500 LYD
            // shortfall however large its converted total looks. This also
            // replaces the old `ow.currency === w.currency` test, which asked
            // about the wallet's primary currency rather than the one it is
            // being asked to pay in — a wallet whose USD came from an exchange
            // has no LYD row and scores zero here on its own.
            const availableWallets = wallets.filter((ow) =>
               ow.id !== finalWalletId &&
               walletStats(ow, currency).total >= remainingAmount
            );

            setOverdraftData({
              originalWallet: w,
              currentBalance: currentBal,
              remainingAmount,
              availableWallets,
              numericAmount,
            });
            if (availableWallets.length > 0) {
              setSelectedAlternativeWalletId(availableWallets[0].id);
            }
            setOverdraftModalOpen(true);
            return; // Halt submission, wait for modal interaction
          }
        }
      }

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
                finalWalletId,
                undefined,
                undefined,
                expenseKind,
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
                finalWalletId,
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
              finalWalletId,
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
              finalWalletId,
              expenseKind,
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
            finalWalletId,
            false,
            "",
            isNewWalletOptionActive,
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
            finalWalletId,
            undefined,
            undefined,
            expenseKind,
          );
        }
      }
      resetForm();
      setActiveSubTab("history");
    } catch (err) {
      reportSaveFailure(err);
    }
  };

  const handleForceProceed = async () => {
    if (!overdraftData) return;
    try {
      await addExpense(
        overdraftData.numericAmount,
        currency,
        title,
        date,
        selectedCatId,
        notes,
        imageUrl,
        priority,
        overdraftData.originalWallet.id,
        undefined,
        undefined,
        expenseKind,
      );

      setOverdraftModalOpen(false);
      setOverdraftData(null);
      resetForm();
      setActiveSubTab("history");
    } catch (err) {
      reportSaveFailure(err);
    }
  };

  const handleOverdraftProceed = async () => {
    if (!overdraftData || !selectedAlternativeWalletId) return;

    try {
      const { originalWallet, currentBalance, remainingAmount, numericAmount } = overdraftData;
      
      if (currentBalance > 0) {
        // Transaction 1: Drain original wallet
        await addExpense(
          currentBalance,
          currency,
          title,
          date,
          selectedCatId,
          notes ? `${notes}\n(Partial payment)` : `(Partial payment)`,
          imageUrl,
          priority,
          originalWallet.id,
          undefined,
          undefined,
          expenseKind,
        );

        // The covering leg comes off a different wallet's own card, so it is
        // ordinary spending there whatever compartment the original drew on.
        await addExpense(
          remainingAmount,
          currency,
          title,
          date,
          selectedCatId,
          notes ? `${notes}\n(Covering remaining from ${originalWallet.name})` : `(Covering remaining from ${originalWallet.name})`,
          imageUrl,
          priority,
          selectedAlternativeWalletId
        );
      } else {
         // If current balance is <= 0, we can't split, take the whole from the alternative wallet.
         await addExpense(
           numericAmount,
           currency,
           title,
           date,
           selectedCatId,
           notes ? `${notes}\n(Paid from alternative wallet instead of ${originalWallet.name})` : `(Paid from alternative wallet instead of ${originalWallet.name})`,
           imageUrl,
           priority,
           selectedAlternativeWalletId
         );
      }

      setOverdraftModalOpen(false);
      setOverdraftData(null);
      resetForm();
      setActiveSubTab("history");
    } catch (err) {
      reportSaveFailure(err);
    }
  };

  const handleEditClick = (tx: any) => {
    setEditingId(tx.id);
    setEditingType(tx.type);
    setTransactionType(tx.type);
    setTitle(tx.title);
    setAmount(((tx as any).isRefunded ? ((tx as any).originalAmount || tx.amount) : tx.amount).toString());
    setCurrency(tx.currency);
    setDate(tx.date);
    setSelectedCatId(tx.categoryId);
    setWalletId(tx.walletId || "");
    setExpenseKind(tx.expenseKind || "wallet_spend");
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
    setCreateAndTopupWallet(false);
    setNewWalletName("");
    setNewWalletColor("emerald");
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
    setExpenseKind("wallet_spend");
    setTypedCategoryQuery("");
    setPriority("medium");
    setImageUrl("");
    setCreateAndTopupWallet(false);
    setNewWalletName("");
    setNewWalletColor("emerald");
    // The rate box refills from settings on the next visit to the exchange tab;
    // leaving a stale one behind would quietly price the following exchange.
    setExchangeRateInput("");
    setSyncDisplayRate(true);
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

    if (!user) return;

    // Process one photo at a time. Decoding several full-resolution camera
    // images concurrently creates a large memory spike on mobile devices.
    // One bad file must not discard the photos already uploaded beside it.
    setUploadingReceipts(true);
    const uploadedPaths: string[] = [];
    let failed = 0;
    try {
      for (const file of validFiles) {
        try {
          uploadedPaths.push(await uploadReceipt(await fileToReceiptJpeg(file), user.id));
        } catch (error) {
          failed++;
          console.error("Receipt upload failed:", file.name, error);
        }
      }
    } finally {
      setUploadingReceipts(false);
    }

    const updatedImages = [...receiptEntries(imageUrl), ...uploadedPaths];

    // Paths are short, so this only ever bites on a row still holding legacy
    // Base64. Overflowing image_url makes the INSERT fail and takes the whole
    // transaction down with it, so refuse the extra photos here instead.
    const { kept, dropped } = packReceiptImages(updatedImages);
    setImageUrl(kept.join("|"));

    if (failed > 0 || dropped > 0) {
      alert(
        language === "ar"
          ? [
              failed > 0 ? `تعذّر رفع ${failed} صورة.` : "",
              dropped > 0 ? `تم تجاوز الحد الأقصى للمرفقات، ولم تُضف ${dropped} صورة.` : "",
            ]
              .filter(Boolean)
              .join(" ")
          : [
              failed > 0 ? `${failed} image(s) could not be uploaded.` : "",
              dropped > 0 ? `Attachment size limit reached — ${dropped} image(s) were not added.` : "",
            ]
              .filter(Boolean)
              .join(" "),
      );
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
    const files = e.target.files ? Array.from(e.target.files) : [];
    // Reset immediately so taking the same photo again still fires `change`,
    // and so the native camera input does not retain the large File object.
    e.target.value = "";
    if (files.length > 0) void processFiles(files);
  };

  // A transfer is two rows in the ledger but one movement in the world, so the
  // history shows it once. The income leg is folded into its expense leg and
  // dropped from the list; the pair rides along as `transferPair` for the row to
  // render. The legs keep `type: "expense"` deliberately — a transfer really is
  // an outflow from the source, and inventing a third type here would mean
  // every filter, badge and action below had to learn about it.
  const transferInLegs = new Map(
    incomes.filter((inc) => inc.transferId).map((inc) => [inc.transferId as string, inc]),
  );
  const pairedTransferIds = new Set(
    expenses.filter((exp) => exp.transferId).map((exp) => exp.transferId as string),
  );

  // Consolidate Incomes & Expenses under a single list
  const consolidatedTransactions = [
    // An income leg whose expense leg is gone stays visible on its own: it is a
    // real row affecting a real balance, and hiding it would hide the damage.
    ...incomes
      .filter((inc) => !inc.transferId || !pairedTransferIds.has(inc.transferId))
      .map((inc) => ({ ...inc, type: "income" as const })),
    ...expenses.map((exp) => ({
      ...exp,
      type: "expense" as const,
      transferPair: exp.transferId ? transferInLegs.get(exp.transferId) : undefined,
    })),
  ]
    .filter((tx) => !hideHistoricalData || !tx.isHistorical)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Wallets shared in "hide some" mode. Only their rows get the lock switch;
  // anywhere else it would do nothing a viewer could see.
  const [partialWallets, setPartialWallets] = useState<Set<string>>(new Set());
  useEffect(() => {
    void supabase
      .from("wallet_shares")
      .select("wallet_id")
      .eq("mode", "partial")
      .then(({ data }) => setPartialWallets(new Set((data ?? []).map((r) => r.wallet_id as string))));
  }, []);

  // A transfer row is two legs; hiding it hides both, so neither wallet's
  // viewer learns what the other one was told was private.
  const toggleHidden = async (tx: any) => {
    const next = !tx.hiddenFromViewers;
    try {
      await setTransactionHidden(tx.type, tx.id, next);
      if (tx.transferPair) await setTransactionHidden("income", tx.transferPair.id, next);
    } catch {
      alert(language === "ar" ? "لم يُحفظ التغيير." : "The change wasn’t saved.");
    }
  };

  const hasCashRows = expenses.some(
    (e) => e.expenseKind === "cash_withdrawal" || e.expenseKind === "cash_spend",
  );

  // Under the cash view a withdrawal is money arriving, not leaving.
  const isInflow = (tx: { type: string; expenseKind?: string }) =>
    tx.type === "income" || (compartmentFilter === "cash" && tx.expenseKind === "cash_withdrawal");

  // Filters application
  const filteredTransactions = consolidatedTransactions.filter((tx) => {
    const matchSearch =
      tx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = categoryFilter ? tx.categoryId === categoryFilter : true;
    // Transfer legs ride in the list as expenses so every badge and action keeps
    // working, but the whole point of the feature is that they are not spending
    // — so "Expenses" must not show them, and they get a pill of their own.
    const isTransfer = !!(tx as any).transferPair;
    const matchType =
      typeFilter === "all"
        ? true
        : typeFilter === "transfer"
          ? isTransfer
          : tx.type === typeFilter && !isTransfer;
    const matchPriority = priorityFilter ? tx.priority === priorityFilter : true;
    // A transfer row is filed under its paying wallet, but it moved money into
    // the receiving one too; without the second check, wallet B's history
    // would never show what arrived in B and could not add up to its balance.
    const matchWallet = walletFilter
      ? tx.walletId === walletFilter || (tx as any).transferPair?.walletId === walletFilter
      : true;
    // A transfer row viewed from its receiving wallet is that wallet's income
    // leg, which always lands on the card — not the paying leg's compartment.
    const receivingSide = !!walletFilter && tx.walletId !== walletFilter;
    const matchCompartment =
      compartmentFilter === "all" ||
      (receivingSide
        ? compartmentFilter === "card"
        : inCompartment(tx as any, tx.type, compartmentFilter));
    return matchSearch && matchCat && matchType && matchPriority && matchWallet && matchCompartment;
  });

  const getCatColorCombined = (color: string) => {
    const colors: Record<string, string> = {
      rose: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/30",
      amber:
        "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/30",
      sky: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/30",
      orange:
        "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/30",
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
    <div 
      className="space-y-6 animate-fade-in pb-16"
      onTouchStart={(e) => {
        e.stopPropagation();
        const touch = e.touches[0];
        (e.currentTarget as any).startX = touch.clientX;
        (e.currentTarget as any).startY = touch.clientY;
      }}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => {
        e.stopPropagation();
        const startX = (e.currentTarget as any).startX;
        const startY = (e.currentTarget as any).startY;
        if (startX === undefined || startY === undefined) return;
        
        const touchEnd = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const diffX = startX - touchEnd;
        const diffY = startY - touchEndY;
        
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
          const swipeableTabs = ['new', 'history', 'refunds', 'dues'] as const;
          const currentIndex = swipeableTabs.indexOf(activeSubTab);
          if (currentIndex !== -1) {
            const isRtl = language === 'ar';
            const goNext = isRtl ? diffX < 0 : diffX > 0;
            
            if (goNext && currentIndex + 1 < swipeableTabs.length) {
              setActiveSubTab(swipeableTabs[currentIndex + 1]);
            } else if (!goNext && currentIndex - 1 >= 0) {
              setActiveSubTab(swipeableTabs[currentIndex - 1]);
            }
          }
        }
      }}
    >
      {/* 1. Glassmorphic Header Banner */}

      {/* Telegram-inspired top navigation tabs (2 tabs: New and History) */}
      <div className="flex justify-center mt-2 mb-6">
        <div 
          className="inline-flex p-1.5 bg-slate-100/70 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/40 dark:border-slate-800/60 w-full max-w-2xl relative shadow-sm overflow-x-auto whitespace-nowrap"
        >
          <button
            type="button"
            id="new-tx-tab"
            onClick={() => {
              setActiveSubTab('new');
            }}
            className={`flex-1 min-w-min px-4 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
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
            className={`flex-1 min-w-min px-4 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
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
          <button
            type="button"
            id="refunds-tx-tab"
            onClick={() => {
              setActiveSubTab('refunds');
            }}
            className={`flex-1 min-w-min px-4 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'refunds'
                ? 'bg-white dark:bg-slate-850 text-brand-slate dark:text-white shadow-md font-black'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'refunds' ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span>{(t as any).refundsTab || (language === 'ar' ? 'الاستردادات' : 'Refunds')}</span>
            
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
              activeSubTab === 'refunds' 
                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 font-black' 
                : 'bg-slate-200/50 dark:bg-slate-800 text-slate-500 font-bold'
            }`}>
              {expenses.filter(e => e.isRefunded || ((e as any).originalAmount && (e as any).originalAmount > e.amount)).length}
            </span>
          </button>
          <button
            type="button"
            id="dues-tx-tab"
            onClick={() => {
              setActiveSubTab('dues');
            }}
            className={`flex-1 min-w-min px-4 py-3 text-xs font-black rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 cursor-pointer ${
              activeSubTab === 'dues'
                ? 'bg-white dark:bg-slate-850 text-brand-slate dark:text-white shadow-md font-black'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 transition-transform ${activeSubTab === 'dues' ? 'text-rose-500' : 'text-slate-400'}`} />
            <span>{language === 'ar' ? 'المستحقات' : 'Dues'}</span>
            
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
              activeSubTab === 'dues' 
                ? 'bg-rose-500/20 text-rose-800 dark:text-rose-400 font-black' 
                : 'bg-slate-200/50 dark:bg-slate-800 text-slate-500 font-bold'
            }`}>
              {expenses.filter(e => e.isDue && !e.isRefunded).length}
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
            <div 
              className="grid grid-cols-3 p-1.5 bg-slate-100/60 dark:bg-slate-950/80 rounded-2xl border border-white/20 dark:border-slate-800/40 relative"
              onTouchStart={(e) => {
                e.stopPropagation();
                const touch = e.touches[0];
                (e.currentTarget as any).startX = touch.clientX;
                (e.currentTarget as any).startY = touch.clientY;
              }}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => {
                e.stopPropagation();
                const startX = (e.currentTarget as any).startX;
                const startY = (e.currentTarget as any).startY;
                if (startX === undefined || startY === undefined) return;
                
                const touchEnd = e.changedTouches[0].clientX;
                const touchEndY = e.changedTouches[0].clientY;
                
                const diffX = startX - touchEnd;
                const diffY = startY - touchEndY;
                
                if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
                  const swipeableTypes = ['expense', 'income', 'exchange'] as const;
                  const currentIndex = swipeableTypes.indexOf(transactionType as typeof swipeableTypes[number]);
                  if (currentIndex !== -1) {
                    const isRtl = language === 'ar';
                    const goNext = isRtl ? diffX < 0 : diffX > 0;
                    
                    if (goNext && currentIndex + 1 < swipeableTypes.length) {
                      setTransactionType(swipeableTypes[currentIndex + 1]);
                      setSelectedCatId("");
                      setTypedCategoryQuery("");
                    } else if (!goNext && currentIndex - 1 >= 0) {
                      setTransactionType(swipeableTypes[currentIndex - 1]);
                      setSelectedCatId("");
                      setTypedCategoryQuery("");
                    }
                  }
                }
              }}
            >
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
                <span>{language === "ar" ? "مصروف" : "Expense"}</span>
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
                <span>{language === "ar" ? "دخل" : "Income"}</span>
              </button>
              {/* Neither red nor green: an exchange is a movement, and colouring
                  it like spending or earning would state the opposite of what
                  the rest of this feature exists to say. */}
              <button
                type="button"
                onClick={() => {
                  // Submitting an exchange writes two new rows rather than
                  // updating anything, so carrying a half-finished edit into
                  // this tab would silently abandon it. Clear it instead.
                  if (editingId) resetForm();
                  setTransactionType("exchange");
                  setSelectedCatId("");
                  setTypedCategoryQuery("");
                }}
                aria-pressed={transactionType === "exchange"}
                className={`py-3 rounded-xl text-xs font-black transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 ${
                  transactionType === "exchange"
                    ? "bg-brand-teal text-white shadow-lg shadow-brand-teal/15"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 stroke-[3]" />
                <span>{language === "ar" ? "صرافة" : "Exchange"}</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* HERO AMOUNT BOX - Exceptional Layout */}
              <div className="relative flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-850 rounded-3xl group transition-all duration-300 focus-within:ring-2 focus-within:ring-brand-teal/30 focus-within:border-transparent">
                
                {/* Visual Label */}
                <div className="absolute top-3 flex items-center gap-1">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">
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
                      {transactionType === 'exchange' ? <ArrowRightLeft className="w-5 h-5 text-brand-teal" /> : transactionType === 'income' ? <ArrowDownLeft className="w-5 h-5 text-emerald-500" /> : <ArrowUpRight className="w-5 h-5 text-rose-500" />}
                    </div>
                  </div>

                </div>

                {/* The exchange's only extra input. The amount above is always
                    the "from" side; the "to" side is derived, never typed, so
                    the two legs can never disagree about the rate. */}
                {transactionType === "exchange" && (
                  <div className="w-full max-w-md mt-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="exchange-rate"
                        className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 shrink-0"
                      >
                        {language === "ar" ? "سعر الصرف" : "Exchange rate"}
                      </label>
                      <div className="flex-1 flex items-center gap-2 h-11 px-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 focus-within:ring-2 focus-within:ring-brand-teal/30 transition-all">
                        <span className="text-[11px] font-bold text-slate-400 shrink-0" style={{ direction: "ltr" }}>
                          1 USD =
                        </span>
                        <input
                          id="exchange-rate"
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          required
                          value={exchangeRateInput}
                          onChange={(e) => setExchangeRateInput(e.target.value)}
                          className="w-full min-w-0 bg-transparent text-base font-black font-mono tabular-nums text-slate-900 dark:text-white outline-none"
                          style={{ direction: "ltr" }}
                        />
                        <span className="text-[11px] font-bold text-slate-400 shrink-0">
                          {language === "ar" ? "د.ل" : "LYD"}
                        </span>
                      </div>
                    </div>

                    {/* The "to" side, stated rather than entered. aria-live so a
                        screen reader hears the converted figure change, since it
                        is the number the user is actually deciding on. */}
                    <div
                      aria-live="polite"
                      className="flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-2xl bg-brand-teal/5 dark:bg-brand-teal/10 border border-brand-teal/15"
                    >
                      {exchangeToAmount !== null && exchangeToAmount > 0 ? (
                        <>
                          <span className="text-sm font-black font-mono tabular-nums text-slate-500 dark:text-slate-400" style={{ direction: "ltr" }}>
                            {parseFloat(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
                          </span>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-brand-teal shrink-0" aria-hidden="true" />
                          <span className="text-lg font-black font-mono tabular-nums text-brand-teal" style={{ direction: "ltr" }}>
                            {exchangeToAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {exchangeTo}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400">
                          {language === "ar"
                            ? "أدخل المبلغ وسعر الصرف لحساب الناتج"
                            : "Enter an amount and a rate to see the result"}
                        </span>
                      )}
                    </div>

                    {/* Merged totals are converted at the settings rate, so
                        leaving it behind after a real exchange makes the
                        dashboard report a loss that never happened. */}
                    {hasValidRate && exchangeRateValue !== exchangeRate && (
                      <label className="flex items-center gap-2.5 cursor-pointer py-1 min-h-11">
                        <input
                          type="checkbox"
                          checked={syncDisplayRate}
                          onChange={(e) => setSyncDisplayRate(e.target.checked)}
                          className="w-4 h-4 shrink-0 accent-brand-teal cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                          {language === "ar"
                            ? `حدّث سعر العرض من ${exchangeRate} إلى ${exchangeRateValue} أيضاً`
                            : `Also update the display rate from ${exchangeRate} to ${exchangeRateValue}`}
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* Amount Guidance tag */}
                {transactionType !== "exchange" && amount && parseFloat(amount) > 0 && (
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mt-2 flex items-center gap-1">
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
                    {transactionType === "exchange" ? (
                      <span className="text-slate-400 font-medium">
                        {language === "ar" ? "(اختياري)" : "(optional)"}
                      </span>
                    ) : (
                      <span className="text-rose-500">*</span>
                    )}
                  </label>
                  <div className="relative">
                    <FileSpreadsheet className="absolute top-3.5 right-3.5 rtl:right-auto rtl:left-3.5 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      required={transactionType !== "exchange"}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        transactionType === "exchange"
                          ? exchangeToAmount !== null && exchangeToAmount > 0
                            ? `${language === "ar" ? "صرافة" : "Exchange"} ${amount} ${currency} → ${exchangeToAmount} ${exchangeTo}`
                            : language === "ar"
                              ? "يُكتب تلقائياً من مبلغ الصرافة"
                              : "Filled in from the exchange amounts"
                          : transactionType === "income"
                            ? t.incomeTitleArEn
                            : t.expenseTitlePlaceholder
                      }
                      dir="auto"
                      className="w-full glass-input pl-10 pr-10 rtl:pr-10 rtl:pl-10 py-3.5 text-sm rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-teal/40 dark:text-white font-medium"
                    />
                  </div>
                </div>

                {/* 2. Custom Category Selector & Quick Recs. Hidden for an
                    exchange: both legs are filed under the shared transfer
                    category, so there is nothing here for the user to decide. */}
                <div
                  className={`flex-col gap-2 relative ${transactionType === "exchange" ? "hidden" : "flex"}`}
                  ref={dropdownRef}
                >
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
                    {!createAndTopupWallet && <span className="text-rose-500">*</span>}
                  </label>
                  {walletId && wallets.find(w => w.id === walletId) && !createAndTopupWallet && (
                    <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/5 px-2.5 py-0.5 rounded-md border border-brand-teal/10">
                      {wallets.find(w => w.id === walletId)?.name}
                    </span>
                  )}
                </div>

                {/* Create & Top-up wallet option for new income only */}
                {transactionType === "income" && !editingId && (
                  <div className="bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl flex flex-col gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={createAndTopupWallet}
                        onChange={(e) => {
                          setCreateAndTopupWallet(e.target.checked);
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-brand-teal focus:ring-brand-teal accent-brand-teal cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {language === "ar"
                          ? "إنشاء محفظة جديدة وتغذيتها بهذا الإيراد مباشرة"
                          : "Create a new wallet and top it up with this income"}
                      </span>
                    </label>

                    {createAndTopupWallet && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {language === "ar" ? "اسم المحفظة الجديدة" : "New Wallet Name"} <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newWalletName}
                            onChange={(e) => setNewWalletName(e.target.value)}
                            placeholder={language === "ar" ? "مثال: ميزانية مايو، حساب الراتب الأول..." : "e.g., May budget, primary salary account..."}
                            required={createAndTopupWallet}
                            className="px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl focus:border-brand-teal outline-hidden dark:text-white"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {language === "ar" ? "لون المحفظة المميز" : "Wallet Theme Color"}
                          </label>
                          <div className="flex items-center gap-2.5 h-full py-1">
                            {["slate", "emerald", "blue", "purple", "rose", "amber"].map((col) => {
                              const bgColors: Record<string, string> = {
                                slate: "bg-slate-500",
                                emerald: "bg-emerald-500",
                                blue: "bg-blue-500",
                                purple: "bg-purple-500",
                                rose: "bg-rose-500",
                                amber: "bg-amber-500",
                              };
                              const isSel = newWalletColor === col;
                              return (
                                <button
                                  key={col}
                                  type="button"
                                  onClick={() => setNewWalletColor(col)}
                                  className={`w-5 h-5 rounded-full ${bgColors[col] || "bg-slate-500"} cursor-pointer hover:scale-110 transition-transform relative flex items-center justify-center`}
                                >
                                  {isSel && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!createAndTopupWallet && (() => {
                  const activeWallets = wallets.filter(w => {
                    if (w.id === walletId) return true;
                    // For income transactions, allow selecting archived (empty/hidden) wallets
                    if (transactionType === "income") return true;
                    if (w.isHidden) return false;
                    if (getWalletCurrentBalance(w) <= 0) return false;
                    return true;
                  });
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
                            const isArchivedEmpty = getWalletCurrentBalance(w) <= 0;
                            const isHidden = w.isHidden;
                            const isArchived = isArchivedEmpty || isHidden;
                            return (
                              <button
                                key={w.id}
                                type="button"
                                onClick={() => setWalletId(w.id)}
                                className={`p-3.5 rounded-2xl text-start cursor-pointer transition-all duration-300 relative overflow-hidden flex flex-col justify-between border min-h-[105px] ${
                                  isSelected
                                    ? "bg-brand-slate text-white dark:bg-white dark:text-brand-slate border-transparent shadow-md scale-[1.03] ring-2 ring-brand-teal/40"
                                    : "bg-slate-50/75 dark:bg-slate-900/40 border-slate-100 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300"
                                } ${isArchived && !isSelected ? "opacity-60" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-1.5 mb-2 w-full">
                                  <span className="text-xs font-extrabold truncate max-w-[80%] flex flex-col">
                                    <span className="truncate">{w.name}</span>
                                    {isArchived && (
                                      <span className="text-[9px] text-slate-400 dark:text-slate-400 font-bold mt-0.5">
                                        {language === "ar" ? "(مؤرشفة)" : "(Archived)"}
                                      </span>
                                    )}
                                  </span>
                                  <div className={`p-1 rounded-lg ${isSelected ? "bg-white/10 text-white dark:bg-slate-900/10 dark:text-slate-800" : "bg-slate-200/20 text-slate-400"}`}>
                                    <Wallet className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                                
                                <div className="mt-1">
                                  <p className={`text-[10px] font-medium leading-none ${isSelected ? "text-white/70 dark:text-slate-400" : "text-slate-450 dark:text-slate-400"}`}>
                                    {language === "ar" ? "الرصيد الحالي" : "Current balance"}
                                  </p>
                                  <p className="text-xs font-mono font-black mt-1">
                                    {getWalletCurrentBalance(w).toLocaleString()} <span className="text-[9px]">{w.currency}</span>
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
                                          const isArchivedEmpty = getWalletCurrentBalance(w) <= 0;
                                          const isHidden = w.isHidden;
                                          const isArchived = isArchivedEmpty || isHidden;
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
                                              } ${isArchived ? "opacity-60" : ""}`}
                                            >
                                              <div className="flex items-center gap-2 truncate">
                                                <Wallet className="w-3.5 h-3.5 text-brand-teal flex-shrink-0" />
                                                <span className="truncate">
                                                  {w.name} {isArchived && (language === "ar" ? "(مؤرشفة) " : "(Archived) ")} ({w.currency})
                                                </span>
                                              </div>
                                              <span className="text-[10px] font-mono font-black text-slate-400">
                                                {getWalletCurrentBalance(w).toLocaleString()}
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

                {/* Which compartment of the wallet this expense touches. Hidden
                    until a wallet is picked, and "paid from cash" only appears
                    once there is cash to pay from. An exchange draws on a
                    compartment in exactly the same way, so it gets the picker
                    too — the money has to leave the card or the hand. */}
                {(transactionType === "expense" || transactionType === "exchange") && walletId && (() => {
                  const w = wallets.find((x) => x.id === walletId);
                  if (!w) return null;
                  const { onCard, inCash } = walletStats(w, currency);
                  const isExchange = transactionType === "exchange";
                  const kinds: { kind: ExpenseKind; ar: string; en: string; hint: string }[] = [
                    {
                      kind: "wallet_spend",
                      ar: isExchange ? "من البطاقة" : "مصروف عادي",
                      en: isExchange ? "From the card" : "Normal expense",
                      hint: `${onCard.toLocaleString()} ${currency}`,
                    },
                    // Withdrawing is a movement inside one currency; an exchange
                    // is already a movement, and chaining the two in one row
                    // would leave no way to say what the money became.
                    ...(isExchange
                      ? []
                      : [{
                          kind: "cash_withdrawal" as ExpenseKind,
                          ar: "سحب نقدي",
                          en: "Cash withdrawal",
                          hint: language === "ar" ? "يبقى معك" : "you keep it",
                        }]),
                    ...(inCash !== 0 || expenseKind === "cash_spend"
                      ? [{
                          kind: "cash_spend" as ExpenseKind,
                          ar: isExchange ? "من النقد" : "دفعت من النقد",
                          en: isExchange ? "From cash in hand" : "Paid from cash",
                          hint: `${inCash.toLocaleString()} ${currency}`,
                        }]
                      : []),
                  ];
                  return (
                    <div className="mt-4">
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                        {language === "ar" ? "نوع الحركة على المحفظة" : "Effect on the wallet"}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {kinds.map((k) => (
                          <button
                            key={k.kind}
                            type="button"
                            onClick={() => setExpenseKind(k.kind)}
                            className={`px-3.5 py-2 rounded-2xl text-xs font-bold cursor-pointer transition-all border ${
                              expenseKind === k.kind
                                ? "bg-brand-slate text-white dark:bg-white dark:text-brand-slate border-transparent shadow-md"
                                : "bg-slate-50/75 dark:bg-slate-900/40 border-slate-100 dark:border-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850"
                            }`}
                          >
                            {language === "ar" ? k.ar : k.en}
                            <span className="ms-1.5 font-mono font-medium opacity-60">{k.hint}</span>
                          </button>
                        ))}
                      </div>
                      {expenseKind === "cash_withdrawal" && (
                        <p className="mt-2 text-[10px] font-bold text-amber-500">
                          {language === "ar"
                            ? "يخرج المبلغ من البطاقة ويبقى ملكك نقداً — لا يُحتسب إنفاقاً."
                            : "Leaves the card but stays yours as cash — not counted as spending."}
                        </p>
                      )}
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
                {transactionType !== "income" && (
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
                )}

                {/* C. Image Upload Receipt Dropzone */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-slate-500 dark:text-slate-400">
                    {language === "ar" ? "وثائق الإيصالات والفواتير" : "Doc Receipts & Invoices"}
                  </label>
                  
                  {imageUrl ? (
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                      <div className="flex flex-wrap gap-2.5">
                        {receiptEntries(imageUrl).map((imgUrl, idx) => (
                          <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/50 shadow-xs transition-all hover:scale-[1.03]">
                            {receiptSrc(imgUrl) ? (
                              <img
                                src={receiptSrc(imgUrl)}
                                alt={`Receipt ${idx + 1}`}
                                className="w-full h-full object-cover cursor-pointer"
                                onClick={() => {
                                  setPreviewImagesList([imgUrl]);
                                  setCurrentPreviewIndex(0);
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                            )}
                            {/* ponytail: drops the reference, leaves the object
                                in the bucket. Deleting here would destroy the
                                receipt of a row the user then cancels out of,
                                and of anything sitting in Trash pointing at the
                                same path. Sweep orphans with a scheduled job if
                                storage cost ever shows up. */}
                            <button
                              type="button"
                              onClick={() => {
                                const currentArr = receiptEntries(imageUrl);
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
                      <p className="text-[10px] text-slate-400 dark:text-slate-400 font-bold">
                        {language === "ar"
                          ? `تم إرفاق ${receiptEntries(imageUrl).length} صور. اضغط على أي صورة لمعاينتها بنقاء.`
                          : `Attached ${receiptEntries(imageUrl).length} documents. Click any to preview.`}
                      </p>
                      {receiptsUnavailable && (
                        <p className="text-[10px] text-rose-500 font-bold">
                          {language === "ar"
                            ? "تعذّر تحميل صور المرفقات. المرفقات نفسها ما زالت محفوظة."
                            : "Receipt images could not be loaded. The attachments themselves are still saved."}
                        </p>
                      )}
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
                  dir="auto"
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
                {/* Saving mid-upload would store the transaction without the
                    photo still on its way to the bucket. */}
                <button
                  type="submit"
                  disabled={uploadingReceipts}
                  className="px-12 py-3.5 bg-brand-slate text-white dark:bg-white dark:text-brand-slate hover:opacity-90 font-black text-xs rounded-2xl cursor-pointer transition-all active:scale-95 shadow-md shadow-brand-slate/15 dark:shadow-none disabled:opacity-50 disabled:cursor-wait"
                >
                  {uploadingReceipts
                    ? language === "ar"
                      ? "جارٍ رفع الصور..."
                      : "Uploading receipts..."
                    : t.save}
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
            <div className="glass-card p-4 rounded-2xl flex flex-col">
              {/* Header to toggle expand/collapse */}
              <div
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className="flex items-center justify-between cursor-pointer select-none pb-0.5"
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-brand-teal">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black text-slate-700 dark:text-white">
                    {language === "ar" ? "تصفية المعاملات والبحث" : "Filter & Search Transactions"}
                  </span>
                  
                  {activeFiltersCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-teal/20 text-teal-800 dark:text-brand-teal font-black animate-pulse">
                      {activeFiltersCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery("");
                        setCategoryFilter("");
                        setPriorityFilter("");
                        setWalletFilter("");
                        setTypeFilter("all");
                        setCompartmentFilter("all");
                      }}
                      className="text-[10px] font-black text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors bg-rose-500/10 dark:bg-rose-500/20 px-2.5 py-1 rounded-lg cursor-pointer animate-fade-in"
                    >
                      {language === "ar" ? "إعادة تعيين" : "Reset Filters"}
                    </button>
                  )}
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isFiltersExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Collapsible Content */}
              <AnimatePresence initial={false}>
                {isFiltersExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: "auto", opacity: 1, marginTop: 14 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="space-y-3.5"
                    style={{ overflow: isFiltersExpanded ? "visible" : "hidden" }}
                  >
                    <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/40 space-y-3.5">
                      {/* Type & Search Row */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Segmented Filter control (All vs Income vs Expense) */}
                        <div className="md:col-span-5 grid grid-cols-4 p-1 bg-slate-100/50 dark:bg-slate-950/50 rounded-xl border border-white/10 dark:border-slate-900/30">
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
                            {
                              id: "transfer" as const,
                              label: language === "ar" ? "تحويلات" : "Transfers",
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

                      {/* Compartment: only once a cash row exists, so a card-only
                          user never meets a control with nothing behind it. */}
                      {hasCashRows && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="grid grid-cols-3 p-1 bg-slate-100/50 dark:bg-slate-950/50 rounded-xl border border-white/10 dark:border-slate-900/30 sm:w-80">
                            {[
                              { id: "all" as const, label: language === "ar" ? "الكل" : "All" },
                              { id: "card" as const, label: language === "ar" ? "البطاقة" : "Card" },
                              { id: "cash" as const, label: language === "ar" ? "النقد" : "Cash" },
                            ].map((pill) => (
                              <button
                                key={pill.id}
                                type="button"
                                aria-pressed={compartmentFilter === pill.id}
                                onClick={() => setCompartmentFilter(pill.id)}
                                className={`py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                  compartmentFilter === pill.id
                                    ? "bg-brand-slate text-white dark:bg-white dark:text-brand-slate shadow-xs"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                                }`}
                              >
                                {pill.label}
                              </button>
                            ))}
                          </div>
                          {compartmentFilter !== "all" && (
                            <p className="text-[10px] font-semibold text-slate-400">
                              {language === "ar"
                                ? "السحب النقدي يظهر في القائمتين: يخرج من البطاقة ويدخل النقد."
                                : "Cash withdrawals appear in both: they leave the card and arrive as cash."}
                            </p>
                          )}
                        </div>
                      )}

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

                          {createPortal(
                            <AnimatePresence>
                              {walletFilterOpen && (
                                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 filter-modal-container" dir={language === "ar" ? "rtl" : "ltr"}>
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setWalletFilterOpen(false)}
                                    className="absolute inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs"
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                    transition={{ type: "spring", duration: 0.3 }}
                                    className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-10 flex flex-col max-h-[80vh]"
                                  >
                                    {/* Header */}
                                    <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                                      <div className="flex items-center gap-2.5">
                                        <Wallet className="w-4 h-4 text-brand-teal" />
                                        <span className="font-black text-sm text-slate-850 dark:text-slate-150">
                                          {language === "ar" ? "تصفية حسب المحفظة" : "Filter by Wallet"}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setWalletFilterOpen(false)}
                                        className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors"
                                      >
                                        <X className="w-4.5 h-4.5" />
                                      </button>
                                    </div>

                                    {/* List */}
                                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 p-2.5 max-h-[50vh] scrollbar-thin">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setWalletFilter("");
                                          setWalletFilterOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-start text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between"
                                      >
                                        <span>{language === "ar" ? "كل المحافظ" : "All Wallets"}</span>
                                        {!walletFilter && <Check className="w-4 h-4 text-brand-teal stroke-[3]" />}
                                      </button>
                                      {wallets.map((w) => (
                                        <button
                                          key={w.id}
                                          type="button"
                                          onClick={() => {
                                            setWalletFilter(w.id);
                                            setWalletFilterOpen(false);
                                          }}
                                          className="w-full px-4 py-3 text-start text-xs font-black text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between"
                                        >
                                          <span className="truncate">{w.name} ({w.currency})</span>
                                          {walletFilter === w.id && <Check className="w-4 h-4 text-brand-teal stroke-[3]" />}
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                            </AnimatePresence>,
                            document.body
                          )}
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

                          {createPortal(
                            <AnimatePresence>
                              {categoryFilterOpen && (
                                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 filter-modal-container" dir={language === "ar" ? "rtl" : "ltr"}>
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setCategoryFilterOpen(false)}
                                    className="absolute inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs"
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                    transition={{ type: "spring", duration: 0.3 }}
                                    className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-10 flex flex-col max-h-[80vh]"
                                  >
                                    {/* Header */}
                                    <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                                      <div className="flex items-center gap-2.5">
                                        <Tag className="w-4 h-4 text-brand-teal" />
                                        <span className="font-black text-sm text-slate-850 dark:text-slate-150">
                                          {language === "ar" ? "تصفية حسب التصنيف" : "Filter by Category"}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setCategoryFilterOpen(false)}
                                        className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors"
                                      >
                                        <X className="w-4.5 h-4.5" />
                                      </button>
                                    </div>

                                    {/* List */}
                                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 p-2.5 max-h-[50vh] scrollbar-thin">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCategoryFilter("");
                                          setCategoryFilterOpen(false);
                                        }}
                                        className="w-full px-4 py-3 text-start text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between"
                                      >
                                        <span>{language === "ar" ? "كل التصنيفات" : "All Categories"}</span>
                                        {!categoryFilter && <Check className="w-4 h-4 text-brand-teal stroke-[3]" />}
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
                                            className={`w-full px-4 py-3 text-start text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between ${
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
                                            {isSelected && <Check className="w-4 h-4 text-brand-teal stroke-[3] flex-shrink-0" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                            </AnimatePresence>,
                            document.body
                          )}
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

                          {createPortal(
                            <AnimatePresence>
                              {priorityFilterOpen && (
                                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 filter-modal-container" dir={language === "ar" ? "rtl" : "ltr"}>
                                  <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setPriorityFilterOpen(false)}
                                    className="absolute inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs"
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                    transition={{ type: "spring", duration: 0.3 }}
                                    className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-10 flex flex-col max-h-[80vh]"
                                  >
                                    {/* Header */}
                                    <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                                      <div className="flex items-center gap-2.5">
                                        <AlertTriangle className="w-4 h-4 text-brand-teal" />
                                        <span className="font-black text-sm text-slate-850 dark:text-slate-150">
                                          {language === "ar" ? "تصفية حسب الأهمية" : "Filter by Priority"}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setPriorityFilterOpen(false)}
                                        className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800 transition-colors"
                                      >
                                        <X className="w-4.5 h-4.5" />
                                      </button>
                                    </div>

                                    {/* List */}
                                    <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 p-2.5 max-h-[50vh] scrollbar-thin">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPriorityFilter("");
                                          setPriorityFilterOpen(false);
                                        }}
                                        className="w-full px-4 py-3.5 text-start text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between"
                                      >
                                        <span>{language === "ar" ? "كل المستويات" : "All Levels"}</span>
                                        {!priorityFilter && <Check className="w-4 h-4 text-brand-teal stroke-[3]" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPriorityFilter("high");
                                          setPriorityFilterOpen(false);
                                        }}
                                        className="w-full px-4 py-3.5 text-start text-xs font-black text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                          <span>{language === "ar" ? "مرتفعة جداً" : "Urgent / High"}</span>
                                        </div>
                                        {priorityFilter === "high" && <Check className="w-4 h-4 text-rose-500 stroke-[3]" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPriorityFilter("medium");
                                          setPriorityFilterOpen(false);
                                        }}
                                        className="w-full px-4 py-3.5 text-start text-xs font-black text-teal-600 dark:text-teal-400 hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                                          <span>{language === "ar" ? "متوسطة" : "General / Medium"}</span>
                                        </div>
                                        {priorityFilter === "medium" && <Check className="w-4 h-4 text-brand-teal stroke-[3]" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPriorityFilter("low");
                                          setPriorityFilterOpen(false);
                                        }}
                                        className="w-full px-4 py-3.5 text-start text-xs font-black text-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-850/50 rounded-xl cursor-pointer flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                          <span>{language === "ar" ? "منخفضة" : "Optional / Low"}</span>
                                        </div>
                                        {priorityFilter === "low" && <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />}
                                      </button>
                                    </div>
                                  </motion.div>
                                </div>
                              )}
                            </AnimatePresence>,
                            document.body
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

      {/* 4. Combined Chronological Ledger List */}
      <div className="glass-card rounded-3xl overflow-hidden">
        {/* Ledger Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/60 flex flex-col gap-3.5 sm:flex-row sm:justify-between sm:items-center bg-slate-550/5/30 dark:bg-slate-900/10">
          <span className="text-xs font-black text-brand-slate dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 select-none">
            <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse flex-shrink-0" />
            <span className="whitespace-nowrap">
              {language === "ar"
                ? "كشف العمليات الموحد الزمني"
                : "Consolidated Ledger Feed"}
            </span>
          </span>
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setHideHistoricalData(!hideHistoricalData)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs border whitespace-nowrap select-none ${
                hideHistoricalData 
                  ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 flex-shrink-0 ${hideHistoricalData ? 'text-amber-500' : 'text-slate-450'}`} />
              <span className="whitespace-nowrap">
                {hideHistoricalData 
                  ? (language === "ar" ? "إظهار البيانات القديمة" : "Show Historical") 
                  : (language === "ar" ? "إخفاء البيانات القديمة" : "Hide Historical")
                }
              </span>
            </button>
            <span className="px-2.5 py-1.5 text-[10px] sm:text-xs font-black bg-slate-100/80 dark:bg-slate-800 text-slate-650 dark:text-slate-300 rounded-xl border border-slate-200/50 dark:border-white/10 whitespace-nowrap select-none">
              {filteredTransactions.length}{" "}
              {language === "ar" ? "عملية مسجلة" : "Settled Entries"}
            </span>
          </div>
        </div>

        {/* Ledger Items */}
        <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
          {filteredTransactions.length > 0 ? (
            <>
              {filteredTransactions.slice(0, visibleLimit).map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                const catLabel = cat
                  ? cat.name.split(" / ")[language === "ar" ? 0 : 1] || cat.name
                  : (tx.categoryName || t.none);

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
                            (tx as any).transferPair
                              ? "bg-brand-teal/10 text-brand-teal border-brand-teal/20"
                              : tx.type === "income"
                                ? "bg-brand-green/20 text-emerald-600 border-brand-green/30 dark:bg-brand-green/10 dark:text-brand-green"
                                : "bg-rose-50 dark:bg-rose-950/20 text-rose-500 border-rose-200/20 dark:border-rose-900/10"
                          }`}
                        >
                          {(tx as any).transferPair ? (
                            <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
                          ) : tx.type === "income" ? (
                            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                          ) : (
                            <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                          )}
                        </div>

                        {/* Metadata summary block */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4
                              onClick={() => setExpandedTitlesTxIds(prev => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                              className={`font-extrabold text-sm text-slate-900 dark:text-white cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150 ${expandedTitlesTxIds[tx.id] ? "whitespace-normal break-words" : "truncate"}`}
                              dir="auto"
                              title={language === "ar" ? "اضغط للتكبير/التصغير" : "Click to expand/collapse"}
                            >
                              {tx.title}
                            </h4>

                            {tx.isHistorical && (
                              <span className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200/20 dark:border-amber-900/10">
                                {language === 'ar' ? 'بيان قديم/مستورد' : 'Historical/Imported'}
                              </span>
                            )}

                            {/* Transaction Type label */}
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                                (tx as any).transferPair
                                  ? "bg-brand-teal/10 text-brand-teal"
                                  : tx.type === "income"
                                    ? "bg-brand-green/20 text-emerald-800 dark:bg-brand-green/10 dark:text-brand-green"
                                    : "bg-brand-slate text-white dark:bg-white/10 dark:text-white"
                              }`}
                            >
                              {(tx as any).transferPair
                                ? (tx as any).transferPair.currency === tx.currency
                                  ? language === "ar" ? "تحويل" : "Transfer"
                                  : language === "ar" ? "صرافة" : "Exchange"
                                : tx.type === "income"
                                ? language === "ar"
                                  ? "وارد"
                                  : "Income"
                                : language === "ar"
                                  ? "صادر"
                                  : "Expense"}
                            </span>

                            {/* A withdrawal sits in the feed as an outflow of the
                                card, so say plainly that the money is still yours. */}
                            {(tx as any).expenseKind === "cash_withdrawal" && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/20 dark:border-amber-900/10">
                                {language === "ar" ? "سحب نقدي — تحوّل لنقد" : "Withdrawal — became cash"}
                              </span>
                            )}
                            {(tx as any).expenseKind === "cash_spend" && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {language === "ar" ? "من النقد" : "From cash"}
                              </span>
                            )}

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
                            <p 
                              onClick={() => setExpandedNotesTxIds(prev => ({ ...prev, [tx.id]: !prev[tx.id] }))}
                              className={`text-xs text-slate-500 dark:text-slate-400 max-w-xl cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150 ${expandedNotesTxIds[tx.id] ? "" : "line-clamp-2"}`} 
                              dir="auto"
                              title={language === "ar" ? "اضغط للتكبير/_التصغير" : "Click to expand/collapse"}
                            >
                              {tx.notes}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 dark:text-slate-400 font-semibold">
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
                                  : "hover:text-brand-teal text-slate-400 dark:text-slate-400"
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
                        <div className="flex flex-col items-end">
                          {(tx as any).transferPair ? (
                            // Both halves on one line, because the movement is
                            // the thing that happened — showing only the outflow
                            // would read as money lost.
                            <span
                              className="font-black text-base text-brand-slate dark:text-white flex items-center gap-1.5 whitespace-nowrap"
                              style={{ direction: "ltr" }}
                            >
                              <span className="text-slate-400 dark:text-slate-400 font-bold text-sm tabular-nums">
                                {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                                {tx.currency}
                              </span>
                              <ArrowRightLeft className="w-3.5 h-3.5 text-brand-teal shrink-0" aria-hidden="true" />
                              <span className="text-brand-teal tabular-nums">
                                {(tx as any).transferPair.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                                {(tx as any).transferPair.currency}
                              </span>
                            </span>
                          ) : (
                          <span
                            className={`font-black text-base ${
                              isInflow(tx as any)
                                ? "text-emerald-500" // palette custom positive green
                                : (tx as any).isRefunded
                                  ? "text-brand-slate dark:text-white line-through decoration-rose-500 decoration-2"
                                  : "text-brand-slate dark:text-white font-extrabold"
                            }`}
                          >
                            {isInflow(tx as any) ? "+" : "-"}{" "}
                            {((tx as any).isRefunded ? ((tx as any).originalAmount || 0) : tx.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}{" "}
                            {tx.currency === "LYD" ? t.lydSymbol : t.usdSymbol}
                          </span>
                          )}
                          {/* A label as well as a colour, so the movement reads
                              as a movement without relying on the teal alone. */}
                          {(tx as any).transferPair && (
                            <span className="text-[10px] font-black text-brand-teal bg-brand-teal/5 dark:bg-brand-teal/10 px-2 py-0.5 rounded-full mt-1 border border-brand-teal/15 flex items-center gap-1">
                              {(tx as any).transferPair.currency === tx.currency
                                ? language === "ar" ? "تحويل" : "Transfer"
                                : `${language === "ar" ? "صرافة" : "Exchange"} @ ${(tx.amount / (tx as any).transferPair.amount).toFixed(2)}`}
                            </span>
                          )}
                          {!(tx as any).isRefunded && (tx as any).originalAmount && (tx as any).originalAmount > tx.amount && (
                            <span className="text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full mt-0.5 border border-amber-100 dark:border-amber-900/30">
                              {language === 'ar' ? 'مسترد جزئياً' : 'Partially Refunded'}
                            </span>
                          )}
                          {(tx as any).isRefunded && (
                             <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full mt-0.5 border border-emerald-100 dark:border-emerald-900/30">
                               {t.refundedStatus}
                             </span>
                          )}
                        </div>

                        {/* Actions container */}
                        <div className="flex items-center gap-1.5">
                          {/* Refund and due are meaningless on a withdrawal, and
                              refunding one zeroes its amount — which would delete
                              the cash it produced. */}
                          {tx.type === "expense" && !(tx as any).isRefunded && (tx as any).expenseKind !== "cash_withdrawal" && !(tx as any).transferPair && (
                            <button
                              onClick={() => toggleExpenseDue(tx.id, !(tx as any).isDue)}
                              className={`p-2 rounded-xl transition-colors cursor-pointer border ${(tx as any).isDue ? 'bg-rose-50 text-rose-500 border-rose-200/50 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-900/30 dark:hover:bg-rose-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 border-transparent hover:border-rose-500/10'}`}
                              title={(tx as any).isDue ? (language === 'ar' ? 'إلغاء كمستحق' : 'Remove Due Status') : (language === 'ar' ? 'تحديد كمستحق (مطلوب)' : 'Mark as Due (Pending)')}
                            >
                              <Wallet className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {tx.type === "expense" && (tx as any).expenseKind !== "cash_withdrawal" && !(tx as any).transferPair && (
                             <button
                               onClick={() => toggleExpenseRefund(tx.id, !(tx as any).isRefunded)}
                               className={`p-2 rounded-xl transition-colors cursor-pointer border ${(tx as any).isRefunded ? 'bg-amber-50 text-amber-500 border-amber-200/50 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900/30 dark:hover:bg-amber-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 border-transparent hover:border-amber-500/10'}`}
                               title={(tx as any).isRefunded ? t.unrefundAction : t.refundAction}
                             >
                               <Layers className="w-3.5 h-3.5" />
                             </button>
                          )}
                          {(partialWallets.has(tx.walletId ?? "") ||
                            partialWallets.has((tx as any).transferPair?.walletId ?? "")) && (
                            <button
                              onClick={() => void toggleHidden(tx)}
                              aria-pressed={!!(tx as any).hiddenFromViewers}
                              className={`p-2 rounded-xl transition-colors cursor-pointer border ${(tx as any).hiddenFromViewers ? "bg-amber-50 text-amber-600 border-amber-200/50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 border-transparent"}`}
                              title={
                                (tx as any).hiddenFromViewers
                                  ? language === "ar" ? "مخفية عن المشاهدين — اضغط لإظهارها" : "Hidden from viewers — tap to show"
                                  : language === "ar" ? "إخفاء التفاصيل عن المشاهدين" : "Hide details from viewers"
                              }
                            >
                              {(tx as any).hiddenFromViewers ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                            </button>
                          )}
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
                          {/* A transfer is not editable. Its two legs encode the
                              rate between them, so changing one amount would
                              silently restate a rate the other leg still
                              contradicts. Delete the pair and re-enter it. */}
                          {!(tx as any).transferPair && (
                            <button
                              onClick={() => handleEditClick(tx)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/20"
                              title={t.edit}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              showConfirm(
                                language === "ar" ? "حذف المعاملة" : "Delete Transaction",
                                (tx as any).transferPair
                                  ? language === "ar"
                                    ? `سيتم حذف طرفَي هذه الحركة معاً ("${tx.title}") — الصادر والوارد — لأن حذف طرف واحد يترك المال وقد خرج ولم يصل. متابعة؟`
                                    : `Both legs of this movement ("${tx.title}") will be deleted together — the outgoing and the incoming — because removing one leg alone leaves the money having left and never arrived. Continue?`
                                  : language === "ar"
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
                                    <p className="text-xs text-slate-650 dark:text-slate-300 break-words whitespace-pre-wrap" dir="auto">
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
                            <p className="text-xs text-slate-400 dark:text-slate-400 italic py-1">
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
                              dir="auto"
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

      <AnimatePresence mode="wait">
        {activeSubTab === 'refunds' && (
          <motion.div
            key="refunds-list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="glass-card rounded-3xl p-4">
              <h3 className="font-extrabold text-sm text-brand-slate dark:text-white mb-4 px-2">
                {(t as any).refundsTab || (language === 'ar' ? 'الاستردادات' : 'Refunds')}
              </h3>
              
              {expenses.filter(e => (e as any).isRefunded || ((e as any).originalAmount && (e as any).originalAmount > e.amount)).length > 0 ? (
                <div className="space-y-3">
                  {expenses.filter(e => (e as any).isRefunded || ((e as any).originalAmount && (e as any).originalAmount > e.amount)).sort((a,b) => new Date((b as any).refundedAt || b.updatedAt || b.date).getTime() - new Date((a as any).refundedAt || a.updatedAt || a.date).getTime()).map(exp => (
                    <div
                      key={exp.id}
                      className="group flex flex-col p-4 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm hover:shadow-md transition-all cursor-default"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 border border-amber-100 dark:border-amber-800/30 flex items-center justify-center font-bold text-lg shadow-inner">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-brand-slate dark:text-white">{exp.title}</h4>
                            <p className="text-xs text-slate-500 font-medium">
                              {language === 'ar' ? 'آخر تحديث:' : 'Last updated:'} {new Date((exp as any).refundedAt || exp.updatedAt || exp.date).toLocaleString(language === 'ar' ? 'ar-LY' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex flex-col items-end text-[11px] font-bold bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl w-full min-w-[140px] border border-slate-100 dark:border-slate-700/50">
                            <div className="flex justify-between w-full text-slate-500 mb-1">
                              <span>{language === 'ar' ? 'الكلي:' : 'Total:'}</span>
                              <span className="line-through decoration-rose-500/50 decoration-2 ml-2">
                                {((exp as any).originalAmount || exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between w-full text-emerald-600 dark:text-emerald-400 mb-1">
                              <span>{language === 'ar' ? 'المُسترد:' : 'Recovered:'}</span>
                              <span className="ml-2">
                                {(((exp as any).originalAmount || exp.amount) - exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between w-full text-rose-600 dark:text-rose-400 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                              <span>{language === 'ar' ? 'الباقي:' : 'Remaining:'}</span>
                              <span className="ml-2">
                                {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full mt-1 border ${
                            (exp as any).isRefunded 
                              ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30' 
                              : 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30'
                          }`}>
                            {(exp as any).isRefunded ? t.refundedStatus : (language === 'ar' ? 'مسترد جزئياً' : 'Partially Refunded')}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={() => toggleExpenseRefund(exp.id, false)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          {t.unrefundAction}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400 text-xs font-semibold">
                  {language === 'ar' ? 'لا توجد استردادات مسجلة بعد.' : 'No refunds recorded yet.'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeSubTab === 'dues' && (
          <motion.div
            key="dues-list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="glass-card rounded-3xl p-4">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-extrabold text-sm text-brand-slate dark:text-white">
                  {language === 'ar' ? 'المستحقات (مطلوبة من الآخرين)' : 'Dues (Owed to you)'}
                </h3>
                <span className="text-xs font-black bg-rose-50 text-rose-500 px-3 py-1.5 rounded-xl border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30">
                  {language === 'ar' ? 'الإجمالي المتبقي:' : 'Remaining Total:'} {expenses.filter(e => e.isDue && !e.isRefunded && e.currency === globalCurrency).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {globalCurrency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                </span>
              </div>
              
              {expenses.filter(e => e.isDue && !e.isRefunded).length > 0 ? (
                <div className="space-y-3">
                  {expenses.filter(e => e.isDue && !e.isRefunded).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(exp => (
                    <div
                      key={exp.id}
                      className="group flex flex-col p-4 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-3xl border border-rose-100 dark:border-rose-900/20 shadow-sm hover:shadow-md transition-all cursor-default"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 border border-rose-100 dark:border-rose-800/30 flex items-center justify-center font-bold text-lg shadow-inner">
                            <Wallet className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-brand-slate dark:text-white">{exp.title}</h4>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                              {new Date(exp.date).toLocaleDateString(language === 'ar' ? 'ar-LY' : 'en-US', { dateStyle: 'medium' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {(exp as any).originalAmount && (exp as any).originalAmount > exp.amount ? (
                            <div className="flex flex-col items-end text-[11px] font-bold bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl w-full min-w-[140px] border border-slate-100 dark:border-slate-700/50">
                              <div className="flex justify-between w-full text-slate-500 mb-1">
                                <span>{language === 'ar' ? 'الكلي:' : 'Total:'}</span>
                                <span className="line-through decoration-rose-500/50 decoration-2 ml-2">
                                  {((exp as any).originalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between w-full text-emerald-600 dark:text-emerald-400 mb-1">
                                <span>{language === 'ar' ? 'المُسترد:' : 'Recovered:'}</span>
                                <span className="ml-2">
                                  {(((exp as any).originalAmount) - exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between w-full text-rose-600 dark:text-rose-400 border-t border-slate-200 dark:border-slate-700 pt-1 mt-1">
                                <span>{language === 'ar' ? 'الباقي:' : 'Remaining:'}</span>
                                <span className="ml-2">
                                  {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="font-black text-rose-600 dark:text-rose-400 text-base">
                              {exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {exp.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setRecoverDueId(exp.id);
                            const rem = exp.amount;
                            setRecoverDueMax(rem);
                            setRecoverDueAmount(rem.toString());
                          }}
                          className="px-5 py-2.5 bg-brand-teal text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-brand-teal/20 cursor-pointer"
                        >
                          {language === 'ar' ? 'استرداد المستحق (أو جزء منه)' : 'Recover Due'}
                        </button>
                        <button
                          onClick={() => toggleExpenseDue(exp.id, false)}
                          className="px-5 py-2.5 bg-brand-slate text-white dark:bg-white dark:text-brand-slate rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md cursor-pointer"
                        >
                          {language === 'ar' ? 'العفو' : 'Forgive'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-slate-400 text-xs font-semibold">
                  {language === 'ar' ? 'لا توجد مستحقات مسجلة.' : 'No dues recorded.'}
                </div>
              )}
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
                {receiptSrc(previewImagesList[currentPreviewIndex]) ? (
                  <img
                    src={receiptSrc(previewImagesList[currentPreviewIndex])}
                    alt="Full Receipt Photo"
                    className="max-h-[60vh] w-auto object-contain rounded-xl shadow-xl transition-all duration-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <p className="text-xs font-bold text-slate-400 py-24">
                    {receiptsUnavailable
                      ? language === "ar"
                        ? "تعذّر تحميل هذا المرفق."
                        : "This receipt could not be loaded."
                      : language === "ar"
                        ? "جارٍ التحميل..."
                        : "Loading..."}
                  </p>
                )}

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
                      {receiptSrc(url) ? (
                        <img
                          src={receiptSrc(url)}
                          alt={`Slide ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
                      )}
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

      {/* 6. Overdraft Warning / Wallet Split Modal */}
      <AnimatePresence>
        {overdraftModalOpen && overdraftData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setOverdraftModalOpen(false);
                setOverdraftData(null);
              }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-modal max-w-md w-full rounded-3xl overflow-hidden p-6 z-10 relative bg-white dark:bg-slate-900 shadow-2xl flex flex-col gap-4 border border-rose-500/20"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-rose-100 dark:border-rose-500/20">
                <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-500 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-600 dark:text-rose-400">
                    {language === "ar" ? "رصيد غير كافٍ - تقسيم المعاملة" : "Insufficient Balance - Split Transaction"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight">
                    {language === "ar" 
                      ? "المحفظة المختارة لا تغطي كامل المبلغ." 
                      : "Selected wallet does not cover the full amount."}
                  </p>
                </div>
              </div>

              <div className="space-y-4 py-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {language === "ar" 
                      ? `محفظة "${overdraftData.originalWallet.name}" رصيدها الحالي ${overdraftData.currentBalance.toLocaleString()} ${currency} والمعاملة تتطلب ${overdraftData.numericAmount.toLocaleString()} ${currency}.` 
                      : `"${overdraftData.originalWallet.name}" currently has ${overdraftData.currentBalance.toLocaleString()} ${currency}, but the transaction requires ${overdraftData.numericAmount.toLocaleString()} ${currency}.`
                    }
                  </p>
                  <div className="mt-3 flex items-center justify-between font-bold text-sm">
                    <span className="text-slate-500">{language === "ar" ? "المبلغ المتبقي المطلوب:" : "Remaining amount needed:"}</span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {overdraftData.remainingAmount.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>

                {overdraftData.availableWallets.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {language === "ar" 
                        ? (overdraftData.currentBalance > 0 ? "اختر محفظة بديلة لتغطية الباقي" : "اختر محفظة بديلة لدفع كامل المبلغ") 
                        : (overdraftData.currentBalance > 0 ? "Select an alternative wallet for the rest" : "Select an alternative wallet for the entire amount")}
                    </label>
                    <div className="space-y-2 overflow-y-auto max-h-40 pe-1">
                      {overdraftData.availableWallets.map(w => (
                        <button
                          key={w.id}
                          onClick={() => setSelectedAlternativeWalletId(w.id)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            selectedAlternativeWalletId === w.id
                              ? "border-brand-teal bg-brand-teal/5 dark:bg-brand-teal/10"
                              : "border-slate-200 dark:border-slate-800 hover:border-brand-teal/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Wallet className={`w-4 h-4 ${selectedAlternativeWalletId === w.id ? "text-brand-teal" : "text-slate-400"}`} />
                            <span className="text-sm font-bold text-slate-800 dark:text-white">{w.name}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {getWalletCurrentBalance(w).toLocaleString()} {w.currency}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {language === "ar" 
                        ? "لا توجد محافظ أخرى كافية لتغطية المبلغ. المتابعة ستجعل الرصيد سالباً." 
                        : "No other wallets have enough balance to cover this. Proceeding will result in a negative balance."}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/40">
                <button
                  type="button"
                  onClick={() => {
                    setOverdraftModalOpen(false);
                    setOverdraftData(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleForceProceed}
                  className="px-4 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-400 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {language === "ar" ? "المتابعة بالرصيد السالب" : "Proceed (Negative)"}
                </button>

                {overdraftData.availableWallets.length > 0 && (
                  <button
                    type="button"
                    onClick={handleOverdraftProceed}
                    className="px-4 py-2 bg-brand-teal text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-teal/20 hover:opacity-90 transition-all cursor-pointer"
                  >
                    {language === "ar" 
                      ? (overdraftData.currentBalance > 0 ? "تقسيم وتسجيل المعاملة" : "دفع من محفظة بديلة") 
                      : (overdraftData.currentBalance > 0 ? "Split & Record" : "Pay from Alternative")}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Recover Due Modal */}
      <AnimatePresence>
        {recoverDueId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRecoverDueId(null)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-modal max-w-sm w-full rounded-3xl overflow-hidden p-6 z-10 relative bg-white dark:bg-slate-900 shadow-2xl flex flex-col gap-4 border border-brand-teal/20"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-brand-teal/10">
                <div className="w-10 h-10 rounded-full bg-brand-teal/10 text-brand-teal flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white">
                    {language === "ar" ? "استرداد المستحق" : "Recover Due"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {language === "ar" ? "إدخال المبلغ المدفوع" : "Enter paid amount"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">
                    {language === "ar" ? "المبلغ المسترد" : "Recovered Amount"}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={recoverDueAmount}
                    onChange={(e) => {
                      // restrict to max amount
                      const val = Number(e.target.value);
                      if (val > recoverDueMax) {
                        setRecoverDueAmount(recoverDueMax.toString());
                      } else {
                        setRecoverDueAmount(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-lg font-black text-brand-slate dark:text-white focus:ring-2 focus:ring-brand-teal outline-none transition-all"
                    placeholder="0.00"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">
                      {language === "ar" ? "الحد الأقصى:" : "Max:"} {recoverDueMax.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecoverDueAmount(recoverDueMax.toString())}
                      className="text-[10px] font-bold px-2 py-1 bg-brand-teal/10 text-brand-teal rounded-lg cursor-pointer hover:bg-brand-teal/20 transition-colors"
                    >
                      {language === "ar" ? "كامل المبلغ" : "Full Amount"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/40">
                <button
                  type="button"
                  onClick={() => setRecoverDueId(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const amount = Number(recoverDueAmount);
                    if (amount > 0 && recoverDueId) {
                      await recoverDue(recoverDueId, amount);
                      setRecoverDueId(null);
                    }
                  }}
                  disabled={!recoverDueAmount || Number(recoverDueAmount) <= 0}
                  className="px-4 py-2 bg-brand-teal text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-teal/20 hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {language === "ar" ? "تأكيد الاسترداد" : "Confirm Recovery"}
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
