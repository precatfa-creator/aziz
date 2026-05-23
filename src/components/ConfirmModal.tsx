import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X, Archive, HelpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'archive';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type = 'danger'
}) => {
  const { language } = useApp();

  if (!isOpen) return null;

  const defaultConfirmText = confirmText || (type === 'archive' 
    ? (language === 'ar' ? 'تأكيد الأرشفة' : 'Confirm Archive')
    : (language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'));
    
  const defaultCancelText = cancelText || (language === 'ar' ? 'إلغاء' : 'Cancel');

  let iconBg = 'bg-rose-500/10 text-rose-500 border border-rose-500/20';
  let confirmBtnBg = 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/15 cursor-pointer';
  let Icon = Trash2;

  if (type === 'warning') {
    iconBg = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    confirmBtnBg = 'bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-md shadow-amber-500/10 cursor-pointer';
    Icon = AlertTriangle;
  } else if (type === 'archive') {
    iconBg = 'bg-indigo-500/10 text-indigo-550 dark:text-indigo-400 border border-indigo-500/20';
    confirmBtnBg = 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/15 cursor-pointer';
    Icon = Archive;
  } else if (type === 'info') {
    iconBg = 'bg-brand-teal/10 text-brand-teal border border-brand-teal/20';
    confirmBtnBg = 'bg-brand-teal hover:bg-brand-teal/92 text-slate-905 dark:text-slate-900 shadow-md shadow-brand-teal/10 cursor-pointer';
    Icon = HelpCircle;
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
        {/* Backdrop wrapper overlay inside design */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md cursor-pointer"
        />

        {/* Modal visual panel container styling element card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          className="relative w-full max-w-sm overflow-hidden p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-[2rem] shadow-2xl z-10 flex flex-col items-center text-center gap-4"
        >
          {/* Close trigger anchor */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-300 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Glowing Badge icon component representation */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${iconBg} mb-1 shadow-sm`}>
            <Icon className="w-6 h-6" />
          </div>

          <div className="space-y-2 px-1">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
              {title}
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400 font-bold leading-relaxed">
              {message}
            </p>
          </div>

          {/* Two-Column responsive Action Buttons in RTL order */}
          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            <button
              onClick={onClose}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-black text-xs rounded-2xl cursor-pointer transition-colors"
            >
              {defaultCancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`py-3 px-4 font-black text-xs rounded-2xl active:scale-95 transition-all outline-hidden ${confirmBtnBg}`}
            >
              {defaultConfirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
