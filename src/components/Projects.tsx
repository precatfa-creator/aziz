/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Archive,
  Briefcase,
  Paperclip,
  ImagePlus,
  Link2,
  Unlink,
  StickyNote,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Paperclip as AttachIcon,
  Loader2,
  Check,
  TrendingUp,
  TrendingDown,
  Users,
  CircleCheck,
  Clock,
} from 'lucide-react';
import { Area, AreaChart, Cell, ComposedChart, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Expense, Income, Project, ProjectEntry } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { isProjectCost, netSeries, projectFamily, projectTotals, shareTotals, inRange, RANGE_DAYS, type NetPoint, type Range } from '../lib/projectTotals';
import { convertAmount, isEarning } from '../lib/walletBalance';
import { RECEIPTS_BUCKET, resolveReceiptUrls, uploadReceipt } from '../lib/receiptStorage';
import { isInlineReceipt } from '../lib/receiptImages';
import { fileToReceiptJpeg } from '../lib/imageDownscale';
import { supabase } from '../supabase';
import {
  PROJECT_FILE_ACCEPT,
  PROJECT_FILES_BUCKET,
  formatFileSize,
  projectFilePath,
  validateProjectFile,
} from '../lib/projectFiles';

const inputClass =
  'px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white';

const today = () => new Date().toISOString().slice(0, 10);

type LedgerEntry = { kind: 'expense'; date: string; row: Expense } | { kind: 'income'; date: string; row: Income };
type TimelineEntry =
  | LedgerEntry
  | { kind: 'note'; date: string; id: string; text: string; projectId: string }
  | { kind: 'entry'; date: string; entry: ProjectEntry; projectId: string };

/** The add/edit form for a project-only entry; `amount` stays text while typed. */
type EntryForm = Omit<ProjectEntry, 'id' | 'amount' | 'notes'> & { id?: string; projectId?: string; amount: string; notes: string };

const UP = '#10b981';
const DOWN = '#f43f5e';
const MINE = '#6366f1';
const SLICES = ['#f43f5e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#14b8a6', '#94a3b8'];

