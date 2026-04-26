import React from 'react';
import { Briefcase, ClipboardCheck, Eye, FolderOpen, MessageSquare, ShieldCheck, CheckCircle2, Settings2 } from 'lucide-react';
import { Task, AuditPhase } from '../../../types';
import { AuditDocFile } from '../../../services/auditDocs';

export const PHASE_LABELS_FULL = {
    [AuditPhase.ONBOARDING]: 'Onboarding & Risk Assmt',
    [AuditPhase.PLANNING_AND_EXECUTION]: 'Planning & Execution',
    [AuditPhase.REVIEW_AND_CONCLUSION]: 'Review & Conclusion'
};

export interface TaskDetailsTabProps {
    task: Partial<Task>;
    auditFiles: AuditDocFile[];
    setActiveDetailTab: (tab: string) => void;
    isArchived: boolean;
}

const TaskDetailsTab: React.FC<TaskDetailsTabProps> = ({
    task,
    auditFiles,
    setActiveDetailTab,
    isArchived
}) => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-[1600px] w-full mx-auto p-4 md:p-6 space-y-6 pb-32">
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Column: Core Identity (Read-only) */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white dark:bg-white/5 rounded-[32px] p-8 border border-black/5 dark:border-white/10 shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                    <Briefcase size={20} className="text-brand-400" />
                                </div>
                                <div>
                                    <h4 className="text-[14px] font-black text-white uppercase tracking-widest">Engagement Overview</h4>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Core Information Summary</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Title</label>
                                    <p className="text-[14px] font-bold text-white">{task.title}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Client</label>
                                    <p className="text-[14px] font-bold text-white">{task.clientName || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Fiscal Year</label>
                                    <p className="text-[14px] font-bold text-emerald-400">FY {task.fiscalYear}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Status & Phase</label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 text-[10px] font-black uppercase tracking-widest border border-brand-500/20">
                                            {task.status?.replace('_', ' ')}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                                            {(PHASE_LABELS_FULL as any)[task.auditPhase as AuditPhase] || task.auditPhase}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Start Date</label>
                                    <p className="text-[14px] font-bold text-emerald-400">{task.startDate || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Deadline</label>
                                    <p className="text-[14px] font-bold text-rose-400">{task.dueDate}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Lead Auditor</label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center text-[10px] font-bold text-brand-400 uppercase">
                                            {task.assignedToNames?.[0]?.charAt(0) || 'A'}
                                        </div>
                                        <p className="text-[13px] font-bold text-white">{task.assignedToNames?.[0] || 'Unassigned'}</p>
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-2 pt-4 border-t border-white/5">
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Description / Audit Scope</label>
                                    <p className="text-[13px] text-gray-400 leading-relaxed font-semibold italic">
                                        "{task.description || 'No engagement scope defined.'}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Key Pulse Metrics */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-white/5 rounded-[32px] p-8 border border-black/5 dark:border-white/10 shadow-sm space-y-8">
                            <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Pulse Indicator</h4>
                            
                            <div className="space-y-6">
                                {/* Progress Pulsar */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Execution Progress</span>
                                        <span className="text-[16px] font-black text-brand-400">{Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / (task.subtasks || []).length) * 100 || 0)}%</span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                                        <div 
                                            className="h-full bg-gradient-to-r from-emerald-500 to-brand-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-1000"
                                            style={{ width: `${Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / (task.subtasks || []).length) * 100 || 0)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-brand-500/20 transition-all cursor-pointer group" onClick={() => setActiveDetailTab('PROCEDURES')}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1 rounded bg-brand-500/10 text-brand-400">
                                                <ClipboardCheck size={12} />
                                            </div>
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Sub task</span>
                                        </div>
                                        <p className="text-xl font-black text-white">{(task.subtasks || []).filter(s => s.isCompleted).length}<span className="text-[10px] text-gray-600 font-bold"> / {(task.subtasks || []).length}</span></p>
                                    </div>

                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-brand-500/20 transition-all cursor-pointer group" onClick={() => setActiveDetailTab('OBSERVATIONS')}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1 rounded bg-rose-500/10 text-rose-400">
                                                <Eye size={12} />
                                            </div>
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Findings</span>
                                        </div>
                                        <p className="text-xl font-black text-white">{(task.observations || []).length}</p>
                                    </div>

                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-brand-500/20 transition-all cursor-pointer group" onClick={() => setActiveDetailTab('EVIDENCE')}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                                                <FolderOpen size={12} />
                                            </div>
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Documents</span>
                                        </div>
                                        <p className="text-xl font-black text-white">{auditFiles.length}</p>
                                    </div>

                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-brand-500/20 transition-all cursor-pointer group" onClick={() => setActiveDetailTab('COMMENTS')}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1 rounded bg-amber-500/10 text-amber-400">
                                                <MessageSquare size={12} />
                                            </div>
                                            <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Activity</span>
                                        </div>
                                        <p className="text-xl font-black text-white">{(task.comments || []).length}</p>
                                    </div>

                                    <div className="bg-black/20 rounded-2xl p-4 border border-white/5 hover:border-indigo-500/20 transition-all cursor-pointer group col-span-2" onClick={() => setActiveDetailTab('REVIEW_CHECKLIST')}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 rounded bg-indigo-500/10 text-indigo-400">
                                                    <ShieldCheck size={12} />
                                                </div>
                                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Review Protocol</span>
                                            </div>
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">LAYER 1/2/3</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            {[
                                                { label: 'TL', done: !!task.teamLeadApprovedAt, color: 'brand' },
                                                { label: 'ER', done: !!task.engagementReviewerApprovedAt, color: 'indigo' },
                                                { label: 'SP', done: !!task.signingPartnerApprovedAt, color: 'rose' }
                                            ].map(lv => (
                                                <div key={lv.label} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg border transition-all ${
                                                    lv.done 
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                        : 'bg-white/5 border-white/5 text-gray-600'
                                                }`}>
                                                    {lv.done ? <CheckCircle2 size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-current opacity-30" />}
                                                    <span className="text-[9px] font-black">{lv.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!isArchived && (
                                <button 
                                    onClick={() => setActiveDetailTab('SETTINGS')}
                                    className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] transition-all border border-white/5 flex items-center justify-center gap-2"
                                >
                                    <Settings2 size={12} /> Manage Engagement
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsTab;
