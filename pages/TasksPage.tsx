import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
    LayoutGrid, List as ListIcon, UserCircle2, ChevronDown, Check, Sparkles, Plus, Filter, Search,
    Trash2, X, FileSpreadsheet, FileText, Activity, ArrowRight, GanttChartSquare, Layers
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskTemplate, TaskComment, AuditPhase, TaskType } from '../types';
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS } from '../constants/taskTypeChecklists';
import { ShieldCheck, Scale, ClipboardCheck, Award, BarChart2, FileSearch, FolderOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext'; // Import ModalContext
import { AuthService } from '../services/firebase'; // Keep for static helpers if any, or verify removal
// import { TemplateService } from '../services/templates'; // Removed
import { getCurrentDateUTC } from '../utils/dates';
import { useInfiniteTasks, useCreateTask, useUpdateTask, useDeleteTask, useAddTaskComment, useUpdateTaskStatus, taskKeys } from '../hooks/useTasks';
import { useClients } from '../hooks/useClients';
import { useUsers } from '../hooks/useStaff';
import { useTemplates } from '../hooks/useTemplates';
import { useQueryClient } from '@tanstack/react-query';
import { SIGNING_AUTHORITIES } from '../constants/firmData';
import TaskTemplateModal from '../components/TaskTemplateModal';
import TemplateManager from '../components/TemplateManager';
import ClientSelect from '../components/ClientSelect';
import StaffSelect from '../components/StaffSelect';
import TaskComments from '../components/TaskComments';
import TaskMainView from '../components/tasks/TaskMainView';
import NepaliDatePicker from '../components/NepaliDatePicker';
import TaskDetailPane from '../components/tasks/TaskDetailPane';
import TaskTimelineView from '../components/tasks/TaskTimelineView';
import ClientDetailModal from "../components/tasks/ClientDetailModal";
import { ComplianceService, complianceKeys } from "../services/advanced";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { useMedia, useIntersection } from 'react-use';

const PHASE_ORDER = {
    [AuditPhase.ONBOARDING]: 1,
    [AuditPhase.PLANNING_AND_EXECUTION]: 2,
    [AuditPhase.REVIEW_AND_CONCLUSION]: 3
};const STATUS_ORDER = {
    [TaskStatus.NOT_STARTED]: 1,
    [TaskStatus.IN_PROGRESS]: 2,
    [TaskStatus.COMPLETED]: 3
};

const PHASE_LABELS = {
    [AuditPhase.ONBOARDING]: 'P1',
    [AuditPhase.PLANNING_AND_EXECUTION]: 'P2',
    [AuditPhase.REVIEW_AND_CONCLUSION]: 'P3'
};

const TasksPage: React.FC = () => {

    // Fetch Compliance Events for Modal
    const { data: complianceEvents = [] } = useQuery({
        queryKey: complianceKeys.all,
        queryFn: () => ComplianceService.getEvents()
    });

    const handleOpenClientDetail = (clientId: string) => {
        const client = clientsList.find(c => c.id === clientId);
        if (client) setSelectedClientForDetail(client);
    };
    const { user } = useAuth();
    const { openModal } = useModal();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    // -- DATA FETCHING (React Query) --
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: tasksLoading } = useInfiniteTasks();
    const tasks = data?.pages.flatMap(page => page.tasks) ?? [];


    const { data: usersList = [], isLoading: usersLoading } = useUsers();
    const { data: clientsList = [], isLoading: clientsLoading } = useClients();
    const { data: templates = [], isLoading: templatesLoading } = useTemplates();

    const loading = tasksLoading || usersLoading || clientsLoading || templatesLoading;



    // -- MUTATIONS --
    const createTaskMutation = useCreateTask();


    const updateTaskMutation = useUpdateTask();
    const updateTaskStatusMutation = useUpdateTaskStatus();
    const deleteTaskMutation = useDeleteTask();


    const addCommentMutation = useAddTaskComment();



    const isMobile = useMedia('(max-width: 768px)', false);
    
    // -- INFINITE SCROLL LOGIC --
    const sentinelRef = useRef<HTMLDivElement>(null);
    const intersection = useIntersection(sentinelRef, {
        root: null,
        rootMargin: '400px',
        threshold: 0,
    });

    useEffect(() => {
        if (intersection?.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [intersection, hasNextPage, isFetchingNextPage, fetchNextPage]);



    const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN' | 'TIMELINE'>(isMobile ? 'LIST' : 'KANBAN');

    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

    // Bulk Actions State
    const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
    const [showBulkAssignMenu, setShowBulkAssignMenu] = useState(false);
    const [showWorkflowMenu, setShowWorkflowMenu] = useState(false);
    const workflowMenuRef = useRef<HTMLDivElement>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);
    const assignMenuRef = useRef<HTMLDivElement>(null);

    // Confirmation Modal State (replaces window.confirm)
    const [confirmModal, setConfirmModal] = useState<{ 
        open: boolean; 
        title: string; 
        message: string; 
        onConfirm?: () => void;
        onSecondaryConfirm?: () => void;
        onCancel?: () => void;
        confirmLabel?: string;
        secondaryLabel?: string;
        cancelLabel?: string;
        variant?: 'danger' | 'warning' | 'info' | 'success' | 'indigo';
        showConfirm?: boolean;
    }>({
        open: false, title: '', message: '', variant: 'danger', showConfirm: true
    });

    // --- AUTO-INJECTION UTILITIES (PROMPT 3 & 4) ---
    const injectPhaseSubtasks = useCallback((
        task: Task,
        newPhase: AuditPhase,
        templates: TaskTemplate[]
    ): SubTask[] | null => {
        let sourceTemplates: TaskTemplate[] = [];

        if (task.linkedFolderId) {
            sourceTemplates = templates.filter(t => t.folderId === task.linkedFolderId);
        } else if (task.templateId) {
            const t = templates.find(temp => temp.id === task.templateId);
            if (t) sourceTemplates = [t];
        }

        if (!sourceTemplates.length) return null;

        let phaseSubtasks: any[] = [];
        sourceTemplates.forEach(template => {
            const items = template.subtaskDetails?.filter(s => s.phase === newPhase) || [];
            phaseSubtasks = [...phaseSubtasks, ...items];
        });

        if (!phaseSubtasks.length) return null;

        const existingTitles = new Set(task.subtasks?.map(st => st.title.trim().toLowerCase()) ?? []);
        const uniqueNew: SubTask[] = phaseSubtasks
            .filter(s => !existingTitles.has(s.title.trim().toLowerCase()))
            .map(s => {
                let assignedTo: string[] = [];
                if (s.assigneeRole) {
                    const matchedUser = usersList.find(u => u.role === s.assigneeRole);
                    if (matchedUser) assignedTo = [matchedUser.uid];
                }
                return {
                    id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    title: s.title,
                    isCompleted: false,
                    minimumRequirement: s.minimumRequirement,
                    createdAt: new Date().toISOString(),
                    createdBy: user?.uid || 'system',
                    phase: newPhase,
                    assignedTo,
                    isNew: true
                };
            });

        return uniqueNew.length ? uniqueNew : null;
    }, [templates, usersList, user]);

    const swapPhaseChecklist = useCallback((
        task: Task,
        newPhase: AuditPhase
    ): SubTask[] => {
        const existingSubtasks = task.subtasks ?? [];
        const existingTitles = new Set(existingSubtasks.map(s => s.title.trim().toLowerCase()));
        let phaseItems: { title: string; minimumRequirement?: string }[] = [];

        // 1. Try Linked Folder first
        if (task.linkedFolderId) {
            const folderTemplates = templates.filter(t => t.folderId === task.linkedFolderId);
            folderTemplates.forEach(t => {
                const items = t.subtaskDetails?.filter(sd => sd.phase === newPhase) || [];
                phaseItems = [...phaseItems, ...items];
            });
        }

        // 2. Fallback to Task Type defaults from Database Templates
        if (phaseItems.length === 0 && task.taskType) {
            const taskTypeTemplates = templates.filter(t => t.taskType === task.taskType);
            taskTypeTemplates.forEach(t => {
                const items = t.subtaskDetails?.filter(sd => sd.phase === newPhase) || [];
                phaseItems = [...phaseItems, ...items];
            });
        }

        if (phaseItems.length === 0) return existingSubtasks;

        // Create new auto-generated subtasks for the new phase if they don't already exist
        const newAutoSubtasks: SubTask[] = phaseItems
            .filter(item => !existingTitles.has(item.title.trim().toLowerCase()))
            .map(item => ({
                id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                title: item.title,
                isCompleted: false,
                minimumRequirement: item.minimumRequirement,
                createdAt: new Date().toISOString(),
                createdBy: 'system',
                phase: newPhase,
                isAutoGenerated: true,
                isNew: true
            }));

        return [...existingSubtasks, ...newAutoSubtasks];
    }, [templates]);

    const injectStatusSubtasks = useCallback((
        task: Task,
        newStatus: TaskStatus,
        templates: TaskTemplate[]
    ): SubTask[] | null => {
        let sourceTemplates: TaskTemplate[] = [];

        if (task.linkedFolderId) {
            sourceTemplates = templates.filter(t => t.folderId === task.linkedFolderId);
        } else if (task.templateId) {
            const t = templates.find(temp => temp.id === task.templateId);
            if (t) sourceTemplates = [t];
        }

        if (!sourceTemplates.length) return null;

        let statusItems: any[] = [];
        sourceTemplates.forEach(template => {
            const items = template.statusSubtasks?.[newStatus] || [];
            statusItems = [...statusItems, ...items];
        });

        if (!statusItems.length) return null;

        const existingTitles = new Set(task.subtasks?.map(st => st.title.trim().toLowerCase()) ?? []);
        const unique = statusItems
            .filter(s => !existingTitles.has(s.title.trim().toLowerCase()))
            .map(s => ({
                id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                title: s.title,
                isCompleted: false,
                minimumRequirement: s.minimumRequirement,
                createdAt: new Date().toISOString(),
                createdBy: user?.uid || 'system',
                isNew: true
            }));
        return unique.length ? unique : null;
    }, [templates, user]);

    const showInjectionToast = (taskId: string, originalSubtasks: SubTask[], count: number, label: string) => {
        toast.success(
            <div className="flex items-center gap-3">
                <span className="flex-1 text-xs">
                    <b>{count}</b> subtask(s) auto-added for <b>{label}</b>
                </span>
                <button 
                    onClick={() => updateTaskMutation.mutate({ id: taskId, updates: { subtasks: originalSubtasks } })}
                    className="px-2 py-1 rounded bg-white/10 text-[10px] font-black uppercase tracking-tighter hover:bg-white/20 transition-all border border-white/10"
                >
                    Undo
                </button>
            </div>,
            { duration: 5000, position: 'bottom-right' }
        );
    };

    // Saved Filters UI State
    const [showSavedFilters, setShowSavedFilters] = useState(false);
    const [savedFilterName, setSavedFilterName] = useState('');
    const savedFiltersRef = useRef<HTMLDivElement>(null);

    // Collapsible Filter Panel
    const [showFilterPanel, setShowFilterPanel] = useState(false);



    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
                setShowBulkStatusMenu(false);
            }
            if (assignMenuRef.current && !assignMenuRef.current.contains(event.target as Node)) {
                setShowBulkAssignMenu(false);
            }
            if (savedFiltersRef.current && !savedFiltersRef.current.contains(event.target as Node)) {
                setShowSavedFilters(false);
            }
        };

        if (showBulkStatusMenu || showBulkAssignMenu || showSavedFilters) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showBulkStatusMenu, showBulkAssignMenu, showSavedFilters]);

    useEffect(() => {
        if (isMobile && (viewMode === 'KANBAN' || viewMode === 'TIMELINE')) {
            setViewMode('LIST');
        }
    }, [isMobile, viewMode]);
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
    const [selectedClientForDetail, setSelectedClientForDetail] = useState<Client | null>(null);
    const [collapsedColumns, setCollapsedColumns] = useState<TaskStatus[]>([]);

    const toggleTaskSelection = (taskId: string) => {


        setSelectedTaskIds(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    // Modal & Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [dateMode, setDateMode] = useState<'AD' | 'BS'>('AD');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Initial query param check
    useEffect(() => {
        const staffParam = searchParams.get('staff');


        if (staffParam) {
            setFilterStaff(staffParam);
        }
    }, [searchParams]);

    // Permissions check
    const isAdminOrManager = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.MASTER_ADMIN;
    // Master Admin can grant task-creation rights to any user via System Settings
    const canCreateTask = isAdminOrManager || user?.taskCreationAuthorized === true;
    const canManageTask = isAdminOrManager;

    // Returns true if the current user can open the edit modal for a given task.
    // Authorized-but-non-admin users can only edit tasks they created or are assigned to.
    const canEditTask = (task: Partial<Task>): boolean => {
        if (!user) return false;
        if (isAdminOrManager) return true;
        if (task.createdBy === user.uid) return true;
        if (task.assignedTo?.includes(user.uid)) return true;
        return false;
    };



    const [filterPriority, setFilterPriority] = useState<string>(() => localStorage.getItem('rsa_filter_priority') || 'ALL');
    const [filterStatus, setFilterStatus] = useState<string>(() => localStorage.getItem('rsa_filter_status') || 'ALL');
    const [filterClient, setFilterClient] = useState<string>(() => localStorage.getItem('rsa_filter_client') || 'ALL');
    const [groupBy, setGroupBy] = useState<'NONE' | 'AUDITOR' | 'ASSIGNEE' | 'PHASE'>(() => (localStorage.getItem('rsa_filter_groupby') as any) || 'NONE');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStaff, setFilterStaff] = useState<string>(() => localStorage.getItem('rsa_filter_staff') || 'ALL');
    const [filterAuditor, setFilterAuditor] = useState<string>(() => localStorage.getItem('rsa_filter_auditor') || 'ALL');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [filterTaskType, setFilterTaskType] = useState<TaskType | 'ALL'>(() => (localStorage.getItem('rsa_filter_tasktype') as any) || 'ALL');

    // Auto-persistence Effects
    useEffect(() => {
        localStorage.setItem('rsa_filter_priority', filterPriority);
        localStorage.setItem('rsa_filter_status', filterStatus);
        localStorage.setItem('rsa_filter_client', filterClient);
        localStorage.setItem('rsa_filter_groupby', groupBy);
        localStorage.setItem('rsa_filter_staff', filterStaff);
        localStorage.setItem('rsa_filter_auditor', filterAuditor);
        localStorage.setItem('rsa_filter_tasktype', filterTaskType);
    }, [filterPriority, filterStatus, filterClient, groupBy, filterStaff, filterAuditor, filterTaskType]);

    // Global Filter Reset Listener
    useEffect(() => {
        const handleClearAll = () => {
            setFilterStatus('ALL');
            setFilterPriority('ALL');
            setFilterTaskType('ALL');
            setFilterClient('ALL');
            setFilterStaff('ALL');
            setFilterAuditor('ALL');
            setSearchTerm('');
            setDateRange({ start: '', end: '' });
        };
        window.addEventListener('rsa-clear-filters', handleClearAll);
        return () => window.removeEventListener('rsa-clear-filters', handleClearAll);
    }, []);

    const filteredTasks = tasks.filter(t => {
        if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
        if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
        if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterStaff !== 'ALL' && !t.assignedTo.includes(filterStaff)) return false;
        if (filterClient !== 'ALL' && !t.clientIds?.includes(filterClient)) return false;
        if (filterTaskType !== 'ALL' && t.taskType !== filterTaskType) return false;

        // Advanced Filters
        if (filterAuditor !== 'ALL') {
            const taskClient = clientsList.find(c => t.clientIds && t.clientIds.includes(c.id));

            if (!taskClient) return false;
            if (filterAuditor !== 'ALL' && taskClient.signingAuthority !== filterAuditor) return false;
        }

        return true;
    });

    const canUpdateTaskStatus = (task: Partial<Task>) => {
        if (!user || !task) return false;
        
        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN;
        const isManager = user.role === UserRole.MANAGER;
        
        // --- 1. Completed Lockdown: Locked once in Phase 3 + Completed status ---
        if (task.status === TaskStatus.COMPLETED && 
            task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION) {
            return isAdmin;
        }

        // --- 2. Base permissions ---
        if (isAdmin || isManager) return true;
        if (task.teamLeaderId === user.uid) return true;
        if (task.assignedTo?.includes(user.uid)) return true;
        
        return false;
    };

    const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

    const handleOpenCreate = () => {
        if (!canCreateTask) return;
        setIsEditMode(false);
        setFormError('');
        setCurrentTask({
            title: '',
            description: '',
            assignedTo: [],
            status: TaskStatus.NOT_STARTED,
            priority: TaskPriority.MEDIUM,
            subtasks: [],
            startDate: getCurrentDateUTC(),
            dueDate: getCurrentDateUTC(),
            clientIds: [],
            teamLeaderId: '',
            comments: [],
            auditPhase: AuditPhase.ONBOARDING,
            taskType: filterTaskType !== 'ALL' ? (filterTaskType as TaskType) : TaskType.OTHER
        });
        setIsModalOpen(true);
        setDateMode('AD');
        setNewSubtaskTitle('');
    };

    const handleOpenEdit = (task: Task) => {
        if (!canEditTask(task)) {
            toast.error("You don't have permission to edit this task.");
            return;
        }
        setCurrentTask(task);
        setIsEditMode(true);
        setIsModalOpen(true);
        setSelectedTaskId(task.id);
        setNewSubtaskTitle('');
    };

    const cleanForFirestore = <T extends Record<string, any>>(obj: T): T => {
        if (Array.isArray(obj)) {
            return obj.map(v => (v && typeof v === 'object' ? cleanForFirestore(v) : v)) as any;
        }
        
        if (obj !== null && typeof obj === 'object') {
            return Object.entries(obj).reduce((acc, [key, value]) => {
                if (value !== undefined) {
                    acc[key] = value && typeof value === 'object' ? cleanForFirestore(value) : value;
                }
                return acc;
            }, {} as any) as T;
        }
        return obj;
    };


    const triggerNextTemplateIfNeeded = async (taskId: string, newStatus: TaskStatus) => {
        if (newStatus !== TaskStatus.COMPLETED) return;
        const task = tasks.find(t => t.id === taskId);
        if (!task || !task.nextTemplateId) return;

        const nextTemplate = templates.find(t => t.id === task.nextTemplateId);
        if (!nextTemplate) return;

        const generatedSubtasks: SubTask[] = [];
        
        // Strictly handle template subtasks (either detailed or simple strings)
        const templateSubtasks = nextTemplate.subtaskDetails || 
                                 nextTemplate.subtasks?.map(title => ({ title })) || [];

        const assignedSet = new Set<string>();

        templateSubtasks.forEach((s: any) => {
            let assignedUserId: string | undefined = undefined;
            if (s.assigneeRole) {
                const matchedUser = usersList.find(u => u.role === s.assigneeRole);
                if (matchedUser) {
                    assignedUserId = matchedUser.uid;
                    assignedSet.add(matchedUser.uid);
                }
            }

            generatedSubtasks.push({
                id: Math.random().toString(36).substr(2, 9),
                title: s.title,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                createdBy: user?.uid || 'system',
                assignedTo: assignedUserId ? [assignedUserId] : [],
                minimumRequirement: s.minimumRequirement,
                phase: s.phase
            });
        });

        let dueDate = getCurrentDateUTC();
        if (nextTemplate.expectedDays) {
            const d = new Date();
            d.setDate(d.getDate() + nextTemplate.expectedDays);
            dueDate = d.toISOString().split('T')[0];
        }

        const newTaskObj = {
            title: nextTemplate.name + ' for ' + (task.clientName || 'Internal'),
            description: nextTemplate.description || '',
            priority: nextTemplate.priority || TaskPriority.MEDIUM,
            status: TaskStatus.NOT_STARTED,
            // Cumulative: Inherit all subtasks from the previous task
            subtasks: [...(task.subtasks || []), ...generatedSubtasks],
            dueDate: dueDate,
            totalTimeSpent: 0,
            nextTemplateId: nextTemplate.nextTemplateId || '',
            templateId: nextTemplate.id, // Set the new template ID
            clientIds: task.clientIds || [],
            clientName: task.clientName || '',
            assignedTo: task.assignedTo || Array.from(assignedSet),
            teamLeaderId: task.teamLeaderId || user?.uid || '',
            createdBy: user?.uid || 'system',
            createdAt: new Date().toISOString(),
            taskType: task.taskType || nextTemplate.taskType // Preserve task type
        };

        try {
            await createTaskMutation.mutateAsync(newTaskObj as Task);
            toast.success(`Workflow Auto-triggered: ${nextTemplate.name}`);
        } catch (e) {
            console.error("Auto trigger failed", e);
        }
    };

    const handleSaveTask = async (taskData?: Partial<Task>) => {
        const dataToSave = taskData || currentTask;
        if (!dataToSave.title?.trim()) {
            setFormError("Title is required.");
            return;
        }
        setIsSaving(true);
        try {
            const taskToSave = cleanForFirestore(dataToSave);

            if (isEditMode && dataToSave.id) {
                // EXTREMELY IMPORTANT: Unpack comments out so it doesn't revert newer comments added to the DB
                const { comments, ...updatesWithoutComments } = taskToSave;
                
                const oldTask = tasks.find(t => t.id === dataToSave.id);
                updateTaskMutation.mutate({ id: dataToSave.id, updates: updatesWithoutComments });
                
                if (oldTask && oldTask.status !== TaskStatus.COMPLETED && dataToSave.status === TaskStatus.COMPLETED) {
                    triggerNextTemplateIfNeeded(dataToSave.id, TaskStatus.COMPLETED);
                }
            } else {
                createTaskMutation.mutate(taskToSave as Task);
                // Clear view-restricting filters so the user immediately sees the task
                if (filterStatus !== 'ALL') setFilterStatus('ALL');
                if (filterPriority !== 'ALL' && taskToSave.priority !== filterPriority) setFilterPriority('ALL');
                if (filterClient !== 'ALL' && !taskToSave.clientIds?.includes(filterClient)) setFilterClient('ALL');
                if (filterStaff !== 'ALL' && !taskToSave.assignedTo?.includes(filterStaff)) setFilterStaff('ALL');
                if (filterTaskType !== 'ALL' && taskToSave.taskType !== filterTaskType) setFilterTaskType('ALL');
                if (filterAuditor !== 'ALL') setFilterAuditor('ALL');
                if (searchTerm) setSearchTerm('');
            }

            // Mentions Notification Logic (In-app)
            if (currentTask.description) {
                usersList.forEach(u => {
                    const mention = `@${u.displayName} `;
                    if (currentTask.description?.includes(mention) && u.uid !== user?.uid) {
                        AuthService.createNotification({
                            userId: u.uid,
                            title: 'You were mentioned',
                            message: `${user?.displayName || 'Someone'} mentioned you in task: ${currentTask.title} `,
                            type: 'INFO',
                            category: 'TASK',
                            link: '/tasks'
                        });
                    }
                });
            }

            setIsModalOpen(false);
            setSelectedTaskId(undefined);
            // Toast will be handled by the mutation hooks
        } catch (error) {
            console.error('Error saving task:', error);
            toast.error('Failed to save task');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        setConfirmModal({
            open: true,
            title: 'Delete Task',
            message: 'Are you sure you want to delete this task? This action cannot be undone.',
            confirmLabel: 'Delete',
            variant: 'danger',
            onConfirm: () => {
                deleteTaskMutation.mutate(taskId);
                setIsModalOpen(false);
                setSelectedTaskId(undefined);
                setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
            }
        });
    };

    // --- BULK ACTIONS ---
    const handleBulkDelete = async () => {
        if (!selectedTaskIds.length) return;
        const count = selectedTaskIds.length;


        setConfirmModal({
            open: true,
            title: `Delete ${count} Tasks`,
            message: `Are you sure you want to delete ${count} task${count > 1 ? 's' : ''}? This action cannot be undone.`,
            confirmLabel: 'Delete All',
            variant: 'danger',
            onConfirm: () => {
                selectedTaskIds.forEach(id => deleteTaskMutation.mutate(id));
                toast.success(`Deleting ${count} tasks`);
                setSelectedTaskIds([]);
            }
        });
    };

    const handleBulkStatusChange = async (newStatus: TaskStatus) => {
        if (!selectedTaskIds.length) return;
        setShowBulkStatusMenu(false);
        try {
            await Promise.all(selectedTaskIds.map(async id => {
                const task = tasks.find(t => t.id === id);
                if (!task) return;
                
                const updates: Partial<Task> = { status: newStatus };
                
                // PROMPT 4: Inject status subtasks
                const injected = injectStatusSubtasks(task, newStatus, templates);
                if (injected) {
                    updates.subtasks = [...(task.subtasks || []), ...injected];
                    showInjectionToast(task.id, task.subtasks || [], injected.length, newStatus.replace(/_/g, ' '));
                }

                await updateTaskMutation.mutateAsync({ id, updates });
                if (newStatus === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
                    triggerNextTemplateIfNeeded(id, newStatus);
                }
            }));
            setSelectedTaskIds([]);
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleBulkReassign = async (staffId: string) => {
        if (!selectedTaskIds.length) return;
        setShowBulkAssignMenu(false);
        try {
            await Promise.all(selectedTaskIds.map(async id => {
                const task = tasks.find(t => t.id === id);


                if (task) {
                    const assignedSet = new Set(task.assignedTo || []);


                    assignedSet.add(staffId);
                    await updateTaskMutation.mutateAsync({ id, updates: { assignedTo: Array.from(assignedSet) } });
                }
            }));
            const staffName = usersList.find(u => u.uid === staffId)?.displayName || 'Staff';


            toast.success(`${selectedTaskIds.length} tasks reassigned to ${staffName}`);
            setSelectedTaskIds([]);
        } catch (error) {
            toast.error('Failed to reassign tasks');
        }
    };

    const handleBulkExport = () => {
        if (!selectedTaskIds.length) return;
        const tasksToExport = tasks.filter(t => selectedTaskIds.includes(t.id));


        handleExportExcel(tasksToExport);
        setSelectedTaskIds([]);
    };

    const handleAddComment = (comment: TaskComment) => {
        if (currentTask.id) {
            addCommentMutation.mutate({ taskId: currentTask.id, comment });

            // Optimistic UI update so it appears instantly
            setCurrentTask(prev => ({
                ...prev,
                comments: [...(prev.comments || []), comment]
            }));

            // Notify mentioned users via email
            if (comment.mentions && comment.mentions.length > 0) {
                const mentionedUsers = usersList.filter(u => comment.mentions!.includes(u.uid) && u.email);
                if (mentionedUsers.length > 0) {
                    const emails = mentionedUsers.map(u => u.email);
                    const taskTitle = currentTask.title || 'a task';
                    const htmlContent = `
                        <div style="font-family: system-ui, -apple-system, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #0f172a; margin-top: 0;">You were mentioned in a task</h2>
                            <p style="font-size: 15px; line-height: 1.5;"><strong>${user?.displayName || 'Someone'}</strong> mentioned you in a comment on task: <strong>${taskTitle}</strong>.</p>
                            <div style="padding: 16px; border-left: 4px solid #f59e0b; background-color: #f8fafc; border-radius: 0 8px 8px 0; margin: 24px 0; font-size: 15px; color: #334155; white-space: pre-wrap;">${comment.text}</div>
                            <p style="font-size: 14px; color: #64748b;">Please log in to the RSA System to view the task details and reply.</p>
                        </div>
                    `;

                    fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: emails,
                            subject: `Mentioned in ${taskTitle}`,
                            html: htmlContent,
                            fromName: 'RSA System Notifications'
                        })
                    }).catch(err => console.error('Failed to send mention email:', err));
                }
            }
        }
    };

    const handleAddSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const newSubtask: SubTask = {
            id: Math.random().toString(36).substring(2, 9),
            title: newSubtaskTitle.trim(),
            isCompleted: false,
            createdAt: new Date().toISOString(),
            createdBy: user?.uid || 'unknown'
        };
        setCurrentTask(prev => ({
            ...prev,
            subtasks: [...(prev.subtasks || []), newSubtask]
        }));
        setNewSubtaskTitle('');
    };

    const handleRemoveSubtask = (id: string) => {
        setCurrentTask(prev => ({
            ...prev,
            subtasks: (prev.subtasks || []).filter(st => st.id !== id)
        }));
    };

    const handleExportPDF = () => {
        const dateStr = new Date().toISOString().split('T')[0];


        const doc = new jsPDF();



        // Header Banner
        doc.setFillColor(15, 23, 42); // Navy-900 like
        doc.rect(0, 0, 210, 48, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('R. Sapkota & Associates', 105, 14, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        doc.text('Chartered Accountants  |  Kathmandu, Nepal', 105, 22, { align: 'center' });
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Tasks & Workflow Report', 105, 32, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 200, 230);
        doc.text(`Generated: ${new Date().toLocaleString()} `, 105, 40, { align: 'center' });

        const rows = filteredTasks.map(t => [
            t.clientName || 'Internal',
            t.title,
            t.status.replace('_', ' '),
            t.priority,
            t.dueDate,
            t.assignedTo?.map(id => usersList.find(u => u.uid === id)?.displayName).filter(Boolean).join(', ') || 'Unassigned'
        ]);

        const getStatusColor = (status: string): [number, number, number] => {
            if (status.includes('COMPLETED')) return [220, 252, 231];
            if (status.includes('IN_PROGRESS')) return [219, 234, 254];
            if (status.includes('UNDER_REVIEW')) return [254, 243, 199];
            if (status.includes('HALTED')) return [254, 226, 226];
            return [245, 245, 250];
        };

        autoTable(doc, {
            head: [['Client', 'Task', 'Status', 'Priority', 'Due Date', 'Assigned To']],
            body: rows,
            startY: 60,
            styles: { fontSize: 7.5, cellPadding: 3, lineColor: [220, 225, 235], lineWidth: 0.2 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            columnStyles: { 1: { cellWidth: 50 } },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 2) {
                    const status = data.cell.raw as string;


                    data.cell.styles.fillColor = getStatusColor(status);
                    data.cell.styles.textColor = [30, 41, 59];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150, 160, 175);
            doc.text('R. Sapkota & Associates â€” Confidential', 14, doc.internal.pageSize.height - 8);
            doc.text(`Page ${i} of ${pageCount} `, 196, doc.internal.pageSize.height - 8, { align: 'right' });
        }

        doc.save(`RSA_Tasks_${dateStr}.pdf`);
        toast.success('Exported PDF successfully');
    };

    const handleExportExcel = async (tasksToRun: Task[] = filteredTasks) => {
        const dateStr = new Date().toISOString().split('T')[0];


        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'R. Sapkota & Associates';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Tasks Report', {


            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
        });

        // Company Header Block
        sheet.mergeCells('A1:F1');
        const titleCell = sheet.getCell('A1');


        titleCell.value = 'R. Sapkota & Associates';
        titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        sheet.getRow(1).height = 32;

        sheet.mergeCells('A2:F2');
        const addrCell = sheet.getCell('A2');


        addrCell.value = 'Chartered Accountants  |  Kathmandu, Nepal';
        addrCell.font = { name: 'Calibri', size: 10, color: { argb: 'FFB4C8E6' } };
        addrCell.alignment = { horizontal: 'center', vertical: 'middle' };
        addrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        sheet.getRow(2).height = 18;

        sheet.mergeCells('A3:F3');
        const reportTitleCell = sheet.getCell('A3');
        reportTitleCell.value = 'Tasks & Workflow Report';
        reportTitleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E293B' } };
        reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        reportTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        sheet.getRow(3).height = 22;

        sheet.mergeCells('A4:F4');
        const periodCell = sheet.getCell('A4');
        periodCell.value = `Generated: ${new Date().toLocaleString()} `;
        periodCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
        periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
        periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        sheet.getRow(4).height = 16;
        sheet.getRow(5).height = 6;

        const COLS = [


            { header: 'Client', key: 'client', width: 25 },
            { header: 'Task Title', key: 'title', width: 45 },
            { header: 'Status', key: 'status', width: 18 },
            { header: 'Priority', key: 'priority', width: 12 },
            { header: 'Due Date', key: 'dueDate', width: 15 },
            { header: 'Assigned To', key: 'assignedTo', width: 30 },
        ];
        sheet.columns = COLS;

        const headerRow = sheet.getRow(6);
        COLS.forEach((col, i) => {
            const cell = headerRow.getCell(i + 1);


            cell.value = col.header;
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } };
        });
        headerRow.height = 22;

        const statusFill: Record<string, string> = {


            'COMPLETED': 'FFD1FAE5',
            'IN_PROGRESS': 'FFDBEAFE',
            'NOT_STARTED': 'FFF3F4F6',
            'UNDER_REVIEW': 'FFFEF3C7',
            'HALTED': 'FFFEE2E2',
        };

        tasksToRun.forEach((t, idx) => {
            const assignees = t.assignedTo?.map(id => usersList.find(u => u.uid === id)?.displayName).filter(Boolean).join(', ') || 'Unassigned';


            const row = sheet.addRow({
                client: t.clientName || 'Internal',
                title: t.title,
                status: t.status.replace('_', ' '),
                priority: t.priority,
                dueDate: t.dueDate,
                assignedTo: assignees,
            });

            const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
            const statusBg = statusFill[t.status] || rowBg;



            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                cell.font = { name: 'Calibri', size: 9 };
                cell.alignment = { vertical: 'top', wrapText: true };
                cell.fill = {
                    type: 'pattern', pattern: 'solid',
                    fgColor: { argb: colNum === 3 ? statusBg : rowBg }
                };
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
            });
            const statusCell = row.getCell(3);


            statusCell.font = { name: 'Calibri', size: 9, bold: true };
            statusCell.alignment = { horizontal: 'center', vertical: 'top' };

            const clientCell = row.getCell(1);


            clientCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F4C75' } };

            row.height = 22;
        });

        sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 6 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');


        a.href = url;
        a.download = `RSA_Tasks_${dateStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exported Excel successfully');
    };

    const handleClientChange = (clientId: string) => {
        const client = clientsList.find(c => c.id === clientId);


        if (client) {
            setCurrentTask(prev => ({ ...prev, clientIds: [clientId], clientName: client.name }));
        }
    };

    const handleComplianceDecision = (taskId: string, decision: 'REVIEW' | 'PROCEED', task: Task, templatesList: TaskTemplate[]) => {
        const finalStatus = decision === 'REVIEW' ? TaskStatus.UNDER_REVIEW : TaskStatus.COMPLETED;
        const updates: any = { status: finalStatus };

        // Handle auto-injection logic identical to normal drag updates
        const statusInjected = injectStatusSubtasks(task, finalStatus, templatesList);
        if (statusInjected) {
            updates.subtasks = [...(task.subtasks || []), ...statusInjected];
            
            const template = templatesList.find(t => t.id === task.templateId) || 
                             templatesList.find(t => t.taskType === task.taskType && t.statusSubtasks?.[finalStatus]);
            if (template && !task.templateId) {
                updates.templateId = template.id;
            }
            showInjectionToast(taskId, task.subtasks || [], statusInjected.length, finalStatus.replace(/_/g, ' '));
        }

        updateTaskMutation.mutate({ id: taskId, updates });
        if (finalStatus === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
            triggerNextTemplateIfNeeded(taskId, TaskStatus.COMPLETED);
        }
    };

    const onDragEnd = (result: DropResult) => {
        const { destination, draggableId } = result;
        if (!destination) return;

        const task = tasks.find(t => t.id === draggableId);


        if (!task || !canUpdateTaskStatus(task)) {
            toast.error('You do not have permission to move this task');
            return;
        }
        // Composite droppable IDs: "PHASE::STATUS"
        const parts = destination.droppableId.split('::');
        if (parts.length === 2) {
            let [newPhase, newStatus] = parts as [AuditPhase, TaskStatus];
            
            // --- WORKFLOW GOVERNANCE: LOCKDOWN & FORWARD-ONLY RULES ---
            const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
            const isManager = user?.role === UserRole.MANAGER;
            
            // A. Lockdown Rule: Final phase + Completed status can only be moved by Admin
            if (task.status === TaskStatus.COMPLETED && 
                task.auditPhase === AuditPhase.REVIEW_AND_CONCLUSION) {
                if (!isAdmin) {
                    toast.error('Governance Lockdown: Only Admins can reopen a fully completed assignment in the final phase.', { icon: '🔒' });
                    return;
                }
            }

            // B. Directional Governance: Logic here can be added if specific phase-lock is needed, 
            // but for now we follow the form's flexibility as requested.

            if (newPhase === AuditPhase.ONBOARDING && newStatus === TaskStatus.UNDER_REVIEW) {
                newStatus = TaskStatus.IN_PROGRESS;
            }

            const updates: any = {};
            if (task.auditPhase !== newPhase) {

                // ── Compliance Gate: Check for Mandatory Evidence before allowing Phase change ──
                const currentOrder = PHASE_ORDER[task.auditPhase as AuditPhase || AuditPhase.ONBOARDING];
                const nextOrder = PHASE_ORDER[newPhase as AuditPhase];
                
                if (nextOrder > currentOrder) {
                    const missingEvidence = (task.subtasks || []).filter(s => 
                        s.phase === task.auditPhase && 
                        s.isEvidenceMandatory && 
                        !s.evidenceProvided
                    );
                    
                    if (missingEvidence.length > 0) {
                        toast.error(`Compliance Gate: Mandatory evidence missing for ${missingEvidence.length} item(s). Transition to ${PHASE_LABELS[newPhase as AuditPhase]} blocked.`, { icon: '🛑' });
                        return; // Block the drag update
                    }
                }

                updates.auditPhase = newPhase;
                
                // Prompt C: Handle Phase Transition Auto-Swap Checklist
                if (task.taskType) {
                    const oldSubtasks = task.subtasks || [];
                    const updatedSubtasks = swapPhaseChecklist(task, newPhase as AuditPhase);
                    
                    if (updatedSubtasks.length !== oldSubtasks.length) {
                        updates.subtasks = updatedSubtasks;
                        // Prompt C Step 4 summary toast
                        const added = updatedSubtasks.filter(s => s.isAutoGenerated && s.phase === newPhase).length;
                        const removed = oldSubtasks.filter(s => s.isAutoGenerated && s.phase === task.auditPhase).length;
                        
                        toast.success(
                            (t) => (
                                <div className="flex flex-col gap-1">
                                    <span className="font-bold">Phase checklist updated</span>
                                    <span className="text-[10px] text-gray-400">
                                        {removed} items replaced with {added} items for {newPhase.replace(/_/g, ' ')}
                                    </span>
                                    <button 
                                        onClick={() => {
                                            updateTaskMutation.mutate({ id: draggableId, updates: { auditPhase: task.auditPhase, subtasks: oldSubtasks } });
                                            toast.dismiss(t.id);
                                        }}
                                        className="mt-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[9px] font-bold transition-all"
                                    >
                                        Undo
                                    </button>
                                </div>
                            ),
                            { duration: 6000 }
                        );
                    }
                } else {
                    // Fallback to legacy injection if no taskType
                    const injected = injectPhaseSubtasks(task, newPhase as AuditPhase, templates);
                    if (injected) {
                        updates.subtasks = [...(task.subtasks || []), ...injected];
                        const currentSubtasks = task.subtasks || [];
                        showInjectionToast(task.id, currentSubtasks, injected.length, newPhase.replace(/_/g, ' '));
                    }
                }
            }
            if (task.status !== newStatus) {
                // ── Compliance Gate: Interactive Decision Modal ──
                if (newStatus === TaskStatus.COMPLETED) {
                    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
                    const isTL = user?.uid === task.teamLeaderId;
                    const signOffsComplete = task.teamLeadApprovedAt && task.engagementReviewerApprovedAt && task.signingPartnerApprovedAt;
                    
                    if (!signOffsComplete) {
                        setConfirmModal({
                            open: true,
                            title: 'Compliance Gate Blocked',
                            message: 'All 3 sign-offs (TL, Reviewer, Partner) are required to complete this assignment. Would you like to ask for an Engagement Review?',
                            variant: 'indigo',
                            cancelLabel: 'Keep as is',
                            secondaryLabel: 'Move to Review',
                            onSecondaryConfirm: () => handleComplianceDecision(draggableId, 'REVIEW', task, templates),
                            showConfirm: isAdmin || isTL,
                            confirmLabel: 'Force Complete',
                            onConfirm: () => handleComplianceDecision(draggableId, 'PROCEED', task, templates)
                        });
                        return; // Block the update
                    }
                }

                updates.status = newStatus;
                
                // PROMPT 4: Inject status subtasks on drag
                const statusInjected = injectStatusSubtasks(task, newStatus as TaskStatus, templates);
                if (statusInjected) {
                    // Note: If both phase and status changed, we need to merge both
                    const existingSubtasksAndPhase = updates.subtasks || task.subtasks || [];
                    updates.subtasks = [...existingSubtasksAndPhase, ...statusInjected];
                    
                    // Logic to find and persist the templateId if it's being used for this injection
                    const template = templates.find(t => t.id === task.templateId) || 
                                     templates.find(t => t.taskType === task.taskType && t.statusSubtasks?.[newStatus as TaskStatus]);
                    if (template && !task.templateId) {
                        updates.templateId = template.id;
                    }
                    
                    showInjectionToast(task.id, task.subtasks || [], statusInjected.length, newStatus.replace(/_/g, ' '));
                }
            }
            if (Object.keys(updates).length > 0) {
                updateTaskMutation.mutate({ id: draggableId, updates });
                if (newStatus === TaskStatus.COMPLETED && task.status !== TaskStatus.COMPLETED) {
                    triggerNextTemplateIfNeeded(draggableId, TaskStatus.COMPLETED);
                }
            }
        }
    };

    const handleTemplateSelect = (template: any) => {
        const generatedSubtasks: SubTask[] = [];
        const templateSubtasks = template.subtaskDetails || template.subtasks?.map((t: string) => ({ title: t })) || [];
        const assignedSet = new Set<string>();

        templateSubtasks.forEach((s: any) => {
            if (s.phase && s.phase !== AuditPhase.ONBOARDING) return;
            let assignedUserId = undefined;
            if (s.assigneeRole) {
                const matchedUser = usersList.find(u => u.role === s.assigneeRole);
                if (matchedUser) {
                    assignedUserId = matchedUser.uid;
                    assignedSet.add(matchedUser.uid);
                }
            }
            generatedSubtasks.push({
                id: Math.random().toString(36).substr(2, 9),
                title: s.title,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                createdBy: user?.uid || 'unknown',
                assignedTo: assignedUserId
            });
        });

        let dueDate = getCurrentDateUTC();
        if (template.expectedDays) {
           const d = new Date();
           d.setDate(d.getDate() + template.expectedDays);
           dueDate = d.toISOString().split('T')[0];
        }

        setCurrentTask({
            title: template.name,
            description: template.description,
            priority: template.priority,
            status: TaskStatus.NOT_STARTED,
            subtasks: generatedSubtasks,
            dueDate: dueDate,
            totalTimeSpent: 0,
            nextTemplateId: template.nextTemplateId || '',
            templateId: template.id,
            auditPhase: AuditPhase.ONBOARDING,
            assignedTo: Array.from(assignedSet)
        });
        setIsTemplateModalOpen(false);
        setIsModalOpen(true);
    };

    const userTasksCount = useMemo(() => {
        const counts: Record<string, number> = {};
        tasks.forEach(t => {
            if (t.status !== TaskStatus.COMPLETED && t.assignedTo) {
                t.assignedTo.forEach(uid => {
                    counts[uid] = (counts[uid] || 0) + 1;
                });
            }
        });
        return counts;
    }, [tasks]);

    const statusStats = useMemo(() => {


        const stats = {


            TOTAL: filteredTasks.length,
            HALTED: filteredTasks.filter(t => t.status === TaskStatus.HALTED).length,
            NOT_STARTED: filteredTasks.filter(t => t.status === TaskStatus.NOT_STARTED).length,
            IN_PROGRESS: filteredTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
            UNDER_REVIEW: filteredTasks.filter(t => t.status === TaskStatus.UNDER_REVIEW).length,
            COMPLETED: filteredTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        };
        return stats;
    }, [filteredTasks]);

    // Count active (non-default) filters for the filter badge
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filterStatus !== 'ALL') count++;
        if (filterPriority !== 'ALL') count++;
        if (filterStaff !== 'ALL') count++;
        if (filterClient !== 'ALL') count++;
        if (filterAuditor !== 'ALL') count++;
        if (filterTaskType && filterTaskType !== 'ALL') count++;
        if (dateRange.start) count++;
        if (dateRange.end) count++;
        if (searchTerm) count++;
        return count;
    }, [filterStatus, filterPriority, filterStaff, filterClient, filterAuditor, filterTaskType, dateRange, searchTerm]);

    if (loading) return (
        <div className="flex flex-col h-full bg-transparent p-8 space-y-6 animate-pulse">
            <div className="h-12 bg-white/[0.03] rounded-xl border border-white/[0.04]" />
            <div className="flex-1 bg-white/[0.03] rounded-xl border border-white/[0.04]" />
        </div>
    );

    return (
        <div className="relative h-full w-full flex flex-col overflow-hidden bg-surface">
            {/* --- REFINED UNIFIED TOOLBAR --- */}
            <header className="flex-none bg-surface backdrop-blur-xl border-b border-border relative z-30 transition-colors duration-300">
                <div className="flex flex-col border-b border-border/50">
                    <div className="flex items-center gap-3 px-4 py-3">
                        {/* LEFT: View Mode Toggle */}
                        <div
                            className="flex-shrink-0 inline-flex"
                            style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '3px', border: '1px solid var(--border)' }}
                        >
                            {([
                                { id: 'LIST', label: 'List', Icon: ListIcon, desktopOnly: false },
                                { id: 'KANBAN', label: 'Board', Icon: LayoutGrid, desktopOnly: true },
                                { id: 'TIMELINE', label: 'Timeline', Icon: GanttChartSquare, desktopOnly: true },
                            ] as const).map(({ id, label, Icon, desktopOnly }) => {
                                if (desktopOnly && isMobile) return null;
                                const isActive = viewMode === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => setViewMode(id as any)}
                                        className="flex items-center gap-1.5 transition-all"
                                        style={{
                                            height: '30px',
                                            padding: '0 0.75rem',
                                            fontSize: '0.8125rem',
                                            fontWeight: isActive ? 600 : 400,
                                            borderRadius: 'var(--radius-sm)',
                                            color: isActive ? 'var(--text-heading)' : 'var(--text-muted)',
                                            background: isActive ? 'var(--bg-secondary)' : 'transparent',
                                            boxShadow: isActive ? 'var(--shadow-card)' : 'none',
                                        }}
                                    >
                                        <Icon size={13} />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* CENTER: Search & Workflow Dropdown */}
                        <div className="flex items-center gap-2 flex-1 max-w-xl">
                            {/* NEW: Workflow Selector Dropdown */}
                            <div className="relative" ref={workflowMenuRef}>
                                <button
                                    onClick={() => setShowWorkflowMenu(!showWorkflowMenu)}
                                    className={`h-[38px] px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                                        filterTaskType !== 'ALL'
                                            ? 'bg-accent/10 border-accent/40 text-accent'
                                            : 'bg-secondary border-border text-muted hover:text-heading hover:border-border-mid'
                                    }`}
                                >
                                    <Layers size={13} className={filterTaskType !== 'ALL' ? 'text-accent' : 'text-muted'} />
                                    <span className="max-w-[120px] truncate">
                                        {filterTaskType === 'ALL' ? 'Workflows' : filterTaskType.replace(/_/g, ' ')}
                                    </span>
                                    <ChevronDown size={11} className={`transition-transform duration-300 ${showWorkflowMenu ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {showWorkflowMenu && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 8 }}
                                                    className="absolute top-full left-0 mt-2 w-64 border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden backdrop-blur-xl"
                                                    style={{ background: 'var(--bg-secondary)' }}
                                                >
                                            <div className="p-2 space-y-0.5">
                                                <button
                                                    onClick={() => { setFilterTaskType('ALL'); setShowWorkflowMenu(false); }}
                                                    className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-bold text-left transition-all flex items-center justify-between ${filterTaskType === 'ALL' ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface hover:text-heading'}`}
                                                >
                                                    All Workflows
                                                    {filterTaskType === 'ALL' && <Check size={12} />}
                                                </button>
                                                <div className="h-px bg-border my-1 mx-2" />
                                                {Object.values(TaskType).filter(t => t !== TaskType.OTHER).map((type, idx) => {
                                                    const isSelected = filterTaskType === type;
                                                    const count = tasks.filter(t => t.taskType === type).length;
                                                    return (
                                                        <button
                                                            key={type || `type-${idx}`}
                                                            onClick={() => { setFilterTaskType(type); setShowWorkflowMenu(false); }}
                                                            className={`w-full px-4 py-2.5 rounded-xl text-[11px] font-bold text-left transition-all flex items-center justify-between ${isSelected ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface hover:text-heading'}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-accent' : 'bg-border-mid'}`} />
                                                                {type.replace(/_/g, ' ')}
                                                            </div>
                                                            {count > 0 && <span className="text-[9px] opacity-40">{count}</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="relative flex-1 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={13} />
                                <input
                                    type="text"
                                    placeholder="Search assignments, clients, or IDs..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-[38px] bg-secondary border border-border hover:border-accent/30 rounded-xl pl-9 pr-3 text-[11px] text-heading placeholder:text-muted focus:outline-none focus:border-accent/50 focus:bg-surface transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Bulk Actions — contextual bar */}
                        {selectedTaskIds.length > 0 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center gap-2 flex-shrink-0 bg-accent/10 border border-accent/30 rounded-xl px-2 py-1 shadow-accent-glow"
                            >
                                <span className="text-[10px] font-black text-accent tabular-nums px-2 py-0.5 bg-accent/20 rounded-lg">{selectedTaskIds.length} Selective</span>
                                <div className="w-px h-4 bg-accent/20" />
                                <div className="relative" ref={statusMenuRef}>
                                    <button
                                        onClick={() => setShowBulkStatusMenu(!showBulkStatusMenu)}
                                        className="h-[28px] px-2.5 hover:bg-white/5 text-indigo-300 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all"
                                    >
                                        Status <ChevronDown size={10} className={`transition-transform duration-200 ${showBulkStatusMenu ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {showBulkStatusMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 8 }}
                                                className="absolute top-full left-0 mt-2 w-44 bg-secondary border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden py-1.5 backdrop-blur-xl"
                                            >
                                                {[TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED].map((status) => (
                                                    <button
                                                        key={status}
                                                        onClick={() => { handleBulkStatusChange(status as TaskStatus); setShowBulkStatusMenu(false); }}
                                                        className="w-full px-4 py-2 text-left text-[11px] font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-between group"
                                                    >
                                                        {status.replace(/_/g, ' ')}
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40 group-hover:bg-indigo-400" />
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="relative" ref={assignMenuRef}>
                                    <button
                                        onClick={() => setShowBulkAssignMenu(!showBulkAssignMenu)}
                                        className="h-[28px] px-2.5 hover:bg-white/5 text-cyan-400 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all"
                                    >
                                        Assign <ChevronDown size={10} className={`transition-transform duration-200 ${showBulkAssignMenu ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {showBulkAssignMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 8 }}
                                                className="absolute top-full left-0 mt-2 w-52 bg-secondary border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden backdrop-blur-xl"
                                            >
                                                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02]">
                                                    <p className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest text-center">Assign to Team</p>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                                                    {usersList.map((st, idx) => (
                                                        <button
                                                            key={st.uid || `staff-${idx}`}
                                                            onClick={() => { handleBulkReassign(st.uid); setShowBulkAssignMenu(false); }}
                                                            className="w-full px-3 py-2 text-left text-[11px] font-semibold text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-white transition-colors rounded-xl flex items-center gap-2.5"
                                                        >
                                                            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-[9px] font-black text-indigo-400 border border-indigo-500/20">
                                                                {getInitials(st.displayName)}
                                                            </div>
                                                            <span className="truncate">{st.displayName}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="w-px h-4 bg-indigo-500/20" />
                                <button
                                    onClick={handleBulkDelete}
                                    title="Delete selected tasks"
                                    className="w-[28px] h-[28px] flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                                >
                                    <Trash2 size={13} />
                                </button>
                                <button
                                    onClick={() => setSelectedTaskIds([])}
                                    title="Clear selection"
                                    className="w-[28px] h-[28px] flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </motion.div>
                        )}

                        {/* RIGHT ACTIONS */}
                        <div className="flex items-center gap-2 ml-auto">
                            {/* Templates */}
                            <button
                                onClick={() => setIsTemplateModalOpen(true)}
                                disabled={!canCreateTask}
                                className="h-[38px] px-4 bg-secondary border border-border rounded-xl flex items-center gap-2 text-[10px] font-black tracking-widest text-muted hover:text-heading transition-all disabled:opacity-50"
                            >
                                <Sparkles size={13} className="text-accent" />
                                <span className={isMobile ? 'sr-only' : ''}>PRESETS</span>
                            </button>

                            {/* Export Group */}
                            <div className="flex items-center gap-1 bg-secondary border border-border p-1 rounded-xl h-[38px]">
                                <button onClick={handleExportPDF} title="Export PDF" className="w-[30px] h-full flex items-center justify-center hover:bg-status-halted/10 text-status-halted rounded-lg transition-all"><FileText size={14} /></button>
                                <button onClick={() => handleExportExcel()} title="Export Excel" className="w-[30px] h-full flex items-center justify-center hover:bg-status-completed/10 text-status-completed rounded-lg transition-all"><FileSpreadsheet size={14} /></button>
                            </div>

                            {/* Filters Button */}
                            <button
                                onClick={() => setShowFilterPanel(!showFilterPanel)}
                                className={`h-[38px] px-4 flex items-center gap-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                    showFilterPanel || activeFilterCount > 0
                                        ? 'bg-accent/15 border-accent/40 text-accent shadow-accent-glow'
                                        : 'bg-secondary border-border text-muted hover:text-heading'
                                }`}
                            >
                                <Filter size={13} className={activeFilterCount > 0 ? 'animate-pulse' : ''} />
                                <span>Refine</span>
                                {activeFilterCount > 0 && (
                                    <div className="w-4 h-4 rounded-full bg-accent text-white text-[9px] font-black flex items-center justify-center ml-1">
                                        {activeFilterCount}
                                    </div>
                                )}
                            </button>

                            <button
                                onClick={handleOpenCreate}
                                disabled={!canCreateTask}
                                className="h-[38px] px-5 bg-accent hover:bg-accent-light text-white rounded-xl text-[10px] font-black uppercase tracking-[0.14em] flex items-center gap-2 transition-all shadow-accent-glow disabled:opacity-50 active:scale-95"
                            >
                                <Plus size={16} strokeWidth={3} />
                                <span className={isMobile ? 'sr-only' : ''}>Create New</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
                <div className="px-6 py-2 border-b border-border bg-surface/50 flex flex-wrap items-center gap-2 z-20 shadow-sm relative">
                    <span className="text-[10px] font-black text-muted uppercase tracking-widest mr-1 flex items-center gap-1.5"><Filter size={11} /> Filters applied:</span>
                    {filterStatus !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent shadow-sm">
                            Status: {filterStatus.replace(/_/g, ' ')}
                            <button onClick={() => setFilterStatus('ALL')} className="hover:text-rose-400 group"><X size={11} className="transition-transform group-hover:scale-110"/></button>
                        </div>
                    )}
                    {filterPriority !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent shadow-sm">
                            Priority: {filterPriority}
                            <button onClick={() => setFilterPriority('ALL')} className="hover:text-rose-400 group"><X size={11} className="transition-transform group-hover:scale-110"/></button>
                        </div>
                    )}
                    {filterTaskType && filterTaskType !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent shadow-sm">
                            Workflow: {filterTaskType.replace(/_/g, ' ')}
                            <button onClick={() => setFilterTaskType('ALL')} className="hover:text-rose-400 group"><X size={11} className="transition-transform group-hover:scale-110"/></button>
                        </div>
                    )}
                    {filterClient !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent shadow-sm">
                            Client: {clientsList.find(c => c.id === filterClient)?.name || 'Unknown'}
                            <button onClick={() => setFilterClient('ALL')} className="hover:text-rose-400 group"><X size={11} className="transition-transform group-hover:scale-110"/></button>
                        </div>
                    )}
                    {filterStaff !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent shadow-sm">
                            Staff: {usersList.find(u => u.uid === filterStaff)?.displayName?.split(' ')[0] || 'Unknown'}
                            <button onClick={() => setFilterStaff('ALL')} className="hover:text-rose-400 group"><X size={11} className="transition-transform group-hover:scale-110"/></button>
                        </div>
                    )}
                    {filterAuditor !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent shadow-sm">
                            Reviewer: {usersList.find(u => u.uid === filterAuditor)?.displayName?.split(' ')[0] || 'Unknown'}
                            <button onClick={() => setFilterAuditor('ALL')} className="hover:text-rose-400 group"><X size={11} className="transition-transform group-hover:scale-110"/></button>
                        </div>
                    )}
                    {searchTerm && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-[11px] font-bold text-accent shadow-sm">
                            Search: "{searchTerm}"
                            <button onClick={() => setSearchTerm('')} className="hover:text-rose-400 group"><X size={11} className="transition-transform group-hover:scale-110"/></button>
                        </div>
                    )}
                    <button onClick={() => {
                        setFilterStatus('ALL'); setFilterPriority('ALL'); setFilterTaskType('ALL'); setFilterClient('ALL'); setFilterStaff('ALL'); setFilterAuditor('ALL'); setSearchTerm(''); setDateRange({start:'', end:''});
                    }} className="text-[10px] text-muted hover:text-white underline ml-2 transition-colors uppercase font-black">Clear All</button>
                </div>
            )}


            {/* Filter Popover Panel — slides down when Filters button is clicked */}
            <AnimatePresence>
                {showFilterPanel && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
                        exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                        transition={{ duration: 0.15 }}
                        className="border-t border-white/[0.04] bg-[#09090b]/50 backdrop-blur-md"
                    >
                        <div className="px-4 py-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 w-full">
                                <div className="relative">
                                    <select
                                        value={filterStaff}
                                        onChange={(e) => setFilterStaff(e.target.value)}
                                        className="appearance-none w-full h-auto py-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-lg text-[10px] font-bold text-gray-300 pl-2.5 pr-6 focus:outline-none cursor-pointer transition-all"
                                    >
                                        <option value="ALL">Staff: All</option>
                                        {usersList.map((u, idx) => <option key={u.uid || `staff-${idx}`} value={u.uid}>{u.displayName}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={10} />
                                </div>
                                <div className="relative">
                                    <select
                                        value={filterPriority}
                                        onChange={(e) => setFilterPriority(e.target.value)}
                                        className="appearance-none w-full h-auto py-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-lg text-[10px] font-bold text-gray-300 pl-2.5 pr-6 focus:outline-none cursor-pointer transition-all"
                                    >
                                        <option value="ALL">Priority: All</option>
                                        {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={10} />
                                </div>
                                <div className="relative">
                                    <select
                                        value={filterAuditor}
                                        onChange={(e) => setFilterAuditor(e.target.value)}
                                        className="appearance-none w-full h-auto py-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-lg text-[10px] font-bold text-gray-300 pl-2.5 pr-6 focus:outline-none cursor-pointer transition-all"
                                    >
                                        <option value="ALL">Auditor: All</option>
                                        {SIGNING_AUTHORITIES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={10} />
                                </div>
                                <div className="relative">
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="appearance-none w-full h-auto py-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-lg text-[10px] font-bold text-gray-300 pl-2.5 pr-6 focus:outline-none cursor-pointer transition-all"
                                    >
                                        <option value="ALL">Status: All</option>
                                        {[TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={10} />
                                </div>
                            </div>

                            {/* Status Stats Strip (for LIST view only) */}
                            {viewMode === 'LIST' && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-white/[0.04]">
                                    {([
                                        { key: 'ALL', label: 'All', count: statusStats.TOTAL, activeColor: 'bg-slate-500/20 border-slate-400/30 text-white', inactiveColor: 'bg-white/[0.02] border-white/[0.06] text-slate-400', dot: 'bg-slate-400', dotGlow: '' },
                                        { key: 'NOT_STARTED', label: 'Not Started', count: statusStats.NOT_STARTED, activeColor: 'bg-slate-500/20 border-slate-400/30 text-white', inactiveColor: 'bg-white/[0.02] border-white/[0.06] text-slate-400', dot: 'bg-slate-400', dotGlow: '' },
                                        { key: 'IN_PROGRESS', label: 'In Progress', count: statusStats.IN_PROGRESS, activeColor: 'bg-blue-500/15 border-blue-400/30 text-blue-300', inactiveColor: 'bg-white/[0.02] border-white/[0.06] text-slate-400', dot: 'bg-blue-400', dotGlow: 'shadow-[0_0_6px_rgba(96,165,250,0.4)]' },
                                        { key: 'UNDER_REVIEW', label: 'Review', count: statusStats.UNDER_REVIEW, activeColor: 'bg-amber-500/15 border-amber-400/30 text-amber-300', inactiveColor: 'bg-white/[0.02] border-white/[0.06] text-slate-400', dot: 'bg-amber-400', dotGlow: 'shadow-[0_0_6px_rgba(251,191,36,0.4)]' },
                                        { key: 'HALTED', label: 'Halted', count: statusStats.HALTED, activeColor: 'bg-rose-500/15 border-rose-400/30 text-rose-300', inactiveColor: 'bg-white/[0.02] border-white/[0.06] text-slate-400', dot: 'bg-rose-400', dotGlow: 'shadow-[0_0_6px_rgba(251,113,133,0.4)]' },
                                        { key: 'COMPLETED', label: 'Done', count: statusStats.COMPLETED, activeColor: 'bg-brand-500/15 border-brand-400/30 text-brand-300', inactiveColor: 'bg-white/[0.02] border-white/[0.06] text-slate-400', dot: 'bg-brand-400', dotGlow: 'shadow-[0_0_6_rgba(52,211,153,0.4)]' },
                                    ] as const).map(({ key, label, count, activeColor, inactiveColor, dot, dotGlow }) => {
                                        const isActive = filterStatus === key;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setFilterStatus(key)}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-semibold transition-all ${isActive ? activeColor : inactiveColor + ' hover:bg-white/[0.04] hover:border-white/[0.1]'}`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? dot + ' ' + dotGlow : 'bg-slate-600'}`} />
                                                {label}
                                                <span className={`font-bold tabular-nums ${isActive ? '' : 'text-slate-600'}`}>{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active Filter Pills — slim conditional row */}
            {(searchTerm || filterStatus !== 'ALL' || filterPriority !== 'ALL' || filterStaff !== 'ALL' || filterClient !== 'ALL' || filterAuditor !== 'ALL' || (dateRange.start || dateRange.end)) && (
                <div className="flex items-center gap-1.5 px-4 py-1.5 border-t border-white/[0.03] overflow-x-auto scrollbar-none">
                    {searchTerm && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-bold text-amber-400 flex-shrink-0">
                            🔍 {searchTerm}
                            <button onClick={() => setSearchTerm('')} className="hover:text-white transition-colors"><X size={10} /></button>
                        </div>
                    )}
                    {filterStatus !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-bold text-amber-400 flex-shrink-0">
                            {filterStatus.replace(/_/g, ' ')}
                            <button onClick={() => setFilterStatus('ALL')} className="hover:text-white transition-colors"><X size={10} /></button>
                        </div>
                    )}
                    {filterPriority !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-[9px] font-bold text-rose-400 flex-shrink-0">
                            {filterPriority}
                            <button onClick={() => setFilterPriority('ALL')} className="hover:text-white transition-colors"><X size={10} /></button>
                        </div>
                    )}
                    {filterStaff !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[9px] font-bold text-cyan-400 flex-shrink-0">
                            {usersList.find(u => u.uid === filterStaff)?.displayName || filterStaff}
                            <button onClick={() => setFilterStaff('ALL')} className="hover:text-white transition-colors"><X size={10} /></button>
                        </div>
                    )}
                    {filterClient !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-bold text-amber-400 flex-shrink-0">
                            {clientsList.find(c => c.id === filterClient)?.name || filterClient}
                            <button onClick={() => setFilterClient('ALL')} className="hover:text-white transition-colors"><X size={10} /></button>
                        </div>
                    )}
                    {filterAuditor !== 'ALL' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-[9px] font-bold text-violet-400 flex-shrink-0">
                            {filterAuditor}
                            <button onClick={() => setFilterAuditor('ALL')} className="hover:text-white transition-colors"><X size={10} /></button>
                        </div>
                    )}
                    {(dateRange.start || dateRange.end) && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-bold text-amber-400 flex-shrink-0">
                            {dateRange.start || '…'} – {dateRange.end || '…'}
                            <button onClick={() => setDateRange({ start: '', end: '' })} className="hover:text-white transition-colors"><X size={10} /></button>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setSearchTerm('');
                            setFilterStatus('ALL');
                            setFilterPriority('ALL');
                            setFilterStaff('ALL');
                            setFilterAuditor('ALL');
                            setDateRange({ start: '', end: '' });
                        }}
                        className="text-[9px] font-bold text-gray-600 hover:text-white transition-colors ml-1 underline underline-offset-2 flex-shrink-0"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* --- WORKSPACE AREA --- */}
            <main className="flex-1 min-h-0 h-full flex flex-col overflow-hidden relative">
                {viewMode === 'TIMELINE' ? (
                    <TaskTimelineView
                        tasks={filteredTasks}
                        usersList={usersList}
                        clientsList={clientsList}
                        handleOpenEdit={handleOpenEdit}
                        groupBy={groupBy}
                    />
                ) : (
                    <>
                        <div className="flex-1 min-h-0 min-w-0">
                            <TaskMainView
                                viewMode={viewMode as 'LIST' | 'KANBAN'}
                                tasks={filteredTasks}
                                onDragEnd={onDragEnd}
                                handleOpenEdit={handleOpenEdit}
                                onOpenClientDetail={handleOpenClientDetail}
                                usersList={usersList}
                                clientsList={clientsList}
                                collapsedColumns={collapsedColumns}
                                toggleColumnCollapse={(status) => setCollapsedColumns(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])}
                                selectedTaskId={selectedTaskId}
                                selectedTaskIds={selectedTaskIds}
                                onToggleSelection={toggleTaskSelection}
                                sentinelRef={sentinelRef}
                                isFetchingNextPage={isFetchingNextPage}
                                onSelectAll={() => {
                                    if (selectedTaskIds.length === filteredTasks.length) {
                                        setSelectedTaskIds([]); // Deselect all
                                    } else {
                                        setSelectedTaskIds(filteredTasks.map(t => t.id)); // Select all filtered
                                    }
                                }}
                                groupBy={groupBy}
                                onUpdateTaskStatus={(taskId, status) => {
                                    updateTaskStatusMutation.mutate({ id: taskId, status });
                                }}
                                onOpenReassign={(taskId) => {
                                    setSelectedTaskIds([taskId]);
                                    setShowBulkAssignMenu(true);
                                }}
                                onQuickAdd={async (status, title) => {
                                    try {
                                        const newTask: any = {
                                            title,
                                            status,
                                            priority: TaskPriority.MEDIUM,
                                            assignedTo: [],
                                            subtasks: [],
                                            dueDate: getCurrentDateUTC(),
                                            clientIds: [],
                                            teamLeaderId: '',
                                            comments: []
                                        };
                                        await createTaskMutation.mutateAsync(newTask);
                                    } catch (error) {
                                        console.error(error);
                                    }
                                }}
                            />
                        </div>
                    </>
                )}
            </main>

            {/* Modals for Create/Edit/Templates */}
            {/* Task Detail Slide-over */}
            <TaskDetailPane
                task={currentTask}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedTaskId(undefined);
                }}
                onSave={handleSaveTask}
                onDelete={handleDeleteTask}
                onChange={(updates) => setCurrentTask({ ...currentTask, ...updates })}
                usersList={usersList}
                clientsList={clientsList}
                templates={templates}
                onInjectPhaseSubtasks={injectPhaseSubtasks}
                onInjectStatusSubtasks={injectStatusSubtasks}
                onSwapPhaseChecklist={swapPhaseChecklist}
                isSaving={isSaving}
                isEditMode={isEditMode}
                canManageTask={canManageTask}
                dateMode={dateMode}
                setDateMode={setDateMode}
                newSubtaskTitle={newSubtaskTitle}
                setNewSubtaskTitle={setNewSubtaskTitle}
                onAddSubtask={handleAddSubtask}
                onAddComment={handleAddComment}
                onOpenClientDetail={handleOpenClientDetail}
                userTasksCount={userTasksCount}
            />

            <ClientDetailModal
                client={selectedClientForDetail}
                isOpen={!!selectedClientForDetail}
                onClose={() => setSelectedClientForDetail(null)}
                complianceEvents={complianceEvents}
                allTasks={tasks}
                allStaff={usersList}
                onOpenTask={handleOpenEdit}
            />


            {
                isTemplateModalOpen && (
                    <TaskTemplateModal
                        isOpen={isTemplateModalOpen}
                        onClose={() => setIsTemplateModalOpen(false)}
                        onSelectTemplate={handleTemplateSelect}
                    />
                )
            }
            {isTemplateManagerOpen && <TemplateManager onClose={() => setIsTemplateManagerOpen(false)} />}

            {/* Confirmation Modal (replaces window.confirm) */}
            <AnimatePresence>
                {confirmModal.open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setConfirmModal(p => ({ ...p, open: false }))}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm mx-4"
                            onClick={e => e.stopPropagation()}
                        >
                             <ConfirmationModal
                                title={confirmModal.title}
                                message={confirmModal.message}
                                variant={confirmModal.variant || 'danger'}
                                confirmLabel={confirmModal.confirmLabel || 'Confirm'}
                                secondaryLabel={confirmModal.secondaryLabel}
                                cancelLabel={confirmModal.cancelLabel || 'Cancel'}
                                onConfirm={() => {
                                    confirmModal.onConfirm?.();
                                    setConfirmModal(p => ({ ...p, open: false }));
                                }}
                                onSecondaryConfirm={() => {
                                    confirmModal.onSecondaryConfirm?.();
                                    setConfirmModal(p => ({ ...p, open: false }));
                                }}
                                onClose={() => {
                                    confirmModal.onCancel?.();
                                    setConfirmModal(p => ({ ...p, open: false }));
                                }}
                                showConfirm={confirmModal.showConfirm}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default TasksPage;
