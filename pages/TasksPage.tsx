
import React, { useState, useEffect, useRef } from 'react';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import {
    LayoutGrid, List as ListIcon, CheckSquare, UserCircle2, Briefcase, CheckCircle2, AlertCircle, ChevronDown, Check, Loader2, Save, Sparkles, Plus, Filter, Search, Calendar, Trash2, X
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask, TaskTemplate } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { TemplateService } from '../services/templates';
import { getCurrentDateUTC } from '../utils/dates';
import { SIGNING_AUTHORITIES } from '../constants/firmData';
import TaskTemplateModal from '../components/TaskTemplateModal';
import TemplateManager from '../components/TemplateManager';
import StaffSelect from '../components/StaffSelect';
import { TaskListSkeleton } from '../components/ui/LoadingSkeleton';
import ClientSelect from '../components/ClientSelect';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';

const TasksPage: React.FC = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('KANBAN');
    const [boardMode, setBoardMode] = useState<'ALL' | 'MY'>('ALL');
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

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

    const [filterPriority, setFilterPriority] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // New Filters
    const [filterSignee, setFilterSignee] = useState<string>('ALL');
    const [filterStaff, setFilterStaff] = useState<string>('ALL');
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

            if (filterSignee !== 'ALL') {
                if (filterSignee === 'Others') {
                    // Check if signingAuthority is meant to be in the 'Others' bucket (i.e. NOT in the main list)
                    // The main list excludes 'Others'
                    const mainAuthorities = SIGNING_AUTHORITIES.filter(s => s !== 'Others');
                    if (mainAuthorities.includes(taskClient.signingAuthority || '')) return false;
                } else {
                    if (taskClient.signingAuthority !== filterSignee) return false;
                }
            }
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
            clientIds: []
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
            clientIds: []
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

            const taskToSave: Task = {
                ...currentTask,
                id: currentTask.id || `t_${Date.now()}`,
                clientName: clientNames.length > 0 ? clientNames.join(', ') : 'Internal',
                createdAt: currentTask.createdAt || new Date().toISOString(),
                createdBy: currentTask.createdBy || user?.uid || 'system',
                assignedTo: currentTask.assignedTo || [],
                subtasks: currentTask.subtasks || []
            } as Task;

            await AuthService.saveTask(taskToSave);
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

    const [newSubtaskRequirement, setNewSubtaskRequirement] = useState('');

    const addSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const sub: SubTask = {
            id: 'st_' + Date.now(),
            title: newSubtaskTitle,
            minimumRequirement: newSubtaskRequirement.trim() || undefined,
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
        return (
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex space-x-6 overflow-x-auto pb-6 h-full custom-scrollbar items-start px-2">
                    {Object.values(TaskStatus).map(status => (
                        <Droppable key={status} droppableId={status}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={`flex-shrink-0 w-80 rounded-2xl p-4 transition-all border-2 flex flex-col max-h-full ${snapshot.isDraggingOver ? 'bg-white/5 border-brand-500/50 shadow-brand-500/20 shadow-lg' :
                                        status === TaskStatus.NOT_STARTED ? 'bg-white/5 border-white/5' :
                                            status === TaskStatus.IN_PROGRESS ? 'bg-blue-500/5 border-blue-500/10' :
                                                status === TaskStatus.HALTED ? 'bg-red-500/5 border-red-500/10' :
                                                    status === TaskStatus.UNDER_REVIEW ? 'bg-amber-500/5 border-amber-500/10' :
                                                        'bg-emerald-500/5 border-emerald-500/10'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-3 h-3 rounded-full shadow-sm ${status === TaskStatus.NOT_STARTED ? 'bg-gray-400' :
                                                status === TaskStatus.IN_PROGRESS ? 'bg-blue-500 shadow-blue-500/50' :
                                                    status === TaskStatus.HALTED ? 'bg-red-500 shadow-red-500/50' :
                                                        status === TaskStatus.UNDER_REVIEW ? 'bg-amber-500 shadow-amber-500/50' :
                                                            'bg-emerald-500 shadow-emerald-500/50'
                                                }`} />
                                            <h3 className="font-bold text-white text-sm tracking-wide">{status.replace('_', ' ')}</h3>
                                        </div>
                                        <span className="bg-white/10 text-white text-xs px-2.5 py-1 rounded-lg font-bold border border-white/5 shadow-sm">
                                            {filteredTasks.filter(t => t.status === status).length}
                                        </span>
                                    </div>

                                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                                        {filteredTasks.filter(t => t.status === status).map((task, idx) => {
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
                                                            className={`glass-panel p-4 rounded-xl group relative overflow-hidden transition-all duration-300 border border-white/5 hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-900/20 active:scale-95 cursor-grab active:cursor-grabbing ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl ring-2 ring-brand-500/50 z-50 bg-navy-800' : 'bg-navy-900/40'}`}
                                                        >
                                                            {/* Hover Gradient Overlay */}
                                                            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/0 via-brand-500/0 to-brand-500/0 group-hover:from-brand-500/5 group-hover:to-purple-500/5 transition-all duration-500"></div>

                                                            <div className="relative z-10">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wide border ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                                                                    <div className="text-[10px] text-gray-400 font-mono bg-black/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                        <Calendar size={10} />
                                                                        <span>{task.dueDate}</span>
                                                                    </div>
                                                                </div>

                                                                <h4 className="font-bold text-white text-sm mb-2 leading-snug group-hover:text-brand-300 transition-colors line-clamp-2">{task.title}</h4>

                                                                <div className="flex items-center text-xs text-gray-400 mb-3 bg-white/5 p-1.5 rounded-lg border border-white/5">
                                                                    <Briefcase size={12} className="mr-2 text-brand-400 shrink-0" />
                                                                    <span className="truncate text-gray-300 font-medium">{task.clientName || 'Internal'}</span>
                                                                </div>

                                                                {/* Signing Authority Badge */}
                                                                {(() => {
                                                                    const taskClient = clientsList.find(c => (task.clientIds && task.clientIds.includes(c.id)) || c.name === task.clientName);
                                                                    if (taskClient && taskClient.signingAuthority) {
                                                                        return (
                                                                            <div className="mb-3 flex items-center bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 w-fit">
                                                                                <Sparkles size={10} className="text-amber-400 mr-1.5" />
                                                                                <span className="text-[10px] text-amber-200 font-medium truncate max-w-[150px]">
                                                                                    {taskClient.signingAuthority}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}

                                                                {totalSub > 0 && (
                                                                    <div className="mb-4">
                                                                        <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
                                                                            <span>Progress</span>
                                                                            <span className="font-mono text-brand-300">{Math.round(subtaskProgress)}%</span>
                                                                        </div>
                                                                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                                                            <div className={`h-full rounded-full ${progressColor} shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-700 ease-out`} style={{ width: `${subtaskProgress}%` }}></div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="pt-3 border-t border-white/5 flex justify-between items-center group-hover:border-white/10 transition-colors">
                                                                    <div className="flex -space-x-2">
                                                                        {task.assignedTo.slice(0, 3).map((uid, i) => {
                                                                            const u = usersList.find(user => user.uid === uid);
                                                                            return (
                                                                                <div key={i} title={u?.displayName} className="w-6 h-6 rounded-full bg-navy-800 border-2 border-navy-700 flex items-center justify-center text-[8px] font-bold text-white shadow-sm hover:scale-110 transition-transform z-0 hover:z-10 relative">
                                                                                    {getInitials(u?.displayName || '?')}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        {task.assignedTo.length > 3 && (
                                                                            <div className="w-6 h-6 rounded-full bg-navy-900 border-2 border-navy-700 flex items-center justify-center text-[8px] font-bold text-gray-400 z-10">
                                                                                +{task.assignedTo.length - 3}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <div className="bg-brand-500 text-white p-1 rounded-md shadow-lg shadow-brand-500/20">
                                                                            <CheckSquare size={12} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
                                        {provided.placeholder}
                                    </div>
                                </div>
                            )}
                        </Droppable>
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

    const ListView = () => (
        <div className="glass-panel rounded-2xl overflow-hidden animate-fade-in-up relative border border-white/10 shadow-xl mx-1">
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

            <div className="overflow-x-auto">
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
                                <td className="px-6 py-4 text-center">
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
                                <td className="px-6 py-4" onClick={() => handleOpenEdit(task)}>
                                    <div className="font-bold text-white group-hover:text-brand-300 transition-colors text-base mb-0.5">{task.title}</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                                        {task.subtasks && task.subtasks.length > 0 && (
                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <CheckSquare size={10} /> {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4" onClick={() => handleOpenEdit(task)}>
                                    <div className="flex items-center text-brand-200 font-medium">
                                        <Briefcase size={14} className="mr-2 opacity-50" />
                                        {task.clientName}
                                    </div>
                                </td>
                                <td className="px-6 py-4" onClick={() => handleOpenEdit(task)}>
                                    {(() => {
                                        const taskClient = clientsList.find(c => (task.clientIds && task.clientIds.includes(c.id)) || c.name === task.clientName);
                                        return taskClient?.signingAuthority ? (
                                            <div className="flex items-center gap-1.5 text-amber-200/90 bg-amber-500/10 px-2 py-1 rounded w-fit text-xs font-medium border border-amber-500/10">
                                                <Sparkles size={12} className="text-amber-400" />
                                                {taskClient.signingAuthority}
                                            </div>
                                        ) : <span className="text-gray-600">-</span>;
                                    })()}
                                </td>
                                <td className="px-6 py-4" onClick={() => handleOpenEdit(task)}>
                                    <div className="flex -space-x-2 hover:space-x-1 transition-all duration-300">
                                        {task.assignedTo.length === 0 ? (
                                            <span className="text-xs text-gray-500 italic">Unassigned</span>
                                        ) : (
                                            task.assignedTo.slice(0, 4).map((uid, i) => {
                                                const u = usersList.find(user => user.uid === uid);
                                                return (
                                                    <div
                                                        key={i}
                                                        title={u?.displayName}
                                                        className="w-8 h-8 rounded-full bg-navy-800 border-2 border-navy-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-transparent group-hover:ring-brand-500/30 transition-all hover:scale-110 hover:z-10 relative"
                                                    >
                                                        {getInitials(u?.displayName || '?')}
                                                    </div>
                                                );
                                            })
                                        )}
                                        {task.assignedTo.length > 4 && (
                                            <div className="w-8 h-8 rounded-full bg-navy-700 border-2 border-navy-900 flex items-center justify-center text-[10px] font-bold text-gray-300 shadow-sm">
                                                +{task.assignedTo.length - 4}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4" onClick={() => handleOpenEdit(task)}>
                                    <div className="flex items-center text-gray-300 bg-white/5 px-2 py-1 rounded-lg w-fit border border-white/5">
                                        <Calendar size={14} className="mr-2 text-brand-400" />
                                        <span className="font-mono text-xs">{task.dueDate}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4" onClick={() => handleOpenEdit(task)}>
                                    <span className={`px-3 py-1 rounded-full border text-[10px] uppercase font-bold tracking-wide shadow-sm flex items-center w-fit gap-1.5 ${task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                            task.status === TaskStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                                                task.status === TaskStatus.NOT_STARTED ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' :
                                                    'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
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
            {/* Header Section */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-900 to-indigo-900 shadow-2xl border border-white/10 shrink-0">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

                <div className="relative p-6 md:p-8 flex flex-col xl:flex-row justify-between items-center z-10 gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white font-heading tracking-tight mb-2">Workflow & Tasks</h1>
                        <p className="text-blue-100 max-w-xl text-lg opacity-80">
                            Manage projects, track deadlines, and collaborate with your team.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white/10 p-1.5 rounded-xl border border-white/10 flex space-x-1 backdrop-blur-md">
                            <button
                                onClick={() => setBoardMode('ALL')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${boardMode === 'ALL' ? 'bg-white text-blue-900 shadow-lg' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                            >
                                <Briefcase size={16} /> Firm View
                            </button>
                            <button
                                onClick={() => setBoardMode('MY')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${boardMode === 'MY' ? 'bg-white text-blue-900 shadow-lg' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                            >
                                <UserCircle2 size={16} /> My Board
                            </button>
                        </div>
                        {canCreateTask && (
                            <button
                                onClick={handleOpenCreate}
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center shadow-lg shadow-emerald-900/20 transition-all transform hover:-translate-y-0.5"
                            >
                                <Plus size={20} className="mr-2" /> New Task
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center glass-panel p-2 rounded-xl border-white/5 shrink-0">
                <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setViewMode('KANBAN')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'KANBAN' ? 'bg-white/10 text-white border border-white/10 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <LayoutGrid size={16} /> Board
                    </button>
                    <button
                        onClick={() => setViewMode('LIST')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'LIST' ? 'bg-white/10 text-white border border-white/10 shadow-sm' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <ListIcon size={16} /> List
                    </button>
                </div>

                <div className="flex items-center space-x-3 overflow-x-auto pb-2 md:pb-0 custom-scrollbar w-full md:w-auto px-2">
                    {/* Signee Filter */}
                    <div className="relative group">
                        <div className="flex items-center space-x-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-gray-300 transition-colors">
                            <Sparkles size={14} className="text-amber-400" />
                            <span className="font-medium text-xs uppercase tracking-wider text-gray-400">Auditor</span>
                            <div className="h-4 w-px bg-white/10 mx-2"></div>
                            <select
                                className="bg-transparent border-none outline-none text-white font-bold cursor-pointer min-w-[100px]"
                                value={filterSignee}
                                onChange={(e) => setFilterSignee(e.target.value)}
                            >
                                <option value="ALL" className="bg-navy-900 text-gray-300">All Auditors</option>
                                {signees.map((s, i) => <option key={i} value={s} className="bg-navy-900 text-white">{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Quick Filters */}
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                        <button
                            onClick={() => setFilterVat(!filterVat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filterVat ? 'bg-brand-500/20 text-brand-300 border-brand-500/50 shadow-inner' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            VAT
                        </button>
                        <button
                            onClick={() => setFilterItr(!filterItr)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filterItr ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-inner' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            ITR
                        </button>
                    </div>

                    {/* Staff Filter */}
                    <div className="relative group">
                        <div className="flex items-center space-x-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-sm text-gray-300 transition-colors">
                            <Filter size={14} className="text-blue-400" />
                            <span className="font-medium text-xs uppercase tracking-wider text-gray-400">Staff</span>
                            <div className="h-4 w-px bg-white/10 mx-2"></div>
                            <select
                                className="bg-transparent border-none outline-none text-white font-bold cursor-pointer min-w-[100px]"
                                value={filterStaff}
                                onChange={(e) => setFilterStaff(e.target.value)}
                            >
                                <option value="ALL" className="bg-navy-900 text-gray-300">All Staff</option>
                                {usersList.map((u) => <option key={u.uid} value={u.uid} className="bg-navy-900 text-white">{u.displayName}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2"></div>

                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                        <button
                            onClick={() => setIsTemplateManagerOpen(true)}
                            className="bg-navy-800/80 hover:bg-navy-700 text-brand-300 border border-brand-500/20 rounded-xl p-2.5 transition-all"
                            title="Manage Templates"
                        >
                            <Sparkles size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold transition-all flex items-center gap-2"
                    >
                        <CheckSquare size={16} />
                        <span className="hidden xl:inline">Templates</span>
                    </button>
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
                                        disabled={!hasEditPermission}
                                    />
                                </div>

                                {/* Task Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Task Title <span className="text-red-400">*</span></label>
                                    <input className="w-full glass-input" value={currentTask.title} onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })} disabled={!hasEditPermission} />
                                </div>

                                {/* Due Date & Priority Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Due Date <span className="text-red-400">*</span></label>
                                        <input
                                            type="date"
                                            className="w-full glass-input"
                                            value={currentTask.dueDate}
                                            onChange={(e) => setCurrentTask({ ...currentTask, dueDate: e.target.value })}
                                            disabled={!hasEditPermission}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                                        <select className="w-full glass-input" value={currentTask.priority} onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value as TaskPriority })} disabled={!hasEditPermission}>
                                            {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Status Row */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                                    <select className="w-full glass-input" value={currentTask.status} onChange={(e) => setCurrentTask({ ...currentTask, status: e.target.value as TaskStatus })} disabled={!hasEditPermission}>
                                        {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                    </select>
                                </div>

                                <div className="relative" ref={dropdownRef}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium text-gray-400">Assign Staff</label>
                                    </div>
                                    <StaffSelect
                                        users={usersList}
                                        value={currentTask.assignedTo || []}
                                        onChange={(val) => setCurrentTask({ ...currentTask, assignedTo: val as string[] })}
                                        multi={true}
                                        placeholder="Assign staff..."
                                        disabled={!hasEditPermission}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                                    <textarea rows={2} className="w-full glass-input" value={currentTask.description} onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })} disabled={!hasEditPermission} />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-gray-300">Subtasks</label>
                                    </div>
                                    <div className="space-y-2">
                                        {currentTask.subtasks?.map(st => (
                                            <div key={st.id} className="flex flex-col space-y-1 bg-white/5 p-2 rounded-lg">
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => toggleSubtask(st.id)}
                                                        disabled={!hasEditPermission}
                                                        className={`${st.isCompleted ? 'text-emerald-500' : 'text-gray-500'} ${!hasEditPermission ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                    >
                                                        {st.isCompleted ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 border border-gray-500 rounded-full" />}
                                                    </button>
                                                    <span className={`text-xs flex-1 ${st.isCompleted ? 'line-through text-gray-500' : 'text-gray-200'}`}>{st.title}</span>
                                                    {hasEditPermission && <Trash2 size={14} className="text-gray-600 hover:text-red-400 cursor-pointer" onClick={() => deleteSubtask(st.id)} />}
                                                </div>
                                                {st.minimumRequirement && (
                                                    <div className="ml-6 text-[10px] text-brand-400/80 italic flex items-center">
                                                        <AlertCircle size={10} className="mr-1" />
                                                        Req: {st.minimumRequirement}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {hasEditPermission && (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <input className="flex-1 glass-input text-xs" placeholder="New step..." value={newSubtaskTitle}
                                                    onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                                                />
                                                <input
                                                    className="w-1/3 glass-input text-xs"
                                                    placeholder="Min Requirement (Opt)"
                                                    value={newSubtaskRequirement}
                                                    onChange={(e) => setNewSubtaskRequirement(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                                                />
                                                <button onClick={addSubtask} className="px-3 bg-white/10 rounded font-bold text-xs">Add</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-white/10 flex justify-between bg-white/5">
                                {isEditMode && hasEditPermission && (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
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
