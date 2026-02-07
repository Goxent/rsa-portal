
import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Filter, Search, Calendar, Trash2, X,
    LayoutGrid, List as ListIcon, CheckSquare, UserCircle2, Briefcase, Edit2, CheckCircle2, Lock, AlertCircle, ChevronDown, Check, Sparkles, Loader2, Wand2
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserRole, UserProfile, Client, SubTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { AIService } from '../services/ai';
import { toBS, formatDualDate } from '../utils/dateUtils';

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
    const canCreateTask = user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER;

    const [filterPriority, setFilterPriority] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Drag and Drop State
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
        e.preventDefault();
        if (!draggedTaskId) return;

        const task = tasks.find(t => t.id === draggedTaskId);
        if (task && task.status !== newStatus) {
            // Optimistic Update
            const updatedTasks = tasks.map(t =>
                t.id === draggedTaskId ? { ...t, status: newStatus } : t
            );
            setTasks(updatedTasks);

            // API Update
            try {
                await AuthService.saveTask({ ...task, status: newStatus });
            } catch (error) {
                console.error("Failed to update task status", error);
                fetchData(); // Revert on failure
            }
        }
        setDraggedTaskId(null);
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
            case TaskPriority.URGENT: return 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]';
            case TaskPriority.HIGH: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case TaskPriority.MEDIUM: return 'bg-brand-500/10 text-brand-400 border-brand-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    const canEditTask = (task: Task | Partial<Task>) => {
        if (user?.role === UserRole.ADMIN || user?.role === UserRole.MANAGER) return true;
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
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    const handleOpenCreate = () => {
        if (!canCreateTask) return;
        setIsEditMode(false);
        setFormError('');
        setAssignSuggestion(null);
        setCurrentTask({
            title: '',
            description: '',
            assignedTo: [],
            status: TaskStatus.NOT_STARTED,
            priority: TaskPriority.MEDIUM,
            subtasks: [],
            dueDate: new Date().toISOString().split('T')[0]
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

    const handleDeleteTask = async () => {
        if (!currentTask.id) return;
        if (window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
            await AuthService.deleteTask(currentTask.id);
            fetchData();
            setIsModalOpen(false);
        }
    };

    const handleSaveTask = async () => {
        // Validation
        const errors = [];
        if (!currentTask.title?.trim()) errors.push("Title is required.");
        if (!currentTask.clientId) errors.push("Client selection is required.");
        if (!currentTask.assignedTo || currentTask.assignedTo.length === 0) errors.push("At least one staff member must be assigned.");
        if (!currentTask.dueDate) errors.push("Due Date is required.");

        if (errors.length > 0) {
            setFormError(errors.join(" "));
            return;
        }

        const client = clientsList.find(c => c.id === currentTask.clientId);
        const clientName = client ? client.name : 'Internal Task';

        const assignedNames = currentTask.assignedTo!.map(uid => {
            const u = usersList.find(user => user.uid === uid);
            return u ? u.displayName : 'Unknown';
        });

        const taskToSave: Task = {
            ...currentTask,
            id: currentTask.id || `t_${Date.now()}`,
            clientName,
            assignedToNames: assignedNames,
            createdBy: currentTask.createdBy || user?.uid || 'unknown',
            createdAt: currentTask.createdAt || new Date().toISOString().split('T')[0],
            subtasks: currentTask.subtasks || []
        } as Task;

        await AuthService.saveTask(taskToSave);
        fetchData();
        setIsModalOpen(false);
    };

    const addSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const sub: SubTask = {
            id: 'st_' + Date.now(),
            title: newSubtaskTitle,
            isCompleted: false,
            createdBy: user?.displayName || 'Admin',
            createdAt: new Date().toLocaleDateString()
        };
        setCurrentTask(prev => ({ ...prev, subtasks: [...(prev.subtasks || []), sub] }));
        setNewSubtaskTitle('');
    };

    const generateAISubtasks = async () => {
        if (!currentTask.title) {
            setFormError("Please enter a task title first.");
            return;
        }
        setIsGeneratingAI(true);
        try {
            const aiSuggestions = await AIService.generateSubtasks(currentTask.title, currentTask.description || '');
            const newSubtasks: SubTask[] = aiSuggestions.map(title => ({
                id: 'st_ai_' + Math.random().toString(36).substr(2, 9),
                title,
                isCompleted: false,
                createdBy: 'Gemini AI',
                createdAt: new Date().toLocaleDateString()
            }));

            setCurrentTask(prev => ({
                ...prev,
                subtasks: [...(prev.subtasks || []), ...newSubtasks]
            }));
        } catch (e) {
            setFormError("Failed to generate AI subtasks.");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const autoAssignStaff = async () => {
        if (!currentTask.title) {
            setFormError("Please provide a task title first.");
            return;
        }

        setIsAutoAssigning(true);
        setAssignSuggestion(null);

        try {
            // Pass current users and all tasks (to calculate load)
            const result = await AIService.suggestStaffAssignment(
                currentTask.title,
                currentTask.priority || TaskPriority.MEDIUM,
                usersList,
                tasks
            );

            if (result && result.uid) {
                // Update state
                setCurrentTask(prev => ({
                    ...prev,
                    assignedTo: [result.uid]
                }));
                setAssignSuggestion(result.reasoning);
            } else {
                setFormError("AI could not determine the best assignee.");
            }
        } catch (e) {
            setFormError("Auto-assign failed.");
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

    // Assignee Dropdown Toggle Logic
    const toggleAssignee = (uid: string) => {
        if (!hasEditPermission) return;
        const current = currentTask.assignedTo || [];
        const updated = current.includes(uid) ? current.filter(id => id !== uid) : [...current, uid];
        setCurrentTask({ ...currentTask, assignedTo: updated });
    };

    // Improved Kanban Column from Legacy Code
    const KanbanColumn = ({ status, title, colorClass, badgeColor }: { status: TaskStatus, title: string, colorClass: string, badgeColor: string }) => {
        const columnTasks = filteredTasks.filter(t => t.status === status);
        return (
            <div
                className="flex-1 min-w-[320px] flex flex-col h-full max-h-[calc(100vh-240px)] animate-fade-in-up"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
            >
                <div className={`p-4 rounded-xl border mb-3 flex justify-between items-center backdrop-blur-md ${colorClass} bg-opacity-10 border-opacity-30`}>
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full shadow-[0_0_8px_currentColor] ${badgeColor}`}></div>
                        <h3 className="font-bold text-sm text-gray-100 font-heading tracking-wide uppercase">{title}</h3>
                    </div>
                    <span className="bg-navy-900/50 px-2 py-0.5 rounded text-xs font-mono text-gray-300 border border-white/5">{columnTasks.length}</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 px-1 pb-4">
                    {columnTasks.map((task, idx) => {
                        const completedSub = task.subtasks?.filter(s => s.isCompleted).length || 0;
                        const totalSub = task.subtasks?.length || 0;
                        const subtaskProgress = totalSub > 0 ? (completedSub / totalSub) * 100 : 0;
                        const progressColor = subtaskProgress === 100 ? 'bg-emerald-500' : subtaskProgress > 50 ? 'bg-brand-500' : 'bg-amber-500';
                        const isDragging = draggedTaskId === task.id;

                        return (
                            <div
                                key={task.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                onClick={() => handleOpenEdit(task)}
                                className={`glass-panel p-5 rounded-xl hover:border-brand-500/40 hover:bg-navy-700 transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden shadow-lg border border-white/5 animate-fade-in-up transform hover:-translate-y-1 ${isDragging ? 'opacity-40 ring-2 ring-brand-500 ring-offset-2 ring-offset-navy-900' : ''}`}
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                {/* Top Glow */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide border ${getPriorityStyle(task.priority)}`}>{task.priority}</span>
                                    <div className="flex flex-col items-end text-[10px] text-gray-400 font-mono">
                                  <span>{toBS(task.dueDate)} BS</span>
                                  <span className="text-[9px] opacity-70">{task.dueDate}</span>
                              </div>      </div>
                                </div>

                                <h4 className="font-bold text-gray-100 text-sm mb-2 leading-snug group-hover:text-brand-300 transition-colors">{task.title}</h4>

                                <div className="flex items-center text-xs text-gray-400 mb-4">
                                    <Briefcase size={12} className="mr-1.5 text-brand-500" />
                                    <span className="truncate max-w-[200px] text-gray-300">{task.clientName || 'Internal'}</span>
                                </div>

                                {/* Progress Bar (Legacy Style) */ }
                        {
                            totalSub > 0 && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                        <span>Progress</span>
                                        <span>{Math.round(subtaskProgress)}%</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-navy-900 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${progressColor} transition-all duration-500`} style={{ width: `${subtaskProgress}%` }}></div>
                                    </div>
                                </div>
                            )
                        }

                        <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                            {/* Avatars */}
                            <div className="flex -space-x-2">
                                {task.assignedTo.slice(0, 3).map((uid, i) => {
                                    const u = usersList.find(user => user.uid === uid);
                                    return (
                                        <div key={i} title={u?.displayName} className="w-6 h-6 rounded-full bg-gradient-to-br from-navy-700 to-navy-600 border border-navy-800 flex items-center justify-center text-[9px] font-bold text-gray-300 shadow-sm">
                                            {getInitials(u?.displayName || '?')}
                                        </div>
                                    );
                                })}
                                {task.assignedTo.length > 3 && (
                                    <div className="w-6 h-6 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center text-[8px] text-gray-400">+{task.assignedTo.length - 3}</div>
                                )}
                            </div>

                            <div className="text-[10px] text-gray-500 flex items-center">
                                <Calendar size={10} className="mr-1" /> {task.createdAt}
                            </div>
                        </div>
                            </div>
                )
                    })}
            </div>
            </div >
        );
    };

const ListView = () => (
    <div className="glass-panel rounded-xl overflow-hidden animate-fade-in-up">
        <table className="w-full text-left text-sm text-gray-300">
            <thead>
                <tr className="bg-navy-900/50 text-gray-400 uppercase tracking-wider text-xs border-b border-white/10">
                    <th className="px-6 py-4 font-heading font-bold">Task Name</th>
                    <th className="px-6 py-4 font-heading font-bold">Client</th>
                    <th className="px-6 py-4 font-heading font-bold">Assigned To</th>
                    <th className="px-6 py-4 font-heading font-bold">Dates</th>
                    <th className="px-6 py-4 font-heading font-bold">Progress</th>
                    <th className="px-6 py-4 font-heading font-bold">Priority</th>
                    <th className="px-6 py-4 font-heading font-bold">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {filteredTasks.map((task, idx) => {
                    const completedSub = task.subtasks?.filter(s => s.isCompleted).length || 0;
                    const totalSub = task.subtasks?.length || 0;

                    return (
                        <tr key={task.id} onClick={() => handleOpenEdit(task)} className="hover:bg-white/5 transition-colors cursor-pointer group animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                            <td className="px-6 py-4 font-medium text-white group-hover:text-brand-300 transition-colors">{task.title}</td>
                            <td className="px-6 py-4 text-brand-200">{task.clientName}</td>
                            <td className="px-6 py-4 text-xs">
                                <div className="flex -space-x-2">
                                    {task.assignedTo.map((uid, i) => {
                                        const u = usersList.find(user => user.uid === uid);
                                        if (i > 3) return null; // Limit display in list
                                        return (
                                            <div key={i} title={u?.displayName} className="w-6 h-6 rounded-full bg-navy-700 border border-navy-900 flex items-center justify-center text-[9px] font-bold text-white">
                                                {getInitials(u?.displayName || '?')}
                                            </div>
                                        );
                                    })}
                                    {task.assignedTo.length > 4 && <div className="w-6 h-6 rounded-full bg-navy-800 border border-navy-900 flex items-center justify-center text-[8px] text-gray-400">+{task.assignedTo.length - 4}</div>}
                                </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs">
                                <div className="text-gray-500">Start: {task.createdAt}</div>
                                <div className="text-white">Due: {toBS(task.dueDate)} BS</div>
                            </td>
                            <td className="px-6 py-4">
                                {totalSub > 0 ? (
                                    <span className={`text-xs ${completedSub === totalSub ? 'text-emerald-400' : 'text-gray-400'}`}>
                                        {completedSub} / {totalSub}
                                    </span>
                                ) : <span className="text-gray-600">-</span>}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold ${getPriorityStyle(task.priority)}`}>
                                    {task.priority}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-xs bg-white/5 border border-white/10 px-2 py-1 rounded">{task.status.replace('_', ' ')}</span>
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    </div >
);

const hasEditPermission = canEditTask(currentTask);

return (
    <div className="flex flex-col h-full space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div><h1 className="text-2xl font-bold text-white font-heading">Workflow</h1><p className="text-sm text-gray-400">Manage tasks and track progress</p></div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex space-x-1">
                    <button onClick={() => setViewMode('KANBAN')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'KANBAN' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><LayoutGrid size={16} /></button>
                    <button onClick={() => setViewMode('LIST')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'LIST' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><ListIcon size={16} /></button>
                </div>
                <div className="h-6 w-px bg-white/10 mx-2"></div>
                <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex space-x-1">
                    <button onClick={() => setBoardMode('ALL')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${boardMode === 'ALL' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Firm View</button>
                    <button onClick={() => setBoardMode('MY')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center ${boardMode === 'MY' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><UserCircle2 size={14} className="mr-1" /> My Board</button>
                </div>
                {canCreateTask && <button onClick={handleOpenCreate} className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-lg shadow-brand-900/40 transition-all border border-brand-500/30 transform hover:-translate-y-0.5"><Plus size={16} className="mr-2" /> New Task</button>}
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
            {viewMode === 'KANBAN' ? (
                <div className="flex space-x-4 overflow-x-auto pb-4 h-full">
                    <KanbanColumn status={TaskStatus.NOT_STARTED} title="Not Started" colorClass="bg-navy-700 border-navy-600" badgeColor="bg-gray-400" />
                    <KanbanColumn status={TaskStatus.IN_PROGRESS} title="In Progress" colorClass="bg-amber-500/10 border-amber-500/20" badgeColor="bg-amber-500 text-amber-500" />
                    <KanbanColumn status={TaskStatus.UNDER_REVIEW} title="Review" colorClass="bg-accent-purple/10 border-accent-purple/20" badgeColor="bg-accent-purple text-accent-purple" />
                    <KanbanColumn status={TaskStatus.COMPLETED} title="Done" colorClass="bg-emerald-500/10 border-emerald-500/20" badgeColor="bg-emerald-500 text-emerald-500" />
                </div>
            ) : (
                <div className="overflow-y-auto h-full pb-10">
                    <ListView />
                </div>
            )}
        </div>

        {/* Task Modal (Create / Edit) - Keeping existing modal structure but refined classes */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                <div className="glass-modal rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10">
                    {/* ... Modal content similar to previous but with updated tailwind classes for glass inputs ... */}
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h3 className="text-lg font-bold text-white font-heading">{isEditMode ? 'Edit Task' : 'Create New Task'}</h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-transform hover:rotate-90"><X size={20} /></button>
                    </div>

                    {formError && (
                        <div className="bg-red-500/20 text-red-200 px-6 py-2 text-sm border-b border-red-500/20 flex items-center">
                            <AlertCircle size={16} className="mr-2" /> {formError}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
                        {/* Basic Fields */}
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium text-gray-300 mb-1">Title <span className="text-red-400">*</span></label><input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={currentTask.title} onChange={(e) => setCurrentTask({ ...currentTask, title: e.target.value })} disabled={!hasEditPermission} placeholder="e.g. Q4 Audit for Alpha" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Client <span className="text-red-400">*</span></label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={currentTask.clientId || ''} onChange={(e) => setCurrentTask({ ...currentTask, clientId: e.target.value })} disabled={!hasEditPermission}>
                                        <option value="">Select Client</option>
                                        {clientsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-sm font-medium text-gray-300 mb-1">Status</label><select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={currentTask.status} onChange={(e) => setCurrentTask({ ...currentTask, status: e.target.value as TaskStatus })} disabled={!hasEditPermission}>{Object.values(TaskStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-300 mb-1">Priority</label><select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={currentTask.priority} onChange={(e) => setCurrentTask({ ...currentTask, priority: e.target.value as TaskPriority })} disabled={!hasEditPermission}>{Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">
                                        Due Date <span className="text-red-400">*</span>
                                        {currentTask.dueDate && <span className="ml-2 text-xs text-brand-300 font-mono">({toBS(currentTask.dueDate)} BS)</span>}
                                    </label>
                                    <input type="date" className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={currentTask.dueDate} onChange={(e) => setCurrentTask({ ...currentTask, dueDate: e.target.value })} disabled={!hasEditPermission} />
                                </div>
                            </div>

                            {/* New Multi-Select Staff Assign */}
                            <div className="relative" ref={dropdownRef}>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-300">Assign Staff <span className="text-red-400">*</span></label>
                                    {hasEditPermission && (
                                        <button
                                            onClick={autoAssignStaff}
                                            disabled={isAutoAssigning}
                                            className="text-xs flex items-center text-purple-300 hover:text-purple-200 transition-colors"
                                            type="button"
                                            title="Let AI suggest the best staff member based on workload"
                                        >
                                            {isAutoAssigning ? <Loader2 size={12} className="animate-spin mr-1" /> : <Wand2 size={12} className="mr-1" />}
                                            Auto-Assign
                                        </button>
                                    )}
                                </div>

                                {assignSuggestion && (
                                    <div className="mb-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-200 flex items-start">
                                        <Sparkles size={12} className="mr-2 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="font-bold">AI Suggestion:</span> {assignSuggestion}
                                        </div>
                                    </div>
                                )}

                                <div
                                    className={`w-full glass-input rounded-lg px-3 py-2 text-sm min-h-[42px] flex flex-wrap items-center gap-2 cursor-pointer ${!hasEditPermission ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    onClick={() => hasEditPermission && setIsAssignDropdownOpen(!isAssignDropdownOpen)}
                                >
                                    {currentTask.assignedTo && currentTask.assignedTo.length > 0 ? (
                                        currentTask.assignedTo.map(uid => {
                                            const user = usersList.find(u => u.uid === uid);
                                            return (
                                                <span key={uid} className="bg-brand-600/30 text-brand-200 px-2 py-0.5 rounded text-xs flex items-center border border-brand-500/30">
                                                    {user?.displayName}
                                                    {hasEditPermission && <X size={12} className="ml-1 hover:text-white" onClick={(e) => { e.stopPropagation(); toggleAssignee(uid); }} />}
                                                </span>
                                            );
                                        })
                                    ) : <span className="text-gray-500">Select Staff Members...</span>}
                                    <div className="ml-auto"><ChevronDown size={16} className="text-gray-400" /></div>
                                </div>

                                {/* Dropdown Menu */}
                                {isAssignDropdownOpen && (
                                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-navy-800 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                                        {usersList.map(u => {
                                            const isSelected = currentTask.assignedTo?.includes(u.uid);
                                            return (
                                                <div
                                                    key={u.uid}
                                                    className={`px-4 py-2 text-sm hover:bg-white/5 cursor-pointer flex items-center justify-between ${isSelected ? 'bg-brand-600/10 text-brand-300' : 'text-gray-300'}`}
                                                    onClick={() => toggleAssignee(u.uid)}
                                                >
                                                    <div className="flex items-center">
                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-navy-700 to-navy-800 flex items-center justify-center text-[10px] mr-3 border border-white/10">
                                                            {getInitials(u.displayName)}
                                                        </div>
                                                        {u.displayName}
                                                    </div>
                                                    {isSelected && <Check size={14} className="text-brand-400" />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <div><label className="block text-sm font-medium text-gray-300 mb-1">Description</label><textarea rows={3} className="w-full glass-input rounded-lg px-3 py-2 text-sm resize-none" value={currentTask.description} onChange={(e) => setCurrentTask({ ...currentTask, description: e.target.value })} disabled={!hasEditPermission} /></div>
                        </div>

                        {/* Subtasks */}
                        <div className="border-t border-white/10 pt-4 relative z-20">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-200 flex items-center"><CheckSquare size={16} className="mr-2 text-brand-400" /> Subtasks</h4>
                                {hasEditPermission && (
                                    <button
                                        onClick={generateAISubtasks}
                                        disabled={isGeneratingAI}
                                        className="flex items-center text-xs bg-gradient-to-r from-accent-purple to-brand-600 hover:from-accent-purple/80 hover:to-brand-600/80 text-white px-3 py-1 rounded-full shadow-lg transition-all"
                                    >
                                        {isGeneratingAI ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                                        {isGeneratingAI ? 'Generating...' : 'Auto-Generate'}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2 mb-3">{currentTask.subtasks?.map(sub => (<div key={sub.id} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg group hover:bg-white/10 transition-colors"><div className="flex items-center space-x-3"><button onClick={() => toggleSubtask(sub.id)} disabled={!hasEditPermission} className={`text-gray-400 hover:text-emerald-400 ${sub.isCompleted ? 'text-emerald-500' : ''}`}>{sub.isCompleted ? <CheckCircle2 size={18} /> : <div className="w-4 h-4 border border-gray-500 rounded-full"></div>}</button><div className={sub.isCompleted ? 'line-through text-gray-500' : 'text-gray-200'}><span className="text-sm">{sub.title}</span></div></div>{hasEditPermission && (<button onClick={() => deleteSubtask(sub.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>)}</div>))}</div>
                            {hasEditPermission && (<div className="flex space-x-2"><input className="flex-1 glass-input rounded-lg px-3 py-2 text-sm" placeholder="Add subtask..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} /><button onClick={addSubtask} className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm border border-white/10 transition-colors">Add</button></div>)}
                        </div>
                    </div>
                    <div className="p-6 border-t border-white/10 bg-white/5 flex items-center justify-between rounded-b-xl">
                        {isEditMode && user?.role === UserRole.ADMIN ? (
                            <button
                                onClick={handleDeleteTask}
                                className="px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-sm flex items-center border border-transparent hover:border-red-500/20"
                            >
                                <Trash2 size={16} className="mr-2" /> Delete
                            </button>
                        ) : <div></div>}

                        <div className="flex space-x-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-sm">Cancel</button>
                            {hasEditPermission && <button onClick={handleSaveTask} className="px-6 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium shadow-lg shadow-brand-900/50 text-sm transition-all transform hover:-translate-y-0.5">Save Task</button>}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
);
};

export default TasksPage;
