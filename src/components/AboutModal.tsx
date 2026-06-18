/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { 
  X, 
  Github, 
  MessageCircle, 
  Send, 
  Phone, 
  User, 
  Code2, 
  Award, 
  Heart,
  Globe,
  Sparkles
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { language } = useApp();

  const isRTL = language === 'ar';

  const developerInfo = {
    name: isRTL ? 'م. عمر' : 'Eng. Omar',
    title: isRTL ? 'مطور ومصمم تطبيق عزيز المالي' : 'Creator & Developer of Aziz Finance',
    bio: isRTL 
      ? 'مهندس برمجيات متخصص في بناء حلول التكنولوجيا المالية وتطبيقات تجربة المستخدم الراقية. تم تطوير نظام "عزيز" ليكون الرفيق الأمثل لكل فرد يطمح لإدارة واعية لمدخراته ومصروفاته اليومية والجمعيات التشاركية بحلول ذكية وأنيقة.'
      : 'A software engineer specialized in building fintech solutions and premium user experiences. The "Aziz" system was developed to be the ultimate companion for anyone striving for intelligent management of their daily savings, expenses, and rotating jamiyas.',
    github: 'https://github.com/omarmail092',
    telegram: 'https://t.me/Omar25Muhammad',
    whatsapp: 'https://wa.me/218945953967',
    phone: '+218 94 595 3967',
    email: 'omarmail092@gmail.com',
    location: isRTL ? 'طرابلس، ليبيا' : 'Tripoli, Libya'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-2xl p-5 md:p-6 overflow-hidden z-10"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Top Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Glowing effect in background */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-teal-500/10 dark:bg-brand-teal/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center text-center space-y-4 pt-1">
              
              {/* Profile Avatar Frame */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-teal via-emerald-400 to-teal-500 p-0.5 flex items-center justify-center shadow-xl shadow-teal-500/10">
                  <div className="w-full h-full rounded-full bg-slate-50 dark:bg-slate-850 flex items-center justify-center text-brand-teal text-xl font-black">
                    {developerInfo.name.replace('م. ', '').replace('Eng. ', '').charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 bg-emerald-500 dark:bg-emerald-400 p-1.5 rounded-full border-2 border-white dark:border-slate-900 shadow-md">
                  <Code2 className="w-3 h-3 text-white" />
                </div>
              </div>

              {/* Developer Metadata */}
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-extrabold tracking-wide uppercase">
                  <Award className="w-3 h-3" />
                  {isRTL ? 'إصدار مستقر' : 'Stable Release v1.1'}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                  {developerInfo.name}
                </h3>
                <p className="text-[11px] font-bold text-slate-400">
                  {developerInfo.title}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {developerInfo.location}
                </p>
              </div>

              {/* Bio Statement */}
              <div className="p-3 bg-slate-50 dark:bg-slate-850/40 border border-slate-100/50 dark:border-slate-800/50 rounded-xl">
                <p className="text-[11px] text-slate-650 dark:text-slate-300 leading-relaxed font-medium">
                  {developerInfo.bio}
                </p>
              </div>

              {/* Divider */}
              <div className="w-full border-t border-slate-150 dark:border-slate-800/80 my-1" />

              {/* Social Contacts Action Area */}
              <div className="w-full space-y-2">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                  {isRTL ? 'قنوات تواصل المطور الرسمية' : 'OFFICIAL DEVELOPER CHANNELS'}
                </h4>
                
                <div className="grid grid-cols-3 gap-2">
                  
                  {/* GitHub URL */}
                  <a
                    href={developerInfo.github}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 px-2 py-2 bg-slate-900 text-white hover:bg-black rounded-xl transition-all font-black text-[10px] sm:text-xs shadow-xs cursor-pointer hover:scale-[1.02]"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>

                  {/* Telegram URL */}
                  <a
                    href={developerInfo.telegram}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 px-2 py-2 bg-[#0088cc] text-white hover:bg-[#0077b3] rounded-xl transition-all font-black text-[10px] sm:text-xs shadow-xs cursor-pointer hover:scale-[1.02]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Telegram</span>
                  </a>

                  {/* WhatsApp URL */}
                  <a
                    href={developerInfo.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 px-2 py-2 bg-[#25D366] text-white hover:bg-[#20ba59] rounded-xl transition-all font-black text-[10px] sm:text-xs shadow-xs cursor-pointer hover:scale-[1.02]"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>

                </div>
              </div>

              {/* Secondary Details Footer info */}
              <div className="w-full flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 font-mono gap-1.5 mt-1.5">
                <div className="flex items-center gap-1" dir="ltr">
                  <Phone className="w-3 h-3" />
                  <span>{developerInfo.phone}</span>
                </div>
                <div className="flex items-center gap-1" dir="ltr">
                  <Globe className="w-3 h-3" />
                  <span className="lowercase">{developerInfo.email}</span>
                </div>
              </div>

              {/* Heart and system slogan */}
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold justify-center pt-2">
                <span>{isRTL ? 'صُنع بكل' : 'Crafted with'}</span>
                <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                <span>{isRTL ? 'شغف لدعم الموازنة الشخصية' : 'for personal financial freedom'}</span>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
