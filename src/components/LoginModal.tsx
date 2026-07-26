import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, Fingerprint, Mail, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PASSKEY_ENABLED } from '../lib/features';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { language, loginWithPassword, loginWithPasskey } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isRtl = language === 'ar';
  const text = isRtl
    ? {
        title: 'تسجيل الدخول',
        subtitle: 'الحسابات تُنشأ من قبل الإدارة فقط',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        submit: 'دخول',
        fingerprint: 'الدخول بالبصمة',
        or: 'أو',
      }
    : {
        title: 'Sign In',
        subtitle: 'Accounts are provisioned by an administrator',
        email: 'Email',
        password: 'Password',
        submit: 'Sign In',
        fingerprint: 'Sign in with fingerprint',
        or: 'or',
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithPassword(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithPasskey();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Passkey sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-sm overflow-hidden p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-[2rem] shadow-2xl z-10 flex flex-col items-center text-center gap-4"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mb-1 shadow-sm">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-1 px-1">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
              {text.title}
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400 font-bold leading-relaxed">
              {text.subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <div className="relative">
              <Mail className="absolute top-1/2 -translate-y-1/2 start-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={text.email}
                className="w-full ps-10 pe-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
            <div className="relative">
              <KeyRound className="absolute top-1/2 -translate-y-1/2 start-3.5 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={text.password}
                className="w-full ps-10 pe-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 outline-hidden focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {error && (
              <p className="text-[11px] text-rose-500 font-bold leading-relaxed">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-black text-sm rounded-2xl transition-all cursor-pointer"
            >
              {text.submit}
            </button>
          </form>

          {PASSKEY_ENABLED && (
            <>
              <div className="flex items-center gap-2 w-full text-[10px] text-slate-400 font-bold">
                <div className="flex-1 h-px bg-slate-150 dark:bg-slate-800" />
                <span>{text.or}</span>
                <div className="flex-1 h-px bg-slate-150 dark:bg-slate-800" />
              </div>

              <button
                onClick={handlePasskey}
                disabled={loading}
                className="w-full py-3 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-750 disabled:opacity-60 text-slate-700 dark:text-slate-200 font-black text-sm rounded-2xl transition-all cursor-pointer"
              >
                <Fingerprint className="w-4 h-4" />
                {text.fingerprint}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
