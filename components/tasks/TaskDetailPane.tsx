import React from 'react';
import {
    X, Edit2, ShieldAlert, Tag, Calendar, UserCircle2,
    Briefcase, Activity, AlertTriangle, Clock, Plus,
    Trash2, Save, Loader2, CheckCircle2
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, UserProfile, Client, SubTask, TaskComment } from '../../types';
import StaffSelect from '../StaffSelect';
import ClientSelect from '../ClientSelect';
import TaskComments from '../TaskComments';
import NepaliDatePicker from '../NepaliDatePicker';
import { motion, AnimatePresence } from 'framer-motion';

interface TaskDetailPaneProps {
    task: Partial<Task>;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    onDelete: (id: string) => void;
    onChange: (updates: Partial<Task>) => void;
    usersList: UserProfile[];
    clientsList: Client[];
    isSaving: boolean;
    isEditMode: boolean;
    canManageTask: boolean;
    dateMode: 'AD' | 'BS';
    setDateMode: (mode: 'AD' | 'BS') => void;
    newSubtaskTitle: string;
    setNewSubtaskTitle: (title: string) => void;
    onAddSubtask: () => void;
    onRemoveSubtask: (id: string) => void;
    onAddComment: (comment: TaskComment) => void;
}

const TaskDetailPane: React.FC<TaskDetailPaneProps> = ({
    task,
    isOpen,
    onClose,
    onSave,
    onDelete,
    onChange,
    usersList,
    clientsList,
    isSaving,
    isEditMode,
    canManageTask,
    dateMode,
    setDateMode,
    newSubtaskTitle,
    setNewSubtaskTitle,
    onAddSubtask,
    onRemoveSubtask,
    onAddComment
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Centered Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{
                            type: 'spring',
                            damping: 25,
                            stiffness: 300,
                            mass: 0.8
                        }}
                        className="relative w-full max-w-4xl bg-[var(--bg-secondary)] shadow-2xl border border-white/10 flex flex-col max-h-[90vh] rounded-[32px] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="shrink-0 px-8 py-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-full h-1 ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' :
                                task.status === TaskStatus.HALTED ? 'bg-rose-500' :
                                    task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                                        task.status === TaskStatus.UNDER_REVIEW ? 'bg-amber-500' : 'bg-gray-500'
                                }`} />
                            <div>
                                <h3 className="text-xl font-black text-white tracking-wide uppercase flex items-center gap-2">
                                    {isEditMode ? <Edit2 size={18} className="text-blue-400" /> : <Plus size={18} className="text-blue-400" />}
                                    {isEditMode ? 'EDIT TASK' : 'NEW TASK'}
                                </h3>
                                {isEditMode && task.id && (
                                    <p className="text-[10px] text-gray-500 font-mono mt-1">ID: #{task.id.substring(0, 6).toUpperCase()}</p>
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:text-white transition-all hover:bg-white/10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 md:p-10 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                            <div className="flex flex-col gap-10 max-w-4xl mx-auto w-full pb-8">
                                {/* Title & Description */}
                                <div className="space-y-6">
                                    <div className="space-y-2 group">
                                        <input
                                            autoFocus
                                            className="w-full bg-transparent text-3xl md:text-4xl font-black text-white placeholder:text-gray-700 placeholder:font-bold focus:outline-none focus:ring-0 border-none px-0 transition-all placeholder:tracking-tight ring-0"
                                            placeholder="Task Title..."
                                            value={task.title || ''}
                                            onChange={(e) => onChange({ title: e.target.value })}
                                        />
                                        <div className="w-full h-[1px] bg-white/5 group-focus-within:bg-blue-500/50 transition-colors" />
                                    </div>
                                    <div>
                                        <textarea
                                            className="w-full bg-white/5 border border-white/5 focus:border-blue-500/50 rounded-2xl min-h-[140px] p-5 text-sm resize-none text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                                            placeholder="Add a more detailed description... (Type @ to mention staff)"
                                            value={task.description || ''}
                                            onChange={(e) => onChange({ description: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20 p-6 rounded-3xl border border-white/5 shadow-2xl">
                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <Activity size={12} className="text-blue-400" /> Status
                                        </label>
                                        <select
                                            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none p-1 cursor-pointer"
                                            value={task.status}
                                            onChange={(e) => onChange({ status: e.target.value as TaskStatus })}
                                        >
                                            {Object.values(TaskStatus).map(s => <option key={s} value={s} className="bg-[#1e293b]">{s.replace('_', ' ')}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <AlertTriangle size={12} className={task.priority === 'URGENT' ? 'text-rose-400' : 'text-orange-400'} /> Priority
                                        </label>
                                        <select
                                            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none p-1 cursor-pointer"
                                            value={task.priority}
                                            onChange={(e) => onChange({ priority: e.target.value as TaskPriority })}
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
                                            value={task.clientIds?.[0] || ''}
                                            onChange={(val) => {
                                                const c = clientsList.find(c => c.id === val);
                                                if (c) onChange({ clientIds: [val as string], clientName: c.name });
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                                <Calendar size={12} className="text-emerald-400" /> Due Date
                                            </label>
                                            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                                                {(['AD', 'BS'] as const).map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setDateMode(mode)}
                                                        className={`px-2 py-0.5 rounded font-bold text-[9px] transition-all ${dateMode === mode ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}
                                                    >
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        {dateMode === 'AD' ? (
                                            <input
                                                type="date"
                                                value={task.dueDate || ''}
                                                onChange={(e) => onChange({ dueDate: e.target.value })}
                                                className="w-full bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer"
                                            />
                                        ) : (
                                            <NepaliDatePicker
                                                value={task.dueDate || ''}
                                                onChange={(adDate) => onChange({ dueDate: adDate })}
                                                placeholder="Select Date"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <ShieldAlert size={12} className="text-amber-400" /> Team Leader
                                        </label>
                                        <select
                                            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none p-1 cursor-pointer"
                                            value={task.teamLeaderId || ''}
                                            onChange={(e) => onChange({ teamLeaderId: e.target.value })}
                                        >
                                            <option value="" className="bg-transparent text-gray-900">- Select Leader -</option>
                                            {usersList
                                                .filter(u => task.assignedTo?.includes(u.uid))
                                                .map(u => (
                                                    <option key={u.uid} value={u.uid} className="bg-transparent text-gray-900">{u.displayName}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05]">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <UserCircle2 size={12} className="text-cyan-400" /> Assignees
                                        </label>
                                        <StaffSelect
                                            users={usersList}
                                            value={task.assignedTo || []}
                                            onChange={(val) => onChange({ assignedTo: val as string[] })}
                                            multi={true}
                                        />
                                    </div>

                                    <div className="space-y-2 bg-white/[0.02] p-4 rounded-2xl border border-white/[0.05] md:col-span-2 border-t-blue-500/20 border-t-2">
                                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                                            <Clock size={12} /> Time Logged (Minutes)
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-32 bg-black/40 text-lg font-black text-white p-3 rounded-xl border border-white/5 focus:border-blue-500/50 focus:outline-none text-center"
                                                value={task.totalTimeSpent || ''}
                                                onChange={(e) => onChange({ totalTimeSpent: parseInt(e.target.value) || 0 })}
                                                placeholder="0"
                                            />
                                            <span className="text-xs text-gray-500 font-bold max-w-[200px] leading-relaxed">
                                                Track total time spent working on this task.
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Subtasks */}
                                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-between ml-1">
                                        <span>Subtasks ({task.subtasks?.length || 0})</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            placeholder="Add a subtask..."
                                            className="flex-1 glass-input text-sm"
                                            onKeyDown={(e) => e.key === 'Enter' && onAddSubtask()}
                                        />
                                        <button
                                            onClick={onAddSubtask}
                                            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-all font-bold text-sm flex items-center gap-2"
                                        >
                                            <Plus size={16} /> Add
                                        </button>
                                    </div>
                                    {task.subtasks?.map((st, i) => (
                                        <div key={st.id} className="flex flex-col gap-3 p-4 bg-black/20 rounded-xl border border-white/5 group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={st.isCompleted}
                                                        onChange={(e) => {
                                                            const updated = [...(task.subtasks || [])];
                                                            updated[i].isCompleted = e.target.checked;
                                                            onChange({ subtasks: updated });
                                                        }}
                                                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-500/50 cursor-pointer appearance-none checked:bg-blue-500 transition-colors mt-0.5 shrink-0 relative flex items-center justify-center after:content-['\2713'] after:absolute after:text-white after:opacity-0 checked:after:opacity-100 after:text-sm after:font-bold"
                                                    />
                                                    <div className="flex flex-col gap-2 flex-1">
                                                        <span className={`text-[14px] font-bold leading-tight ${st.isCompleted ? 'line-through text-gray-600' : 'text-gray-200 group-hover:text-blue-200 transition-colors'}`}>
                                                            {st.title}
                                                        </span>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <UserCircle2 size={14} className="text-gray-500" />
                                                            <select
                                                                className="bg-transparent text-xs font-bold text-gray-400 focus:text-white focus:outline-none cursor-pointer hover:text-gray-300"
                                                                value={st.assignedTo || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...(task.subtasks || [])];
                                                                    updated[i].assignedTo = e.target.value;
                                                                    onChange({ subtasks: updated });
                                                                }}
                                                            >
                                                                <option value="" className="bg-transparent text-gray-900">- Unassigned -</option>
                                                                {usersList.map((u) => (
                                                                    <option key={u.uid} value={u.uid} className="bg-transparent text-gray-900">{u.displayName}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveSubtask(st.id)}
                                                    className="text-gray-500 hover:text-rose-400 p-2 opacity-0 group-hover:opacity-100 transition-all bg-white/5 rounded-lg ml-4 shrink-0"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Comments */}
                                <div className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Activity & Comments</h4>
                                    <div className="bg-black/20 rounded-xl p-4">
                                        <TaskComments
                                            comments={task.comments || []}
                                            onAddComment={onAddComment}
                                            users={usersList}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-8 py-6 border-t border-white/10 flex justify-between items-center bg-black/20">
                            {isEditMode && canManageTask ? (
                                <button
                                    onClick={() => onDelete(task.id!)}
                                    className="px-4 py-2 text-red-400 hover:text-red-300 text-sm font-bold flex items-center gap-2 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-all border border-red-500/20"
                                >
                                    <Trash2 size={16} /> Delete Task
                                </button>
                            ) : <div />}
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 text-gray-400 hover:text-white text-sm font-bold bg-white/5 rounded-xl transition-all border border-white/5 hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onSave}
                                    disabled={isSaving}
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 group"
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} className="group-hover:scale-110 transition-transform" />}
                                    {isEditMode ? 'Update Task' : 'Create Task'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default TaskDetailPane;
