/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account statement (كشف حساب): pick wallets and a period, then print — the
 * browser's or Android's "Save as PDF" makes the file. The statements render
 * into #statement-print, which index.css hides on screen and prints alone.
 * Printing from HTML rather than building a PDF in JavaScript is what keeps
 * Arabic shaped and right-to-left.
 */

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Check, EyeOff, FileText, Loader2, Printer, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildStatements, type Statement } from '../lib/statement';
import { printPage } from '../lib/printPage';

// Local date, like the transaction form stores — toISOString() alone is UTC,
// which in Libya (UTC+2) is still yesterday until 2 a.m.
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;

export const StatementModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { language, wallets, incomes, expenses, profile } = useApp();
  const ar = language === 'ar';
  const [selected, setSelected] = useState<string[]>(() => wallets.filter((w) => !w.isHidden).map((w) => w.id));
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [masked, setMasked] = useState(false);
  // Mounted on the first print and kept until the window closes: Android's print
  // service lays the page out after the call returns, so it must still be there.
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const statements = useMemo(
    () =>
      wallets
        .filter((w) => selected.includes(w.id))
        .flatMap((w) => buildStatements(w, incomes, expenses, from, to)),
    [wallets, incomes, expenses, selected, from, to],
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const side = (s: Statement) =>
    s.compartment === 'cash'
      ? s.wallet.isCard === false ? (ar ? 'محفظة نقدية' : 'Cash wallet') : (ar ? 'النقد' : 'Cash')
      : (ar ? 'البطاقة' : 'Card');

  const print = async () => {
    setError('');
    setBusy(true);
    setPrinting(true);
    try {
      // Let the statements reach the DOM before the print service reads it.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await printPage(`${ar ? 'كشف حساب' : 'Statement'} ${from || ''}${to ? ` - ${to}` : ''}`.trim());
    } catch (e) {
      console.error(e);
      setError(ar ? 'تعذّرت الطباعة على هذا الجهاز.' : 'Printing is not available on this device.');
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full glass-input px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal/50 dark:text-white';

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="statement-title">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-2xl z-10 space-y-5"
      >
        <button
          onClick={onClose}
          aria-label={ar ? 'إغلاق' : 'Close'}
          className="absolute top-4 end-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-xl cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <h3 id="statement-title" className="font-extrabold text-base text-slate-900 dark:text-white">
              {ar ? 'كشف حساب' : 'Account statement'}
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {ar ? 'اختر المحافظ والفترة، ثم احفظه PDF من نافذة الطباعة.' : 'Pick wallets and a period, then save as PDF from the print dialog.'}
            </p>
          </div>
        </div>

        {/* Wallets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{ar ? 'المحافظ' : 'Wallets'}</span>
            <button
              type="button"
              onClick={() => setSelected(selected.length === wallets.length ? [] : wallets.map((w) => w.id))}
              className="text-[11px] font-bold text-brand-teal cursor-pointer hover:underline"
            >
              {selected.length === wallets.length ? (ar ? 'إلغاء الكل' : 'Clear all') : (ar ? 'تحديد الكل' : 'Select all')}
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pe-1">
            {wallets.map((w) => {
              const on = selected.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(w.id)}
                  className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-start text-xs font-bold cursor-pointer transition-colors ${
                    on
                      ? 'border-brand-teal bg-brand-teal/5 dark:bg-brand-teal/10 text-slate-800 dark:text-white'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-brand-teal/40'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-brand-teal border-brand-teal text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                    {on && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                  <span className="min-w-0 break-words">{w.name}</span>
                  <span className="ms-auto text-[10px] text-slate-400 shrink-0">
                    {w.isCard === false ? (ar ? 'نقد' : 'Cash') : (ar ? 'بطاقة' : 'Card')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Period */}
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{ar ? 'من' : 'From'}</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={input} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{ar ? 'إلى' : 'To'}</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={input} />
          </label>
        </div>

        {/* Hidden details */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
          <input type="checkbox" checked={masked} onChange={(e) => setMasked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand-teal cursor-pointer" />
          <span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
              <EyeOff className="w-3.5 h-3.5" />
              {ar ? 'إخفاء التفاصيل' : 'Hide details'}
            </span>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {ar
                ? 'كما يراها المشاهدون: «معاملة 01…» بدل العناوين، و«تحويل» للتحويلات.'
                : 'As viewers see it: “Transaction 01…” instead of titles, “Transfer” for transfers.'}
            </span>
          </span>
        </label>

        {/* What will print */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
          {statements.length === 0 ? (
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {ar ? 'لا توجد حركات للمحافظ المختارة في هذه الفترة.' : 'Nothing to print for these wallets in this period.'}
            </p>
          ) : (
            statements.map((s) => (
              <div key={`${s.wallet.id}-${s.currency}-${s.compartment}`} className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span className="min-w-0 truncate">
                  {s.wallet.name} · {side(s)} · {s.currency}
                </span>
                <span className="shrink-0 text-slate-400">
                  {s.rows.length} {ar ? 'حركة' : 'rows'}
                </span>
              </div>
            ))
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl p-2.5">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={statements.length === 0 || busy}
          onClick={print}
          className="w-full py-3 bg-brand-teal hover:bg-brand-teal/90 disabled:opacity-40 disabled:cursor-not-allowed text-brand-slate font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
          {ar ? 'طباعة / حفظ PDF' : 'Print / Save as PDF'}
          {statements.length > 1 && ` (${statements.length})`}
        </button>
      </motion.div>

      {printing &&
        createPortal(
          <div id="statement-print" dir={ar ? 'rtl' : 'ltr'}>
            {statements.map((s) => {
              const width = Math.max(2, String(s.rows.filter((r) => !r.isTransfer).length).length);
              const title = (r: Statement['rows'][number]) =>
                !masked
                  ? r.title
                  : r.isTransfer
                    ? (ar ? 'تحويل' : 'Transfer')
                    : `${ar ? 'معاملة' : 'Transaction'} ${String(r.n).padStart(width, '0')}`;
              const cell = 'border-b border-slate-200 px-2 py-1.5 text-[11px]';
              const num = `${cell} text-end tabular-nums whitespace-nowrap`;
              return (
                <section key={`${s.wallet.id}-${s.currency}-${s.compartment}`} className="stmt">
                  <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3 mb-3">
                    <div>
                      <h1 className="text-lg font-black">{ar ? 'كشف حساب' : 'Account statement'}</h1>
                      <p className="text-sm font-extrabold mt-0.5">
                        {s.wallet.name} — {side(s)} — {s.currency}
                      </p>
                      {masked && (
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">{ar ? '(تفاصيل مخفية)' : '(details hidden)'}</p>
                      )}
                    </div>
                    <div className="text-[10px] text-end text-slate-600 leading-relaxed">
                      <p className="font-black text-xs text-slate-900">{ar ? 'عزيز' : 'Aziz'}</p>
                      {profile?.name && <p>{profile.name}</p>}
                      <p>
                        {ar ? 'من ' : 'From '}
                        <span dir="ltr">{from || (ar ? 'البداية' : 'the start')}</span>
                        {ar ? ' إلى ' : ' to '}
                        <span dir="ltr">{to || (ar ? 'اليوم' : 'today')}</span>
                      </p>
                      <p>
                        {ar ? 'تاريخ الإصدار: ' : 'Issued: '}
                        <span dir="ltr">{new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </p>
                    </div>
                  </header>

                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black text-slate-700">
                        <th className={`${cell} text-start`}>{ar ? 'التاريخ والوقت' : 'Date & time'}</th>
                        <th className={`${cell} text-start`}>{ar ? 'البيان' : 'Description'}</th>
                        <th className={`${cell} text-start`}>{ar ? 'النوع' : 'Type'}</th>
                        <th className={`${cell} text-end`}>{ar ? 'المبلغ' : 'Amount'}</th>
                        <th className={`${cell} text-end`}>{ar ? 'الرصيد' : 'Balance'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-bold bg-slate-50">
                        <td className={cell} dir="ltr">{from || '—'}</td>
                        <td className={cell} colSpan={3}>{ar ? 'الرصيد الافتتاحي' : 'Opening balance'}</td>
                        <td className={num} dir="ltr">{fmt(s.opening)}</td>
                      </tr>
                      {s.rows.map((r) => (
                        <tr key={r.id}>
                          <td className={`${cell} whitespace-nowrap`} dir="ltr">{r.date.replace('T', ' ')}</td>
                          <td className={cell} dir="auto">{title(r)}</td>
                          <td className={`${cell} whitespace-nowrap ${r.credit ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {r.credit ? (ar ? 'إيداع' : 'Earning') : (ar ? 'خصم' : 'Deduction')}
                          </td>
                          <td className={`${num} ${r.credit ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">
                            {r.credit ? '+' : '−'}{fmt(r.amount)}
                          </td>
                          <td className={num} dir="ltr">{fmt(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 ms-auto w-64 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>{ar ? 'إجمالي الإيداعات' : 'Total earnings'}</span>
                      <span className="tabular-nums text-emerald-700" dir="ltr">+{fmt(s.totalIn)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{ar ? 'إجمالي الخصومات' : 'Total deductions'}</span>
                      <span className="tabular-nums text-rose-700" dir="ltr">−{fmt(s.totalOut)}</span>
                    </div>
                    <div className="flex justify-between border-t-2 border-slate-800 pt-1 font-black text-sm">
                      <span>{ar ? 'الرصيد الختامي' : 'Closing balance'}</span>
                      <span className="tabular-nums" dir="ltr">{fmt(s.closing)} {s.currency}</span>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};
