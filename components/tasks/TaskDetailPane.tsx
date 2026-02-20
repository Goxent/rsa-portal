
import React, { useState, useEffect } from 'react';
import {
    X, Save, Trash2, CheckSquare, List,
    MoreHorizontal, Clock, User, Briefcase,
    Calendar, AlertTriangle, MessageSquare, Plus,
    CheckCircle2
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, SubTask, TaskComment } from '../../types';
import TaskComments from '../TaskComments';
import StaffSelect from '../StaffSelect';

interface TaskDetailPaneProps {
    task: Partial<Task>;
    onClose: () => void;
    onSave: (task: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onAddComment: (comment: TaskComment) => void;
    usersList: UserProfile[];
    clientsList: any[];
    canManageTask: boolean;
    isSaving: boolean;
}

const TaskDetailPane: React.FC<TaskDetailPaneProps> = ({
    task,
    onClose,
    onSave,
    onDelete,
    onAddComment,
    usersList,
    clientsList,
    canManageTask,
    isSaving
}) => {
    const [localTask, setLocalTask] = useState<Partial<Task>>(task);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

    useEffect(() => {
        setLocalTask(task);
    }, [task]);

    const handleFieldChange = (field: keyof Task, value: any) => {
        const updated = { ...localTask, [field]: value };
        setLocalTask(updated);
    };

    const addSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const sub: SubTask = {
            id: 'st_' + Date.now(),
            title: newSubtaskTitle,
            isCompleted: false,
            createdBy: 'User',
            createdAt: new Date().toISOString()
        };
        handleFieldChange('subtasks', [...(localTask.subtasks || []), sub]);
        setNewSubtaskTitle('');
    };

    const toggleSubtask = (subId: string) => {
        const updated = localTask.subtasks?.map(st =>
            st.id === subId ? { ...st, isCompleted: !st.isCompleted } : st
        );
        handleFieldChange('subtasks', updated);
    };

    const deleteSubtask = (subId: string) => {
        const updated = localTask.subtasks?.filter(st => st.id !== subId);
        handleFieldChange('subtasks', updated);
    };

    return (
        <div className="w-96 border-l border-white/5 bg-black/20 flex flex-col h-full overflow-hidden shrink-0 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono">Task Details</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onSave(localTask)}
                        disabled={isSaving}
                        className="p-2 hover:bg-emerald-500/10 text-emerald-500 rounded-lg transition-colors"
                        title="Save Changes"
                    >
                        <Save size={18} />
                    </button>
                    {localTask.id && canManageTask && (
                        <button
                            onClick={() => onDelete(localTask.id as string)}
                            className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                            title="Delete Task"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 text-gray-400 rounded-lg transition-colors ml-2"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                {/* Title & Description */}
                <div className="space-y-4">
                    <textarea
                        value={localTask.title || ''}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        placeholder="Task Title"
                        className="w-full bg-transparent border-none text-xl font-bold text-white placeholder:text-gray-600 focus:ring-0 p-0 resize-none min-h-[40px]"
                    />
                    <textarea
                        value={localTask.description || ''}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        placeholder="Add description..."
                        className="w-full bg-transparent border-none text-sm text-gray-400 placeholder:text-gray-700 focus:ring-0 p-0 resize-none min-h-[100px]"
                    />
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-24 text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                            <Clock size={12} /> Status
                        </div>
                        <select
                            value={localTask.status}
                            onChange={(e) => handleFieldChange('status', e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none"
                        >
                            {Object.values(TaskStatus).map(s => (
                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-24 text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                            <AlertTriangle size={12} /> Priority
                        </div>
                        <select
                            value={localTask.priority}
                            onChange={(e) => handleFieldChange('priority', e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none"
                        >
                            {Object.values(TaskPriority).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-24 text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                            <Calendar size={12} /> Due Date
                        </div>
                        <input
                            type="date"
                            value={localTask.dueDate}
                            onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none"
                        />
                    </div>
                </div>

                {/* Assignees */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <User size={12} /> Assignees
                    </h3>
                    <StaffSelect
                        value={localTask.assignedTo || []}
                        onChange={(uids) => handleFieldChange('assignedTo', uids)}
                        users={usersList}
                        multi={true}
                    />
                </div>

                {/* Subtasks */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <CheckSquare size={12} /> Subtasks
                    </h3>
                    <div className="space-y-2">
                        {localTask.subtasks?.map(st => (
                            <div key={st.id} className="group flex items-center justify-between bg-white/5 p-2.5 rounded-lg border border-white/5 hover:border-white/10 transition-all">
                                <div className="flex items-center gap-3 flex-1">
                                    <button
                                        onClick={() => toggleSubtask(st.id)}
                                        className={`transition-colors ${st.isCompleted ? 'text-emerald-500' : 'text-gray-600 hover:text-gray-400'}`}
                                    >
                                        <CheckCircle2 size={18} />
                                    </button>
                                    <span className={`text-xs ${st.isCompleted ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{st.title}</span>
                                </div>
                                <button onClick={() => deleteSubtask(st.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Add a subtask..."
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addSubtask()}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none placeholder:text-gray-600"
                        />
                        <button onClick={addSubtask} className="p-2 bg-brand-500/10 text-brand-400 rounded-lg hover:bg-brand-500/20 transition-all">
                            <Plus size={18} />
                        </button>
                    </div>
                </div>

                {/* Comments */}
                <div className="pt-8 border-t border-white/5 space-y-4">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <MessageSquare size={12} /> Comments
                    </h3>
                    <TaskComments
                        comments={localTask.comments || []}
                        onAddComment={onAddComment}
                        users={usersList}
                    />
                </div>
            </div>
        </div>
    );
};

export default TaskDetailPane;
