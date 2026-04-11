import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    ArrowLeft, User, Briefcase, Mail, Phone, Calendar as CalIcon,
    CheckCircle2, Clock, CalendarDays, Activity, Building2, Tag, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { AuthService, getAttendanceByUserId, getAuditLogsByUserId } from '../services/firebase';
import { useTasks } from '../hooks/useTasks';
import { clientKeys } from '../hooks/useClients';
import { userKeys } from '../hooks/useStaff';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import NepaliDate from 'nepali-date-converter';
import { Task } from '../types';
import { getAvatarColor, getInitials } from '../utils/userUtils';

type StaffTab = 'OVERVIEW' | 'TASKS' | 'ATTENDANCE' | 'LEAVE' | 'CLIENTS' | 'ACTIVITY';

const StaffDetailPage: React.FC = () => {
    const { staffId } = useParams<{ staffId: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<StaffTab>('OVERVIEW');
    const [taskFilter, setTaskFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED'>('ALL');
    const [expandedAttendanceRows, setExpandedAttendanceRows] = useState<string[]>([]);

    // Fetch all users
    const { data: allStaff = [], isLoading: staffLoading } = useQuery({ 
        queryKey: userKeys.all, 
        queryFn: AuthService.getAllUsers 
    });
    
    const staff = allStaff.find(s => s.uid === staffId);

    // Fetch tasks
    const { data: allTasks = [], isLoading: tasksLoading } = useTasks();
    const staffTasks = useMemo(() => 
        allTasks.filter(t => t.assignedTo.includes(staffId!)), 
        [allTasks, staffId]
    );

    // Fetch attendance
    const { data: attendanceRecords = [] } = useQuery({
        queryKey: ['attendance', 'user', staffId],
        queryFn: () => getAttendanceByUserId(staffId!, 60),
        enabled: !!staffId
    });

    // Fetch leave requests
    const { data: allLeave = [] } = useQuery({
        queryKey: ['leave', staffId],
        queryFn: () => AuthService.getAllLeaves(staffId)
    });
    const staffLeave = useMemo(() => 
        allLeave.filter(l => l.userId === staffId), 
        [allLeave, staffId]
    );

    // Fetch activity logs
    const { data: staffActivityLogs = [] } = useQuery({
        queryKey: ['auditLogs', 'user', staffId],
        queryFn: () => getAuditLogsByUserId(staffId!),
        enabled: !!staffId
    });

    // Fetch clients
    const { data: allClients = [] } = useQuery({ 
        queryKey: clientKeys.all, 
        queryFn: AuthService.getAllClients 
    });
    const assignedClients = useMemo(() =>
        allClients.filter(c => c.auditorId === staffId),
        [allClients, staffId]
    );

    if (staffLoading || tasksLoading) return <PageLoader />;

    if (!staff) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-white">
                <AlertTriangle size={48} className="text-rose-500 mb-4" />
                <h2 className="text-2xl font-bold">Staff member not found</h2>
                <button onClick={() => navigate('/staff')} className="mt-4 text-amber-400 hover:text-amber-300">
                    ← Back to Directory
                </button>
            </div>
        );
    }

    // Computed Stats
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const tasksCompletedThisMonth = staffTasks.filter(t => 
        t.status === 'COMPLETED' && 
        new Date(t.completedAt || t.createdAt).getMonth() === currentMonth &&
        new Date(t.completedAt || t.createdAt).getFullYear() === currentYear
    ).length;
    const overdueTasks = staffTasks.filter(t => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date());
    const attendanceThisMonth = attendanceRecords.filter(a => 
        new Date(a.date).getMonth() === currentMonth &&
        new Date(a.date).getFullYear() === currentYear
    );

    const toggleAttendanceRow = (id: string) => {
        setExpandedAttendanceRows(prev => 
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    const avatarStyle = getAvatarColor(staff.uid);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Nav */}
            <button onClick={() => navigate('/staff')} className="flex items-center text-gray-400 hover:text-white transition-colors text-sm font-medium">
                <ArrowLeft size={16} className="mr-2" /> Back to Staff Directory
            </button>

            {/* Header Card */}
            <div className="glass-panel p-6 rounded-2xl border border-white/10 relative overflow-hidden group">
                <div className={`absolute top-0 right-0 w-64 h-64 ${avatarStyle.bg} rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-20`}></div>
                <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center">
                    {/* Avatar */}
                    <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${avatarStyle.from} ${avatarStyle.to} flex items-center justify-center text-3xl font-black ${avatarStyle.text} shadow-xl border ${avatarStyle.border} shrink-0`}>
                        {getInitials(staff.displayName)}
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-3xl font-bold text-white tracking-tight">{staff.displayName}</h1>
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                                {staff.role.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 border border-white/5 backdrop-blur-sm">
                                <span className={`w-2 h-2 rounded-full ${staff.status === 'Active' ? 'bg-brand-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                <span className={`text-xs font-bold uppercase tracking-wider ${staff.status === 'Active' ? 'text-brand-400' : 'text-rose-400'}`}>
                                    {staff.status}
                                </span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 mt-4 text-sm text-gray-300">
                            <div className="flex items-center gap-2">
                                <Building2 size={14} className="text-gray-500" />
                                {staff.department || 'General'} | {staff.position || 'Staff'}
                            </div>
                            <div className="flex items-center gap-2">
                                <CalIcon size={14} className="text-gray-500" />
                                Joined: {staff.dateOfJoining ? new Date(staff.dateOfJoining).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-gray-500" />
                                {staff.email}
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone size={14} className="text-gray-500" />
                                {staff.phoneNumber || 'No phone number'}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 shrink-0">
                         <div className="text-center px-4 border-r border-white/10">
                            <p className="text-2xl font-black text-white">{staffTasks.filter(t => t.status === 'IN_PROGRESS').length}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Tasks</p>
                         </div>
                         <div className="text-center px-4 border-r border-white/10">
                            <p className="text-2xl font-black text-brand-400">{tasksCompletedThisMonth}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Done (Mo)</p>
                         </div>
                         <div className="text-center px-4">
                            <p className={`text-2xl font-black ${overdueTasks.length > 0 ? 'text-rose-400' : 'text-white'}`}>{overdueTasks.length}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Overdue</p>
                         </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="space-y-6">
                <div className="flex gap-1 overflow-x-auto pb-2 border-b border-white/10 hide-scrollbar">
                    {(['OVERVIEW', 'TASKS', 'ATTENDANCE', 'LEAVE', 'CLIENTS', 'ACTIVITY'] as StaffTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                                activeTab === tab
                                    ? 'bg-white/10 text-white border-b-2 border-brand-500'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab === 'OVERVIEW' && <User size={15} />}
                            {tab === 'TASKS' && <CheckCircle2 size={15} />}
                            {tab === 'ATTENDANCE' && <Clock size={15} />}
                            {tab === 'LEAVE' && <CalendarDays size={15} />}
                            {tab === 'CLIENTS' && <Building2 size={15} />}
                            {tab === 'ACTIVITY' && <Activity size={15} />}
                            {tab === 'TASKS' ? `Tasks (${staffTasks.length})` :
                             tab === 'CLIENTS' ? `Clients (${assignedClients.length})` :
                             tab}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Task Health */}
                                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-amber-400" /> Task Health
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-400">In Progress</span>
                                            <span className="text-amber-400 font-bold">{staffTasks.filter(t => t.status === 'IN_PROGRESS').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-400">Not Started</span>
                                            <span className="text-gray-300 font-bold">{staffTasks.filter(t => t.status === 'NOT_STARTED').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-400">Under Review</span>
                                            <span className="text-amber-400 font-bold">{staffTasks.filter(t => t.status === 'UNDER_REVIEW').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm pt-2 border-t border-white/5">
                                            <span className="text-gray-400">Completed (This Month)</span>
                                            <span className="text-brand-400 font-bold">{tasksCompletedThisMonth}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-rose-400 font-bold">
                                            <span>Overdue</span>
                                            <span>{overdueTasks.length}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Attendance Summary */}
                                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Clock size={14} className="text-brand-400" /> Attendance (This Month)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center p-3 bg-white/5 rounded-xl">
                                            <p className="text-2xl font-black text-white">{attendanceThisMonth.length}</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">Present Days</p>
                                        </div>
                                        <div className="text-center p-3 bg-white/5 rounded-xl">
                                            <p className="text-2xl font-black text-amber-400">{attendanceThisMonth.filter(a => a.status === 'LATE').length}</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">Late Days</p>
                                        </div>
                                        <div className="text-center p-3 bg-white/5 rounded-xl col-span-2">
                                            <p className="text-2xl font-black text-amber-400">
                                                {attendanceThisMonth.reduce((sum, a) => sum + (a.workHours || 0), 0).toFixed(1)}
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">Total Hours</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Client Assignments */}
                                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Building2 size={14} className="text-purple-400" /> Focal Person For
                                    </h4>
                                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {assignedClients.length > 0 ? assignedClients.map(c => (
                                            <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/10">
                                                <div>
                                                    <p className="text-sm font-bold text-white leading-tight">{c.name}</p>
                                                    <p className="text-xs text-gray-500">{c.code}</p>
                                                </div>
                                                <span className={`w-2 h-2 rounded-full ${c.status === 'Active' ? 'bg-brand-500' : 'bg-rose-500'}`}></span>
                                            </div>
                                        )) : (
                                            <p className="text-sm text-gray-500 italic">Not assigned as focal person for any clients.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent 5 Tasks */}
                            <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Tag size={14} className="text-brand-400" /> Recent Tasks
                                </h4>
                                <div className="space-y-3">
                                    {staffTasks.slice(0, 5).map(task => {
                                        const isOverdue = task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();
                                        return (
                                            <div key={task.id} onClick={() => navigate(`/tasks?search=${task.title}`)} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-white/5 hover:border-brand-500/30 cursor-pointer transition-all">
                                                <div>
                                                    <p className={`text-sm font-medium ${isOverdue ? 'text-rose-400' : 'text-gray-200'}`}>{task.title}</p>
                                                    <p className="text-xs text-gray-500">{task.clientName || 'Internal'}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                                        task.status === 'COMPLETED' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                                                        task.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                        task.status === 'UNDER_REVIEW' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                                    }`}>
                                                        {task.status.replace('_', ' ')}
                                                    </span>
                                                    {task.dueDate && <span className="text-[10px] text-gray-500 font-mono">{new Date(task.dueDate).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {staffTasks.length === 0 && <p className="text-sm text-gray-500 italic">No tasks assigned yet.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TASKS TAB */}
                    {activeTab === 'TASKS' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-4">
                                {['ALL', 'ACTIVE', 'OVERDUE', 'COMPLETED'].map(filter => (
                                    <button 
                                        key={filter} 
                                        onClick={() => setTaskFilter(filter as any)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${taskFilter === filter ? 'bg-brand-600 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {staffTasks.filter(t => {
                                    if (taskFilter === 'ACTIVE') return t.status !== 'COMPLETED' && t.status !== 'ARCHIVED';
                                    if (taskFilter === 'COMPLETED') return t.status === 'COMPLETED';
                                    if (taskFilter === 'OVERDUE') return t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();
                                    return true;
                                }).map(task => {
                                    const isOverdue = task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();
                                    return (
                                        <div key={task.id} className={`glass-card p-5 rounded-2xl hover:border-brand-500/30 transition-all cursor-pointer ${isOverdue ? 'border-rose-500/30 bg-rose-500/5' : ''}`} onClick={() => navigate('/tasks')}>
                                            <div className="flex justify-between items-start mb-3 gap-2">
                                                <h4 className={`font-bold text-sm line-clamp-2 ${isOverdue ? 'text-rose-100' : 'text-white'}`}>{task.title}</h4>
                                                <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                                    task.status === 'COMPLETED' ? 'bg-brand-500/20 text-brand-400 border-brand-500/30' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                    task.status === 'UNDER_REVIEW' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                    'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                                }`}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mb-4">{task.clientName || 'Internal Task'}</p>
                                            <div className="flex items-center justify-between text-xs text-gray-400 mt-4 pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[9px] uppercase ${task.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' : task.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                                        {task.priority}
                                                    </span>
                                                    <div className={`flex items-center gap-1 pb-0.5 pt-0.5 ${isOverdue ? 'text-rose-400 font-bold' : ''}`}>
                                                        <CalIcon size={12} /> 
                                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Date'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {staffTasks.length === 0 && (
                                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                                        <EmptyState icon={CheckCircle2} title="No tasks found" description="No tasks matching the current filter." />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ATTENDANCE TAB */}
                    {activeTab === 'ATTENDANCE' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="glass-panel p-4 rounded-xl flex gap-6 text-center divide-x divide-white/10">
                                <div className="flex-1"><p className="text-2xl font-black text-white">{attendanceRecords.length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Days Logged (60d)</p></div>
                                <div className="flex-1"><p className="text-2xl font-black text-brand-400">{attendanceRecords.filter(a => a.status === 'PRESENT').length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">On Time</p></div>
                                <div className="flex-1"><p className="text-2xl font-black text-amber-400">{attendanceRecords.filter(a => a.status === 'LATE').length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Late</p></div>
                                <div className="flex-1"><p className="text-2xl font-black text-amber-400">{attendanceRecords.reduce((sum, a) => sum + (a.workHours || 0), 0).toFixed(1)}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Total Hours</p></div>
                            </div>
                            
                            {attendanceRecords.length > 0 ? (
                                <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                                                <th className="p-4 text-left font-bold">Date</th>
                                                <th className="p-4 text-left font-bold">Clock In</th>
                                                <th className="p-4 text-left font-bold">Clock Out</th>
                                                <th className="p-4 text-center font-bold">Hours</th>
                                                <th className="p-4 text-center font-bold">Status</th>
                                                <th className="p-4 text-left font-bold">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendanceRecords.map(record => {
                                                const isExpanded = expandedAttendanceRows.includes(record.id!);
                                                const hasWorkLogs = record.workLogs && record.workLogs.length > 0;
                                                return (
                                                    <React.Fragment key={record.id}>
                                                        <tr className={`border-b border-white/5 hover:bg-white/5 ${hasWorkLogs ? 'cursor-pointer' : ''}`} onClick={() => hasWorkLogs && toggleAttendanceRow(record.id!)}>
                                                            <td className="p-4 text-gray-300 font-medium flex items-center gap-2">
                                                                {hasWorkLogs && (isExpanded ? <ChevronUp size={14} className="text-brand-400" /> : <ChevronDown size={14} className="text-gray-500" />)}
                                                                {new Date(record.date).toLocaleDateString()}
                                                            </td>
                                                            <td className="p-4 text-gray-400">{record.clockIn ? new Date(record.clockIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</td>
                                                            <td className="p-4 text-gray-400">{record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</td>
                                                            <td className="p-4 text-center text-white font-bold">{record.workHours?.toFixed(1) || '—'}</td>
                                                            <td className="p-4 text-center">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${record.status === 'PRESENT' ? 'bg-brand-500/20 text-brand-400' : 'bg-amber-500/20 text-amber-400'}`}>{record.status}</span>
                                                            </td>
                                                            <td className="p-4 text-gray-400 text-xs truncate max-w-[200px]" title={record.workDescription}>{record.workDescription || '—'}</td>
                                                        </tr>
                                                        {isExpanded && hasWorkLogs && (
                                                            <tr className="bg-black/30 border-b border-white/5">
                                                                <td colSpan={6} className="p-4">
                                                                    <div className="space-y-2 pl-6 border-l-2 border-brand-500/30">
                                                                        {record.workLogs?.map((log, i) => (
                                                                            <div key={i} className="flex items-start gap-4 text-xs">
                                                                                <span className="w-20 text-brand-400 font-mono font-bold shrink-0">{log.duration} hrs</span>
                                                                                <span className="w-48 text-gray-300 font-medium shrink-0 truncate border-r border-white/10 pr-2">{log.clientName || 'Internal'}</span>
                                                                                <span className="text-gray-400 flex-1">{log.description}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <EmptyState icon={Clock} title="No attendance records" description="This staff member has no attendance records for the last 60 days." />
                            )}
                        </div>
                    )}

                    {/* LEAVE TAB */}
                    {activeTab === 'LEAVE' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="glass-panel p-4 rounded-xl flex gap-6 text-center divide-x divide-white/10">
                                <div className="flex-1"><p className="text-2xl font-black text-white">{staffLeave.filter(l => l.status === 'APPROVED').length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Approved (YTD)</p></div>
                                <div className="flex-1"><p className="text-2xl font-black text-amber-400">{staffLeave.filter(l => l.status === 'PENDING').length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Pending Requests</p></div>
                                {(staff as any).leaveBalance !== undefined && (
                                    <div className="flex-1"><p className="text-2xl font-black text-brand-400">{(staff as any).leaveBalance}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Balance Remaining</p></div>
                                )}
                            </div>
                            
                            {staffLeave.length > 0 ? (
                                <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                                                <th className="p-4 text-left font-bold">Leave Type</th>
                                                <th className="p-4 text-left font-bold">Duration</th>
                                                <th className="p-4 text-center font-bold">Days</th>
                                                <th className="p-4 text-left font-bold">Reason</th>
                                                <th className="p-4 text-center font-bold">Status</th>
                                                <th className="p-4 text-left font-bold">Applied On</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {staffLeave.map(leave => {
                                                const days = Math.max(1, Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                                return (
                                                    <tr key={leave.id} className="border-b border-white/5 hover:bg-white/5">
                                                        <td className="p-4 text-white font-medium">{leave.type}</td>
                                                        <td className="p-4 text-gray-400 text-xs">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</td>
                                                        <td className="p-4 text-center text-white font-bold">{days}</td>
                                                        <td className="p-4 text-gray-400 text-xs truncate max-w-[200px]" title={leave.reason}>{leave.reason}</td>
                                                        <td className="p-4 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${leave.status === 'APPROVED' ? 'bg-brand-500/20 text-brand-400' : leave.status === 'REJECTED' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>{leave.status}</span>
                                                        </td>
                                                        <td className="p-4 text-gray-500 text-xs">{new Date(leave.createdAt).toLocaleDateString()}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <EmptyState icon={CalendarDays} title="No leave requests" description="No leave history exists for this staff member." />
                            )}
                        </div>
                    )}

                    {/* CLIENTS TAB */}
                    {activeTab === 'CLIENTS' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             {assignedClients.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {assignedClients.map(client => (
                                        <div key={client.id} className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-white/20 transition-all flex flex-col h-full bg-gradient-to-br from-white/[0.02] to-transparent">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center font-black border border-brand-500/30">
                                                        {client.code?.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-base leading-tight">{client.name}</h4>
                                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{client.code}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                                <span className="text-[10px] bg-white/5 text-gray-300 px-2 py-1 rounded truncate max-w-[120px]">{client.serviceType}</span>
                                                <button onClick={() => navigate(`/clients/${client.id}`)} className="text-xs text-brand-400 font-bold hover:text-brand-300 transition-colors">View Hub →</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                 <EmptyState icon={Building2} title="No assigned clients" description="Not selected as the focal auditor for any clients." />
                             )}
                        </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === 'ACTIVITY' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {staffActivityLogs.length === 0 ? (
                                <EmptyState icon={Activity} title="No activity recorded" description="Actions performed by this staff member will appear here." />
                            ) : (
                                <div className="space-y-3">
                                    {staffActivityLogs.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-4 p-4 glass-panel rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center shrink-0 border border-brand-500/20">
                                                <Activity size={14} className="text-brand-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className="text-sm text-white font-medium">{log.action?.replace(/_/g, ' ')}</p>
                                                    <span className="text-[10px] text-gray-500 font-mono shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                                                </div>
                                                {log.clientName && (
                                                    <p className="text-xs text-brand-400 mt-1 cursor-pointer hover:underline" onClick={() => log.clientId && navigate(`/clients/${log.clientId}`)}>@ {log.clientName}</p>
                                                )}
                                                {log.details && typeof log.details === 'string' && (
                                                    <p className="text-xs text-gray-400 mt-1.5 p-2 bg-black/20 rounded border border-white/5 break-words">{log.details}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StaffDetailPage;
