import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye,
    Sparkles, Book, ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen,
    Users, UserCheck, Shield, Lock, Unlock, ExternalLink, History, CloudUpload, FileText,
    MessageSquare, Zap, Settings2
} from 'lucide-react';
import { AppwriteService } from '../../services/appwrite';
import { Task, TaskStatus, TaskPriority, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase, Template, TemplateFolder, TaskType, AuditObservation } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';
import { useModal } from '../../context/ModalContext';
import { KnowledgeService } from '../../services/knowledge';
import { TemplateService } from '../../services/templates';
import { AuditDocService, AuditDocFile } from '../../services/auditDocs';
import { AUDIT_FOLDER_STRUCTURE, AuditFolderKey } from '../../types';
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

    const [activeDetailTab, setActiveDetailTab] = useState<'PROCEDURES' | 'EVIDENCE' | 'OBSERVATIONS' | 'COMMENTS' | 'SETTINGS'>('PROCEDURES');
    const [auditFiles, setAuditFiles] = useState<AuditDocFile[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);
    const [selectedFolderForUpload, setSelectedFolderForUpload] = useState<AuditFolderKey | ''>('');
    const [selectedLineItemForUpload, setSelectedLineItemForUpload] = useState('');

    const descRef = useRef<HTMLTextAreaElement | null>(null);

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            title: task.title || '',
            clientId: task.clientIds?.[0] || task.clientId || '',
            fiscalYear: task.fiscalYear || '',
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

    const watchedClientId = watch('clientId');
    const watchedFiscalYear = watch('fiscalYear');

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

    // Real-time Evidence Synchronization: Refresh repository when Client or FY changes in form
    useEffect(() => {
        if (isOpen && watchedClientId && watchedFiscalYear) {
            const syncFiles = async () => {
                setIsLoadingDocs(true);
                try {
                    const files = await AuditDocService.getAllFiles(watchedClientId, watchedFiscalYear);
                    setAuditFiles(files);
                } catch (e) {
                    console.error("Auto-syncing audit files failed", e);
                } finally {
                    setIsLoadingDocs(false);
                }
            };
            syncFiles();
        } else if (isOpen && (!watchedClientId || !watchedFiscalYear)) {
            setAuditFiles([]);
        }
    }, [isOpen, watchedClientId, watchedFiscalYear]);

    const loadAuditFiles = async () => {
        if (!watchedClientId || !watchedFiscalYear) return;
        setIsLoadingDocs(true);
        try {
            const files = await AuditDocService.getAllFiles(watchedClientId, watchedFiscalYear);
            setAuditFiles(files);
        } catch (e) {
            console.error("Manual reload of audit files failed", e);
        } finally {
            setIsLoadingDocs(false);
        }
    };

    const handleFileUpload = async (files: FileList | null, subtaskId?: string) => {
        if (!files || files.length === 0) return;
        
        // Use watched form values as they represent the current UI state
        const watchedClientId = watch('clientId');
        const watchedFiscalYear = watch('fiscalYear');
        const selectedClient = clientsList.find(c => c.id === watchedClientId);
        
        // Default folder B for procedures, otherwise use selected
        const targetFolder = subtaskId ? 'B' : selectedFolderForUpload;
        
        if (!targetFolder) {
            toast.error("Please select a target folder first.");
            return;
        }
        if (!watchedClientId || !watchedFiscalYear) {
            toast.error("Client or Fiscal Year missing. Please select them first.");
            return;
        }

        if (subtaskId) setUploadingSubtaskId(subtaskId);
        else setIsUploadingDoc(true);

        try {
            let uploadedCount = 0;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                await AuditDocService.uploadFile(file, {
                    clientId: watchedClientId,
                    clientName: selectedClient?.name || 'Unknown',
                    fiscalYear: watchedFiscalYear,
                    folderKey: targetFolder as AuditFolderKey,
                    lineItem: selectedLineItemForUpload || undefined,
                    lineItemLabel: selectedLineItemForUpload || undefined,
                    uploadedBy: user?.uid || 'system',
                    uploadedByName: user?.displayName || 'System',
                    taskId: task.id,
                    subtaskId: subtaskId
                });
                uploadedCount++;
            }
            
            toast.success(`${uploadedCount} document(s) synchronized.`);
            
            // Reload files only if we have the needed info
            if (watchedClientId && watchedFiscalYear) {
                const files = await AuditDocService.getAllFiles(watchedClientId, watchedFiscalYear);
                setAuditFiles(files);
            }
        } catch (e) {
            console.error("Upload failed", e);
            toast.error("Failed to upload documentation.");
        } finally {
            setIsUploadingDoc(false);
            setUploadingSubtaskId(null);
        }
    };

    // Snapshot task state whenever the pane opens
    useEffect(() => {
        if (isOpen) {
            initialTaskRef.current = JSON.parse(JSON.stringify(task));
            setShowDiscardBanner(false);
            setShowPhaseWarning(null);
            reset({
                title: task.title || '',
                clientId: task.clientIds?.[0] || task.clientId || '',
                fiscalYear: task.fiscalYear || '',
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
            if (data.auditPhase !== AuditPhase.REVIEW_AND_CONCLUSION) {
                toast.error("Engagement must be in the Review & Conclusion phase before it can be completed.", { icon: '🔒' });
                return;
            }
            if (!task.teamLeadApprovedAt || !task.engagementReviewerApprovedAt || !task.signingPartnerApprovedAt) {
                toast.error("All three reviewer sign-offs (Team Lead, Engagement Reviewer, Signing Partner) are required to complete this assignment.", { icon: '🔒' });
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
            fiscalYear: data.fiscalYear,
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

    const toggleReviewItem = (id: string) => {
        const updated = [...(task.reviewChecklist || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            updated[idx] = {
                ...updated[idx],
                isCompleted: !updated[idx].isCompleted,
                completedBy: user?.uid,
                completedAt: new Date().toISOString()
            };
            onChange({ reviewChecklist: updated });
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
        // Guard: Prevent re-injecting if the same framework is already selected
        if (tType === task.taskType) return;

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

            // Dynamically inject ONBOARDING subtasks from the Database Template mapping to this TaskType
            let newSubtasks: SubTask[] = [];
            
            // 1. Separate manual subtasks (keep) from auto-generated ones (remove)
            const manualSubtasks = (task.subtasks || []).filter(st => !st.isAutoGenerated);
            const manualTitles = new Set(manualSubtasks.map(st => st.title.toLowerCase().trim()));
            
            const taskTypeTemplates = templates.filter(t => t.taskType === tType);
            taskTypeTemplates.forEach(t => {
                const items = t.subtaskDetails?.filter(sd => sd.phase === AuditPhase.ONBOARDING) || [];
                items.forEach(item => {
                    // Prevent duplicate if a manual subtask with same title already exists
                    if (!manualTitles.has(item.title.toLowerCase().trim())) {
                        newSubtasks.push({
                            id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            title: item.title,
                            isCompleted: false,
                            minimumRequirement: item.minimumRequirement,
                            createdAt: new Date().toISOString(),
                            createdBy: user?.uid || 'system',
                            phase: AuditPhase.ONBOARDING,
                            isAutoGenerated: true,
                            isNew: true
                        });
                        // Add to set to prevent duplicates within this batch too
                        manualTitles.add(item.title.toLowerCase().trim());
                    }
                });
            });

            // Reconstruct subtasks: Manual ones + the NEW auto ones for this framework
            updates.subtasks = [...manualSubtasks, ...newSubtasks];

            // 3. Inject REVIEWER_CHECKLIST items
            let newReviewChecklist: any[] = [];
            const reviewerTemplates = templates.filter(t => t.taskType === tType && t.category === ('REVIEWER_CHECKLIST' as any));
            
            reviewerTemplates.forEach(t => {
                const items = t.subtaskDetails || []; // We use subtaskDetails as the container for checklist items too
                items.forEach(item => {
                    newReviewChecklist.push({
                        id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        title: item.title,
                        minimumRequirement: item.minimumRequirement,
                        isCompleted: false,
                        reviewerRole: t.reviewerRole || 'TL', // Default to TL if not set
                        templateId: t.id
                    });
                });
            });

            updates.reviewChecklist = newReviewChecklist;

            if (newSubtasks.length > 0 && !toast.loading) {
                toast.success(`Framework Active: ${newSubtasks.length} requirements and ${newReviewChecklist.length} review points added.`);
            }

            onChange(updates);
        };

        if (task.subtasks && task.subtasks.length > 0) {
            openModal('CONFIRMATION', {
                title: 'Change Engagement Framework',
                message: `Change framework to ${TASK_TYPE_LABELS[tType]}? This will not remove your current subtasks, but will add new template requirements.`,
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

        // Filter docs for this specific subtask
        const subtaskDocs = auditFiles.filter(f => f.subtaskId === st.id);

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
                        </div>

                        {st.minimumRequirement && !st.isCompleted && (
                            <p className="text-[10px] text-gray-600 font-medium italic opacity-60 mt-0.5">"{st.minimumRequirement}"</p>
                        )}

                        {/* Attached Evidence Pills */}
                        {subtaskDocs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {subtaskDocs.map(doc => (
                                    <a 
                                        key={doc.id}
                                        href={AppwriteService.getFileView(doc.appwriteFileId)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 rounded-md text-brand-400 text-[9px] font-black uppercase tracking-tight hover:bg-brand-500/20 transition-all"
                                    >
                                        <FileText size={10} /> {doc.fileName.length > 15 ? doc.fileName.substring(0, 12) + '...' : doc.fileName}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover/st:opacity-100 transition-opacity flex-shrink-0">
                        {/* Attach Documentation Button */}
                        <label className="p-1 px-1.5 text-gray-500 hover:text-brand-400 rounded transition-all cursor-pointer" title="Attach Documentation">
                            <input 
                                type="file" 
                                className="hidden" 
                                onChange={(e) => handleFileUpload(e.target.files, st.id)}
                                disabled={uploadingSubtaskId === st.id}
                            />
                            {uploadingSubtaskId === st.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        </label>

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

    const userRoleInTask = useMemo(() => {
        if (!user || !task) return null;
        if (user.uid === task.teamLeaderId) return 'TL';
        if (user.uid === task.engagementReviewerId) return 'ER';
        if (user.uid === task.signingPartnerId) return 'SP';
        return null;
    }, [user, task]);

    const renderReviewChecklist = () => {
        const reviewItems = task.reviewChecklist || [];
        if (reviewItems.length === 0) return null;

        // Filter items for the specific reviewer OR show all if ADMIN
        const isAuthorizedReviewer = user?.role === 'ADMIN' || user?.role === 'MASTER_ADMIN' || userRoleInTask !== null;
        if (!isAuthorizedReviewer) return null;

        const isAdmin = user?.role === 'ADMIN' || user?.role === 'MASTER_ADMIN';
        const filteredItems = reviewItems.filter(item => isAdmin || item.reviewerRole === userRoleInTask);

        if (filteredItems.length === 0) return null;

        return (
            <div className="space-y-6 pt-12 border-t border-white/5">
                <div className="flex items-center justify-between pb-4">
                    <div className="flex flex-col gap-2">
                        <h4 className="text-[13px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                            <ShieldCheck className="text-brand-400" size={18} />
                            Review Compliance Checkpoint
                        </h4>
                        <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em]">Enforcing quality standards before final sign-off</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {filteredItems.map((item, idx) => {
                        const isTL = item.reviewerRole === 'TL';
                        const isER = item.reviewerRole === 'ER';
                        const isSP = item.reviewerRole === 'SP';
                        
                        return (
                            <div 
                                key={item.id} 
                                className={`flex items-start gap-5 p-5 rounded-[28px] border transition-all group ${
                                    item.isCompleted 
                                        ? 'bg-[#0c1e18] border-emerald-500/20' 
                                        : 'bg-[#0f1218] border-white/5 hover:border-white/10 shadow-xl'
                                }`}
                            >
                                <button
                                    onClick={() => toggleReviewItem(item.id)}
                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${
                                        item.isCompleted 
                                            ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' 
                                            : 'bg-white/5 text-gray-700 hover:bg-white/10 hover:text-white border border-white/10'
                                    }`}
                                >
                                    {item.isCompleted ? <Check size={20} strokeWidth={4} /> : <div className="w-2.5 h-2.5 rounded-full bg-current opacity-40" />}
                                </button>
                                
                                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${
                                            isTL ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                            isER ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                            'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        }`}>
                                            {item.reviewerRole === 'TL' ? 'Team Lead' : item.reviewerRole === 'ER' ? 'QC Review' : 'Partner Sign-off'}
                                        </span>
                                        <p className={`text-[13px] font-bold truncate uppercase tracking-tight transition-all ${item.isCompleted ? 'text-emerald-400/80 line-through' : 'text-white'}`}>
                                            {item.title}
                                        </p>
                                    </div>
                                    {item.minimumRequirement && !item.isCompleted && (
                                        <p className="text-[10px] text-gray-600 font-medium italic opacity-60 ml-0.5">"{item.minimumRequirement}"</p>
                                    )}
                                    {item.isCompleted && item.completedBy && (
                                        <p className="text-[8px] text-emerald-500/40 font-black uppercase tracking-widest flex items-center gap-2">
                                            <Check size={8} /> Verified by Reviewer at {item.completedAt ? new Date(item.completedAt).toLocaleString() : 'Just now'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
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
    const ApprovalAction = ({ role, assignedId, approvedAt, isInFinalPhase }: { role: 'TL' | 'ER' | 'SP', assignedId?: string, approvedAt?: string, isInFinalPhase: boolean }) => {
        if (approvedAt) {
            return (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} className="text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Verified</span>
                </div>
            );
        }

        if (!isInFinalPhase) {
            return (
                <div className="flex items-center gap-1.5 text-[9px] text-gray-700 uppercase tracking-widest font-black px-1.5">
                    <Lock size={11} className="text-gray-600" /> Phase Locked
                </div>
            );
        }

        const isAuthorized = user?.uid === assignedId || user?.role === 'ADMIN' || user?.role === 'MASTER_ADMIN';
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-[4px]"
                        onClick={handleCloseAttempt}
                    />

                    {/* XL Modal Expansion: 1280px */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="relative w-full max-w-[1440px] h-[95vh] bg-[#0c0e12] shadow-[0_32px_128px_rgba(0,0,0,0.8)] border border-white/[0.08] rounded-[48px] flex flex-col overflow-hidden z-50"
                    >
                        {/* Header — slim */}
                        <div className="shrink-0 px-10 py-6 border-b border-white/[0.04] flex justify-between items-center bg-[#0c0e12]">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shadow-inner">
                                    <Shield size={20} className="text-brand-400" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-[15px] font-black text-white uppercase tracking-[0.3em]">Audit Engagement Workspace</h3>
                                    <div className="flex items-center gap-2.5 mt-1">
                                        <div className={`w-2 h-2 rounded-full ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'}`} />
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{task.status || 'Initializing Workspace'}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleCloseAttempt}
                                className="w-12 h-12 flex items-center justify-center rounded-2xl text-gray-500 hover:text-white hover:bg-white/5 transition-all border border-white/5 active:scale-95 shadow-xl"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* ── Body: Two-Column Layout ── */}
                        <div className="flex-1 flex flex-row overflow-hidden min-h-0">

                                       {/* ── LEFT COLUMN: Persistent Assignment Profile ── */}
                            <div className="w-[340px] lg:w-[460px] border-r border-white/[0.04] bg-[#0f1218]/50 backdrop-blur-3xl flex flex-col overflow-y-auto custom-scrollbar shrink-0 shadow-2xl z-10">
                                <div className="p-12 space-y-12">
                                    
                                    {/* Assignment Name */}
                                    <div className="space-y-4">
                                        <h4 className="text-[11px] font-black text-gray-600 uppercase tracking-[0.4em] flex items-center gap-3 px-1">
                                            <div className="w-1.5 h-4 bg-brand-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.4)]" />
                                            Active Assignment
                                        </h4>
                                        <div className="group space-y-2">
                                            <input
                                                autoFocus
                                                className={`w-full bg-transparent text-2xl font-black ${errors.title ? 'text-rose-400' : 'text-white'} placeholder:text-gray-800 focus:outline-none border-none px-0 transition-all tracking-tighter leading-tight`}
                                                placeholder="Audit engagement title..."
                                                {...register('title')}
                                            />
                                            <div className={`w-full h-px ${errors.title ? 'bg-rose-500/50' : 'bg-white/5'} group-focus-within:bg-brand-500/40 transition-colors shadow-sm`} />
                                        </div>
                                    </div>

                                    {/* Engagement Detail Grids */}
                                    <div className="space-y-10">
                                        <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/[0.04] space-y-8 shadow-inner">
                                            <Field label="Target Client" icon={<Briefcase size={12} className="text-brand-400" />}>
                                                <Controller name="clientId" control={control} render={({ field }) => (
                                                    <ClientSelect clients={clientsList} value={field.value} onChange={field.onChange} />
                                                )} />
                                            </Field>

                                            <div className="grid grid-cols-2 gap-6">
                                                <Field label="Fiscal Year" icon={<Calendar size={12} className="text-emerald-400" />}>
                                                    <select className={selectClass} {...register('fiscalYear')}>
                                                        <option value="" className="bg-navy-900">Select...</option>
                                                        {fiscalYears.map(fy => (
                                                            <option key={fy} value={fy} className="bg-navy-900">{fy}</option>
                                                        ))}
                                                    </select>
                                                </Field>
                                                <Field label="Priority" icon={<Zap size={12} className="text-amber-400" />}>
                                                    <select className={selectClass} {...register('priority')}>
                                                        {Object.values(TaskPriority).map(p => (
                                                            <option key={p} value={p} className="bg-navy-900 font-bold uppercase">{p}</option>
                                                        ))}
                                                    </select>
                                                </Field>
                                            </div>

                                            <Field label="Engagement Status" icon={<Settings2 size={12} className="text-gray-500" />}>
                                                <select className={selectClass} {...register('status')}>
                                                    {Object.values(TaskStatus).map(s => (
                                                        <option key={s} value={s} className="bg-navy-900 uppercase">{s.replace('_', ' ')}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                        </div>

                                        {/* Audit Review Hierarchy & Sign-offs — Final Phase Only */}
                                        <div className="space-y-8">
                                            <h4 className="text-[11px] font-black text-gray-600 uppercase tracking-[0.4em] flex items-center gap-3 px-1 pt-4">
                                                <div className="w-1.5 h-4 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.4)]" />
                                                Quality Control
                                            </h4>

                                            {currentPhase !== AuditPhase.REVIEW_AND_CONCLUSION && (
                                                <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                                                    <Lock size={14} className="text-amber-500/60 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest">Sign-offs Locked</p>
                                                        <p className="text-[10px] text-gray-600 mt-1">Reviewer sign-offs are only available in the <span className="text-amber-400 font-bold">Review &amp; Conclusion</span> phase. Assign reviewers now and sign-offs will unlock when the engagement advances.</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-6">
                                                <Field label="Staff Team Assigned" icon={<Users size={12} className="text-brand-400" />}>
                                                    <Controller name="assignedTo" control={control} render={({ field }) => (
                                                        <StaffSelect users={usersList} value={field.value || []} onChange={field.onChange} multi={true} userTasksCount={userTasksCount} />
                                                    )} />
                                                </Field>

                                                <div className="grid grid-cols-1 gap-5">
                                                    <Field label="Engagement Team Leader" extra={<ApprovalAction role="TL" assignedId={watch('teamLeaderId')} approvedAt={watch('teamLeadApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}>
                                                        <Controller name="teamLeaderId" control={control} render={({ field }) => (
                                                            <StaffSelect users={usersList.filter(u => (watch('assignedTo') || []).includes(u.uid))} value={field.value || ''} onChange={field.onChange} placeholder="Select Team Leader..." disabled={!!watch('teamLeadApprovedAt')} compact />
                                                        )} />
                                                    </Field>

                                                    <Field label="Quality Review Manager" extra={<ApprovalAction role="ER" assignedId={watch('engagementReviewerId')} approvedAt={watch('engagementReviewerApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}>
                                                        <Controller name="engagementReviewerId" control={control} render={({ field }) => (
                                                            <StaffSelect users={usersList} value={field.value || ''} onChange={field.onChange} placeholder="Select Reviewer..." disabled={!!watch('engagementReviewerApprovedAt')} compact />
                                                        )} />
                                                    </Field>
                                                    
                                                    <Field label="Signing Partner" extra={<ApprovalAction role="SP" assignedId={watch('signingPartnerId')} approvedAt={watch('signingPartnerApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}>
                                                        <Controller name="signingPartnerId" control={control} render={({ field }) => (
                                                            <StaffSelect users={usersList} value={field.value || ''} onChange={field.onChange} placeholder="Select Partner..." disabled={!!watch('signingPartnerApprovedAt')} compact />
                                                        )} />
                                                    </Field>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Framework Protocol Selection */}
                                        <div className="pt-12 border-t border-white/[0.04]">
                                            <h4 className="text-[11px] font-black text-gray-700 uppercase tracking-[0.4em] mb-8">Selected Engagement Framework</h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                {Object.values(TaskType).filter(t => t !== TaskType.OTHER).map((tType) => {
                                                    const isSelected = watch('taskType') === tType;
                                                    return (
                                                        <button
                                                            key={tType}
                                                            onClick={(e) => { e.preventDefault(); handleFrameworkSelect(tType); }}
                                                            className={`p-5 rounded-[28px] border transition-all flex items-center text-left gap-5 group ${isSelected ? 'bg-brand-500 border-brand-400 text-white shadow-[0_12px_32px_rgba(99,102,241,0.2)] scale-[1.02]' : 'bg-transparent border-white/5 text-gray-500 hover:border-white/10 hover:bg-white/[0.01]'}`}
                                                        >
                                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-white/20' : 'bg-white/5'}`}>
                                                                {ICON_MAP[TASK_TYPE_ICONS[tType]] || <FolderOpen size={18} />}
                                                            </div>
                                                            <span className={`text-[12px] font-black uppercase tracking-tight leading-tight flex-1 ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>{TASK_TYPE_LABELS[tType]}</span>
                                                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white shadow-lg animate-pulse" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        {/* ── RIGHT COLUMN: Dynamic Feature Tabs ── */}
                        <div className="flex-1 flex flex-col min-w-0 bg-[#080a0e] relative">
                            
                            {/* Dynamic Workspace Top Navigation */}
                            <div className="shrink-0 px-12 py-6 border-b border-white/[0.04] bg-[#0c0e12]/60 backdrop-blur-md flex items-center justify-between z-10 shadow-2xl">
                                <div className="flex bg-white/5 p-1.5 rounded-[28px] border border-white/[0.1]">
                                    {[
                                        { id: 'PROCEDURES', label: 'Procedures', icon: <ClipboardCheck size={18} /> },
                                        { id: 'EVIDENCE', label: 'Evidence Repository', icon: <FileText size={18} /> },
                                        { id: 'OBSERVATIONS', label: 'Engagement Findings', icon: <ShieldAlert size={18} /> },
                                        { id: 'COMMENTS', label: 'Collaborate', icon: <MessageSquare size={18} /> },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={(e) => { e.preventDefault(); setActiveDetailTab(tab.id as any); }}
                                            className={`flex items-center gap-3.5 px-10 py-4 rounded-[22px] text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeDetailTab === tab.id ? 'bg-brand-500 text-white shadow-[0_16px_48px_rgba(99,102,241,0.4)] ring-1 ring-brand-400/30' : 'text-gray-600 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {tab.icon} {tab.label}
                                            {activeDetailTab === tab.id && (
                                                <motion.div layoutId="activeTabBadge" className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0c0e12] shadow-lg" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-5">
                                    <button
                                        onClick={(e) => { e.preventDefault(); setImportPhase(currentPhase); }}
                                        className="px-8 py-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] hover:bg-emerald-500/20 transition-all flex items-center gap-3 group shadow-2xl active:scale-95"
                                    >
                                        <Sparkles size={18} className="group-hover:animate-spin transition-all duration-700" /> Import Protocol
                                    </button>
                                </div>
                            </div>

                            {/* Active Tab View Area */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-12">
                                <div className="max-w-6xl mx-auto pb-48">
                                    
                                    {/* TAB 01: CHECKLISTS & PROCEDURES */}
                                    {activeDetailTab === 'PROCEDURES' && (
                                        <div className="space-y-12">
                                            {/* Header Section */}
                                            <div className="flex flex-col gap-3">
                                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Fieldwork Workpapers</h2>
                                                <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                                    <Activity size={14} className="text-emerald-500" />
                                                    Current Audit Phase: <span className="text-white px-3 py-1 bg-white/5 rounded-full border border-white/10 ml-1">{PHASE_LABELS_FULL[currentPhase]}</span>
                                                </p>
                                            </div>

                                            {/* Specialized Phase Toggle */}
                                            <div className="flex justify-between items-center bg-[#0f1218] p-4 rounded-[40px] border border-white/[0.04] shadow-2xl">
                                                {[
                                                    { id: AuditPhase.ONBOARDING, label: 'Planning & Risk Assessment', icon: <Sparkles size={18} />, color: 'emerald' },
                                                    { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Execution Fieldwork', icon: <Activity size={18} />, color: 'amber' },
                                                    { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Final Reporting & QC', icon: <CheckCircle2 size={18} />, color: 'brand' }
                                                ].map((phase) => (
                                                    <button
                                                        key={phase.id}
                                                        onClick={(e) => { e.preventDefault(); handlePhaseSwitch(phase.id); }}
                                                        className={`flex-1 flex items-center justify-center gap-5 py-6 rounded-[28px] text-[13px] font-black transition-all group ${watch('auditPhase') === phase.id ? 'bg-[#1a1f29] text-white border border-white/10 shadow-2xl scale-[1.03] ring-1 ring-white/5' : 'text-gray-600 hover:text-gray-300'}`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${watch('auditPhase') === phase.id ? `bg-${phase.color}-500/10 text-${phase.color}-400` : 'bg-white/5'}`}>
                                                            {phase.icon}
                                                        </div>
                                                        {phase.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Procedure Workspace */}
                                            <div className="space-y-8">
                                                {filteredSubtasks.length === 0 ? (
                                                    <div className="py-48 flex flex-col items-center justify-center border-2 border-dashed border-white/[0.03] rounded-[80px] bg-white/[0.01] group/empty">
                                                        <div className="w-24 h-24 rounded-[32px] bg-[#0c0e12] flex items-center justify-center mb-10 border border-white/[0.05] group-hover/empty:scale-110 transition-transform duration-500">
                                                            <Book size={48} className="text-gray-800" />
                                                        </div>
                                                        <p className="text-[13px] font-black text-gray-500 uppercase tracking-[0.4em]">No procedures initialized for this phase</p>
                                                        <button onClick={() => setImportPhase(currentPhase)} className="mt-10 px-10 py-4 bg-brand-500 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.25em] hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/30 flex items-center gap-4 active:scale-95">
                                                            <Sparkles size={18} /> Load Global Audit Protocol
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-5">
                                                        {filteredSubtasks.map((st, i) => renderSubtask(st, i))}
                                                    </div>
                                                )}
                                                
                                                {/* REVIEWER COMPLIANCE GATE (Only in Final Phase) */}
                                                {currentPhase === AuditPhase.REVIEW_AND_CONCLUSION && renderReviewChecklist()}

                                                {/* Custom Injection Terminal */}
                                                <div className="pt-12">
                                                    <div className="flex gap-6 items-center px-10 py-8 rounded-[48px] border border-dashed border-white/10 hover:border-brand-500/40 transition-all bg-[#0c0e12]/40 group/add focus-within:bg-[#0c0e12] focus-within:shadow-[0_32px_96px_rgba(0,0,0,0.6)] focus-within:border-brand-500/50">
                                                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 group-hover/add:text-brand-400 group-hover/add:bg-brand-500/10 transition-all">
                                                            <Plus size={24} strokeWidth={3} />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            value={localSubtaskTitles[currentPhase] || ''}
                                                            onChange={(e) => setLocalSubtaskTitles(prev => ({ ...prev, [currentPhase]: e.target.value }))}
                                                            placeholder={`Inject ad-hoc requirement into ${PHASE_LABELS_FULL[currentPhase]} phase...`}
                                                            className="flex-1 bg-transparent text-lg text-white outline-none font-bold placeholder:text-gray-800 tracking-tight"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleQuickAddSubtask(currentPhase);
                                                                }
                                                            }}
                                                        />
                                                        <div className="hidden lg:flex items-center gap-2 group-focus-within:opacity-100 opacity-20 transition-opacity">
                                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/5 shadow-inner">↵ Press Enter to Deploy</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 02: DOCUMENT EVIDENCE RESPOSITORY */}
                                    {activeDetailTab === 'EVIDENCE' && (
                                        <div className="space-y-16">
                                            {/* Smart Evidence Terminal */}
                                            <div className="p-12 rounded-[80px] bg-[#0c0e12] border border-white/[0.08] shadow-[0_64px_128px_rgba(0,0,0,0.8)] space-y-12 relative overflow-hidden group/upload">
                                                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 blur-[120px] rounded-full pointer-events-none" />
                                                
                                                <div className="flex items-center justify-between px-4 relative z-10">
                                                    <div className="flex flex-col gap-3">
                                                        <h5 className="text-[18px] font-black text-white uppercase tracking-[0.3em]">Smart File Gateway</h5>
                                                        <p className="text-[11px] text-gray-600 font-black uppercase tracking-[0.2em] flex items-center gap-3">
                                                            <CloudUpload size={16} className="text-brand-500 animate-bounce" />
                                                            Automatic Metadata Tagging & Client Synchronization
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-5">
                                                        <select 
                                                            value={selectedFolderForUpload}
                                                            onChange={(e) => setSelectedFolderForUpload(e.target.value as AuditFolderKey)}
                                                            className="bg-[#1a1f29] border-2 border-white/5 rounded-[24px] px-8 py-5 text-[12px] font-black text-gray-300 uppercase tracking-widest focus:outline-none focus:border-brand-500/50 shadow-2xl transition-all hover:border-white/20"
                                                        >
                                                            <option value="">Select Target Root Folder...</option>
                                                            {(Object.keys(AUDIT_FOLDER_STRUCTURE) as AuditFolderKey[]).map(key => (
                                                                <option key={key} value={key}>{key}. {AUDIT_FOLDER_STRUCTURE[key].label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <label className="block w-full cursor-pointer relative z-10">
                                                    <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files)} disabled={isUploadingDoc || !selectedFolderForUpload} />
                                                    <div className={`p-24 rounded-[64px] border-2 border-dashed flex flex-col items-center justify-center transition-all duration-700 ${selectedFolderForUpload ? 'border-brand-500/40 bg-brand-500/[0.02] hover:bg-brand-500/[0.05] hover:border-brand-500/60 shadow-[0_32px_96px_rgba(99,102,241,0.15)]' : 'border-white/5 opacity-30 cursor-not-allowed grayscale'}`}>
                                                        {isUploadingDoc ? <Loader2 size={64} className="animate-spin text-brand-400" /> : <CloudUpload size={64} className="text-brand-400 mb-8 drop-shadow-2xl" />}
                                                        <div className="text-center space-y-3">
                                                            <p className="text-2xl font-black text-white uppercase tracking-[0.2em] leading-relaxed">Transmit Engagement Evidence</p>
                                                            <p className="text-[13px] text-gray-600 font-bold uppercase tracking-[0.3em]">Auto-Tag Destination: <span className="text-brand-400">{selectedFolderForUpload ? AUDIT_FOLDER_STRUCTURE[selectedFolderForUpload].label : 'Locked'}</span></p>
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* Files Visual Grid */}
                                            <div className="space-y-10">
                                                <div className="flex items-center justify-between border-b-2 border-white/[0.03] pb-10 px-6">
                                                    <h6 className="text-[15px] font-black text-gray-600 uppercase tracking-[0.5em] flex items-center gap-4">
                                                        <div className="w-1.5 h-6 bg-brand-500 rounded-full" />
                                                        Engagement Evidence Portfolio ({auditFiles.length})
                                                    </h6>
                                                    {isLoadingDocs && <Loader2 size={24} className="animate-spin text-brand-400" />}
                                                </div>
                                                
                                                {auditFiles.length === 0 ? (
                                                    <div className="py-56 flex flex-col items-center justify-center bg-white/[0.01] rounded-[80px] border border-white/[0.04] grayscale opacity-40">
                                                        <FileSearch size={96} className="text-gray-900 mb-12" />
                                                        <p className="text-sm font-black text-gray-800 uppercase tracking-[0.5em]">Workspace Repository Offline</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                        {auditFiles.map(file => (
                                                            <div key={file.id} className="p-8 rounded-[40px] bg-[#0c0e12] border border-white/5 hover:border-brand-500/50 hover:bg-[#0f1218] transition-all flex flex-col items-start gap-6 group/file shadow-2xl relative overflow-hidden">
                                                                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500/20 group-hover/file:bg-brand-500 transition-colors" />
                                                                <div className="w-16 h-16 rounded-[22px] bg-navy-950 flex items-center justify-center text-brand-400 border border-white/10 group-hover/file:scale-110 transition-transform shadow-xl">
                                                                    <FileText size={28} />
                                                                </div>
                                                                <div className="flex-1 min-w-0 w-full">
                                                                    <p className="text-[14px] font-black text-white truncate uppercase tracking-tight mb-2">{file.fileName}</p>
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className="px-3 py-1.5 rounded-xl bg-white/5 text-[9px] font-black text-gray-500 border border-white/5 uppercase tracking-widest">{file.folderKey}. Folder</span>
                                                                        <span className="px-3 py-1.5 rounded-xl bg-brand-500/10 text-[9px] font-black text-brand-400 border border-brand-500/10 uppercase tracking-widest">{file.lineItem || 'General Field'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3 w-full pt-4 border-t border-white/5">
                                                                    <a href={AppwriteService.getFileView(file.appwriteFileId)} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all border border-white/5">
                                                                        <ExternalLink size={16} className="mr-2" /> Inspect
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 03: FORMAL AUDIT OBSERVATIONS */}
                                    {activeDetailTab === 'OBSERVATIONS' && (
                                        <div className="space-y-12">
                                            <div className="flex items-center justify-between px-4 pb-10 border-b-2 border-white/[0.03]">
                                                <div className="flex flex-col gap-4">
                                                    <h5 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Management Observations</h5>
                                                    <p className="text-[12px] text-gray-500 font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                                        <div className="w-4 h-4 rounded bg-rose-500/20 flex items-center justify-center shadow-lg"><ShieldAlert size={10} className="text-rose-500" /></div>
                                                        Review Findings & Drafting Section
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        const newObs = { id: `obs-${Date.now()}`, title: '', content: '', implication: '', recommendation: '', createdAt: new Date().toISOString() };
                                                        onChange({ observations: [...(task.observations || []), newObs] });
                                                    }}
                                                    className="px-12 py-6 bg-rose-600 text-white rounded-[32px] text-[12px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-[0_24px_64px_rgba(225,29,72,0.3)] flex items-center gap-4 active:scale-95 border-b-4 border-rose-900/50"
                                                >
                                                    <Plus size={20} strokeWidth={4} /> Catalog Finding
                                                </button>
                                            </div>

                                            <div className="space-y-10">
                                                {(task.observations || []).length === 0 ? (
                                                    <div className="py-64 flex flex-col items-center justify-center bg-[#0c0e12] rounded-[80px] border border-dashed border-white/5 grayscale">
                                                        <div className="w-32 h-32 rounded-full bg-white/5 flex items-center justify-center mb-12 shadow-inner border border-white/5 scale-110">
                                                            <ShieldAlert size={80} strokeWidth={1} className="text-gray-900 opacity-20" />
                                                        </div>
                                                        <p className="text-sm font-black text-gray-800 uppercase tracking-[0.6em]">No Discrepancies Cataloged</p>
                                                    </div>
                                                ) : (
                                                    (task.observations || []).map(obs => (
                                                        <div key={obs.id} className="p-12 rounded-[64px] bg-[#0c0e12] border border-white/5 space-y-12 shadow-[0_48px_96px_rgba(0,0,0,0.6)] relative group/obs hover:border-rose-500/30 transition-all duration-500">
                                                            <button onClick={() => {
                                                                const updated = (task.observations || []).filter(o => o.id !== obs.id);
                                                                onChange({ observations: updated });
                                                            }} className="absolute top-10 right-10 text-gray-800 hover:text-rose-500 p-4 opacity-0 group-hover/obs:opacity-100 transition-all bg-white/5 rounded-3xl hover:bg-rose-500/10 active:scale-90 border border-white/5">
                                                                <Trash2 size={24} />
                                                            </button>
                                                            
                                                            <div className="flex items-center gap-8">
                                                                <div className="w-2.5 h-12 bg-rose-500 rounded-full shadow-[0_0_24px_rgba(239,68,68,0.6)]" />
                                                                <input 
                                                                    className="flex-1 bg-transparent text-3xl font-black text-white focus:outline-none placeholder:text-gray-900 tracking-tighter"
                                                                    placeholder="Critical Finding Descriptor..."
                                                                    value={obs.title}
                                                                    onChange={(e) => handleUpdateObservation(obs.id, { title: e.target.value })}
                                                                />
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-4">
                                                                <div className="space-y-6">
                                                                    <div className="flex items-center gap-4 ml-6">
                                                                        <ShieldAlert size={16} className="text-rose-500" />
                                                                        <label className="text-[12px] font-black text-gray-600 uppercase tracking-[0.4em]">Audit Condition & Risk</label>
                                                                    </div>
                                                                    <textarea 
                                                                        className="w-full h-80 bg-[#090b0e] border-2 border-white/5 rounded-[48px] p-10 text-lg text-gray-300 focus:outline-none focus:border-rose-500/40 resize-none leading-relaxed shadow-inner font-medium"
                                                                        placeholder="Detailed findings here..."
                                                                        value={obs.content}
                                                                        onChange={(e) => handleUpdateObservation(obs.id, { content: e.target.value })}
                                                                    />
                                                                </div>
                                                                <div className="space-y-6">
                                                                    <div className="flex items-center gap-4 ml-6">
                                                                        <ShieldCheck size={16} className="text-emerald-500" />
                                                                        <label className="text-[12px] font-black text-gray-600 uppercase tracking-[0.4em]">Management Recommendation</label>
                                                                    </div>
                                                                    <textarea 
                                                                        className="w-full h-80 bg-[#090b0e] border-2 border-white/5 rounded-[48px] p-10 text-lg text-gray-300 focus:outline-none focus:border-emerald-500/40 resize-none leading-relaxed shadow-inner font-medium"
                                                                        placeholder="Remediation steps..."
                                                                        value={obs.recommendation}
                                                                        onChange={(e) => handleUpdateObservation(obs.id, { recommendation: e.target.value })}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB 04: COMMUNICATIONS & CHAT */}
                                    {activeDetailTab === 'COMMENTS' && (
                                        <div className="space-y-12">
                                            <div className="flex flex-col gap-4 border-b-2 border-white/[0.03] pb-12">
                                                <h5 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Collaboration Network</h5>
                                                <p className="text-[12px] text-gray-500 font-black uppercase tracking-[0.3em] flex items-center gap-3">
                                                    <MessageSquare size={16} className="text-brand-500 shadow-lg" />
                                                    Real-time Engagement Synchronization
                                                </p>
                                            </div>
                                            <div className="bg-[#0c0e12] rounded-[64px] border border-white/[0.08] p-1 shadow-2xl overflow-hidden">
                                                <div className="p-12">
                                                    <TaskComments
                                                        taskId={task.id!}
                                                        comments={task.comments || []}
                                                        onAddComment={onAddComment}
                                                        users={usersList}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* High-End Global Command Bar (Footer) */}
                    <div className="shrink-0 px-16 py-10 border-t border-white/[0.04] bg-[#0c0e12] flex justify-between items-center relative z-20 shadow-[0_-24px_64px_rgba(0,0,0,0.6)]">
                        <div className="flex items-center gap-12">
                            {isEditMode && canManageTask && (
                                <button
                                    onClick={() => onDelete(task.id!)}
                                    className="text-gray-700 hover:text-rose-500 text-[12px] font-black uppercase tracking-[0.3em] transition-all flex items-center gap-4 group active:scale-95"
                                >
                                    <div className="w-12 h-12 rounded-[18px] bg-white/5 flex items-center justify-center group-hover:bg-rose-500/10 transition-colors border border-white/5">
                                        <Trash2 size={24} strokeWidth={3} />
                                    </div>
                                    Abort Engagement
                                </button>
                            )}
                        </div>

                        <div className="flex gap-8">
                            <button
                                onClick={handleCloseAttempt}
                                className="px-14 py-6 text-gray-500 hover:text-white text-[12px] font-black uppercase tracking-[0.3em] rounded-[32px] transition-all border-2 border-white/5 hover:bg-white/5 hover:border-white/10 active:scale-95"
                            >
                                Exit Workspace
                            </button>
                            <button
                                onClick={handleSubmit(handleSave)}
                                disabled={isSaving}
                                className="px-20 py-6 bg-brand-500 hover:bg-brand-600 text-white rounded-[32px] text-[13px] font-black uppercase tracking-[0.4em] transition-all shadow-[0_24px_80px_rgba(99,102,241,0.4)] active:scale-95 disabled:opacity-50 flex items-center gap-6 group border-b-4 border-brand-900/50"
                            >
                                {isSaving ? <Loader2 size={32} className="animate-spin" /> : <Save size={32} className="group-hover:scale-125 transition-transform duration-500" />}
                                {isEditMode ? 'Commit All Evidence' : 'Initialize Workspace'}
                            </button>
                        </div>
                    </div>

                    {/* Critical System Alert: Unsaved Modifications */}
                    <AnimatePresence>
                        {showDiscardBanner && (
                            <motion.div
                                key="discard-banner"
                                initial={{ opacity: 0, y: 100 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 100 }}
                                className="fixed inset-x-0 bottom-40 mx-auto w-max px-12 py-8 bg-amber-500 rounded-[48px] border-4 border-amber-400 flex items-center gap-16 shadow-[0_48px_128px_rgba(245,158,11,0.6)] z-[200]"
                            >
                                <div className="flex items-center gap-8 text-navy-950">
                                    <AlertTriangle size={48} strokeWidth={4} className="flex-shrink-0 animate-pulse" />
                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-black uppercase tracking-[0.3em]">Workspace Desync Warning</span>
                                        <span className="text-[11px] font-bold opacity-80 uppercase tracking-widest mt-1">Found unsaved modifications. Exit without committing?</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <button onClick={() => setShowDiscardBanner(false)} className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-navy-950 bg-white/20 hover:bg-white/40 rounded-[28px] transition-all border-2 border-navy-950/20 shadow-inner">Stay in Workspace</button>
                                    <button onClick={() => { setShowDiscardBanner(false); onClose(); }} className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-white bg-navy-950 hover:bg-black rounded-[28px] transition-all shadow-2xl shadow-black/80">Discard & Exit</button>
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
