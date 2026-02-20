import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
    LayoutGrid, List as ListIcon, CheckSquare, UserCircle2, Briefcase, CheckCircle2,
    AlertCircle, ChevronDown, Check, Loader2, Save, Sparkles, Plus, Filter, Search,
    Calendar, Trash2, X, AlertTriangle, ShieldAlert, Download, FileSpreadsheet,
    FileText, User, Edit2, MoreVertical, Box, ChevronRight, Eye, Clock, Circle
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
    };

    const handleOpenEdit = (task: Task) => {
        setCurrentTask(task);
        setIsEditMode(true);
        setIsModalOpen(true); // Revert to modal entry
        setSelectedTaskId(task.id);
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
                    const mention = `@${u.displayName}`;
                    if (currentTask.description?.includes(mention) && u.uid !== user?.uid) {
                        AuthService.createNotification({
                            userId: u.uid,
                            title: 'You were mentioned',
                            message: `${user?.displayName || 'Someone'} mentioned you in task: ${currentTask.title}`,
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

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedTaskIds.length} tasks?`)) return;
        try {
            await Promise.all(selectedTaskIds.map(id => deleteTaskMutation.mutateAsync(id)));
            setSelectedTaskIds([]);
            toast.success('Tasks deleted');
        } catch (error) {
            toast.error('Failed to delete some tasks');
        }
    };

    const handleExport = async (type: 'pdf' | 'excel') => {
        const dateStr = new Date().toISOString().split('T')[0];
        if (type === 'pdf') {
            const doc = new jsPDF();
            doc.text('Task Status Report', 20, 20);
            autoTable(doc, {
                head: [['Client', 'Task', 'Status', 'Due Date']],
                body: filteredTasks.map(t => [t.clientName || 'N/A', t.title, t.status, t.dueDate])
            });
            doc.save(`Tasks_${dateStr}.pdf`);
        } else {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Tasks');
            sheet.addRow(['Client', 'Task', 'Status', 'Due Date']);
            filteredTasks.forEach(t => sheet.addRow([t.clientName || 'N/A', t.title, t.status, t.dueDate]));
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Tasks_${dateStr}.xlsx`;
            a.click();
        }
        toast.success('Exported successfully');
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
                isCompleted: false
            })),
            dueDate: getCurrentDateUTC()
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
                                    className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${boardMode === 'ALL' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    FIRM WIDE
                                </button>
                                <button
                                    onClick={() => setBoardMode('MY')}
                                    className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all ${boardMode === 'MY' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    MY TASKS
                                </button>
                            </div>
                        </div>

                        <div className="h-10 w-[1px] bg-white/10 mx-2" />

                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                            <button
                                onClick={() => setViewMode('KANBAN')}
                                className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${viewMode === 'KANBAN' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}
                            >
                                <LayoutGrid size={14} /> BOARD
                            </button>
                            <button
                                onClick={() => setViewMode('LIST')}
                                className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all ${viewMode === 'LIST' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:text-white'}`}
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
                            <button onClick={() => handleExport('pdf')} className="p-2 hover:bg-white/10 text-rose-400 rounded-lg transition-all"><FileText size={18} /></button>
                            <button onClick={() => handleExport('excel')} className="p-2 hover:bg-white/10 text-emerald-400 rounded-lg transition-all"><FileSpreadsheet size={18} /></button>
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

                {/* Row 2: Status Ribbon */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: 'TOTAL TASKS', count: statusStats.TOTAL, color: 'blue', icon: LayoutGrid },
                        { label: 'HALTED', count: statusStats.HALTED, color: 'rose', icon: AlertTriangle },
                        { label: 'NOT STARTED', count: statusStats.NOT_STARTED, color: 'gray', icon: Circle },
                        { label: 'IN PROGRESS', count: statusStats.IN_PROGRESS, color: 'blue', icon: Clock },
                        { label: 'UNDER REVIEW', count: statusStats.UNDER_REVIEW, color: 'amber', icon: Eye },
                        { label: 'COMPLETED', count: statusStats.COMPLETED, color: 'emerald', icon: CheckCircle2 },
                    ].map((item, idx) => {
                        const getColorClasses = (color: string) => {
                            switch (color) {
                                case 'blue': return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'hover:border-blue-500/30', glow: 'bg-blue-500/20', hoverBg: 'hover:bg-blue-500/5' };
                                case 'rose': return { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'hover:border-rose-500/30', glow: 'bg-rose-500/20', hoverBg: 'hover:bg-rose-500/5' };
                                case 'amber': return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'hover:border-amber-500/30', glow: 'bg-amber-500/20', hoverBg: 'hover:bg-amber-500/5' };
                                case 'emerald': return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'hover:border-emerald-500/30', glow: 'bg-emerald-500/20', hoverBg: 'hover:bg-emerald-500/5' };
                                default: return { bg: 'bg-gray-500/10', text: 'text-gray-500', border: 'hover:border-gray-500/30', glow: 'bg-gray-500/20', hoverBg: 'hover:bg-gray-500/5' };
                            }
                        };
                        const classes = getColorClasses(item.color);

                        return (
                            <div
                                key={idx}
                                className={`glass-panel p-4 rounded-2xl border border-white/5 flex items-center gap-4 group transition-all duration-300 ${classes.border} ${classes.hoverBg}`}
                            >
                                <div className={`w-10 h-10 rounded-xl ${classes.bg} flex items-center justify-center ${classes.text} shrink-0 shadow-inner overflow-hidden relative`}>
                                    <div className={`absolute inset-0 ${classes.glow} blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                    <item.icon size={20} className="relative z-10 transition-transform group-hover:scale-110" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{item.label}</p>
                                    <p className="text-xl font-black text-white tabular-nums leading-none">{item.count}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Row 3: Advanced Filters */}
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
                                <span className={`text-[10px] font-bold transition-colors ${filterVat ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`}>VAT</span>
                            </label>
                            <div className="w-[1px] h-4 bg-white/10" />
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={filterItr}
                                    onChange={(e) => setFilterItr(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded border-white/10 bg-white/5 text-blue-500 focus:ring-0"
                                />
                                <span className={`text-[10px] font-bold transition-colors ${filterItr ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-400'}`}>ITR</span>
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
                        <div className="px-8 py-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">{isEditMode ? 'Edit Task' : 'Create New Task'}</h3>
                                <p className="text-xs text-gray-400">Fill in the details below to manage the task.</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:text-white transition-all hover:bg-white/10"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Task Title</label>
                                        <input
                                            className="w-full glass-input text-lg font-bold"
                                            placeholder="What needs to be done?"
                                            value={currentTask.title || ''}
                                            onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Description</label>
                                        <textarea
                                            className="w-full glass-input min-h-[150px] py-3 text-sm resize-none"
                                            placeholder="Provide more context (mention staff using @)"
                                            value={currentTask.description || ''}
                                            onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Status</label>
                                            <select
                                                className="w-full glass-input text-xs"
                                                value={currentTask.status}
                                                onChange={(e) => setCurrentTask({ ...currentTask, status: e.target.value as TaskStatus })}
                                            >
                                                {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Priority</label>
                                            <select
                                                className="w-full glass-input text-xs"
                                                value={currentTask.priority}
                                                onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value as TaskPriority })}
                                            >
                                                {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Client</label>
                                            <ClientSelect
                                                clients={clientsList}
                                                value={currentTask.clientIds?.[0] || ''}
                                                onChange={(val) => handleClientChange(val as string)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Due Date</label>
                                            <input
                                                type="date"
                                                className="w-full glass-input text-xs"
                                                value={currentTask.dueDate || ''}
                                                onChange={(e) => setCurrentTask({ ...currentTask, dueDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Assigned To</label>
                                        <StaffSelect
                                            users={usersList}
                                            value={currentTask.assignedTo || []}
                                            onChange={(val) => setCurrentTask({ ...currentTask, assignedTo: val as string[] })}
                                            multi={true}
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-white/5">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Activity & Comments</h4>
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
