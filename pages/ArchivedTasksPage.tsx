import React, { useState, useEffect, useMemo } from 'react';
import {
    Archive, ChevronLeft, Search, Filter, Calendar,
    Briefcase, Clock, CheckCircle2, FileText, Eye,
    Download, User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Task, UserRole, TaskStatus, AuditPhase, UserProfile, Client, SubTask, TaskComment, Template } from '../types';
import { AuthService } from '../services/firebase';
import { AuditDocService, AuditDocFile } from '../services/auditDocs';
import { useAuth } from '../context/AuthContext';
import { generateFiscalYearOptions } from '../utils/nepaliDate';
import { useUsers } from '../hooks/useStaff';
import { useClients } from '../hooks/useClients';
import { useTemplates } from '../hooks/useTemplates';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
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
        // Allow state updates so the pane doesn't crash, but don't persist
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
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-gray-400 hover:text-white">
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <Archive className="text-amber-400" size={22} />
                            </div>
                            Archived Tasks
                        </h1>
                        <p className="text-[13px] text-gray-500 mt-1">Review historical engagement records by fiscal year</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-400">Fiscal Year:</span>
                    <select value={selectedFY} onChange={(e) => setSelectedFY(e.target.value)}
                        className="bg-transparent text-xs font-bold text-amber-400 focus:outline-none cursor-pointer">
                        {generateFiscalYearOptions(2080).reverse().map(fy => (
                            <option key={fy} value={fy} className="bg-navy-900 text-white font-sans">{fy}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-panel p-3 rounded-2xl">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                    <input type="text" placeholder="Search archives by title or client..."
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Filter size={14} />
                    <span>Showing {filteredTasks.length} archived records</span>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-sm text-gray-500 font-medium">Retrieving historical records...</p>
                </div>
            ) : filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredTasks.map((task, idx) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => handleOpenTask(task)}
                                className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-all group relative overflow-hidden cursor-pointer hover:shadow-[0_10px_40px_rgba(245,158,11,0.08)]"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Archive size={40} className="text-amber-400" />
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <div className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold w-fit">
                                            FY {task.archivedFiscalYear}
                                        </div>
                                        <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1 uppercase tracking-tight">
                                            {task.title}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <Briefcase size={12} className="text-gray-500" />
                                            <span className="truncate">{task.clientName || 'No Client'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400">
                                            {task.status === TaskStatus.ARCHIVED ? (
                                                <><Archive size={12} className="text-amber-500" /><span>Archived</span></>
                                            ) : (
                                                <><CheckCircle2 size={12} className="text-brand-500" /><span>Completed</span></>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400 col-span-2">
                                            <Clock size={12} className="text-gray-500" />
                                            <span>{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            {task.assignedToNames?.slice(0, 3).map((name, i) => (
                                                <div key={i} className="w-6 h-6 rounded-full bg-navy-800 border border-navy-950 flex items-center justify-center text-[8px] font-bold text-gray-400 ring-2 ring-navy-950" title={name}>
                                                    {name[0]}
                                                </div>
                                            ))}
                                            {task.assignedToNames && task.assignedToNames.length > 3 && (
                                                <div className="w-6 h-6 rounded-full bg-navy-800 border border-navy-950 flex items-center justify-center text-[8px] font-bold text-gray-400 ring-2 ring-navy-950">
                                                    +{task.assignedToNames.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all text-[10px] font-bold uppercase tracking-widest border border-amber-500/20">
                                            <Eye size={12} /> View Details
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 text-gray-500 glass-panel rounded-3xl border-dashed border-white/10">
                    <Archive size={48} className="mb-4 opacity-10" />
                    <p className="font-medium text-gray-400">No archived tasks found for FY {selectedFY}</p>
                    <p className="text-xs mt-1">Archived records will appear here after they are moved from settings.</p>
                </div>
            )}

            {/* ── REUSE TaskDetailPane in VIEW-ONLY mode ── */}
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
