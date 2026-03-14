import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
    LayoutGrid, List as ListIcon, CheckSquare, UserCircle2, Briefcase, CheckCircle2,
    AlertCircle, ChevronDown, Check, Loader2, Save, Sparkles, Plus, Filter, Search,
    Calendar, Trash2, X, AlertTriangle, ShieldAlert, Download, FileSpreadsheet,
    FileText, User, Edit2, MoreVertical, Box, ChevronRight, Eye, Clock, Circle, Activity,
    ArrowRight, Tag, GanttChartSquare
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskTemplate, TaskComment } from '../types';
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
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { useMedia } from 'react-use';

const TasksPage: React.FC = () => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const queryClient = useQueryClient();

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
    const [boardMode, setBoardMode] = useState<'ALL' | 'MY'>('ALL');
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

    useEffect(() => {
        if (isMobile && (viewMode === 'KANBAN' || viewMode === 'TIMELINE')) {
            setViewMode('LIST');
        }
    }, [isMobile, viewMode]);
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
    const [collapsedColumns, setCollapsedColumns] = useState<TaskStatus[]>([]);

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTaskIds(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    // Bulk Actions State
    const [showBulkStatusMenu, setShowBulkStatusMenu] = useState(false);
    const [showBulkAssignMenu, setShowBulkAssignMenu] = useState(false);

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

    // Permissions check
    const canCreateTask = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.MASTER_ADMIN;
    const canManageTask = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.MASTER_ADMIN;

    const [filterPriority, setFilterPriority] = useState<string>(() => localStorage.getItem('rsa_filter_priority') || 'ALL');
    const [filterStatus, setFilterStatus] = useState<string>(() => localStorage.getItem('rsa_filter_status') || 'ALL');
    const [filterClient, setFilterClient] = useState<string>(() => localStorage.getItem('rsa_filter_client') || 'ALL');
    const [groupBy, setGroupBy] = useState<'NONE' | 'AUDITOR' | 'ASSIGNEE'>(() => (localStorage.getItem('rsa_filter_groupby') as any) || 'NONE');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStaff, setFilterStaff] = useState<string>(() => localStorage.getItem('rsa_filter_staff') || 'ALL');
    const [filterAuditor, setFilterAuditor] = useState<string>(() => localStorage.getItem('rsa_filter_auditor') || 'ALL');
    const [filterVat, setFilterVat] = useState<boolean>(() => localStorage.getItem('rsa_filter_vat') === 'true');
    const [filterItr, setFilterItr] = useState<boolean>(() => localStorage.getItem('rsa_filter_itr') === 'true');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

    // Auto-persistence Effects
    useEffect(() => {
        localStorage.setItem('rsa_filter_priority', filterPriority);
        localStorage.setItem('rsa_filter_status', filterStatus);
        localStorage.setItem('rsa_filter_client', filterClient);
        localStorage.setItem('rsa_filter_groupby', groupBy);
        localStorage.setItem('rsa_filter_staff', filterStaff);
        localStorage.setItem('rsa_filter_auditor', filterAuditor);
        localStorage.setItem('rsa_filter_vat', String(filterVat));
        localStorage.setItem('rsa_filter_itr', String(filterItr));
    }, [filterPriority, filterStatus, filterClient, groupBy, filterStaff, filterAuditor, filterVat, filterItr]);

    // LocalStorage for saved filters
    const [savedFilters, setSavedFilters] = useState<{ name: string; filters: any }[]>([]);
    useEffect(() => {
        const saved = localStorage.getItem('rsa_task_filters');
        if (saved) setSavedFilters(JSON.parse(saved));
    }, []);

    const saveCurrentFilters = (name: string) => {
        const newFilters = [...savedFilters, {
            name,
            filters: {
                filterPriority, filterStatus, filterStaff, filterClient, filterAuditor, filterVat, filterItr, dateRange, searchTerm
            }
        }];
        setSavedFilters(newFilters);
        localStorage.setItem('rsa_task_filters', JSON.stringify(newFilters));
        toast.success(`Filter "${name}" saved`);
    };

    const applySavedFilter = (filter: any) => {
        setFilterPriority(filter.filterPriority || 'ALL');
        setFilterStatus(filter.filterStatus || 'ALL');
        setFilterStaff(filter.filterStaff || 'ALL');
        setFilterClient(filter.filterClient || 'ALL');
        setFilterAuditor(filter.filterAuditor || 'ALL');
        setFilterVat(!!filter.filterVat);
        setFilterItr(!!filter.filterItr);
        setDateRange(filter.dateRange || { start: '', end: '' });
        setSearchTerm(filter.searchTerm || '');
    };

    const filteredTasks = tasks.filter(t => {
        if (boardMode === 'MY' && user) {
            if (!t.assignedTo.includes(user.uid)) return false;
        }
        if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
        if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
        if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterStaff !== 'ALL' && !t.assignedTo.includes(filterStaff)) return false;
        if (filterClient !== 'ALL' && !t.clientIds?.includes(filterClient)) return false;

        // Advanced Filters
        if (filterAuditor !== 'ALL' || filterVat || filterItr) {
            const taskClient = clientsList.find(c => t.clientIds && t.clientIds.includes(c.id));
            if (!taskClient) return false;
            if (filterVat && !taskClient.vatReturn) return false;
            if (filterItr && !taskClient.itrReturn) return false;
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
            dueDate: getCurrentDateUTC(),
            clientIds: [],
            teamLeaderId: '',
            comments: []
        });
        setIsModalOpen(true);
        setDateMode('AD');
        setNewSubtaskTitle('');
    };

    const handleOpenEdit = (task: Task) => {
        setCurrentTask(task);
        setIsEditMode(true);
        setIsModalOpen(true); // Revert to modal entry
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

    const handleSaveTask = async () => {
        if (!currentTask.title?.trim()) {
            setFormError("Title is required.");
            return;
        }
        setIsSaving(true);
        try {
            const taskToSave = cleanForFirestore(currentTask);
            if (isEditMode && currentTask.id) {
                // EXTREMELY IMPORTANT: Unpack comments out so it doesn't revert newer comments added to the DB
                const { comments, ...updatesWithoutComments } = taskToSave;
                await updateTaskMutation.mutateAsync({ id: currentTask.id, updates: updatesWithoutComments });
            } else {
                await createTaskMutation.mutateAsync(taskToSave as Task);
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
            toast.success(isEditMode ? 'Task updated' : 'Task created');
        } catch (error) {
            console.error('Error saving task:', error);
            toast.error('Failed to save task');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            await deleteTaskMutation.mutateAsync(taskId);
            setIsModalOpen(false);
            setSelectedTaskId(undefined);
            setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
            toast.success('Task deleted');
        } catch (error) {
            toast.error('Failed to delete task');
        }
    };

    // --- BULK ACTIONS ---
    const handleBulkDelete = async () => {
        if (!selectedTaskIds.length) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} tasks?`)) return;
        try {
            await Promise.all(selectedTaskIds.map(id => deleteTaskMutation.mutateAsync(id)));
            toast.success(`${selectedTaskIds.length} tasks deleted`);
            setSelectedTaskIds([]);
        } catch (error) {
            toast.error('Failed to delete some tasks');
        }
    };

    const handleBulkStatusChange = async (newStatus: TaskStatus) => {
        if (!selectedTaskIds.length) return;
        setShowBulkStatusMenu(false);
        try {
            await Promise.all(selectedTaskIds.map(id => updateTaskMutation.mutateAsync({ id, updates: { status: newStatus } })));
            toast.success(`${selectedTaskIds.length} tasks moved to ${newStatus.replace('_', ' ')}`);
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
            doc.text('R. Sapkota & Associates — Confidential', 14, doc.internal.pageSize.height - 8);
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

        const newStatus = destination.droppableId as TaskStatus;
        updateTaskStatusMutation.mutate({ id: draggableId, status: newStatus });
    };

    const handleTemplateSelect = (template: any) => {
        setCurrentTask({
            title: template.name,
            description: template.description,
            priority: template.priority,
            status: TaskStatus.NOT_STARTED,
            subtasks: (template.subtasks || []).map((s: string) => ({
                id: Math.random().toString(36).substr(2, 9),
                title: s,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                createdBy: user?.uid || 'unknown'
            })),
            dueDate: getCurrentDateUTC(),
            totalTimeSpent: 0, // Added totalTimeSpent
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

    if (loading) return (
        <div className="flex flex-col h-full bg-transparent p-8 space-y-8 animate-pulse">
            <div className="h-40 bg-white/5 rounded-3xl" />
            <div className="flex-1 bg-white/5 rounded-3xl" />
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-transparent">
            {/* --- PREMIUM WORKSPACE HEADER --- */}
            <header className="flex-none glass-panel border-b border-white/[0.05] p-6 pb-5 relative z-20">
                {/* Top Row: Title, Toggles & Actions — wraps on small screens so everything is visible */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    {/* Left: Branding + view toggles */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-4 border-r border-white/10 pr-4">
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0"
                            >
                                <Box className="text-white" size={20} />
                            </motion.div>
                            <div className="hidden sm:block">
                                <h1 className="text-lg font-black text-white tracking-tight">Workflow</h1>
                                <p className="text-[10px] font-medium text-gray-400">Manage firm tasks &amp; projects</p>
                            </div>
                        </div>

                        {/* View Modes */}
                        <div className="flex flex-wrap items-center bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
                            <button
                                onClick={() => setViewMode('LIST')}
                                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${viewMode === 'LIST' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <ListIcon size={14} /> List
                            </button>
                            {!isMobile && (
                                <button
                                    onClick={() => setViewMode('KANBAN')}
                                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${viewMode === 'KANBAN' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <LayoutGrid size={14} /> Board
                                </button>
                            )}
                            {!isMobile && (
                                <button
                                    onClick={() => setViewMode('TIMELINE')}
                                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${viewMode === 'TIMELINE' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <GanttChartSquare size={14} /> Timeline
                                </button>
                            )}
                            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />
                            <button
                                onClick={() => setBoardMode('ALL')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${boardMode === 'ALL' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Firm Wide
                            </button>
                            <button
                                onClick={() => setBoardMode('MY')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${boardMode === 'MY' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                My Tasks
                            </button>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        {selectedTaskIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-rose-500/10"
                            >
                                <Trash2 size={15} /> Delete ({selectedTaskIds.length})
                            </button>
                        )}
                        <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/[0.05]">
                            <button onClick={handleExportPDF} title="Export PDF" className="p-2 hover:bg-white/10 text-rose-400 rounded-lg transition-all"><FileText size={16} /></button>
                            <button onClick={() => handleExportExcel()} title="Export Excel" className="p-2 hover:bg-white/10 text-emerald-400 rounded-lg transition-all"><FileSpreadsheet size={16} /></button>
                        </div>
                        <button
                            onClick={() => setIsTemplateModalOpen(true)}
                            className="px-4 py-2 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-xl border border-white/[0.05] flex items-center gap-2 text-xs font-bold transition-all"
                        >
                            <Sparkles size={14} className="text-amber-400" /> Templates
                        </button>
                        <button
                            onClick={handleOpenCreate}
                            disabled={!canCreateTask}
                            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 border border-white/10 flex-shrink-0"
                        >
                            <Plus size={16} /> New Task
                        </button>
                    </div>
                </div>

                {/* Bottom: Status Stats Strip + Search/Filter Row */}
                <div className="space-y-3">

                    {/* Status Stats Strip — only shown in List view (Kanban board columns already show counts) */}
                    {viewMode === 'LIST' && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {([
                                { key: 'ALL', label: 'Total', count: statusStats.TOTAL, activeColor: 'bg-slate-600 border-slate-500 text-white', inactiveColor: 'bg-slate-800/60 border-slate-700/50 text-slate-400', dot: 'bg-slate-400' },
                                { key: 'NOT_STARTED', label: 'Not Started', count: statusStats.NOT_STARTED, activeColor: 'bg-slate-600 border-slate-500 text-white', inactiveColor: 'bg-slate-800/60 border-slate-700/50 text-slate-400', dot: 'bg-slate-400' },
                                { key: 'IN_PROGRESS', label: 'In Progress', count: statusStats.IN_PROGRESS, activeColor: 'bg-blue-600 border-blue-500 text-white', inactiveColor: 'bg-blue-900/40 border-blue-800/50 text-blue-400', dot: 'bg-blue-400' },
                                { key: 'UNDER_REVIEW', label: 'Under Review', count: statusStats.UNDER_REVIEW, activeColor: 'bg-amber-600 border-amber-500 text-white', inactiveColor: 'bg-amber-900/40 border-amber-800/50 text-amber-400', dot: 'bg-amber-400' },
                                { key: 'HALTED', label: 'Halted', count: statusStats.HALTED, activeColor: 'bg-rose-600 border-rose-500 text-white', inactiveColor: 'bg-rose-900/40 border-rose-800/50 text-rose-400', dot: 'bg-rose-400' },
                                { key: 'COMPLETED', label: 'Completed', count: statusStats.COMPLETED, activeColor: 'bg-emerald-600 border-emerald-500 text-white', inactiveColor: 'bg-emerald-900/40 border-emerald-800/50 text-emerald-400', dot: 'bg-emerald-400' },
                            ] as const).map(({ key, label, count, activeColor, inactiveColor, dot }) => {
                                const isActive = filterStatus === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setFilterStatus(key)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all ${isActive ? activeColor : inactiveColor + ' hover:brightness-125'
                                            }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : dot}`} />
                                        {label}
                                        <span className={`font-black tabular-nums ${isActive ? 'text-white' : ''}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Search + Filters Row */}
                    <div className="flex items-center bg-white/5 p-3 rounded-2xl border border-white/[0.05] gap-0">
                        {/* Search — fixed width */}
                        <div className="flex-shrink-0 w-64 relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={15} />
                            <input
                                type="text"
                                placeholder="Search tasks or clients..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 bg-transparent border-r border-white/10 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Filters — horizontally scrollable */}
                        <div className="flex items-center gap-2 overflow-x-auto pl-3 scrollbar-none flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-gray-500 flex-shrink-0">
                                <Filter size={13} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Filters:</span>
                            </div>

                            <div className="relative flex-shrink-0">
                                <select
                                    value={groupBy}
                                    onChange={(e) => setGroupBy(e.target.value as any)}
                                    className="appearance-none bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-gray-300 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:bg-white/10 transition-colors"
                                >
                                    <option value="NONE" className="bg-[#0f172a]">Group: None</option>
                                    <option value="AUDITOR" className="bg-[#0f172a]">Group: Auditor</option>
                                    <option value="ASSIGNEE" className="bg-[#0f172a]">Group: Staff</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={12} />
                            </div>

                            <div className="relative flex-shrink-0">
                                <select
                                    value={filterStaff}
                                    onChange={(e) => setFilterStaff(e.target.value)}
                                    className="appearance-none bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-gray-300 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:bg-white/10 transition-colors max-w-[130px] truncate"
                                >
                                    <option value="ALL" className="bg-[#0f172a]">Staff: All</option>
                                    {usersList.map(u => <option key={u.uid} value={u.uid} className="bg-[#0f172a]">{u.displayName}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={12} />
                            </div>

                            <div className="relative flex-shrink-0">
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                    className="appearance-none bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-gray-300 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:bg-white/10 transition-colors"
                                >
                                    <option value="ALL" className="bg-[#0f172a]">Priority: All</option>
                                    {Object.values(TaskPriority).map(p => <option key={p} value={p} className="bg-[#0f172a]">{p}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={12} />
                            </div>

                            <div className="relative flex-shrink-0">
                                <select
                                    value={filterAuditor}
                                    onChange={(e) => setFilterAuditor(e.target.value)}
                                    className="appearance-none bg-white/5 border border-white/5 rounded-lg text-xs font-bold text-gray-300 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:bg-white/10 transition-colors"
                                >
                                    <option value="ALL" className="bg-[#0f172a]">Auditor: All</option>
                                    {SIGNING_AUTHORITIES.map(s => <option key={s} value={s} className="bg-[#0f172a]">{s}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={12} />
                            </div>

                            <div className="w-px h-5 bg-white/10 flex-shrink-0" />

                            <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={filterVat}
                                    onChange={(e) => setFilterVat(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0"
                                />
                                <span className={`text-xs font-bold transition-colors ${filterVat ? 'text-blue-400' : 'text-gray-300'}`}>VAT</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={filterItr}
                                    onChange={(e) => setFilterItr(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-0"
                                />
                                <span className={`text-xs font-bold transition-colors ${filterItr ? 'text-blue-400' : 'text-gray-300'}`}>ITR</span>
                            </label>
                        </div>
                    </div>

                    {/* Active Filter Pills */}
                    {(searchTerm || filterStatus !== 'ALL' || filterPriority !== 'ALL' || filterStaff !== 'ALL' || filterClient !== 'ALL' || filterAuditor !== 'ALL' || filterVat || filterItr || (dateRange.start || dateRange.end)) && (
                        <div className="flex flex-wrap items-center gap-2 px-1">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-2">Active Filters:</span>
                            {searchTerm && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[11px] font-bold text-blue-400">
                                    Search: {searchTerm}
                                    <button onClick={() => setSearchTerm('')} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {filterStatus !== 'ALL' && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[11px] font-bold text-amber-400">
                                    Status: {filterStatus}
                                    <button onClick={() => setFilterStatus('ALL')} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {filterPriority !== 'ALL' && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-[11px] font-bold text-rose-400">
                                    Priority: {filterPriority}
                                    <button onClick={() => setFilterPriority('ALL')} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {filterStaff !== 'ALL' && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[11px] font-bold text-cyan-400">
                                    Staff: {usersList.find(u => u.uid === filterStaff)?.displayName || filterStaff}
                                    <button onClick={() => setFilterStaff('ALL')} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {filterClient !== 'ALL' && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[11px] font-bold text-indigo-400">
                                    Client: {clientsList.find(c => c.id === filterClient)?.name || filterClient}
                                    <button onClick={() => setFilterClient('ALL')} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {filterAuditor !== 'ALL' && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-[11px] font-bold text-violet-400">
                                    Auditor: {filterAuditor}
                                    <button onClick={() => setFilterAuditor('ALL')} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {filterVat && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-bold text-emerald-400">
                                    VAT Only
                                    <button onClick={() => setFilterVat(false)} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {filterItr && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-[11px] font-bold text-orange-400">
                                    ITR Only
                                    <button onClick={() => setFilterItr(false)} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            {(dateRange.start || dateRange.end) && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-[11px] font-bold text-blue-400">
                                    Date: {dateRange.start || '...'} to {dateRange.end || '...'}
                                    <button onClick={() => setDateRange({ start: '', end: '' })} className="hover:text-white transition-colors"><X size={12} /></button>
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setFilterStatus('ALL');
                                    setFilterPriority('ALL');
                                    setFilterStaff('ALL');
                                    setFilterClient('ALL');
                                    setFilterAuditor('ALL');
                                    setFilterVat(false);
                                    setFilterItr(false);
                                    setDateRange({ start: '', end: '' });
                                }}
                                className="text-[10px] font-bold text-gray-500 hover:text-white transition-colors ml-2 underline underline-offset-4"
                            >
                                Clear All
                            </button>
                        </div>
                    )}
                </div>


            </header >

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
                        {hasNextPage && (
                            <div className="flex justify-center p-4 bg-[#0a0f1e] z-10 border-t border-white/[0.06]">
                                <button
                                    onClick={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] uppercase tracking-widest transition-colors disabled:opacity-50"
                                >
                                    {isFetchingNextPage ? 'Loading...' : 'Load More Tasks'}
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
        </div >
    );
};

export default TasksPage;
