import React, { useState, useEffect } from 'react';
import {
    Archive, ChevronLeft, Search, Filter, Calendar,
    Briefcase, Clock, CheckCircle2, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Task, UserRole, TaskStatus } from '../types';
import { AuthService } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { generateFiscalYearOptions } from '../utils/nepaliDate';
import { useUsers } from '../hooks/useStaff';
import { useClients } from '../hooks/useClients';
import { useTemplates } from '../hooks/useTemplates';
import { toast } from 'react-hot-toast';
import TaskDetailPane from '../components/tasks/TaskDetailPane';

const ArchivedTasksPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFY, setSelectedFY] = useState<string>('');

    // Detail pane state (reusing TaskDetailPane)
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [dateMode, setDateMode] = useState<'AD' | 'BS'>('AD');

    // Data for TaskDetailPane
    const { data: usersList = [] } = useUsers();
    const { data: clientsList = [] } = useClients();
    const { data: templates = [] } = useTemplates();

    useEffect(() => {
        if (!isAdmin) { navigate('/dashboard'); return; }
        const fvs = generateFiscalYearOptions(2080).reverse();
        setSelectedFY(fvs[0]);
    }, [isAdmin, navigate]);

    useEffect(() => {
        if (selectedFY) loadArchivedTasks();
    }, [selectedFY]);

    const loadArchivedTasks = async () => {
        setLoading(true);
        try {
            const data = await AuthService.getArchivedTasks(selectedFY);
            setTasks(data);
        } catch (error) {
            console.error('Error loading archived tasks:', error);
            toast.error('Failed to load archived records');
        } finally { setLoading(false); }
    };

    const handleOpenTask = (task: Task) => {
        setCurrentTask(task);
        setIsDetailOpen(true);
    };

    const handleCloseDetail = () => {
        setIsDetailOpen(false);
        setCurrentTask({});
    };

    // No-op handlers for read-only mode
    const noopSave = () => { toast.error('Archived tasks are read-only'); };
    const noopDelete = () => { toast.error('Archived tasks cannot be deleted from here'); };
    const noopChange = (updates: Partial<Task>) => {
        setCurrentTask(prev => ({ ...prev, ...updates }));
    };
    const noopAddSubtask = () => { toast.error('Cannot modify archived tasks'); };
    const noopAddComment = () => { toast.error('Cannot add comments to archived tasks'); };

    const filteredTasks = tasks.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isAdmin) return null;

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                        title="Go back"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--text-heading)] flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-[rgba(217,164,65,0.1)] border border-[rgba(217,164,65,0.25)] text-[var(--color-warning)]">
                                <Archive size={20} />
                            </div>
                            Archived Tasks
                        </h1>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Review historical engagement records by fiscal year</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
                    <Calendar size={14} className="text-[var(--text-muted)]" />
                    <span className="text-xs font-medium text-[var(--text-muted)]">Fiscal year:</span>
                    <select
                        value={selectedFY}
                        onChange={(e) => setSelectedFY(e.target.value)}
                        className="bg-transparent text-xs font-semibold text-[var(--color-warning)] focus:outline-none cursor-pointer"
                    >
                        {generateFiscalYearOptions(2080).reverse().map(fy => (
                            <option key={fy} value={fy} className="bg-[var(--bg-surface)] text-[var(--text-heading)] font-sans">{fy}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-[var(--text-muted)]" size={15} />
                    <input
                        type="text"
                        placeholder="Search archives by title or client..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-heading)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Filter size={14} />
                    <span className="tabular-nums">Showing {filteredTasks.length} archived records</span>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
                    <p className="text-xs text-[var(--text-muted)] font-medium">Retrieving historical records...</p>
                </div>
            ) : filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            onClick={() => handleOpenTask(task)}
                            className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-mid)] transition-colors group relative overflow-hidden cursor-pointer"
                        >
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="px-2 py-0.5 rounded-md bg-[rgba(217,164,65,0.1)] text-[var(--color-warning)] border border-[rgba(217,164,65,0.25)] text-[11px] font-medium w-fit tabular-nums">
                                        FY {task.archivedFiscalYear}
                                    </div>
                                    <h3 className="text-sm font-semibold text-[var(--text-heading)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                                        {task.title}
                                    </h3>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                        <Briefcase size={12} className="shrink-0" />
                                        <span className="truncate">{task.clientName || 'No client'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                        {task.status === TaskStatus.ARCHIVED ? (
                                            <><Archive size={12} className="text-[var(--color-warning)] shrink-0" /><span>Archived</span></>
                                        ) : (
                                            <><CheckCircle2 size={12} className="text-[var(--accent)] shrink-0" /><span>Completed</span></>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[var(--text-muted)] col-span-2">
                                        <Clock size={12} className="shrink-0" />
                                        <span className="tabular-nums">{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
                                    <div className="flex -space-x-1.5">
                                        {task.assignedToNames?.slice(0, 3).map((name, i) => (
                                            <div
                                                key={i}
                                                className="w-6 h-6 rounded-full bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center text-[10px] font-medium text-[var(--accent)]"
                                                title={name}
                                            >
                                                {name[0]}
                                            </div>
                                        ))}
                                        {task.assignedToNames && task.assignedToNames.length > 3 && (
                                            <div className="w-6 h-6 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[10px] font-medium text-[var(--text-muted)] tabular-nums">
                                                +{task.assignedToNames.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgba(217,164,65,0.1)] text-[var(--color-warning)] hover:bg-[rgba(217,164,65,0.18)] transition-colors text-xs font-medium border border-[rgba(217,164,65,0.25)]">
                                        <Eye size={12} /> View details
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 text-[var(--text-muted)] rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)]">
                    <Archive size={36} className="mb-3 opacity-30 text-[var(--text-muted)]" />
                    <p className="font-medium text-sm text-[var(--text-heading)]">No archived tasks found for FY {selectedFY}</p>
                    <p className="text-xs mt-1 text-[var(--text-muted)]">Archived records will appear here after they are moved from settings.</p>
                </div>
            )}

            {/* Reusing TaskDetailPane in view-only mode */}
            <TaskDetailPane
                task={currentTask}
                isOpen={isDetailOpen}
                onClose={handleCloseDetail}
                onSave={noopSave}
                onDelete={noopDelete}
                onChange={noopChange}
                usersList={usersList}
                clientsList={clientsList}
                templates={templates}
                isSaving={false}
                isEditMode={false}
                canManageTask={false}
                dateMode={dateMode}
                setDateMode={setDateMode}
                newSubtaskTitle={newSubtaskTitle}
                setNewSubtaskTitle={setNewSubtaskTitle}
                onAddSubtask={noopAddSubtask}
                onAddComment={noopAddComment as any}
                isArchived={true}
            />
        </div>
    );
};

export default ArchivedTasksPage;
