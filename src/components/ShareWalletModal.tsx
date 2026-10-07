/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Owner side of wallet sharing: create view-only accounts and choose, per
 * wallet, how much each one sees. What a viewer actually receives is decided
 * server-side (20261007120000_wallet_sharing.sql); this screen only writes the choice.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, KeyRound, Loader2, Share2, Trash2, UserPlus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authHeader, supabase } from '../supabase';
import { apiUrl } from '../lib/apiUrl';
import { ConfirmModal } from './ConfirmModal';
import type { Wallet } from '../types';

type Mode = 'none' | 'balance' | 'all' | 'partial';
interface Viewer {
  id: string;
  name: string;
  email: string;
}

const MODES: { id: Mode; ar: string; en: string }[] = [
  { id: 'none', ar: 'لا يرى المحفظة', en: 'No access' },
  { id: 'balance', ar: 'الرصيد فقط', en: 'Balance only' },
  { id: 'all', ar: 'كل المعاملات', en: 'All transactions' },
  { id: 'partial', ar: 'المعاملات مع إخفاء ما أحدده', en: 'Transactions, except ones I hide' },
];

const ERRORS: Record<string, { ar: string; en: string }> = {
  invalid_name: { ar: 'اكتب اسم المشاهد.', en: 'Enter the viewer’s name.' },
  invalid_email: { ar: 'البريد الإلكتروني غير صالح.', en: 'That email address isn’t valid.' },
  invalid_password: { ar: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.', en: 'The password needs at least 8 characters.' },
  email_taken: { ar: 'هذا البريد مستخدم لحساب آخر.', en: 'That email already belongs to an account.' },
};

export const ShareWalletModal: React.FC<{ wallet: Wallet; onClose: () => void }> = ({ wallet, onClose }) => {
  const { language, user } = useApp();
  const ar = language === 'ar';
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showForm, setShowForm] = useState(false);
  const [passwordFor, setPasswordFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState<Viewer | null>(null);

  const load = async () => {
    const [v, s] = await Promise.all([
      supabase.from('viewers').select('id, name, email').order('created_at'),
      supabase.from('wallet_shares').select('viewer_id, mode').eq('wallet_id', wallet.id),
    ]);
    if (v.error || s.error) {
      setError(ar ? 'تعذّر تحميل المشاهدين.' : 'Couldn’t load viewers.');
    } else {
      setViewers(v.data);
      setModes(Object.fromEntries(s.data.map((r) => [r.viewer_id, r.mode as Mode])));
      setShowForm(v.data.length === 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [wallet.id]);

  const callApi = async (method: string, body: Record<string, string>) => {
    // viewerId rides in the query too: native HTTP in the APK may drop a
    // DELETE request's body.
    const query = body.viewerId ? `?viewerId=${encodeURIComponent(body.viewerId)}` : '';
    const res = await fetch(apiUrl(`/api/viewers${query}`), {
      method,
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body),
    });
    if (res.ok) return;
    const code = (await res.json().catch(() => ({}))).error as string | undefined;
    const msg = code && ERRORS[code];
    throw new Error(msg ? (ar ? msg.ar : msg.en) : ar ? 'حدث خطأ، حاول مرة أخرى.' : 'Something went wrong. Try again.');
  };

  const setMode = async (viewerId: string, mode: Mode) => {
    if (!user) return;
    setBusy(viewerId);
    setError('');
    const { error: e } =
      mode === 'none'
        ? await supabase.from('wallet_shares').delete().eq('wallet_id', wallet.id).eq('viewer_id', viewerId)
        : await supabase
            .from('wallet_shares')
            .upsert({ wallet_id: wallet.id, viewer_id: viewerId, owner_id: user.id, mode });
    if (e) setError(ar ? 'لم يُحفظ التغيير.' : 'The change wasn’t saved.');
    else setModes((m) => ({ ...m, [viewerId]: mode }));
    setBusy('');
  };

  const addViewer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('new');
    setError('');
    try {
      await callApi('POST', form);
      setForm({ name: '', email: '', password: '' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy('');
  };

  const changePassword = async (viewerId: string) => {
    setBusy(viewerId);
    setError('');
    try {
      await callApi('PATCH', { viewerId, password: newPassword });
      setPasswordFor(null);
      setNewPassword('');
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy('');
  };

  const deleteViewer = async (viewer: Viewer) => {
    setBusy(viewer.id);
    setError('');
    try {
      await callApi('DELETE', { viewerId: viewer.id });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy('');
  };

  const input =
    'w-full glass-input px-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-teal/50 dark:text-white';

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="share-title">
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
            <Share2 className="w-5 h-5" />
          </span>
          <div>
            <h3 id="share-title" className="font-extrabold text-base text-slate-900 dark:text-white">
              {ar ? `مشاركة «${wallet.name}»` : `Share “${wallet.name}”`}
            </h3>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {ar ? 'المشاهد يرى فقط، ولا يستطيع التعديل.' : 'Viewers can look, never edit.'}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 rounded-xl p-2.5">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <ul className="space-y-3">
            {viewers.map((v) => (
              <li key={v.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">{v.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" dir="ltr">{v.email}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPasswordFor(passwordFor === v.id ? null : v.id)}
                      title={ar ? 'تغيير كلمة المرور' : 'Change password'}
                      aria-label={ar ? 'تغيير كلمة المرور' : 'Change password'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(v)}
                      title={ar ? 'حذف حساب المشاهد' : 'Delete viewer account'}
                      aria-label={ar ? 'حذف حساب المشاهد' : 'Delete viewer account'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <label className="block">
                  <span className="sr-only">{ar ? 'ماذا يرى' : 'What they see'}</span>
                  <select
                    value={modes[v.id] ?? 'none'}
                    disabled={busy === v.id}
                    onChange={(e) => void setMode(v.id, e.target.value as Mode)}
                    className={`${input} cursor-pointer`}
                  >
                    {MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {ar ? m.ar : m.en}
                      </option>
                    ))}
                  </select>
                </label>
                {modes[v.id] === 'partial' && (
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 shrink-0" />
                    {ar
                      ? 'من سجل المعاملات، اضغط أيقونة القفل لإخفاء معاملة. تظهر له «معاملة 1، 2…» بالمبلغ والتاريخ فقط.'
                      : 'In the ledger, tap the lock icon to hide a transaction. It shows as “معاملة 1, 2…” with amount and date only.'}
                  </p>
                )}

                {passwordFor === v.id && (
                  <div className="flex gap-2">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={ar ? 'كلمة مرور جديدة (8+ أحرف)' : 'New password (8+ characters)'}
                      className={input}
                    />
                    <button
                      type="button"
                      disabled={busy === v.id}
                      onClick={() => void changePassword(v.id)}
                      className="px-3 rounded-xl bg-brand-slate text-white dark:bg-white dark:text-brand-slate text-xs font-black cursor-pointer disabled:opacity-60"
                    >
                      {ar ? 'حفظ' : 'Save'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {showForm ? (
          <form onSubmit={addViewer} className="space-y-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/40 p-3">
            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
              {ar ? 'حساب مشاهد جديد' : 'New viewer account'}
            </p>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={ar ? 'الاسم' : 'Name'}
              className={input}
            />
            <input
              required
              type="email"
              dir="ltr"
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={ar ? 'البريد الإلكتروني' : 'Email'}
              className={input}
            />
            <input
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={ar ? 'كلمة المرور (8+ أحرف)' : 'Password (8+ characters)'}
              className={input}
            />
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              {ar
                ? 'أرسل البريد وكلمة المرور لصديقك؛ يدخل بهما من صفحة تسجيل الدخول في عزيز.'
                : 'Send your friend the email and password; they sign in on the Aziz login page.'}
            </p>
            <button
              type="submit"
              disabled={busy === 'new'}
              className="w-full py-2.5 rounded-xl bg-brand-slate text-white dark:bg-white dark:text-brand-slate text-xs font-black cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy === 'new' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {ar ? 'إنشاء الحساب' : 'Create account'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-black text-slate-600 dark:text-slate-300 hover:border-brand-teal hover:text-brand-teal cursor-pointer flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {ar ? 'إضافة مشاهد' : 'Add a viewer'}
          </button>
        )}
      </motion.div>

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void deleteViewer(deleting)}
        type="warning"
        title={ar ? `حذف حساب ${deleting?.name ?? ''}؟` : `Delete ${deleting?.name ?? ''}’s account?`}
        message={
          ar
            ? 'سيفقد الوصول إلى كل المحافظ التي شاركتها معه، ولا يمكن التراجع.'
            : 'They lose access to every wallet you shared with them. This can’t be undone.'
        }
        confirmText={ar ? 'حذف الحساب' : 'Delete account'}
      />
    </div>
  );
};
