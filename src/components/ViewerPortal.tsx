/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * What a viewer account sees: the wallets shared with it, read-only. Every
 * number and row comes from viewer_wallets() / viewer_wallet_transactions(),
 * which already applied the owner's share mode and hid what they marked — this
 * screen cannot reveal more than the database sent it.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Languages, Lock, LogOut, Moon, RefreshCw, Sun, Wallet } from 'lucide-react';
import { supabase } from '../supabase';
import { inCompartment, type Compartment } from '../lib/walletBalance';

interface BalanceRow {
  wallet_id: string;
  name: string;
  color: string;
  primary_currency: string;
  mode: 'balance' | 'all' | 'partial';
  owner_name: string;
  /** The wallet's opening balance, in primary_currency. Same on every row of a wallet. */
  initial_balance: number | null;
  currency: string;
  on_card: number;
  in_cash: number;
}

interface TxRow {
  id: string;
  type: 'income' | 'expense';
  date: string;
  amount: number;
  currency: string;
  expense_kind: 'wallet_spend' | 'cash_withdrawal' | 'cash_spend' | null;
  is_transfer: boolean;
  is_masked: boolean;
  title: string;
  category_name: string | null;
  notes: string | null;
}

const money = (n: number, currency: string, lang: string) =>
  new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(n));

// Stored names are "عربي / English"; show the half matching the language.
const categoryLabel = (name: string, lang: string) => {
  const [a, e] = name.split(' / ');
  return (lang === 'ar' ? a : e) || name;
};

// Null only if the database predates the column; show nothing rather than 0.
const OpeningBalance: React.FC<{ info: BalanceRow; lang: string }> = ({ info, lang }) =>
  info.initial_balance == null ? null : (
    <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
      {lang === 'ar' ? 'الرصيد الافتتاحي' : 'Opening balance'}{' '}
      <span className="font-bold text-slate-700 dark:text-slate-200">
        {money(info.initial_balance, info.primary_currency, lang)}
      </span>
    </p>
  );

