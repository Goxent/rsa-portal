import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye, Map,
    Sparkles, Book, ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen,
    Users, UserCheck, Shield, Lock, Unlock, ExternalLink, History, CloudUpload, FileText,
    MessageSquare, Zap, Settings2, Folder, Download, ChevronDown, CheckSquare
} from 'lucide-react';
import { GoogleDriveService } from '../../services/googleDrive';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase, Template, TemplateFolder, TaskType, AuditObservation, ReviewChecklistItem } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';
import { useModal } from '../../context/ModalContext';
import { KnowledgeService } from '../../services/knowledge';
import { TemplateService } from '../../services/templates';
import { AuditDocService, AuditDocFile, AuditDocFolder } from '../../services/auditDocs';
import { AUDIT_FOLDER_STRUCTURE, AuditFolderKey } from '../../types';
import { AuditService } from '../../services/AuditService';
import { useDebounce } from 'react-use';
import StaffSelect from '../StaffSelect';
import ClientSelect from '../ClientSelect';
import TaskComments from '../TaskComments';
import NepaliDatePicker from '../NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema, TaskFormValues } from '../../utils/validationSchemas';
import { convertADToBS, generateFiscalYearOptions } from '../../utils/nepaliDate';
import { exportTaskToExcel, exportTaskToPDF } from '../../utils/taskExportUtils';
import { useMedia } from 'react-use';
import TaskCommentsTab from './tabs/TaskCommentsTab';
import TaskObservationsTab from './tabs/TaskObservationsTab';
import TaskDocumentsTab from './tabs/TaskDocumentsTab';
import TaskDetailsTab from './tabs/TaskDetailsTab';
import TaskSubtasksTab from './tabs/TaskSubtasksTab';
import TaskReviewChecklistTab from './tabs/TaskReviewChecklistTab';
import TaskHistoryTab from './tabs/TaskHistoryTab';

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
    isArchived?: boolean;
    initialTab?: string;
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
                {icon} {label} {error && <span className="text-rose-500 ml-1 animate-pulse">*</span>}
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
    userTasksCount = {},
    isArchived = false,
    initialTab
}) => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const isMobile = useMedia('(max-width: 768px)');
    const initialTaskRef = useRef<Partial<Task> | null>(null);
    const [showDiscardBanner, setShowDiscardBanner] = useState(false);
    const [showPhaseWarning, setShowPhaseWarning] = useState<AuditPhase | null>(null);
    const fiscalYears = useMemo(() => generateFiscalYearOptions(2080), []);
    const [allResources, setAllResources] = useState<Resource[]>([]);
    const [templateFolders, setTemplateFolders] = useState<TemplateFolder[]>([]);
    const [activeDetailTab, setActiveDetailTab] = useState<string>(initialTab || 'OVERVIEW');
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
    const [showExportMenu, setShowExportMenu] = useState(false);

    const descRef = useRef<HTMLTextAreaElement | null>(null);
    
    // ── AUTOSAVE LOGIC ──
    const [isDirty, setIsDirty] = useState(false);
    const [lastSavedTask, setLastSavedTask] = useState<Partial<Task>>(task);

    // Track dirty state for unsaved changes guard
    useEffect(() => {
        if (task.id) {
            const hasChanges = task.title !== lastSavedTask.title || 
                              task.description !== lastSavedTask.description ||
                              task.priority !== lastSavedTask.priority;
            setIsDirty(hasChanges);
        }
    }, [task, lastSavedTask]);

    // Debounced autosave
    useDebounce(() => {
        if (task.id && isDirty && !isSaving) {
            const updates = {
                title: task.title,
                description: task.description,
                priority: task.priority
            };
            onSave(updates);
            setLastSavedTask(prev => ({ ...prev, ...updates }));
            setIsDirty(false);
            console.log('Autosaved changes');
        }
    }, 2000, [task.title, task.description, task.priority]);

    const handleExportPDF = () => {
        try {
            const client = clientsList.find(c => c.id === task.clientIds?.[0] || c.id === task.clientId);
            exportTaskToPDF(task as Task, client);
            toast.success("PDF exported successfully");
            setShowExportMenu(false);
        } catch (err: any) {
            toast.error("Failed to export: " + err.message);
        }
    };

    const handleExportExcel = async () => {
        try {
            const client = clientsList.find(c => c.id === task.clientIds?.[0] || c.id === task.clientId);
            await exportTaskToExcel(task as Task, client);
            toast.success("Excel exported successfully");
            setShowExportMenu(false);
        } catch (err: any) {
            toast.error("Failed to export: " + err.message);
        }
    };

    const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isDirty: formIsDirty, isValid: formIsValid } } = useForm<TaskFormValues>({
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
    const isMasterAdmin = user?.role === UserRole.MASTER_ADMIN;
    const isAdminOrMaster = user?.role === UserRole.ADMIN || isMasterAdmin;
    
    // Use watched values for live UI response if they change the reviewer in settings
    const currentTLId = watch('teamLeaderId') || task.teamLeaderId;
    const currentERId = watch('engagementReviewerId') || task.engagementReviewerId;
    const currentSPId = watch('signingPartnerId') || task.signingPartnerId;

    const isTeamLeader = user?.uid === currentTLId;
    const isEngagementReviewer = user?.uid === currentERId;
    const isSigningPartner = user?.uid === currentSPId;
    const isAssignedStaff = (watch('assignedTo') || task.assignedTo || []).includes(user?.uid || '');
    
    // Core permission flag: Is the user part of this specific engagement assignment?
    const isEngagementTeamMember = isTeamLeader || isEngagementReviewer || isSigningPartner || isAssignedStaff;
    const canEditTask = (isAdminOrMaster || isEngagementTeamMember) && !isArchived;

    const canManageTeam = (isAdminOrMaster || isTeamLeader || !task.id) && !isTaskCompleted && !isArchived;
    
    // Rule: Team Leader, Engagement Staff AND Admins can ADD subtasks
    const canAddSubtasks = (isEngagementTeamMember || isAdminOrMaster) && !isTaskCompleted && !isArchived;
    
    // Rule: ONLY Team Leader can DELETE subtasks (Admins cannot, unless they are also the Team Leader)
    const canDeleteSubtasks = (isTeamLeader || isMasterAdmin) && !isTaskCompleted && !isArchived;

    const isInOnboarding = currentPhase === AuditPhase.ONBOARDING;
    const canChangeFramework = !task.id && !isTaskCompleted && !isArchived;


    // Snapshot task state whenever the pane opens
    useEffect(() => {
        if (isOpen) {
            if (isArchived) {
                setActiveDetailTab('OVERVIEW');
            }
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
            // Only require sign-off for roles that are actually assigned
            const tlAssigned = !!task.teamLeaderId;
            const erAssigned = !!task.engagementReviewerId;
            const spAssigned = !!task.signingPartnerId;
            const tlOk = !tlAssigned || !!task.teamLeadApprovedAt;
            const erOk = !erAssigned || !!task.engagementReviewerApprovedAt;
            const spOk = !spAssigned || !!task.signingPartnerApprovedAt;
            if (!tlOk || !erOk || !spOk) {
                const missing = [
                    !tlOk && 'Team Leader',
                    !erOk && 'QC Reviewer',
                    !spOk && 'Signing Partner'
                ].filter(Boolean).join(', ');
                toast.error(`Missing sign-off from: ${missing}. Please complete the Reviewer Checklist before marking as completed.`, { icon: '🔒' });
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
            // Sign-off timestamps are write-once, set only by the sign-off action.
            // Always preserve the task prop values — never override from form data,
            // which could be undefined if the field isn't registered in react-hook-form.
            teamLeadApprovedAt: task.teamLeadApprovedAt,
            engagementReviewerApprovedAt: task.engagementReviewerApprovedAt,
            signingPartnerApprovedAt: task.signingPartnerApprovedAt,
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

    // NOTE: Sign-offs are ONLY performed via the Reviewer Checklist tab.
    // handleApprove was removed to eliminate the duplicate, unsecured path in Settings.
    // All approval logic now lives in handleReviewSignOff below.


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

    const addReviewRow = (role: 'TL' | 'ER' | 'SP', insertAfterId?: string) => {
        if (isTaskCompleted) return;
        const newItem = {
            id: `rc-manual-${Date.now()}`,
            title: '',
            status: 'PENDING' as const,
            priority: 'MEDIUM' as const,
            isCompleted: false,
            reviewerRole: role,
        };
        const updated = [...(task.reviewChecklist || [])];
        if (insertAfterId) {
            const index = updated.findIndex(u => u.id === insertAfterId);
            if (index > -1) {
                let targetIndex = index + 1;
                for (let i = index + 1; i < updated.length; i++) {
                    if (updated[i].reviewerRole === role && updated[i].isSectionHeader) break;
                    targetIndex = i + 1;
                }
                updated.splice(targetIndex, 0, newItem);
            } else updated.push(newItem);
        } else updated.push(newItem);
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

        // Permission check: STRICT as requested by user.
        // Rule: Only the specifically assigned reviewer OR Master Admin can sign off.
        const isAuthorized = isMasterAdmin || 
                             (role === 'TL' && isTeamLeader) || 
                             (role === 'ER' && isEngagementReviewer) || 
                             (role === 'SP' && isSigningPartner);

        if (!isAuthorized) {
            toast.error(`Strict Security: Only the assigned ${role} can perform this sign-off.`, { icon: '🛡️' });
            return;
        }

        // Sequential Hierarchy Check — skip unassigned layers
        // ER can sign only if TL has signed OR no TL is assigned
        if (role === 'ER') {
            const tlAssigned = !!task.teamLeaderId;
            if (tlAssigned && !task.teamLeadApprovedAt) {
                toast.error("Team Leader sign-off must be completed first.", { icon: '🔒' });
                return;
            }
        }
        // SP can sign only if both prior assigned layers have signed
        if (role === 'SP') {
            const tlAssigned = !!task.teamLeaderId;
            const erAssigned = !!task.engagementReviewerId;
            if (tlAssigned && !task.teamLeadApprovedAt) {
                toast.error("Team Leader sign-off must be completed first.", { icon: '🔒' });
                return;
            }
            if (erAssigned && !task.engagementReviewerApprovedAt) {
                toast.error("QC Reviewer sign-off must be completed first.", { icon: '🔒' });
                return;
            }
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
        const now = new Date().toISOString();
        if (role === 'TL') {
            updates.teamLeadApprovedAt = now;
            setValue('teamLeadApprovedAt', now);
        }
        if (role === 'ER') {
            updates.engagementReviewerApprovedAt = now;
            setValue('engagementReviewerApprovedAt', now);
        }
        if (role === 'SP') {
            updates.signingPartnerApprovedAt = now;
            setValue('signingPartnerApprovedAt', now);
        }

        onChange(updates);
        
        // IMMEDIATE PERSISTENCE: Sign-offs are critical security events.
        // We trigger an auto-save immediately to ensure the state is persisted to Firestore.
        toast.promise(
            (async () => {
                await onSave(updates);
                if (user) {
                    await AuditService.logAction(
                        'TASK_SIGN_OFF',
                        { uid: user.uid, displayName: user.displayName || 'Staff' },
                        { id: task.id!, name: task.title },
                        { role, timestamp: now }
                    );
                }
            })(),
            {
                loading: `Sealing ${role} Protocol...`,
                success: `${role} Sign-off Secured and Persisted!`,
                error: `Failed to persist ${role} sign-off. Please try again.`,
            },
            { icon: '🔒' }
        );
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
        if (isTaskCompleted || !canEditTask) return;
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
        if (isTaskCompleted || !canEditTask) return;
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
                            disabled={isArchived || (!canManageTeam && !(st.assignedTo || []).includes(user?.uid || ''))}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                st.isCompleted 
                                    ? 'bg-brand-500 border-brand-500 text-white shadow-md' 
                                    : 'border-gray-400 dark:border-slate-600 hover:border-gray-500 dark:hover:border-slate-500 bg-white dark:bg-transparent'
                            } ${(isArchived || (!canManageTeam && !(st.assignedTo || []).includes(user?.uid || ''))) ? 'opacity-40 grayscale-[0.5] cursor-not-allowed' : 'cursor-pointer'}`}
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
                                        href={GoogleDriveService.getFileView(doc.appwriteFileId)}
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
                        {(isAdminOrMaster || isTeamLeader || st.addedBy === user?.uid) && (
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

                    // Sequential hierarchy — skip unassigned layers
                    const tlAssigned = !!task.teamLeaderId;
                    const erAssigned = !!task.engagementReviewerId;
                    // TL layer is always first or skipped if unassigned
                    const tlCleared = !tlAssigned || !!task.teamLeadApprovedAt;
                    // ER layer is cleared if unassigned OR already signed
                    const erCleared = !erAssigned || !!task.engagementReviewerApprovedAt;

                    const sequentialOk =
                        (layer === 'TL') ||
                        (layer === 'ER' && tlCleared) ||
                        (layer === 'SP' && tlCleared && erCleared);

                    const canSignOff = (
                        task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION &&
                        task.status !== TaskStatus.COMPLETED &&
                        (
                         (layer === 'TL' && isTeamLeader) ||
                         (layer === 'ER' && isEngagementReviewer) ||
                         (layer === 'SP' && isSigningPartner) ||
                         isMasterAdmin
                        ) &&
                        sequentialOk
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
                                                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                                                        Verified & Locked {signOffDate ? `(${new Date(signOffDate).toLocaleDateString()})` : ''}
                                                    </span>
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
                                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <button 
                                                                        onClick={() => addReviewRow(layer, item.id)}
                                                                        className="p-1 px-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center gap-1.5 text-[9px] font-black tracking-widest"
                                                                    >
                                                                        <Plus size={12} /> ADD ITEM
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => removeReviewRow(item.id, isLocked)}
                                                                        className="p-1 text-indigo-900/50 hover:text-rose-500"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
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

    // Helper to render read-only approval status in the Settings tab.
    // Sign-off can ONLY be performed via the Reviewer Checklist tab by the assigned reviewer.
    const ApprovalStatusBadge = ({ approvedAt, isInFinalPhase }: { approvedAt?: string; isInFinalPhase: boolean }) => {
        if (approvedAt) {
            return (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={11} className="text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                        Signed · {new Date(approvedAt).toLocaleDateString()}
                    </span>
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
        return (
            <div className="flex items-center gap-1.5 text-[9px] text-amber-600 uppercase tracking-widest font-black px-1.5">
                <History size={11} className="text-amber-700" /> Awaiting Sign-off
            </div>
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

                        {/* Secondary Navigation — Sticky & Responsive */}
                        <div className="shrink-0 sticky top-0 bg-white/80 dark:bg-[#0c0e12]/90 backdrop-blur-md border-b border-black/5 dark:border-white/[0.04] px-4 md:px-8 py-2 md:py-3 flex items-center justify-between gap-4 z-[60]">
                            {/* Main Tabs - Refactored for Mobile */}
                            <div className="flex items-center gap-1.5 md:gap-2 bg-gray-100 dark:bg-white/[0.03] p-1 rounded-full border border-black/5 dark:border-white/5 shadow-inner overflow-x-auto scrollbar-none max-w-full">
                                {(task.id ? [
                                    { id: 'OVERVIEW', label: 'Details', icon: <Settings2 size={14} /> },
                                    { id: 'PROCEDURES', label: 'Subtasks', icon: <CheckSquare size={14} />, badge: `${(task.subtasks || []).filter(s => s.isCompleted).length}/${(task.subtasks || []).length}` },
                                    { id: 'COMMENTS', label: 'Comments', icon: <MessageSquare size={14} />, badge: (task.comments || []).length },
                                    { id: 'EVIDENCE', label: 'Documents', icon: <FolderOpen size={14} />, badge: auditFiles.length },
                                    { id: 'OBSERVATIONS', label: 'Observations', icon: <Eye size={14} />, badge: (task.observations || []).length },
                                    { id: 'HISTORY', label: 'History', icon: <History size={14} /> },
                                    { id: 'REVIEW_CHECKLIST', label: 'Review', icon: <ShieldCheck size={14} />, desktopOnly: true },
                                    ...(isArchived ? [] : [{ id: 'SETTINGS', label: 'Setup', icon: <Activity size={14} />, adminOnly: true }])
                                ] : [
                                    { id: 'SETTINGS', label: 'Task Detail', icon: <Settings2 size={14} /> },
                                    { id: 'PROCEDURES', label: 'Subtasks', icon: <CheckSquare size={14} /> }
                                ]).map((tab: any) => {
                                    if (tab.desktopOnly && isMobile) return null;
                                    const isActive = activeDetailTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveDetailTab(tab.id as any)}
                                            className={`relative flex items-center gap-2 px-3 md:px-6 py-2 rounded-[28px] text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                                                isActive 
                                                    ? 'bg-brand-500 text-white shadow-md' 
                                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <span className={`transition-colors ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-500'}`}>{tab.icon}</span>
                                            <span className="hidden min-[480px]:inline">{tab.label}</span>
                                            {tab.badge !== undefined && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] leading-none ${isActive ? 'bg-white/20 text-white' : 'bg-brand-500/10 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400'}`}>
                                                    {tab.badge}
                                                </span>
                                            )}
                                            {isActive && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-white dark:border-[#0c0e12]" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-2">
                                {task.id && canEditTask && (
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowExportMenu(!showExportMenu)}
                                            className="px-5 py-2 bg-white/5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group shadow-sm"
                                        >
                                            <Download size={14} className="group-hover:translate-y-px transition-transform" />
                                            Export Workpaper
                                            <ChevronDown size={14} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                                        </button>
                                        
                                        <AnimatePresence>
                                            {showExportMenu && (
                                                <>
                                                    <div className="fixed inset-0 z-[90]" onClick={() => setShowExportMenu(false)} />
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                        transition={{ duration: 0.15 }}
                                                        className="absolute right-0 top-full mt-2 w-56 bg-[#1a1f26] border border-white/10 rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.5)] overflow-hidden z-[100] p-1.5"
                                                    >
                                                        <button
                                                            onClick={handleExportPDF}
                                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 text-gray-300 text-[11px] font-black uppercase tracking-widest transition-all text-left group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-rose-500/20 group-hover:text-rose-400">
                                                                <FileText size={14} />
                                                            </div>
                                                            Direct PDF Export
                                                        </button>
                                                        <div className="h-px bg-white/5 mx-2 my-0.5" />
                                                        <button
                                                            onClick={handleExportExcel}
                                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-400 text-gray-300 text-[11px] font-black uppercase tracking-widest transition-all text-left group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:text-emerald-400">
                                                                <BarChart2 size={14} />
                                                            </div>
                                                            Full Excel Workbook
                                                        </button>
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {activeDetailTab === 'PROCEDURES' && canAddSubtasks && (
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
                                <TaskDetailsTab
                                    task={task}
                                    auditFiles={auditFiles}
                                    setActiveDetailTab={setActiveDetailTab}
                                    isArchived={isArchived}
                                />
                            )}

                            {activeDetailTab === 'PROCEDURES' && (
                                <TaskSubtasksTab
                                    task={task}
                                    currentPhase={currentPhase}
                                    watchedPhase={watch('auditPhase') as AuditPhase}
                                    canAddSubtasks={canAddSubtasks}
                                    localSubtaskTitles={localSubtaskTitles}
                                    setLocalSubtaskTitles={setLocalSubtaskTitles}
                                    handlePhaseSwitch={handlePhaseSwitch}
                                    handleQuickAddSubtask={handleQuickAddSubtask}
                                    renderSubtask={renderSubtask}
                                />
                            )}

                            {activeDetailTab === 'EVIDENCE' && (
                                <TaskDocumentsTab
                                    auditFiles={auditFiles}
                                    customFolders={customFolders}
                                    isLoadingDocs={isLoadingDocs}
                                    isUploadingDoc={isUploadingDoc}
                                    selectedFolderForUpload={selectedFolderForUpload}
                                    selectedLineItemForUpload={selectedLineItemForUpload}
                                    onSelectFolder={setSelectedFolderForUpload}
                                    onSelectLineItem={setSelectedLineItemForUpload}
                                    onLoadFiles={loadAuditFiles}
                                    onFileUpload={handleFileUpload}
                                />
                            )}

                            {activeDetailTab === 'OBSERVATIONS' && (
                                <TaskObservationsTab
                                    observations={task.observations || []}
                                    isTaskCompleted={isTaskCompleted}
                                    canEditTask={canEditTask}
                                    isAdminOrMaster={isAdminOrMaster}
                                    isEngagementTeamMember={isEngagementTeamMember}
                                    currentUserId={user?.uid}
                                    onAdd={handleAddObservation}
                                    onUpdate={handleUpdateObservation}
                                    onRemove={handleRemoveObservation}
                                />
                            )}

                            {activeDetailTab === 'REVIEW_CHECKLIST' && (
                                <TaskReviewChecklistTab
                                    renderReviewerChecklist={renderReviewerChecklist}
                                />
                            )}

                            {activeDetailTab === 'COMMENTS' && (
                                <TaskCommentsTab
                                    comments={task.comments}
                                    users={usersList}
                                    onAddComment={onAddComment}
                                />
                            )}

                            {activeDetailTab === 'HISTORY' && task.id && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                    <TaskHistoryTab taskId={task.id} />
                                </div>
                            )}

                            {activeDetailTab === 'SETTINGS' && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
                                    <div className="max-w-[1600px] w-full mx-auto space-y-8 pb-32">
                                        
                                        {/* Main Form Fields Grouped */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 p-6 md:p-8 bg-white/[0.02] border border-white/5 rounded-[32px] shadow-inner">
                                            <Field label="Assignment Title" icon={<FileText size={14} className="text-brand-400" />} span2 error={!!errors.title}>
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
                                                        disabled={!!task.id}
                                                    />
                                                )} />
                                            </Field>

                                            <Field label="Fiscal Year (BS)" icon={<Calendar size={14} className="text-emerald-400" />} error={!!errors.fiscalYear}>
                                                <select 
                                                    className={selectClass} 
                                                    {...register('fiscalYear')}
                                                    disabled={!!task.id}
                                                >
                                                    <option value="" className="bg-navy-900">Select...</option>
                                                    {fiscalYears.map(fy => (
                                                        <option key={fy} value={fy} className="bg-navy-900 font-bold">{fy}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Priority" icon={<Zap size={14} className="text-amber-400" />} error={!!errors.priority}>
                                                <select className={selectClass} {...register('priority')} disabled={!canEditTask || isTaskCompleted}>
                                                    {Object.values(TaskPriority).map(p => (
                                                        <option key={p} value={p} className="bg-navy-900 font-bold uppercase">{p}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Status" icon={<Activity size={14} className="text-blue-400" />} error={!!errors.status}>
                                                <select className={selectClass} {...register('status')} disabled={!canEditTask || isTaskCompleted}>
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
                                                    readOnly={!canEditTask || isTaskCompleted}
                                                />
                                            </Field>
                                        </div>

                                         {/* Quality Control Hierarchy Section */}
                                        <div className="p-6 md:p-8 bg-[#0c1e18]/20 border border-emerald-500/10 rounded-[32px] shadow-inner space-y-8">
                                            <div className="flex items-center gap-4 border-b border-emerald-500/10 pb-4">
                                                <ShieldCheck size={20} className="text-emerald-500" />
                                                <div>
                                                    <h4 className="text-[13px] font-black text-gray-300 uppercase tracking-[0.3em]">Quality Control Hierarchy</h4>
                                                    <p className="text-[9px] text-amber-600/80 font-bold uppercase tracking-widest mt-0.5">
                                                        Sign-offs are performed exclusively in the Reviewer Checklist tab
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <Field 
                                                    label="Team Leader" 
                                                    icon={<UserCheck size={14} className="text-emerald-400" />}
                                                    extra={<ApprovalStatusBadge approvedAt={watch('teamLeadApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
                                                >
                                                    <Controller name="teamLeaderId" control={control} render={({ field }) => (
                                                        <StaffSelect users={usersList.filter(u => (watch('assignedTo') || []).includes(u.uid))} value={field.value || ''} onChange={field.onChange} placeholder="Select Team Leader..." disabled={!!watch('teamLeadApprovedAt') || !canManageTeam} compact />
                                                    )} />
                                                </Field>

                                                <Field 
                                                    label="QC Reviewer" 
                                                    icon={<Shield size={14} className="text-purple-400" />}
                                                    extra={<ApprovalStatusBadge approvedAt={watch('engagementReviewerApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
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
                                                    extra={<ApprovalStatusBadge approvedAt={watch('signingPartnerApprovedAt')} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
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

                                {/* Sync Status Indicator */}
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : isDirty ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">
                                        {isSaving ? 'Syncing...' : isDirty ? 'Unsaved Changes' : 'Cloud Synced'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        if (isDirty) setShowDiscardBanner(true);
                                        else onClose();
                                    }}
                                    className="px-8 py-2 bg-gray-200/50 hover:bg-gray-200 text-gray-700 dark:bg-transparent dark:text-gray-500 dark:hover:text-white dark:hover:bg-white/5 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl transition-all border border-gray-300/50 dark:border-white/5 active:scale-95 shadow-sm"
                                >
                                    Exit Workspace
                                </button>
                                 {!isTaskCompleted && canEditTask && (
                                    <button
                                        onClick={handleSubmit(handleSave, (errs) => {
                                            const firstErr = Object.values(errs)[0];
                                            if (firstErr) toast.error(firstErr.message as string);
                                        })}
                                        disabled={isSaving}
                                        className={`px-8 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-md active:scale-95 flex items-center gap-3 ${
                                            (formIsDirty || isDirty || !task.id) 
                                            ? 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/20' 
                                            : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                                        }`}
                                    >
                                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {task.id ? (isDirty || formIsDirty ? 'Push Changes' : 'All Synced') : 'Create Task'}
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
