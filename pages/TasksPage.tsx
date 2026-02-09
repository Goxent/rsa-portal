
import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Filter, Search, Calendar, Trash2, X,
    LayoutGrid, List as ListIcon, CheckSquare, UserCircle2, Briefcase, CheckCircle2, AlertCircle, ChevronDown, Check, Sparkles, Loader2, Wand2, Save
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { AIService } from '../services/ai';
import ClientSelect from '../components/ClientSelect';
import TaskTemplateModal from '../components/TaskTemplateModal';
import TemplateManager from '../components/TemplateManager';
import StaffSelect from '../components/StaffSelect';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { toast } from 'react-hot-toast';

const TasksPage: React.FC = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('KANBAN');
    const [boardMode, setBoardMode] = useState<'ALL' | 'MY'>('ALL');

    // Data State
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [clientsList, setClientsList] = useState<Client[]>([]);

    // Modal & Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [formError, setFormError] = useState('');

    // AI State
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [isAutoAssigning, setIsAutoAssigning] = useState(false);
    const [assignSuggestion, setAssignSuggestion] = useState<string | null>(null);

    // Assignee Dropdown State
    const [isAssignDropdownOpen, setIsAssignDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Permissions Check
    const canCreateTask = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER || user?.role === UserRole.MASTER_ADMIN;

    const [filterPriority, setFilterPriority] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const newStatus = destination.droppableId as TaskStatus;
        const task = tasks.find(t => t.id === draggableId);

        if (task && task.status !== newStatus) {
            // Create updated task with new status
            let updatedTask = { ...task, status: newStatus };

            // Auto-add status-specific subtasks if they don't already exist
            if (task.subtasks) {
                const statusSubtasks: SubTask[] = [];

                // Define default status-based subtasks
                const defaultStatusSubtasks: Record<TaskStatus, string[]> = {
                    [TaskStatus.NOT_STARTED]: [],
                    [TaskStatus.IN_PROGRESS]: ['Review requirements', 'Start initial work'],
                    [TaskStatus.HALTED]: ['Document blocker', 'Identify resolution path'],
                    [TaskStatus.UNDER_REVIEW]: ['Prepare review documentation', 'Submit for approval'],
                    [TaskStatus.COMPLETED]: ['Final quality check', 'Archive documentation']
                };

                const subtasksToAdd = defaultStatusSubtasks[newStatus] || [];
                const existingTitles = task.subtasks.map(st => st.title.toLowerCase());

                subtasksToAdd.forEach(title => {
                    if (!existingTitles.includes(title.toLowerCase())) {
                        statusSubtasks.push({
                            id: `st_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            title,
                            isCompleted: false,
                            createdBy: 'System',
                            createdAt: new Date().toISOString()
                        });
                    }
                });

                if (statusSubtasks.length > 0) {
                    updatedTask = {
                        ...updatedTask,
                        subtasks: [...task.subtasks, ...statusSubtasks]
                    };
                    toast.success(`Added ${statusSubtasks.length} status-specific subtask(s)`);
                }
            }

            try {
                // Optimistic Update
                setTasks(prev => prev.map(t => t.id === draggableId ? updatedTask : t));
                await AuthService.saveTask(updatedTask);
            } catch (err) {
                toast.error("Failed to move task");
                fetchData(); // Rollback
            }
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsAssignDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        const [u, c, t] = await Promise.all([
            AuthService.getAllUsers(),
            AuthService.getAllClients(),
            AuthService.getAllTasks()
        ]);
        setUsersList(u);
        setClientsList(c);
        setTasks(t);
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

    const filteredTasks = tasks.filter(t => {
        if (boardMode === 'MY' && user) {
            if (!t.assignedTo.includes(user.uid)) return false;
        }
        if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
        if (searchTerm && !t.title.toLowerCase().includes(searchTerm.toLowerCase()) && !t.clientName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
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
        setAssignSuggestion(null);

        // Get local date string without timezone conversion
        const today = new Date();
        const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        setCurrentTask({
            title: '',
            description: '',
            assignedTo: [],
            status: TaskStatus.NOT_STARTED,
            priority: TaskPriority.MEDIUM,
            subtasks: [],
            dueDate: localDate
        });
        setIsModalOpen(true);
    };

    const handleTemplateSelect = (template: any) => {
        setIsTemplateModalOpen(false);
        setIsEditMode(false);
        setFormError('');
        setAssignSuggestion(null);
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
            dueDate: new Date().toLocaleDateString('en-CA')
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (task: Task) => {
        setIsEditMode(true);
        setFormError('');
        setAssignSuggestion(null);
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
    };

    const addSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const sub: SubTask = {
            id: 'st_' + Date.now(),
            title: newSubtaskTitle,
            isCompleted: false,
            createdBy: user?.displayName || 'User',
            createdAt: new Date().toISOString()
        };
        setCurrentTask(prev => ({ ...prev, subtasks: [...(prev.subtasks || []), sub] }));
        setNewSubtaskTitle('');
    };

    const generateAISubtasks = async () => {
        if (!currentTask.title) return;
        setIsGeneratingAI(true);
        try {
            const aiSuggestions = await AIService.generateSubtasks(currentTask.title, currentTask.description || '');
            const newSubtasks: SubTask[] = aiSuggestions.map(title => ({
                id: 'st_ai_' + Math.random().toString(36).substr(2, 9),
                title,
                isCompleted: false,
                createdBy: 'Gemini AI',
                createdAt: new Date().toISOString()
            }));

            setCurrentTask(prev => ({
                ...prev,
                subtasks: [...(prev.subtasks || []), ...newSubtasks]
            }));
        } catch (e) {
            toast.error("AI Generation failed");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const autoAssignStaff = async () => {
        if (!currentTask.title) return;
        setIsAutoAssigning(true);
        try {
            const result = await AIService.suggestStaffAssignment(
                currentTask.title,
                currentTask.priority || TaskPriority.MEDIUM,
                usersList,
                tasks
            );
            if (result && result.uid) {
                setCurrentTask(prev => ({ ...prev, assignedTo: [result.uid] }));
                setAssignSuggestion(result.reasoning);
            }
        } catch (e) {
            toast.error("Auto-assign failed");
        } finally {
            setIsAutoAssigning(false);
        }
    };

    const toggleSubtask = (subId: string) => {
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
                <div className="flex space-x-6 overflow-x-auto pb-6 h-full custom-scrollbar items-start">
                    {Object.values(TaskStatus).map(status => (
                        <Droppable key={status} droppableId={status}>
                            {(provided, snapshot) => (
                                <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className={`flex-shrink-0 w-80 rounded-2xl p-4 transition-all border-2 ${snapshot.isDraggingOver ? 'bg-brand-500/5 ring-2 ring-brand-500/20' :
                                        status === TaskStatus.NOT_STARTED ? 'bg-blue-500/5 border-blue-500/30' :
                                            status === TaskStatus.IN_PROGRESS ? 'bg-brand-500/5 border-brand-500/30' :
                                                status === TaskStatus.HALTED ? 'bg-red-500/5 border-red-500/30' :
                                                    status === TaskStatus.UNDER_REVIEW ? 'bg-yellow-500/5 border-yellow-500/30' :
                                                        'bg-emerald-500/5 border-emerald-500/30'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${status === TaskStatus.NOT_STARTED ? 'bg-blue-500' :
                                                status === TaskStatus.IN_PROGRESS ? 'bg-brand-500' :
                                                    status === TaskStatus.HALTED ? 'bg-red-500' :
                                                        status === TaskStatus.UNDER_REVIEW ? 'bg-yellow-500' :
                                                            'bg-emerald-500'
                                                }`} />
                                            <h3 className="font-bold text-gray-300 text-xs uppercase tracking-widest">{status.replace('_', ' ')}</h3>
                                        </div>
                                        <span className="bg-navy-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredTasks.filter(t => t.status === status).length}</span>
                                    </div>

                                    <div className="space-y-4">
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
                                                            className={`glass-panel p-5 rounded-xl hover:border-brand-500/40 hover:bg-navy-700 transition-all group relative overflow-hidden shadow-lg border border-white/5 ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl ring-2 ring-brand-500/50 z-50' : ''}`}
                                                        >
                                                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                            <div className="flex justify-between items-start mb-3">
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                                                                <div className="text-[10px] text-gray-400 font-mono">
                                                                    <span>{task.dueDate}</span>
                                                                </div>
                                                            </div>

                                                            <h4 className="font-bold text-gray-100 text-sm mb-2 leading-snug group-hover:text-brand-300 transition-colors">{task.title}</h4>
                                                            <div className="flex items-center text-xs text-gray-400 mb-4">
                                                                <Briefcase size={12} className="mr-1.5 text-brand-500" />
                                                                <span className="truncate max-w-[200px] text-gray-300">{task.clientName || 'Internal'}</span>
                                                            </div>

                                                            {totalSub > 0 && (
                                                                <div className="mb-4">
                                                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                                                        <span>{Math.round(subtaskProgress)}%</span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-navy-900 rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full ${progressColor} transition-all duration-500`} style={{ width: `${subtaskProgress}%` }}></div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="pt-3 border-t border-white/5">
                                                                <div className="text-[9px] text-gray-500 mb-1.5 uppercase tracking-wide">Assigned To</div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {task.assignedTo.map(uid => {
                                                                        const u = usersList.find(user => user.uid === uid);
                                                                        return (
                                                                            <div key={uid} className="flex items-center bg-navy-800/50 px-2 py-1 rounded border border-white/5">
                                                                                <div className="w-4 h-4 rounded-full bg-navy-700 border border-navy-600 flex items-center justify-center text-[8px] font-bold text-gray-300 mr-1.5">
                                                                                    {getInitials(u?.displayName || '?')}
                                                                                </div>
                                                                                <span className="text-[10px] text-gray-300">{u?.displayName || 'Unknown'}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 flex items-center">
                                                                    <Calendar size={10} className="mr-1" /> {task.createdAt.split('T')[0]}
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

    const ListView = () => (
        <div className="glass-panel rounded-xl overflow-hidden animate-fade-in-up">
            <table className="w-full text-left text-sm text-gray-300">
                <thead>
                    <tr className="bg-navy-900/50 text-gray-400 uppercase tracking-wider text-xs border-b border-white/10">
                        <th className="px-6 py-4 font-heading font-bold">Task Name</th>
                        <th className="px-6 py-4 font-heading font-bold">Client</th>
                        <th className="px-6 py-4 font-heading font-bold">Assigned</th>
                        <th className="px-6 py-4 font-heading font-bold">Due Date</th>
                        <th className="px-6 py-4 font-heading font-bold">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {filteredTasks.map((task) => (
                        <tr key={task.id} onClick={() => handleOpenEdit(task)} className="hover:bg-white/5 transition-colors cursor-pointer group">
                            <td className="px-6 py-4 font-medium text-white group-hover:text-brand-300 transition-colors">{task.title}</td>
                            <td className="px-6 py-4 text-brand-200">{task.clientName}</td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                    <div className="flex -space-x-2">
                                        {task.assignedTo.slice(0, 3).map((uid, i) => {
                                            const u = usersList.find(user => user.uid === uid);
                                            return (
                                                <div key={i} title={u?.displayName} className="w-6 h-6 rounded-full bg-navy-700 border border-navy-900 flex items-center justify-center text-[9px] font-bold text-white">
                                                    {getInitials(u?.displayName || '?')}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {task.assignedTo.slice(0, 2).map(uid => {
                                            const u = usersList.find(user => user.uid === uid);
                                            return u ? (
                                                <span key={uid} className="text-[10px] text-gray-400">{u.displayName}</span>
                                            ) : null;
                                        })}
                                        {task.assignedTo.length > 2 && (
                                            <span className="text-[10px] text-gray-500">+{task.assignedTo.length - 2}</span>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono">{task.dueDate}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold ${getPriorityStyle(task.priority)}`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const hasEditPermission = canEditTask(currentTask);

    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">Workflow</h1>
                    <p className="text-sm text-gray-400">Manage tasks and track progress</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex space-x-1">
                        <button onClick={() => setBoardMode('ALL')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${boardMode === 'ALL' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Firm View</button>
                        <button onClick={() => setBoardMode('MY')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center ${boardMode === 'MY' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><UserCircle2 size={14} className="mr-1" /> My Board</button>
                    </div>
                    {canCreateTask && (
                        <button onClick={handleOpenCreate} className="bg-brand-600 hover:bg-brand-50 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-lg transition-all border border-brand-500/30 transform hover:-translate-y-0.5"><Plus size={16} className="mr-2" /> New Task</button>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-center glass-panel p-4 rounded-xl shadow-xl border-white/5">
                <div className="flex bg-navy-900/50 p-1.5 rounded-xl border border-white/10">
                    <button onClick={() => setViewMode('KANBAN')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${viewMode === 'KANBAN' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <LayoutGrid size={16} className="mr-2" /> Board
                    </button>
                    <button onClick={() => setViewMode('LIST')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ${viewMode === 'LIST' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <ListIcon size={16} className="mr-2" /> List
                    </button>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                        <input className="pl-9 pr-4 py-2 glass-input text-sm" placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                        <button onClick={() => setIsTemplateManagerOpen(true)} className="px-4 py-2 bg-navy-800 text-brand-300 border border-brand-500/20 rounded-xl text-sm font-bold hover:bg-navy-700 transition-all flex items-center">
                            <Sparkles size={16} className="mr-2" /> Manage Templates
                        </button>
                    )}
                    <button onClick={() => setIsTemplateModalOpen(true)} className="px-4 py-2 bg-white/5 text-gray-300 border border-white/10 rounded-xl text-sm font-bold hover:bg-white/10 transition-all flex items-center">
                        <CheckSquare size={16} className="mr-2" /> Use Template
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Task Title <span className="text-red-400">*</span></label>
                                    <input className="w-full glass-input" value={currentTask.title} onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })} disabled={!hasEditPermission} />
                                    {currentTask.clientName && (
                                        <div className="text-sm text-brand-300 flex items-center mt-2">
                                            <Briefcase size={14} className="mr-2" />
                                            <span className="font-medium">{currentTask.clientName}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Client(s)</label>
                                        <ClientSelect
                                            clients={clientsList}
                                            value={currentTask.clientIds || []}
                                            onChange={(ids) => setCurrentTask({ ...currentTask, clientIds: ids as string[] })}
                                            multi={true}
                                            placeholder="Select Clients..."
                                            disabled={!hasEditPermission}
                                        />
                                    </div>
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
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Priority</label>
                                        <select className="w-full glass-input" value={currentTask.priority} onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value as TaskPriority })} disabled={!hasEditPermission}>
                                            {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                                        <select className="w-full glass-input" value={currentTask.status} onChange={(e) => setCurrentTask({ ...currentTask, status: e.target.value as TaskStatus })} disabled={!hasEditPermission}>
                                            {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="relative" ref={dropdownRef}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium text-gray-400">Assign Staff</label>
                                        {hasEditPermission && (
                                            <button onClick={autoAssignStaff} disabled={isAutoAssigning} className="text-[10px] text-brand-400 flex items-center hover:text-brand-300">
                                                {isAutoAssigning ? <Loader2 size={10} className="animate-spin mr-1" /> : <Wand2 size={10} className="mr-1" />}
                                                Auto-Assign
                                            </button>
                                        )}
                                    </div>
                                    {assignSuggestion && (
                                        <div className="text-[10px] bg-brand-500/10 p-2 rounded mb-2 border border-brand-500/20 text-brand-300">
                                            {assignSuggestion}
                                        </div>
                                    )}
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
                                        {hasEditPermission && (
                                            <button onClick={generateAISubtasks} disabled={isGeneratingAI} className="text-[10px] bg-brand-600/20 text-brand-300 px-2 py-1 rounded-full border border-brand-500/20 flex items-center">
                                                {isGeneratingAI ? <Loader2 size={10} className="animate-spin mr-1" /> : <Sparkles size={10} className="mr-1" />}
                                                AI Steps
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {currentTask.subtasks?.map(st => (
                                            <div key={st.id} className="flex items-center space-x-2 bg-white/5 p-2 rounded-lg">
                                                <button onClick={() => toggleSubtask(st.id)} className={st.isCompleted ? 'text-emerald-500' : 'text-gray-500'}>
                                                    {st.isCompleted ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 border border-gray-500 rounded-full" />}
                                                </button>
                                                <span className={`text-xs flex-1 ${st.isCompleted ? 'line-through text-gray-500' : 'text-gray-200'}`}>{st.title}</span>
                                                {hasEditPermission && <Trash2 size={14} className="text-gray-600 hover:text-red-400 cursor-pointer" onClick={() => deleteSubtask(st.id)} />}
                                            </div>
                                        ))}
                                    </div>
                                    {hasEditPermission && (
                                        <div className="flex gap-2">
                                            <input className="flex-1 glass-input text-xs" placeholder="New step..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} />
                                            <button onClick={addSubtask} className="px-3 bg-white/10 rounded font-bold text-xs">Add</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-white/10 flex justify-between bg-white/5">
                            {isEditMode && hasEditPermission && (
                                <button onClick={() => currentTask.id && handleDeleteTask(currentTask.id)} className="text-red-400 hover:text-red-300 text-sm flex items-center">
                                    <Trash2 size={16} className="mr-2" /> Delete
                                </button>
                            )}
                            <div className="flex space-x-3 ml-auto">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                                {hasEditPermission && (
                                    <button onClick={handleSaveTask} className="btn-primary flex items-center px-6">
                                        <Save size={16} className="mr-2" /> {isEditMode ? 'Update' : 'Create'}
                                    </button>
                                )}
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
