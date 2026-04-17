import React, { useRef } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    List as ListIcon, Plus, X, Check, Tag,
    Calendar, Clock, CheckCircle2, AlertTriangle, UserCircle2,
    GripVertical, ChevronDown, Layers
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, UserRole, Client, AuditPhase } from '../../types';
import { SIGNING_AUTHORITIES } from '../../constants/firmData';
import { getClientVisuals } from '../../utils/colorUtils';
import { getAvatarColor, getInitials } from '../../utils/userUtils';
import { AnimatePresence, motion } from 'framer-motion';
import { useMedia } from 'react-use';
import TaskCard from './TaskCard';

interface TaskMainViewProps {
    viewMode: 'LIST' | 'KANBAN';
    tasks: Task[];
    onDragEnd: (result: DropResult) => void;
    handleOpenEdit: (task: Task) => void;
    usersList: UserProfile[];
    collapsedColumns: TaskStatus[];
    toggleColumnCollapse: (status: TaskStatus) => void;
    selectedTaskId?: string;
    selectedTaskIds: string[];
    onToggleSelection: (taskId: string) => void;
    groupBy: 'NONE' | 'AUDITOR' | 'ASSIGNEE' | 'PHASE';
    onQuickAdd: (status: TaskStatus, title: string) => Promise<void>;
    clientsList: Client[];
    onUpdateTaskStatus?: (taskId: string, status: TaskStatus) => void;
    onOpenReassign?: (taskId: string) => void;
    onSelectAll?: () => void;
    onOpenClientDetail?: (clientId: string) => void;
    sentinelRef?: React.RefObject<HTMLDivElement | null>;
    isFetchingNextPage?: boolean;
    currentUser: UserProfile | null;
}

// ── Status column config ──────────────────────────────────────────────────────
const S: Record<string, {
    label: string; dot: string; dotColor: string; headerAccent: string;
    headerBg: string; countBg: string; ring: string; dropBg: string;
    border: string; text: string;
}> = {
    [TaskStatus.NOT_STARTED]: {
        label: 'Not Started', dot: 'bg-slate-400 dark:bg-slate-500', dotColor: '#94a3b8',
        headerAccent: 'bg-slate-500/5',
        headerBg: 'bg-slate-500/10 dark:bg-slate-500/5',
        countBg: 'bg-slate-500/10 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20',
        ring: 'ring-slate-400/40', dropBg: 'bg-slate-400/5',
        border: 'border-slate-200 dark:border-white/[0.05]', text: 'text-slate-600 dark:text-slate-400',
    },
    [TaskStatus.IN_PROGRESS]: {
        label: 'In Progress', dot: 'bg-blue-500', dotColor: '#3b82f6',
        headerAccent: 'bg-blue-500/10',
        headerBg: 'bg-blue-500/15 dark:bg-blue-500/10',
        countBg: 'bg-blue-600/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
        ring: 'ring-blue-500/40', dropBg: 'bg-blue-500/5',
        border: 'border-blue-500/30 dark:border-blue-500/20', text: 'text-blue-700 dark:text-blue-400',
    },
    [TaskStatus.COMPLETED]: {
        label: 'Completed', dot: 'bg-emerald-500', dotColor: '#10b981',
        headerAccent: 'bg-emerald-500/10',
        headerBg: 'bg-emerald-500/15 dark:bg-emerald-500/10',
        countBg: 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
        ring: 'ring-emerald-500/40', dropBg: 'bg-emerald-500/5',
        border: 'border-emerald-500/30 dark:border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400',
    },
};

