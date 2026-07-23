/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Users, 
  DollarSign, 
  Calendar, 
  ArrowRightLeft, 
  AlertTriangle, 
  CheckCircle, 
  X, 
  ShieldAlert, 
  Sparkles,
  Archive,
  Phone,
  FileSpreadsheet
} from 'lucide-react';
import { SavingsGroupMember } from '../types';
import { ConfirmModal } from './ConfirmModal';

export const SavingsGroups: React.FC = () => {
  const { 
    t, 
    language, 
    savingsGroups, 
    addSavingsGroup, 
    updateSavingsGroup, 
    archiveSavingsGroup,
    deleteSavingsGroup,
    toggleMemberPaidCycle,
    toggleMemberReceivedState
  } = useApp();

  // Selected Group details view toggle
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

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

  // Form toggles
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any | null>(null);

  // Group Form Fields
  const [groupName, setGroupName] = useState('');
  const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
  const [totalAmount, setTotalAmount] = useState('');
  const [numMembers, setNumMembers] = useState('5');
  const [paymentCycle, setPaymentCycle] = useState<'monthly' | 'weekly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Members lists within form
  const [membersInput, setMembersInput] = useState<{ id: string; name: string; phone: string; notes: string }[]>([
    { id: 'm1', name: '', phone: '', notes: '' },
    { id: 'm2', name: '', phone: '', notes: '' },
    { id: 'm3', name: '', phone: '', notes: '' },
    { id: 'm4', name: '', phone: '', notes: '' },
    { id: 'm5', name: '', phone: '', notes: '' }
  ]);
  const [receivingOrder, setReceivingOrder] = useState<string[]>(['m1', 'm2', 'm3', 'm4', 'm5']);

  const handleNumMembersChange = (numStr: string) => {
    setNumMembers(numStr);
    const n = parseInt(numStr) || 5;
    if (n < 2 || n > 20) return;

    // Adjust members input list
    let list = [...membersInput];
    if (list.length < n) {
      while (list.length < n) {
        const newId = `m_${Math.random().toString(36).substring(2, 7)}`;
        list.push({ id: newId, name: '', phone: '', notes: '' });
      }
    } else if (list.length > n) {
      list = list.slice(0, n);
    }
    setMembersInput(list);
    setReceivingOrder(list.map(m => m.id));
  };

  const updateMemberInput = (index: number, field: string, val: string) => {
    const list = [...membersInput];
    list[index] = { ...list[index], [field]: val };
    setMembersInput(list);
  };

  // Assign Order Index change helper
  const handleOrderChange = (memberId: string, orderIndex: number) => {
    // Swap sequence values
    const nextOrder = [...receivingOrder];
    const currentIndex = nextOrder.indexOf(memberId);
    if (currentIndex === -1 || orderIndex < 0 || orderIndex >= nextOrder.length) return;

    // Swap values
    const temp = nextOrder[orderIndex];
    nextOrder[orderIndex] = memberId;
    nextOrder[currentIndex] = temp;
    setReceivingOrder(nextOrder);
  };

  // Group submission
  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !totalAmount) return;
    const total = parseFloat(totalAmount);
    const count = parseInt(numMembers);
    if (isNaN(total) || isNaN(count) || count < 2) return;

    // Double check that all member names are filled
    const cleanMembers = membersInput.map((m, idx) => ({
      id: m.id || `m_${idx}`,
      name: m.name.trim() || `${language === 'ar' ? 'مشارك' : 'Member'} ${idx + 1}`,
      phone: m.phone.trim(),
      notes: m.notes.trim()
    }));

    try {
      if (editingGroup) {
        // Map back current payment states to preserve historical records if editing is triggered
        const updatedMembersNested: SavingsGroupMember[] = cleanMembers.map((m) => {
          const original = editingGroup.members.find((org: any) => org.id === m.id || org.name === m.name);
          const recIdx = receivingOrder.indexOf(m.id);
          return {
            id: m.id,
            name: m.name,
            phone: m.phone,
            notes: m.notes,
            isReceived: original ? original.isReceived : false,
            receiveCycleIndex: recIdx,
            paidCycles: original ? original.paidCycles || [] : []
          };
        });

        await updateSavingsGroup(
          editingGroup.id,
          groupName,
          currency,
          total,
          count,
          paymentCycle,
          startDate,
          updatedMembersNested,
          receivingOrder,
          editingGroup.isArchived
        );
      } else {
        await addSavingsGroup(
          groupName,
          currency,
          total,
          count,
          paymentCycle,
          startDate,
          cleanMembers,
          receivingOrder
        );
      }
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditGroupClick = (group: any) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setCurrency(group.currency);
    setTotalAmount(group.totalAmount.toString());
    setNumMembers(group.numMembers.toString());
    setPaymentCycle(group.paymentCycle);
    setStartDate(group.startDate);
    
    setMembersInput(group.members.map((m: any) => ({
      id: m.id,
      name: m.name,
      phone: m.phone || '',
      notes: m.notes || ''
    })));
    setReceivingOrder(group.receivingOrder || group.members.map((m: any) => m.id));
    setShowAddForm(true);
  };

  const resetForm = () => {
    setEditingGroup(null);
    setGroupName('');
    setCurrency('LYD');
    setTotalAmount('');
    setNumMembers('5');
    setPaymentCycle('monthly');
    setStartDate(new Date().toISOString().split('T')[0]);
    setMembersInput([
      { id: 'm1', name: '', phone: '', notes: '' },
      { id: 'm2', name: '', phone: '', notes: '' },
      { id: 'm3', name: '', phone: '', notes: '' },
      { id: 'm4', name: '', phone: '', notes: '' },
      { id: 'm5', name: '', phone: '', notes: '' }
    ]);
    setReceivingOrder(['m1', 'm2', 'm3', 'm4', 'm5']);
    setShowAddForm(false);
  };

  // Matrix calculation utilities
  const currentOpenGroup = savingsGroups.find(g => g.id === selectedGroupId);

  const getLateDues = (group: any) => {
    // Count how many cycles have occurred conceptually (say, 1st cycle, 2nd cycle etc).
    // Let's assume we are currently in Cycle Round (Index) = 0 for simplicity, or look for unpaid entries up to 1st cycle.
    // For rotating groups, can highlight any member who hasn't paid for round index 0 yet.
    const lateList: { memberName: string; cycleIndex: number }[] = [];
    group.members.forEach((m: any) => {
      // In rotating savings group, every member is expected to pay in all rounds index (0 to numMembers-1)
      // Highlight any round they missed prior or equal to the current leading unpaid cycle
      // Let's assume current round cycle is equal to whoever is next in line to receive but hasn't had ALL payments yet.
      const totalRounds = group.numMembers;
      for (let c = 0; c < totalRounds; c++) {
        const isPaid = (m.paidCycles || []).includes(c);
        if (!isPaid) {
          // Check if this round's payout has already been collected (means round is past/late)
          const roundReceiverId = group.receivingOrder[c];
          const receiverInfo = group.members.find((rm: any) => rm.id === roundReceiverId);
          if (receiverInfo && receiverInfo.isReceived) {
            lateList.push({ memberName: m.name, cycleIndex: c });
          }
        }
      }
    });
    return lateList;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {t.jamiyaTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {language === 'ar' ? 'الجمعيات التشاركية الدوارة - الجمع شلم العائلة والأصدقاء' : 'Manage cyclic rotating savings pools dynamically'}
          </p>
        </div>

        {!showAddForm && !selectedGroupId && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/10 flex justify-center items-center gap-2 cursor-pointer transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addJamiya}</span>
          </button>
        )}

        {selectedGroupId && (
          <button
            onClick={() => setSelectedGroupId(null)}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
          >
            {language === 'ar' ? '← العودة للجمعيات' : '← Back to Jamiyas'}
          </button>
        )}
      </div>

      {/* 2. Create/Edit Savings Group Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl space-y-6 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              {editingGroup ? t.editJamiya : t.addJamiya}
            </h3>
            <button
              onClick={resetForm}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleGroupSubmit} className="space-y-6">
            {/* Core parameters fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {t.jamiyaName}
                </label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder={language === 'ar' ? 'جمعية الموظفين، تشاركية العيلة...' : 'Office Monthly Jamiya...'}
                  className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {t.totalAmount}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={totalAmount}
                  onChange={e => setTotalAmount(e.target.value)}
                  placeholder="5000"
                  className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {t.currency}
                </label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as any)}
                  className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
                >
                  <option value="LYD">LYD (د.ل)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-550 dark:text-slate-400">
                  {t.numMembers} ({language === 'ar' ? '2 إلى 20 مشترك' : '2 to 20 members'})
                </label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  required
                  value={numMembers}
                  onChange={e => handleNumMembersChange(e.target.value)}
                  className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-550 dark:text-slate-400">
                  {t.cycle}
                </label>
                <select
                  value={paymentCycle}
                  onChange={e => setPaymentCycle(e.target.value as any)}
                  className="px-3 py-2.5 text-sm bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/50 outline-hidden dark:text-white transition-all appearance-none cursor-pointer"
                >
                  <option value="monthly">{t.monthly}</option>
                  <option value="weekly">{t.weekly}</option>
                  <option value="custom">{t.customCycle}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-550 dark:text-slate-400">
                  {language === 'ar' ? 'تاريخ البدء والتعاقد' : 'Agreement Start Date'}
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/80 rounded-xl focus:border-emerald-500 outline-hidden dark:text-white"
                />
              </div>

              {totalAmount && numMembers && (
                <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex flex-col justify-center items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-bold block">
                    {t.paymentPerMember}
                  </span>
                  <span className="text-base font-black text-emerald-500">
                    {(parseFloat(totalAmount) / (parseInt(numMembers) || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                  </span>
                </div>
              )}
            </div>

            {/* Members Registry and receive scheduler section */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                {t.membersList} & {t.receivingOrder}
              </h4>

              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {membersInput.map((member, index) => {
                  const sequenceLabel = language === 'ar' ? `الدور رقم ${index + 1}` : `Round #${index + 1}`;
                  return (
                    <div key={member.id} className="p-4 bg-slate-50 dark:bg-slate-850/30 rounded-2xl border border-slate-150/50 dark:border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      
                      {/* Seq Tag */}
                      <div className="md:col-span-2 text-xs font-black text-slate-509 flex items-center gap-2">
                        <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px]">
                          {index + 1}
                        </span>
                        <span className="text-slate-400 dark:text-slate-550">{sequenceLabel}</span>
                      </div>

                      {/* Name input */}
                      <input
                        type="text"
                        value={member.name}
                        onChange={e => updateMemberInput(index, 'name', e.target.value)}
                        placeholder={`${language === 'ar' ? 'العضو' : 'Member'} ${index + 1}`}
                        className="md:col-span-4 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl"
                      />

                      {/* Phone Input */}
                      <input
                        type="text"
                        value={member.phone}
                        onChange={e => updateMemberInput(index, 'phone', e.target.value)}
                        placeholder="091XXXXXXX"
                        className="md:col-span-3 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl"
                      />

                      {/* Notes Input */}
                      <input
                        type="text"
                        value={member.notes}
                        onChange={e => updateMemberInput(index, 'notes', e.target.value)}
                        placeholder={t.memberNotes}
                        className="md:col-span-3 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl"
                      />

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                {t.save}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Grid of active savings groups */}
      {!showAddForm && !selectedGroupId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {savingsGroups.length > 0 ? (
            savingsGroups.map((group) => {
              const activeCount = group.members.filter(m => m.isReceived).length;
              const progressPercentage = (activeCount / group.numMembers) * 100;
              const lateList = getLateDues(group);

              return (
                <div 
                  key={group.id} 
                  className={`flex flex-col justify-between p-6 bg-white dark:bg-slate-900 border rounded-3xl shadow-xs hover:border-emerald-500/30 transition-all ${group.isArchived ? 'opacity-55' : ''} border-slate-100 dark:border-slate-800`}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-450 uppercase tracking-widest">
                        {t[group.paymentCycle]}
                      </span>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleEditGroupClick(group)}
                          className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-450 transition-all cursor-pointer"
                          title={t.edit}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            showConfirm(
                              language === 'ar' 
                                ? (group.isArchived ? 'تفعيل الجمعية' : 'أرشفة الجمعية') 
                                : (group.isArchived ? 'Restore Savings Group' : 'Archive Savings Group'),
                              language === 'ar'
                                ? (group.isArchived ? 'هل تود تفعيل هذه الجمعية وإعادتها للقائمة النشطة؟' : 'هل أنت متأكد من أرشفة وتجميد هذه الجمعية لمراجعتها لاحقاً؟')
                                : (group.isArchived ? 'Are you sure you want to restore this group to your active list?' : 'Are you sure you want to archive and freeze this group?'),
                              () => archiveSavingsGroup(group.id, !group.isArchived),
                              'archive'
                            );
                          }}
                          className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-450 transition-all cursor-pointer"
                          title={t.archive || (language === 'ar' ? 'أرشفة' : 'Archive')}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            showConfirm(
                              language === 'ar' ? 'حذف الجمعية نهائياً' : 'Delete Savings Group',
                              language === 'ar'
                                ? `⚠️ تحذير: هل أنت متأكد من حذف الجمعية "${group.name}" بالكامل؟ سيتم مسح كافة الأعضاء وجداول الدورة ولا يمكن التراجع عن هذا الإجراء.`
                                : `⚠️ Warning: Are you sure you want to permanently delete the savings group "${group.name}"? This will erase all members and payment history. This action cannot be undone.`,
                              () => deleteSavingsGroup(group.id),
                              'danger'
                            );
                          }}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-slate-450 hover:text-rose-500 transition-all cursor-pointer"
                          title={language === 'ar' ? 'حذف نهائي' : 'Delete permanently'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight" dir="auto">
                        {group.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {t.startDate}: {group.startDate}
                      </p>
                    </div>

                    {/* Cycle Progress bar */}
                    <div className="space-y-1.5 pb-2">
                      <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>{t.currentCycleStatus}</span>
                        <span>{activeCount} / {group.numMembers} {language === 'ar' ? 'مستلم' : 'Receiver'}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full transition-all" style={{ width: `${progressPercentage}%` }} />
                      </div>
                    </div>

                    {/* Late notices warnings */}
                    {lateList.length > 0 && (
                      <div className="p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10 text-[10px] text-rose-500 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 animate-bounce flex-shrink-0" />
                        <span>{t.latePayments}: {lateList.length} أقساط متأخرة</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between gap-2 mt-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        {t.totalAmount}
                      </span>
                      <span className="font-black text-sm text-slate-900 dark:text-white block">
                        {group.totalAmount.toLocaleString()} {group.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedGroupId(group.id)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-650 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-transform duration-100"
                    >
                      {language === 'ar' ? 'عرض السهم والتاريخ ←' : 'View payments matrix ←'}
                    </button>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="col-span-1 md:col-span-3 text-center py-16 text-slate-400 text-xs bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl">
              {language === 'ar' ? 'لم تقم بتأسيس أي جمعيات مالية حتى الآن.' : 'No rotating savings groups synchronized.'}
            </div>
          )}
        </div>
      )}

      {/* 4. Single Detailed Jamiya Explorer View */}
      {!showAddForm && selectedGroupId && currentOpenGroup && (
        <div className="space-y-6 animate-fade-in pb-16">
          
          {/* A. Info Hub Block */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-105 dark:border-slate-805 shadow-xs grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div className="md:col-span-2 space-y-2">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-100/30">
                <span>{t[currentOpenGroup.paymentCycle]}</span>
              </div>
              <h3 className="font-black text-xl text-slate-900 dark:text-white leading-tight">
                {currentOpenGroup.name}
              </h3>
              <p className="text-xs text-slate-400">
                {t.startDate}: {currentOpenGroup.startDate} • {t.numMembers} {currentOpenGroup.numMembers}
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850/30 rounded-2xl text-center space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">
                {t.paymentPerMember}
              </span>
              <span className="text-lg font-black text-emerald-520 text-emerald-500">
                {currentOpenGroup.paymentPerMember.toLocaleString()} {currentOpenGroup.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850/30 rounded-2xl text-center space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">
                {t.totalAmount}
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-white">
                {currentOpenGroup.totalAmount.toLocaleString()} {currentOpenGroup.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
              </span>
            </div>
          </div>

          {/* B. HIGH FIDELITY SAVINGS PAYMENT HISTORY MATRIX (Perfect requirements alignment) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 gap-4">
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-500" />
                  {t.paymentHistory}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'ar' ? 'مخطط الدفع التفاعلي - انقر على الدائرة لتعيين قسط قفل الدورة ماليأ لضمان تتبع ذكي' : 'Interactive matrix grid. Toggle circles to track round payments.'}
                </p>
              </div>
            </div>

            <div 
              className="overflow-x-auto"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850/40 border-b border-slate-150/40 dark:border-slate-800/60 font-bold text-slate-500">
                    <th className="p-4 bg-slate-50 dark:bg-slate-900 font-black sticky left-0 z-10 w-44">
                      {language === 'ar' ? 'العضو' : 'Participant'}
                    </th>
                    <th className="p-4 text-center">
                      {language === 'ar' ? 'الاستلام' : 'Jackpot Collected'}
                    </th>
                    {Array.from({ length: currentOpenGroup.numMembers }).map((_, idx) => (
                      <th key={idx} className="p-4 text-center min-w-[70px]">
                        {language === 'ar' ? `دورة ${idx + 1}` : `Round ${idx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-805">
                  {currentOpenGroup.members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/10">
                      
                      {/* Fixed Left name column */}
                      <td className="p-4 font-extrabold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 z-10 w-44">
                        <div className="space-y-0.5">
                          <span>{member.name || (language === 'ar' ? `عضو ${member.receiveCycleIndex}` : `Member ${member.receiveCycleIndex}`)}</span>
                          {member.phone && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {member.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jackpot Received Toggle box */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => toggleMemberReceivedState(currentOpenGroup.id, member.id, !member.isReceived, member.receiveCycleIndex)}
                          className={`px-3 py-1 text-[10px] font-black rounded-lg cursor-pointer ${
                            member.isReceived 
                              ? 'bg-emerald-500/10 text-emerald-505 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-500 border border-emerald-300/30' 
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {member.isReceived ? (language === 'ar' ? 'تم الاستلام ✓' : 'Collected ✓') : (language === 'ar' ? 'معلّق' : 'Pending')}
                        </button>
                      </td>

                      {/* Payment Rounds Check Circle cells */}
                      {Array.from({ length: currentOpenGroup.numMembers }).map((_, idx) => {
                        const isPaid = (member.paidCycles || []).includes(idx);
                        return (
                          <td key={idx} className="p-4 text-center">
                            <button
                              onClick={() => toggleMemberPaidCycle(currentOpenGroup.id, member.id, idx)}
                              className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all mx-auto cursor-pointer ${
                                isPaid
                                  ? 'bg-emerald-500 border-emerald-500 text-white scale-110 shadow-xs shadow-emerald-500/10'
                                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                              }`}
                            >
                              {isPaid && <CheckCircle className="w-4 h-4" />}
                            </button>
                          </td>
                        );
                      })}

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* C. Late payments ledger card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
              <h4 className="font-exrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
                {t.latePayments} {language === 'ar' ? 'المتأخرات للمطالبة' : 'Missed Round Ledger'}
              </h4>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {getLateDues(currentOpenGroup).length > 0 ? (
                  getLateDues(currentOpenGroup).map((late, index) => (
                    <div key={index} className="py-3 flex justify-between items-center first:pt-0 last:pb-0 text-xs">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {late.memberName}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {language === 'ar' ? `العقد/الرباط في الدورة رقم ${late.cycleIndex + 1}` : `Missed cycle round #${late.cycleIndex + 1}`}
                        </span>
                      </div>

                      <span className="text-xs font-black text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/20 px-2 py-0.5 rounded-md">
                        {currentOpenGroup.paymentPerMember.toLocaleString()} {currentOpenGroup.currency === 'LYD' ? t.lydSymbol : t.usdSymbol}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">
                    {t.noLatePayments}
                  </div>
                )}
              </div>
            </div>

            {/* Next receiver order detail card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="font-exrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                  {language === 'ar' ? 'الموجّه الدوار وخطة الجمع للمستقبل' : 'Payout scheduling guide'}
                </h4>

                <div className="space-y-3">
                  {currentOpenGroup.receivingOrder.map((mId, index) => {
                    const matched = currentOpenGroup.members.find(m => m.id === mId);
                    return (
                      <div key={mId} className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold block">
                          {language === 'ar' ? `المستلم رقم ${index + 1}` : `Receiver #${index + 1}`}
                        </span>
                        <span className={`font-black text-xs ${matched?.isReceived ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {matched?.name || t.none}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-[10px] text-indigo-500 font-bold flex items-center gap-2 mt-4">
                <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0 text-indigo-505" />
                <span>
                  {language === 'ar' 
                    ? `تأسست جمعيتك الكبرى بدلاً من الورق التقليدي ليسهل تتبع الاستحقاق والدفع للأعضاء!` 
                    : `Your Jamiya circle was digitized ensuring transparent ledger updates with zero calculations.`}
                </span>
              </div>
            </div>

          </div>

        </div>
      )}

      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
        type={confirmModalState.type}
      />

    </div>
  );
};
