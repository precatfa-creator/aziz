/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Archive,
  Briefcase,
  Link2,
  Unlink,
  StickyNote,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import type { Expense, Income, Project } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { isProjectCost, projectFamily, projectTotals } from '../lib/projectTotals';
import { convertAmount, isEarning } from '../lib/walletBalance';

const inputClass =
  'px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white';

const today = () => new Date().toISOString().slice(0, 10);

type TimelineEntry =
  | { kind: 'expense'; date: string; row: Expense }
  | { kind: 'income'; date: string; row: Income }
  | { kind: 'note'; date: string; id: string; text: string; projectId: string };

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
    addProject,
    updateProject,
    deleteProject,
    setTransactionsProject,
  } = useApp();
  const ar = language === 'ar';
  const sym = (c: 'LYD' | 'USD') => (c === 'LYD' ? t.lydSymbol : t.usdSymbol);
  const fmt = (n: number, c: 'LYD' | 'USD' = currency) =>
    `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${sym(c)}`;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<{ id?: string; name: string; description: string; parentId: string } | null>(null);
  // Roll sub-projects' figures and history into the parent's view.
  const [combined, setCombined] = useState(false);
  const [noteDate, setNoteDate] = useState(today());
  const [noteText, setNoteText] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const selected = projects.find((p) => p.id === selectedId) || null;
  const byId = (id?: string) => projects.find((p) => p.id === id);
  const childrenOf = (id: string) => projects.filter((p) => p.parentId === id);
  const familyOf = (p: Project) => projectFamily(projects, p.id);
  const totalsOf = (p: Project, withChildren = false) =>
    projectTotals(withChildren ? familyOf(p) : new Set([p.id]), incomes, expenses, currency, exchangeRate);
  // What the detail view covers: the project alone, or with everything under it.
  const scope = useMemo(
    () => (selected ? (combined ? projectFamily(projects, selected.id) : new Set([selected.id])) : new Set<string>()),
    [selected, combined, projects],
  );
  const openProject = (id: string | null) => {
    setSelectedId(id);
    setCombined(false);
    setLinking(false);
  };
  const categoryName = (row: Income | Expense) =>
    categories.find((c) => c.id === row.categoryId)?.name || row.categoryName || '';

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
      if (form.id)
        await updateProject(form.id, { name: form.name.trim(), description: form.description.trim(), parentId: form.parentId || null });
      else await addProject(form.name.trim(), form.description.trim(), form.parentId || undefined);
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
        .flatMap((p) => p.notes.map((n) => ({ kind: 'note' as const, date: n.date, id: n.id, text: n.text, projectId: p.id }))),
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
    return [...sums.entries()].sort((a, b) => b[1] - a[1]);
  }, [selected, scope, expenses, categories, currency, exchangeRate]);

  // Rows that can still be linked: real money, not yet in any project. An id
  // of a deleted project (a row restored from trash) counts as unlinked.
  const linkable = useMemo(() => {
    const projectIds = new Set(projects.map((p) => p.id));
    const free = (id?: string) => !id || !projectIds.has(id);
    const q = linkSearch.trim().toLowerCase();
    const rows: TimelineEntry[] = [
      ...expenses
        .filter((e) => free(e.projectId) && isProjectCost(e))
        .map((row) => ({ kind: 'expense' as const, date: row.date, row })),
      ...incomes.filter((i) => free(i.projectId) && isEarning(i)).map((row) => ({ kind: 'income' as const, date: row.date, row })),
    ];
    return rows
      .filter((r) => r.kind !== 'note' && (!q || `${r.row.title} ${r.row.notes} ${r.row.amount}`.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);
  }, [projects, expenses, incomes, linkSearch]);

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
            onClick={() => setForm({ name: '', description: '', parentId: '' })}
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
        const ct = totalsOf(c, true);
        const next = new Set(seen).add(c.id);
        return (
          <React.Fragment key={c.id}>
            <button
              onClick={() => openProject(c.id)}
              style={{ paddingInlineStart: `${1.25 + depth * 1}rem` }}
              className={`w-full text-start pe-5 py-2 flex items-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${c.isArchived ? 'opacity-50' : ''}`}
            >
              <span className="w-3 h-3 border-s-2 border-b-2 border-slate-300 dark:border-slate-600 rounded-es-md shrink-0" />
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
        </div>
        {visible.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-12">
            {ar ? 'لا توجد مشاريع بعد. أنشئ مشروعاً ثم اربط به مصاريفه.' : 'No projects yet. Create one, then link its expenses.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {visible.map((p) => {
              const subs = familyOf(p).size - 1;
              // Every figure on the list is that project plus everything under it.
              const tot = totalsOf(p, true);
              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
                >
                  <button onClick={() => openProject(p.id)} className="w-full text-start p-5 space-y-3 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-emerald-500 shrink-0" />
                      <span className="font-extrabold text-slate-900 dark:text-white truncate">{p.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-slate-400 font-bold">{ar ? 'المصروف' : 'Spent'}</div>
                        <div className="font-black text-rose-500">{fmt(tot.spentTotal)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold">{ar ? 'العائد' : 'Returned'}</div>
                        <div className="font-black text-emerald-500">{fmt(tot.earnedTotal)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 font-bold">{ar ? 'الصافي' : 'Net'}</div>
                        <div className={`font-black ${tot.net < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmt(tot.net)}</div>
                      </div>
                    </div>
                    {subs > 0 && (
                      <div className="text-[10px] text-slate-400">
                        {ar ? `يشمل ${subs} مشروعاً فرعياً` : `Includes ${subs} sub-project${subs > 1 ? 's' : ''}`}
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

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {header}
      {formCard}
      {confirmModal}

      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-emerald-500" />
              {selected.name}
              {selected.isArchived && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{ar ? 'مؤرشف' : 'Archived'}</span>
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
            <button title={ar ? 'تعديل' : 'Edit'} onClick={() => setForm({ id: selected.id, name: selected.name, description: selected.description, parentId: selected.parentId || '' })} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
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
                    ? `سيُحذف "${selected.name}" وخطواته نهائياً. المصاريف والدخل المرتبطة به تبقى في سجلك ومحافظك كما هي، فقط تُفك من المشروع.${children.length ? ' مشاريعه الفرعية تصبح مستقلة ولا تُحذف.' : ''}`
                    : `"${selected.name}" and its steps will be deleted for good. Its linked expenses and incomes stay in your ledger and wallets, only unlinked.${children.length ? ' Its sub-projects become standalone and are kept.' : ''}`,
                  onConfirm: () => void run(async () => { await deleteProject(selected.id); openProject(parent ? parent.id : null); }),
                })
              }
              className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {children.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500">{ar ? 'المشاريع الفرعية' : 'Sub-projects'}</span>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input type="checkbox" checked={combined} onChange={(e) => setCombined(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                {ar ? 'اجمع أرقام المشاريع الفرعية' : 'Include sub-projects in the figures'}
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {children.map((c) => {
                const ct = totalsOf(c, true);
                return (
                  <button
                    key={c.id}
                    onClick={() => openProject(c.id)}
                    className="text-start p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-300 cursor-pointer space-y-2"
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-500 shrink-0" />
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: ar ? 'إجمالي ما صرفته' : 'Total spent', value: tot.spentTotal, detail: perCurrency(tot.spent), color: 'text-rose-500' },
            { label: ar ? 'إجمالي العائد' : 'Total returned', value: tot.earnedTotal, detail: perCurrency(tot.earned), color: 'text-emerald-500' },
            { label: tot.net < 0 ? (ar ? 'الصافي (لم يُسترد بعد)' : 'Net (not yet recovered)') : ar ? 'صافي الربح' : 'Net profit', value: tot.net, detail: '', color: tot.net < 0 ? 'text-rose-500' : 'text-emerald-500' },
          ].map((card) => (
            <div key={card.label} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[11px] font-bold text-slate-400">{card.label}</div>
              <div className={`text-xl font-black ${card.color}`}>{fmt(card.value)}</div>
              {card.detail && card.detail !== fmt(card.value) && <div className="text-[10px] text-slate-400 mt-0.5">{card.detail}</div>}
            </div>
          ))}
        </div>

        {byCategory.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-slate-500">{ar ? 'أين ذهبت الفلوس' : 'Where the money went'}</div>
            {byCategory.map(([name, value]) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate text-slate-600 dark:text-slate-300">{name}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-rose-400" style={{ width: `${tot.spentTotal ? (value / tot.spentTotal) * 100 : 0}%` }} />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(value)}</span>
              </div>
            ))}
          </div>
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
                  if (r.kind === 'note') return null;
                  const key = `${r.kind}:${r.row.id}`;
                  return (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={picked.has(key)}
                        onChange={() => setPicked((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; })}
                      />
                      <span className="text-slate-400 w-20 shrink-0">{r.date.slice(0, 10)}</span>
                      <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{r.row.title}</span>
                      <span className={`font-bold ${r.kind === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
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
          const isIncome = entry.kind === 'income';
          const counted = isIncome ? isEarning(entry.row as Income) : isProjectCost(entry.row as Expense);
          const Icon = isIncome ? ArrowUpCircle : ArrowDownCircle;
          return (
            <div key={`${entry.kind}:${entry.row.id}`} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <Icon className={`w-4 h-4 shrink-0 ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`} />
              <span className="text-xs text-slate-400 w-20 shrink-0">{entry.date.slice(0, 10)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-800 dark:text-slate-100 truncate">{entry.row.title}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {categoryName(entry.row)}
                  {entry.row.projectId !== selected.id && <span className="text-indigo-500"> · {byId(entry.row.projectId)?.name}</span>}
                  {!counted && (ar ? ' · لا يُحتسب' : ' · not counted')}
                </div>
              </div>
              <span className={`text-sm font-black ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                {isIncome ? '+' : '-'}{fmt(entry.row.amount, entry.row.currency)}
              </span>
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
