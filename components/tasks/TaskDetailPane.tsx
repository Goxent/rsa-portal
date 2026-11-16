import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2, Check, Eye, Map,
    Sparkles, Book, ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen,
    Users, UserCheck, Shield, Lock, Unlock, ExternalLink, History, CloudUpload, FileText,
    MessageSquare, Zap, Settings2, Folder, Download, ChevronDown, CheckSquare, Building2
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskComment, Resource, AuditPhase, Template, TemplateFolder, TaskType, AuditObservation, ReviewChecklistItem } from '../../types';
import { TASK_TYPE_LABELS, TASK_TYPE_ICONS } from '../../constants/taskTypeChecklists';
import { useModal } from '../../context/ModalContext';
import { KnowledgeService } from '../../services/knowledge';
import { TemplateService } from '../../services/templates';
import { AuditDocService, AuditDocFile, AuditDocFolder } from '../../services/auditDocs';
import { AUDIT_FOLDER_STRUCTURE, AuditFolderKey } from '../../types';
import { AuditService } from '../../services/AuditService';
import { AuthService } from '../../services/firebase';
import { useDebounce } from 'react-use';
import StaffSelect from '../StaffSelect';
import ClientSelect from '../ClientSelect';
import TaskComments from '../TaskComments';
import NepaliDatePicker from '../NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskSchema, TaskFormValues } from '../../utils/validationSchemas';
import { convertADToBS, generateFiscalYearOptions, formatDateDual } from '../../utils/nepaliDate';
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Icon Mapping for Engagement Framework Ã¢â€â‚¬Ã¢â€â‚¬
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