const PHASE_META: Record<string, {
    label: string; shortLabel: string;
    color: string; dot: string; accentHex: string;
    bg: string; headerGradient: string; border: string;
    glow: string; stepNum: string;
}> = {
    [AuditPhase.ONBOARDING]: {
        label: 'Onboarding', shortLabel: 'P1',
        color: 'text-blue-700 dark:text-blue-400',
        dot: 'bg-blue-500', accentHex: '#3b82f6',
        bg: 'bg-blue-50/30 dark:bg-blue-900/10',
        headerGradient: 'from-blue-600/30 via-blue-500/10 to-transparent dark:from-blue-600/20 dark:via-blue-500/5',
        border: 'border-blue-300/30 dark:border-blue-500/20',
        glow: 'shadow-[0_8px_32px_rgba(59,130,246,0.15)]',
        stepNum: '01',
    },
    [AuditPhase.PLANNING_AND_EXECUTION]: {
        label: 'Planning & Execution', shortLabel: 'P2',
        color: 'text-purple-700 dark:text-purple-400',
        dot: 'bg-purple-500', accentHex: '#a855f7',
        bg: 'bg-purple-50/30 dark:bg-purple-900/10',
        headerGradient: 'from-purple-600/30 via-purple-500/10 to-transparent dark:from-purple-600/20 dark:via-purple-500/5',
        border: 'border-purple-300/30 dark:border-purple-500/20',
        glow: 'shadow-[0_8px_32px_rgba(168,85,247,0.15)]',
        stepNum: '02',
    },
    [AuditPhase.REVIEW_AND_CONCLUSION]: {
        label: 'Review & Conclusion', shortLabel: 'P3',
        color: 'text-emerald-700 dark:text-emerald-400',
        dot: 'bg-emerald-500', accentHex: '#10b981',
        bg: 'bg-emerald-50/30 dark:bg-emerald-900/10',
        headerGradient: 'from-emerald-600/30 via-emerald-500/10 to-transparent dark:from-emerald-600/20 dark:via-emerald-500/5',
        border: 'border-emerald-300/30 dark:border-emerald-500/20',
        glow: 'shadow-[0_8px_32px_rgba(16,185,129,0.15)]',
        stepNum: '03',
    },
};