export const ViewerPortal: React.FC = () => {
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    try {
      return localStorage.getItem('aziz_viewer_lang') === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [balances, setBalances] = useState<BalanceRow[] | null>(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [txs, setTxs] = useState<TxRow[] | null>(null);
  const [compartment, setCompartment] = useState<'all' | Compartment>('all');
  const ar = lang === 'ar';

  useEffect(() => {
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    try {
      localStorage.setItem('aziz_viewer_lang', lang);
    } catch {}
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('aziz_theme', dark ? 'dark' : 'light');
    } catch {}
  }, [dark]);

  const loadBalances = async () => {
    const { data, error: e } = await supabase.rpc('viewer_wallets');
    setError(!!e);
    if (!e) setBalances(data as BalanceRow[]);
  };

  const loadTxs = async (walletId: string) => {
    setTxs(null);
    const { data, error: e } = await supabase.rpc('viewer_wallet_transactions', { p_wallet_id: walletId });
    setError(!!e);
    setTxs(e ? [] : (data as TxRow[]));
  };

  const refresh = () => {
    void loadBalances();
    if (openId) void loadTxs(openId);
  };

  // No realtime channel for viewers: refetch whenever they come back to the tab.
  // ponytail: refetch-on-focus; add a broadcast topic per share if live updates matter.
  useEffect(() => {
    void loadBalances();
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [openId]);

  const wallets = useMemo(() => {
    const byId = new Map<string, { info: BalanceRow; buckets: BalanceRow[] }>();
    for (const b of balances ?? []) {
      const w = byId.get(b.wallet_id) ?? { info: b, buckets: [] };
      w.buckets.push(b);
      byId.set(b.wallet_id, w);
    }
    return [...byId.values()];
  }, [balances]);

  const open = wallets.find((w) => w.info.wallet_id === openId);
  const visibleTxs = (txs ?? []).filter(
    (t) => compartment === 'all' || inCompartment({ expenseKind: t.expense_kind ?? undefined }, t.type, compartment),
  );
  const hasCash = (txs ?? []).some((t) => t.expense_kind === 'cash_withdrawal' || t.expense_kind === 'cash_spend');

  const iconBtn =
    'p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-brand-teal';

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10 max-w-2xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-brand-slate dark:text-white">{ar ? 'عزيز' : 'Aziz'}</h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {ar ? 'محافظ مشاركة معك — للمشاهدة فقط' : 'Wallets shared with you — view only'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className={iconBtn} onClick={refresh} aria-label={ar ? 'تحديث' : 'Refresh'} title={ar ? 'تحديث' : 'Refresh'}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className={iconBtn} onClick={() => setLang(ar ? 'en' : 'ar')} aria-label={ar ? 'English' : 'العربية'} title={ar ? 'English' : 'العربية'}>
            <Languages className="w-4 h-4" />
          </button>
          <button className={iconBtn} onClick={() => setDark(!dark)} aria-label={ar ? 'تبديل المظهر' : 'Toggle theme'} title={ar ? 'تبديل المظهر' : 'Toggle theme'}>
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button className={iconBtn} onClick={() => void supabase.auth.signOut()} aria-label={ar ? 'تسجيل الخروج' : 'Sign out'} title={ar ? 'تسجيل الخروج' : 'Sign out'}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3">
          {ar ? 'تعذّر التحميل. تحقق من الاتصال ثم اضغط تحديث.' : 'Couldn’t load. Check your connection, then tap refresh.'}
        </p>
      )}

      {!open ? (
        balances === null ? (
          <div className="glass-card rounded-3xl h-32 animate-pulse" />
        ) : wallets.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center space-y-2">
            <Wallet className="w-8 h-8 mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {ar ? 'لا توجد محافظ مشاركة معك بعد.' : 'No wallets are shared with you yet.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ar ? 'عندما يشارك صاحب المحفظة واحدة، ستظهر هنا.' : 'When the owner shares one, it appears here.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {wallets.map(({ info, buckets }) => {
              const canOpen = info.mode !== 'balance';
              const body = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-800 dark:text-white truncate">{info.name}</p>
                      {info.owner_name && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {ar ? `من ${info.owner_name}` : `From ${info.owner_name}`}
                        </p>
                      )}
                    </div>
                    {canOpen && <ArrowRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0" />}
                  </div>
                  {buckets.map((b) => (
                    <div key={b.currency} className="mt-3">
                      <p className="text-2xl font-black text-brand-slate dark:text-white tabular-nums">
                        {money(Number(b.on_card) + Number(b.in_cash), b.currency, lang)}
                      </p>
                      {Number(b.in_cash) !== 0 && (
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                          {ar ? 'على البطاقة' : 'On card'} {money(b.on_card, b.currency, lang)}
                          {' · '}
                          <span className="text-amber-600 dark:text-amber-400">
                            {ar ? 'نقداً' : 'Cash'} {money(b.in_cash, b.currency, lang)}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                  <OpeningBalance info={info} lang={lang} />
                  {!canOpen && (
                    <p className="mt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {ar ? 'الرصيد فقط — المعاملات غير مشاركة.' : 'Balance only — transactions aren’t shared.'}
                    </p>
                  )}
                </>
              );
              return (
                <li key={info.wallet_id}>
                  {canOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(info.wallet_id);
                        setCompartment('all');
                        void loadTxs(info.wallet_id);
                      }}
                      className="w-full text-start glass-card rounded-3xl p-5 cursor-pointer hover:shadow-lg transition-shadow focus-visible:outline-2 focus-visible:outline-brand-teal"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="glass-card rounded-3xl p-5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <section className="space-y-4" aria-labelledby="wallet-title">
          <button
            type="button"
            onClick={() => {
              setOpenId(null);
              setTxs(null);
            }}
            className="text-xs font-black text-slate-500 dark:text-slate-400 hover:text-brand-teal cursor-pointer flex items-center gap-1"
          >
            <ArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />
            {ar ? 'كل المحافظ' : 'All wallets'}
          </button>
          <div>
            <h2 id="wallet-title" className="text-xl font-black text-brand-slate dark:text-white">
              {open.info.name}
            </h2>
            <OpeningBalance info={open.info} lang={lang} />
          </div>

          {hasCash && (
            <div className="grid grid-cols-3 p-1 bg-slate-100/60 dark:bg-slate-950/50 rounded-xl max-w-xs" role="group">
              {(['all', 'card', 'cash'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={compartment === c}
                  onClick={() => setCompartment(c)}
                  className={`py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                    compartment === c
                      ? 'bg-brand-slate text-white dark:bg-white dark:text-brand-slate'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {c === 'all' ? (ar ? 'الكل' : 'All') : c === 'card' ? (ar ? 'البطاقة' : 'Card') : ar ? 'النقد' : 'Cash'}
                </button>
              ))}
            </div>
          )}

          {txs === null ? (
            <div className="glass-card rounded-3xl h-48 animate-pulse" />
          ) : visibleTxs.length === 0 ? (
            <p className="glass-card rounded-3xl p-6 text-center text-sm font-bold text-slate-500 dark:text-slate-400">
              {ar ? 'لا توجد معاملات.' : 'No transactions.'}
            </p>
          ) : (
            <ul className="glass-card rounded-3xl divide-y divide-slate-100 dark:divide-slate-800">
              {visibleTxs.map((t) => {
                const inflow = t.type === 'income' || (compartment === 'cash' && t.expense_kind === 'cash_withdrawal');
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold truncate text-slate-800 dark:text-slate-100">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {t.date.slice(0, 10)}
                        {t.category_name && ` · ${categoryLabel(t.category_name, lang)}`}
                        {t.expense_kind === 'cash_withdrawal' && ` · ${ar ? 'سحب نقدي' : 'Cash withdrawal'}`}
                        {t.expense_kind === 'cash_spend' && ` · ${ar ? 'من النقد' : 'From cash'}`}
                      </p>
                      {t.notes && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.notes}</p>}
                    </div>
                    <span className={`text-sm font-black tabular-nums shrink-0 ${inflow ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                      {inflow ? '+' : '−'}
                      {money(t.amount, t.currency, lang)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
