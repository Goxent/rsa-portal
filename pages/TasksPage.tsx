
import React, { useState, useEffect, useRef } from 'react';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
    LayoutGrid, List as ListIcon, CheckSquare, UserCircle2, Briefcase, CheckCircle2, AlertCircle, ChevronDown, Check, Loader2, Save, Sparkles, Plus, Filter, Search, Calendar, Trash2, X, AlertTriangle, ShieldAlert, Download, FileSpreadsheet, FileText
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskTemplate, TaskComment } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { TemplateService } from '../services/templates';
import { getCurrentDateUTC } from '../utils/dates';
import { SIGNING_AUTHORITIES } from '../constants/firmData';
import TaskTemplateModal from '../components/TaskTemplateModal';
import TemplateManager from '../components/TemplateManager';
import StaffSelect from '../components/StaffSelect';
import TaskComments from '../components/TaskComments';
import { TaskListSkeleton } from '../components/ui/LoadingSkeleton';
import ClientSelect from '../components/ClientSelect';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

const TasksPage: React.FC = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('KANBAN');
    const [boardMode, setBoardMode] = useState<'ALL' | 'MY'>('ALL');
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [collapsedColumns, setCollapsedColumns] = useState<TaskStatus[]>([]);

    // Pagination State
    const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isMoreLoading, setIsMoreLoading] = useState(false);

    // Data State
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [clientsList, setClientsList] = useState<Client[]>([]);
    const [templates, setTemplates] = useState<TaskTemplate[]>([]);

    // Modal & Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Assignee Dropdown State
    const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Permissions Check
    const canCreateTask = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.MASTER_ADMIN;
    // canManageTask controls critical fields (Client, Title, Priority, Dates, Assignees)
    const canManageTask = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.MASTER_ADMIN;

    // Template Access Check
    const canAccessTemplates = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const [filterPriority, setFilterPriority] = useState<string>('ALL');
    const [groupBy, setGroupBy] = useState<'NONE' | 'AUDITOR' | 'ASSIGNEE'>('NONE');
    const [searchTerm, setSearchTerm] = useState('');

    // New Filters

    const [filterStaff, setFilterStaff] = useState<string>('ALL');
    const [filterSignee, setFilterSignee] = useState<string>('ALL');
    const [filterVat, setFilterVat] = useState<boolean>(false);
    const [filterItr, setFilterItr] = useState<boolean>(false);

    // Static Signees List
    // Static Signees List
    const signees = SIGNING_AUTHORITIES;

    const filteredTasks = tasks.filter(t => {
        // existing filters
        if (boardMode === 'MY' && user) {
            if (!t.assignedTo.includes(user.uid)) return false;
        }
        if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
        if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        // Staff Filter
        if (filterStaff !== 'ALL') {
            if (!t.assignedTo.includes(filterStaff)) return false;
        }

        // New Filters Logic
        if (filterSignee !== 'ALL' || filterVat || filterItr) {
            // We need the client object for these filters. 
            // In a real app, tasks should store client details or we lookup.
            // Currently tasks store 'clientName' and 'clientIds' (newly added).
            // Fallback: match by name if ID missing (legacy tasks)
            const taskClient = clientsList.find(c => t.clientIds && t.clientIds.includes(c.id));

            if (!taskClient) return false; // If filtering by client props but no client found, exclude.


            if (filterVat && !taskClient.vatReturn) return false;
            if (filterItr && !taskClient.itrReturn) return false;
        }

        return true;
    });

    const getInitials = (name: string) => {
        return name
            ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : '?';
    };

    const handleOpenCreate = () => {
        if (!canCreateTask) return;
        setIsEditMode(false);
        setFormError('');

        // Get local date string without timezone conversion
        const localDate = getCurrentDateUTC();

        setCurrentTask({
            title: '',
            description: '',
            assignedTo: [],
            status: TaskStatus.NOT_STARTED,
            priority: TaskPriority.MEDIUM,
            subtasks: [],
            dueDate: localDate,
            clientIds: [],
            teamLeaderId: '',
            riskLevel: 'LOW',
            comments: []
        });
        setIsModalOpen(true);
    };

    const handleTemplateSelect = (template: any) => {
        setIsTemplateModalOpen(false);
        setIsEditMode(false);
        setFormError('');
        setCurrentTask({
            title: template.name,
            description: template.description || '',
            assignedTo: [],
            status: TaskStatus.NOT_STARTED,
            priority: template.priority || TaskPriority.MEDIUM,
            subtasks: (template.subtasks || []).map((t: string) => ({
                id: Math.random().toString(36).substr(2, 9),
                title: t,
                isCompleted: false,
                createdBy: user?.uid || 'system',
                createdAt: new Date().toISOString()
            })),
            dueDate: getCurrentDateUTC(),
            clientIds: [],
            teamLeaderId: ''
        });
        setIsModalOpen(true);
    };

    // Drag and Drop Logic
    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId as TaskStatus;
        const task = tasks.find(t => t.id === draggableId);

        if (task && task.status !== newStatus) {
            const previousTasks = [...tasks];
            const updatedTask = { ...task, status: newStatus };

            // Optimistic Update
            setTasks(prev => prev.map(t => t.id === draggableId ? updatedTask : t));

            try {
                await AuthService.saveTask(updatedTask);
            } catch (error) {
                console.error("Failed to update task status:", error);
                toast.error("Failed to move task. Reverting...");
                setTasks(previousTasks); // Rollback
            }
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [fetchedUsers, fetchedClients, fetchedTemplates] = await Promise.all([
                AuthService.getAllUsers(),
                AuthService.getAllClients(),
                TemplateService.getAllTemplates()
            ]);

            // Initial Page Load
            const { tasks: initialTasks, lastVisible: last } = await AuthService.getPaginatedTasks(undefined, 20); // Page size 20

            setTasks(initialTasks);
            setLastVisible(last);
            setHasMore(!!last);

            setUsersList(fetchedUsers);
            setClientsList(fetchedClients);
            setTemplates(fetchedTemplates);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const loadMoreTasks = async () => {
        if (!lastVisible || isMoreLoading) return;
        setIsMoreLoading(true);
        try {
            const { tasks: nextTasks, lastVisible: nextLast } = await AuthService.getPaginatedTasks(lastVisible, 20);

            setTasks(prev => [...prev, ...nextTasks]);
            setLastVisible(nextLast);
            setHasMore(!!nextLast);
        } catch (error) {
            console.error("Failed to load more tasks", error);
            toast.error("Failed to load more tasks");
        } finally {
            setIsMoreLoading(false);
        }
    };


    const getPriorityStyle = (p: TaskPriority) => {
        switch (p) {
            case TaskPriority.URGENT: return 'bg-red-500/10 text-red-400 border-red-500/20';
            case TaskPriority.HIGH: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case TaskPriority.MEDIUM: return 'bg-brand-500/10 text-brand-400 border-brand-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    const canEditTask = (task: Task | Partial<Task>) => {
        if (user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.MASTER_ADMIN) return true;
        if (task.assignedTo && user?.uid && task.assignedTo.includes(user.uid)) return true;
        return false;
    };



    // Specific permission for structure/critical fields
    const hasStructurePermission = canManageTask;
    const handleOpenEdit = (task: Task) => {
        setIsEditMode(true);
        setFormError('');
        setCurrentTask({ ...task });
        setIsModalOpen(true);
    };

    const handleDeleteTask = async (taskId: string) => {
        if (window.confirm("Are you sure you want to delete this task?")) {
            await AuthService.deleteTask(taskId);
            fetchData();
            setIsModalOpen(false);
        }
    };

    // Recursively removes undefined values from an object before sending to Firestore
    // Firestore rejects undefined values anywhere in the document tree
    const cleanForFirestore = (obj: any): any => {
        if (Array.isArray(obj)) {
            return obj.map(cleanForFirestore);
        }
        if (obj !== null && typeof obj === 'object') {
            return Object.entries(obj).reduce((acc, [key, value]) => {
                if (value !== undefined) {
                    acc[key] = cleanForFirestore(value);
                }
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

        if (isSaving) return; // Prevent duplicate submissions
        setIsSaving(true);

        try {
            // Support both clientIds array (new) and clientId (deprecated)
            const clientIds = currentTask.clientIds || (currentTask.clientId ? [currentTask.clientId] : []);
            const clientNames = clientIds
                .map(id => clientsList.find(c => c.id === id)?.name)
                .filter(Boolean);

            const rawTask: Task = {
                ...currentTask,
                id: currentTask.id || `t_${Date.now()}`,
                clientName: clientNames.length > 0 ? clientNames.join(', ') : 'Internal',
                createdAt: currentTask.createdAt || new Date().toISOString(),
                createdBy: currentTask.createdBy || user?.uid || 'system',
                assignedTo: currentTask.assignedTo || [],
                subtasks: currentTask.subtasks || [],
                teamLeaderId: currentTask.teamLeaderId || null
            } as Task;

            // Strip all undefined values before saving to Firestore
            const taskToSave: Task = cleanForFirestore(rawTask);

            await AuthService.saveTask(taskToSave);

            // Handle Mentions
            const originalTask = tasks.find(t => t.id === currentTask.id);
            const newDesc = taskToSave.description || '';
            const oldDesc = originalTask?.description || '';

            usersList.forEach(u => {
                // Simple case-sensitive match for "@DisplayName"
                // In a production app, we might want more robust matching or a mention picker
                const mention = `@${u.displayName}`;

                if (newDesc.includes(mention) && !oldDesc.includes(mention)) {
                    if (u.uid !== user?.uid) {
                        AuthService.createNotification({
                            userId: u.uid,
                            title: 'You were mentioned',
                            message: `${user?.displayName || 'Someone'} mentioned you in task: ${taskToSave.title}`,
                            type: 'INFO',
                            category: 'TASK',
                            link: '/tasks'
                        });
                    }
                }
            });

            toast.success(isEditMode ? "Task updated" : "Task created");
            fetchData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving task:', error);
            toast.error('Failed to save task');
        } finally {
            setIsSaving(false);
        }
    };



    const handleAddComment = (comment: TaskComment) => {
        const updatedComments = [...(currentTask.comments || []), comment];
        setCurrentTask(prev => ({ ...prev, comments: updatedComments }));

        // Use a background update for comments to feel snappy, but we should probably save properly
        // For now, we rely on the main "Save" button or we could auto-save.
        // Let's autosave just the comments to be safe if it's an existing task
        if (currentTask.id) {
            AuthService.updateTask(currentTask.id, { comments: updatedComments }).catch(err => {
                console.error("Failed to save comment", err);
                toast.error("Failed to save comment");
            });
        }
    };

    const [newSubtaskRequirement, setNewSubtaskRequirement] = useState('');

    const addSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const trimmedReq = newSubtaskRequirement.trim();
        const sub: SubTask = {
            id: 'st_' + Date.now(),
            title: newSubtaskTitle,
            // Only include minimumRequirement if it has a value — Firestore rejects undefined
            ...(trimmedReq ? { minimumRequirement: trimmedReq } : {}),
            isCompleted: false,
            createdBy: user?.displayName || 'User',
            createdAt: new Date().toISOString()
        };
        setCurrentTask(prev => ({ ...prev, subtasks: [...(prev.subtasks || []), sub] }));
        setNewSubtaskTitle('');
        setNewSubtaskRequirement('');
    };



    const toggleSubtask = (subId: string) => {
        if (!hasEditPermission) return;
        setCurrentTask(prev => ({
            ...prev,
            subtasks: prev.subtasks?.map(st => st.id === subId ? { ...st, isCompleted: !st.isCompleted } : st)
        }));
    };

    const deleteSubtask = (subId: string) => {
        setCurrentTask(prev => ({
            ...prev,
            subtasks: prev.subtasks?.filter(st => st.id !== subId)
        }));
    };

    const toggleAssignee = (uid: string) => {
        const current = currentTask.assignedTo || [];
        const updated = current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid];
        setCurrentTask({ ...currentTask, assignedTo: updated });
    };

    const KanbanBoard = () => {
        // Grouping Logic
        const getGroups = () => {
            if (groupBy === 'NONE') return [{ id: 'ALL', title: 'All Tasks', tasks: filteredTasks }];

            if (groupBy === 'AUDITOR') {
                const groups: { id: string, title: string, tasks: Task[], gradient: string }[] = [];
                const auditorTasks = new Map<string, Task[]>();

                filteredTasks.forEach(task => {
                    // Logic to find auditor remains the same
                    const client = clientsList.find(c => task.clientIds && task.clientIds.includes(c.id));
                    const auditor = client?.signingAuthority || 'Unassigned';

                    if (!auditorTasks.has(auditor)) {
                        auditorTasks.set(auditor, []);
                    }
                    auditorTasks.get(auditor)!.push(task);
                });

                const gradients = [
                    'from-blue-500/20 to-cyan-500/5',
                    'from-purple-500/20 to-pink-500/5',
                    'from-emerald-500/20 to-teal-500/5',
                    'from-amber-500/20 to-orange-500/5',
                    'from-rose-500/20 to-red-500/5',
                    'from-indigo-500/20 to-violet-500/5'
                ];

                Array.from(auditorTasks.keys()).sort().forEach((auditor, index) => {
                    groups.push({
                        id: auditor,
                        title: auditor,
                        tasks: auditorTasks.get(auditor)!,
                        gradient: gradients[index % gradients.length]
                    });
                });
                return groups;
            }

            if (groupBy === 'ASSIGNEE') {
                const groups: { id: string, title: string, tasks: Task[] }[] = [];
                const allAssignees = new Set<string>();
                filteredTasks.forEach(t => t.assignedTo.forEach(uid => allAssignees.add(uid)));

                // Unassigned
                const unassignedTasks = filteredTasks.filter(t => t.assignedTo.length === 0);
                if (unassignedTasks.length > 0) {
                    groups.push({ id: 'UNASSIGNED', title: 'Unassigned', tasks: unassignedTasks });
                }

                Array.from(allAssignees).forEach(uid => {
                    const user = usersList.find(u => u.uid === uid);
                    groups.push({
                        id: uid,
                        title: user ? user.displayName : 'Unknown User',
                        tasks: filteredTasks.filter(t => t.assignedTo.includes(uid))
                    });
                });
                return groups;
            }
            return [];
        };

        const groups = getGroups();

        const toggleColumnCollapse = (status: TaskStatus) => {
            setCollapsedColumns(prev =>
                prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
            );
        };

        return (
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex flex-col space-y-8 pb-8 h-full overflow-y-auto custom-scrollbar">
                    {groups.map(group => (
                        <div key={group.id} className={`animate-in fade-in duration-500 shrink-0 ${groupBy === 'AUDITOR' ? 'bg-gradient-to-b ' + (group as any).gradient + ' rounded-3xl p-4 border border-white/5' : ''}`}>
                            {groupBy !== 'NONE' && (
                                <div className="flex items-center gap-3 mb-6 px-2 sticky left-0">
                                    {groupBy === 'AUDITOR' ? (
                                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md shadow-sm">
                                            <Sparkles className="text-amber-400" size={20} />
                                        </div>
                                    ) : (
                                        <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md shadow-sm">
                                            <UserCircle2 className="text-purple-400" size={20} />
                                        </div>
                                    )}
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-wide font-heading">{group.title}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-white/10 text-[10px] font-bold px-2 py-0.5 rounded-full text-gray-300 border border-white/5">{group.tasks.length} Tasks</span>
                                        </div>
                                    </div>
                                    <div className="h-px bg-gradient-to-r from-white/20 to-transparent flex-1 ml-6"></div>
                                </div>
                            )}

                            <div className="flex overflow-x-auto pb-4 gap-6 px-1 min-w-full items-start">
                                {[
                                    TaskStatus.HALTED,
                                    TaskStatus.NOT_STARTED,
                                    TaskStatus.IN_PROGRESS,
                                    TaskStatus.UNDER_REVIEW,
                                    TaskStatus.COMPLETED
                                ].map(status => {
                                    const isCollapsed = collapsedColumns.includes(status);
                                    const columnTasks = groupBy === 'NONE'
                                        ? filteredTasks.filter(t => t.status === status)
                                        : group.tasks.filter(t => t.status === status);

                                    // Premium Column Styling
                                    const statusConfig = {
                                        [TaskStatus.NOT_STARTED]: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20', gradient: 'from-gray-500/20 to-gray-600/5' },
                                        [TaskStatus.IN_PROGRESS]: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', gradient: 'from-blue-500/20 to-cyan-500/5' },
                                        [TaskStatus.UNDER_REVIEW]: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', gradient: 'from-amber-500/20 to-orange-500/5' },
                                        [TaskStatus.HALTED]: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', gradient: 'from-red-500/20 to-rose-500/5' },
                                        [TaskStatus.COMPLETED]: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', gradient: 'from-emerald-500/20 to-teal-500/5' }
                                    };
                                    const config = statusConfig[status];

                                    return (
                                        <Droppable key={`${group.id}-${status}`} droppableId={status} type="TASK">
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={`transition-all duration-300 flex flex-col rounded-3xl shrink-0 ${isCollapsed ? 'w-14 items-center bg-white/5' : 'w-80'} ${snapshot.isDraggingOver ? 'bg-white/10 ring-2 ring-white/10' : ''}`}
                                                >
                                                    {/* Column Header */}
                                                    <div
                                                        className={`relative flex items-center mb-4 overflow-hidden rounded-2xl transition-all duration-300 group/header
                                                            ${isCollapsed ? 'w-10 h-[400px] flex-col py-4 gap-4 bg-white/5' : 'w-full p-4 bg-gradient-to-br ' + config.gradient + ' border border-white/5'}
                                                        `}
                                                        onClick={(e) => { e.stopPropagation(); toggleColumnCollapse(status); }}
                                                    >
                                                        {/* Abstract Background Shapes */}
                                                        {!isCollapsed && (
                                                            <>
                                                                <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover/header:bg-white/20 transition-all"></div>
                                                                <div className="absolute -left-4 -bottom-4 w-12 h-12 bg-black/10 rounded-full blur-lg"></div>
                                                            </>
                                                        )}

                                                        <div className={`relative z-10 flex items-center gap-3 ${isCollapsed ? 'flex-col' : 'justify-between w-full'}`}>
                                                            <div className={`flex items-center gap-2 ${isCollapsed ? 'flex-col' : ''}`}>
                                                                <div className={`w-2.5 h-2.5 rounded-full shadow-lg shadow-current ${status === TaskStatus.COMPLETED ? 'bg-emerald-400 text-emerald-500' :
                                                                    status === TaskStatus.IN_PROGRESS ? 'bg-blue-400 text-blue-500' :
                                                                        status === TaskStatus.UNDER_REVIEW ? 'bg-amber-400 text-amber-500' :
                                                                            status === TaskStatus.HALTED ? 'bg-red-400 text-red-500' :
                                                                                'bg-gray-400 text-gray-500'
                                                                    }`} />

                                                                {isCollapsed ? (
                                                                    <div className="rotate-90 origin-center whitespace-nowrap text-[10px] font-black text-gray-400 uppercase tracking-widest mt-8">
                                                                        {status.replace('_', ' ')}
                                                                    </div>
                                                                ) : (
                                                                    <h3 className="font-extrabold text-white text-xs uppercase tracking-widest">{status.replace('_', ' ')}</h3>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm border ${isCollapsed ? 'mt-2' : ''} ${config.bg} ${config.color} ${config.border}`}>
                                                                    {columnTasks.length}
                                                                </span>
                                                                {!isCollapsed && (
                                                                    <button className="p-1 hover:bg-white/20 rounded-lg text-white/50 hover:text-white transition-colors">
                                                                        <ChevronDown size={14} className={isCollapsed ? "-rotate-90" : ""} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {!isCollapsed && (
                                                        <div className="space-y-3 overflow-y-auto px-1 pb-4 custom-scrollbar flex-1 min-h-[50vh] max-h-[70vh]">
                                                            {columnTasks.map((task, idx) => {
                                                                const completedSub = task.subtasks?.filter(s => s.isCompleted).length || 0;
                                                                const totalSub = task.subtasks?.length || 0;
                                                                const subtaskProgress = totalSub > 0 ? (completedSub / totalSub) * 100 : 0;
                                                                const progressColor = subtaskProgress === 100 ? 'bg-emerald-500' : 'bg-brand-500';

                                                                return (
                                                                    <Draggable key={task.id} draggableId={task.id} index={idx}>
                                                                        {(provided, snapshot) => (
                                                                            <div
                                                                                ref={provided.innerRef}
                                                                                {...provided.draggableProps}
                                                                                {...provided.dragHandleProps}
                                                                                onClick={() => handleOpenEdit(task)}
                                                                                className={`glass-panel p-0 rounded-2xl group relative overflow-hidden transition-all duration-300 border border-white/5 hover:border-white/20 hover:shadow-xl active:scale-[0.98] cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl ring-2 ring-brand-500/50 z-50 bg-navy-800' : 'bg-navy-900/40'}`}
                                                                            >
                                                                                {/* Card Main Content */}
                                                                                <div className="p-4 relative">
                                                                                    {/* Fluid Gradient Background Effect on Hover */}
                                                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                                                                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                                                                        <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wide border shadow-sm ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                                                                                        {task.dueDate && (
                                                                                            <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded-md border border-white/5">
                                                                                                <Calendar size={10} className={
                                                                                                    new Date(task.dueDate) < new Date() ? "text-red-400" : "text-brand-400"
                                                                                                } />
                                                                                                <span className={new Date(task.dueDate) < new Date() ? "text-red-300" : ""}>{task.dueDate}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    <h4 className="font-bold text-gray-100 text-sm mb-3 leading-snug group-hover:text-brand-200 transition-colors line-clamp-2 pr-2">{task.title}</h4>

                                                                                    <div className="flex items-center text-xs text-gray-400 mb-4 bg-white/5 p-2 rounded-lg border border-white/5">
                                                                                        <Briefcase size={12} className="mr-2 text-brand-400 shrink-0" />
                                                                                        <span className="truncate font-medium">{task.clientName || 'Internal'}</span>
                                                                                    </div>

                                                                                    {totalSub > 0 && (
                                                                                        <div className="mb-4">
                                                                                            <div className="flex justify-between text-[9px] font-bold text-gray-500 mb-1">
                                                                                                <span>Progress</span>
                                                                                                <span>{Math.round(subtaskProgress)}%</span>
                                                                                            </div>
                                                                                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                                                                                                <div className={`h-full rounded-full ${progressColor} transition-all duration-700 shadow-[0_0_10px_rgba(59,130,246,0.5)]`} style={{ width: `${subtaskProgress}%` }}></div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )}

                                                                                    <div className="pt-3 border-t border-white/5 flex justify-between items-center relative z-10">
                                                                                        <div className="flex -space-x-2 hovered:space-x-1 transition-all">
                                                                                            {task.assignedTo.slice(0, 3).map((uid, i) => {
                                                                                                const u = usersList.find(user => user.uid === uid);
                                                                                                return (
                                                                                                    <div
                                                                                                        key={i}
                                                                                                        title={u?.displayName}
                                                                                                        className="w-6 h-6 rounded-full bg-navy-800 border-2 border-navy-900 flex items-center justify-center text-[9px] font-bold text-white shadow-md transition-transform hover:scale-110 hover:z-20"
                                                                                                    >
                                                                                                        {getInitials(u?.displayName)}
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                            {task.assignedTo.length > 3 && (
                                                                                                <div className="w-6 h-6 rounded-full bg-navy-800 border-2 border-navy-900 flex items-center justify-center text-[9px] font-bold text-gray-400 shadow-md">
                                                                                                    +{task.assignedTo.length - 3}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>

                                                                                        <button className="text-[10px] text-gray-500 font-bold group-hover:text-brand-400 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 duration-300">
                                                                                            OPEN <ChevronDown size={10} className="-rotate-90" />
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                );
                                                            })}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Droppable>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </DragDropContext>
        );
    };

    const toggleTaskSelection = (taskId: string) => {
        setSelectedTaskIds(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedTaskIds.length === filteredTasks.length) {
            setSelectedTaskIds([]);
        } else {
            setSelectedTaskIds(filteredTasks.map(t => t.id).filter(Boolean) as string[]);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedTaskIds.length} tasks?`)) return;

        try {
            await Promise.all(selectedTaskIds.map(id => AuthService.deleteTask(id)));
            toast.success(`${selectedTaskIds.length} tasks deleted successfully`);
            setSelectedTaskIds([]);
            fetchData();
        } catch (error) {
            console.error('Bulk delete failed:', error);
            toast.error('Failed to delete some tasks');
        }
    };

    const handleBulkStatusUpdate = async (newStatus: TaskStatus) => {
        try {
            await Promise.all(selectedTaskIds.map(id => AuthService.updateTask(id, { status: newStatus })));
            toast.success(`${selectedTaskIds.length} tasks updated to ${newStatus.replace('_', ' ')}`);
            setSelectedTaskIds([]);
            fetchData();
        } catch (error) {
            console.error('Bulk update failed:', error);
            toast.error('Failed to update tasks');
        }
    };

    const handleExport = async (type: 'pdf' | 'excel') => {
        const dataToExport = filteredTasks;
        const dateStr = new Date().toISOString().split('T')[0];

        if (type === 'pdf') {
            const doc = new jsPDF();

            // ── Header Banner ──────────────────────────────────────────────
            doc.setFillColor(15, 23, 42); // Navy 900
            doc.rect(0, 0, 210, 48, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('R. Sapkota & Associates', 105, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184); // Slate 400
            doc.text('Chartered Accountants  |  Kathmandu, Nepal', 105, 23, { align: 'center' });

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Task Status Report', 105, 34, { align: 'center' });

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(148, 163, 184);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 105, 42, { align: 'center' });

            // ── Generated timestamp footer ────────────────────────────────
            const pageCount = (doc as any).internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(100);

            const tableColumn = ["Client", "Task Name", "Auditor", "Assignee", "Status", "Due Date"];
            const tableRows = dataToExport.map(task => {
                const client = clientsList.find(c => c.name === task.clientName || (task.clientIds && task.clientIds.includes(c.id)));
                return [
                    task.clientName || 'Internal',
                    task.title,
                    client?.signingAuthority || '-',
                    task.assignedTo.map(uid => usersList.find(u => u.uid === uid)?.displayName || '').join(', '),
                    task.status.replace('_', ' '),
                    task.dueDate
                ];
            });

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 55,
                theme: 'grid',
                styles: { fontSize: 9, cellPadding: 4, lineColor: [226, 232, 240] },
                headStyles: {
                    fillColor: [30, 41, 59], // Slate 800
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 35 }, // Client
                    1: { cellWidth: 50 }, // Task Name
                }
            });

            // Footer
            const finalPageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= finalPageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('R. Sapkota & Associates — Confidential', 14, doc.internal.pageSize.height - 10);
                doc.text(`Page ${i} of ${finalPageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
            }

            doc.save(`RSA_Tasks_${dateStr}.pdf`);
            toast.success('PDF exported successfully');
        } else {
            // Excel Export using ExcelJS for styling
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'R. Sapkota & Associates';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('Tasks', {
                pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
            });

            // ── Company Header Block ────────────────────────────────────────
            sheet.mergeCells('A1:H1');
            const titleCell = sheet.getCell('A1');
            titleCell.value = 'R. Sapkota & Associates';
            titleCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Navy 900
            sheet.getRow(1).height = 32;

            sheet.mergeCells('A2:H2');
            const addrCell = sheet.getCell('A2');
            addrCell.value = 'Chartered Accountants  |  Kathmandu, Nepal';
            addrCell.font = { name: 'Calibri', size: 10, color: { argb: 'FF94A3B8' } };
            addrCell.alignment = { horizontal: 'center', vertical: 'middle' };
            addrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            sheet.getRow(2).height = 18;

            sheet.mergeCells('A3:H3');
            const reportTitleCell = sheet.getCell('A3');
            reportTitleCell.value = 'Task Status Report';
            reportTitleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
            reportTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            reportTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            sheet.getRow(3).height = 24;

            sheet.mergeCells('A4:H4');
            const metaCell = sheet.getCell('A4');
            metaCell.value = `Generated: ${new Date().toLocaleString()}`;
            metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
            metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
            metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            sheet.getRow(4).height = 18;

            // Spacer
            sheet.getRow(5).height = 8;

            // ── Columns ─────────────────────────────────────────────────────
            const COLS = [
                { header: 'Client', key: 'client', width: 25 },
                { header: 'Task Name', key: 'title', width: 40 },
                { header: 'Auditor', key: 'auditor', width: 20 },
                { header: 'Assigned To', key: 'assigned', width: 25 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Due Date', key: 'due', width: 12 },
                { header: 'Est. Days', key: 'est', width: 10 },
                { header: 'Description', key: 'desc', width: 40 },
            ];

            // Fix: Do NOT assign sheet.columns = COLS as it overwrites Row 1 with headers
            // Instead, manualy set column properties
            COLS.forEach((col, i) => {
                const column = sheet.getColumn(i + 1);
                column.key = col.key;
                column.width = col.width;
            });

            // Header Row Styling
            const headerRow = sheet.getRow(6);
            COLS.forEach((col, i) => {
                const cell = headerRow.getCell(i + 1);
                cell.value = col.header;
                cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { bottom: { style: 'medium', color: { argb: 'FF64748B' } } };
            });
            headerRow.height = 24;

            // ── Data Rows ───────────────────────────────────────────────────
            const statusColors: Record<string, string> = {
                'IN_PROGRESS': 'FFDBEAFE', // Blue 100
                'COMPLETED': 'FFDCFCE7', // Emerald 100
                'NOT_STARTED': 'FFF1F5F9', // Slate 100
                'UNDER_REVIEW': 'FFFEF3C7', // Amber 100
            };

            dataToExport.forEach((task, idx) => {
                const client = clientsList.find(c => c.name === task.clientName || (task.clientIds && task.clientIds.includes(c.id)));

                const row = sheet.addRow({
                    client: task.clientName || 'Internal',
                    title: task.title,
                    auditor: client?.signingAuthority || '-',
                    assigned: task.assignedTo.map(uid => usersList.find(u => u.uid === uid)?.displayName || 'Unknown').join(', '),
                    status: task.status.replace('_', ' '),
                    due: task.dueDate,
                    est: task.estimatedDays || '',
                    desc: task.description || ''
                });

                const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'; // Zebra striping

                row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                    cell.font = { name: 'Calibri', size: 10 };
                    cell.alignment = { vertical: 'top', wrapText: true };
                    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };

                    // Apply zebra background
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                });

                // Status Pill-like coloring
                const statusCell = row.getCell(5);
                statusCell.font = { name: 'Calibri', size: 10, bold: true };
                statusCell.alignment = { horizontal: 'center', vertical: 'top' };
                statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[task.status] || rowBg } };
            });

            // Freeze panes
            sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 6, activeCell: 'A7' }];

            // Write File
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RSA_Tasks_${dateStr}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Excel exported successfully');
        }
    };

    const ListView = () => (
        <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in-up relative border border-white/10 shadow-xl mx-1 flex flex-col h-full">
            {/* Floating Bulk Action Bar */}
            {selectedTaskIds.length > 0 && (
                <div className="absolute top-0 left-0 w-full bg-brand-600/95 backdrop-blur-md z-20 p-3 px-6 flex justify-between items-center shadow-lg animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center space-x-4">
                        <span className="text-white font-bold text-sm bg-white/20 px-3 py-1 rounded-full">{selectedTaskIds.length} selected</span>
                        <button onClick={() => setSelectedTaskIds([])} className="text-xs text-white/80 hover:text-white underline decoration-white/30 hover:decoration-white transition-all">Clear selection</button>
                    </div>
                    <div className="flex items-center space-x-3">
                        <select
                            className="bg-black/20 text-xs text-white border border-white/10 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-white/50 cursor-pointer font-medium"
                            onChange={(e) => {
                                if (e.target.value) handleBulkStatusUpdate(e.target.value as TaskStatus);
                                e.target.value = ''; // Reset select
                            }}
                        >
                            <option value="" className="bg-navy-900">Change Status...</option>
                            {Object.values(TaskStatus).map(s => <option key={s} value={s} className="bg-navy-900 text-white">{s.replace('_', ' ')}</option>)}
                        </select>
                        {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center px-4 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-white text-xs font-bold rounded-lg border border-red-500/30 transition-all shadow-sm"
                            >
                                <Trash2 size={12} className="mr-1.5" /> Delete
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-sm text-gray-300">
                    <thead>
                        <tr className="bg-navy-900/40 text-gray-400 uppercase tracking-wider text-xs border-b border-white/5">
                            <th className="px-6 py-4 w-12 text-center">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-600 bg-navy-800 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                                    checked={filteredTasks.length > 0 && selectedTaskIds.length === filteredTasks.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4 font-heading font-bold text-gray-300">Task Name</th>
                            <th className="px-6 py-4 font-heading font-bold text-gray-300">Client</th>
                            <th className="px-6 py-4 font-heading font-bold text-gray-300">Signee</th>
                            <th className="px-6 py-4 font-heading font-bold text-gray-300">Assigned</th>
                            <th className="px-6 py-4 font-heading font-bold text-gray-300">Due Date</th>
                            <th className="px-6 py-4 font-heading font-bold text-gray-300">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredTasks.map((task, index) => (
                            <tr
                                key={task.id}
                                className={`group hover:bg-white/5 transition-all cursor-pointer ${selectedTaskIds.includes(task.id!) ? 'bg-brand-500/10 hover:bg-brand-500/20' : index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}`}
                            >
                                <td className="px-3 py-2 text-center">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-600 bg-navy-800 text-brand-500 focus:ring-brand-500/50 cursor-pointer"
                                        checked={selectedTaskIds.includes(task.id!)}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            toggleTaskSelection(task.id!);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td className="px-3 py-2" onClick={() => handleOpenEdit(task)}>
                                    <div className="font-bold text-white group-hover:text-brand-300 transition-colors text-[13px] mb-0.5">{task.title}</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[8px] px-1 py-0.5 rounded border ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                                        {task.subtasks && task.subtasks.length > 0 && (
                                            <span className="text-[9px] text-gray-500 flex items-center gap-1">
                                                <CheckSquare size={10} /> {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2" onClick={() => handleOpenEdit(task)}>
                                    <div className="flex items-center text-brand-200 font-medium text-[12px]">
                                        <Briefcase size={12} className="mr-1.5 opacity-50" />
                                        {task.clientName}
                                    </div>
                                </td>
                                <td className="px-3 py-2" onClick={() => handleOpenEdit(task)}>
                                    {(() => {
                                        const taskClient = clientsList.find(c => (task.clientIds && task.clientIds.includes(c.id)) || c.name === task.clientName);
                                        return taskClient?.signingAuthority ? (
                                            <div className="flex items-center gap-1.5 text-amber-200/90 bg-amber-500/10 px-1.5 py-0.5 rounded w-fit text-[11px] font-medium border border-amber-500/10">
                                                <Sparkles size={12} className="text-amber-400" />
                                                {taskClient.signingAuthority}
                                            </div>
                                        ) : <span className="text-gray-600">-</span>;
                                    })()}
                                </td>
                                <td className="px-3 py-2" onClick={() => handleOpenEdit(task)}>
                                    <div className="flex -space-x-1.5">
                                        {task.assignedTo.length === 0 ? (
                                            <span className="text-[11px] text-gray-500 italic">Unassigned</span>
                                        ) : (
                                            task.assignedTo.slice(0, 4).map((uid, i) => {
                                                const u = usersList.find(user => user.uid === uid);
                                                return (
                                                    <div
                                                        key={i}
                                                        title={u?.displayName}
                                                        className="w-6 h-6 rounded-full bg-navy-800 border border-navy-900 flex items-center justify-center text-[8px] font-bold text-white relative shadow-sm"
                                                    >
                                                        {getInitials(u?.displayName || '?')}
                                                    </div>
                                                );
                                            })
                                        )}
                                        {task.assignedTo.length > 4 && (
                                            <div className="w-6 h-6 rounded-full bg-navy-700 border border-navy-900 flex items-center justify-center text-[8px] font-bold text-gray-300">
                                                +{task.assignedTo.length - 4}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2" onClick={() => handleOpenEdit(task)}>
                                    <div className="flex items-center text-gray-400 bg-white/5 px-1.5 py-0.5 rounded-lg w-fit border border-white/5">
                                        <Calendar size={12} className="mr-1.5 text-brand-400" />
                                        <span className="font-mono text-[11px]">{task.dueDate}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2" onClick={() => handleOpenEdit(task)}>
                                    <span className={`px-2 py-0.5 rounded-full border text-[9px] uppercase font-bold tracking-wide flex items-center w-fit gap-1.5 ${task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                        task.status === TaskStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                            task.status === TaskStatus.NOT_STARTED ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                                                'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                        }`}>
                                        <div className={`w-1 h-1 rounded-full ${task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                                            task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' :
                                                task.status === TaskStatus.NOT_STARTED ? 'bg-gray-500' :
                                                    'bg-amber-500'
                                            }`}></div>
                                        {task.status.replace('_', ' ')}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Load More Button */}
                {hasMore && (
                    <div className="p-6 flex justify-center border-t border-white/5 bg-navy-900/30">
                        <button
                            onClick={loadMoreTasks}
                            disabled={isMoreLoading}
                            className="flex items-center space-x-2 px-6 py-3 bg-navy-800 hover:bg-navy-700 text-brand-300 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-brand-500/20 hover:border-brand-500/40 shadow-lg"
                        >
                            {isMoreLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Loading more tasks...</span>
                                </>
                            ) : (
                                <>
                                    <span>Load More Tasks</span>
                                    <ChevronDown size={16} />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );



    const handleClientChange = (clientId: string) => {
        const selectedClient = clientsList.find(c => c.id === clientId);
        if (!selectedClient) return;

        let newTaskState = {
            ...currentTask,
            clientIds: [clientId],
            clientName: selectedClient.name
        };

        // Auto-Apply Logic
        if (templates.length > 0) {
            const matchingTemplate = templates.find(t =>
                (t.autoApplyRules?.industryType && t.autoApplyRules.industryType === selectedClient.industry) ||
                (t.autoApplyRules?.serviceType && t.autoApplyRules.serviceType === selectedClient.serviceType)
            );

            if (matchingTemplate) {
                const updatedSubtasks = matchingTemplate.subtaskDetails?.map(detail => ({
                    id: `st_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    title: detail.title,
                    minimumRequirement: detail.minimumRequirement,
                    isCompleted: false,
                    createdBy: 'System (Auto-Apply)',
                    createdAt: new Date().toISOString()
                })) || [];

                newTaskState = {
                    ...newTaskState,
                    title: newTaskState.title || matchingTemplate.name,
                    description: newTaskState.description || matchingTemplate.description,
                    priority: matchingTemplate.priority,
                    subtasks: [...(newTaskState.subtasks || []), ...updatedSubtasks]
                };
                toast.success(`Auto-applied template: ${matchingTemplate.name}`);
            }
        }

        setCurrentTask(newTaskState);
    };

    const hasEditPermission = canEditTask(currentTask);

    return (
        <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">


            {/* 2-Row Layout: Header + Toolbar */}
            <div className="flex flex-col gap-3">

                {/* Row 1: Title, View Toggles & Key Filters */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                        <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center">
                            <LayoutGrid className="mr-2.5 text-brand-400" size={24} /> Task Board
                        </h1>
                        <p className="text-gray-400 text-xs font-medium mt-0.5 ml-8">Manage, track, and collaborate on audit tasks.</p>
                    </div>

                    <div className="flex items-center gap-3 bg-navy-900/50 p-1.5 rounded-xl border border-white/10 backdrop-blur-md shadow-lg">
                        {/* View Switcher */}
                        <div className="flex bg-black/20 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('KANBAN')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${viewMode === 'KANBAN' ? 'bg-white text-navy-900 shadow-xl scale-105' : 'text-gray-400 hover:text-white'}`}
                            >
                                <LayoutGrid size={12} /> Board
                            </button>
                            <button
                                onClick={() => setViewMode('LIST')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${viewMode === 'LIST' ? 'bg-white text-navy-900 shadow-xl scale-105' : 'text-gray-400 hover:text-white'}`}
                            >
                                <ListIcon size={12} /> List
                            </button>
                        </div>

                        <div className="w-px h-5 bg-white/10"></div>

                        {/* Firm/Mine Switcher */}
                        <div className="flex bg-black/20 p-1 rounded-lg">
                            <button
                                onClick={() => setBoardMode('ALL')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${boardMode === 'ALL' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Briefcase size={12} /> Firm
                            </button>
                            <button
                                onClick={() => setBoardMode('MY')}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${boardMode === 'MY' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <UserCircle2 size={12} /> Mine
                            </button>
                        </div>
                    </div>
                </div>

                {/* Row 2: Deep Filters & Actions */}
                <div className="glass-panel p-3 rounded-xl border border-white/5 shadow-xl flex flex-col xl:flex-row gap-3 justify-between items-center relative overflow-hidden">
                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 w-48 h-full bg-gradient-to-l from-brand-900/10 to-transparent pointer-events-none"></div>

                    <div className="flex flex-col lg:flex-row items-center gap-2.5 w-full xl:w-auto overflow-x-auto no-scrollbar pb-1.5 lg:pb-0">
                        {/* Search */}
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-brand-400 transition-colors" size={14} />
                            <input
                                type="text"
                                placeholder="Search tasks & clients..."
                                className="bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-[13px] text-white focus:ring-2 focus:ring-brand-500/50 outline-none w-full md:w-60 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Filters Group */}
                        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/5">
                            {/* Group By */}
                            <div className="relative">
                                <LayoutGrid size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-purple-400" />
                                <select
                                    className="bg-transparent border-none outline-none text-[11px] font-bold text-gray-300 pl-7 pr-1.5 py-1 cursor-pointer uppercase tracking-tight hover:text-white transition-colors"
                                    value={groupBy}
                                    onChange={(e) => setGroupBy(e.target.value as any)}
                                >
                                    <option value="NONE" className="bg-navy-900">No Grouping</option>
                                    <option value="AUDITOR" className="bg-navy-900">By Auditor</option>
                                    <option value="ASSIGNEE" className="bg-navy-900">By Assignee</option>
                                </select>
                            </div>

                            <div className="w-px h-3 bg-white/10"></div>

                            {/* Staff Filter */}
                            <div className="relative">
                                <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400" />
                                <select
                                    className="bg-transparent border-none outline-none text-[11px] font-bold text-gray-300 pl-7 pr-1.5 py-1 cursor-pointer uppercase tracking-tight hover:text-white transition-colors max-w-[120px]"
                                    value={filterStaff}
                                    onChange={(e) => setFilterStaff(e.target.value)}
                                >
                                    <option value="ALL" className="bg-navy-900">All Staff</option>
                                    {usersList.map((u) => <option key={u.uid} value={u.uid} className="bg-navy-900">{u.displayName}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Compliance Toggles */}
                        <div className="flex gap-1">
                            <button
                                onClick={() => setFilterVat(!filterVat)}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all border ${filterVat ? 'bg-brand-500 text-white border-brand-400 shadow-lg shadow-brand-500/20' : 'bg-white/5 text-gray-500 border-transparent hover:bg-white/10'}`}
                            >
                                VAT
                            </button>
                            <button
                                onClick={() => setFilterItr(!filterItr)}
                                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-wider transition-all border ${filterItr ? 'bg-purple-500 text-white border-purple-400 shadow-lg shadow-purple-500/20' : 'bg-white/5 text-gray-500 border-transparent hover:bg-white/10'}`}
                            >
                                ITR
                            </button>
                        </div>
                    </div>

                    {/* Actions Group */}
                    <div className="flex items-center gap-2.5 w-full xl:w-auto justify-end">
                        {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => handleExport('pdf')}
                                    className="p-2 rounded-lg text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all hover:scale-105 active:scale-95"
                                    title="Export PDF"
                                >
                                    <FileText size={16} />
                                </button>
                                <button
                                    onClick={() => handleExport('excel')}
                                    className="p-2 rounded-lg text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                                    title="Export Excel"
                                >
                                    <FileSpreadsheet size={16} />
                                </button>
                            </div>
                        )}

                        {canAccessTemplates && (
                            <button
                                onClick={() => setIsTemplateModalOpen(true)}
                                className="flex items-center gap-2 bg-navy-800 hover:bg-navy-700 text-white border border-white/10 rounded-lg px-3 py-2 transition-all shadow-lg hover:shadow-xl"
                            >
                                <Sparkles size={14} className="text-amber-400" />
                                <span className="text-[11px] font-bold hidden sm:inline">Templates</span>
                            </button>
                        )}

                        {canCreateTask && (
                            <button
                                onClick={handleOpenCreate}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-blue-500/30 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus size={14} strokeWidth={3} /> New Task
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {viewMode === 'KANBAN' ? <KanbanBoard /> : <ListView />}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10 text-gray-100">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white font-heading">{isEditMode ? 'Edit Task' : 'Create New Task'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-transform hover:rotate-90"><X size={20} /></button>
                        </div>

                        {formError && (
                            <div className="bg-red-500/20 text-red-200 px-6 py-2 text-sm border-b border-red-500/20 flex items-center">
                                <AlertCircle size={16} className="mr-2" /> {formError}
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                {/* Client Selection - Removed temporarily */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center">
                                        <Briefcase size={16} className="mr-2 text-brand-400" />
                                        Client(s)
                                    </label>
                                    <ClientSelect
                                        clients={clientsList}
                                        value={currentTask.clientIds?.[0] || ''}
                                        onChange={(val) => handleClientChange(val as string)}
                                        multi={false}
                                        placeholder="Select Client..."
                                        disabled={!hasStructurePermission}
                                    />
                                </div>

                                {/* Task Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Task Title <span className="text-red-400">*</span></label>
                                    <input className="w-full glass-input font-bold text-lg" value={currentTask.title} onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })} disabled={!hasStructurePermission} />
                                </div>

                                {/* Due Date, Priority & Estimated Hours Row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Due Date <span className="text-red-400">*</span></label>
                                        <input
                                            type="date"
                                            className="w-full glass-input"
                                            value={currentTask.dueDate}
                                            onChange={(e) => setCurrentTask({ ...currentTask, dueDate: e.target.value })}
                                            disabled={!hasStructurePermission}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                                        <select className="w-full glass-input" value={currentTask.priority} onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value as TaskPriority })} disabled={!hasStructurePermission}>
                                            {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Est. Days</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            className="w-full glass-input"
                                            placeholder="e.g. 2"
                                            value={currentTask.estimatedDays || ''}
                                            onChange={(e) => setCurrentTask({ ...currentTask, estimatedDays: parseFloat(e.target.value) })}
                                            disabled={!hasStructurePermission}
                                        />
                                    </div>
                                </div>

                                {/* Status Row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                                        <select className="w-full glass-input" value={currentTask.status} onChange={(e) => setCurrentTask({ ...currentTask, status: e.target.value as TaskStatus })} disabled={!hasEditPermission}>
                                            {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                        </select>
                                    </div>
                                    {/* Risk Level */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Risk Level</label>
                                        <select
                                            className={`w-full glass-input font-bold ${currentTask.riskLevel === 'HIGH' ? 'text-red-400 border-red-500/30' : ''}`}
                                            value={currentTask.riskLevel || 'LOW'}
                                            onChange={(e) => setCurrentTask({ ...currentTask, riskLevel: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                                            disabled={!hasStructurePermission}
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="MEDIUM">Medium</option>
                                            <option value="HIGH">High</option>
                                        </select>
                                    </div>
                                    {/* Team Leader Selection */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Team Leader</label>
                                        <select
                                            className="w-full glass-input"
                                            value={currentTask.teamLeaderId || ''}
                                            onChange={(e) => setCurrentTask({ ...currentTask, teamLeaderId: e.target.value })}
                                            disabled={!hasEditPermission}
                                        >
                                            <option value="">Select Team Leader...</option>
                                            {usersList
                                                .filter(u => currentTask.assignedTo?.includes(u.uid))
                                                .map(u => (
                                                    <option key={u.uid} value={u.uid}>{u.displayName}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                </div>

                                <div className="relative" ref={dropdownRef}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium text-gray-400">Assign Staff</label>
                                    </div>
                                    <StaffSelect
                                        users={usersList}
                                        value={currentTask.assignedTo || []}
                                        onChange={(val) => {
                                            const newAssigned = val as string[];
                                            // If removed user was team leader, clear team leader
                                            let newTeamLeader = currentTask.teamLeaderId;
                                            if (newTeamLeader && !newAssigned.includes(newTeamLeader)) {
                                                newTeamLeader = '';
                                            }
                                            setCurrentTask({ ...currentTask, assignedTo: newAssigned, teamLeaderId: newTeamLeader });
                                        }}
                                        multi={true}
                                        placeholder="Assign staff..."
                                        disabled={!hasStructurePermission}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                                    <textarea
                                        rows={4}
                                        className="w-full glass-input leading-relaxed"
                                        placeholder="Add details about this task..."
                                        value={currentTask.description}
                                        onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })}
                                        disabled={!hasEditPermission}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-gray-300">Subtasks</label>
                                    </div>
                                    <div className="space-y-2">
                                        {currentTask.subtasks?.map(st => (
                                            <div key={st.id} className="group flex flex-col space-y-1 bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-all border border-white/5 hover:border-white/10">
                                                <div className="flex items-start gap-3">
                                                    <button
                                                        onClick={() => toggleSubtask(st.id)}
                                                        disabled={!hasEditPermission}
                                                        className={`mt-0.5 shrink-0 ${st.isCompleted ? 'text-emerald-500' : 'text-gray-500 hover:text-brand-400'} ${!hasEditPermission ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-colors`}
                                                    >
                                                        {st.isCompleted ? <CheckCircle2 size={18} className="fill-emerald-500/20" /> : <div className="w-4 h-4 border-2 border-current rounded-md" />}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`text-sm block leading-snug ${st.isCompleted ? 'line-through text-gray-500' : 'text-gray-200'}`}>{st.title}</span>
                                                        {st.minimumRequirement && (
                                                            <div className="mt-1.5 flex items-center text-[11px] text-amber-400/90 bg-amber-400/10 w-fit px-2 py-0.5 rounded border border-amber-400/10">
                                                                <AlertCircle size={10} className="mr-1.5" />
                                                                <span className="font-medium">Req: {st.minimumRequirement}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {hasEditPermission && (
                                                        <button
                                                            onClick={() => deleteSubtask(st.id)}
                                                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1 rounded hover:bg-white/5"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {hasEditPermission && (
                                        <div className="flex flex-col gap-2 mt-2 bg-black/20 p-3 rounded-xl border border-white/5">
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-gray-500"
                                                    placeholder="Add a new subtask..."
                                                    value={newSubtaskTitle}
                                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                                <div className="flex-1 relative">
                                                    <AlertCircle size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    <input
                                                        className="w-full bg-white/5 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white border border-transparent focus:border-brand-500/50 outline-none placeholder-gray-600"
                                                        placeholder="Requirement (Optional)"
                                                        value={newSubtaskRequirement}
                                                        onChange={(e) => setNewSubtaskRequirement(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                                                    />
                                                </div>
                                                <button
                                                    onClick={addSubtask}
                                                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                                    disabled={!newSubtaskTitle.trim()}
                                                >
                                                    Add Subtask
                                                </button>
                                            </div>
                                        </div>
                                    )}


                                </div>

                                {currentTask.id && (
                                    <div className="pt-4 border-t border-white/10">
                                        <TaskComments
                                            comments={currentTask.comments}
                                            users={usersList}
                                            onAddComment={async (comment) => {
                                                const updatedComments = [...(currentTask.comments || []), comment];
                                                setCurrentTask({ ...currentTask, comments: updatedComments });
                                                try {
                                                    await AuthService.addTaskComment(currentTask.id!, comment);
                                                } catch (err) {
                                                    console.error("Failed to add comment", err);
                                                    toast.error("Failed to save comment");
                                                }
                                            }}
                                            readOnly={false}
                                        />
                                    </div>
                                )}

                                <div className="px-6 py-4 border-t border-white/10 flex justify-between bg-white/5">
                                    {isEditMode && hasStructurePermission && (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                                        <button onClick={() => currentTask.id && handleDeleteTask(currentTask.id)} className="text-red-400 hover:text-red-300 text-sm flex items-center">
                                            <Trash2 size={16} className="mr-2" /> Delete
                                        </button>
                                    )}
                                    <div className="flex space-x-3 ml-auto">
                                        <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                                        {hasEditPermission && (
                                            <button
                                                onClick={handleSaveTask}
                                                disabled={isSaving}
                                                className={`btn-primary flex items-center px-6 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                                                {isSaving ? 'Saving...' : (isEditMode ? 'Update' : 'Create')}
                                            </button>
                                        )}
                                    </div>
                                </div>

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
        </div >
    );
};


export default TasksPage;