// ── List view helpers ─────────────────────────────────────────────────────────
const P_LIST: Record<string, { badge: string; label: string; accent: string }> = {
    [TaskPriority.URGENT]: { badge: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/25', label: 'Urgent', accent: '#f43f5e' },
    [TaskPriority.HIGH]: { badge: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/25', label: 'High', accent: '#f59e0b' },
    [TaskPriority.MEDIUM]: { badge: 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/15 border-indigo-200 dark:border-indigo-500/25', label: 'Medium', accent: '#6366f1' },
    [TaskPriority.LOW]: { badge: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20', label: 'Low', accent: '#64748b' },
};
const AV = ['#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16'];
function formatDate(d?: string) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
}

// ────────────────────────────────────────────────────────────────────────────
const TaskMainView: React.FC<TaskMainViewProps> = ({
    viewMode, tasks, onDragEnd, handleOpenEdit, usersList,
    collapsedColumns, toggleColumnCollapse, selectedTaskId,
    selectedTaskIds, onToggleSelection, groupBy, onQuickAdd, clientsList, onUpdateTaskStatus, onOpenReassign, onSelectAll, onOpenClientDetail,
    sentinelRef, isFetchingNextPage, currentUser
}) => {
    const isMobile = useMedia('(max-width: 768px)', false);
    const [quickAddStatus, setQuickAddStatus] = React.useState<string | null>(null);
    const [quickAddTitle, setQuickAddTitle] = React.useState('');

    const submitQuickAdd = async (status: TaskStatus) => {
        if (!quickAddTitle.trim()) return;
        await onQuickAdd(status, quickAddTitle);
        setQuickAddTitle('');
        setQuickAddStatus(null);
    };

    const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

    // ── LIST VIEW ────────────────────────────────────────────────────────────
    if (viewMode === 'LIST') {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar bg-transparent">
                <div className="min-w-full md:min-w-[900px] w-full overflow-x-hidden md:overflow-x-visible pb-8">
                    {!isMobile && (
                        <div className="grid grid-cols-[32px_1fr_180px_140px_100px_120px] gap-x-4 px-6 py-2.5 border-b border-border text-[10px] font-semibold text-muted uppercase tracking-widest sticky top-0 bg-surface/95 backdrop-blur-xl z-20">
                            <div className="flex items-center justify-center">
                                <button
                                    onClick={onSelectAll}
                                    className={`relative w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${allSelected ? 'bg-amber-500 border-amber-400' : 'border-slate-700 hover:border-slate-500 bg-transparent'}`}
                                >
                                    {allSelected && <Check size={10} className="text-black" strokeWidth={3.5} />}
                                </button>
                            </div>
                            <div>Task</div>
                            <div>Assignees</div>
                            <div>Status</div>
                            <div>Priority</div>
                            <div className="text-right">Due Date</div>
                        </div>
                    )}
                    <div className="flex flex-col gap-2 px-6">
                        {[...tasks].sort((a, b) => (a.title || '').localeCompare(b.title || '')).map((task, idx) => {
                            const sc = S[task.status] || S[TaskStatus.NOT_STARTED];
                            const pc = P_LIST[task.priority] ?? P_LIST[TaskPriority.LOW];
                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
                                && task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.ARCHIVED;
                            const isCompleted = task.status === TaskStatus.COMPLETED;
                            const content = (
                                <div
                                    onClick={() => handleOpenEdit(task)}
                                    className={`grid ${isMobile ? 'grid-cols-1 gap-y-3 p-4' : 'grid-cols-[32px_1fr_180px_140px_100px_120px] gap-x-4 px-4 py-2.5'} items-center cursor-pointer group transition-all duration-300 rounded-xl
                                        border ${selectedTaskIds.includes(task.id) ? 'border-brand-500/60 bg-brand-50 dark:bg-brand-900/20 shadow-[0_0_15px_rgba(46,138,97,0.15)]' : 'border-slate-200 dark:border-white/[0.05] hover:border-brand-300 dark:hover:border-brand-500/50 bg-white dark:bg-white/[0.02] hover:bg-brand-50/50 dark:hover:bg-white/[0.04]'}
                                        ${isCompleted ? 'opacity-50 grayscale hover:grayscale-0' : 'shadow-sm hover:shadow-md hover:-translate-y-0.5'}`}
                                >
                                    {!isMobile && (
                                        <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
                                            {canEditTask(task) ? (
                                                <div
                                                    className={`relative w-4 h-4 rounded-[4px] border cursor-pointer flex items-center justify-center transition-all duration-150
                                                        ${selectedTaskIds.includes(task.id) ? 'bg-brand-500 border-brand-500 opacity-100' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-transparent shadow-inner opacity-60 group-hover:opacity-100 group-hover:border-brand-400'}`}
                                                    onClick={() => onToggleSelection(task.id)}>
                                                    {selectedTaskIds.includes(task.id) && <Check size={10} className="text-white" strokeWidth={3.5} />}
                                                </div>
                                            ) : (
                                                <div 
                                                    className="w-4 h-4 rounded-[4px] border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 opacity-40 cursor-not-allowed flex items-center justify-center"
                                                    title="Viewing in read-only mode"
                                                >
                                                    <Lock size={8} className="text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="min-w-0 flex flex-col justify-center gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[13px] font-black tracking-wide truncate transition-colors ${
                                                (isCompleted && task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION) ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-800 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400'
                                            }`}>{task.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px]">
                                            {task.clientName && (
                                                <div
                                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold border border-brand-200 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 group-hover:bg-brand-100 dark:group-hover:bg-brand-500/20`}
                                                    onClick={(e) => { if (onOpenClientDetail && task.clientIds?.[0]) { e.stopPropagation(); onOpenClientDetail(task.clientIds[0]); } }}
                                                >
                                                    <Tag size={9} />
                                                    <span className="truncate max-w-[150px]">{task.clientName}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {!isMobile && (
                                        <>
                                            <div className="flex -space-x-2 items-center pl-2">
                                                {task.assignedTo.length === 0 ? (
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 rounded-full px-2.5 py-1">Unassigned</span>
                                                ) : (
                                                    <>
                                                        {task.assignedTo.slice(0, 4).map((uid, i) => {
                                                            const u = usersList.find(x => x.uid === uid);
                                                            const av = getAvatarColor(uid);
                                                            return (
                                                                <div key={uid || i} title={u?.displayName}
                                                                    className={`w-7 h-7 rounded-full border-2 border-white dark:border-[#09090b] flex items-center justify-center text-[9px] font-black text-white shadow-md backdrop-blur-sm ${av.bg} ${av.text} group-hover:scale-110 transition-transform`}>
                                                                    {getInitials(u?.displayName || '?')}
                                                                </div>
                                                            );
                                                        })}
                                                        {task.assignedTo.length > 4 && <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-[#09090b] flex items-center justify-center text-[9px] font-black text-slate-600 dark:text-slate-400 z-10 shadow-md">+{task.assignedTo.length - 4}</div>}
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex items-center">
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm transition-all ${sc.countBg}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${sc?.dot ?? 'bg-slate-500'}`} style={{ boxShadow: `0 0 5px ${sc?.dotColor}80` }} />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">{sc?.label ?? task.status.replace('_', ' ')}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <span className={`text-[9px] uppercase tracking-widest font-black px-2 py-1 rounded-md shadow-sm backdrop-blur-sm border ${pc.badge}`}>{pc.label}</span>
                                            </div>
                                            <div className={`text-right text-[11px] font-black flex items-center justify-end gap-1.5 transition-colors ${isOverdue ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-500/20 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {isOverdue ? <AlertTriangle size={11} className="animate-pulse" /> : <Calendar size={11} className="opacity-60" />}
                                                {formatDate(task.dueDate)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                            return <React.Fragment key={task.id || `task-${idx}`}>{content}</React.Fragment>;
                        })}
                    </div>
                    {/* INFINITE SCROLL SENTINEL - LIST VIEW */}
                    <div ref={sentinelRef} className="w-full flex flex-col items-center justify-center py-10 gap-3">
                        {isFetchingNextPage ? (
                            <div className="flex flex-col items-center gap-2 opacity-50">
                                <div className="w-6 h-6 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">Fetching More</span>
                            </div>
                        ) : (
                            tasks.length > 0 && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-800/20 px-3 py-1 rounded-full border border-white/[0.03]">
                                    {tasks.length} tasks loaded
                                </span>
                            )
                        )}
                    </div>

                    {tasks.length === 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center py-32 px-4 text-center max-w-md mx-auto"
                        >
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full" />
                                <div className="relative w-20 h-20 rounded-3xl bg-surface border border-border flex items-center justify-center shadow-2xl">
                                    <Layers size={32} className="text-muted opacity-50" />
                                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center shadow-lg border-2 border-surface">
                                        <X size={16} strokeWidth={3} />
                                    </div>
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-black text-heading uppercase tracking-widest mb-2">No Matches Found</h3>
                            <p className="text-[13px] text-muted leading-relaxed mb-8">
                                We couldn't find any assignments matching your current filter criteria. Try broadening your search or resetting the view.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-3">
                                <button 
                                    onClick={() => {
                                        // This is a trick: we want the parent to clear filters. 
                                        // Usually we emit this or the parent handles it.
                                        const event = new CustomEvent('rsa-clear-filters');
                                        window.dispatchEvent(event);
                                    }}
                                    className="px-6 h-11 bg-heading text-surface rounded-xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-heading/10"
                                >
                                    Reset All Filters
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        );
    }

    // ── KANBAN VIEW ──────────────────────────────────────────────────────────
    const PHASE_ORDER = [AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION];
    const STATUS_COLS = [TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED];

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="h-full flex flex-col min-h-0 overflow-hidden relative">
                {/* Board Background Gradient - Matching Client Directory Depth */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white dark:from-[#0a0b0e] dark:to-[#12141c] pointer-events-none" />
                <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-blue-500/5 dark:bg-blue-500/[0.03] blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-emerald-500/5 dark:bg-emerald-500/[0.03] blur-[100px] rounded-full pointer-events-none" />

                {/* Horizontal Phase Columns */}
                <div className="flex-1 min-h-0 relative w-full h-full z-10">
                    <div className="h-full w-full flex-1 flex gap-8 overflow-x-auto px-8 py-6 kanban-scroll custom-scrollbar overflow-y-auto">
                        {PHASE_ORDER.map((phase, phaseIdx) => {
                            const pm = PHASE_META[phase];
                            const phaseTasks = tasks.filter(t => (t.auditPhase || AuditPhase.ONBOARDING) === phase);
                            const phaseTotal = phaseTasks.length;
                            const phaseCompleted = phaseTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
                            const phaseProgress = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;

                            return (
                                <div
                                    key={phase}
                                    className={`flex flex-col flex-1 min-w-[420px] h-full min-h-[600px] overflow-hidden rounded-[24px] border border-white/[0.08] dark:border-white/[0.04] bg-white/40 dark:bg-[#12141c]/40 backdrop-blur-2xl ${pm.glow} transition-all duration-500 hover:shadow-2xl group/phase relative`}
                                >
                                    {/* Glass Edge Highlight */}
                                    <div className="absolute inset-px rounded-[23px] border border-white/20 dark:border-white/[0.03] pointer-events-none z-10" />

                                    {/* ── Phase Header ── */}
                                    <div className={`relative flex-shrink-0 border-b ${pm.border} px-6 pt-6 pb-4 overflow-hidden`}>
                                        {/* Dynamic Gradient Banner - Echoing Client Directory */}
                                        <div className={`absolute inset-0 bg-gradient-to-br ${pm.headerGradient} opacity-60 dark:opacity-40 transition-opacity duration-700`} />
                                        
                                        {/* Top Accent Line */}
                                        <div
                                            className="absolute top-0 left-0 right-0 h-[3px] z-20"
                                            style={{ 
                                                background: `linear-gradient(90deg, ${pm.accentHex}, ${pm.accentHex}40, transparent)`,
                                                boxShadow: `0 2px 15px ${pm.accentHex}60`
                                            }}
                                        />

                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2.5">
                                                {/* Step number badge */}
                                                <div
                                                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-[12px] font-black border backdrop-blur-md flex-shrink-0 shadow-lg relative overflow-hidden group/step"
                                                    style={{
                                                        backgroundColor: `${pm.accentHex}20`,
                                                        borderColor: `${pm.accentHex}40`,
                                                        color: pm.accentHex,
                                                    }}
                                                >
                                                    {/* Step Glow */}
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
                                                    <span className="relative z-10">{pm.stepNum}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-[12px] font-black uppercase tracking-[0.1em] ${pm.color}`}>
                                                            {pm.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] text-[var(--text-muted)] font-medium">{phaseTotal} tasks</span>
                                                        {phaseTotal > 0 && (
                                                            <>
                                                                <span className="text-[var(--text-muted)]">·</span>
                                                                <span className="text-[10px] font-bold" style={{ color: `${pm.accentHex}d0` }}>{phaseProgress}% done</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Circular progress */}
                                            {phaseTotal > 0 && (
                                                <div className="relative w-11 h-11 flex-shrink-0">
                                                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" className="text-black/5 dark:text-white/5" strokeWidth="4" />
                                                        <circle
                                                            cx="18" cy="18" r="15" fill="none"
                                                            stroke={pm.accentHex}
                                                            strokeWidth="4"
                                                            strokeLinecap="round"
                                                            strokeDasharray={`${phaseProgress * 0.942} 94.2`}
                                                            className="opacity-100 dark:opacity-80 drop-shadow-[0_0_8px_rgba(0,0,0,0.1)]"
                                                        />
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-0">
                                                        <span className="text-[10px] font-black leading-none" style={{ color: pm.accentHex }}>
                                                            {phaseProgress}%
                                                        </span>
                                                        <span className="text-[7px] font-bold opacity-40 uppercase tracking-tighter">Done</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {phaseTotal > 0 && (
                                            <div className="h-[2px] w-full rounded-full overflow-hidden bg-[var(--border)]">
                                                <div
                                                    className="h-full rounded-full transition-all duration-700"
                                                    style={{
                                                        width: `${phaseProgress}%`,
                                                        background: `linear-gradient(90deg, ${pm.accentHex}80, ${pm.accentHex})`,
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Phase Body: Status Sections ── */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 py-3 space-y-2">
                                        {STATUS_COLS
                                            .map(status => {
                                                const droppableId = `${phase}::${status}`;
                                                const cfg = S[status];
                                                const colTasks = phaseTasks.filter(t => {
                                                    if (status === TaskStatus.IN_PROGRESS) {
                                                        return t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.UNDER_REVIEW || t.status === TaskStatus.HALTED;
                                                    }
                                                    return t.status === status;
                                                });
                                                const hasAny = colTasks.length > 0;

                                                return (
                                                    <Droppable key={droppableId} droppableId={droppableId} type="TASK">
                                                        {(prov, snap) => (
                                                        <div
                                                            ref={prov.innerRef}
                                                            {...prov.droppableProps}
                                                            className={`rounded-2xl transition-all duration-300 p-4 mb-3 border relative overflow-hidden group/status ${
                                                                snap.isDraggingOver 
                                                                    ? `ring-4 ${cfg.ring} ${cfg.headerAccent} scale-[1.02] shadow-2xl z-20` 
                                                                    : `bg-white/30 dark:bg-black/20 border-white/10 dark:border-white/[0.03] shadow-sm hover:border-white/30 dark:hover:border-white/[0.1]`
                                                            }`}
                                                        >
                                                            {/* Status header */}
                                                            <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4 border relative overflow-hidden shadow-sm transition-all duration-300 ${
                                                                snap.isDraggingOver ? 'bg-white/80 dark:bg-white/10' : 'bg-white/60 dark:bg-white/5'
                                                            } ${pm.border}`}>
                                                                {/* Left Marker */}
                                                                <div className={`absolute left-0 top-0 bottom-0 w-[4px] ${cfg.dot} shadow-[4px_0_12px_rgba(0,0,0,0.1)]`} />
                                                                
                                                                <div
                                                                    className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0 transition-all ${snap.isDraggingOver ? 'scale-125' : ''}`}
                                                                    style={{ boxShadow: snap.isDraggingOver ? `0 0 10px ${cfg.dotColor}` : `0 0 6px ${cfg.dotColor}50` }}
                                                                />
                                                                <span className={`text-[9px] font-black uppercase tracking-[0.18em] flex-1 ${cfg.text} opacity-80 group-hover:opacity-100 transition-opacity`}>
                                                                    {cfg.label}
                                                                </span>
                                                                {colTasks.length > 0 && (
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.countBg} shadow-sm`}>
                                                                        {colTasks.length}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Task cards */}
                                                            <div className={`flex flex-col px-0.5 min-h-[8px] transition-all duration-200 ${
                                                                !hasAny && snap.isDraggingOver ? 'min-h-[60px]' : ''
                                                            }`}>
                                                                {colTasks.map((task, i) => (
                                                                    <TaskCard
                                                                        key={task.id || `task-${i}`}
                                                                        task={task}
                                                                        index={i}
                                                                        usersList={usersList}
                                                                        selectedTaskIds={selectedTaskIds}
                                                                        onToggleSelection={onToggleSelection}
                                                                        onClick={handleOpenEdit}
                                                                        onOpenClientDetail={onOpenClientDetail}
                                                                        currentUser={currentUser}
                                                                    />
                                                                ))}
                                                                {prov.placeholder}

                                                                {/* Drop zone visual when dragging over empty */}
                                                                {!hasAny && snap.isDraggingOver && (
                                                                    <div
                                                                        className={`flex items-center justify-center min-h-[50px] rounded-xl border border-dashed text-[10px] font-semibold uppercase tracking-wider mb-1 transition-all`}
                                                                        style={{
                                                                            borderColor: `${cfg.dotColor}50`,
                                                                            color: `${cfg.dotColor}80`,
                                                                            backgroundColor: `${cfg.dotColor}08`,
                                                                        }}
                                                                    >
                                                                        ↓ Drop here
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Quick-Add */}
                                                            <div className="px-0.5 pb-1">
                                                                <AnimatePresence mode="wait">
                                                                    {quickAddStatus === droppableId ? (
                                                                        <motion.div
                                                                            key="input"
                                                                            initial={{ opacity: 0, y: 4, scale: 0.98 }}
                                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                            exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                                                            transition={{ duration: 0.12 }}
                                                                            className="rounded-xl border p-2.5 shadow-xl mb-1 bg-[var(--bg-elevated)]"
                                                                            style={{
                                                                                borderColor: `${pm.accentHex}30`,
                                                                                boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px ${pm.accentHex}20`,
                                                                            }}
                                                                        >
                                                                            <input
                                                                                autoFocus
                                                                                type="text"
                                                                                placeholder="Task title..."
                                                                                value={quickAddTitle}
                                                                                onChange={e => setQuickAddTitle(e.target.value)}
                                                                                onKeyDown={e => {
                                                                                    if (e.key === 'Enter') submitQuickAdd(status);
                                                                                    if (e.key === 'Escape') { setQuickAddStatus(null); setQuickAddTitle(''); }
                                                                                }}
                                                                                className="w-full bg-transparent text-[12px] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none mb-2 font-medium"
                                                                            />
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-[9px] text-slate-400 dark:text-slate-700 font-medium">↵ save · Esc cancel</span>
                                                                                <div className="flex gap-1.5">
                                                                                    <button
                                                                                        onClick={() => { setQuickAddStatus(null); setQuickAddTitle(''); }}
                                                                                        className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                                                                                    >
                                                                                        <X size={11} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => submitQuickAdd(status)}
                                                                                        className="px-2.5 h-6 text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1"
                                                                                        style={{
                                                                                            backgroundColor: `${pm.accentHex}30`,
                                                                                            border: `1px solid ${pm.accentHex}50`,
                                                                                            color: pm.accentHex,
                                                                                        }}
                                                                                    >
                                                                                        <Plus size={10} /> Add
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </motion.div>
                                                                    ) : (
                                                                        <motion.button
                                                                            key="btn"
                                                                            initial={{ opacity: 0 }}
                                                                            animate={{ opacity: 1 }}
                                                                            exit={{ opacity: 0 }}
                                                                            onClick={() => setQuickAddStatus(droppableId)}
                                                                            className={`w-full py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 group/add transition-all duration-200 ${
                                                                                snap.isDraggingOver ? 'opacity-0' : 'opacity-40 dark:opacity-20 hover:opacity-100 hover:bg-white/60 dark:hover:bg-white/[0.03]'
                                                                            }`}
                                                                            style={{ color: cfg.dotColor }}
                                                                        >
                                                                            <Plus size={11} className="group-hover/add:scale-125 transition-transform" /> Add task
                                                                        </motion.button>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        </div>
                                                    )}
                                                    </Droppable>
                                                );
                                            })}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* INFINITE SCROLL SENTINEL - KANBAN (Horizontal) */}
                        <div 
                            ref={sentinelRef} 
                            className="flex-shrink-0 w-4 h-full pointer-events-none opacity-0"
                        />
                    </div>
                </div>
            </div>
        </DragDropContext>
    );
};

export default TaskMainView;