/** The project's running net, stock-chart style; green above water, red below. */
const NetChart: React.FC<{ data: NetPoint[]; showMine: boolean; fmt: (n: number) => string; ar: boolean }> = ({ data, showMine, fmt, ar }) => {
  const color = (data.at(-1)?.net ?? 0) < 0 ? DOWN : UP;
  const gid = `net-${React.useId().replace(/:/g, '')}`;
  return (
    // ltr: Arabic layout must not mirror the time axis.
    <div dir="ltr" className="h-56 sm:h-64 -mx-2 text-slate-400">
      <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: color, strokeOpacity: 0.4 }}
            content={({ active, payload }) => {
              const pt = active && (payload?.[0]?.payload as NetPoint | undefined);
              if (!pt) return null;
              return (
                <div dir={ar ? 'rtl' : 'ltr'} className="rounded-xl bg-slate-900 text-white px-3 py-2 text-xs shadow-xl space-y-0.5">
                  <div className="text-slate-400 font-bold">{pt.date}</div>
                  <div className="font-black tabular-nums">{fmt(pt.net)}</div>
                  {showMine && <div className="tabular-nums text-indigo-300">{ar ? 'حصتك ' : 'Your share '}{fmt(pt.mine)}</div>}
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="net" stroke={color} strokeWidth={2.5} fill={`url(#${gid})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          {showMine && <Line type="monotone" dataKey="mine" stroke={MINE} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

const Sparkline: React.FC<{ data: NetPoint[] }> = ({ data }) => {
  const color = (data.at(-1)?.net ?? 0) < 0 ? DOWN : UP;
  if (data.length < 2) return <div className="h-12" />;
  return (
    <div dir="ltr" className="h-12">
      <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
          <YAxis hide domain={['auto', 'auto']} />
          <Area type="monotone" dataKey="net" stroke={color} strokeWidth={1.75} fill={color} fillOpacity={0.08} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Return on what went in: earned / spent − 1. None until something is spent. */
const roi = (earned: number, spent: number) => (spent > 0 ? (earned / spent - 1) * 100 : null);

const RoiPill: React.FC<{ value: number | null; small?: boolean }> = ({ value, small }) => {
  if (value === null) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      dir="ltr"
      className={`inline-flex items-center gap-1 rounded-full font-black tabular-nums ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${
        up ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
      }`}
    >
      <Icon className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {up ? '+' : ''}
      {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
    </span>
  );
};

export const Projects: React.FC = () => {
  const {
    t,
    language,
    currency,
    exchangeRate,
    projects,
    incomes,
    expenses,
    categories,
    wallets,
    user,
    addProject,
    updateProject,
    deleteProject,
    setTransactionsProject,
    setTransactionsSettled,
  } = useApp();
  const ar = language === 'ar';
  const sym = (c: 'LYD' | 'USD') => (c === 'LYD' ? t.lydSymbol : t.usdSymbol);
  const fmt = (n: number, c: 'LYD' | 'USD' = currency) =>
    `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${sym(c)}`;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    description: string;
    parentId: string;
    /** The stored logo; '' once the user removes it in the form. */
    logoUrl: string;
    logoFile?: File;
  } | null>(null);
  // Signed URLs for logo paths, keyed by path; inline data: logos need none.
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  // Roll sub-projects' figures into their parents — one setting for the list,
  // the tree and the project page, remembered on this device.
  const [combined, setCombinedState] = useState(() => {
    try {
      return localStorage.getItem('aziz_projects_combined') === 'true';
    } catch {
      return false;
    }
  });
  const setCombined = (value: boolean) => {
    setCombinedState(value);
    try {
      localStorage.setItem('aziz_projects_combined', String(value));
    } catch {
      // Private mode: the choice simply lasts for this visit.
    }
  };
  const [noteDate, setNoteDate] = useState(today());
  const [noteText, setNoteText] = useState('');
  const [entryForm, setEntryForm] = useState<EntryForm | null>(null);
  const entryFormRef = useRef<HTMLFormElement>(null);
  // Edit is tapped on a timeline row far below; bring the form into view once.
  const entryFormKey = entryForm ? entryForm.id || 'new' : '';
  useEffect(() => {
    if (entryFormKey) entryFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [entryFormKey]);
  const [linking, setLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState<Range>('ALL');
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const selected = projects.find((p) => p.id === selectedId) || null;
  const byId = (id?: string) => projects.find((p) => p.id === id);
  const childrenOf = (id: string) => projects.filter((p) => p.parentId === id);
  const familyOf = (p: Project) => projectFamily(projects, p.id);
  const totalsOf = (p: Project, withChildren = false) =>
    projectTotals(withChildren ? familyOf(p) : new Set([p.id]), incomes, expenses, currency, exchangeRate, projects);
  const shareOf = (ids: Set<string>) => shareTotals(ids, incomes, expenses, currency, exchangeRate, projects);
  const seriesOf = (ids: Set<string>) => netSeries(ids, incomes, expenses, currency, exchangeRate, projects);
  const scopeOf = (p: Project, withChildren: boolean) => (withChildren ? familyOf(p) : new Set([p.id]));
  // What the detail view covers: the project alone, or with everything under it.
  const scope = useMemo(
    () => (selected ? (combined ? projectFamily(projects, selected.id) : new Set([selected.id])) : new Set<string>()),
    [selected, combined, projects],
  );
  const openProject = (id: string | null) => {
    setSelectedId(id);
    setRange('ALL');
    setLinking(false);
    setEntryForm(null);
  };
  const categoryName = (row: Income | Expense) =>
    categories.find((c) => c.id === row.categoryId)?.name || row.categoryName || '';
  // Where the money came from or went: a wallet, or a source outside the app.
  const sourceName = (row: Income | Expense) =>
    ('externalSource' in row && row.externalSource) || wallets.find((w) => w.id === row.walletId)?.name || '';

  // The transaction's own date as recorded ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"),
  // built from its parts so a date-only value isn't shifted by UTC parsing.
  const txDate = (date: string) => {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    const day = new Date(y, m - 1, d).toLocaleDateString(ar ? 'ar-LY' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = date.slice(11, 16);
    return (
      <span className="w-20 shrink-0 text-[11px] leading-tight text-slate-500 dark:text-slate-400">
        <span className="block font-bold">{day}</span>
        {time && <span className="block" dir="ltr">{time}</span>}
      </span>
    );
  };

  /** Category · wallet · receipt marker, then the notes — a row's details line. */
  const details = (row: Income | Expense, extra?: React.ReactNode) => (
    <div className="text-[10px] text-slate-400 min-w-0">
      <div className="truncate">
        {[categoryName(row), sourceName(row)].filter(Boolean).join(' · ')}
        {row.imageUrl && <Paperclip className="inline w-3 h-3 ms-1 -mt-0.5" aria-label={ar ? 'مرفق' : 'Receipt'} />}
        {extra}
      </div>
      {row.notes && <div className="line-clamp-2 whitespace-pre-wrap text-slate-500 dark:text-slate-400">{row.notes}</div>}
    </div>
  );

  useEffect(() => {
    const paths = projects.map((p) => p.logoUrl).filter((u): u is string => !!u && !isInlineReceipt(u) && !logoUrls[u]);
    if (!paths.length) return;
    resolveReceiptUrls(paths)
      .then(({ urls }) => setLogoUrls((prev) => ({ ...prev, ...urls })))
      .catch((e) => console.error('Project logos could not be signed', e));
  }, [projects]);

  const pendingLogo = form?.logoFile;
  const previewUrl = useMemo(() => (pendingLogo ? URL.createObjectURL(pendingLogo) : ''), [pendingLogo]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const logoSrc = (url?: string) => (!url ? '' : isInlineReceipt(url) ? url : logoUrls[url] || '');
  const logo = (p: Project, size: string, iconClass = 'text-emerald-500') => {
    const src = logoSrc(p.logoUrl);
    return src ? (
      <img src={src} alt="" className={`${size} rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-slate-800`} />
    ) : (
      <Briefcase className={`${size} p-0.5 shrink-0 ${iconClass}`} />
    );
  };

  // Keeps a failed save from looking like a successful one.
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      alert(ar ? 'تعذّر الحفظ. تحقق من الاتصال وحاول مجدداً.' : 'Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    void run(async () => {
      // A logo is shown small, so it is stored small: 384 px is sharp at 2x.
      const uploaded = form.logoFile && user ? await uploadReceipt(await fileToReceiptJpeg(form.logoFile, 384), user.id) : '';
      const logoUrl = uploaded || form.logoUrl;
      const previous = form.id ? byId(form.id)?.logoUrl : undefined;
      if (form.id)
        await updateProject(form.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          parentId: form.parentId || null,
          logoUrl: logoUrl || null,
        });
      else await addProject(form.name.trim(), form.description.trim(), form.parentId || undefined, logoUrl || undefined);
      // Best effort: a stale object costs storage, never correctness.
      if (previous && previous !== logoUrl && !isInlineReceipt(previous))
        void supabase.storage.from(RECEIPTS_BUCKET).remove([previous]);
      setForm(null);
    });
  };

  const timeline: TimelineEntry[] = useMemo(() => {
    if (!selected) return [];
    return [
      ...expenses.filter((e) => e.projectId && scope.has(e.projectId)).map((row) => ({ kind: 'expense' as const, date: row.date, row })),
      ...incomes.filter((i) => i.projectId && scope.has(i.projectId)).map((row) => ({ kind: 'income' as const, date: row.date, row })),
      ...projects
        .filter((p) => scope.has(p.id))
        .flatMap((p) => [
          ...p.notes.map((n) => ({ kind: 'note' as const, date: n.date, id: n.id, text: n.text, projectId: p.id })),
          ...p.entries.map((entry) => ({ kind: 'entry' as const, date: entry.date, entry, projectId: p.id })),
        ]),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [selected, scope, projects, expenses, incomes]);

  const byCategory = useMemo(() => {
    if (!selected) return [];
    const sums = new Map<string, number>();
    for (const e of expenses) {
      if (!e.projectId || !scope.has(e.projectId) || !isProjectCost(e)) continue;
      const name = categoryName(e) || (ar ? 'بدون تصنيف' : 'Uncategorised');
      sums.set(name, (sums.get(name) || 0) + convertAmount(e.amount, e.currency, currency, exchangeRate));
    }
    const projectOnly = ar ? 'خاص بالمشروع' : 'Project only';
    for (const p of projects) {
      if (!scope.has(p.id)) continue;
      for (const e of p.entries)
        if (e.kind === 'expense')
          sums.set(projectOnly, (sums.get(projectOnly) || 0) + convertAmount(e.amount, e.currency, currency, exchangeRate));
    }
    return [...sums.entries()].sort((a, b) => b[1] - a[1]);
  }, [selected, scope, projects, expenses, categories, currency, exchangeRate]);

  // Rows that can still be linked: real money, not yet in any project. An id
  // of a deleted project (a row restored from trash) counts as unlinked.
  const linkable = useMemo(() => {
    const projectIds = new Set(projects.map((p) => p.id));
    const free = (id?: string) => !id || !projectIds.has(id);
    const q = linkSearch.trim().toLowerCase();
    const rows: LedgerEntry[] = [
      ...expenses
        .filter((e) => free(e.projectId) && isProjectCost(e))
        .map((row) => ({ kind: 'expense' as const, date: row.date, row })),
      ...incomes.filter((i) => free(i.projectId) && isEarning(i)).map((row) => ({ kind: 'income' as const, date: row.date, row })),
    ];
    return rows
      .filter((r) => (!q || `${r.row.title} ${r.row.notes} ${r.row.amount} ${categoryName(r.row)} ${sourceName(r.row)}`.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);
  }, [projects, expenses, incomes, linkSearch, categories, wallets]);

  const linkPicked = () => {
    if (!selected) return;
    const ids = [...picked];
    const expenseIds = ids.filter((k) => k.startsWith('expense:')).map((k) => k.slice(8));
    const incomeIds = ids.filter((k) => k.startsWith('income:')).map((k) => k.slice(7));
    void run(async () => {
      await setTransactionsProject('expense', expenseIds, selected.id);
      await setTransactionsProject('income', incomeIds, selected.id);
      setPicked(new Set());
      setLinking(false);
      setLinkSearch('');
    });
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !noteText.trim()) return;
    const notes = [...selected.notes, { id: crypto.randomUUID(), date: noteDate, text: noteText.trim() }];
    void run(async () => {
      await updateProject(selected.id, { notes });
      setNoteText('');
    });
  };

  const saveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const owner = byId(entryForm?.projectId) || selected;
    const amount = Number(entryForm?.amount);
    if (!entryForm || !owner || !entryForm.title.trim() || !(amount > 0)) return;
    const { projectId: _, ...fields } = entryForm;
    const saved: ProjectEntry = {
      ...fields,
      id: entryForm.id || crypto.randomUUID(),
      amount,
      title: entryForm.title.trim(),
      notes: entryForm.notes.trim() || undefined,
    };
    const entries = entryForm.id ? owner.entries.map((x) => (x.id === saved.id ? saved : x)) : [...owner.entries, saved];
    void run(async () => {
      await updateProject(owner.id, { entries });
      setEntryForm(null);
    });
  };

  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{t.projects}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {ar ? 'تتبّع كل ما صرفته على استثماراتك ومشاريعك وما عاد منها' : 'Track what you put into each venture and what came back'}
        </p>
      </div>
      {selected ? (
        <button
          onClick={() => openProject(selected.parentId && byId(selected.parentId) ? selected.parentId : null)}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
        >
          {selected.parentId && byId(selected.parentId)
            ? (ar ? `→ العودة إلى ${byId(selected.parentId)!.name}` : `← Back to ${byId(selected.parentId)!.name}`)
            : ar ? '→ العودة للمشاريع' : '← Back to projects'}
        </button>
      ) : (
        !form && (
          <button
            onClick={() => setForm({ name: '', description: '', parentId: '', logoUrl: '' })}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/10 flex justify-center items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{ar ? 'مشروع جديد' : 'New project'}</span>
          </button>
        )
      )}
    </div>
  );

  const formCard = form && (
    <form onSubmit={submitForm} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-500" />
          {form.id ? (ar ? 'تعديل المشروع' : 'Edit project') : ar ? 'مشروع جديد' : 'New project'}
        </h3>
        <button type="button" onClick={() => setForm(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <input
        required
        maxLength={150}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder={ar ? 'اسم المشروع: بضاعة الصين، تطبيق...' : 'Project name: imported goods, app...'}
        className={`${inputClass} w-full`}
      />
      <textarea
        maxLength={5000}
        rows={2}
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        placeholder={ar ? 'وصف مختصر (اختياري)' : 'Short description (optional)'}
        className={`${inputClass} w-full`}
      />
      <div className="flex items-center gap-3">
        {form.logoFile ? (
          <img src={previewUrl} alt="" className="w-14 h-14 rounded-2xl object-cover" />
        ) : logoSrc(form.logoUrl) ? (
          <img src={logoSrc(form.logoUrl)} alt="" className="w-14 h-14 rounded-2xl object-cover" />
        ) : (
          <span className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-slate-400" />
          </span>
        )}
        <label className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5">
          <ImagePlus className="w-4 h-4" />
          {form.logoFile || form.logoUrl ? (ar ? 'تغيير الشعار' : 'Change logo') : ar ? 'إضافة شعار' : 'Add logo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && setForm({ ...form, logoFile: e.target.files[0] })}
          />
        </label>
        {(form.logoFile || form.logoUrl) && (
          <button type="button" onClick={() => setForm({ ...form, logoFile: undefined, logoUrl: '' })} className="text-xs font-bold text-rose-500 hover:underline cursor-pointer">
            {ar ? 'إزالة' : 'Remove'}
          </button>
        )}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{ar ? 'تحت مشروع' : 'Parent project'}</span>
        <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className={`${inputClass} w-full`}>
          <option value="">{ar ? 'لا شيء (مشروع مستقل)' : 'None (standalone)'}</option>
          {projects
            // A project can't sit under itself or under anything below it.
            .filter((p) => !form.id || !projectFamily(projects, form.id).has(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
      </label>
      <button disabled={busy} className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer">
        {ar ? 'حفظ' : 'Save'}
      </button>
    </form>
  );

  // Signed links for the open project's attachments: plain <a> links, so a tap
  // opens the file directly instead of after an async call a browser may block.
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const attachmentPaths = (selected?.attachments || []).map((a) => a.path).join('|');
  useEffect(() => {
    const paths = attachmentPaths ? attachmentPaths.split('|').filter((p) => !fileUrls[p]) : [];
    if (!paths.length) return;
    supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .createSignedUrls(paths, 3600)
      .then(({ data, error }) => {
        if (error) throw error;
        const urls: Record<string, string> = {};
        for (const item of data || []) if (item.signedUrl && item.path) urls[item.path] = item.signedUrl;
        setFileUrls((prev) => ({ ...prev, ...urls }));
      })
      .catch((e) => console.error('Project files could not be signed', e));
  }, [attachmentPaths]);

  const addAttachments = async (files: FileList | null) => {
    if (!selected || !user || !files?.length) return;
    const project = selected;
    setUploading(true);
    const added: Project['attachments'] = [];
    const refused: string[] = [];
    try {
      for (const file of Array.from(files)) {
        let checked;
        try {
          checked = validateProjectFile(file);
        } catch (e) {
          const reason = (e as Error).message;
          refused.push(
            `${file.name}: ${
              reason === 'too-large'
                ? ar ? 'أكبر من 10 ميغابايت' : 'over 10 MB'
                : reason === 'empty'
                  ? ar ? 'ملف فارغ' : 'empty file'
                  : ar ? 'نوع غير مدعوم' : 'unsupported type'
            }`,
          );
          continue;
        }
        const path = projectFilePath(user.id, checked.extension);
        const { error } = await supabase.storage
          .from(PROJECT_FILES_BUCKET)
          .upload(path, file, { contentType: checked.type, upsert: false });
        if (error) {
          refused.push(`${file.name}: ${ar ? 'فشل الرفع' : 'upload failed'}`);
          continue;
        }
        added.push({ id: crypto.randomUUID(), path, name: file.name.slice(0, 200), type: checked.type, size: file.size, date: today() });
      }
      if (added.length) {
        try {
          await updateProject(project.id, { attachments: [...project.attachments, ...added] });
        } catch {
          // The list didn't save, so the uploaded objects would be unreachable.
          void supabase.storage.from(PROJECT_FILES_BUCKET).remove(added.map((a) => a.path));
          refused.push(ar ? 'تعذّر حفظ قائمة المرفقات' : 'The attachment list could not be saved');
        }
      }
    } finally {
      setUploading(false);
    }
    if (refused.length) alert((ar ? 'لم تُرفع بعض الملفات:\n' : 'Some files were not added:\n') + refused.join('\n'));
  };

  const removeAttachment = (id: string) => {
    if (!selected) return;
    const project = selected;
    const file = project.attachments.find((a) => a.id === id);
    if (!file) return;
    setConfirm({
      title: ar ? 'حذف المرفق' : 'Delete attachment',
      message: ar ? `سيُحذف "${file.name}" نهائياً.` : `"${file.name}" will be deleted for good.`,
      onConfirm: () =>
        void run(async () => {
          await updateProject(project.id, { attachments: project.attachments.filter((a) => a.id !== id) });
          void supabase.storage.from(PROJECT_FILES_BUCKET).remove([file.path]);
        }),
    });
  };

  const confirmModal = (
    <ConfirmModal
      isOpen={!!confirm}
      onClose={() => setConfirm(null)}
      onConfirm={() => { confirm?.onConfirm(); setConfirm(null); }}
      title={confirm?.title || ''}
      message={confirm?.message || ''}
    />
  );

  // Spent / returned / net, always all three, for a sub-project row or card.
  const miniFigures = (ct: ReturnType<typeof totalsOf>) => (
    <span className="grid grid-cols-3 gap-2 text-[10px] leading-tight">
      {[
        { label: ar ? 'المصروف' : 'Spent', value: ct.spentTotal, color: 'text-rose-500' },
        { label: ar ? 'العائد' : 'Returned', value: ct.earnedTotal, color: 'text-emerald-500' },
        { label: ar ? 'الصافي' : 'Net', value: ct.net, color: ct.net < 0 ? 'text-rose-500' : 'text-emerald-500' },
      ].map((f) => (
        <span key={f.label} className="min-w-0">
          <span className="block text-slate-400 font-bold">{f.label}</span>
          <span className={`block font-black truncate ${f.color}`}>{fmt(f.value)}</span>
        </span>
      ))}
    </span>
  );

  // A parent's sub-projects, indented by depth, each with its own family total.
  // `seen` stops a parent loop (A under B under A) from recursing forever.
  const renderTree = (parentId: string, depth: number, seen = new Set<string>([parentId])): React.ReactNode =>
    childrenOf(parentId)
      .filter((c) => !seen.has(c.id))
      .map((c) => {
        const ct = totalsOf(c, combined);
        const next = new Set(seen).add(c.id);
        return (
          <React.Fragment key={c.id}>
            <button
              onClick={() => openProject(c.id)}
              style={{ paddingInlineStart: `${1.25 + depth * 1}rem` }}
              className={`w-full text-start pe-5 py-2 flex items-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${c.isArchived ? 'opacity-50' : ''}`}
            >
              <span className="w-3 h-3 border-s-2 border-b-2 border-slate-300 dark:border-slate-600 rounded-es-md shrink-0" />
              {c.logoUrl && logo(c, 'w-6 h-6')}
              <span className="flex-1 min-w-0 space-y-1">
                <span className="block truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                  {c.name}
                  {c.isArchived && <span className="font-normal text-slate-400">{ar ? ' · مؤرشف' : ' · archived'}</span>}
                </span>
                {miniFigures(ct)}
              </span>
            </button>
            {renderTree(c.id, depth + 1, next)}
          </React.Fragment>
        );
      });

  /**
   * The amount, and in a shared project the user's half plus the done toggle.
   * Not done: the user paid (or received) it all and the partner's half is open.
   */
  const amountCell = (isIn: boolean, amount: number, c: 'LYD' | 'USD', shared: boolean, settled: boolean, toggle: () => void) => (
    <span className="flex flex-col items-end gap-1 shrink-0">
      <span dir="ltr" className={`text-sm font-black tabular-nums ${isIn ? 'text-emerald-500' : 'text-rose-500'}`}>
        {isIn ? '+' : '-'}{fmt(amount, c)}
      </span>
      {shared && (
        <>
          <span className="text-[10px] font-bold text-indigo-500 tabular-nums">
            {ar ? 'حصتك ' : 'Yours '}<span dir="ltr">{fmt(amount / 2, c)}</span>
          </span>
          <button
            disabled={busy}
            onClick={toggle}
            title={
              settled
                ? ar ? 'تمت التسوية: دفع كل منكما حصته' : 'Done: each of you paid your half'
                : isIn
                  ? ar ? 'استلمت المبلغ كاملاً، حصة الشريك عندك' : 'You received it all; the partner’s half is with you'
                  : ar ? 'دفعت المبلغ كاملاً، الشريك مدين لك بحصته' : 'You paid it all; the partner owes you their half'
            }
            className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
              settled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}
          >
            {settled ? <CircleCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {settled ? (ar ? 'تمت' : 'Done') : ar ? 'معلّقة' : 'Pending'}
          </button>
        </>
      )}
    </span>
  );

  // ---------------------------------------------------------------- list view
  if (!selected) {
    // Top-level cards; each shows its whole tree of sub-projects inline.
    const visible = projects.filter((p) => p.isArchived === showArchived && !byId(p.parentId));
    return (
      <div className="space-y-6 animate-fade-in pb-16">
        {header}
        {formCard}
        <div className="flex gap-2">
          {[false, true].map((archived) => (
            <button
              key={String(archived)}
              onClick={() => setShowArchived(archived)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${showArchived === archived ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
            >
              {archived ? (ar ? 'المؤرشفة' : 'Archived') : ar ? 'النشطة' : 'Active'}
            </button>
          ))}
          {projects.some((p) => p.parentId) && (
            <label className="ms-auto flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" checked={combined} onChange={(e) => setCombined(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
              {ar ? 'اجمع أرقام المشاريع الفرعية' : 'Include sub-projects in the figures'}
            </label>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">
            {ar ? 'لا توجد مشاريع بعد. أنشئ مشروعاً ثم اربط به مصاريفه.' : 'No projects yet. Create one, then link its expenses.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {visible.map((p) => {
              const subs = familyOf(p).size - 1;
              const tot = totalsOf(p, combined);
              const ids = scopeOf(p, combined);
              const sh = shareOf(ids);
              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
                >
                  <button onClick={() => openProject(p.id)} className="w-full text-start p-5 space-y-3 cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      {logo(p, 'w-9 h-9')}
                      <span className="flex-1 min-w-0">
                        <span className="block font-extrabold text-slate-900 dark:text-white truncate">{p.name}</span>
                        {p.isShared && (
                          <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />{ar ? 'مشترك 50/50' : 'Shared 50/50'}
                          </span>
                        )}
                      </span>
                      <RoiPill value={roi(tot.earnedTotal, tot.spentTotal)} small />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{ar ? 'صافي المركز' : 'Net position'}</div>
                      <div dir="ltr" className={`text-2xl font-black tabular-nums tracking-tight ${ar ? 'text-end' : ''} ${tot.net < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                        {fmt(tot.net)}
                      </div>
                    </div>
                    <Sparkline data={inRange(seriesOf(ids), 'ALL')} />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-400 font-bold text-[10px]">{ar ? 'المصروف' : 'Spent'}</div>
                        <div dir="ltr" className={`font-black tabular-nums text-rose-500 ${ar ? 'text-end' : ''}`}>{fmt(tot.spentTotal)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold text-[10px]">{ar ? 'العائد' : 'Returned'}</div>
                        <div dir="ltr" className={`font-black tabular-nums text-emerald-500 ${ar ? 'text-end' : ''}`}>{fmt(tot.earnedTotal)}</div>
                      </div>
                    </div>
                    {sh.anyShared && (sh.owedToMeTotal > 0 || sh.iOweTotal > 0) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {sh.owedToMeTotal > 0 && <span>{ar ? 'الشريك مدين لك ' : 'Partner owes you '}<span dir="ltr">{fmt(sh.owedToMeTotal)}</span></span>}
                        {sh.iOweTotal > 0 && <span>{ar ? 'أنت مدين للشريك ' : 'You owe partner '}<span dir="ltr">{fmt(sh.iOweTotal)}</span></span>}
                      </div>
                    )}
                    {subs > 0 && (
                      <div className="text-[10px] text-slate-400">
                        {combined
                          ? ar ? `يشمل ${subs} مشروعاً فرعياً` : `Includes ${subs} sub-project${subs > 1 ? 's' : ''}`
                          : ar ? `أرقامه فقط · ${subs} مشروع فرعي` : `Own figures only · ${subs} sub-project${subs > 1 ? 's' : ''}`}
                      </div>
                    )}
                  </button>
                  {subs > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 py-1.5">
                      {renderTree(p.id, 0)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------- detail view
  const tot = totalsOf(selected, combined);
  const children = childrenOf(selected.id);
  const parent = byId(selected.parentId);
  const perCurrency = (m: Record<'LYD' | 'USD', number>) =>
    (['LYD', 'USD'] as const).filter((c) => m[c]).map((c) => fmt(m[c], c)).join(' + ');
  const share = shareOf(scope);
  const chart = inRange(seriesOf(scope), range);
  const rangeChange = chart.length ? (chart.at(-1)!.net - chart[0].net) : 0;
  // Top five, the rest folded into one slice so the donut stays readable.
  const slices = byCategory.length > 6
    ? [...byCategory.slice(0, 5), [ar ? 'أخرى' : 'Other', byCategory.slice(5).reduce((n, [, v]) => n + v, 0)] as [string, number]]
        .map(([name, value]) => ({ name, value }))
    : byCategory.map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {header}
      {formCard}
      {confirmModal}

      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              {logo(selected, 'w-10 h-10')}
              <span className="truncate">{selected.name}</span>
              {selected.isShared && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center gap-1 shrink-0">
                  <Users className="w-3 h-3" />50/50
                </span>
              )}
              {selected.isArchived && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">{ar ? 'مؤرشف' : 'Archived'}</span>
              )}
            </h3>
            {parent && (
              <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                <span>
                  {ar ? 'مشروع فرعي من ' : 'Sub-project of '}
                  <button onClick={() => openProject(parent.id)} className="font-bold text-indigo-500 hover:underline cursor-pointer">{parent.name}</button>
                </span>
                <button
                  disabled={busy}
                  onClick={() => void run(() => updateProject(selected.id, { parentId: null }))}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  {ar ? 'اجعله مستقلاً' : 'Make standalone'}
                </button>
              </p>
            )}
            {selected.description && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{selected.description}</p>}
          </div>
          <div className="flex gap-1">
            <button title={ar ? 'تعديل' : 'Edit'} onClick={() => setForm({ id: selected.id, name: selected.name, description: selected.description, parentId: selected.parentId || '', logoUrl: selected.logoUrl || '' })} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
              <Edit2 className="w-4 h-4" />
            </button>
            <button title={selected.isArchived ? (ar ? 'إلغاء الأرشفة' : 'Unarchive') : ar ? 'أرشفة' : 'Archive'} onClick={() => void run(() => updateProject(selected.id, { isArchived: !selected.isArchived }))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
              <Archive className="w-4 h-4" />
            </button>
            <button
              title={ar ? 'حذف' : 'Delete'}
              onClick={() =>
                setConfirm({
                  title: ar ? 'حذف المشروع' : 'Delete project',
                  message: ar
                    ? `سيُحذف "${selected.name}" وخطواته وعملياته الخاصة نهائياً. المصاريف والدخل المرتبطة به تبقى في سجلك ومحافظك كما هي، فقط تُفك من المشروع.${children.length ? ' مشاريعه الفرعية تصبح مستقلة ولا تُحذف.' : ''}`
                    : `"${selected.name}", its steps and project-only entries will be deleted for good. Its linked expenses and incomes stay in your ledger and wallets, only unlinked.${children.length ? ' Its sub-projects become standalone and are kept.' : ''}`,
                  onConfirm: () => void run(async () => { await deleteProject(selected.id); openProject(parent ? parent.id : null); }),
                })
              }
              className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Position, stock-quote style */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{ar ? 'صافي المركز' : 'Net position'}</div>
          <div className="flex flex-wrap items-center gap-3">
            <span dir="ltr" className={`text-4xl font-black tabular-nums tracking-tight ${tot.net < 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
              {fmt(tot.net)}
            </span>
            <RoiPill value={roi(tot.earnedTotal, tot.spentTotal)} />
          </div>
          {chart.length > 1 && range !== 'ALL' && (
            <div className={`text-xs font-bold tabular-nums ${rangeChange < 0 ? 'text-rose-500' : 'text-emerald-500'}`} dir="ltr">
              {rangeChange >= 0 ? '+' : ''}{fmt(rangeChange)} <span className="text-slate-400 font-normal">{ar ? 'خلال الفترة' : 'this period'}</span>
            </div>
          )}
          {share.anyShared && (
            <div className="text-xs font-bold text-indigo-500 tabular-nums">
              {ar ? 'حصتك: ' : 'Your share: '}<span dir="ltr">{fmt(share.myNet)}</span>
            </div>
          )}
        </div>

        {chart.length > 1 ? (
          <>
            <NetChart data={chart} showMine={share.anyShared} fmt={(n) => fmt(n)} ar={ar} />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70">
                {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-black cursor-pointer ${range === r ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    {r === 'ALL' ? (ar ? 'الكل' : 'All') : r}
                  </button>
                ))}
              </div>
              {share.anyShared && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <span className="w-4 border-t-2 border-dashed border-indigo-500" />
                  {ar ? 'حصتك' : 'Your share'}
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 text-center py-6">{ar ? 'يظهر الرسم بعد أول عملية.' : 'The chart appears after the first entry.'}</p>
        )}

        <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 cursor-pointer">
          <span className="flex items-center gap-2.5 min-w-0">
            <Users className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs font-extrabold text-slate-800 dark:text-white">{ar ? 'مشروع مشترك مع شريك' : 'Shared with a partner'}</span>
              <span className="block text-[10px] text-slate-500">
                {ar ? 'كل مصروف ودخل يُقسم 50/50 على هذا المشروع فقط.' : 'Every expense and income splits 50/50, on this project only.'}
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            disabled={busy}
            checked={selected.isShared}
            onChange={(e) => void run(() => updateProject(selected.id, { isShared: e.target.checked }))}
            className="w-5 h-5 accent-indigo-500 shrink-0"
          />
        </label>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: ar ? 'إجمالي المصروف' : 'Total spent', value: fmt(tot.spentTotal), detail: perCurrency(tot.spent), color: 'text-rose-500' },
          { label: ar ? 'إجمالي العائد' : 'Total returned', value: fmt(tot.earnedTotal), detail: perCurrency(tot.earned), color: 'text-emerald-500' },
          ...(share.anyShared
            ? [
                { label: ar ? 'حصتك من المصروف' : 'Your spent', value: fmt(share.mySpent), detail: '', color: 'text-slate-900 dark:text-white' },
                { label: ar ? 'حصتك من العائد' : 'Your returned', value: fmt(share.myEarned), detail: '', color: 'text-slate-900 dark:text-white' },
                {
                  label: ar ? 'الشريك مدين لك' : 'Partner owes you',
                  value: fmt(share.owedToMeTotal),
                  detail: perCurrency(share.owedToMe),
                  color: share.owedToMeTotal ? 'text-amber-500' : 'text-slate-400',
                },
                {
                  label: ar ? 'أنت مدين للشريك' : 'You owe partner',
                  value: fmt(share.iOweTotal),
                  detail: perCurrency(share.iOwe),
                  color: share.iOweTotal ? 'text-amber-500' : 'text-slate-400',
                },
                { label: ar ? 'حصة الشريك من المصروف' : 'Partner spent', value: fmt(share.partnerSpent), detail: '', color: 'text-slate-500' },
                { label: ar ? 'حصة الشريك من العائد' : 'Partner returned', value: fmt(share.partnerEarned), detail: '', color: 'text-slate-500' },
              ]
            : []),
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{card.label}</div>
            <div dir="ltr" className={`text-lg font-black tabular-nums truncate ${ar ? 'text-end' : ''} ${card.color}`}>{card.value}</div>
            {card.detail && card.detail !== card.value && <div dir="ltr" className={`text-[10px] text-slate-400 tabular-nums ${ar ? 'text-end' : ''}`}>{card.detail}</div>}
          </div>
        ))}
      </div>

      {byCategory.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
          <div className="text-sm font-extrabold text-slate-800 dark:text-white mb-3">{ar ? 'توزيع المصروف' : 'Allocation'}</div>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div dir="ltr" className="w-40 h-40 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                    {slices.map((sl, i) => <Cell key={sl.name} fill={SLICES[i % SLICES.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-slate-400">{ar ? 'المصروف' : 'Spent'}</span>
                <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">{fmt(tot.spentTotal)}</span>
              </div>
            </div>
            <div className="flex-1 w-full space-y-2">
              {slices.map((sl, i) => (
                <div key={sl.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SLICES[i % SLICES.length] }} />
                  <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{sl.name}</span>
                  <span className="text-slate-400 tabular-nums">{tot.spentTotal ? Math.round((sl.value / tot.spentTotal) * 100) : 0}%</span>
                  <span dir="ltr" className="w-28 text-end font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmt(sl.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {children.length > 0 && (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500">{ar ? 'المشاريع الفرعية' : 'Sub-projects'}</span>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input type="checkbox" checked={combined} onChange={(e) => setCombined(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                {ar ? 'اجمع أرقام المشاريع الفرعية' : 'Include sub-projects in the figures'}
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {children.map((c) => {
                const ct = totalsOf(c, combined);
                return (
                  <button
                    key={c.id}
                    onClick={() => openProject(c.id)}
                    className="text-start p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-300 cursor-pointer space-y-2"
                  >
                    <span className="flex items-center gap-2">
                      {logo(c, 'w-6 h-6', 'text-indigo-500')}
                      <span className="flex-1 truncate text-sm font-bold text-slate-800 dark:text-white">
                        {c.name}
                        {c.isArchived && <span className="text-[10px] text-slate-400 font-normal">{ar ? ' · مؤرشف' : ' · archived'}</span>}
                      </span>
                    </span>
                    {miniFigures(ct)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* Project-only money: counted here, never in a wallet or the ledger */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-500" />
            {entryForm?.id ? (ar ? 'تعديل عملية المشروع' : 'Edit project entry') : ar ? 'عملية خاصة بالمشروع' : 'Project-only entry'}
          </div>
          {!entryForm && (
            <div className="flex gap-2">
              {(['expense', 'income'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => setEntryForm({ kind, amount: '', currency, title: '', date: today(), notes: '' })}
                  className={`px-3 py-2 text-white font-bold text-xs rounded-xl cursor-pointer ${kind === 'income' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                >
                  {kind === 'income' ? (ar ? '+ دخل' : '+ Income') : ar ? '- مصروف' : '- Expense'}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          {ar
            ? 'تُحتسب في أرقام المشروع فقط، ولا تمسّ أي محفظة أو سجل العمليات.'
            : 'Counts in this project’s figures only. No wallet or transaction list is touched.'}
        </p>
        {entryForm && (
          <form ref={entryFormRef} onSubmit={saveEntry} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select value={entryForm.kind} onChange={(e) => setEntryForm({ ...entryForm, kind: e.target.value as ProjectEntry['kind'] })} className={inputClass}>
                <option value="expense">{ar ? 'مصروف' : 'Expense'}</option>
                <option value="income">{ar ? 'دخل' : 'Income'}</option>
              </select>
              <input
                required
                type="number"
                inputMode="decimal"
                min="0.01"
                step="any"
                value={entryForm.amount}
                onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                placeholder={ar ? 'المبلغ' : 'Amount'}
                className={`${inputClass} w-32`}
              />
              <select value={entryForm.currency} onChange={(e) => setEntryForm({ ...entryForm, currency: e.target.value as ProjectEntry['currency'] })} className={inputClass}>
                <option value="LYD">{t.lydSymbol}</option>
                <option value="USD">{t.usdSymbol}</option>
              </select>
              <input type="date" required value={entryForm.date} onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} className={inputClass} />
            </div>
            <input
              required
              maxLength={150}
              value={entryForm.title}
              onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
              placeholder={ar ? 'العنوان: شحن، دفعة من شريك...' : 'Title: shipping, partner payment...'}
              className={`${inputClass} w-full`}
            />
            <textarea
              maxLength={1000}
              rows={2}
              value={entryForm.notes}
              onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
              placeholder={ar ? 'ملاحظة (اختياري)' : 'Note (optional)'}
              className={`${inputClass} w-full`}
            />
            <div className="flex gap-2">
              <button disabled={busy} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                {ar ? 'حفظ' : 'Save'}
              </button>
              <button type="button" onClick={() => setEntryForm(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Add a step + link transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form onSubmit={addNote} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            {ar ? 'أضف خطوة' : 'Add a step'}
          </div>
          <div className="flex gap-2">
            <input type="date" required value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className={inputClass} />
            <input required maxLength={1000} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={ar ? 'وصلت البضاعة الميناء...' : 'Goods reached the port...'} className={`${inputClass} flex-1 min-w-0`} />
          </div>
          <button disabled={busy} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer">
            {ar ? 'إضافة' : 'Add'}
          </button>
        </form>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-500" />
            {ar ? 'اربط مصاريف أو دخل' : 'Link expenses or incomes'}
          </div>
          <p className="text-[11px] text-slate-500">
            {ar
              ? 'سجّل المصروف كالعادة من صفحة العمليات، ثم اربطه هنا. يبقى مخصوماً من محفظته، والمشروع يجمعه فقط.'
              : 'Record the expense as usual, then link it here. It stays deducted from its wallet; the project only groups it.'}
          </p>
          {!linking ? (
            <button onClick={() => setLinking(true)} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl cursor-pointer">
              {ar ? 'اختر المعاملات' : 'Choose transactions'}
            </button>
          ) : (
            <div className="space-y-2">
              <input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder={ar ? 'ابحث بالعنوان أو المبلغ...' : 'Search title or amount...'} className={`${inputClass} w-full`} />
              <div className="max-h-72 overflow-y-auto space-y-1">
                {linkable.map((r) => {
                  const key = `${r.kind}:${r.row.id}`;
                  return (
                    <label key={key} className="flex items-start gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={picked.has(key)}
                        onChange={() => setPicked((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; })}
                      />
                      {txDate(r.row.date)}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-slate-700 dark:text-slate-200">{r.row.title}</span>
                        {details(r.row)}
                      </span>
                      <span className={`font-bold whitespace-nowrap ${r.kind === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {r.kind === 'income' ? '+' : '-'}{fmt(r.row.amount, r.row.currency)}
                      </span>
                    </label>
                  );
                })}
                {linkable.length === 0 && <p className="text-xs text-slate-400 p-2">{ar ? 'لا توجد معاملات غير مرتبطة.' : 'No unlinked transactions.'}</p>}
              </div>
              <div className="flex gap-2">
                <button disabled={busy || picked.size === 0} onClick={linkPicked} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer">
                  {ar ? `ربط (${picked.size})` : `Link (${picked.size})`}
                </button>
                <button onClick={() => { setLinking(false); setPicked(new Set()); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer">
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attachments */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <AttachIcon className="w-4 h-4 text-sky-500" />
            {ar ? 'المرفقات' : 'Attachments'}
            {selected.attachments.length > 0 && <span className="text-xs text-slate-400">({selected.attachments.length})</span>}
          </div>
          <label className={`px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {uploading ? (ar ? 'جارٍ الرفع...' : 'Uploading...') : ar ? 'إضافة ملفات' : 'Add files'}
            <input
              type="file"
              multiple
              accept={PROJECT_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                void addAttachments(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">
          {ar ? 'فواتير، عقود، صور، PDF، Word، Excel — حتى 10 ميغابايت للملف.' : 'Invoices, contracts, photos, PDF, Word, Excel — up to 10 MB each.'}
        </p>
        {selected.attachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[...selected.attachments].sort((a, b) => b.date.localeCompare(a.date)).map((a) => {
              const url = fileUrls[a.path];
              const isImage = a.type.startsWith('image/');
              return (
                <div key={a.id} className="relative group rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <a href={url || undefined} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="h-24 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center">
                      {isImage && url ? (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" dir="auto" title={a.name}>{a.name}</div>
                      <div className="text-[10px] text-slate-400">{formatFileSize(a.size)} · {a.date}</div>
                    </div>
                  </a>
                  <button
                    title={ar ? 'حذف' : 'Delete'}
                    onClick={() => removeAttachment(a.id)}
                    className="absolute top-1.5 end-1.5 p-1 rounded-lg bg-white/90 dark:bg-slate-900/90 text-rose-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-2">
        <div className="text-sm font-extrabold text-slate-800 dark:text-white">{ar ? 'السجل من البداية' : 'History from the start'}</div>
        {timeline.length === 0 && <p className="text-xs text-slate-400 py-6 text-center">{ar ? 'لا شيء بعد.' : 'Nothing yet.'}</p>}
        {timeline.map((entry) => {
          if (entry.kind === 'note') {
            return (
              <div key={`note:${entry.id}`} className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20">
                <StickyNote className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-xs text-slate-400 w-20 shrink-0">{entry.date}</span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {entry.text}
                  {entry.projectId !== selected.id && <span className="block text-[10px] text-indigo-500">{byId(entry.projectId)?.name}</span>}
                </span>
                <button
                  title={ar ? 'حذف الخطوة' : 'Delete step'}
                  onClick={() => {
                    const owner = byId(entry.projectId);
                    if (owner) void run(() => updateProject(owner.id, { notes: owner.notes.filter((n) => n.id !== entry.id) }));
                  }}
                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          }
          if (entry.kind === 'entry') {
            const { entry: x } = entry;
            const isIn = x.kind === 'income';
            const owner = byId(entry.projectId);
            return (
              <div key={`entry:${x.id}`} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                {isIn ? <ArrowUpCircle className="w-4 h-4 shrink-0 text-emerald-500" /> : <ArrowDownCircle className="w-4 h-4 shrink-0 text-rose-500" />}
                {txDate(x.date)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 dark:text-slate-100 truncate">{x.title}</div>
                  <div className="text-[10px] text-slate-400 min-w-0">
                    <div className="truncate">
                      {ar ? 'خاص بالمشروع' : 'Project only'}
                      {entry.projectId !== selected.id && <span className="text-indigo-500"> · {owner?.name}</span>}
                    </div>
                    {x.notes && <div className="line-clamp-2 whitespace-pre-wrap text-slate-500 dark:text-slate-400">{x.notes}</div>}
                  </div>
                </div>
                {amountCell(isIn, x.amount, x.currency, !!owner?.isShared, !!x.settled, () => {
                  if (owner)
                    void run(() => updateProject(owner.id, { entries: owner.entries.map((y) => (y.id === x.id ? { ...y, settled: !y.settled } : y)) }));
                })}
                <button
                  title={ar ? 'تعديل' : 'Edit'}
                  onClick={() => setEntryForm({ ...x, amount: String(x.amount), notes: x.notes || '', projectId: entry.projectId })}
                  className="p-1 text-slate-400 hover:text-indigo-500 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  title={ar ? 'حذف' : 'Delete'}
                  onClick={() =>
                    setConfirm({
                      title: ar ? 'حذف العملية؟' : 'Delete entry?',
                      message: ar ? `سيُحذف "${x.title}" نهائياً من المشروع.` : `"${x.title}" will be removed from the project for good.`,
                      onConfirm: () => {
                        if (owner) void run(() => updateProject(owner.id, { entries: owner.entries.filter((y) => y.id !== x.id) }));
                      },
                    })
                  }
                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          }
          const isIncome = entry.kind === 'income';
          const counted = isIncome ? isEarning(entry.row as Income) : isProjectCost(entry.row as Expense);
          const Icon = isIncome ? ArrowUpCircle : ArrowDownCircle;
          return (
            <div key={`${entry.kind}:${entry.row.id}`} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <Icon className={`w-4 h-4 shrink-0 ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`} />
              {txDate(entry.row.date)}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-800 dark:text-slate-100 truncate">{entry.row.title}</div>
                {details(
                  entry.row,
                  <>
                    {entry.row.projectId !== selected.id && <span className="text-indigo-500"> · {byId(entry.row.projectId)?.name}</span>}
                    {!counted && (ar ? ' · لا يُحتسب' : ' · not counted')}
                  </>,
                )}
              </div>
              {amountCell(
                isIncome,
                entry.row.amount,
                entry.row.currency,
                counted && !!byId(entry.row.projectId)?.isShared,
                !!entry.row.projectSettled,
                () => void run(() => setTransactionsSettled(entry.kind, [entry.row.id], !entry.row.projectSettled)),
              )}
              <button
                title={ar ? 'فك الربط' : 'Unlink'}
                onClick={() => void run(() => setTransactionsProject(entry.kind, [entry.row.id], null))}
                className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