// Ã¢â€â‚¬Ã¢â€â‚¬ Reusable boxed field wrapper Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
            <label className={`text-xs font-medium flex items-center gap-1.5 ${error ? 'text-[var(--color-danger)]' : 'text-[var(--text-muted)]'}`}>
                {icon} {label} {error && <span className="text-[var(--color-danger)] ml-1">*</span>}
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
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadingSubtaskId, setUploadingSubtaskId] = useState<string | null>(null);
    const [selectedFolderForUpload, setSelectedFolderForUpload] = useState<AuditFolderKey | ''>('');
    const [selectedLineItemForUpload, setSelectedLineItemForUpload] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [selectingFolderSubtaskId, setSelectingFolderSubtaskId] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    // A6/U5 fix: Inline query composer (replaces browser prompt() calls)
    const [queryModal, setQueryModal] = useState<{ subtaskId: string; mode: 'RAISE' | 'REPLY'; } | null>(null);
    const [queryText, setQueryText] = useState('');

    const client = useMemo(() => {
        const cid = task.clientIds?.[0] || task.clientId;
        return clientsList.find(c => c.id === cid);
    }, [clientsList, task.clientIds, task.clientId]);

    const openQueryCount = useMemo(() => {
        return (task.subtasks || []).filter(s => s.queryStatus === 'OPEN' || s.queryStatus === 'RESOLVED').length;
    }, [task.subtasks]);

    const descRef = useRef<HTMLTextAreaElement | null>(null);
    
    // Ã¢â€â‚¬Ã¢â€â‚¬ AUTOSAVE LOGIC Ã¢â€â‚¬Ã¢â€â‚¬
    const [isDirty, setIsDirty] = useState(false);
    const [lastSavedTask, setLastSavedTask] = useState<Partial<Task>>(task);

    // Track dirty state for unsaved changes guard
    useEffect(() => {
        if (task.id) {
            // Reset lastSavedTask when opening a different task to prevent false autosave
            if (task.id !== lastSavedTask.id) {
                setLastSavedTask(task);
                setIsDirty(false);
                return;
            }

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
                id: task.id,
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
            estimatedDays: task.estimatedDays || undefined,
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

    // Ã¢â€â‚¬Ã¢â€â‚¬ Sync form when task prop changes (e.g. after save or task switch) Ã¢â€â‚¬Ã¢â€â‚¬
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
                    estimatedDays: undefined,
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
                    estimatedDays: task.estimatedDays || undefined,
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

    // Smart Defaults: When a client is selected on a NEW task, auto-fill team from last engagement
    useEffect(() => {
        if (!watchedClientId || task.id) return; // Only for new tasks (no existing id)
        let cancelled = false;

        AuthService.getLastEngagementDefaults(watchedClientId).then((defaults) => {
            if (!defaults || cancelled) return;
            if (defaults.teamLeaderId)        setValue('teamLeaderId', defaults.teamLeaderId);
            if (defaults.engagementReviewerId) setValue('engagementReviewerId', defaults.engagementReviewerId);
            if (defaults.signingPartnerId)    setValue('signingPartnerId', defaults.signingPartnerId);
            if (defaults.assignedTo?.length)  setValue('assignedTo', defaults.assignedTo);
            toast.success('Team pre-filled from last engagement', { icon: 'Ã¢Å“Â¨', duration: 3000 });
        }).catch(() => {/* silent fail */});

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedClientId]);

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
        setUploadProgress(0);

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
                }, (progress) => {
                    // If multiple files, this logic might need adjustment, but for now simple progress
                    setUploadProgress(progress);
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
            setUploadProgress(0);
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
                toast.error("Engagement must be in the Review & Conclusion phase before it can be completed.", { icon: 'Ã°Å¸â€â€™' });
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
                toast.error(`Missing sign-off from: ${missing}. Please complete the Reviewer Checklist before marking as completed.`, { icon: 'Ã°Å¸â€â€™' });
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
            estimatedDays: data.estimatedDays,
            assignedTo: data.assignedTo?.filter(id => id && id.trim() !== '') || [],
            teamLeaderId: data.teamLeaderId,
            engagementReviewerId: data.engagementReviewerId,
            signingPartnerId: data.signingPartnerId,
            // Sign-off timestamps are write-once, set only by the sign-off action.
            // Always preserve the task prop values Ã¢â‚¬â€ never override from form data,
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
        // A4: Stale sign-off lock - procedures cannot be altered once review sign-off has commenced
        if (task.teamLeadApprovedAt || task.engagementReviewerApprovedAt || task.signingPartnerApprovedAt) {
            toast.error("Procedures are locked because review sign-off has commenced. Reopen review before modifying.", { icon: 'ðŸ”’' });
            return;
        }
        const updated = [...(task.subtasks || [])];
        const idx = updated.findIndex(u => u.id === id);
        if (idx > -1) {
            const st = updated[idx];
            
            // RBAC: Only assigned users or Team Leader (Admins have task.teamLeaderId permission if assigned)
            const isAssigned = (st.assignedTo || []).includes(user?.uid || '');
            const isTaskTeamLeader = user?.uid === task.teamLeaderId;
            
            if (!isAssigned && !isTaskTeamLeader) {
                toast.error("Only assigned staff members or the Task Team Leader can mark this procedure as complete.", { icon: 'Ã°Å¸â€â€™' });
                return;
            }

            if (!st.isCompleted && st.isEvidenceMandatory && !st.evidenceProvided && !evidenceText) {
                toast.error("Evidence is mandatory to mark this procedure as complete. Please provide it below.", { icon: 'Ã°Å¸â€ºâ€˜' });
                return;
            }
            updated[idx] = {
                ...st,
                isCompleted: !st.isCompleted,
                evidenceProvided: evidenceText ? true : st.evidenceProvided,
                evidenceText: evidenceText || st.evidenceText,
                // A1 fix: Record who performed the work and when (ISA 230)
                completedBy: !st.isCompleted ? (user?.uid || undefined) : undefined,
                completedByName: !st.isCompleted ? (user?.displayName || 'Unknown') : undefined,
                completedAt: !st.isCompleted ? new Date().toISOString() : undefined,
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
                toast.error(`Only the assigned ${item.reviewerRole} can update this item.`, { icon: 'Ã°Å¸â€â€™' });
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
                toast.error(`Only the assigned ${item.reviewerRole} can modify this item.`, { icon: 'Ã°Å¸â€â€™' });
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
            toast.error(`Action Restricted: Only the assigned ${item.reviewerRole} can delete this protocol item.`, { icon: 'Ã°Å¸â€â€™' });
            return;
        }

        if (window.confirm("Are you sure you want to remove this protocol item? This action cannot be undone.")) {
            const updated = (task.reviewChecklist || []).filter(i => i.id !== id);
            onChange({ reviewChecklist: updated });
        }
    };

    // A8: Review outcome - Request Changes workflow with round tracking
    const handleRequestChanges = async (role: 'TL' | 'ER' | 'SP') => {
        if (isTaskCompleted) return;
        const reason = window.prompt("Enter review notes / reason for requested changes:");
        if (!reason || !reason.trim()) return;

        const nextRound = (task.reviewRound || 0) + 1;
        const now = new Date().toISOString();
        const updates: any = {
            status: TaskStatus.IN_PROGRESS,
            reviewStatus: 'CHANGES_REQUESTED',
            reviewRound: nextRound,
            reviewReturnReason: reason.trim(),
        };

        // Reset current and downstream sign-offs upon changes request
        if (role === 'TL') {
            updates.teamLeadApprovedAt = null;
            updates.teamLeadSignOff = null;
            updates.engagementReviewerApprovedAt = null;
            updates.engagementReviewerSignOff = null;
            updates.signingPartnerApprovedAt = null;
            updates.signingPartnerSignOff = null;
        } else if (role === 'ER') {
            updates.engagementReviewerApprovedAt = null;
            updates.engagementReviewerSignOff = null;
            updates.signingPartnerApprovedAt = null;
            updates.signingPartnerSignOff = null;
        } else if (role === 'SP') {
            updates.signingPartnerApprovedAt = null;
            updates.signingPartnerSignOff = null;
        }

        onChange(updates);
        toast.promise(
            (async () => {
                await onSave(updates);
                if (user) {
                    await AuditService.logAction(
                        'task.status_change' as any,
                        { uid: user.uid, displayName: user.displayName || 'Reviewer' },
                        { id: task.id!, name: task.title },
                        { role, round: nextRound, reason: reason.trim(), at: now }
                    );

                    // Notify team assignees and Team Leader
                    const recipients = new Set([...(task.assignedTo || []), task.teamLeaderId, task.createdBy].filter(Boolean) as string[]);
                    recipients.delete(user.uid);
                    for (const uid of recipients) {
                        await AuthService.createNotification({
                            userId: uid,
                            title: `Changes Requested (${role}): ${task.title}`,
                            message: `Review Round ${nextRound}: ${reason.trim()}`,
                            type: 'WARNING',
                            category: 'TASK',
                            link: `/tasks?taskId=${task.id}`
                        });
                    }
                }
            })(),
            {
                loading: 'Returning task with changes requested...',
                success: `Task returned for revision (Round ${nextRound})`,
                error: 'Failed to return task.',
            }
        );
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
            toast.error(`Strict Security: Only the assigned ${role} can perform this sign-off.`, { icon: 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â' });
            return;
        }

        // Sequential Hierarchy Check Ã¢â‚¬â€ skip unassigned layers
        // ER can sign only if TL has signed OR no TL is assigned
        if (role === 'ER') {
            const tlAssigned = !!task.teamLeaderId;
            if (tlAssigned && !task.teamLeadApprovedAt) {
                toast.error("Team Leader sign-off must be completed first.", { icon: 'Ã°Å¸â€â€™' });
                return;
            }
        }
        // SP can sign only if both prior assigned layers have signed
        if (role === 'SP') {
            const tlAssigned = !!task.teamLeaderId;
            const erAssigned = !!task.engagementReviewerId;
            if (tlAssigned && !task.teamLeadApprovedAt) {
                toast.error("Team Leader sign-off must be completed first.", { icon: 'Ã°Å¸â€â€™' });
                return;
            }
            if (erAssigned && !task.engagementReviewerApprovedAt) {
                toast.error("QC Reviewer sign-off must be completed first.", { icon: 'Ã°Å¸â€â€™' });
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
        // A2 fix: Store full signer identity, not just a timestamp (ISA 230 / review integrity)
        const signOffRecord = {
            uid: user?.uid || 'unknown',
            name: user?.displayName || 'Unknown',
            role: role,
            at: now,
        };
        if (role === 'TL') {
            updates.teamLeadApprovedAt = now;
            updates.teamLeadSignOff = signOffRecord;
            setValue('teamLeadApprovedAt', now);
        }
        if (role === 'ER') {
            updates.engagementReviewerApprovedAt = now;
            updates.engagementReviewerSignOff = signOffRecord;
            setValue('engagementReviewerApprovedAt', now);
        }
        if (role === 'SP') {
            updates.signingPartnerApprovedAt = now;
            updates.signingPartnerSignOff = signOffRecord;
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
                        'task.status_change' as any,
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
            { icon: 'Ã°Å¸â€â€™' }
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
                    queryRaisedBy: user?.uid || 'unknown',
                    queryRaisedByName: user?.displayName || 'Reviewer',
                    queryRaisedAt: new Date().toISOString(),
                    queryReply: undefined,
                    queryClearedBy: undefined,
                    queryClearedAt: undefined,
                };
            } else if (action === 'REPLY') {
                updated[idx] = { ...st, queryStatus: 'RESOLVED', queryReply: data };
            } else if (action === 'CLEAR') {
                updated[idx] = {
                    ...st,
                    queryStatus: 'CLEARED',
                    queryClearedBy: user?.uid,
                    queryClearedAt: new Date().toISOString(),
                };
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
                toast.error("Access Restricted: Only the creator can modify this observation.", { icon: 'Ã°Å¸â€â€™' });
                return;
            }
            if (isAdminOrMaster && !isCreator) {
                toast.error("Admins have view-only access to audit observations.", { icon: 'Ã°Å¸â€˜ÂÃ¯Â¸Â' });
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
            toast.error("Access Restricted: Only the creator can delete this observation.", { icon: 'Ã°Å¸â€â€™' });
            return;
        }
        if (isAdminOrMaster && !isCreator) {
            toast.error("Admins cannot delete audit observations.", { icon: 'Ã°Å¸â€â€™' });
            return;
        }

        if (window.confirm("Delete this audit observation? This action cannot be undone.")) {
            const updated = currentObs.filter(o => o.id !== id);
            onChange({ observations: updated });
        }
    };

    const handlePhaseSwitch = (newPhase: AuditPhase) => {
        // Free navigation Ã¢â‚¬â€ users can jump to any phase at any time
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
            <div key={uniqueKey} className={`flex flex-col gap-0.5 px-4 py-2.5 rounded-[var(--radius-md)] transition-colors duration-150 group/st bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--border-mid)] shadow-none ${st.isNew ? 'ring-1 ring-[var(--accent)]' : ''}`}>
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <button
                            onClick={() => toggleSubtask(st.id)}
                            disabled={isArchived || (!canManageTeam && !(st.assignedTo || []).includes(user?.uid || ''))}
                            className={`w-4 h-4 rounded-[var(--radius-sm)] border flex items-center justify-center transition-colors ${
                                st.isCompleted 
                                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white' 
                                    : 'border-[var(--border-mid)] bg-[var(--bg-surface)] hover:border-[var(--text-muted)]'
                            } ${(isArchived || (!canManageTeam && !(st.assignedTo || []).includes(user?.uid || ''))) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {st.isCompleted && <Check size={10} style={{ color: 'var(--on-accent)' }} strokeWidth={3} />}
                        </button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {st.reference && (
                                <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] text-[var(--accent)] text-[10px] font-medium whitespace-nowrap border border-[var(--border-accent)]">
                                    {st.reference}
                                </span>
                            )}
                            <span
                                className={`text-xs font-semibold leading-snug transition-colors ${st.isCompleted ? 'line-through' : ''}`}
                                style={{ color: st.isCompleted ? 'var(--text-muted)' : 'var(--text-heading)' }}
                            >
                                {st.title}
                            </span>
                            {st.isEvidenceMandatory && (
                                <span title="Evidence Mandatory" className="flex items-center gap-1 text-[var(--color-danger)] text-[10px] font-medium whitespace-nowrap">
                                    <ShieldAlert size={10} /> Req
                                </span>
                            )}
                        </div>

                        {st.minimumRequirement && !st.isCompleted && (
                            <p className="text-[11px] font-normal italic mt-0.5" style={{ color: 'var(--text-muted)' }}>"{st.minimumRequirement}"</p>
                        )}

                        {st.addedByName && !st.isAutoGenerated && (
                            <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--color-success)' }}>Added by: {st.addedByName}</p>
                        )}
                        {/* A1: Working paper tick mark showing preparer identity and timestamp */}
                        {st.isCompleted && st.completedByName && (
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-medium" style={{ color: 'var(--color-success)' }}>
                                <CheckCircle2 size={10} />
                                <span>Checked by {st.completedByName}{st.completedAt ? ` on ${new Date(st.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
                            </div>
                        )}

                        {/* Attached Evidence Pills */}
                        {subtaskDocs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {subtaskDocs.map(doc => (
                                    <a 
                                        key={doc.id}
                                        href={StorageService.getViewUrl(doc.appwriteFileId)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--accent-dim)] border border-[var(--border-accent)] rounded-[var(--radius-sm)] text-[var(--accent)] text-[10px] font-medium transition-colors"
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
                                className={`p-1 px-1.5 rounded-[var(--radius-sm)] transition-colors flex items-center justify-center ${selectingFolderSubtaskId === st.id ? 'bg-[var(--accent)] text-white' : 'hover:text-[var(--accent)]'}`}
                                style={{ color: selectingFolderSubtaskId === st.id ? 'var(--on-accent)' : 'var(--text-muted)' }}
                                title="Sync Documentation to Repository"
                            >
                                {uploadingSubtaskId === st.id ? <Loader2 size={13} className="animate-spin" /> : <CloudUpload size={14} />}
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
                                            className="absolute bottom-full right-0 mb-3 w-72 p-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-xl z-[101] overflow-hidden"
                                        >
                                            <div className="px-3 py-2 border-b border-[var(--border)] mb-2 flex items-center justify-between">
                                                <span className="text-[10px] font-medium text-[var(--accent)]">Select repository path</span>
                                                <X size={12} className="cursor-pointer hover:opacity-100 opacity-60" style={{ color: 'var(--text-muted)' }} onClick={() => setSelectingFolderSubtaskId(null)} />
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
                                                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] border border-transparent transition-colors text-left ${hasLineItems ? 'cursor-default' : 'cursor-pointer hover:bg-[var(--bg-surface)] hover:border-[var(--border)]'}`}
                                                                >
                                                                    <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[10px] font-medium text-[var(--accent)]">
                                                                        {key}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-heading)' }}>{def.label}</div>
                                                                        <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{def.description.substring(0, 40)}...</div>
                                                                    </div>
                                                                </button>
                                                            </div>

                                                            {hasLineItems && (
                                                                <div className="ml-4 pl-4 border-l border-[var(--border)] space-y-1 py-1">
                                                                    {def.lineItems?.map(item => (
                                                                        <label 
                                                                            key={item}
                                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer group/item"
                                                                        >
                                                                            <input 
                                                                                type="file" 
                                                                                className="hidden" 
                                                                                onChange={(e) => {
                                                                                    handleFileUpload(e.target.files, st.id, key as AuditFolderKey, item);
                                                                                    setSelectingFolderSubtaskId(null);
                                                                                }}
                                                                            />
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] group-hover/item:bg-[var(--accent)] transition-colors" />
                                                                            <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{item}</span>
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

                        {(isAdminOrMaster || user?.role === UserRole.MANAGER || user?.uid === task.teamLeaderId || user?.uid === task.engagementReviewerId || user?.uid === task.signingPartnerId) && !isCleared && (
                            <button
                                onClick={() => {
                                    setQueryText(''); setQueryModal({ subtaskId: st.id, mode: 'RAISE' });
                                }}
                                className="p-1 px-1.5 rounded transition-colors"
                                style={{ color: 'var(--color-warning)' }}
                                title="Query"
                            >
                                <AlertTriangle size={13} />
                            </button>
                        )}
                        {hasQuery && (user?.uid === task.assignedTo?.[0] || user?.role === 'ADMIN' || (Array.isArray(st.assignedTo) && st.assignedTo.includes(user?.uid || ''))) && (
                            <button
                                onClick={() => {
                                    setQueryText(''); setQueryModal({ subtaskId: st.id, mode: 'REPLY' });
                                }}
                                className="p-1 px-1.5 rounded transition-colors"
                                style={{ color: 'var(--color-success)' }}
                                title="Reply to Query"
                            >
                                <ClipboardCheck size={13} />
                            </button>
                        )}
                        {isResolved && (isAdminOrMaster || user?.uid === st.queryRaisedBy || user?.uid === task.teamLeaderId || user?.uid === task.engagementReviewerId || user?.uid === task.signingPartnerId) && (
                            <button
                                onClick={() => handleSubtaskAction(st.id, 'CLEAR')}
                                className="p-1 px-1.5 rounded transition-colors text-[var(--accent)] hover:bg-[var(--accent-dim)]"
                                title="Clear Query"
                            >
                                <Award size={13} />
                            </button>
                        )}
                        {(isAdminOrMaster || isTeamLeader || st.addedBy === user?.uid) && (
                            <button onClick={() => onRemoveSubtaskLocal(st.id)} className="p-1 px-1.5 transition-colors hover:text-[var(--color-danger)]" style={{ color: 'var(--text-muted)' }}>
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Multi-Assignee Section */}
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Requirement assignees</span>
                        {Array.isArray(st.assignedTo) && st.assignedTo.length > 0 && (
                            <span className="text-[10px] font-medium text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--border-accent)] px-2 py-0.5 rounded-[var(--radius-sm)] tabular-nums">
                                {st.assignedTo.length} assigned
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
                    <div className="mt-1.5 p-2 rounded-[var(--radius-md)] border space-y-2" style={{ background: 'rgba(224,112,122,0.05)', borderColor: 'rgba(224,112,122,0.2)' }}>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold whitespace-nowrap flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] border" style={{ color: 'var(--color-danger)', background: 'rgba(224,112,122,0.1)', borderColor: 'rgba(224,112,122,0.2)' }}>
                                <ShieldAlert size={11} /> Evidence
                            </span>
                            <div className="flex-1 flex gap-2">
                                <input
                                    type="text"
                                    id={`evidence-${st.id}`}
                                    placeholder="Enter Voucher #, Doc Ref..."
                                    className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-sm)] px-2.5 py-1 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--color-danger)]"
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
                    <div className="mt-1.5 p-2 rounded-[var(--radius-md)] border flex items-center gap-2" style={{ background: 'rgba(79,178,134,0.05)', borderColor: 'rgba(79,178,134,0.2)' }}>
                        <span className="text-xs font-semibold whitespace-nowrap px-2 py-0.5 rounded-[var(--radius-sm)] border flex items-center gap-1" style={{ color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' }}>
                            <CheckCircle2 size={11} /> Evidenced
                        </span>
                        <div className="text-xs font-mono bg-[var(--bg-surface)] px-2.5 py-0.5 rounded border border-[var(--border)] flex-1 break-all truncate" style={{ color: 'var(--color-success)' }} title={st.evidenceText}>
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
                        }} className="text-[var(--text-muted)] hover:text-[var(--color-danger)] p-1 transition-colors">
                            <Trash2 size={11} />
                        </button>
                    </div>
                )}

                {/* Query Conversation Box */}
                {(hasQuery || isResolved || isCleared) && (
                    <div className="mt-1.5 p-2 rounded-[var(--radius-md)] border space-y-1 bg-[var(--bg-surface)] border-[var(--border)]">
                        <div className="flex items-start gap-2">
                            <span className="text-xs font-medium mt-0.5 whitespace-nowrap" style={{ color: 'var(--color-warning)' }}>Reviewer:</span>
                            <p className="text-xs text-[var(--text-secondary)] italic">"{st.queryComment}"</p>
                        </div>
                        {st.queryReply && (
                            <div className="flex items-start gap-2 pt-1.5 border-t border-[var(--border)]">
                                <span className="text-xs font-medium mt-0.5 whitespace-nowrap" style={{ color: 'var(--color-success)' }}>Staff:</span>
                                <p className="text-xs text-[var(--text-secondary)]">"{st.queryReply}"</p>
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
                <div className="flex gap-1 p-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] w-fit mx-auto">
                    {[
                        { id: 'TL' as const, label: 'Team Leader' },
                        { id: 'ER' as const, label: 'Engagement Reviewer' },
                        { id: 'SP' as const, label: 'Signing Partner' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveReviewTab(tab.id)}
                            className={`px-5 py-2 rounded-[var(--radius-sm)] text-xs font-medium transition-colors flex items-center gap-2 ${
                                activeReviewTab === tab.id 
                                    ? 'bg-[var(--accent)] text-[var(--on-accent)]' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-secondary)]'
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

                    // A2 fix: Retrieve the full signer identity record
                    const signOffRecord = {
                        'TL': task.teamLeadSignOff,
                        'ER': task.engagementReviewerSignOff,
                        'SP': task.signingPartnerSignOff
                    }[layer];

                    // Sequential hierarchy Ã¢â‚¬â€ skip unassigned layers
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
                        <div key={layer} className={`border border-[var(--border)] bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] overflow-hidden relative shadow-none ${isSignedOff ? 'ring-1 ring-[var(--color-success)]' : ''}`}>
                            <div className="absolute top-0 left-0 w-1 h-full bg-[var(--accent)]" />

                            <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-surface)]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-dim)] flex items-center justify-center border border-[var(--border-accent)] text-[var(--accent)]">
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-semibold" style={{ color: 'var(--text-heading)' }}>{meta.title}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Protocol execution layer</span>
                                            {isSignedOff && (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] border" style={{ background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)', color: 'var(--color-success)' }}>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                                                    <span className="text-[10px] font-medium">
                                                        Verified & locked {signOffDate ? `(${new Date(signOffDate).toLocaleDateString()})` : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN || user?.uid === task.teamLeaderId) && !isSignedOff && !isTaskCompleted && (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-sm)] p-0.5 mr-2">
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
                                                            toast.success(`Checklist integrated from ${matchingTemplate.name}`, { icon: 'Ã¢Å“Â¨' });
                                                            e.target.value = ""; // Reset selector
                                                        }
                                                    }}
                                                    className="bg-transparent outline-none border-none text-xs font-medium text-[var(--accent)] px-2 max-w-[180px] truncate cursor-pointer"
                                                >
                                                    <option value="">Quick Import Template...</option>
                                                    {templates.filter(t => (t.category === 'REVIEWER_CHECKLIST' || t.category === 'TASK') && t.reviewChecklist && t.reviewChecklist.length > 0).map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                                <div className="px-2 text-[var(--text-muted)]">
                                                    <Download size={11} strokeWidth={2} />
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
                                                className="h-8 px-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-main)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs font-medium text-[var(--text-heading)] flex items-center gap-1.5 transition-colors"
                                            >
                                                <Plus size={13} /> Add section
                                            </button>
                                            <button 
                                                onClick={() => addReviewRow(layer)}
                                                className="h-8 px-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-main)] border border-[var(--border)] rounded-[var(--radius-sm)] text-xs font-medium text-[var(--text-heading)] flex items-center gap-1.5 transition-colors"
                                            >
                                                <Plus size={13} /> Add procedure
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border)]">
                                            <th className="px-4 py-2.5 w-16 text-center">Ref</th>
                                            <th className="px-4 py-2.5">Protocol procedure / requirement</th>
                                            <th className="px-4 py-2.5 w-32 text-center">Status</th>
                                            <th className="px-4 py-2.5 w-28 text-center">Priority</th>
                                            <th className="px-4 py-2.5 min-w-[250px]">Notes / WP ref</th>
                                            {!isSignedOff && <th className="px-4 py-2.5 w-16 text-center"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border)]">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)]">
                                                            <ClipboardCheck size={24} />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <p className="text-xs font-semibold text-[var(--text-heading)]">No protocol loaded</p>
                                                            <p className="text-xs text-[var(--text-muted)]">Required for engagement sign-off</p>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((item, idx) => {
                                                const isLocked = isTaskCompleted || (isSignedOff && user?.role !== UserRole.MASTER_ADMIN);
                                                
                                                return item.isSectionHeader ? (
                                                    <tr key={item.id} className="bg-[var(--accent-dim)] group border-b border-[var(--border)]">
                                                        <td className="px-4 py-2 text-xs font-semibold text-[var(--accent)] text-center">
                                                            {String.fromCharCode(65 + items.filter((it, i) => it.isSectionHeader && i <= items.indexOf(item)).length - 1)}
                                                        </td>
                                                        <td colSpan={4} className="px-4 py-2">
                                                            <input 
                                                                type="text" 
                                                                value={item.title}
                                                                onChange={(e) => updateReviewItemField(item.id, 'title', e.target.value, isLocked)}
                                                                readOnly={isLocked}
                                                                className="w-full bg-transparent border-none text-xs font-semibold text-[var(--accent)] placeholder:text-[var(--text-muted)] focus:outline-none p-0"
                                                                placeholder="Section name (e.g. A | General Procedures)"
                                                            />
                                                        </td>
                                                        {!isLocked && (
                                                            <td className="px-4 py-2 text-center">
                                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button 
                                                                        onClick={() => addReviewRow(layer, item.id)}
                                                                        className="p-1 px-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-main)] text-[var(--text-heading)] border border-[var(--border)] rounded-[var(--radius-sm)] flex items-center gap-1 text-[11px] font-medium"
                                                                    >
                                                                        <Plus size={11} /> Item
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => removeReviewRow(item.id, isLocked)}
                                                                        className="p-1 text-[var(--text-muted)] hover:text-[var(--color-danger)] transition-colors"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ) : (
                                                    <tr key={item.id} className={`group transition-colors ${isLocked ? 'opacity-80 bg-[var(--bg-surface)]' : 'hover:bg-[var(--bg-surface)]'}`}>
                                                        <td className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] text-center tabular-nums">
                                                            {(() => {
                                                                const sectionsBefore = items.slice(0, items.indexOf(item)).filter(it => it.isSectionHeader);
                                                                const currentSectionIdx = sectionsBefore.length;
                                                                if (currentSectionIdx === 0) return idx + 1;
                                                                
                                                                const sectionChar = String.fromCharCode(64 + currentSectionIdx);
                                                                const idxInSection = items.slice(items.indexOf(sectionsBefore[sectionsBefore.length - 1]) + 1, items.indexOf(item)).length + 1;
                                                                return `${sectionChar}${idxInSection}`;
                                                            })()}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <input 
                                                                type="text" 
                                                                value={item.title}
                                                                onChange={(e) => updateReviewItemField(item.id, 'title', e.target.value, isLocked)}
                                                                readOnly={isLocked}
                                                                className="w-full bg-transparent border-none text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none p-0"
                                                                placeholder="Checking procedure..."
                                                            />
                                                            {item.minimumRequirement && (
                                                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{item.minimumRequirement}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <button 
                                                                onClick={() => toggleReviewItemStatus(item.id, isLocked)}
                                                                disabled={isLocked}
                                                                style={
                                                                    item.status === 'OK' ? { color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' } :
                                                                    item.status === 'ISSUE' ? { color: 'var(--color-danger)', background: 'rgba(224,112,122,0.1)', borderColor: 'rgba(224,112,122,0.2)' } :
                                                                    { color: 'var(--text-muted)', background: 'var(--bg-surface)', borderColor: 'var(--border)' }
                                                                }
                                                                className="mx-auto h-7 px-3 rounded-[var(--radius-sm)] flex items-center justify-center gap-1.5 text-xs font-medium transition-colors border"
                                                            >
                                                                {item.status === 'OK' && <CheckCircle2 size={12} />}
                                                                {item.status === 'ISSUE' && <AlertTriangle size={12} />}
                                                                {item.status || 'PENDING'}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className="relative group/sel mx-auto w-fit">
                                                                <select
                                                                    value={item.priority || 'MEDIUM'}
                                                                    onChange={(e) => updateReviewItemField(item.id, 'priority', e.target.value, isLocked)}
                                                                    disabled={isLocked}
                                                                    style={
                                                                        item.priority === 'CRITICAL' ? { color: 'var(--color-danger)' } :
                                                                        item.priority === 'HIGH' ? { color: 'var(--color-warning)' } :
                                                                        { color: 'var(--text-secondary)' }
                                                                    }
                                                                    className="appearance-none bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-1 pr-6 text-xs font-medium text-center focus:border-[var(--accent)] transition-colors cursor-pointer disabled:cursor-not-allowed"
                                                                >
                                                                    <option value="CRITICAL">Critical</option>
                                                                    <option value="HIGH">High</option>
                                                                    <option value="MEDIUM">Medium</option>
                                                                </select>
                                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]">
                                                                    <ChevronDown size={10} />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className={`border border-[var(--border)] rounded-[var(--radius-sm)] p-0.5 transition-colors ${isLocked ? 'bg-[var(--bg-surface)] opacity-70' : 'bg-[var(--bg-surface)] focus-within:border-[var(--accent)]'}`}>
                                                                <textarea 
                                                                    rows={1}
                                                                    value={item.notes || ''}
                                                                    onChange={(e) => {
                                                                        updateReviewItemField(item.id, 'notes', e.target.value, isLocked);
                                                                        e.target.style.height = 'auto';
                                                                        e.target.style.height = e.target.scrollHeight + 'px';
                                                                    }}
                                                                    readOnly={isLocked}
                                                                    className="w-full bg-transparent border-none text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none px-2 py-1 resize-none"
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

                            <div className="px-6 py-4 bg-[var(--bg-surface)] border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4 relative">
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <h4 className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-[var(--accent)] rounded-full" />
                                        Sign-off execution area
                                    </h4>
                                    <div className="text-sm font-medium text-[var(--text-heading)] truncate max-w-2xl">
                                        {isSignedOff 
                                            ? `Digital protocol verified & sealed by ${signOffRecord?.name || meta.role}.` 
                                            : !canSignOff && task.auditPhase !== AuditPhase.REVIEW_AND_CONCLUSION 
                                                ? `Sign-off is only available during the ${AuditPhase.REVIEW_AND_CONCLUSION.replace(/_/g, ' ')} phase.`
                                                : task.status === TaskStatus.COMPLETED
                                                    ? `Task is already completed. Sign-off is no longer available.`
                                                    : `I hereby certify that I have checked the items above in accordance with established Audit Standards.`}
                                    </div>
                                    {isSignedOff && (
                                        <p className="text-xs font-medium text-[var(--color-success)] flex items-center gap-1.5 mt-0.5">
                                            <CheckCircle2 size={13} /> {signOffRecord?.name ? `${signOffRecord.name} \u00B7 ` : ''}Signed on {new Date(signOffDate!).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    )}
                                </div>

                                <button 
                                    onClick={() => handleReviewSignOff(layer)}
                                    disabled={isSignedOff || !canSignOff}
                                    className={`h-9 px-5 rounded-[var(--radius-md)] text-xs font-semibold flex items-center gap-2 transition-colors ${
                                        isSignedOff 
                                            ? 'bg-[var(--bg-secondary)] text-[var(--color-success)] border border-[rgba(79,178,134,0.25)] cursor-default' 
                                            : !canSignOff
                                                ? 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] cursor-not-allowed'
                                                : 'bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90'
                                    }`}
                                >
                                    {isSignedOff ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}
                                    <span>{isSignedOff ? 'Signed' : `Sign as ${layer}`}</span>
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
                toast.success(`Comprehensive Protocol Integrated: All phases populated.`, { icon: 'Ã°Å¸â€â€ž' });
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
                toast.success(`Imported protocol requirements into engagement workspace`, { icon: 'Ã°Å¸â€œÂ¥' });
            }
        } else {
            toast.error(`No protocol items found for this template mapping.`, { icon: 'Ã¢Å¡Â Ã¯Â¸Â' });
        }

        setImportPhase(null);
    };

    const selectClass = "w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] transition-colors text-xs text-left text-[var(--text-heading)] hover:border-[var(--border-mid)] focus:outline-none focus:border-[var(--accent)] appearance-none cursor-pointer";

    // Helper to render read-only approval status in the Settings tab.
    // Sign-off can ONLY be performed via the Reviewer Checklist tab by the assigned reviewer.
    // A2 fix: Show signer name from SignOffRecord if available, else fall back to timestamp alone
    const ApprovalStatusBadge = ({ approvedAt, signOff, isInFinalPhase }: { approvedAt?: string; signOff?: { uid: string; name: string; at: string }; isInFinalPhase: boolean }) => {
        if (approvedAt) {
            const signerName = signOff?.name;
            const signerDate = signOff?.at || approvedAt;
            return (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] border" style={{ background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)', color: 'var(--color-success)' }} title={signerName ? `Signed by ${signerName} on ${new Date(signerDate).toLocaleString()}` : undefined}>
                    <CheckCircle2 size={11} className="text-[var(--color-success)]" />
                    <span className="text-[10px] font-medium">
                        {signerName ? `${signerName} · ` : 'Signed · '}{new Date(signerDate).toLocaleDateString()}
                    </span>
                </div>
            );
        }
        if (!isInFinalPhase) {
            return (
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-medium px-1.5">
                    <Lock size={11} /> Phase locked
                </div>
            );
        }
        return (
            <div className="flex items-center gap-1.5 text-xs font-medium px-1.5" style={{ color: 'var(--color-warning)' }}>
                <History size={11} /> Awaiting sign-off
            </div>
        );
    };

    return (
        <>
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
                        className="relative w-full max-w-[1440px] h-[95vh] bg-[var(--bg-main)] border border-[var(--border)] shadow-xl flex flex-col rounded-[var(--radius-xl)] overflow-hidden"
                    >
                        {/* Header â€” Executive & Scannable */}
                        <div className="shrink-0 px-6 py-3 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-secondary)] z-[60]">
                            <div className="flex items-start md:items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
                                    <Shield size={16} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {client?.name && (
                                            <button
                                                type="button"
                                                onClick={() => onOpenClientDetail?.(client.id)}
                                                className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 truncate max-w-[220px]"
                                                title={client.name}
                                            >
                                                <Building2 size={12} className="flex-shrink-0" />
                                                <span className="truncate">{client.name}</span>
                                            </button>
                                        )}
                                        {task.taskType && (
                                            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-muted)] text-[10px] font-medium border border-[var(--border)]">
                                                {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                                            </span>
                                        )}
                                        {watchedFiscalYear && (
                                            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[rgba(79,178,134,0.1)] text-[var(--color-success)] text-[10px] font-medium border border-[rgba(79,178,134,0.25)] tabular-nums">
                                                FY {watchedFiscalYear}
                                            </span>
                                        )}
                                        {task.status && (
                                            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] capitalize">
                                                {task.status.replace(/_/g, ' ').toLowerCase()}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-base font-semibold text-heading tracking-tight leading-tight mt-1 truncate">
                                        {watch('title') || task.title || 'Untitled Engagement'}
                                    </h2>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                                {/* 3-Layer Sign-off Pipeline Status */}
                                <div className="hidden xl:flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border)] text-xs">
                                    <span className="text-[10px] font-medium text-[var(--text-muted)] mr-1">Sign-offs</span>
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] ${task.teamLeadSignOff ? 'bg-[rgba(79,178,134,0.1)] text-[var(--color-success)] font-medium' : 'text-[var(--text-muted)]'}`}>
                                        <span>TL</span>
                                        {task.teamLeadSignOff ? <Check size={11} /> : <span className="opacity-40">â—‹</span>}
                                    </div>
                                    <span className="text-[var(--border)] text-[10px]">â†’</span>
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] ${task.engagementReviewerSignOff ? 'bg-[rgba(79,178,134,0.1)] text-[var(--color-success)] font-medium' : 'text-[var(--text-muted)]'}`}>
                                        <span>ER</span>
                                        {task.engagementReviewerSignOff ? <Check size={11} /> : <span className="opacity-40">â—‹</span>}
                                    </div>
                                    <span className="text-[var(--border)] text-[10px]">â†’</span>
                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-sm)] ${task.signingPartnerSignOff ? 'bg-[rgba(79,178,134,0.1)] text-[var(--color-success)] font-medium' : 'text-[var(--text-muted)]'}`}>
                                        <span>SP</span>
                                        {task.signingPartnerSignOff ? <Check size={11} /> : <span className="opacity-40">â—‹</span>}
                                    </div>
                                </div>

                                {/* Due Date Indicator */}
                                {task.dueDate && (
                                    <div className="hidden sm:flex flex-col items-end text-right">
                                        <span className="text-[10px] font-medium text-[var(--text-muted)]">Due date</span>
                                        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                            {formatDateDual(task.dueDate).bs} <span className="font-normal text-[10px]" style={{ color: 'var(--text-muted)' }}>({formatDateDual(task.dueDate).ad})</span>
                                        </span>
                                    </div>
                                )}

                                {/* Progress */}
                                <div className="hidden md:flex flex-col items-end">
                                    <span className="text-[10px] font-medium text-[var(--text-muted)]">Progress</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="w-20 h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border)]">
                                            <div 
                                                className="h-full bg-[var(--accent)] transition-all duration-300 rounded-full"
                                                style={{ width: `${Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / Math.max(1, (task.subtasks || []).length)) * 100 || 0)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-[var(--accent)] tabular-nums">
                                            {Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / Math.max(1, (task.subtasks || []).length)) * 100 || 0)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Workpaper Export Dropdown */}
                                {task.id && canEditTask && (
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowExportMenu(!showExportMenu)}
                                            className="h-8 px-2.5 bg-secondary hover:bg-surface border border-border text-muted hover:text-heading rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
                                        >
                                            <Download size={12} />
                                            <span className="hidden sm:inline">Export</span>
                                            <ChevronDown size={11} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
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
                                                        className="absolute right-0 top-full mt-2 w-56 bg-secondary border border-border rounded-xl shadow-xl overflow-hidden z-[100] p-1 backdrop-blur-xl"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={handleExportPDF}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface text-muted hover:text-heading text-xs font-medium transition-colors text-left"
                                                        >
                                                            <div className="w-6 h-6 rounded bg-rose-500/10 flex items-center justify-center text-rose-400">
                                                                <FileText size={12} />
                                                            </div>
                                                            Direct PDF Export
                                                        </button>
                                                        <div className="h-px bg-border mx-2 my-0.5" />
                                                        <button
                                                            type="button"
                                                            onClick={handleExportExcel}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-surface text-muted hover:text-heading text-xs font-medium transition-colors text-left"
                                                        >
                                                            <div className="w-6 h-6 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                                                <BarChart2 size={12} />
                                                            </div>
                                                            Full Excel Workbook
                                                        </button>
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleCloseAttempt}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-heading hover:bg-secondary border border-border transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Secondary Navigation â€” Segmented Tabs */}
                        <div className="shrink-0 sticky top-0 bg-surface/90 backdrop-blur-md border-b border-border px-6 py-2 flex flex-wrap items-center justify-between gap-3 z-[50]">
                            <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border shadow-xs overflow-x-auto scrollbar-none max-w-full">
                                {(task.id ? [
                                    { id: 'OVERVIEW', label: 'Overview', icon: <Settings2 size={13} /> },
                                    { id: 'PROCEDURES', label: 'Procedures', icon: <CheckSquare size={13} />, badge: `${(task.subtasks || []).filter(s => s.isCompleted).length}/${(task.subtasks || []).length}` },
                                    { id: 'REVIEW_CHECKLIST', label: 'Review & Sign-Off', icon: <ShieldCheck size={13} />, badge: openQueryCount > 0 ? `${openQueryCount} Q` : undefined, badgeColor: 'bg-amber-500/20 text-amber-400' },
                                    { id: 'OBSERVATIONS', label: 'Observations', icon: <Eye size={13} />, badge: (task.observations || []).length > 0 ? (task.observations || []).length : undefined },
                                    { id: 'EVIDENCE', label: 'Workpapers', icon: <FolderOpen size={13} />, badge: auditFiles.length > 0 ? auditFiles.length : undefined },
                                    { id: 'COMMENTS', label: 'Discussion', icon: <MessageSquare size={13} />, badge: (task.comments || []).length > 0 ? (task.comments || []).length : undefined },
                                    { id: 'HISTORY', label: 'Audit Trail', icon: <History size={13} /> },
                                    ...(isArchived ? [] : [{ id: 'SETTINGS', label: 'Setup', icon: <Activity size={13} />, adminOnly: true }])
                                ] : [
                                    { id: 'SETTINGS', label: 'Engagement Setup', icon: <Settings2 size={13} /> },
                                    { id: 'PROCEDURES', label: 'Procedures', icon: <CheckSquare size={13} /> }
                                ]).map((tab: any) => {
                                    if (tab.desktopOnly && isMobile) return null;
                                    if (tab.adminOnly && !isAdminOrMaster) return null;
                                    const isActive = activeDetailTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveDetailTab(tab.id as any)}
                                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                                                isActive 
                                                    ? 'bg-surface text-heading font-semibold shadow-xs border border-border/80' 
                                                    : 'text-muted hover:text-heading hover:bg-surface/50'
                                            }`}
                                        >
                                            <span className={isActive ? 'text-accent' : 'text-muted'}>{tab.icon}</span>
                                            <span>{tab.label}</span>
                                            {tab.badge !== undefined && (
                                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${tab.badgeColor || (isActive ? 'bg-accent/15 text-accent' : 'bg-surface text-muted border border-border')}`}>
                                                    {tab.badge}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-2">
                                {activeDetailTab === 'PROCEDURES' && canAddSubtasks && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); setImportPhase(currentPhase); }}
                                        className="h-[30px] px-3 bg-secondary hover:bg-surface border border-border text-xs font-medium text-muted hover:text-heading rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                                    >
                                        <Sparkles size={13} className="text-accent" />
                                        <span>Import Protocol</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Layout */}
                        <div className="flex-1 overflow-hidden bg-[var(--bg-main)] flex flex-col">
                            {activeDetailTab === 'OVERVIEW' && (
                                <TaskDetailsTab
                                    task={task}
                                    usersList={usersList}
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
                                    uploadProgress={uploadProgress}
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
                                    <div className="max-w-[1600px] w-full mx-auto space-y-6 pb-24">
                                        
                                        {/* Main Form Fields Grouped */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)]">
                                            <Field label="Assignment Title" icon={<FileText size={14} className="text-[var(--accent)]" />} span2 error={!!errors.title}>
                                                <input
                                                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                                    placeholder="Enter engagement title..."
                                                    {...register('title')}
                                                    readOnly={!canManageTeam}
                                                />
                                            </Field>

                                            <Field label="Target Client" icon={<Briefcase size={14} className="text-[var(--accent)]" />} error={!!errors.clientId}>
                                                <Controller name="clientId" control={control} render={({ field }) => (
                                                    <ClientSelect 
                                                        clients={clientsList} 
                                                        value={field.value} 
                                                        onChange={field.onChange} 
                                                        disabled={!!task.id}
                                                    />
                                                )} />
                                            </Field>

                                            <Field label="Fiscal Year (BS)" icon={<Calendar size={14} className="text-[var(--color-success)]" />} error={!!errors.fiscalYear}>
                                                <select 
                                                    className={selectClass} 
                                                    {...register('fiscalYear')}
                                                    disabled={!!task.id}
                                                >
                                                    <option value="">Select...</option>
                                                    {fiscalYears.map(fy => (
                                                        <option key={fy} value={fy}>{fy}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Priority" icon={<Zap size={14} className="text-[var(--color-warning)]" />} error={!!errors.priority}>
                                                <select className={selectClass} {...register('priority')} disabled={!canEditTask || isTaskCompleted}>
                                                    {Object.values(TaskPriority).map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Status" icon={<Activity size={14} className="text-[var(--color-info)]" />} error={!!errors.status}>
                                                <select className={selectClass} {...register('status')} disabled={!canEditTask || isTaskCompleted}>
                                                    {[TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED].map(s => (
                                                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                                    ))}
                                                </select>
                                            </Field>

                                            <Field label="Staff Team Assigned" icon={<Users size={14} className="text-[var(--accent)]" />} span2>
                                                <Controller name="assignedTo" control={control} render={({ field }) => (
                                                    <StaffSelect users={usersList} value={field.value || []} onChange={field.onChange} multi={true} userTasksCount={userTasksCount} disabled={!canManageTeam} />
                                                )} />
                                            </Field>

                                            <Field label="Start Date" icon={<Calendar size={14} className="text-[var(--color-success)]" />} error={!!errors.startDate}>
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

                                            <Field label="Due Date" icon={<Clock size={14} className="text-[var(--color-danger)]" />} error={!!errors.dueDate}>
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

                                            <Field label="Estimated Days" icon={<Calendar size={14} className="text-[var(--color-warning)]" />}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="365"
                                                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium text-[var(--text-heading)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                                    placeholder="e.g. 5"
                                                    {...register('estimatedDays', { valueAsNumber: true })}
                                                    disabled={!canManageTeam || isTaskCompleted}
                                                />
                                            </Field>

                                            <Field label="Engagement Description" icon={<Book size={14} className="text-[var(--text-muted)]" />} span2>
                                                <textarea
                                                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors min-h-[100px] resize-y"
                                                    placeholder="Detailed context for the assignment..."
                                                    {...register('description')}
                                                    readOnly={!canEditTask || isTaskCompleted}
                                                />
                                            </Field>
                                        </div>

                                         {/* Quality Control Hierarchy Section */}
                                        <div className="p-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] space-y-6">
                                            <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
                                                <ShieldCheck size={18} className="text-[var(--accent)]" />
                                                <div>
                                                    <h4 className="text-xs font-semibold text-[var(--text-heading)]">Quality control hierarchy</h4>
                                                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                                        Sign-offs are performed exclusively in the Reviewer Checklist tab
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <Field 
                                                    label="Team Leader" 
                                                    icon={<UserCheck size={14} className="text-emerald-400" />}
                                                    extra={<ApprovalStatusBadge approvedAt={watch('teamLeadApprovedAt')} signOff={task.teamLeadSignOff} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
                                                >
                                                    <Controller name="teamLeaderId" control={control} render={({ field }) => (
                                                        <StaffSelect users={usersList.filter(u => (watch('assignedTo') || []).includes(u.uid))} value={field.value || ''} onChange={field.onChange} placeholder="Select Team Leader..." disabled={!!watch('teamLeadApprovedAt') || !canManageTeam} compact />
                                                    )} />
                                                </Field>

                                                <Field 
                                                    label="QC Reviewer" 
                                                    icon={<Shield size={14} className="text-purple-400" />}
                                                    extra={<ApprovalStatusBadge approvedAt={watch('engagementReviewerApprovedAt')} signOff={task.engagementReviewerSignOff} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
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
                                                    extra={<ApprovalStatusBadge approvedAt={watch('signingPartnerApprovedAt')} signOff={task.signingPartnerSignOff} isInFinalPhase={currentPhase === AuditPhase.REVIEW_AND_CONCLUSION} />}
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
                                        <div className="p-6 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-2">
                                                    <Shield size={14} className="text-[var(--accent)]" />
                                                    Framework deployment
                                                </h4>
                                                {!!task.taskType && !canChangeFramework && (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-sm)]">
                                                        <Lock size={10} className="text-[var(--text-muted)]" />
                                                        <span className="text-xs font-medium text-[var(--text-muted)]">Locked to {TASK_TYPE_LABELS[task.taskType] || task.taskType}</span>
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
                                                            className={`p-3.5 rounded-[var(--radius-md)] border transition-colors flex items-center text-left gap-3 group ${isSelected ? 'bg-[var(--accent-dim)] border-[var(--border-accent)] text-[var(--accent)]' : 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[var(--border-mid)]'} ${(!canManageTeam || (isLocked && !isSelected)) ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                        >
                                                            <div className={`w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)]'}`}>
                                                                {isSelected && isLocked ? <Lock size={13} /> : (ICON_MAP[iconName] ? React.cloneElement(ICON_MAP[iconName], { size: 13 }) : <FolderOpen size={13} />)}
                                                            </div>
                                                            <span className="text-xs font-semibold leading-tight flex-1" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>{label}</span>
                                                            {isSelected && isLocked && (
                                                                <Check size={13} className="text-[var(--accent)]" />
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

                        {/* Footer â€” Slim & Clean */}
                        <div className="shrink-0 px-6 py-2.5 border-t border-[var(--border)] bg-[var(--bg-secondary)] flex justify-between items-center z-[60]">
                            <div className="flex items-center gap-6">
                                {isEditMode && canManageTask && !isTaskCompleted && (
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={() => onDelete(task.id!)}
                                            className="text-[var(--text-muted)] hover:text-[var(--color-danger)] text-xs font-medium transition-colors flex items-center gap-2"
                                        >
                                            <Trash2 size={14} />
                                            Abort engagement
                                        </button>
                                    </div>
                                )}

                                {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && 
                                  isTaskCompleted && 
                                  task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION && 
                                  task.status !== TaskStatus.ARCHIVED && (
                                    <div className="flex items-center gap-6">
                                        <div className="w-px h-4 bg-[var(--border)]" />
                                        <button
                                            onClick={() => onArchive && onArchive(task.id!)}
                                            className="text-[var(--text-muted)] hover:text-[var(--accent)] text-xs font-medium transition-colors flex items-center gap-2"
                                        >
                                            <History size={14} />
                                            Archive engagement
                                        </button>
                                    </div>
                                )}

                                {/* Sync Status Indicator */}
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-[var(--color-warning)] animate-pulse' : isDirty ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'}`} />
                                    <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                        {isSaving ? 'Syncing...' : isDirty ? 'Unsaved changes' : 'Cloud synced'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        if (isDirty) setShowDiscardBanner(true);
                                        else onClose();
                                    }}
                                    className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] text-xs font-medium rounded-[var(--radius-md)] transition-colors border border-[var(--border)] shadow-none"
                                >
                                    Exit workspace
                                </button>
                                 {!isTaskCompleted && canEditTask && (
                                    <button
                                        onClick={handleSubmit(handleSave, (errs) => {
                                            const firstErr = Object.values(errs)[0];
                                            if (firstErr) toast.error(firstErr.message as string);
                                        })}
                                        disabled={isSaving}
                                        className={`px-5 py-2 rounded-[var(--radius-md)] text-xs font-semibold transition-colors shadow-none flex items-center gap-2 ${
                                            (formIsDirty || isDirty || !task.id) 
                                            ? 'bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90' 
                                            : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)] cursor-not-allowed'
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
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="fixed inset-x-0 bottom-6 mx-auto w-max px-4 py-2.5 bg-[var(--bg-elevated)] rounded-[var(--radius-lg)] border border-[var(--border)] flex items-center gap-4 shadow-lg z-[200]"
                            >
                                <div className="flex items-center gap-2.5">
                                    <AlertTriangle size={16} className="text-[var(--color-warning)] flex-shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-[var(--text-heading)] leading-none">Unsaved changes</span>
                                        <span className="text-[11px] text-[var(--text-muted)] mt-0.5">Exit without saving?</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setShowDiscardBanner(false)} className="px-3 py-1.5 text-xs font-medium text-[var(--text-heading)] bg-[var(--bg-surface)] hover:bg-[var(--bg-main)] rounded-[var(--radius-sm)] transition-colors border border-[var(--border)]">Stay</button>
                                    <button onClick={() => { setShowDiscardBanner(false); onClose(); }} className="px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)] bg-[var(--color-danger)] hover:opacity-90 rounded-[var(--radius-sm)] transition-colors">Discard</button>
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
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl bg-[var(--bg-main)] border border-[var(--border)] rounded-[var(--radius-xl)] flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
                            <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-base font-semibold text-[var(--text-heading)] flex items-center gap-3">
                                        <Book size={20} className="text-[var(--accent)]" />
                                        Import engagement protocol
                                    </h3>
                                    <button onClick={() => { setImportPhase(null); setTemplateSearchQuery(''); setShowAllFrameworks(false); }} className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"><X size={16} /></button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accent)]" />
                                        <input
                                            type="text"
                                            placeholder="Search database..."
                                            value={templateSearchQuery}
                                            onChange={e => setTemplateSearchQuery(e.target.value)}
                                            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] pl-9 pr-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                        />
                                    </div>
                                    {watch('taskType') && (
                                        <button
                                            onClick={() => setShowAllFrameworks(prev => !prev)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium border transition-colors whitespace-nowrap ${showAllFrameworks ? 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)]' : 'bg-[var(--accent-dim)] border-[var(--border-accent)] text-[var(--accent)]'}`}
                                        >
                                            {showAllFrameworks ? <Eye size={13} /> : <CheckCircle2 size={13} />}
                                            {showAllFrameworks ? 'All' : 'Suggested'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[var(--bg-main)]">
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
                                            <div className="text-center py-16 bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] px-6">
                                                <Book size={48} className="mx-auto mb-4 opacity-20 text-[var(--text-muted)]" />
                                                <p className="font-semibold text-sm" style={{ color: 'var(--text-heading)' }}>No protocol found</p>
                                                <p className="text-xs mt-1 font-normal" style={{ color: 'var(--text-muted)' }}>Refine search or check another framework mapping.</p>
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
                                            className="flex items-center gap-3 w-full text-left p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--border-accent)] hover:bg-[var(--accent-dim)] transition-colors group shadow-none"
                                        >
                                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-[var(--accent)]">
                                                <CheckCircle2 size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-semibold text-[var(--text-heading)] truncate">{template.name}</p>
                                                    {template.taskType && <span className="text-[10px] font-medium px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--border-accent)]">{template.taskType}</span>}
                                                </div>
                                                {template.description && <p className="text-[11px] line-clamp-1 mt-0.5 font-normal" style={{ color: 'var(--text-muted)' }}>{template.description}</p>}
                                            </div>
                                            <div className="text-[11px] font-medium text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--accent-dim)] px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border-accent)] flex-shrink-0">Deploy</div>
                                        </button>
                                    );

                                    return (
                                        <div className="space-y-6">
                                            {rootTemplates.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <div className="w-1.5 h-3 bg-[var(--accent)] rounded-full" />
                                                        <h4 className="text-xs font-semibold text-[var(--text-muted)]">Audit library</h4>
                                                        <span className="text-xs tabular-nums font-medium text-[var(--text-muted)] ml-auto">{rootTemplates.length}</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {rootTemplates.map(renderTemplateButton)}
                                                    </div>
                                                </div>
                                            )}
                                            {folderSections.map(({ folder, templates: fTemplates }) => (
                                                <div key={folder.id} className="space-y-3">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <div className="w-1.5 h-3 rounded-full bg-[var(--accent)]" />
                                                        <h4 className="text-xs font-semibold text-[var(--text-muted)]">{folder.name}</h4>
                                                        <span className="text-xs tabular-nums font-medium text-[var(--text-muted)] ml-auto">{fTemplates.length}</span>
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

        {/* A6/U5: Inline Review Query / Reply Modal (replaces browser prompt) â€” rendered outside AnimatePresence but inside fragment */}
        {queryModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/50" onClick={() => setQueryModal(null)} />
                <div className="relative z-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 w-full max-w-md shadow-xl">
                    <h3 className="text-xs font-semibold text-[var(--text-heading)] mb-1">
                        {queryModal.mode === 'RAISE' ? 'Raise review query' : 'Reply to query'}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                        {queryModal.mode === 'RAISE' ? 'Describe the issue or question for the preparer.' : 'Provide your response to the reviewer query.'}
                    </p>
                    <textarea
                        className="w-full h-28 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent)]"
                        placeholder={queryModal.mode === 'RAISE' ? 'Enter your review note or query...' : 'Enter your response...'}
                        value={queryText}
                        onChange={e => setQueryText(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                if (queryText.trim()) {
                                    handleSubtaskAction(queryModal.subtaskId, queryModal.mode === 'RAISE' ? 'RAISE_QUERY' : 'REPLY', queryText.trim());
                                    setQueryModal(null); setQueryText('');
                                }
                            }
                        }}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setQueryModal(null)} className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors">Cancel</button>
                        <button
                            disabled={!queryText.trim()}
                            className="px-4 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-[var(--accent)] text-[var(--on-accent)] disabled:opacity-40 transition-colors"
                            onClick={() => {
                                if (queryText.trim()) {
                                    handleSubtaskAction(queryModal.subtaskId, queryModal.mode === 'RAISE' ? 'RAISE_QUERY' : 'REPLY', queryText.trim());
                                    setQueryModal(null); setQueryText('');
                                }
                            }}
                        >
                            {queryModal.mode === 'RAISE' ? 'Raise Query' : 'Submit Reply'}
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-600 mt-2 text-right">Ctrl+Enter to submit</p>
                </div>
            </div>
        )}
        </>
    );
};

export default TaskDetailPane;
