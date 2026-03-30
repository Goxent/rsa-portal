import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
    LayoutGrid, List as ListIcon, UserCircle2, ChevronDown, Check, Sparkles, Plus, Filter, Search,
    Trash2, X, FileSpreadsheet, FileText, Activity, ArrowRight, GanttChartSquare
} from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskTemplate, TaskComment, AuditPhase } from '../types';
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
import { useMedia } from 'react-use';

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



    const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN' | 'TIMELINE'>(isMobile ? 'LIST' : 'KANBAN');

    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

    // Bulk Actions State
    const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
    const [showBulkAssignMenu, setShowBulkAssignMenu] = useState(false);

    // Confirmation Modal State (replaces window.confirm)
    const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
        open: false, title: '', message: '', onConfirm: () => { }
    });

    // Saved Filters UI State
    const [showSavedFilters, setShowSavedFilters] = useState(false);
    const [savedFilterName, setSavedFilterName] = useState('');
    const savedFiltersRef = useRef<HTMLDivElement>(null);



    // Collapsible Filter Panel
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Dropdown Refs
    const statusMenuRef = useRef<HTMLDivElement>(null);


    const assignMenuRef = useRef<HTMLDivElement>(null);



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

    // Auto-persistence Effects
    useEffect(() => {
        localStorage.setItem('rsa_filter_priority', filterPriority);
        localStorage.setItem('rsa_filter_status', filterStatus);
        localStorage.setItem('rsa_filter_client', filterClient);
        localStorage.setItem('rsa_filter_groupby', groupBy);
        localStorage.setItem('rsa_filter_staff', filterStaff);
        localStorage.setItem('rsa_filter_auditor', filterAuditor);
    }, [filterPriority, filterStatus, filterClient, groupBy, filterStaff, filterAuditor]);

    const filteredTasks = tasks.filter(t => {
        if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
        if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
        if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterStaff !== 'ALL' && !t.assignedTo.includes(filterStaff)) return false;
        if (filterClient !== 'ALL' && !t.clientIds?.includes(filterClient)) return false;

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
        if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN || user.role === UserRole.MANAGER) return true;
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
            auditPhase: AuditPhase.ONBOARDING
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

    const cleanForFirestore = (obj: any): any => {


        if (Array.isArray(obj)) return obj.map(cleanForFirestore);
        if (obj !== null && typeof obj === 'object') {
            return Object.entries(obj).reduce((acc, [key, value]) => {
                if (value !== undefined) acc[key] = cleanForFirestore(value);
                return acc;
            }, {} as any);
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
        const templateSubtasks = nextTemplate.subtaskDetails || nextTemplate.subtasks?.map((t: string) => ({ title: t })) || [];
        const assignedSet = new Set<string>();

        templateSubtasks.forEach((s: any) => {
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
            subtasks: generatedSubtasks,
            dueDate: dueDate,
            totalTimeSpent: 0,
            nextTemplateId: nextTemplate.nextTemplateId || '',
            clientIds: task.clientIds || [],
            clientName: task.clientName || '',
            assignedTo: Array.from(assignedSet),
            teamLeaderId: task.teamLeaderId || user?.uid || '',
            createdBy: user?.uid || 'system',
            createdAt: new Date().toISOString()
        };

        try {
            await createTaskMutation.mutateAsync(newTaskObj as Task);
            toast.success(`Workflow Auto-triggered: ${nextTemplate.name}`);
        } catch (e) {
            console.error("Auto trigger failed", e);
        }
    };

    const handleSaveTask = async (taskData?: any) => {
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
            }

            // Mentions Notification Logic
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
            await Promise.all(selectedTaskIds.map(id => updateTaskMutation.mutateAsync({ id, updates: { status: newStatus } })));
            toast.success(`${selectedTaskIds.length} tasks moved to ${newStatus.replace('_', ' ')}`);
            selectedTaskIds.forEach(id => triggerNextTemplateIfNeeded(id, newStatus));
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
            const [newPhase, newStatus] = parts;
            const updates: any = {};
            if (task.auditPhase !== newPhase) {
                updates.auditPhase = newPhase;
                if (task.templateId) {
                    const template = templates.find(t => t.id === task.templateId);
                    if (template) {
                        const templateSubtasks = template.subtaskDetails || [];
                        const phaseSubtasks = templateSubtasks.filter(s => s.phase === newPhase);
                        if (phaseSubtasks.length > 0) {
                            const newSubtasks: SubTask[] = phaseSubtasks.map(s => {
                                let assignedUserId = undefined;
                                if (s.assigneeRole) {
                                    const matchedUser = usersList.find(u => u.role === s.assigneeRole);
                                    if (matchedUser) assignedUserId = matchedUser.uid;
                                }
                                return {
                                    id: Math.random().toString(36).substr(2, 9),
                                    title: s.title,
                                    isCompleted: false,
                                    createdAt: new Date().toISOString(),
                                    createdBy: user?.uid || 'system',
                                    assignedTo: assignedUserId
                                };
                            });
                            
                            const existingTitles = new Set(task.subtasks?.map(st => st.title) || []);
                            const uniqueNewSubtasks = newSubtasks.filter(st => !existingTitles.has(st.title));
                            
                            if (uniqueNewSubtasks.length > 0) {
                                updates.subtasks = [...(task.subtasks || []), ...uniqueNewSubtasks];
                                toast.success(`Auto-generated ${uniqueNewSubtasks.length} subtask(s) for phase.`);
                            }
                        }
                    }
                }
            }
            if (task.status !== newStatus) updates.status = newStatus;
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
        if (dateRange.start) count++;
        if (dateRange.end) count++;
        if (searchTerm) count++;
        return count;
    }, [filterStatus, filterPriority, filterStaff, filterClient, filterAuditor, dateRange, searchTerm]);

    if (loading) return (
        <div className="flex flex-col h-full bg-transparent p-8 space-y-6 animate-pulse">
            <div className="h-12 bg-white/[0.03] rounded-xl border border-white/[0.04]" />
            <div className="flex-1 bg-white/[0.03] rounded-xl border border-white/[0.04]" />
        </div>
    );

    return (
        <div className="relative h-full w-full flex flex-col overflow-hidden bg-transparent">
            {/* --- COMPACT UNIFIED TOOLBAR --- */}
            <header className="flex-none bg-[#09090b]/95 backdrop-blur-xl border-b border-white/[0.04] relative z-20">
                {/* Single row toolbar */}
                <div className="flex items-center gap-2 px-4 py-2">
                    {/* LEFT: View Mode Toggle */}
                    <div className="flex bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06] h-[30px] flex-shrink-0">
                        <button
                            onClick={() => setViewMode('LIST')}
                            className={`px-2.5 flex items-center gap-1.5 text-[10px] font-bold rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <ListIcon size={11} /> List
                        </button>
                        {!isMobile && (
                            <button
                                onClick={() => setViewMode('KANBAN')}
                                className={`px-2.5 flex items-center gap-1.5 text-[10px] font-bold rounded-md transition-all ${viewMode === 'KANBAN' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <LayoutGrid size={11} /> Board
                            </button>
                        )}
                        {!isMobile && (
                            <button
                                onClick={() => setViewMode('TIMELINE')}
                                className={`px-2.5 flex items-center gap-1.5 text-[10px] font-bold rounded-md transition-all ${viewMode === 'TIMELINE' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <GanttChartSquare size={11} /> Timeline
                            </button>
                        )}
                    </div>

                    {/* CENTER: Search */}
                    <div className="relative flex-1 max-w-xs group">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-amber-500 transition-colors" size={12} />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-[30px] bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-lg pl-7 pr-3 text-[11px] text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/40 transition-all"
                        />
                    </div>

                    {/* Bulk Actions — floating contextual bar */}
                    {selectedTaskIds.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-1.5 py-0.5">
                            <span className="text-[9px] font-bold text-amber-400 tabular-nums px-1.5 bg-amber-500/10 rounded-md py-0.5">{selectedTaskIds.length} selected</span>
                            <div className="w-px h-4 bg-white/[0.06]" />
                            <div className="relative" ref={statusMenuRef}>
                                <button
                                    onClick={() => setShowBulkStatusMenu(!showBulkStatusMenu)}
                                    className="h-[26px] px-2 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all"
                                >
                                    <Activity size={10} className="text-amber-400" /> Status
                                    <ChevronDown size={9} className={`transition-transform ${showBulkStatusMenu ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {showBulkStatusMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute top-full right-0 mt-1 w-40 bg-[#0d1117] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden py-1"
                                        >
                                            {Object.values(TaskStatus).filter(s => s !== 'ARCHIVED').map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => { handleBulkStatusChange(status as TaskStatus); setShowBulkStatusMenu(false); }}
                                                    className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors flex items-center justify-between group"
                                                >
                                                    {status.replace(/_/g, ' ')}
                                                    <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-amber-400" />
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <div className="relative" ref={assignMenuRef}>
                                <button
                                    onClick={() => setShowBulkAssignMenu(!showBulkAssignMenu)}
                                    className="h-[26px] px-2 bg-white/[0.04] hover:bg-white/[0.08] text-cyan-400 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all"
                                >
                                    <UserCircle2 size={10} /> Assign
                                    <ChevronDown size={9} className={`transition-transform ${showBulkAssignMenu ? 'rotate-180' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {showBulkAssignMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 4 }}
                                            transition={{ duration: 0.1 }}
                                            className="absolute top-full right-0 mt-1 w-48 bg-[#0d1117] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto custom-scrollbar py-1"
                                        >
                                            <div className="px-3 py-1.5 border-b border-white/[0.04]">
                                                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Select Staff</p>
                                            </div>
                                            {usersList.map((st) => (
                                                <button
                                                    key={st.uid}
                                                    onClick={() => { handleBulkReassign(st.uid); setShowBulkAssignMenu(false); }}
                                                    className="w-full px-3 py-1.5 text-left text-[11px] font-medium text-gray-300 hover:bg-white/[0.05] hover:text-white transition-colors flex items-center gap-2"
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center text-[9px] font-semibold text-amber-400 flex-shrink-0">
                                                        {getInitials(st.displayName)}
                                                    </div>
                                                    <span className="truncate">{st.displayName}</span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            <button
                                onClick={handleBulkDelete}
                                className="h-[26px] px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all"
                            >
                                <Trash2 size={10} />
                            </button>
                            <button
                                onClick={() => setSelectedTaskIds([])}
                                className="h-[26px] w-[26px] flex items-center justify-center text-slate-500 hover:text-slate-300 rounded-md hover:bg-white/[0.05] transition-colors"
                            >
                                <X size={11} />
                            </button>
                        </div>
                    )}

                    {/* RIGHT: Filter + Export + Templates + New Task */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                        {/* Unified Filters Button */}
                        <button
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                            className={`h-[30px] flex items-center gap-1.5 px-2.5 rounded-lg border text-[10px] font-bold transition-all ${
                                showFilterPanel || activeFilterCount > 0
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                                    : 'bg-white/[0.03] border-white/[0.06] text-gray-500 hover:text-gray-300 hover:border-white/[0.12]'
                            }`}
                        >
                            <Filter size={11} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        <div className="w-px h-4 bg-white/[0.06]" />

                        <div className="flex items-center gap-0.5 bg-white/[0.02] p-0.5 rounded-lg border border-white/[0.05] h-[30px]">
                            <button onClick={handleExportPDF} title="Export PDF" className="w-6 h-full flex items-center justify-center hover:bg-white/10 text-rose-400 rounded-md transition-all"><FileText size={12} /></button>
                            <button onClick={() => handleExportExcel()} title="Export Excel" className="w-6 h-full flex items-center justify-center hover:bg-white/10 text-emerald-400 rounded-md transition-all"><FileSpreadsheet size={12} /></button>
                        </div>

                        <button
                            onClick={() => setIsTemplateModalOpen(true)}
                            disabled={!canCreateTask}
                            className="h-[30px] px-2.5 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-lg border border-white/[0.05] flex items-center gap-1.5 text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Sparkles size={11} className="text-amber-400" /> Templates
                        </button>

                        <button
                            onClick={handleOpenCreate}
                            disabled={!canCreateTask}
                            className="h-[30px] px-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-amber-500/20 flex-shrink-0 disabled:opacity-50 hover:shadow-amber-500/30"
                        >
                            <Plus size={12} strokeWidth={3} /> New Task
                        </button>
                    </div>
                </div>

                {/* Filter Popover Panel — slides down when Filters button is clicked */}
                <AnimatePresence>
                    {showFilterPanel && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                            animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
                            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                            transition={{ duration: 0.15 }}
                            className="border-t border-white/[0.04]"
                        >
                            <div className="px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
                                    <div className="relative">
                                        <select
                                            value={filterStaff}
                                            onChange={(e) => setFilterStaff(e.target.value)}
                                            className="appearance-none w-full h-auto py-1.5 bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] rounded-lg text-[10px] font-bold text-gray-300 pl-2.5 pr-6 focus:outline-none cursor-pointer transition-all"
                                        >
                                            <option value="ALL">Staff: All</option>
                                            {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
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
                                            {Object.values(TaskStatus).filter(s => s !== 'ARCHIVED').map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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
                                            { key: 'COMPLETED', label: 'Done', count: statusStats.COMPLETED, activeColor: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300', inactiveColor: 'bg-white/[0.02] border-white/[0.06] text-slate-400', dot: 'bg-emerald-400', dotGlow: 'shadow-[0_0_6px_rgba(52,211,153,0.4)]' },
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
            </header>

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
                        {hasNextPage && filteredTasks.length > 0 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 py-2 px-5 bg-[#0d1117]/90 backdrop-blur-xl border border-white/[0.08] rounded-full shadow-2xl" style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)' }}>
                                <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                                    {filteredTasks.length} of {tasks.length}
                                </span>
                                <div className="w-px h-3 bg-white/[0.08]" />
                                <button
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isFetchingNextPage ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
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
                isSaving={isSaving}
                isEditMode={isEditMode}
                canManageTask={canManageTask}
                dateMode={dateMode}
                setDateMode={setDateMode}
                newSubtaskTitle={newSubtaskTitle}
                setNewSubtaskTitle={setNewSubtaskTitle}
                onAddSubtask={handleAddSubtask}
                onRemoveSubtask={handleRemoveSubtask}
                onAddComment={handleAddComment}
                onOpenClientDetail={handleOpenClientDetail}
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
                                variant="danger"
                                confirmLabel="Delete"
                                cancelLabel="Cancel"
                                onConfirm={() => {
                                    confirmModal.onConfirm();
                                    setConfirmModal(p => ({ ...p, open: false }));
                                }}
                                onClose={() => setConfirmModal(p => ({ ...p, open: false }))}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default TasksPage;
