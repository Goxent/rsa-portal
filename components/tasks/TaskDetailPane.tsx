import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye,
    Sparkles, Book, ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen,
    Users, UserCheck, Shield, Lock, Unlock, ExternalLink, History
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase, Template, TemplateFolder, TaskType, AuditObservation } from '../../types';
import { TASK_TYPE_CHECKLISTS, TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';
import { useModal } from '../../context/ModalContext';
import { KnowledgeService } from '../../services/knowledge';
import { TemplateService } from '../../services/templates';
import StaffSelect from '../StaffSelect';
import ClientSelect from '../ClientSelect';
import TaskComments from '../TaskComments';
import NepaliDatePicker from '../NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema, TaskFormValues } from '../../utils/validationSchemas';
import { convertADToBS, generateFiscalYearOptions } from '../../utils/nepaliDate';

interface TaskDetailPaneProps {
    task: Partial<Task>;
    isOpen: boolean;
    onClose: () => void;
    onSave: (taskData: any) => void;
    onDelete: (id: string) => void;
    onChange: (updates: Partial<Task>) => void;
    usersList: UserProfile[];
    clientsList: Client[];
    isSaving: boolean;
    isEditMode: boolean;
    canManageTask: boolean;
    dateMode: 'AD' | 'BS';
    setDateMode: (mode: 'AD' | 'BS') => void;
    newSubtaskTitle: string;
    setNewSubtaskTitle: (title: string) => void;
    onAddSubtask: (phase: AuditPhase | 'UNCATEGORIZED') => void;
    onAddComment: (comment: TaskComment) => void;
    onOpenClientDetail?: (clientId: string) => void;
    onInjectPhaseSubtasks?: (task: Task, newPhase: AuditPhase, templates: Template[]) => SubTask[] | null;
    onInjectStatusSubtasks?: (task: Task, newStatus: TaskStatus, templates: Template[]) => SubTask[] | null;
    onSwapPhaseChecklist?: (task: Task, newPhase: AuditPhase) => SubTask[];
    templates: Template[];
    userTasksCount?: Record<string, number>;
}

const PHASE_ORDER = {
    [AuditPhase.ONBOARDING]: 1,
    [AuditPhase.PLANNING_AND_EXECUTION]: 2,
    [AuditPhase.REVIEW_AND_CONCLUSION]: 3
};

const PHASE_LABELS = {
    [AuditPhase.ONBOARDING]: 'P1',
    [AuditPhase.PLANNING_AND_EXECUTION]: 'P2',
    [AuditPhase.REVIEW_AND_CONCLUSION]: 'P3'
};

const PHASE_LABELS_FULL = {
    [AuditPhase.ONBOARDING]: 'Onboarding',
    [AuditPhase.PLANNING_AND_EXECUTION]: 'Execution',
    [AuditPhase.REVIEW_AND_CONCLUSION]: 'Conclusion'
};

const isPhaseVisible = (subtaskPhase: AuditPhase | undefined, currentPhase: AuditPhase) => {
    if (!subtaskPhase) return true; // Show uncategorized/manual tasks
    return PHASE_ORDER[subtaskPhase] <= PHASE_ORDER[currentPhase];
};

// ── Icon Mapping for Engagement Framework ──
const ICON_MAP: Record<string, any> = {
    ShieldCheck: <ShieldCheck size={20} />,
    Scale: <Scale size={20} />,
    ClipboardCheck: <ClipboardCheck size={20} />,
    Award: <Award size={20} />,
    BarChart2: <BarChart2 size={20} />,
    FileSearch: <FileSearch size={20} />,
    FolderOpen: <FolderOpen size={20} />,
    Activity: <Activity size={20} />
};

// ── Reusable boxed field wrapper ──────────────────────────────────────────
const Field: React.FC<{
    label: string;
    icon: React.ReactNode;
    error?: boolean;
    span2?: boolean;
    extra?: React.ReactNode;
    children: React.ReactNode;
    className?: string; // Added className
}> = ({ label, icon, error, span2, extra, children, className }) => (
    <div className={`group flex flex-col items-start gap-2 py-1.5 ${span2 ? 'md:col-span-2' : ''} ${className || ''}`}>

        <div className="flex items-center justify-between w-full">
            <label className={`text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 ${error ? 'text-rose-400' : 'text-gray-500'}`}>
                {icon} {label}
            </label>
            {extra && <div>{extra}</div>}
        </div>
        <div className="w-full">
            {children}
        </div>
    </div>
);

const TaskDetailPane: React.FC<TaskDetailPaneProps> = ({
    task,
    isOpen,
    onClose,
    onSave,
    onDelete,
    onChange,
    usersList,
    clientsList,
    isSaving,
    isEditMode,
    canManageTask,
    dateMode,
    setDateMode,
    newSubtaskTitle,
    setNewSubtaskTitle,
    onAddSubtask,
    onAddComment,
    onOpenClientDetail,
    onInjectPhaseSubtasks,
    onInjectStatusSubtasks,
    onSwapPhaseChecklist,
    templates,
    userTasksCount = {}
}) => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const initialTaskRef = useRef<Partial<Task> | null>(null);
    const [showDiscardBanner, setShowDiscardBanner] = useState(false);
    const [showPhaseWarning, setShowPhaseWarning] = useState<AuditPhase | null>(null);
    const fiscalYears = useMemo(() => generateFiscalYearOptions(2080), []);
    const [allResources, setAllResources] = useState<Resource[]>([]);
    const [templateFolders, setTemplateFolders] = useState<TemplateFolder[]>([]);
    const [importPhase, setImportPhase] = useState<AuditPhase | null>(null);
    const [templateSearchQuery, setTemplateSearchQuery] = useState('');
    const [showAllFrameworks, setShowAllFrameworks] = useState(false);
    const [localSubtaskTitles, setLocalSubtaskTitles] = useState<Record<AuditPhase | 'UNCATEGORIZED', string>>({
        [AuditPhase.ONBOARDING]: '',
        [AuditPhase.PLANNING_AND_EXECUTION]: '',
        [AuditPhase.REVIEW_AND_CONCLUSION]: '',
        UNCATEGORIZED: ''
    });

    const descRef = useRef<HTMLTextAreaElement | null>(null);

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: task.title || '',
            clientId: task.clientIds?.[0] || '',
            startDate: task.startDate || '',
            dueDate: task.dueDate || '',
            priority: task.priority || TaskPriority.MEDIUM,
            status: task.status || TaskStatus.NOT_STARTED,
            estimatedHours: task.totalTimeSpent || 0,
            assignedTo: task.assignedTo || [],
            teamLeaderId: task.teamLeaderId || '',
            engagementReviewerId: task.engagementReviewerId || '',
            signingPartnerId: task.signingPartnerId || '',
            description: task.description || '',
            auditPhase: task.auditPhase || AuditPhase.ONBOARDING,
            teamLeadApprovedAt: task.teamLeadApprovedAt || '',
            engagementReviewerApprovedAt: task.engagementReviewerApprovedAt || '',
            signingPartnerApprovedAt: task.signingPartnerApprovedAt || '',
        }
    });

    const currentPhase = (watch('auditPhase') as AuditPhase) || AuditPhase.ONBOARDING;
    const currentStatus = watch('status');
    const filteredSubtasks = (task.subtasks || []).filter(s => isPhaseVisible(s.phase as AuditPhase, currentPhase));

    // Intelligence: Auto-suggested Resources based on Linked Framework
    const recommendedResources = useMemo(() => {
        if (!task.linkedFolderId || allResources.length === 0) return [];
        const folder = templateFolders.find(f => f.id === task.linkedFolderId);
        if (!folder) return [];

        return allResources.filter(r =>
            r.title.toLowerCase().includes(folder.name.toLowerCase()) ||
            r.tags?.some(t => folder.name.toLowerCase().includes(t.toLowerCase()))
        ).slice(0, 5);
    }, [task.linkedFolderId, allResources, templateFolders]);

    // Auto-resize description textarea
    const autoResize = useCallback(() => {
        const el = descRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = Math.max(48, Math.min(el.scrollHeight, 240)) + 'px';
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            TemplateService.getFolders().then(setTemplateFolders).catch(() => { });
            KnowledgeService.getAllResources().then(setAllResources).catch(() => { });
        }
    }, [isOpen]);

    // Snapshot task state whenever the pane opens
    useEffect(() => {
        if (isOpen) {
            initialTaskRef.current = JSON.parse(JSON.stringify(task));
            setShowDiscardBanner(false);
            setShowPhaseWarning(null);
            reset({
                title: task.title || '',
                clientId: task.clientIds?.[0] || '',
                startDate: task.startDate || '',
                dueDate: task.dueDate || '',
                priority: task.priority || TaskPriority.MEDIUM,
                status: task.status || TaskStatus.NOT_STARTED,
                estimatedHours: task.totalTimeSpent || 0,
                assignedTo: task.assignedTo || [],
                teamLeaderId: task.teamLeaderId || '',
                engagementReviewerId: task.engagementReviewerId || '',
                signingPartnerId: task.signingPartnerId || '',
                description: task.description || '',
                auditPhase: task.auditPhase || AuditPhase.ONBOARDING,
                teamLeadApprovedAt: task.teamLeadApprovedAt || '',
                engagementReviewerApprovedAt: task.engagementReviewerApprovedAt || '',
                signingPartnerApprovedAt: task.signingPartnerApprovedAt || '',
                taskType: task.taskType || undefined
            });
            // Auto-resize after reset
            requestAnimationFrame(() => autoResize());
        }
    }, [isOpen, task.id, reset, autoResize]); // Added deps

    // Wire up description register with ref for auto-resize
    const descRegister = register('description');

    const hasUnsavedChanges = isOpen
        ? JSON.stringify(task) !== JSON.stringify(initialTaskRef.current)
        : false;

    const handleCloseAttempt = () => {
        if (hasUnsavedChanges) {
            setShowDiscardBanner(true);
        } else {
            onClose();
        }
    };

    const handleSave = (data: TaskFormValues) => {
        // Enforce Review Logic on completion attempt
        if (data.status === TaskStatus.COMPLETED) {
            if (!task.teamLeadApprovedAt || !task.engagementReviewerApprovedAt || !task.signingPartnerApprovedAt) {
                toast.error("All Reviewer sign-offs (Team Lead, Engagement Reviewer, Partner) are required to complete this assignment.", { icon: '🔒' });
                return;
            }
        }

        const fullSaveData = {
            ...task,
            title: data.title,
            description: data.description,
            priority: data.priority,
            status: data.status,
            startDate: data.startDate,
            dueDate: data.dueDate,
            assignedTo: data.assignedTo?.filter(id => id && id.trim() !== '') || [],
            teamLeaderId: data.teamLeaderId,
            engagementReviewerId: data.engagementReviewerId,
            signingPartnerId: data.signingPartnerId,
            teamLeadApprovedAt: data.teamLeadApprovedAt,
            engagementReviewerApprovedAt: data.engagementReviewerApprovedAt,
            signingPartnerApprovedAt: data.signingPartnerApprovedAt,
            totalTimeSpent: data.estimatedHours,
            clientIds: data.clientId ? [data.clientId] : [],
            clientName: clientsList.find(c => c.id === data.clientId)?.name || undefined,
            auditPhase: data.auditPhase,
            taskType: data.taskType || task.taskType,
        };
        onSave(fullSaveData);
        initialTaskRef.current = JSON.parse(JSON.stringify(fullSaveData));
        setShowDiscardBanner(false);
    };

    const handleApprove = (role: 'TL' | 'ER' | 'SP') => {
        const now = new Date().toISOString();
        if (role === 'TL') {
            setValue('teamLeadApprovedAt', now);
            onChange({ teamLeadApprovedAt: now });
            toast.success("Execution Phase Approved by Team Lead", { icon: '✅' });
        } else if (role === 'ER') {
            setValue('engagementReviewerApprovedAt', now);
            onChange({ engagementReviewerApprovedAt: now });
            toast.success("Engagement Quality Review Approved", { icon: '✅' });
        } else if (role === 'SP') {
            setValue('signingPartnerApprovedAt', now);
            onChange({ signingPartnerApprovedAt: now });
            toast.success("Final Partner Sign-off Recorded", { icon: '🏆' });
        }
    };

    const toggleSubtask = (id: string, evidenceText?: string) => {
        const updated = [...(task.subtasks || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            const st = updated[idx];
            if (!st.isCompleted && st.isEvidenceMandatory && !st.evidenceProvided && !evidenceText) {
                toast.error("Evidence is mandatory to mark this procedure as complete. Please provide it below.", { icon: '🛑' });
                return;
            }
            updated[idx] = {
                ...st,
                isCompleted: !st.isCompleted,
                evidenceProvided: evidenceText ? true : st.evidenceProvided,
                evidenceText: evidenceText || st.evidenceText
            };
            onChange({ subtasks: updated });
        }
    };

    const onRemoveSubtaskLocal = (id: string) => {
        const updated = (task.subtasks || []).filter(st => st.id !== id);
        onChange({ subtasks: updated });
    };

    const handleSubtaskAction = (id: string, action: 'RAISE_QUERY' | 'REPLY' | 'CLEAR', data?: string) => {
        const updated = [...(task.subtasks || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            const st = updated[idx];
            if (action === 'RAISE_QUERY') {
                updated[idx] = {
                    ...st,
                    queryStatus: 'OPEN',
                    queryComment: data,
                    queryRaisedBy: user?.displayName || 'Reviewer',
                    queryRaisedAt: new Date().toISOString()
                };
            } else if (action === 'REPLY') {
                updated[idx] = { ...st, queryStatus: 'RESOLVED', queryReply: data };
            } else if (action === 'CLEAR') {
                updated[idx] = { ...st, queryStatus: 'CLEARED' };
            }
            onChange({ subtasks: updated });
        }
    };

    const handleQuickAddSubtask = (phase: AuditPhase) => {
        const title = localSubtaskTitles[phase]?.trim();
        if (!title) return;

        const newSubtask: SubTask = {
            id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            createdBy: user?.displayName || 'unknown',
            phase: phase,
            assignedTo: [],
            isNew: true,
            isAutoGenerated: false
        };

        onChange({ subtasks: [...(task.subtasks || []), newSubtask] });
        setLocalSubtaskTitles(prev => ({ ...prev, [phase]: '' }));
    };

    const handleAddObservation = () => {
        const newObs: AuditObservation = {
            id: `obs-${Date.now()}`,
            title: 'Observation',
            observation: '',
            implication: '',
            recommendation: '',
            severity: 'MEDIUM',
            status: 'DRAFT',
            createdAt: new Date().toISOString(),
            createdBy: user?.displayName || 'unknown'
        };
        const currentObs = task.observations || [];
        onChange({ observations: [...currentObs, newObs] });
    };

    const handleUpdateObservation = (id: string, updates: Partial<AuditObservation>) => {
        const currentObs = [...(task.observations || [])];
        const idx = currentObs.findIndex(o => o.id === id);
        if (idx > -1) {
            currentObs[idx] = { ...currentObs[idx], ...updates };
            onChange({ observations: currentObs });
        }
    };

    const handleRemoveObservation = (id: string) => {
        const currentObs = (task.observations || []).filter(o => o.id !== id);
        onChange({ observations: currentObs });
    };

    const handlePhaseSwitch = (newPhase: AuditPhase) => {
        const currentOrder = PHASE_ORDER[currentPhase];
        const newOrder = PHASE_ORDER[newPhase];

        // Intelligence: Hard Phase Gates
        if (newOrder > currentOrder) {
            // Check incomplete subtasks
            const incompleteInCurrent = (task.subtasks || []).filter(s => s.phase === currentPhase && !s.isCompleted);
            if (incompleteInCurrent.length > 0) {
                setShowPhaseWarning(newPhase);
                return;
            }

            // Check Team Lead Sign-off for transition to P3
            if (newPhase === AuditPhase.REVIEW_AND_CONCLUSION && !task.teamLeadApprovedAt) {
                setShowPhaseWarning(newPhase); // Re-use warning system for sign-offs
                return;
            }
        }

        // ── Phase-Status Normalization: Onboarding doesn't show Under Review ──
        if (newPhase === AuditPhase.ONBOARDING && watch('status') === TaskStatus.UNDER_REVIEW) {
            setValue('status', TaskStatus.IN_PROGRESS);
            onChange({ status: TaskStatus.IN_PROGRESS });
        }

        setValue('auditPhase', newPhase);
        setShowPhaseWarning(null);
    };

    const handleFrameworkSelect = (tType: TaskType) => {
        const applyFramework = () => {
            const updates: Partial<Task> = { taskType: tType, linkedFolderId: undefined };
            setValue('taskType', tType);

            // Auto-assign Partner based on Client if available
            const clientId = watch('clientId');
            if (clientId) {
                const client = clientsList.find(c => c.id === clientId);
                if (client?.signingAuthorityId) {
                    setValue('signingPartnerId', client.signingAuthorityId);
                    updates.signingPartnerId = client.signingAuthorityId;
                }
            }

            // NOTE: Automatic subtask population is removed as per user request.
            // Templates should now be used manually via the "Templates" button.
            onChange(updates);
        };

        if (task.subtasks && task.subtasks.length > 0) {
            openModal('CONFIRMATION', {
                title: 'Change Engagement Framework',
                message: `Change framework to ${TASK_TYPE_LABELS[tType]}? This will not remove your current subtasks, but will update the available templates.`,
                confirmLabel: 'Confirm Change',
                variant: 'indigo',
                onConfirm: applyFramework
            });
        } else {
            applyFramework();
        }
    };

    const handleUpdateSubtaskAssignee = (subtaskId: string, staffIds: string[]) => {
        const updated = [...(task.subtasks || [])];
        const idx = updated.findIndex(u => u.id === subtaskId);
        if (idx > -1) {
            updated[idx] = { ...updated[idx], assignedTo: staffIds };
            onChange({ subtasks: updated });
        }
    };

    const renderSubtask = (st: SubTask, index: number) => {
        const pLabel = st.phase ? PHASE_LABELS[st.phase as AuditPhase] : null;
        const hasQuery = st.queryStatus === 'OPEN';
        const isResolved = st.queryStatus === 'RESOLVED';
        const isCleared = st.queryStatus === 'CLEARED';

        // Fix Duplicate Key Error: Use index as fallback if ID is missing or non-unique
        const uniqueKey = st.id || `st-fallback-${index}`;

        return (
            <div key={uniqueKey} className={`flex flex-col gap-1.5 px-4 py-2.5 rounded-xl transition-all duration-300 group/st ${st.isNew ? 'bg-brand-500/10 border-brand-500/20' : 'hover:bg-white/[0.04] border-white/5'} border ${hasQuery ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <button
                            onClick={() => toggleSubtask(st.id)}
                            className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${st.isCompleted ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : 'border-slate-600 hover:border-slate-500'}`}
                        >
                            {st.isCompleted && <Check size={12} strokeWidth={4} />}
                        </button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {st.reference && (
                                <span className="px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 text-[9px] font-black uppercase tracking-widest whitespace-nowrap border border-brand-500/10">
                                    {st.reference}
                                </span>
                            )}
                            <span className={`text-[12.5px] font-medium leading-snug ${st.isCompleted ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                                {st.title}
                            </span>
                            {st.isEvidenceMandatory && (
                                <span title="Evidence Mandatory" className="flex items-center gap-1 text-rose-400 text-[9px] font-black uppercase tracking-tight whitespace-nowrap">
                                    <ShieldAlert size={10} /> REQ
                                </span>
                            )}
                            {st.sopUrl && (
                                <a href={st.sopUrl} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300 transition-colors" title="View SOP">
                                    <ExternalLink size={12} />
                                </a>
                            )}
                            {isCleared && (
                                <span className="flex items-center gap-1 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                                    <CheckCircle2 size={10} /> Cleared
                                </span>
                            )}
                        </div>

                        {st.minimumRequirement && !st.isCompleted && (
                            <p className="text-[10px] text-gray-600 font-medium italic opacity-60 mt-0.5">"{st.minimumRequirement}"</p>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover/st:opacity-100 transition-opacity flex-shrink-0">
                        {(user?.role === 'ADMIN' || user?.uid === task.engagementReviewerId || user?.uid === task.signingPartnerId) && !isCleared && (
                            <button
                                onClick={() => {
                                    const comment = prompt("Enter Review Note / Query:");
                                    if (comment) handleSubtaskAction(st.id, 'RAISE_QUERY', comment);
                                }}
                                className="p-1 px-1.5 text-amber-500 hover:bg-amber-500/10 rounded transition-all"
                                title="Query"
                            >
                                <AlertTriangle size={13} />
                            </button>
                        )}
                        {hasQuery && (user?.uid === task.assignedTo?.[0] || user?.role === 'ADMIN' || (Array.isArray(st.assignedTo) && st.assignedTo.includes(user?.uid || ''))) && (
                            <button
                                onClick={() => {
                                    const reply = prompt("Enter Response to Query:");
                                    if (reply) handleSubtaskAction(st.id, 'REPLY', reply);
                                }}
                                className="p-1 px-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded transition-all"
                                title="Reply to Query"
                            >
                                <ClipboardCheck size={13} />
                            </button>
                        )}
                        {isResolved && (user?.role === 'ADMIN' || user?.uid === task.engagementReviewerId || user?.uid === task.signingPartnerId) && (
                            <button
                                onClick={() => handleSubtaskAction(st.id, 'CLEAR')}
                                className="p-1 px-1.5 text-brand-500 hover:bg-brand-500/10 rounded transition-all"
                                title="Clear Query"
                            >
                                <Award size={13} />
                            </button>
                        )}
                        <button onClick={() => onRemoveSubtaskLocal(st.id)} className="text-gray-700 hover:text-rose-400 p-1 px-1.5 transition-all">
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>

                {/* Multi-Assignee Section */}
                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em]">Requirement Assignees</span>
                        {Array.isArray(st.assignedTo) && st.assignedTo.length > 0 && (
                            <span className="text-[8px] font-bold text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded uppercase tracking-widest">
                                {st.assignedTo.length} Assigned
                            </span>
                        )}
                    </div>
                    <div className="w-full min-w-0">
                        <StaffSelect
                            users={usersList}
                            value={Array.isArray(st.assignedTo) ? st.assignedTo : (st.assignedTo ? [st.assignedTo] : [])}
                            onChange={(val) => handleUpdateSubtaskAssignee(st.id, val as string[])}
                            placeholder="Assign staff members..."
                            multi
                            compact
                        />
                    </div>
                </div>

                {/* Evidence Requirement Box */}
                {!st.isCompleted && st.isEvidenceMandatory && !st.evidenceProvided && (
                    <div className="mt-1.5 p-2 rounded-xl border bg-rose-500/5 border-rose-500/20 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-1 border border-rose-500/20 px-2 py-0.5 rounded bg-rose-500/10">
                                <ShieldAlert size={10} /> Evidence
                            </span>
                            <div className="flex-1 flex gap-2">
                                <input
                                    type="text"
                                    id={`evidence-${st.id}`}
                                    placeholder="Enter Voucher #, Doc Ref..."
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[11px] text-white focus:outline-none focus:border-rose-500/50 shadow-inner"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value;
                                            if (val.trim()) toggleSubtask(st.id, val.trim());
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Display Evidence if Provided */}
                {st.evidenceProvided && st.evidenceText && (
                    <div className="mt-1.5 p-2 rounded-xl border bg-emerald-500/5 border-emerald-500/20 flex items-center gap-2">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest whitespace-nowrap bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Evidenced
                        </span>
                        <div className="text-[10px] text-emerald-100 font-mono bg-black/40 px-2.5 py-0.5 rounded border border-white/5 flex-1 break-all truncate" title={st.evidenceText}>
                            {st.evidenceText}
                        </div>
                        <button onClick={() => {
                            const updated = [...(task.subtasks || [])];
                            const idx = updated.findIndex(u => u.id === st.id);
                            if (idx > -1) {
                                updated[idx] = { ...st, isCompleted: false, evidenceProvided: false, evidenceText: undefined };
                                onChange({ subtasks: updated });
                            }
                        }} className="text-gray-600 hover:text-rose-400 p-1 transition-all">
                            <Trash2 size={10} />
                        </button>
                    </div>
                )}

                {/* Query Conversation Box */}
                {(hasQuery || isResolved || isCleared) && (
                    <div className={`mt-1.5 p-2 rounded-xl border ${hasQuery ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/5'} space-y-1`}>
                        <div className="flex items-start gap-2">
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-0.5 whitespace-nowrap">Reviewer:</span>
                            <p className="text-[10px] text-gray-400 italic">"{st.queryComment}"</p>
                        </div>
                        {st.queryReply && (
                            <div className="flex items-start gap-2 pt-1.5 border-t border-white/5">
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5 whitespace-nowrap">Staff:</span>
                                <p className="text-[10px] text-gray-300">"{st.queryReply}"</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const handleImportTemplate = (template: any) => {
        if (!importPhase) return;

        let newSubtasks: SubTask[] = [];

        // 1. Check for structured subtaskDetails (The New Format - Support ALL Phases)
        if (template.subtaskDetails && Array.isArray(template.subtaskDetails)) {
            // Unify logic: Import all items regardless of phase if more than one phase is present
            const allPhasesInTemplate = new Set(template.subtaskDetails.map((s: any) => s.phase));
            const isComprehensiveMapping = allPhasesInTemplate.size > 1;

            const itemsToInclude = isComprehensiveMapping 
                ? template.subtaskDetails // Import the whole protocol
                : template.subtaskDetails.filter((st: any) => st.phase === importPhase); // Fallback to current phase

            newSubtasks = itemsToInclude.map((st: any) => ({
                id: Math.random().toString(36).substring(2, 9),
                title: st.title,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                createdBy: user?.displayName || 'System',
                phase: st.phase || importPhase, // Respect template phase or fallback to import context
                isNew: true
            }));

            if (isComprehensiveMapping) {
                toast.success(`Comprehensive Protocol Integrated: All phases populated.`, { icon: '🔄' });
            }
        }

        // 2. Fallback to parsing text content (Legacy Format - Context Aware)
        if (newSubtasks.length === 0 && template.content) {
            let items: string[] = [];
            try {
                const trimmed = template.content.trim();
                if (trimmed.startsWith('[')) {
                    items = JSON.parse(trimmed);
                } else {
                    items = trimmed.split('\n').map((line: string) => line.trim().replace(/^[-*]\s*/, '')).filter(Boolean);
                }
            } catch {
                items = [template.content.toString()];
            }

            newSubtasks = items.map(item => ({
                id: Math.random().toString(36).substring(2, 9),
                title: String(item),
                isCompleted: false,
                createdAt: new Date().toISOString(),
                createdBy: user?.displayName || 'System',
                phase: importPhase,
                isNew: true
            }));
        }

        if (newSubtasks.length > 0) {
            onChange({ subtasks: [...(task.subtasks || []), ...newSubtasks] });
            if (newSubtasks.length > 0 && !toast.loading) {
                toast.success(`Imported ${newSubtasks.length} requirements into engagement workspace`, { icon: '📥' });
            }
        } else {
            toast.error(`No protocol items found for this template mapping.`, { icon: '⚠️' });
        }

        setImportPhase(null);
    };

    const selectClass = "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 transition-all text-[13px] text-left text-gray-200 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none cursor-pointer";

    // Helper to render Approval UI
    const ApprovalAction = ({ role, assignedId, approvedAt }: { role: 'TL' | 'ER' | 'SP', assignedId?: string, approvedAt?: string }) => {
        if (approvedAt) {
            return (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Verified</span>
                </div>
            );
        }

        const isAuthorized = user?.uid === assignedId || user?.role === 'ADMIN';
        if (!isAuthorized) {
            return (
                <div className="flex items-center gap-1.5 text-[9px] text-gray-600 uppercase tracking-widest font-black px-1.5">
                    <History size={12} /> Pending
                </div>
            );
        }

        return (
            <button
                onClick={(e) => { e.preventDefault(); handleApprove(role); }}
                className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-emerald-500/20 border border-amber-500/30 hover:border-emerald-500/30 px-3 py-1 rounded-full text-amber-400 hover:text-emerald-400 text-[9px] font-black uppercase tracking-widest transition-all shadow-lg"
            >
                <Unlock size={11} /> Sign-off
            </button>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
                        onClick={handleCloseAttempt}
                    />

                    {/* XL Modal Expansion: 1280px */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="relative w-full max-w-[1280px] max-h-[90vh] bg-[#0c0c0f] shadow-2xl border border-white/[0.08] rounded-2xl flex flex-col overflow-hidden z-50"
                    >
                        {/* Status color bar */}
                        <div className={`h-0.5 w-full ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' :
                                task.status === TaskStatus.HALTED ? 'bg-rose-500' :
                                    task.status === TaskStatus.IN_PROGRESS ? 'bg-amber-500' :
                                        task.status === TaskStatus.UNDER_REVIEW ? 'bg-amber-500' : 'bg-gray-600'
                            }`} />

                        {/* Header — slim */}
                        <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex justify-between items-center bg-[#0c0c0f]">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                                    {isEditMode ? <Edit2 size={14} className="text-amber-400" /> : <Plus size={14} className="text-amber-400" />}
                                </div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest">
                                    {isEditMode ? 'Edit Assignment' : 'New Assignment'}
                                </h3>
                                {isEditMode && task.id && (
                                    <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-0.5 rounded tracking-tighter">#{task.id.substring(0, 8).toUpperCase()}</span>
                                )}
                            </div>
                            <button
                                onClick={handleCloseAttempt}
                                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-all border border-white/5"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Content Layout */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#080a0c]">

                            {/* Left Column (Main Properties & Details) */}
                            <div className="flex-1 overflow-y-auto px-8 py-6 md:px-12 border-r border-white/5 flex flex-col gap-6">
                                <div className="max-w-4xl w-full mx-auto flex flex-col gap-6">


                                    {/* ── PHASE PROGRESS TRACKER ── */}
                                    <div className="w-full py-4 px-2">
                                        <div className="flex items-center justify-between relative">
                                            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/5 -translate-y-1/2 z-0" />
                                            <div
                                                className="absolute top-1/2 left-0 h-[2px] bg-gradient-to-r from-emerald-500 via-amber-500 to-brand-500 -translate-y-1/2 z-0 transition-all duration-1000"
                                                style={{
                                                    width: watch('auditPhase') === AuditPhase.ONBOARDING ? '25%' :
                                                        watch('auditPhase') === AuditPhase.PLANNING_AND_EXECUTION ? '65%' : '100%'
                                                }}
                                            />

                                            {[
                                                { id: AuditPhase.ONBOARDING, label: 'Onboarding', icon: <Sparkles size={16} />, color: 'emerald' },
                                                { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Execution', icon: <Activity size={16} />, color: 'amber' },
                                                { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Conclusion', icon: <CheckCircle2 size={16} />, color: 'brand' }
                                            ].map((p) => {
                                                const isActive = watch('auditPhase') === p.id;
                                                const isCompleted = (watch('auditPhase') === AuditPhase.PLANNING_AND_EXECUTION && p.id === AuditPhase.ONBOARDING) ||
                                                    (watch('auditPhase') === AuditPhase.REVIEW_AND_CONCLUSION && (p.id === AuditPhase.ONBOARDING || p.id === AuditPhase.PLANNING_AND_EXECUTION));

                                                return (
                                                    <div key={p.id} className="relative z-10 flex flex-col items-center group">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); handlePhaseSwitch(p.id); }}
                                                            className={`w-12 h-12 rounded-[20px] flex items-center justify-center border-2 transition-all duration-500 ${isActive ? `bg-navy-900 border-${p.color}-500 shadow-xl shadow-${p.color}-500/20 scale-110` :
                                                                    isCompleted ? `bg-${p.color}-500 border-${p.color}-500 text-black` : 'bg-navy-950 border-white/10 text-gray-600 hover:border-white/30'
                                                                }`}>
                                                            {isCompleted ? <Check size={20} strokeWidth={4} /> : p.icon}
                                                        </button>
                                                        <span className={`absolute -bottom-8 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-colors duration-300 ${isActive ? `text-${p.color}-400` : 'text-gray-600'}`}>
                                                            {p.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ── Assignment Name (4xl Title) ── */}
                                    <div className="group mt-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Assignment Name</label>
                                        </div>
                                        <input
                                            autoFocus
                                            className={`w-full bg-transparent text-3xl font-black ${errors.title ? 'text-rose-400' : 'text-white'} placeholder:text-navy-900 focus:outline-none border-none px-0 transition-all tracking-tighter`}
                                            placeholder="Audit engagement title..."
                                            {...register('title')}
                                        />
                                        <div className={`w-full h-px mt-4 ${errors.title ? 'bg-rose-500/50' : 'bg-white/10'} group-focus-within:bg-brand-500/40 transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.5)]`} />
                                        {errors.title && <p className="text-rose-400 text-[10px] font-bold mt-2 uppercase tracking-widest px-1">{errors.title.message}</p>}
                                    </div>


                                    {/* ── FRAMEWORK SELECTOR: Premium Selection UI ── */}
                                    <div className="space-y-6 pt-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-6 bg-emerald-500/40 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)]" />
                                            <ShieldCheck size={18} className="text-emerald-400" />
                                            <label className="text-sm font-black text-gray-400 uppercase tracking-[0.25em]">Engagement Framework</label>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Object.values(TaskType)
                                                .filter(t => t !== TaskType.OTHER)
                                                .map((tType) => {
                                                    const isSelected = task.taskType === tType;
                                                const label = TASK_TYPE_LABELS[tType];
                                                const iconName = TASK_TYPE_ICONS[tType] || 'FolderOpen';

                                                // Intelligence: Use theme-aware solid colors for selected state
                                                const selectedClasses = tType === TaskType.GENERAL
                                                    ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/30'
                                                    : 'bg-brand-600 text-white border-brand-400 shadow-lg shadow-brand-600/20 ring-1 ring-brand-400/30';

                                                return (
                                                    <button
                                                        key={tType}
                                                        onClick={(e) => { e.preventDefault(); handleFrameworkSelect(tType); }}
                                                        className={`p-3.5 rounded-2xl border transition-all flex items-center text-left gap-3.5 group relative h-[72px] ${isSelected ? selectedClasses : 'bg-white/[0.03] border-white/5 hover:border-emerald-500/20 hover:bg-white/[0.05]'
                                                            }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${isSelected
                                                                ? (tType === TaskType.GENERAL ? 'bg-black/10 text-black' : 'bg-white/10 text-white')
                                                                : 'bg-white/5 text-gray-500 group-hover:text-emerald-400/70 group-hover:bg-emerald-500/5'
                                                            }`}>
                                                            {ICON_MAP[iconName] ? React.cloneElement(ICON_MAP[iconName], { size: 15 }) : <FolderOpen size={15} />}
                                                        </div>
                                                        <span className={`text-[11px] font-black leading-tight flex-1 uppercase tracking-tight line-clamp-2 ${isSelected ? (tType === TaskType.GENERAL ? 'text-black' : 'text-white') : 'text-gray-400 group-hover:text-gray-300'
                                                            }`}>
                                                            {label}
                                                        </span>
                                                        {isSelected && (
                                                            <div className={`absolute right-3 w-2 h-2 rounded-full ${tType === TaskType.GENERAL ? 'bg-black/60' : 'bg-white/60'} shadow-md`} />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>


                                    {/* ── Properties Grid ── */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2 py-4 border-y border-white/5 bg-white/[0.01] rounded-2xl px-6 relative z-[20]">
                                        <Field label="Target Client" icon={<Briefcase size={14} className="text-brand-400" />} error={!!errors.clientId} className="relative z-[30]">
                                            <Controller name="clientId" control={control} render={({ field }) => (
                                                <ClientSelect clients={clientsList} value={field.value} onChange={field.onChange} />
                                            )} />
                                        </Field>

                                        <Field label="Assignment Status" icon={<Activity size={14} className="text-brand-400" />} error={!!errors.status}>
                                            <select className={selectClass} {...register('status')}>
                                                {Object.values(TaskStatus).map(s => (
                                                    <option key={s} value={s} className="bg-navy-900 font-bold uppercase">{s.replace('_', ' ')}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        <Field label="Priority Level" icon={<AlertTriangle size={14} className="text-brand-400" />} error={!!errors.priority}>
                                            <select className={selectClass} {...register('priority')}>
                                                {Object.values(TaskPriority).map(p => (
                                                    <option key={p} value={p} className="bg-navy-900 font-bold uppercase">{p}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        <Field label="Fiscal Year (BS)" icon={<Calendar size={14} className="text-brand-400" />} error={!!errors.fiscalYear}>
                                            <select className={selectClass} {...register('fiscalYear')}>
                                                <option value="" className="bg-navy-900">Select Fiscal Year...</option>
                                                {fiscalYears.map(fy => (
                                                    <option key={fy} value={fy} className="bg-navy-900 font-bold">{fy}</option>
                                                ))}
                                            </select>
                                        </Field>

                                        <Field label="Field Team (Assignees)" icon={<Users size={14} className="text-brand-400" />} className="relative z-[40]">
                                            <Controller name="assignedTo" control={control} render={({ field }) => (
                                                <StaffSelect users={usersList} value={field.value || []} onChange={field.onChange} multi={true} userTasksCount={userTasksCount} />
                                            )} />
                                        </Field>

                                        <div className="col-span-1 lg:col-span-2 pt-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <ShieldCheck size={16} className="text-brand-400" />
                                                <label className="text-[11px] font-black text-gray-500 uppercase tracking-[0.15em]">Audit Review Hierarchy & Sign-off</label>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <Field
                                                    label="Engagement Team Leader"
                                                    icon={<UserCheck size={12} className="text-emerald-400" />}
                                                    extra={<ApprovalAction role="TL" assignedId={watch('teamLeaderId')} approvedAt={watch('teamLeadApprovedAt')} />}
                                                >
                                                    <div className={currentPhase === AuditPhase.PLANNING_AND_EXECUTION ? 'ring-2 ring-emerald-500/20 rounded-xl transition-all' : ''}>
                                                        <Controller name="teamLeaderId" control={control} render={({ field }) => {
                                                            const currentAssignees = watch('assignedTo') || [];
                                                            const filteredLeaderList = usersList.filter(u => currentAssignees.includes(u.uid));
                                                            const isVerified = !!watch('teamLeadApprovedAt');
                                                            return (
                                                                <StaffSelect
                                                                    users={filteredLeaderList}
                                                                    value={field.value || ''}
                                                                    onChange={field.onChange}
                                                                    userTasksCount={userTasksCount}
                                                                    placeholder={currentAssignees.length === 0 ? "Add assignees first..." : "Select Leader..."}
                                                                    disabled={currentAssignees.length === 0 || isVerified}
                                                                />
                                                            );
                                                        }} />
                                                    </div>
                                                </Field>

                                                <Field
                                                    label="Engagement Reviewer"
                                                    icon={<Shield size={12} className="text-amber-400" />}
                                                    extra={<ApprovalAction role="ER" assignedId={watch('engagementReviewerId')} approvedAt={watch('engagementReviewerApprovedAt')} />}
                                                >
                                                    <div className={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION ? 'ring-2 ring-amber-500/20 rounded-xl transition-all' : ''}>
                                                        <Controller name="engagementReviewerId" control={control} render={({ field }) => (
                                                            <StaffSelect
                                                                users={usersList}
                                                                value={field.value || ''}
                                                                onChange={field.onChange}
                                                                userTasksCount={userTasksCount}
                                                                placeholder="Select Reviewer..."
                                                                disabled={!!watch('engagementReviewerApprovedAt')}
                                                            />
                                                        )} />
                                                    </div>
                                                </Field>

                                                <Field
                                                    label="Signing Person"
                                                    icon={<ShieldAlert size={12} className="text-brand-400" />}
                                                    extra={<ApprovalAction role="SP" assignedId={watch('signingPartnerId')} approvedAt={watch('signingPartnerApprovedAt')} />}
                                                >
                                                    <div className={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION ? 'ring-2 ring-brand-500/20 rounded-xl transition-all' : ''}>
                                                        <Controller name="signingPartnerId" control={control} render={({ field }) => (
                                                            <StaffSelect
                                                                users={usersList}
                                                                value={field.value || ''}
                                                                onChange={field.onChange}
                                                                userTasksCount={userTasksCount}
                                                                placeholder="Select Partner..."
                                                                disabled={!!watch('signingPartnerApprovedAt')}
                                                            />
                                                        )} />
                                                    </div>
                                                </Field>
                                            </div>
                                        </div>

                                        <div className="col-span-1 lg:col-span-2 pt-4 border-t border-white/5 mt-2">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <Calendar size={14} className="text-brand-400" />
                                                    <label className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Assignment Timeline</label>
                                                </div>
                                                <div className="flex bg-white/5 p-1 rounded-lg border border-white/5 h-[28px] overflow-hidden">
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); setDateMode('AD'); }}
                                                        className={`px-3 flex items-center justify-center rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${dateMode === 'AD' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                                    >AD</button>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.preventDefault(); setDateMode('BS'); }}
                                                        className={`px-3 flex items-center justify-center rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${dateMode === 'BS' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                                    >BS</button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6 pb-2">
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between ml-1">
                                                        <span className="text-[10px] font-black text-navy-800 uppercase tracking-[0.1em]">Launch Date</span>
                                                        <Controller name="startDate" control={control} render={({ field }) => (
                                                            field.value ? <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter">BS: {convertADToBS(field.value)}</span> : <span />
                                                        )} />
                                                    </div>
                                                    <Controller name="startDate" control={control} render={({ field }) => (
                                                        dateMode === 'BS' ? (
                                                            <NepaliDatePicker 
                                                                value={field.value || ''} 
                                                                onChange={(ad) => field.onChange(ad)} 
                                                                className="w-full"
                                                            />
                                                        ) : (
                                                            <input type="date" value={field.value || ''} onChange={field.onChange} className={`${selectClass} font-mono`} />
                                                        )
                                                    )} />
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between ml-1">
                                                        <span className="text-[10px] font-black text-navy-800 uppercase tracking-[0.1em]">Deadline</span>
                                                        <Controller name="dueDate" control={control} render={({ field }) => (
                                                            field.value ? <span className="text-[9px] font-bold text-brand-500 uppercase tracking-tighter">BS: {convertADToBS(field.value)}</span> : <span />
                                                        )} />
                                                    </div>
                                                    <Controller name="dueDate" control={control} render={({ field }) => (
                                                        dateMode === 'BS' ? (
                                                            <NepaliDatePicker 
                                                                value={field.value || ''} 
                                                                onChange={(ad) => field.onChange(ad)} 
                                                                className="w-full"
                                                            />
                                                        ) : (
                                                            <input type="date" value={field.value || ''} onChange={field.onChange} className={`${selectClass} font-mono`} />
                                                        )
                                                    )} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── ENGAGEMENT FINDINGS (AUDIT OBSERVATIONS) ── */}
                                    <div className="space-y-6 pt-6 border-t border-white/5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                                                    <FileSearch size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Engagement Findings</h3>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Formal observations & Draft Management Letter items</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.preventDefault(); handleAddObservation(); }}
                                                className="px-4 py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-[10px] font-black uppercase tracking-widest border border-brand-500/20 rounded-xl transition-all flex items-center gap-2"
                                            >
                                                <Plus size={14} /> Log Finding
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {(task.observations || []).length > 0 ? (
                                                (task.observations || []).map((obs) => (
                                                    <div key={obs.id} className="relative p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.04] transition-all group/obs">
                                                        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/40 rounded-l-2xl" />
                                                        
                                                        <div className="flex justify-between items-start mb-5 pl-2">
                                                            <div className="flex-1">
                                                                <input
                                                                    value={obs.title}
                                                                    onChange={(e) => handleUpdateObservation(obs.id, { title: e.target.value })}
                                                                    className="w-full bg-transparent border-none text-[13px] font-black text-white uppercase tracking-tight focus:outline-none placeholder:text-gray-700"
                                                                    placeholder="Observation Title (e.g., Missing Controls in Procurement)"
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <select
                                                                    value={obs.severity}
                                                                    onChange={(e) => handleUpdateObservation(obs.id, { severity: e.target.value as any })}
                                                                    className="bg-navy-900/50 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest px-3 py-1.5 text-gray-400 focus:outline-none hover:border-white/20 transition-all"
                                                                >
                                                                    <option value="LOW">Low</option>
                                                                    <option value="MEDIUM">Medium</option>
                                                                    <option value="HIGH">High</option>
                                                                    <option value="CRITICAL">Critical</option>
                                                                </select>
                                                                <button onClick={() => handleRemoveObservation(obs.id)} className="p-1.5 text-gray-600 hover:text-rose-400 transition-colors bg-white/5 rounded-lg hover:bg-rose-500/10">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-2">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Condition</label>
                                                                <textarea
                                                                    value={obs.observation}
                                                                    onChange={(e) => handleUpdateObservation(obs.id, { observation: e.target.value })}
                                                                    className="w-full bg-navy-950/40 border border-white/5 rounded-2xl p-4 text-[11px] text-gray-300 focus:outline-none focus:border-brand-500/30 min-h-[90px] resize-none leading-relaxed placeholder:text-gray-700"
                                                                    placeholder="Describe what was found..."
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Criteria / Risk</label>
                                                                <textarea
                                                                    value={obs.implication}
                                                                    onChange={(e) => handleUpdateObservation(obs.id, { implication: e.target.value })}
                                                                    className="w-full bg-navy-950/40 border border-white/5 rounded-2xl p-4 text-[11px] text-gray-300 focus:outline-none focus:border-brand-500/30 min-h-[90px] resize-none leading-relaxed placeholder:text-gray-700"
                                                                    placeholder="Why does this matter? What is the risk?"
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Recommendation</label>
                                                                <textarea
                                                                    value={obs.recommendation}
                                                                    onChange={(e) => handleUpdateObservation(obs.id, { recommendation: e.target.value })}
                                                                    className="w-full bg-navy-950/40 border border-white/5 rounded-2xl p-4 text-[11px] text-gray-300 focus:outline-none focus:border-brand-500/30 min-h-[90px] resize-none leading-relaxed placeholder:text-gray-700"
                                                                    placeholder="What should the client do?"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[32px] text-gray-700 bg-white/[0.01]">
                                                    <ClipboardCheck size={32} className="mb-3 opacity-10" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">No observations cataloged for this engagement</p>
                                                    <p className="text-[9px] mt-1 uppercase tracking-widest opacity-40">Findings logged here will populate the draft Management Letter.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* XL Sidebar Expansion: 520px */}
                            <div className="w-full md:w-[520px] flex flex-col bg-black/10 relative z-[10] border-l border-white/5 overflow-y-auto custom-scrollbar">
                                <div className="shrink-0 px-8 py-10 border-b border-white/5">
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-black text-gray-500 uppercase tracking-[0.25em]">Audit Protocols (Cumulative View)</label>
                                                {watch('taskType') && (
                                                    <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-tight">Active: {TASK_TYPE_LABELS[watch('taskType') as TaskType]}</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => { e.preventDefault(); setImportPhase(currentPhase); }}
                                                className="text-[11px] font-black text-white uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/20"
                                            >
                                                Templates
                                            </button>
                                        </div>


                                        {/* Phase Picker (Compact Toggle) */}
                                        <div className="flex p-1.5 bg-navy-950/40 rounded-2xl border border-white/5 shadow-inner">
                                            {[
                                                { id: AuditPhase.ONBOARDING, label: 'Onboarding', icon: <Sparkles size={13} /> },
                                                { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Execution', icon: <Activity size={13} /> },
                                                { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Conclusion', icon: <CheckCircle2 size={13} /> }
                                            ].map((phase) => {
                                                const isActive = (watch('auditPhase') === phase.id);
                                                return (
                                                    <button
                                                        key={phase.id}
                                                        onClick={(e) => { e.preventDefault(); handlePhaseSwitch(phase.id); }}
                                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black transition-all ${isActive ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 scale-[1.02]' : 'text-gray-500 hover:bg-white/5'}`}
                                                    >
                                                        {phase.icon} <span className="hidden sm:inline">{phase.label}</span> <span className="sm:hidden">{PHASE_LABELS[phase.id]}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            {/* PHASE TRANSITION WARNING BANNER */}
                                            <AnimatePresence>
                                                {showPhaseWarning && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="bg-amber-500 rounded-2xl p-4 overflow-hidden shadow-2xl shadow-amber-500/20 relative group"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-black/10 rounded-xl text-navy-950">
                                                                <AlertTriangle size={18} />
                                                            </div>
                                                            <div className="flex-1 space-y-1">
                                                                <p className="text-[11px] font-black text-navy-950 uppercase tracking-tight">
                                                                    {(!task.teamLeadApprovedAt && showPhaseWarning === AuditPhase.REVIEW_AND_CONCLUSION) ? 'Sign-off Required' : 'Phase Transition Blocked'}
                                                                </p>
                                                                <p className="text-[10px] text-navy-950/80 font-bold leading-relaxed">
                                                                    {(!task.teamLeadApprovedAt && showPhaseWarning === AuditPhase.REVIEW_AND_CONCLUSION)
                                                                        ? 'The Execution phase must be finalized and signed off by the Team Leader before moving to Conclusion.'
                                                                        : `One or more requirements in ${PHASE_LABELS[currentPhase]} are still pending. Complete them to maintain audit integrity.`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 flex gap-2">
                                                            <button
                                                                onClick={() => { setValue('auditPhase', showPhaseWarning); setShowPhaseWarning(null); }}
                                                                className="flex-1 py-2 bg-navy-950 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-navy-900 transition-colors"
                                                            >
                                                                Proceed Anyway
                                                            </button>
                                                            <button
                                                                onClick={() => setShowPhaseWarning(null)}
                                                                className="px-4 py-2 bg-white/20 text-navy-950 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white/30 transition-colors"
                                                            >
                                                                Fix / Sign-off
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {[AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION].map((phase, idx) => {
                                                const phaseSubtasks = filteredSubtasks.filter(s => s.phase === phase);
                                                if (phaseSubtasks.length === 0) return null;
                                                return (
                                                    <div key={phase} className="space-y-3 mb-6 bg-white/[0.01] p-1 rounded-2xl border border-white/[0.02]">
                                                        <div className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] rounded-xl border border-white/5 mx-1 my-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1 h-3 bg-brand-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                                                                <span className="text-[10px] font-black text-gray-200 uppercase tracking-[0.2em]">
                                                                    Phase {idx + 1}: {PHASE_LABELS_FULL[phase as AuditPhase]}
                                                                </span>
                                                            </div>
                                                            <div className="h-px bg-white/10 flex-1" />
                                                            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">{phaseSubtasks.length} REQUIREMENT{phaseSubtasks.length !== 1 ? 'S' : ''}</span>
                                                        </div>
                                                        <div className="space-y-3 px-1 pb-1">
                                                            {phaseSubtasks.map((st, i) => renderSubtask(st, i))}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Quick Add Subtask */}
                                            <div className="flex gap-2 items-center group/add px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.01] mt-6 focus-within:border-brand-500/30 transition-all shadow-sm">
                                                <Plus size={16} className="text-gray-600 group-hover/add:text-brand-400" />
                                                <input
                                                    type="text"
                                                    value={localSubtaskTitles[currentPhase] || ''}
                                                    onChange={(e) => setLocalSubtaskTitles(prev => ({ ...prev, [currentPhase]: e.target.value }))}
                                                    placeholder={`Add requirement to ${PHASE_LABELS[currentPhase]}...`}
                                                    className="flex-1 bg-transparent text-[13px] text-gray-300 focus:text-white outline-none font-medium placeholder:text-gray-700"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleQuickAddSubtask(currentPhase);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-8 py-10 opacity-40">
                                    {/* Simplified Sidebar Bottom Padding (Resources Hub removed) */}
                                </div>

                            </div>
                        </div>

                        {/* Footer Section */}
                        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-between items-center bg-[#0c0c0f] shrink-0">
                            {isEditMode && canManageTask ? (
                                <button
                                    onClick={() => onDelete(task.id!)}
                                    className="px-4 py-2 text-rose-400 hover:text-rose-300 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 bg-rose-500/5 rounded-xl transition-all border border-rose-500/10 hover:border-rose-500/30"
                                >
                                    <Trash2 size={14} /> Delete Assignment
                                </button>
                            ) : <div />}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCloseAttempt}
                                    className="px-5 py-2.5 text-gray-400 hover:text-white text-[11px] font-black uppercase tracking-widest bg-white/[0.02] rounded-xl transition-all border border-white/5 hover:bg-white/[0.05]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit(handleSave)}
                                    disabled={isSaving}
                                    className="px-8 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-500/20 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {isEditMode ? 'Update Assignment' : 'Create Assignment'}
                                </button>
                            </div>
                        </div>

                        {/* Unsaved changes discard banner */}
                        <AnimatePresence>
                            {showDiscardBanner && (
                                <motion.div
                                    key="discard-banner"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="px-6 py-4 bg-amber-500 border-t border-amber-600 flex items-center justify-between gap-4 z-[60]"
                                >
                                    <div className="flex items-center gap-3 text-navy-950">
                                        <AlertTriangle size={18} className="flex-shrink-0" />
                                        <span className="text-xs font-black uppercase tracking-wider">Unsaved modifications detected. Discard changes?</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => setShowDiscardBanner(false)}
                                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white bg-navy-950/30 hover:bg-navy-950/50 rounded-lg transition-all"
                                        >
                                            Continue Editing
                                        </button>
                                        <button
                                            onClick={() => { setShowDiscardBanner(false); onClose(); }}
                                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all shadow-lg shadow-rose-900/20"
                                        >
                                            Discard
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}

            {/* ── Subtask Template Import Modal ── */}
            <AnimatePresence>
                {importPhase && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-modal rounded-[32px] w-full max-w-2xl border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.8)] flex flex-col max-h-[85vh] overflow-hidden">
                            <div className="px-8 py-6 border-b border-white/10 bg-white/5 flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                                        <Book size={20} className="text-brand-400" />
                                        Import Engagement Protocols
                                    </h3>
                                    <button onClick={() => { setImportPhase(null); setTemplateSearchQuery(''); setShowAllFrameworks(false); }} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"><X size={20} /></button>
                                </div>
                                {/* Search Bar */}
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Search templates..."
                                            value={templateSearchQuery}
                                            onChange={e => setTemplateSearchQuery(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-500/50 focus:bg-white/[0.05] transition-all"
                                        />
                                    </div>
                                    {watch('taskType') && (
                                        <button
                                            onClick={() => setShowAllFrameworks(prev => !prev)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${showAllFrameworks
                                                    ? 'bg-white/5 border-white/10 text-gray-400'
                                                    : 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                                                }`}
                                        >
                                            {showAllFrameworks ? <Eye size={12} /> : <CheckCircle2 size={12} />}
                                            {showAllFrameworks ? 'All Frameworks' : 'Suggested Only'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[#080a0c]">
                                {(() => {
                                    // ── Unified filter logic ──
                                    const q = templateSearchQuery.toLowerCase();
                                    const taskType = watch('taskType');
                                    const matchesFramework = (t: Template) => {
                                        if (showAllFrameworks || !taskType) return true;
                                        return t.taskType === taskType || !t.taskType;
                                    };
                                    const matchesSearch = (t: Template) => {
                                        if (!q) return true;
                                        return t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
                                    };
                                    const filterTemplate = (t: Template) => matchesFramework(t) && matchesSearch(t);

                                    const rootTemplates = templates.filter(t => !t.folderId && filterTemplate(t));
                                    const folderSections = templateFolders
                                        .map(folder => ({
                                            folder,
                                            templates: templates.filter(t => t.folderId === folder.id && filterTemplate(t))
                                        }))
                                        .filter(s => s.templates.length > 0);

                                    const totalVisible = rootTemplates.length + folderSections.reduce((acc, s) => acc + s.templates.length, 0);

                                    if (totalVisible === 0) {
                                        const hasTemplatesAtAll = templates.length > 0;
                                        return (
                                            <div className="text-center py-16 text-gray-600 bg-white/[0.01] rounded-[32px] border border-dashed border-white/5 px-10">
                                                <Book size={48} className="mx-auto mb-6 opacity-20" />
                                                {hasTemplatesAtAll && (templateSearchQuery || (!showAllFrameworks && watch('taskType'))) ? (
                                                    <>
                                                        <p className="font-black text-lg uppercase tracking-tight text-gray-400">No Matching Templates</p>
                                                        <p className="text-xs mt-2 text-gray-600 font-medium">
                                                            {templateSearchQuery ? `No templates match "${templateSearchQuery}".` : `No templates tagged for this engagement framework.`}
                                                        </p>
                                                        {!showAllFrameworks && watch('taskType') && (
                                                            <button onClick={() => setShowAllFrameworks(true)} className="mt-4 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-400 text-[10px] font-black uppercase tracking-widest hover:bg-brand-500/20 transition-all">
                                                                Show All Frameworks
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="font-black text-lg uppercase tracking-tight">No Templates Available</p>
                                                        <p className="text-xs mt-2 text-gray-700 font-medium">Create custom protocol templates in the Resource Library to accelerate your workflow.</p>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    }

                                    const renderTemplateButton = (template: Template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleImportTemplate(template)}
                                            className="flex items-center gap-4 w-full text-left p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-brand-500/10 hover:border-brand-500/30 transition-all group shadow-sm"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/20 transition-colors">
                                                <CheckCircle2 size={16} className="text-gray-500 group-hover:text-brand-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-gray-200 group-hover:text-white uppercase tracking-tight truncate">{template.name}</p>
                                                    {template.taskType && (
                                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-widest whitespace-nowrap">
                                                            {template.taskType.replace(/_/g, ' ')}
                                                        </span>
                                                    )}
                                                </div>
                                                {template.description && <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">{template.description}</p>}
                                                {(template.subtaskDetails?.length || 0) > 0 && (
                                                    <p className="text-[10px] text-gray-700 mt-1">{template.subtaskDetails?.length} checklist item(s)</p>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-black text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity bg-brand-500/10 px-3 py-1.5 rounded-lg border border-brand-500/20 uppercase tracking-widest flex-shrink-0">
                                                Import
                                            </div>
                                        </button>
                                    );

                                    return (
                                        <div className="space-y-8">
                                            {rootTemplates.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <div className="w-1 h-3 bg-brand-500 rounded-full" />
                                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">General Library</h4>
                                                        <span className="text-[9px] text-gray-600 font-bold ml-auto">{rootTemplates.length} template{rootTemplates.length !== 1 ? 's' : ''}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {rootTemplates.map(renderTemplateButton)}
                                                    </div>
                                                </div>
                                            )}
                                            {folderSections.map(({ folder, templates: fTemplates }) => (
                                                <div key={folder.id} className="space-y-3">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <div className="w-1 h-3 rounded-full" style={{ background: folder.color || '#6366f1' }} />
                                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">{folder.name}</h4>
                                                        <span className="text-[9px] text-gray-600 font-bold ml-auto">{fTemplates.length} template{fTemplates.length !== 1 ? 's' : ''}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {fTemplates.map(renderTemplateButton)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
};

export default TaskDetailPane;
