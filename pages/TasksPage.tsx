import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
    LayoutGrid, List as ListIcon, CheckSquare, UserCircle2, Briefcase, CheckCircle2,
    AlertCircle, ChevronDown, Check, Loader2, Save, Sparkles, Plus, Filter, Search,
    Calendar, Trash2, X, AlertTriangle, ShieldAlert, Download, FileSpreadsheet,
    FileText, User, Edit2, MoreVertical, Box, ChevronRight, Eye, Clock, Circle, Activity,
    ArrowRight, Tag
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskTemplate, TaskComment } from '../types';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext'; // Import ModalContext
import { AuthService } from '../services/firebase'; // Keep for static helpers if any, or verify removal
// import { TemplateService } from '../services/templates'; // Removed
import { getCurrentDateUTC } from '../utils/dates';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useAddTaskComment, taskKeys } from '../hooks/useTasks';
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
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

const TasksPage: React.FC = () => {
    const { user } = useAuth();
    const { openModal } = useModal();
    const queryClient = useQueryClient();

    // -- DATA FETCHING (React Query) --
    const { data: tasks = [], isLoading: tasksLoading } = useTasks();
    const { data: usersList = [], isLoading: usersLoading } = useUsers();
    const { data: clientsList = [], isLoading: clientsLoading } = useClients();
    const { data: templates = [], isLoading: templatesLoading } = useTemplates();

    const loading = tasksLoading || usersLoading || clientsLoading || templatesLoading;

    // -- MUTATIONS --
    const createTaskMutation = useCreateTask();
    const updateTaskMutation = useUpdateTask();
    const deleteTaskMutation = useDeleteTask();
    const addCommentMutation = useAddTaskComment();

    const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('KANBAN');
    const [boardMode, setBoardMode] = useState<'ALL' | 'MY'>('ALL');
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
    const [collapsedColumns, setCollapsedColumns] = useState<TaskStatus[]>([]);

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

    const [filterPriority, setFilterPriority] = useState<string>('ALL');
    const [groupBy, setGroupBy] = useState<'NONE' | 'AUDITOR' | 'ASSIGNEE'>('NONE');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStaff, setFilterStaff] = useState<string>('ALL');
    const [filterSignee, setFilterSignee] = useState<string>('ALL');
    const [filterVat, setFilterVat] = useState<boolean>(false);
    const [filterItr, setFilterItr] = useState<boolean>(false);

    const filteredTasks = tasks.filter(t => {
        if (boardMode === 'MY' && user) {
            if (!t.assignedTo.includes(user.uid)) return false;
        }
        if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
        if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (filterStaff !== 'ALL' && !t.assignedTo.includes(filterStaff)) return false;

        // Advanced Filters
        if (filterSignee !== 'ALL' || filterVat || filterItr) {
            const taskClient = clientsList.find(c => t.clientIds && t.clientIds.includes(c.id));
            if (!taskClient) return false;
            if (filterVat && !taskClient.vatReturn) return false;
            if (filterItr && !taskClient.itrReturn) return false;
            if (filterSignee !== 'ALL' && taskClient.signingAuthority !== filterSignee) return false;
        }

        return true;
    });

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
                await updateTaskMutation.mutateAsync({ id: currentTask.id, updates: taskToSave });
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
            toast.success('Task deleted');
        } catch (error) {
            toast.error('Failed to delete task');
        }
    };

    const handleAddComment = (comment: TaskComment) => {
        if (currentTask.id) {
            addCommentMutation.mutate({ taskId: currentTask.id, comment });
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

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedTaskIds.length} tasks ? `)) return;
        try {
            await Promise.all(selectedTaskIds.map(id => deleteTaskMutation.mutateAsync(id)));
            setSelectedTaskIds([]);
            toast.success('Tasks deleted');
        } catch (error) {
            toast.error('Failed to delete some tasks');
        }
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

    const handleExportExcel = async () => {
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
            { header: 'Task', key: 'title', width: 45 },
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

        filteredTasks.forEach((t, idx) => {
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
        const newStatus = destination.droppableId as TaskStatus;
        updateTaskMutation.mutate({ id: draggableId, updates: { status: newStatus } });
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
        <div className="flex flex-col h-full bg-[#0a0f1d] p-8 space-y-8 animate-pulse">
            <div className="h-40 bg-white/5 rounded-3xl" />
            <div className="flex-1 bg-white/5 rounded-3xl" />
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#0a0f1d] animate-in fade-in duration-500">
            {/* --- ADVANCED CONSOLE HEADER --- */}
            <header className="flex-none bg-black/40 backdrop-blur-xl border-b border-white/5 p-6 space-y-6">
                {/* Row 1: Actions & View Switcher */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-xl font-black text-white tracking-widest uppercase flex items-center gap-3">
                                <Box className="text-blue-500" size={24} />
                                Tasks <span className="text-blue-500/50">Console</span>
                            </h1>
                            <div className="flex items-center bg-white/5 rounded-lg p-0.5 mt-1 border border-white/5">
                                <button
                                    onClick={() => setBoardMode('ALL')}
                                    className={`text - [10px] font - bold px - 3 py - 1 rounded - md transition - all ${boardMode === 'ALL' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'} `}
                                >
                                    FIRM WIDE
                                </button>
                                <button
                                    onClick={() => setBoardMode('MY')}
                                    className={`text - [10px] font - bold px - 3 py - 1 rounded - md transition - all ${boardMode === 'MY' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'} `}
                                >
                                    MY TASKS
                                </button>
                            </div>
                        </div>

                        <div className="h-10 w-[1px] bg-white/10 mx-2" />

                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setViewMode('KANBAN')}
                                className={`px - 4 py - 1.5 rounded - lg flex items - center gap - 2 text - xs font - bold transition - all ${viewMode === 'KANBAN' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'} `}
                            >
                                <LayoutGrid size={14} /> BOARD
                            </button>
                            <button
                                onClick={() => setViewMode('LIST')}
                                className={`px - 4 py - 1.5 rounded - lg flex items - center gap - 2 text - xs font - bold transition - all ${viewMode === 'LIST' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'} `}
                            >
                                <ListIcon size={14} /> LIST
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {selectedTaskIds.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-500/20 transition-all"
                            >
                                <Trash2 size={14} /> DELETE ({selectedTaskIds.length})
                            </button>
                        )}
                        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5 mr-2">
                            <button onClick={handleExportPDF} className="p-2 hover:bg-white/10 text-rose-400 rounded-lg transition-all"><FileText size={18} /></button>
                            <button onClick={handleExportExcel} className="p-2 hover:bg-white/10 text-emerald-400 rounded-lg transition-all"><FileSpreadsheet size={18} /></button>
                        </div>
                        <button
                            onClick={() => setIsTemplateModalOpen(true)}
                            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 flex items-center gap-2 text-xs font-bold transition-all"
                        >
                            <Sparkles size={16} className="text-amber-400" /> TEMPLATES
                        </button>
                        <button
                            onClick={handleOpenCreate}
                            disabled={!canCreateTask}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50"
                        >
                            <Plus size={18} /> NEW TASK
                        </button>
                    </div>
                </div>

                {/* Row 2: Advanced Filters */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search tasks, clients, or keywords..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-11 bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                            {/* Group By Filter */}
                            <div className="relative group/select">
                                <select
                                    value={groupBy}
                                    onChange={(e) => setGroupBy(e.target.value as any)}
                                    className="appearance-none bg-transparent text-[10px] font-bold text-gray-400 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:text-white transition-colors"
                                >
                                    <option value="NONE" className="bg-[#0a0f1d]">NO GROUPING</option>
                                    <option value="AUDITOR" className="bg-[#0a0f1d]">BY AUDITOR</option>
                                    <option value="ASSIGNEE" className="bg-[#0a0f1d]">BY ASSIGNEE</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 group-hover/select:text-gray-400 pointer-events-none" size={12} />
                            </div>

                            <div className="w-[1px] h-4 bg-white/10" />

                            {/* Staff Filter */}
                            <div className="relative group/select">
                                <select
                                    value={filterStaff}
                                    onChange={(e) => setFilterStaff(e.target.value)}
                                    className="appearance-none bg-transparent text-[10px] font-bold text-gray-400 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:text-white transition-colors max-w-[100px] truncate"
                                >
                                    <option value="ALL" className="bg-[#0a0f1d]">ALL STAFF</option>
                                    {usersList.map(u => <option key={u.uid} value={u.uid} className="bg-[#0a0f1d]">{u.displayName.toUpperCase()}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 group-hover/select:text-gray-400 pointer-events-none" size={12} />
                            </div>

                            <div className="w-[1px] h-4 bg-white/10" />

                            {/* Priority Filter */}
                            <div className="relative group/select">
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                    className="appearance-none bg-transparent text-[10px] font-bold text-gray-400 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:text-white transition-colors"
                                >
                                    <option value="ALL" className="bg-[#0a0f1d]">ALL PRIORITIES</option>
                                    {Object.values(TaskPriority).map(p => <option key={p} value={p} className="bg-[#0a0f1d]">{p}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 group-hover/select:text-gray-400 pointer-events-none" size={12} />
                            </div>

                            <div className="w-[1px] h-4 bg-white/10" />

                            {/* Signee Filter */}
                            <div className="relative group/select">
                                <select
                                    value={filterSignee}
                                    onChange={(e) => setFilterSignee(e.target.value)}
                                    className="appearance-none bg-transparent text-[10px] font-bold text-gray-400 pl-3 pr-8 py-1.5 focus:outline-none cursor-pointer hover:text-white transition-colors"
                                >
                                    <option value="ALL" className="bg-[#0a0f1d]">ALL SIGNEES</option>
                                    {SIGNING_AUTHORITIES.map(s => <option key={s} value={s} className="bg-[#0a0f1d]">{s.toUpperCase()}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 group-hover/select:text-gray-400 pointer-events-none" size={12} />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-white/5 px-4 h-11 rounded-xl border border-white/5">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filterVat}
                                    onChange={(e) => setFilterVat(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-0"
                                />
                                <span className={`text - [10px] font - bold transition - colors ${filterVat ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'} `}>VAT</span>
                            </label>
                            <div className="w-[1px] h-4 bg-white/10" />
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filterItr}
                                    onChange={(e) => setFilterItr(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-0"
                                />
                                <span className={`text - [10px] font - bold transition - colors ${filterItr ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'} `}>ITR</span>
                            </label>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- WORKSPACE AREA --- */}
            <main className="flex-1 overflow-hidden relative">
                <TaskMainView
                    viewMode={viewMode}
                    tasks={filteredTasks}
                    onDragEnd={onDragEnd}
                    handleOpenEdit={handleOpenEdit}
                    usersList={usersList}
                    collapsedColumns={collapsedColumns}
                    toggleColumnCollapse={(status) => setCollapsedColumns(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status])}
                    selectedTaskId={selectedTaskId}
                    selectedTaskIds={selectedTaskIds}
                    onToggleSelection={toggleTaskSelection}
                    groupBy={groupBy}
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
                            toast.success('Task created');
                        } catch (error) {
                            toast.error('Failed to create task');
                        }
                    }}
                />
            </main>

            {/* Modals for Create/Edit/Templates */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="glass-modal rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10 text-gray-100 overflow-hidden">
                        <div className="shrink-0 px-8 py-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative overflow-hidden">
                            {/* Dynamic Accent Header based on Status */}
                            <div className={`absolute top - 0 left - 0 w - full h - 1 ${currentTask.status === TaskStatus.COMPLETED ? 'bg-emerald-500' :
                                currentTask.status === TaskStatus.HALTED ? 'bg-rose-500' :
                                    currentTask.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                                        currentTask.status === TaskStatus.UNDER_REVIEW ? 'bg-amber-500' : 'bg-gray-500'
                                } `} />
                            <div>
                                <h3 className="text-xl font-black text-white tracking-wide uppercase flex items-center gap-2">
                                    {isEditMode ? <Edit2 size={18} className="text-blue-400" /> : <Plus size={18} className="text-blue-400" />}
                                    {isEditMode ? 'EDIT TASK' : 'NEW TASK'}
                                </h3>
                                {isEditMode && currentTask.id && (
                                    <p className="text-[10px] text-gray-500 font-mono mt-1">ID: #{currentTask.id.substring(0, 6).toUpperCase()}</p>
                                )}
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:text-white transition-all hover:bg-white/10"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                            <div className="flex flex-col gap-10 max-w-4xl mx-auto w-full pb-8">

                                {/* Header: Title & Description */}
                                <div className="space-y-6">
                                    <div className="space-y-2 group">
                                        <input
                                            autoFocus
                                            className="w-full bg-transparent text-3xl md:text-4xl font-black text-white placeholder:text-gray-700 placeholder:font-bold focus:outline-none focus:ring-0 border-none px-0 transition-all placeholder:tracking-tight ring-0"
                                            placeholder="Task Title..."
                                            value={currentTask.title || ''}
                                            onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                                        />
                                        <div className="w-full h-[1px] bg-white/5 group-focus-within:bg-blue-500/50 transition-colors" />
                                    </div>
                                    <div>
                                        <textarea
                                            className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-2xl min-h-[140px] p-5 text-sm resize-none text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                                            placeholder="Add a more detailed description... (Type @ to mention staff)"
                                            value={currentTask.description || ''}
                                            onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Details block */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-[#0a0f1d] p-6 rounded-3xl border border-white/5 shadow-2xl">
                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={12} className="text-blue-400" /> Status
                                        </label>
                                        <select
                                            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none p-1 cursor-pointer"
                                            value={currentTask.status}
                                            onChange={(e) => setCurrentTask({ ...currentTask, status: e.target.value as TaskStatus })}
                                        >
                                            {Object.values(TaskStatus).map(s => <option key={s} value={s} className="bg-[#1e293b]">{s.replace('_', ' ')}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <AlertTriangle size={12} className={currentTask.priority === 'URGENT' ? 'text-rose-400' : 'text-orange-400'} /> Priority
                                        </label>
                                        <select
                                            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none p-1 cursor-pointer"
                                            value={currentTask.priority}
                                            onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value as TaskPriority })}
                                        >
                                            {Object.values(TaskPriority).map(p => <option key={p} value={p} className="bg-[#1e293b]">{p}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <Briefcase size={12} className="text-indigo-400" /> Client
                                        </label>
                                        <ClientSelect
                                            clients={clientsList}
                                            value={currentTask.clientIds?.[0] || ''}
                                            onChange={(val) => handleClientChange(val as string)}
                                        />
                                    </div>

                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05] lg:col-span-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                <Calendar size={12} className="text-emerald-400" /> Due Date
                                            </label>
                                            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                                                <button
                                                    onClick={() => setDateMode('AD')}
                                                    className={`px - 2 py - 0.5 rounded font - bold text - [9px] transition - all ${dateMode === 'AD' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-600 hover:text-white'} `}
                                                >
                                                    AD
                                                </button>
                                                <button
                                                    onClick={() => setDateMode('BS')}
                                                    className={`px - 2 py - 0.5 rounded font - bold text - [9px] transition - all ${dateMode === 'BS' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-600 hover:text-white'} `}
                                                >
                                                    BS
                                                </button>
                                            </div>
                                        </div>
                                        {dateMode === 'AD' ? (
                                            <input
                                                type="date"
                                                value={currentTask.dueDate || ''}
                                                onChange={(e) => setCurrentTask({ ...currentTask, dueDate: e.target.value })}
                                                className="w-full bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer"
                                            />
                                        ) : (
                                            <NepaliDatePicker
                                                value={currentTask.dueDate || ''}
                                                onChange={(adDate) => setCurrentTask({ ...currentTask, dueDate: adDate })}
                                                placeholder="Select Date"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05] md:col-span-2 lg:col-span-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <UserCircle2 size={12} className="text-cyan-400" /> Assignees
                                        </label>
                                        <StaffSelect
                                            users={usersList}
                                            value={currentTask.assignedTo || []}
                                            onChange={(val) => setCurrentTask({ ...currentTask, assignedTo: val as string[] })}
                                            multi={true}
                                        />
                                    </div>

                                    {/* Advanced Workflow: Time Tracking */}
                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05] md:col-span-2 lg:col-span-4 border-t-blue-500/20 border-t-2">
                                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <Clock size={12} /> Time Logged (Minutes)
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-32 bg-black/40 text-lg font-black text-white p-3 rounded-xl border border-white/5 focus:border-blue-500/50 focus:outline-none text-center"
                                                value={currentTask.totalTimeSpent || ''}
                                                onChange={(e) => setCurrentTask({ ...currentTask, totalTimeSpent: parseInt(e.target.value) || 0 })}
                                                placeholder="0"
                                            />
                                            <span className="text-xs text-gray-500 font-bold max-w-[200px] leading-relaxed">
                                                Track total time spent working on this task to gauge efficiency.
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Subtasks Block */}
                                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                                        <span>Subtasks ({currentTask.subtasks?.length || 0})</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                                            placeholder="Add a subtask..."
                                            className="flex-1 glass-input text-sm"
                                        />
                                        <button
                                            onClick={handleAddSubtask}
                                            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all font-bold text-sm flex items-center gap-2"
                                        >
                                            <Plus size={16} /> Add
                                        </button>
                                    </div>
                                    {currentTask.subtasks && currentTask.subtasks.length > 0 && (
                                        <div className="space-y-2 mt-4">
                                            {currentTask.subtasks.map((st, i) => (
                                                <div key={st.id} className="flex flex-col gap-3 p-4 bg-black/20 rounded-xl border border-white/5 group">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-start gap-3 flex-1 mt-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={st.isCompleted}
                                                                onChange={(e) => {
                                                                    const updated = [...(currentTask.subtasks || [])];
                                                                    updated[i].isCompleted = e.target.checked;
                                                                    setCurrentTask({ ...currentTask, subtasks: updated });
                                                                }}
                                                                className="w-5 h-5 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50 cursor-pointer appearance-none checked:bg-blue-500 transition-colors mt-0.5 shrink-0 relative flex items-center justify-center after:content-['✓'] after:absolute after:text-white after:opacity-0 checked:after:opacity-100 after:text-sm after:font-bold"
                                                            />
                                                            <div className="flex flex-col gap-2 flex-1">
                                                                <span className={`text - [14px] font - bold leading - tight ${st.isCompleted ? 'line-through text-gray-600' : 'text-gray-200 group-hover:text-blue-200 transition-colors'} `}>
                                                                    {st.title}
                                                                </span>
                                                                {/* Assignee for Subtask */}
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <UserCircle2 size={14} className="text-gray-500" />
                                                                    <select
                                                                        className="bg-transparent text-xs font-bold text-gray-400 focus:text-white focus:outline-none cursor-pointer hover:text-gray-300"
                                                                        value={st.assignedTo || ''}
                                                                        onChange={(e) => {
                                                                            const updated = [...(currentTask.subtasks || [])];
                                                                            updated[i].assignedTo = e.target.value;
                                                                            setCurrentTask({ ...currentTask, subtasks: updated });
                                                                        }}
                                                                    >
                                                                        <option value="" className="bg-[#0a0f1d]">- Unassigned -</option>
                                                                        {usersList.map((u) => (
                                                                            <option key={u.uid} value={u.uid} className="bg-[#0a0f1d]">{u.displayName}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveSubtask(st.id)}
                                                            className="text-gray-500 hover:text-rose-400 p-2 opacity-0 group-hover:opacity-100 transition-all bg-white/5 rounded-lg ml-4 shrink-0"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Comments Block */}
                                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Activity & Comments</h4>
                                    <div className="bg-black/20 rounded-xl p-4">
                                        <TaskComments
                                            comments={currentTask.comments || []}
                                            onAddComment={handleAddComment}
                                            users={usersList}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-8 py-6 border-t border-white/10 flex justify-between items-center bg-white/5">
                            {isEditMode && canManageTask ? (
                                <button onClick={() => handleDeleteTask(currentTask.id!)} className="px-4 py-2 text-red-400 hover:text-red-300 text-sm font-bold flex items-center gap-2 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/20"><Trash2 size={16} /> Delete Task</button>
                            ) : <div></div>}
                            <div className="flex gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-gray-400 hover:text-white text-sm font-bold bg-white/5 rounded-xl transition-all border border-white/5 hover:bg-white/10">Cancel</button>
                                <button
                                    onClick={handleSaveTask}
                                    disabled={isSaving}
                                    className="px-8 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-600/20 flex items-center gap-2 group"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} className="group-hover:scale-110 transition-transform" />}
                                    {isEditMode ? 'Update Task' : 'Create Task'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isTemplateModalOpen && (
                <TaskTemplateModal
                    isOpen={isTemplateModalOpen}
                    onClose={() => setIsTemplateModalOpen(false)}
                    onSelectTemplate={handleTemplateSelect}
                />
            )}
            {isTemplateManagerOpen && <TemplateManager onClose={() => setIsTemplateManagerOpen(false)} />}
        </div>
    );
};

export default TasksPage;
