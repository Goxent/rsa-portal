import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye, Map,
    Sparkles, Book, ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen,
    Users, UserCheck, Shield, Lock, Unlock, ExternalLink, History, CloudUpload, FileText,
    MessageSquare, Zap, Settings2, Folder, Download, ChevronDown
} from 'lucide-react';
import { AppwriteService } from '../../services/appwrite';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase, Template, TemplateFolder, TaskType, AuditObservation, ReviewChecklistItem } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';
import { useModal } from '../../context/ModalContext';
import { KnowledgeService } from '../../services/knowledge';
import { TemplateService } from '../../services/templates';
import { AuditDocService, AuditDocFile, AuditDocFolder } from '../../services/auditDocs';
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
    onArchive?: (id: string) => void;
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
    [AuditPhase.PLANNING_AND_EXECUTION]: 'Planning and Execution',
    [AuditPhase.REVIEW_AND_CONCLUSION]: 'Review and Conclusion'
};

const PHASE_ICONS = {
    [AuditPhase.ONBOARDING]: <Map size={14} />,
    [AuditPhase.PLANNING_AND_EXECUTION]: <Activity size={14} />,
    [AuditPhase.REVIEW_AND_CONCLUSION]: <CheckCircle2 size={14} />
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
    onArchive,
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
    const [activeDetailTab, setActiveDetailTab] = useState<string>('SETTINGS');
    const [activeReviewTab, setActiveReviewTab] = useState<'TL' | 'ER' | 'SP'>('TL');
    const [importPhase, setImportPhase] = useState<AuditPhase | null>(null);
    const [templateSearchQuery, setTemplateSearchQuery] = useState('');
    const [showAllFrameworks, setShowAllFrameworks] = useState(false);
    const [localSubtaskTitles, setLocalSubtaskTitles] = useState<Record<AuditPhase | 'UNCATEGORIZED', string>>({
        [AuditPhase.ONBOARDING]: '',
        [AuditPhase.PLANNING_AND_EXECUTION]: '',
        [AuditPhase.REVIEW_AND_CONCLUSION]: '',
        UNCATEGORIZED: ''
    });

    const [auditFiles, setAuditFiles] = useState<AuditDocFile[]>([]);
    const [customFolders, setCustomFolders] = useState<AuditDocFolder[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);
    const [selectedFolderForUpload, setSelectedFolderForUpload] = useState<AuditFolderKey | ''>('');
    const [selectedLineItemForUpload, setSelectedLineItemForUpload] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [selectingFolderSubtaskId, setSelectingFolderSubtaskId] = useState<string | null>(null);

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

    // ── Sync form when task prop changes (e.g. after save or task switch) ──
    useEffect(() => {
        if (isOpen) {
            if (!task.id) {
                setActiveDetailTab('SETTINGS');
                reset({
                    title: '',
                    clientId: '',
                    fiscalYear: '',
                    startDate: '',
                    dueDate: '',
                    priority: TaskPriority.MEDIUM,
                    status: TaskStatus.NOT_STARTED,
                    estimatedHours: 0,
                    assignedTo: [],
                    teamLeaderId: '',
                    engagementReviewerId: '',
                    signingPartnerId: '',
                    description: '',
                    auditPhase: AuditPhase.ONBOARDING,
                    teamLeadApprovedAt: '',
                    engagementReviewerApprovedAt: '',
                    signingPartnerApprovedAt: '',
                });
            } else {
                setActiveDetailTab('OVERVIEW'); // Default to first tab (Overview) when opening an existing task
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
                });
            }
        }
    }, [task.id, isOpen, reset]);

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
            const [files, folders] = await Promise.all([
                AuditDocService.getAllFiles(watchedClientId, watchedFiscalYear),
                AuditDocService.getFolders(watchedClientId, watchedFiscalYear, selectedFolderForUpload as AuditFolderKey, selectedLineItemForUpload || undefined)
            ]);
            setAuditFiles(files);
            setCustomFolders(folders);
        } catch (e) {
            console.error("Manual reload of audit documentation failed", e);
        } finally {
            setIsLoadingDocs(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !selectedFolderForUpload || !watchedClientId || !watchedFiscalYear) return;
        
        try {
            const folder = await AuditDocService.createFolder({
                clientId: watchedClientId,
                clientName: clientsList.find(c => c.id === watchedClientId)?.name || 'Unknown',
                fiscalYear: watchedFiscalYear,
                folderKey: selectedFolderForUpload as AuditFolderKey,
                lineItem: selectedLineItemForUpload || undefined,
                name: newFolderName.trim(),
                createdBy: user?.uid || 'system',
                createdByName: user?.displayName || 'System'
            });
            setCustomFolders(prev => [...prev, folder]);
            setNewFolderName('');
            setIsCreatingFolder(false);
            toast.success("Sub-folder created successfully");
        } catch (e) {
            console.error("Failed to create folder", e);
            toast.error("Could not create folder");
        }
    };

    const handleFileUpload = async (files: FileList | null, subtaskId?: string, folderKeyOverride?: AuditFolderKey, lineItemOverride?: string) => {
        if (!files || files.length === 0) return;
        
        // Use watched form values as they represent the current UI state
        const watchedClientId = watch('clientId');
        const watchedFiscalYear = watch('fiscalYear');
        const selectedClient = clientsList.find(c => c.id === watchedClientId);
        
        // Default folder B for procedures, otherwise use selected or override
        const targetFolder = folderKeyOverride || (subtaskId ? 'B' : selectedFolderForUpload);
        
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
                    lineItem: lineItemOverride || (lineItemOverride === undefined ? (selectedLineItemForUpload || undefined) : undefined),
                    lineItemLabel: lineItemOverride || (lineItemOverride === undefined ? (selectedLineItemForUpload || undefined) : undefined),
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

    // Role-based Access Control (RBAC) definitions
    const isTaskCompleted = task.status === TaskStatus.COMPLETED;
    const isTeamLeader = user?.uid === task.teamLeaderId;
    const isMasterAdmin = user?.role === UserRole.MASTER_ADMIN;
    const isAdminOrMaster = user?.role === UserRole.ADMIN || isMasterAdmin;
    const isEngagementReviewer = user?.uid === task.engagementReviewerId;
    const isSigningPartner = user?.uid === task.signingPartnerId;
    const canManageTeam = (isAdminOrMaster || isTeamLeader || !task.id) && !isTaskCompleted;
    
    // Rule: Team Leader AND Admins can ADD subtasks
    const canAddSubtasks = (isTeamLeader || isAdminOrMaster) && !isTaskCompleted;
    
    // Rule: ONLY Team Leader can DELETE subtasks (Admins cannot, unless they are also the Team Leader)
    const canDeleteSubtasks = (isTeamLeader || isMasterAdmin) && !isTaskCompleted;

    const isInOnboarding = currentPhase === AuditPhase.ONBOARDING;
    const canChangeFramework = (isAdminOrMaster || !task.id) && isInOnboarding && !isTaskCompleted;


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
        if (isTaskCompleted) return;
        const updated = [...(task.subtasks || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            const st = updated[idx];
            
            // RBAC: Only assigned users or Team Leader (Admins have task.teamLeaderId permission if assigned)
            const isAssigned = (st.assignedTo || []).includes(user?.uid || '');
            const isTaskTeamLeader = user?.uid === task.teamLeaderId;
            
            if (!isAssigned && !isTaskTeamLeader) {
                toast.error("Only assigned staff members or the Task Team Leader can mark this procedure as complete.", { icon: '🔒' });
                return;
            }

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

    const toggleReviewItemStatus = (id: string, isLocked: boolean) => {
        if (isLocked || isTaskCompleted) return;
        const updated = [...(task.reviewChecklist || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            const item = updated[idx];
            
            // RBAC: Respective assignee check
            const isAuthorized = isAdminOrMaster || 
                (item.reviewerRole === 'TL' && isTeamLeader) ||
                (item.reviewerRole === 'ER' && isEngagementReviewer) ||
                (item.reviewerRole === 'SP' && isSigningPartner);
                
            if (!isAuthorized) {
                toast.error(`Only the assigned ${item.reviewerRole} can update this item.`, { icon: '🔒' });
                return;
            }

            const currentStatus = item.status || 'PENDING';
            let nextStatus: 'PENDING' | 'OK' | 'ISSUE' = 'OK';
            if (currentStatus === 'OK') nextStatus = 'ISSUE';
            else if (currentStatus === 'ISSUE') nextStatus = 'PENDING';
            
            updated[idx] = {
                ...item,
                status: nextStatus as any,
                isCompleted: nextStatus === 'OK',
                completedBy: user?.uid,
                completedByName: user?.displayName || 'Unknown',
                completedAt: new Date().toISOString()
            };
            onChange({ reviewChecklist: updated });
        }
    };

    const updateReviewItemField = (id: string, field: string, value: any, isLocked: boolean) => {
        if (isLocked || isTaskCompleted) return;
        const updated = [...(task.reviewChecklist || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            const item = updated[idx];

            // RBAC: Respective assignee check
            const isAuthorized = isAdminOrMaster || 
                (item.reviewerRole === 'TL' && isTeamLeader) ||
                (item.reviewerRole === 'ER' && isEngagementReviewer) ||
                (item.reviewerRole === 'SP' && isSigningPartner);
                
            if (!isAuthorized) {
                toast.error(`Only the assigned ${item.reviewerRole} can modify this item.`, { icon: '🔒' });
                return;
            }

            updated[idx] = { ...item, [field]: value };
            onChange({ reviewChecklist: updated });
        }
    };

    const addReviewRow = (role: 'TL' | 'ER' | 'SP') => {
        if (isTaskCompleted) return;
        const newItem = {
            id: `rc-manual-${Date.now()}`,
            title: '',
            status: 'PENDING' as const,
            priority: 'MEDIUM' as const,
            isCompleted: false,
            reviewerRole: role,
        };
        const updated = [...(task.reviewChecklist || []), newItem];
        onChange({ reviewChecklist: updated });
    };

    const removeReviewRow = (id: string, isLocked: boolean) => {
        if (isLocked || isTaskCompleted) return;
        const item = (task.reviewChecklist || []).find(i => i.id === id);
        if (!item) return;

        // RBAC: Engagement team (non-TL) cannot delete TL checklist. Others restrict to assignee.
        const isAuthorized = isAdminOrMaster || 
            (item.reviewerRole === 'TL' && isTeamLeader) ||
            (item.reviewerRole === 'ER' && isEngagementReviewer) ||
            (item.reviewerRole === 'SP' && isSigningPartner);

        if (!isAuthorized) {
            toast.error(`Action Restricted: Only the assigned ${item.reviewerRole} can delete this protocol item.`, { icon: '🔒' });
            return;
        }

        if (window.confirm("Are you sure you want to remove this protocol item? This action cannot be undone.")) {
            const updated = (task.reviewChecklist || []).filter(i => i.id !== id);
            onChange({ reviewChecklist: updated });
        }
    };

    const handleReviewSignOff = (role: 'TL' | 'ER' | 'SP') => {
        if (isTaskCompleted) return;
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'MASTER_ADMIN';
        const isTL = user?.uid === task.teamLeaderId;
        const isER = user?.uid === task.engagementReviewerId;
        const isSP = user?.uid === task.signingPartnerId;

        // Permission check
        const isAuthorized = isAdmin || (role === 'TL' && isTL) || (role === 'ER' && isER) || (role === 'SP' && isSP);
        if (!isAuthorized) {
            toast.error(`You are not authorized to sign off as ${role}.`);
            return;
        }

        // Sequential Check
        if (role === 'ER' && !task.teamLeadApprovedAt) {
            toast.error("Team Lead sign-off required first.");
            return;
        }
        if (role === 'SP' && !task.engagementReviewerApprovedAt) {
            toast.error("Engagement Reviewer sign-off required first.");
            return;
        }

        const itemsForLayer = (task.reviewChecklist || []).filter(i => i.reviewerRole === role);
        const hasPending = itemsForLayer.some(i => i.status === 'PENDING' || !i.status);
        const hasCritical = itemsForLayer.some(i => i.status === 'ISSUE' && i.priority === 'CRITICAL');

        if (hasPending) {
            toast.error(`Please complete all checklist items for the ${role} layer.`);
            return;
        }
        if (hasCritical) {
            toast.error(`Resolve all CRITICAL issues before sign-off.`);
            return;
        }

        const updates: any = {};
        if (role === 'TL') updates.teamLeadApprovedAt = new Date().toISOString();
        if (role === 'ER') updates.engagementReviewerApprovedAt = new Date().toISOString();
        if (role === 'SP') updates.signingPartnerApprovedAt = new Date().toISOString();

        onChange(updates);
        toast.success(`${role} Layer Sign-off Secured.`);
    };

    const onRemoveSubtaskLocal = (id: string) => {
        if (isTaskCompleted) return;
        if (window.confirm("Delete this procedure requirement?")) {
            const updated = (task.subtasks || []).filter(st => st.id !== id);
            onChange({ subtasks: updated });
        }
    };

    const handleSubtaskAction = (id: string, action: 'RAISE_QUERY' | 'REPLY' | 'CLEAR', data?: string) => {
        if (isTaskCompleted) return;
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
        if (isTaskCompleted) return;
        const title = localSubtaskTitles[phase]?.trim();
        if (!title) return;

        const newSubtask: SubTask = {
            id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            createdBy: user?.displayName || 'unknown',
            addedBy: user?.uid,
            addedByName: user?.displayName || 'unknown',
            phase: phase,
            assignedTo: [],
            isNew: true,
            isAutoGenerated: false
        };

        onChange({ subtasks: [...(task.subtasks || []), newSubtask] });
        setLocalSubtaskTitles(prev => ({ ...prev, [phase]: '' }));
    };

    const handleAddObservation = () => {
        if (isTaskCompleted) return;
        const newObs: AuditObservation = {
            id: `obs-${Date.now()}`,
            title: 'New Observation',
            observation: '',
            implication: '',
            recommendation: '',
            severity: 'MEDIUM',
            status: 'DRAFT',
            createdAt: new Date().toISOString(),
            createdBy: user?.uid,
            createdByName: user?.displayName || 'unknown'
        };
        const currentObs = task.observations || [];
        onChange({ observations: [...currentObs, newObs] });
    };

    const handleUpdateObservation = (id: string, updates: Partial<AuditObservation>) => {
        if (isTaskCompleted) return;
        const currentObs = [...(task.observations || [])];
        const idx = currentObs.findIndex(o => o.id === id);
        if (idx > -1) {
            const obs = currentObs[idx];
            // RBAC: Only creator can edit. Engagement team cannot edit others'. Admin view only.
            const isCreator = user?.uid === obs.createdBy;
            if (!isCreator && !isAdminOrMaster) {
                toast.error("Access Restricted: Only the creator can modify this observation.", { icon: '🔒' });
                return;
            }
            if (isAdminOrMaster && !isCreator) {
                toast.error("Admins have view-only access to audit observations.", { icon: '👁️' });
                return;
            }

            currentObs[idx] = { ...obs, ...updates };
            onChange({ observations: currentObs });
        }
    };

    const handleRemoveObservation = (id: string) => {
        if (isTaskCompleted) return;
        const currentObs = task.observations || [];
        const obs = currentObs.find(o => o.id === id);
        if (!obs) return;

        const isCreator = user?.uid === obs.createdBy;
        if (!isCreator && !isAdminOrMaster) {
            toast.error("Access Restricted: Only the creator can delete this observation.", { icon: '🔒' });
            return;
        }
        if (isAdminOrMaster && !isCreator) {
            toast.error("Admins cannot delete audit observations.", { icon: '🔒' });
            return;
        }

        if (window.confirm("Delete this audit observation? This action cannot be undone.")) {
            const updated = currentObs.filter(o => o.id !== id);
            onChange({ observations: updated });
        }
    };

    const handlePhaseSwitch = (newPhase: AuditPhase) => {
        // Free navigation — users can jump to any phase at any time
        // to view, add, or manage subtasks regardless of completion status
        if (newPhase === currentPhase) return;
        setValue('auditPhase', newPhase);
        setShowPhaseWarning(null);
    };

    const handleFrameworkSelect = (tType: TaskType) => {
        // Guard: Prevent re-injecting if the same framework is already selected or if user cannot change it
        if (!canChangeFramework || tType === task.taskType) return;

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
            <div key={uniqueKey} className={`flex flex-col gap-0.5 px-4 py-2 rounded-[16px] transition-all duration-300 group/st bg-[#f1f3ee] dark:bg-[#0f1218] border border-[#d0dac8] dark:border-white/5 hover:bg-[#e8ece2] dark:hover:bg-white/[0.04] shadow-sm ${st.isNew ? 'ring-1 ring-brand-500/20' : ''}`}>
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <button
                            onClick={() => toggleSubtask(st.id)}
                            disabled={!canManageTeam && !(st.assignedTo || []).includes(user?.uid || '')}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                st.isCompleted 
                                    ? 'bg-brand-500 border-brand-500 text-white shadow-md' 
                                    : 'border-gray-400 dark:border-slate-600 hover:border-gray-500 dark:hover:border-slate-500 bg-white dark:bg-transparent'
                            } ${(!canManageTeam && !(st.assignedTo || []).includes(user?.uid || '')) ? 'opacity-40 grayscale-[0.5] cursor-not-allowed' : 'cursor-pointer'}`}
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
                            <span className={`text-[13px] font-bold leading-snug ${st.isCompleted ? 'line-through text-gray-500' : 'text-gray-900 dark:text-gray-200'}`}>
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

                        {st.addedByName && !st.isAutoGenerated && (
                            <p className="text-[9px] text-emerald-500 font-bold tracking-widest mt-1 opacity-70">ADDED BY: {st.addedByName}</p>
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
                        {/* Attach Documentation Button with Folder Selector */}
                        <div className="relative">
                            <button 
                                onClick={() => setSelectingFolderSubtaskId(active => active === st.id ? null : st.id)}
                                className={`p-1 px-1.5 rounded transition-all flex items-center justify-center ${selectingFolderSubtaskId === st.id ? 'bg-brand-500 text-white' : 'text-gray-500 hover:text-brand-400'}`}
                                title="Sync Documentation to Repository"
                            >
                                {uploadingSubtaskId === st.id ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={14} className="hover:scale-110 transition-transform" />}
                            </button>

                            <AnimatePresence>
                                {selectingFolderSubtaskId === st.id && (
                                    <>
                                        {/* Backdrop for closing */}
                                        <div className="fixed inset-0 z-[100]" onClick={() => setSelectingFolderSubtaskId(null)} />
                                        
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="absolute bottom-full right-0 mb-3 w-72 p-2 bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl z-[101] backdrop-blur-3xl overflow-hidden"
                                        >
                                            <div className="px-3 py-2 border-b border-white/5 mb-2 flex items-center justify-between">
                                                <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Select Repository Path</span>
                                                <X size={12} className="text-gray-600 cursor-pointer hover:text-white" onClick={() => setSelectingFolderSubtaskId(null)} />
                                            </div>
                                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
                                                {Object.entries(AUDIT_FOLDER_STRUCTURE).map(([key, def]) => {
                                                    const hasLineItems = def.lineItems && def.lineItems.length > 0;
                                                    
                                                    return (
                                                        <div key={key} className="space-y-1">
                                                            <div className="group relative">
                                                                <input 
                                                                    type="file" 
                                                                    id={`file-${st.id}-${key}`}
                                                                    className="hidden" 
                                                                    onChange={(e) => {
                                                                        handleFileUpload(e.target.files, st.id, key as AuditFolderKey);
                                                                        setSelectingFolderSubtaskId(null);
                                                                    }}
                                                                    disabled={uploadingSubtaskId === st.id}
                                                                />
                                                                <button 
                                                                    onClick={() => {
                                                                        if (!hasLineItems) {
                                                                            document.getElementById(`file-${st.id}-${key}`)?.click();
                                                                        }
                                                                    }}
                                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-transparent transition-all text-left ${hasLineItems ? 'cursor-default' : 'cursor-pointer hover:bg-white/5 hover:border-white/10'}`}
                                                                >
                                                                    <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center text-[10px] font-black text-brand-400">
                                                                        {key}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[11px] font-bold text-gray-200 group-hover:text-white transition-colors">{def.label}</div>
                                                                        <div className="text-[9px] text-gray-500 truncate">{def.description.substring(0, 40)}...</div>
                                                                    </div>
                                                                </button>
                                                            </div>

                                                            {hasLineItems && (
                                                                <div className="ml-4 pl-4 border-l border-white/5 space-y-1 py-1">
                                                                    {def.lineItems?.map(item => (
                                                                        <label 
                                                                            key={item}
                                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.03] transition-all cursor-pointer group/item"
                                                                        >
                                                                            <input 
                                                                                type="file" 
                                                                                className="hidden" 
                                                                                onChange={(e) => {
                                                                                    handleFileUpload(e.target.files, st.id, key as AuditFolderKey, item);
                                                                                    setSelectingFolderSubtaskId(null);
                                                                                }}
                                                                            />
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover/item:bg-brand-500 transition-colors" />
                                                                            <span className="text-[10px] font-medium text-gray-500 group-hover/item:text-gray-300 truncate">{item}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

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
                        {(isTeamLeader || user?.role === UserRole.MASTER_ADMIN) && (
                            <button onClick={() => onRemoveSubtaskLocal(st.id)} className="text-gray-700 hover:text-rose-400 p-1 px-1.5 transition-all">
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Multi-Assignee Section */}
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[#d0dac8]/50 dark:border-white/[0.04]">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-[0.2em]">Requirement Assignees</span>
                        {Array.isArray(st.assignedTo) && st.assignedTo.length > 0 && (
                            <span className="text-[8px] font-bold text-brand-700 bg-brand-500/10 px-2 py-0.5 rounded uppercase tracking-widest">
                                {st.assignedTo.length} Assigned
                            </span>
                        )}
                    </div>
                    <div className="w-full min-w-0">
                        <StaffSelect
                            users={usersList.filter(u => (watch('assignedTo') || []).includes(u.uid))}
                            value={Array.isArray(st.assignedTo) ? st.assignedTo : (st.assignedTo ? [st.assignedTo] : [])}
                            onChange={(val) => handleUpdateSubtaskAssignee(st.id, val as string[])}
                            placeholder="Assign team members..."
                            multi
                            compact
                            disabled={!canManageTeam}
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
                            if (window.confirm("Remove this evidence? This will also uncheck the requirement.")) {
                                const updated = [...(task.subtasks || [])];
                                const idx = updated.findIndex(u => u.id === st.id);
                                if (idx > -1) {
                                    updated[idx] = { ...st, isCompleted: false, evidenceProvided: false, evidenceText: undefined };
                                    onChange({ subtasks: updated });
                                }
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

    const renderReviewerChecklist = () => {
        return (
            <div className="space-y-6">
                {/* Protocol Tabs */}
                <div className="flex gap-1 p-1 bg-white/5 border border-white/5 rounded-2xl w-fit mx-auto shadow-2xl backdrop-blur-xl">
                    {[
                        { id: 'TL' as const, label: 'Team Leader', color: 'brand' },
                        { id: 'ER' as const, label: 'Engagement Reviewer', color: 'purple' },
                        { id: 'SP' as const, label: 'Signing Partner', color: 'rose' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveReviewTab(tab.id)}
                            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 flex items-center gap-2.5 ${
                                activeReviewTab === tab.id 
                                    ? `bg-${tab.color}-500 text-white shadow-lg shadow-${tab.color}-500/20 active:scale-95` 
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <ShieldCheck size={14} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {[activeReviewTab].map((layer) => {
                    const meta = {
                        'TL': { title: 'Team Leader Protocol', color: 'brand', role: 'Team Leader' },
                        'ER': { title: 'Engagement Reviewer Protocol', color: 'purple', role: 'Engagement Reviewer' },
                        'SP': { title: 'Signing Partner Protocol', color: 'rose', role: 'Signing Partner' }
                    }[layer];

                    const items = (task.reviewChecklist || []).filter(i => i.reviewerRole === layer);
                    const isSignedOff = !!{
                        'TL': task.teamLeadApprovedAt,
                        'ER': task.engagementReviewerApprovedAt,
                        'SP': task.signingPartnerApprovedAt
                    }[layer];

                    const signOffDate = {
                        'TL': task.teamLeadApprovedAt,
                        'ER': task.engagementReviewerApprovedAt,
                        'SP': task.signingPartnerApprovedAt
                    }[layer];

                    const canSignOff = (
                        task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION &&
                        task.status !== TaskStatus.COMPLETED &&
                        ((layer === 'TL') || 
                         (layer === 'ER' && !!task.teamLeadApprovedAt) ||
                         (layer === 'SP' && !!task.engagementReviewerApprovedAt))
                    );

                    return (
                        <div key={layer} className={`glass-pane border-white/5 bg-[#080a0e] rounded-[32px] overflow-hidden shadow-2xl relative transition-all duration-500 ${isSignedOff ? 'ring-1 ring-emerald-500/20' : ''}`}>
                            <div className={`absolute top-0 left-0 w-1.5 h-full bg-${meta.color}-500 opacity-40`} />

                            <div className="px-6 py-5 border-b border-white/[0.04] flex items-center justify-between bg-black/20">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-[18px] bg-${meta.color}-500/10 flex items-center justify-center border border-${meta.color}-500/20 text-${meta.color}-400 shadow-xl shadow-${meta.color}-500/5`}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">{meta.title}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Protocol Execution Layer</span>
                                            {isSignedOff && (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                                    <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Verified & Locked</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.uid === task.teamLeaderId) && !isSignedOff && !isTaskCompleted && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-[#0d1017] border border-white/10 rounded-xl p-0.5 shadow-inner mr-2">
                                                <select 
                                                    id={`templateSelect-${layer}`}
                                                    defaultValue=""
                                                    onChange={(e) => {
                                                        const templateId = e.target.value;
                                                        if (!templateId) return;
                                                        
                                                        const matchingTemplate = templates.find(t => t.id === templateId);
                                                        if (matchingTemplate && matchingTemplate.reviewChecklist) {
                                                            const mappedChecklist = (matchingTemplate.reviewChecklist as any[]).map((item: any) => ({
                                                                status: 'PENDING',
                                                                priority: 'MEDIUM',
                                                                isCompleted: false,
                                                                ...item,
                                                                id: Math.random().toString(36).substring(2, 9),
                                                                reviewerRole: layer
                                                            }));
                                                            onChange({ reviewChecklist: [...(task.reviewChecklist || []), ...mappedChecklist] });
                                                            toast.success(`Checklist integrated from ${matchingTemplate.name}`, { icon: '✨' });
                                                            e.target.value = ""; // Reset selector
                                                        }
                                                    }}
                                                    className="bg-transparent outline-none border-none text-[9px] font-black uppercase tracking-widest text-brand-300/80 px-2 max-w-[180px] truncate cursor-pointer"
                                                >
                                                    <option value="">Quick Import Template...</option>
                                                    {templates.filter(t => (t.category === 'REVIEWER_CHECKLIST' || t.category === 'TASK') && t.reviewChecklist && t.reviewChecklist.length > 0).map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <div className="px-2 text-gray-700">
                                                    <Download size={11} strokeWidth={3} />
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => {
                                                    const newSection: ReviewChecklistItem = {
                                                        id: Math.random().toString(36).substring(2, 9),
                                                        title: '',
                                                        reviewerRole: layer,
                                                        isSectionHeader: true,
                                                        status: 'PENDING',
                                                        priority: 'MEDIUM',
                                                        isCompleted: false
                                                    };
                                                    onChange({ reviewChecklist: [...(task.reviewChecklist || []), newSection] });
                                                }}
                                                className="h-9 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2 transition-all active:scale-95"
                                            >
                                                <Plus size={14} strokeWidth={3} /> Add Section
                                            </button>
                                            <button 
                                                onClick={() => addReviewRow(layer)}
                                                className="h-9 px-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 transition-all active:scale-95"
                                            >
                                                <Plus size={14} strokeWidth={3} /> Add Procedure
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/60 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                                            <th className="px-4 py-3 border-b border-white/5 w-16 text-center">REF</th>
                                            <th className="px-4 py-3 border-b border-white/5">PROTOCOL PROCEDURE / REQUIREMENT</th>
                                            <th className="px-4 py-3 border-b border-white/5 w-32 text-center">STATUS</th>
                                            <th className="px-4 py-3 border-b border-white/5 w-28 text-center">PRIORITY</th>
                                            <th className="px-4 py-3 border-b border-white/5 min-w-[250px]">NOTES / WP REF</th>
                                            {!isSignedOff && <th className="px-4 py-3 border-b border-white/5 w-16 text-center"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-20 text-center">
                                                    <div className="flex flex-col items-center gap-6">
                                                        <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/5 opacity-40">
                                                            <ClipboardCheck size={32} />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white">No Protocol Loaded</p>
                                                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Required for engagement sign-off</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((item, idx) => {
                                                const isLocked = isTaskCompleted || (isSignedOff && user?.role !== UserRole.MASTER_ADMIN);
                                                
                                                return item.isSectionHeader ? (
                                                    <tr key={item.id} className="bg-indigo-500/5 group">
                                                        <td className="px-4 py-3 text-[11px] font-black text-indigo-500/50 text-center uppercase tracking-widest">
                                                            {String.fromCharCode(65 + items.filter((it, i) => it.isSectionHeader && i <= items.indexOf(item)).length - 1)}
                                                        </td>
                                                        <td colSpan={4} className="px-4 py-3">
                                                            <input 
                                                                type="text" 
                                                                value={item.title}
                                                                onChange={(e) => updateReviewItemField(item.id, 'title', e.target.value, isLocked)}
                                                                readOnly={isLocked}
                                                                className="w-full bg-transparent border-none text-[10px] font-black text-indigo-400 placeholder:text-indigo-900/30 focus:outline-none focus:ring-0 p-0 uppercase tracking-widest"
                                                                placeholder="SECTION NAME (e.g. A | GENERAL PROCEDURES)"
                                                            />
                                                        </td>
                                                        {!isLocked && (
                                                            <td className="px-4 py-3 text-center">
                                                                <button 
                                                                    onClick={() => removeReviewRow(item.id, isLocked)}
                                                                    className="p-1 text-indigo-900/50 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ) : (
                                                    <tr key={item.id} className={`group transition-all ${isLocked ? 'opacity-80 bg-black/5' : 'hover:bg-white/[0.02]'}`}>
                                                        <td className="px-4 py-3 text-[11px] font-black text-gray-700 text-center">
                                                            {(() => {
                                                                const sectionsBefore = items.slice(0, items.indexOf(item)).filter(it => it.isSectionHeader);
                                                                const currentSectionIdx = sectionsBefore.length;
                                                                if (currentSectionIdx === 0) return idx + 1;
                                                                
                                                                const sectionChar = String.fromCharCode(64 + currentSectionIdx);
                                                                const idxInSection = items.slice(items.indexOf(sectionsBefore[sectionsBefore.length - 1]) + 1, items.indexOf(item)).length + 1;
                                                                return `${sectionChar}${idxInSection}`;
                                                            })()}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <input 
                                                                type="text" 
                                                                value={item.title}
                                                                onChange={(e) => updateReviewItemField(item.id, 'title', e.target.value, isLocked)}
                                                                readOnly={isLocked}
                                                                className="w-full bg-transparent border-none text-[12px] font-bold text-white placeholder:text-gray-800 focus:outline-none focus:ring-0 p-0"
                                                                placeholder="Checking procedure..."
                                                            />
                                                            {item.minimumRequirement && (
                                                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-0.5 opacity-50">{item.minimumRequirement}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <button 
                                                                onClick={() => toggleReviewItemStatus(item.id, isLocked)}
                                                                disabled={isLocked}
                                                                className={`mx-auto h-8 px-4 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all border shadow-sm ${
                                                                    item.status === 'OK' ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20' : 
                                                                    item.status === 'ISSUE' ? 'bg-rose-500 text-white border-rose-600 shadow-rose-500/20' : 
                                                                    'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                                                }`}
                                                            >
                                                                {item.status === 'OK' && <CheckCircle2 size={12} strokeWidth={3} />}
                                                                {item.status === 'ISSUE' && <AlertTriangle size={12} strokeWidth={3} />}
                                                                {item.status || 'PENDING'}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="relative group/sel mx-auto w-fit">
                                                                <select
                                                                    value={item.priority || 'MEDIUM'}
                                                                    onChange={(e) => updateReviewItemField(item.id, 'priority', e.target.value, isLocked)}
                                                                    disabled={isLocked}
                                                                    className={`appearance-none bg-white border border-slate-200 rounded-xl px-4 py-1 pr-8 text-[10px] font-black uppercase tracking-widest text-center focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer disabled:cursor-not-allowed ${
                                                                        item.priority === 'CRITICAL' ? 'text-rose-500 border-rose-200' : 
                                                                        item.priority === 'HIGH' ? 'text-amber-500 border-amber-200' : 'text-brand-500 border-indigo-100'
                                                                    }`}
                                                                >
                                                                    <option value="CRITICAL">Critical</option>
                                                                    <option value="HIGH">High</option>
                                                                    <option value="MEDIUM">Medium</option>
                                                                </select>
                                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                                    <ChevronDown size={10} strokeWidth={3} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className={`border rounded-xl p-0.5 transition-all ${isLocked ? 'bg-black/5 border-transparent' : 'bg-white/5 border-white/5 focus-within:border-brand-500/30'}`}>
                                                                <textarea 
                                                                    rows={1}
                                                                    value={item.notes || ''}
                                                                    onChange={(e) => {
                                                                        updateReviewItemField(item.id, 'notes', e.target.value, isLocked);
                                                                        e.target.style.height = 'auto';
                                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                                    }}
                                                                    readOnly={isLocked}
                                                                    className="w-full bg-transparent border-none text-[11px] font-bold text-gray-400 placeholder:text-gray-800 focus:outline-none focus:ring-0 px-3 py-1.5 resize-none custom-scrollbar"
                                                                    placeholder="WP reference / review notes..."
                                                                />
                                                            </div>
                                                        </td>
                                                        {!isLocked && (
                                                            <td className="px-4 py-3 text-center">
                                                                <button 
                                                                    onClick={() => removeReviewRow(item.id, isLocked)}
                                                                    className="p-1.5 text-gray-800 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="px-8 py-6 bg-black/40 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 relative">
                                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                    <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <div className={`w-1 h-3 bg-${meta.color}-500 rounded-full`} />
                                        Sign-off Execution Area
                                    </h4>
                                    <div className="text-lg font-black text-white italic truncate max-w-2xl">
                                        {isSignedOff 
                                            ? `Digital Protocol Verified & Sealed by ${meta.role}.` 
                                            : !canSignOff && task.auditPhase !== AuditPhase.REVIEW_AND_CONCLUSION 
                                                ? `Sign-off is only available during the ${AuditPhase.REVIEW_AND_CONCLUSION.replace(/_/g, ' ')} phase.`
                                                : task.status === TaskStatus.COMPLETED
                                                    ? `Task is already completed. Sign-off is no longer available.`
                                                    : `I hereby certify that I have checked the items above in accordance with established Audit Standards.`}
                                    </div>
                                    {isSignedOff && (
                                        <p className="text-[11px] font-bold text-emerald-400 flex items-center gap-2 mt-1">
                                            <CheckCircle2 size={14} /> Signed on {new Date(signOffDate!).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    )}
                                </div>

                                <button 
                                    onClick={() => handleReviewSignOff(layer)}
                                    disabled={isSignedOff || !canSignOff}
                                    className={`h-12 px-8 rounded-[16px] text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all shadow-xl relative overflow-hidden group/btn ${
                                        isSignedOff 
                                            ? 'bg-emerald-500/10 text-emerald-400 border-2 border-emerald-500/20 cursor-default shadow-emerald-500/5' 
                                            : !canSignOff
                                                ? 'bg-white/5 text-gray-700 border border-white/5 cursor-not-allowed grayscale'
                                                : `bg-${meta.color}-500 text-white hover:bg-${meta.color}-600 active:scale-95 shadow-${meta.color}-500/30`
                                    }`}
                                >
                                    {isSignedOff ? <CheckCircle2 size={18} strokeWidth={3} /> : <ShieldCheck size={18} strokeWidth={3} />}
                                    <span>{isSignedOff ? 'SIGNED' : `SIGN AS ${layer}`}</span>
                                    
                                    {!isSignedOff && canSignOff && (
                                        <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 pointer-events-none" />
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
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
                addedBy: user?.uid,
                addedByName: user?.displayName || 'System',
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
                addedBy: user?.uid,
                addedByName: user?.displayName || 'System',
                phase: importPhase,
                isNew: true
            }));
        }

        if (newSubtasks.length > 0) {
            const updates: any = { subtasks: [...(task.subtasks || []), ...newSubtasks] };
            
            // 3. NEW: If template has a reviewer checklist, import it too
            if (template.reviewChecklist && template.reviewChecklist.length > 0) {
                const mappedChecklist = template.reviewChecklist.map((item: any) => ({
                    ...item,
                    id: Math.random().toString(36).substring(2, 9),
                    status: 'PENDING'
                }));
                updates.reviewChecklist = [...(task.reviewChecklist || []), ...mappedChecklist];
            }

            onChange(updates);
            if (newSubtasks.length > 0 && !toast.loading) {
                toast.success(`Imported protocol requirements into engagement workspace`, { icon: '📥' });
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
                <Unlock size={11} /> {role === 'TL' ? 'Verify Phase' : 'Apply Sign-off'}
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

                    {/* Modal Expansion: 1280px */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="relative w-full max-w-[1440px] h-[95vh] bg-white dark:bg-[#0c0e12] shadow-[0_32px_128px_rgba(0,0,0,0.4)] flex flex-col rounded-3xl overflow-hidden"
                    >
                        {/* Header — Slim & High Density */}
                        <div className="shrink-0 px-8 py-2.5 border-b border-black/5 dark:border-white/[0.04] flex justify-between items-center bg-gray-50/50 dark:bg-[#0c0e12]/50 backdrop-blur-xl z-[60]">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center border border-brand-500/20 shadow-inner">
                                    <Shield size={16} className="text-brand-400" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        {task.taskType && (
                                            <span className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-400 text-[9px] font-black uppercase tracking-widest border border-brand-500/20 shadow-sm">
                                                {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                                            </span>
                                        )}
                                        {watchedFiscalYear && (
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-sm">
                                                FY {watchedFiscalYear}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-[15px] font-bold text-white tracking-tight leading-tight mt-0.5">{watch('title') || task.title || 'Untitled Engagement'}</h3>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end mr-4">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest leading-none">Overall Progress</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className="h-full bg-gradient-to-r from-emerald-500 to-brand-500 transition-all duration-1000"
                                                style={{ width: `${Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / (task.subtasks || []).length) * 100 || 0)}%` }}
                                            />
                                        </div>
                                        <span className="text-[11px] font-black text-brand-400 leading-none">
                                            {Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / (task.subtasks || []).length) * 100 || 0)}%
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCloseAttempt}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all border border-white/5 active:scale-95"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Secondary Navigation — Slim & High Density */}
                        <div className="shrink-0 bg-white/80 dark:bg-[#0c0e12] border-b border-black/5 dark:border-white/[0.04] px-8 py-3 flex flex-wrap items-center justify-between gap-4 z-50">
                            {/* Main Tabs - Redesigned to match mockup */}
                            <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/[0.03] p-1 rounded-full border border-black/5 dark:border-white/5 shadow-inner">
                                {(task.id ? [
                                    { id: 'OVERVIEW', label: 'Overview', icon: <Activity size={14} /> },
                                    { id: 'PROCEDURES', label: 'Sub task', icon: <ClipboardCheck size={14} /> },
                                    { id: 'EVIDENCE', label: 'Evidence Repository', icon: <FolderOpen size={14} /> },
                                    { id: 'OBSERVATIONS', label: 'Engagement Findings', icon: <Eye size={14} /> },
                                    { id: 'REVIEW_CHECKLIST', label: 'Reviewer Checklist', icon: <ShieldCheck size={14} /> },
                                    { id: 'COMMENTS', label: 'Collaborate', icon: <MessageSquare size={14} />, badge: (task.comments || []).length },
                                    { id: 'SETTINGS', label: 'Settings', icon: <Settings2 size={14} /> }
                                ] : [
                                    { id: 'SETTINGS', label: 'Task Detail', icon: <Settings2 size={14} /> },
                                    { id: 'PROCEDURES', label: 'Sub task', icon: <ClipboardCheck size={14} /> }
                                ]).map((tab: any) => {
                                    const isActive = activeDetailTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveDetailTab(tab.id as any)}
                                            className={`relative flex items-center gap-2 px-6 py-2 rounded-[28px] text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                                                isActive 
                                                    ? 'bg-brand-500 text-white shadow-md' 
                                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <span className={`transition-colors ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`}>{tab.icon}</span>
                                            {tab.label}
                                            {tab.badge ? (
                                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] leading-none ${isActive ? 'bg-white/20 text-white' : 'bg-brand-500/10 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400'}`}>
                                                    {tab.badge}
                                                </span>
                                            ) : null}
                                            {/* Small activity dot just like the mockup */}
                                            {isActive && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-white dark:border-[#0c0e12]" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-2">
                                {activeDetailTab === 'PROCEDURES' && (
                                    <button
                                        onClick={(e) => { e.preventDefault(); setImportPhase(currentPhase); }}
                                        className="px-6 py-2 bg-emerald-50 text-emerald-700 dark:bg-brand-500/10 border border-emerald-200 dark:border-brand-500/30 dark:text-brand-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 dark:hover:bg-brand-500/20 transition-all flex items-center gap-2 group shadow-sm"
                                    >
                                        <Sparkles size={14} className="group-hover:animate-spin" /> Import Protocol
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Layout */}
                        <div className="flex-1 overflow-hidden bg-[#f8f9fa] dark:bg-[#080a0e] flex flex-col">
                            {activeDetailTab === 'OVERVIEW' && (
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

                                                    <button 
                                                        onClick={() => setActiveDetailTab('SETTINGS')}
                                                        className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] transition-all border border-white/5 flex items-center justify-center gap-2"
                                                    >
                                                        <Settings2 size={12} /> Manage Engagement
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'PROCEDURES' && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <div className="max-w-[1600px] w-full mx-auto p-3 md:p-4 space-y-4 pb-32">
                                        
                                        {/* Engagement Stepper Redesigned */}
                                        <div className="bg-white dark:bg-white/5 rounded-[24px] p-2 flex items-center justify-between shadow-sm border border-black/5 dark:border-white/10 w-fit mx-auto">
                                            {[
                                                { id: AuditPhase.ONBOARDING, label: 'Onboarding', icon: <Map size={16} /> },
                                                { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Planning and Execution', icon: <Activity size={16} /> },
                                                { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Review and Conclusion', icon: <CheckCircle2 size={16} /> }
                                            ].map((p, i, arr) => {
                                                const isActive = watch('auditPhase') === p.id;
                                                const isPast = PHASE_ORDER[watch('auditPhase') as AuditPhase] > PHASE_ORDER[p.id];
                                                
                                                return (
                                                    <React.Fragment key={p.id}>
                                                        <button
                                                            onClick={() => handlePhaseSwitch(p.id)}
                                                            className={`flex items-center gap-3 px-6 py-2.5 rounded-full transition-all duration-300 ${
                                                                isActive 
                                                                    ? 'bg-emerald-50 dark:bg-brand-500/20 text-emerald-700 dark:text-brand-400' 
                                                                    : isPast 
                                                                        ? 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5' 
                                                                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                                                            }`}
                                                        >
                                                            <div className={`p-1 rounded-full ${isActive ? 'bg-emerald-100 dark:bg-brand-500/30' : ''}`}>
                                                                {isPast ? <CheckCircle2 size={16} /> : p.icon}
                                                            </div>
                                                            <span className="text-[12px] font-bold tracking-tight">{p.label}</span>
                                                        </button>
                                                        {i < arr.length - 1 && <div className="w-px h-6 bg-black/5 dark:bg-white/5 mx-2" />}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </div>

                                        <div className="grid grid-cols-1 w-full gap-y-8">
                                            {[AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION].map(phase => {
                                                const phaseSubtasks = (task.subtasks || []).filter(st => st.phase === phase);
                                                const isCurrent = currentPhase === phase;
                                                const isPast = PHASE_ORDER[phase] < PHASE_ORDER[currentPhase];
                                                
                                                if (!isCurrent && !isPast) return null;

                                                return (
                                                    <div key={phase} className={`space-y-4 bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-[28px] p-6 shadow-sm ${!isCurrent ? 'opacity-80' : ''}`}>
                                                        {/* Phase Header */}
                                                        <div className="flex items-center justify-between mb-4 px-2">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                                                                    isCurrent 
                                                                        ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' 
                                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                                }`}>
                                                                    {PHASE_ICONS[phase]}
                                                                </div>
                                                                <div>
                                                                    <h5 className="text-[13px] font-black uppercase tracking-widest text-white">
                                                                        {PHASE_LABELS_FULL[phase]} {isCurrent && <span className="inline-flex items-center gap-1.5 ml-3 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-[9px] border border-brand-500/20">● Active</span>}
                                                                    </h5>
                                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                                        {isPast ? 'Verification Log' : 'Execution Queue'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="h-px flex-1 bg-black/5 dark:bg-white/5 mx-8" />
                                                            <div className="text-right">
                                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                                    {phaseSubtasks.filter(s => s.isCompleted).length}/{phaseSubtasks.length} Done
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {phaseSubtasks.length === 0 ? (
                                                                <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-[24px] bg-white/[0.01]">
                                                                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest font-bold">No sub-tasks defined for this phase</p>
                                                                </div>
                                                            ) : (
                                                                phaseSubtasks.map((st, i) => renderSubtask(st, i))
                                                            )}
                                                        </div>



                                                        {isCurrent && canAddSubtasks && (
                                                            <div className="flex gap-3 items-center px-4 py-2 rounded-[20px] border border-white/5 bg-white/[0.02] mt-4 focus-within:border-brand-500/30 transition-all shadow-inner group">
                                                                <Plus size={14} className="text-gray-600 group-focus-within:text-brand-400 transition-colors" />
                                                                <input
                                                                    type="text"
                                                                    value={localSubtaskTitles[phase] || ''}
                                                                    onChange={(e) => setLocalSubtaskTitles(prev => ({ ...prev, [phase]: e.target.value }))}
                                                                    placeholder={`Add sub-task to ${PHASE_LABELS_FULL[phase]}...`}
                                                                    className="flex-1 bg-transparent text-[12px] text-white outline-none font-bold placeholder:text-gray-700"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            handleQuickAddSubtask(phase);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'EVIDENCE' && (
                                <div className="flex-1 flex overflow-hidden">
                                     {/* Left Pane: Folder Navigation */}
                                    <div className="w-80 border-r border-white/[0.04] p-8 space-y-8 overflow-y-auto custom-scrollbar">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Audit Repository</h4>
                                            <button 
                                                onClick={loadAuditFiles}
                                                className="p-1.5 text-gray-500 hover:text-white transition-all"
                                                title="Sync Repository"
                                            >
                                                <History size={14} className={isLoadingDocs ? 'animate-spin' : ''} />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {Object.entries(AUDIT_FOLDER_STRUCTURE).map(([key, def]) => {
                                                const isSelected = selectedFolderForUpload === key;
                                                const fileCount = auditFiles.filter(f => f.folderKey === key).length;
                                                
                                                return (
                                                    <div key={key} className="space-y-1">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedFolderForUpload(key as any);
                                                                setSelectedLineItemForUpload('');
                                                            }}
                                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all border ${
                                                                isSelected 
                                                                    ? 'bg-brand-500 border-brand-400 text-white shadow-lg' 
                                                                    : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/10'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <FolderOpen size={16} className={isSelected ? 'text-white' : 'text-brand-500/60'} />
                                                                <span className="text-[12px] font-bold truncate tracking-tight">{def.label}</span>
                                                            </div>
                                                            {fileCount > 0 && (
                                                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-brand-500/20 text-brand-400'}`}>
                                                                    {fileCount}
                                                                </span>
                                                            )}
                                                        </button>

                                                        {isSelected && (
                                                            <div className="ml-4 pl-4 border-l border-white/10 space-y-1 pt-1 pb-2">
                                                                {/* Native Line Items (for B) */}
                                                                {def.lineItems?.map(item => {
                                                                    const isItemSelected = selectedLineItemForUpload === item;
                                                                    const itemFileCount = auditFiles.filter(f => f.lineItem === item).length;
                                                                    
                                                                    return (
                                                                        <button
                                                                            key={item}
                                                                            onClick={() => setSelectedLineItemForUpload(item)}
                                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-medium transition-all ${
                                                                                isItemSelected ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                                                            }`}
                                                                        >
                                                                            <span className="truncate pr-2">{item}</span>
                                                                            {itemFileCount > 0 && <span className="opacity-60">{itemFileCount}</span>}
                                                                        </button>
                                                                    );
                                                                })}

                                                                {/* Custom Sub-folders — Read-only display */}
                                                                {customFolders.filter(f => f.folderKey === key && (key !== 'B' || f.lineItem === selectedLineItemForUpload)).map(folder => (
                                                                    <div key={folder.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-medium text-gray-400">
                                                                        <div className="flex items-center gap-2 truncate">
                                                                            <Folder size={12} className="text-amber-500/50" />
                                                                            <span className="truncate">{folder.name}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}

                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Right Pane: File Listing & Upload */}
                                    <div className="flex-1 glass-pane bg-[#080a0e] flex flex-col overflow-hidden">
                                        <div className="shrink-0 p-8 border-b border-white/[0.04] flex items-center justify-between bg-black/20">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20">
                                                    <FileText size={18} className="text-brand-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-[14px] font-black text-white uppercase tracking-[0.2em]">Documentation Repository</h3>
                                                    <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                                        {selectedFolderForUpload ? `${AUDIT_FOLDER_STRUCTURE[selectedFolderForUpload as AuditFolderKey]?.label} ${selectedLineItemForUpload ? `→ ${selectedLineItemForUpload}` : ''}` : 'Select a folder to manage files'}
                                                    </p>
                                                </div>
                                            </div>

                                            {selectedFolderForUpload && (
                                                <div className="flex items-center gap-3">
                                                    <label className="flex items-center gap-2.5 px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-lg shadow-brand-500/20 active:scale-95">
                                                        <CloudUpload size={14} /> Upload Evidence
                                                        <input 
                                                            type="file" 
                                                            className="hidden" 
                                                            multiple
                                                            onChange={(e) => handleFileUpload(e.target.files)}
                                                            disabled={isUploadingDoc}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                                            {isLoadingDocs ? (
                                                <div className="h-full flex flex-col items-center justify-center py-24 gap-4 opacity-50">
                                                    <Loader2 size={48} className="text-brand-500 animate-spin" strokeWidth={1.5} />
                                                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-gray-500">Synchronizing Vault...</p>
                                                </div>
                                            ) : !selectedFolderForUpload ? (
                                                <div className="h-full flex flex-col items-center justify-center py-24 gap-6 text-center opacity-40">
                                                    <div className="w-24 h-24 rounded-[32px] bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
                                                        <FolderOpen size={48} className="text-gray-700" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[15px] font-black uppercase tracking-[0.3em] text-white">Repository Offline</p>
                                                        <p className="text-[10px] font-medium text-gray-600 uppercase tracking-[0.2em] mt-4">Select a target folder from the left pane to access documentation.</p>
                                                    </div>
                                                </div>
                                            ) : (() => {
                                                const currentFiles = auditFiles.filter(f => 
                                                    f.folderKey === selectedFolderForUpload && 
                                                    (!selectedLineItemForUpload || f.lineItem === selectedLineItemForUpload)
                                                );

                                                if (currentFiles.length === 0) {
                                                    return (
                                                        <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/[0.01] flex flex-col items-center gap-6">
                                                            <FileSearch size={48} className="text-gray-800 opacity-20" />
                                                            <div>
                                                                <p className="text-[13px] font-black text-white uppercase tracking-[0.2em]">Vault is Empty</p>
                                                                <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest mt-2 px-10">No documentation has been synchronized to this slot for the selected client and fiscal year.</p>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        {/* Read-Only Notice */}
                                                        <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-2xl border"
                                                            style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
                                                            <div className="shrink-0 mt-0.5">
                                                                <ShieldCheck size={14} style={{ color: '#f59e0b' }} />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f59e0b' }}>Read-Only View</p>
                                                                <p className="text-[9px] font-medium mt-0.5" style={{ color: 'rgba(245,158,11,0.6)' }}>
                                                                    Files displayed here are read-only references. To delete or reorganize files, use the <strong style={{ color: '#f59e0b' }}>Audit Documentation</strong> module with appropriate authorization.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                                        {currentFiles.map(file => (
                                                            <div key={file.id} className="group relative bg-[#0f1218] border border-white/5 rounded-2xl p-4 transition-all hover:bg-white/[0.03] hover:border-brand-500/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                                                                <div className="flex items-start justify-between mb-4">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${file.mimeType.includes('pdf') ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                                                        {file.mimeType.includes('image') ? <ExternalLink size={18} /> : <FileText size={18} />}
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => window.open(AppwriteService.getFileView(file.appwriteFileId), '_blank')}
                                                                        className="p-2 bg-white/5 rounded-lg text-gray-500 hover:text-white hover:bg-brand-500 transition-all opacity-0 group-hover:opacity-100"
                                                                    >
                                                                        <ExternalLink size={14} />
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-[12px] font-bold text-gray-100 truncate pr-4" title={file.fileName}>{file.fileName}</p>
                                                                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                                                                        {Math.round(file.fileSize / 1024)} KB • {new Date(file.uploadedAt).toLocaleDateString()}
                                                                    </p>
                                                                </div>
                                                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
                                                                    <div className="w-5 h-5 rounded-full bg-brand-500/20 flex items-center justify-center text-[7px] font-black text-brand-400">
                                                                        {(file.uploadedByName || '?').substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <span className="text-[9px] font-bold text-gray-600 truncate">{file.uploadedByName}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'OBSERVATIONS' && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                                    <div className="max-w-[1600px] w-full mx-auto space-y-6">
                                        <div className="flex items-center justify-between px-2">
                                            <div className="flex flex-col gap-2">
                                                <h4 className="text-[15px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                                                    Audit Observations
                                                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-black border border-amber-500/10">
                                                        {(task.observations || []).length} FINDINGS
                                                    </span>
                                                </h4>
                                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em]">Documentation of technical issues and internal control weaknesses</p>
                                            </div>
                                            {!isTaskCompleted && (
                                                <button
                                                    onClick={handleAddObservation}
                                                    className="px-6 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center gap-2 group"
                                                >
                                                    <Plus size={14} /> Log New Observation
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-6">
                                            {(task.observations || []).length === 0 ? (
                                                <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[48px] bg-white/[0.01]">
                                                    <FileSearch size={64} className="mx-auto text-gray-800 opacity-20 mb-6" />
                                                    <p className="text-[13px] font-black text-gray-300 uppercase tracking-[0.2em]">No Findings Recorded</p>
                                                    <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest mt-2">Clear engagement. No technical observations found during execution.</p>
                                                </div>
                                            ) : (
                                                task.observations!.map((obs, idx) => (
                                                     <div key={obs.id} className="bg-[#0f1218] border border-white/5 rounded-[24px] p-6 space-y-5 relative group/obs hover:border-amber-500/20 transition-all shadow-xl">
                                                         <div className="flex items-center justify-between">
                                                             <div className="flex-1 flex items-center gap-4">
                                                                 <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                                                                     <ShieldAlert size={18} />
                                                                 </div>
                                                                 <div className="flex-1 flex flex-col">
                                                                    <input 
                                                                        value={obs.title} 
                                                                        onChange={e => handleUpdateObservation(obs.id, { title: e.target.value })}
                                                                        readOnly={isTaskCompleted || (isAdminOrMaster && user?.uid !== obs.createdBy)}
                                                                        className="bg-transparent text-[16px] font-bold text-white border-none outline-none placeholder:text-gray-800 tracking-tight w-full"
                                                                        placeholder="Observation Title..."
                                                                    />
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Created by:</span>
                                                                        <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest">{obs.createdByName || 'Unknown'}</span>
                                                                    </div>
                                                                 </div>
                                                             </div>
                                                             <div className="flex items-center gap-3">
                                                                 <select 
                                                                     value={obs.severity} 
                                                                     onChange={e => handleUpdateObservation(obs.id, { severity: e.target.value as any })}
                                                                     disabled={isTaskCompleted || (isAdminOrMaster && user?.uid !== obs.createdBy)}
                                                                     className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                                         obs.severity === 'HIGH' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                                         obs.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                         'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                                     }`}
                                                                 >
                                                                     <option value="LOW">Low Risk</option>
                                                                     <option value="MEDIUM">Medium Risk</option>
                                                                     <option value="HIGH">High Risk</option>
                                                                 </select>
                                                                 {!isTaskCompleted && (user?.uid === obs.createdBy) && (
                                                                     <button onClick={() => handleRemoveObservation(obs.id)} className="p-1.5 text-gray-700 hover:text-rose-400 transition-all opacity-0 group-hover/obs:opacity-100"><Trash2 size={14} /></button>
                                                                 )}
                                                             </div>
                                                         </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1 flex items-center gap-2"><div className="w-1 h-2.5 bg-amber-500 rounded-full" /> Detail & Context</label>
                                                                <textarea 
                                                                    value={obs.observation}
                                                                    onChange={e => handleUpdateObservation(obs.id, { observation: e.target.value })}
                                                                    readOnly={isTaskCompleted}
                                                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[12px] text-gray-200 outline-none focus:border-amber-500/30 transition-all min-h-[50px] shadow-inner resize-y"
                                                                    placeholder="Describe the finding in detail..."
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1 flex items-center gap-2"><div className="w-1 h-2.5 bg-rose-500 rounded-full" /> Implication / Risk</label>
                                                                <textarea 
                                                                    value={obs.implication}
                                                                    onChange={e => handleUpdateObservation(obs.id, { implication: e.target.value })}
                                                                    readOnly={isTaskCompleted}
                                                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[12px] text-gray-200 outline-none focus:border-rose-500/30 transition-all min-h-[50px] shadow-inner resize-y"
                                                                    placeholder="What is the potential impact of this issue?"
                                                                />
                                                            </div>
                                                            <div className="space-y-2 md:col-span-2">
                                                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1 flex items-center gap-2"><div className="w-1 h-2.5 bg-brand-500 rounded-full" /> Audit Recommendation</label>
                                                                <textarea 
                                                                    value={obs.recommendation}
                                                                    onChange={e => handleUpdateObservation(obs.id, { recommendation: e.target.value })}
                                                                    readOnly={isTaskCompleted}
                                                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[12px] text-gray-200 outline-none focus:border-brand-500/30 transition-all min-h-[50px] shadow-inner resize-y"
                                                                    placeholder="Suggested management response or technical fix..."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                             {activeDetailTab === 'REVIEW_CHECKLIST' && (
                                 <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-black/20">
                                     <div className="max-w-[1600px] w-full mx-auto pb-32">
                                         {renderReviewerChecklist()}
                                     </div>
                                 </div>
                             )}

                            {activeDetailTab === 'COMMENTS' && (
                                <div className="flex-1 overflow-hidden flex flex-col p-2">
                                    <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col bg-[#0c1218]/40 border border-white/5 rounded-[32px] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all">
                                        <div className="flex-1 overflow-hidden p-4 md:p-6">
                                            <TaskComments 
                                                comments={task.comments} 
                                                users={usersList} 
                                                onAddComment={onAddComment} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'SETTINGS' && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                                    <div className="max-w-[1600px] w-full mx-auto space-y-8 pb-32">
                                        
                                        {/* Main Form Fields Grouped */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 p-6 md:p-8 bg-white/[0.02] border border-white/5 rounded-[32px] shadow-inner">
                                            <Field label="Assignment Title" icon={<FileText size={14} className="text-brand-400" />} span2>
                                                <input
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[14px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all shadow-inner"
                                                    placeholder="Enter engagement title..."
                                                    {...register('title')}
                                                    readOnly={!canManageTeam}
                                                />
                                            </Field>

                                            <Field label="Target Client" icon={<Briefcase size={14} className="text-brand-400" />} error={!!errors.clientId}>
                                                <Controller name="clientId" control={control} render={({ field }) => (
                                                    <ClientSelect 
                                                        clients={clientsList} 
                                                        value={field.value} 
                                                        onChange={field.onChange} 
                                                        disabled={!canManageTeam}
                                                    />
                                                )} />
                                            </Field>

                                            <Field label="Fiscal Year (BS)" icon={<Calendar size={14} className="text-emerald-400" />} error={!!errors.fiscalYear}>
                                                <select 
                                                    className={selectClass} 
                                                    {...register('fiscalYear')}
                                                    disabled={!canManageTeam}
                                                >
                                                    <option value="" className="bg-navy-900">Select...</option>
                                                    {fiscalYears.map(fy => (
                                                        <option key={fy} value={fy} className="bg-navy-900 font-bold">{fy}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Priority" icon={<Zap size={14} className="text-amber-400" />} error={!!errors.priority}>
                                                <select className={selectClass} {...register('priority')}>
                                                    {Object.values(TaskPriority).map(p => (
                                                        <option key={p} value={p} className="bg-navy-900 font-bold uppercase">{p}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Status" icon={<Activity size={14} className="text-blue-400" />} error={!!errors.status}>
                                                <select className={selectClass} {...register('status')}>
                                                    {[TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED].map(s => (
                                                        <option key={s} value={s} className="bg-navy-900 font-bold uppercase">{s.replace(/_/g, ' ')}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Staff Team Assigned" icon={<Users size={14} className="text-brand-400" />} span2>
                                                <Controller name="assignedTo" control={control} render={({ field }) => (
                                                    <StaffSelect users={usersList} value={field.value || []} onChange={field.onChange} multi={true} userTasksCount={userTasksCount} disabled={!canManageTeam} />
                                                )} />
                                            </Field>

                                            <Field label="Start Date" icon={<Calendar size={14} className="text-emerald-400" />} error={!!errors.startDate}>
                                                <Controller
                                                    name="startDate"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <NepaliDatePicker
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            placeholder="Select start date..."
                                                            disabled={!canManageTeam}
                                                        />
                                                    )}
                                                />
                                            </Field>

                                            <Field label="Due Date" icon={<Clock size={14} className="text-rose-400" />} error={!!errors.dueDate}>
                                                <Controller
                                                    name="dueDate"
                                                    control={control}
                                                    render={({ field }) => (
                                                        <NepaliDatePicker
                                                            value={field.value || ''}
                                                            onChange={field.onChange}
                                                            placeholder="Select due date..."
                                                            disabled={!canManageTeam}
                                                        />
                                                    )}
                                                />
                                            </Field>

                                            <Field label="Engagement Description" icon={<Book size={14} className="text-gray-500" />} span2>
                                                <textarea
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] font-medium text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all shadow-inner min-h-[120px]"
                                                    placeholder="Detailed context for the assignment..."
                                                    {...register('description')}
                                                />
                                            </Field>
                                        </div>

                                        {/* Quality Control Hierarchy Section */}
                                        <div className="p-6 md:p-8 bg-[#0c1e18]/20 border border-emerald-500/10 rounded-[32px] shadow-inner space-y-8">
                                            <div className="flex items-center gap-4 border-b border-emerald-500/10 pb-4">
                                                <ShieldCheck size={20} className="text-emerald-500" />
                                                <h4 className="text-[13px] font-black text-gray-300 uppercase tracking-[0.3em]">Quality Control Hierarchy & Sign-offs</h4>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <Field 
                                                    label="Team Leader" 
                                                    icon={<UserCheck size={14} className="text-emerald-400" />}
                                                    extra={<ApprovalAction role="TL" assignedId={watch('teamLeaderId')} approvedAt={watch('teamLeadApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
                                                >
                                                    <Controller name="teamLeaderId" control={control} render={({ field }) => (
                                                        <StaffSelect users={usersList.filter(u => (watch('assignedTo') || []).includes(u.uid))} value={field.value || ''} onChange={field.onChange} placeholder="Select Team Leader..." disabled={!!watch('teamLeadApprovedAt') || !canManageTeam} compact />
                                                    )} />
                                                </Field>

                                                <Field 
                                                    label="QC Reviewer" 
                                                    icon={<Shield size={14} className="text-purple-400" />}
                                                    extra={<ApprovalAction role="ER" assignedId={watch('engagementReviewerId')} approvedAt={watch('engagementReviewerApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
                                                >
                                                    <Controller name="engagementReviewerId" control={control} render={({ field }) => (
                                                        <StaffSelect 
                                                            users={usersList} 
                                                            value={field.value || ''} 
                                                            onChange={field.onChange} 
                                                            placeholder="Select Reviewer..." 
                                                            disabled={!!watch('engagementReviewerApprovedAt') || !canManageTeam} 
                                                            compact 
                                                        />
                                                    )} />
                                                </Field>

                                                <Field 
                                                    label="Signing Partner" 
                                                    icon={<Award size={14} className="text-rose-400" />}
                                                    extra={<ApprovalAction role="SP" assignedId={watch('signingPartnerId')} approvedAt={watch('signingPartnerApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
                                                >
                                                    <Controller name="signingPartnerId" control={control} render={({ field }) => (
                                                        <StaffSelect 
                                                            users={usersList} 
                                                            value={field.value || ''} 
                                                            onChange={field.onChange} 
                                                            placeholder="Select Partner..." 
                                                            disabled={!!watch('signingPartnerApprovedAt') || !canManageTeam} 
                                                            compact 
                                                        />
                                                    )} />
                                                </Field>
                                            </div>
                                        </div>

                                        {/* Engagement Framework Switcher */}
                                        <div className="p-6 md:p-8 bg-white/[0.01] border border-white/5 rounded-[32px] space-y-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] flex items-center gap-3">
                                                    <Shield size={14} className="text-brand-400" />
                                                    Framework Deployment
                                                </h4>
                                                {!!task.taskType && !canChangeFramework && (
                                                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-full">
                                                        <Lock size={10} className="text-gray-500" />
                                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Locked to {TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {Object.values(TaskType).filter(t => t !== TaskType.OTHER).map((tType) => {
                                                    const isSelected = watch('taskType') === tType;
                                                    const iconName = TASK_TYPE_ICONS[tType] || 'FolderOpen';
                                                    const label = TASK_TYPE_LABELS[tType] || tType;

                                                    const isLocked = !canChangeFramework && !!task.taskType;

                                                    return (
                                                        <button
                                                            key={tType}
                                                            onClick={(e) => { e.preventDefault(); !isLocked && handleFrameworkSelect(tType); }}
                                                            disabled={!canManageTeam || (isLocked && !isSelected)}
                                                            className={`p-4 rounded-2xl border transition-all flex items-center text-left gap-4 group ${isSelected ? 'bg-brand-500 border-brand-400 text-white' : 'bg-[#0f1218] border-white/5 hover:border-white/20'} ${(!canManageTeam || (isLocked && !isSelected)) ? 'opacity-40 cursor-not-allowed grayscale-[0.8]' : ''}`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500 group-hover:text-brand-400'}`}>
                                                                {isSelected && isLocked ? <Lock size={14} className="text-white/40" /> : (ICON_MAP[iconName] ? React.cloneElement(ICON_MAP[iconName], { size: 14 }) : <FolderOpen size={14} />)}
                                                            </div>
                                                            <span className={`text-[10px] font-black leading-tight flex-1 uppercase tracking-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>{label}</span>
                                                            {isSelected && isLocked && (
                                                                <Check size={14} className="text-white/60" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer — Slim & High Density */}
                        <div className="shrink-0 px-8 py-2 border-t border-black/5 dark:border-white/[0.04] bg-gray-50/80 dark:bg-[#0c0e12] backdrop-blur-md flex justify-between items-center z-[60] rounded-b-3xl">
                            <div className="flex items-center gap-6">
                                {isEditMode && canManageTask && !isTaskCompleted && (
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={() => onDelete(task.id!)}
                                            className="text-gray-500 hover:text-rose-500 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95"
                                        >
                                            <Trash2 size={16} strokeWidth={3} />
                                            Abort Engagement
                                        </button>
                                    </div>
                                )}

                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && 
                                  isTaskCompleted && 
                                  task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION && 
                                  task.status !== TaskStatus.ARCHIVED && (
                                    <div className="flex items-center gap-6">
                                        <div className="w-px h-4 bg-black/10 dark:bg-white/10" />
                                        <button
                                            onClick={() => onArchive && onArchive(task.id!)}
                                            className="text-gray-500 hover:text-purple-500 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 active:scale-95"
                                        >
                                            <History size={16} strokeWidth={3} />
                                            Archive Engagement
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleCloseAttempt}
                                    className="px-8 py-2 bg-gray-200/50 hover:bg-gray-200 text-gray-700 dark:bg-transparent dark:text-gray-500 dark:hover:text-white dark:hover:bg-white/5 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-gray-300/50 dark:border-white/5 active:scale-95 shadow-sm"
                                >
                                    Exit Workspace
                                </button>
                                {!isTaskCompleted && (
                                    <button
                                        onClick={handleSubmit(handleSave)}
                                        disabled={isSaving}
                                        className="px-8 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-3"
                                    >
                                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {task.id ? 'Save task' : 'Create Task'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* Banner Alerts */}
                    <AnimatePresence>
                        {showDiscardBanner && (
                            <motion.div
                                key="discard-banner"
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 40 }}
                                className="fixed inset-x-0 bottom-6 mx-auto w-max px-4 py-2.5 bg-amber-500 rounded-2xl border border-amber-400/80 flex items-center gap-4 shadow-[0_8px_32px_rgba(245,158,11,0.35)] z-[200]"
                            >
                                <div className="flex items-center gap-2.5 text-navy-950">
                                    <AlertTriangle size={16} strokeWidth={2.5} className="flex-shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest leading-none">Unsaved Changes</span>
                                        <span className="text-[9px] font-bold opacity-70 uppercase tracking-widest mt-0.5">Exit without saving?</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setShowDiscardBanner(false)} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-navy-950 bg-white/25 hover:bg-white/40 rounded-xl transition-all border border-navy-950/10">Stay</button>
                                    <button onClick={() => { setShowDiscardBanner(false); onClose(); }} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white bg-navy-950 hover:bg-black rounded-xl transition-all">Discard</button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Subtask Template Import Modal (Remains same structure) */}
            <AnimatePresence>
                {importPhase && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-modal rounded-[48px] w-full max-w-2xl border border-white/10 shadow-[0_32px_128px_rgba(0,0,0,1)] flex flex-col max-h-[85vh] overflow-hidden">
                            <div className="px-10 py-8 border-b border-white/10 bg-white/5 flex flex-col gap-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-2xl font-black text-white flex items-center gap-4 uppercase tracking-tighter">
                                        <Book size={24} className="text-brand-400" />
                                        Import Engagement Protocol
                                    </h3>
                                    <button onClick={() => { setImportPhase(null); setTemplateSearchQuery(''); setShowAllFrameworks(false); }} className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/10"><X size={24} /></button>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="relative flex-1">
                                        <Sparkles size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Search database..."
                                            value={templateSearchQuery}
                                            onChange={e => setTemplateSearchQuery(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-[22px] pl-11 pr-5 py-4 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-brand-500/50 focus:bg-white/[0.06] transition-all"
                                        />
                                    </div>
                                    {watch('taskType') && (
                                        <button
                                            onClick={() => setShowAllFrameworks(prev => !prev)}
                                            className={`flex items-center gap-3 px-6 py-4 rounded-[22px] text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${showAllFrameworks ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-brand-500/10 border-brand-500/20 text-brand-400'}`}
                                        >
                                            {showAllFrameworks ? <Eye size={14} /> : <CheckCircle2 size={14} />}
                                            {showAllFrameworks ? 'All' : 'Suggested'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-[#080a0c]">
                                {(() => {
                                    const q = templateSearchQuery.toLowerCase();
                                    const taskType = watch('taskType');
                                    const filtered = templates.filter(t => {
                                        const matchesFramework = showAllFrameworks || !taskType || t.taskType === taskType || !t.taskType;
                                        const matchesSearch = !q || t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
                                        return matchesFramework && matchesSearch;
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <div className="text-center py-24 text-gray-700 bg-white/[0.01] rounded-[48px] border border-dashed border-white/5 px-10">
                                                <Book size={64} className="mx-auto mb-8 opacity-10" />
                                                <p className="font-black text-xl uppercase tracking-tight">No Protocol Found</p>
                                                <p className="text-xs mt-3 text-gray-800 font-medium tracking-wide">Refine search or check another framework mapping.</p>
                                            </div>
                                        );
                                    }

                                    const rootTemplates = filtered.filter(t => !t.folderId);
                                    const folderSections = templateFolders
                                        .map(folder => ({
                                            folder,
                                            templates: filtered.filter(t => t.folderId === folder.id)
                                        }))
                                        .filter(s => s.templates.length > 0);

                                    const renderTemplateButton = (template: Template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => handleImportTemplate(template)}
                                            className="flex items-center gap-5 w-full text-left p-5 rounded-[28px] border border-white/5 bg-white/[0.03] hover:bg-brand-500/10 hover:border-brand-500/30 transition-all group shadow-sm"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/20 transition-colors">
                                                <CheckCircle2 size={20} className="text-gray-600 group-hover:text-brand-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <p className="text-[13px] font-black text-gray-200 group-hover:text-white uppercase tracking-tight truncate">{template.name}</p>
                                                    {template.taskType && <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 uppercase tracking-widest">{template.taskType}</span>}
                                                </div>
                                                {template.description && <p className="text-[11px] text-gray-600 line-clamp-1 mt-1 font-medium">{template.description}</p>}
                                            </div>
                                            <div className="text-[10px] font-black text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity bg-brand-500/10 px-4 py-2 rounded-xl border border-brand-500/20 uppercase tracking-widest flex-shrink-0">Deploy</div>
                                        </button>
                                    );

                                    return (
                                        <div className="space-y-10">
                                            {rootTemplates.length > 0 && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3 px-2">
                                                        <div className="w-1.5 h-4 bg-brand-500 rounded-full" />
                                                        <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em]">Audit Library</h4>
                                                        <span className="text-[10px] text-gray-700 font-bold ml-auto">{rootTemplates.length}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {rootTemplates.map(renderTemplateButton)}
                                                    </div>
                                                </div>
                                            )}
                                            {folderSections.map(({ folder, templates: fTemplates }) => (
                                                <div key={folder.id} className="space-y-4">
                                                    <div className="flex items-center gap-3 px-2">
                                                        <div className="w-1.5 h-4 rounded-full" style={{ background: folder.color || '#6366f1' }} />
                                                        <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em]">{folder.name}</h4>
                                                        <span className="text-[10px] text-gray-700 font-bold ml-auto">{fTemplates.length}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
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
