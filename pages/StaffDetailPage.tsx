import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Mail, Phone, Building2, Calendar as CalIcon, ArrowLeft, 
    CheckCircle2, Clock, CalendarDays, Activity, 
    ChevronDown, ChevronUp, User, Tag
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AuthService, getAttendanceByUserId, getAuditLogsByUserId } from '../services/firebase';
import { useTasks } from '../hooks/useTasks';
import { clientKeys } from '../hooks/useClients';
import { userKeys } from '../hooks/useStaff';
import { Task } from '../types';
import EmptyState from '../components/common/EmptyState';

type StaffTab = 'OVERVIEW' | 'TASKS' | 'ATTENDANCE' | 'LEAVE' | 'CLIENTS' | 'ACTIVITY';

const StaffDetailPage: React.FC = () => {
    const { staffId } = useParams<{ staffId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<StaffTab>('OVERVIEW');
    const [taskFilter, setTaskFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'COMPLETED'>('ALL');
    const [expandedAttendanceRows, setExpandedAttendanceRows] = useState<string[]>([]);

    const toggleAttendanceRow = (rowId: string) => {
        setExpandedAttendanceRows(prev =>
            prev.includes(rowId) ? prev.filter(r => r !== rowId) : [...prev, rowId]
        );
    };

    // 1. Fetch all users, then find this staff member
    const { data: allStaff = [], isLoading: isStaffLoading } = useQuery({
        queryKey: userKeys.all,
        queryFn: AuthService.getAllUsers,
    });
    const staff = allStaff.find(s => s.uid === staffId);

    // 2. Fetch Tasks via useTasks hook, filter by staffId
    const { data: allTasks = [] } = useTasks();
    const staffTasks = useMemo(() =>
        allTasks.filter((t: Task) => t.assignedTo?.includes(staffId!)),
        [allTasks, staffId]
    );

    // 3. Fetch Clients where this staff is focal person
    const { data: allClients = [] } = useQuery({
        queryKey: clientKeys.all,
        queryFn: AuthService.getAllClients,
    });
    const assignedClients = useMemo(() =>
        allClients.filter((c: any) => c.auditorId === staffId),
        [allClients, staffId]
    );

    // 4. Fetch Attendance records (last 60 days)
    const { data: attendanceRecords = [] } = useQuery({
        queryKey: ['attendance', 'user', staffId],
        queryFn: () => getAttendanceByUserId(staffId!, 60),
        enabled: !!staffId
    });

    // 5. Fetch Leave requests
    const { data: allLeave = [] } = useQuery({
        queryKey: ['leave', staffId],
        queryFn: () => AuthService.getAllLeaves(staffId),
    });
    const staffLeave = useMemo(() =>
        allLeave.filter((l: any) => l.userId === staffId),
        [allLeave, staffId]
    );

    // 6. Fetch Activity logs for this user
    const { data: staffActivityLogs = [] } = useQuery({
        queryKey: ['auditLogs', 'user', staffId],
        queryFn: () => getAuditLogsByUserId(staffId!),
        enabled: !!staffId
    });

    if (isStaffLoading) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="p-8 text-center">
                <EmptyState icon={User} title="Staff Member Not Found" description="The staff profile you are looking for does not exist or has been deleted." />
                <button onClick={() => navigate('/staff')} className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                    Back to Staff Directory
                </button>
            </div>
        );
    }

    const overdueTasks = staffTasks.filter((t: Task) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date());
    const tasksCompletedThisMonth = staffTasks.filter(t => {
        if (t.status !== 'COMPLETED' || !t.completedAt) return false;
        const d = new Date(t.completedAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const attendanceThisMonth = attendanceRecords.filter(a => {
        const d = new Date(a.date);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto pb-24">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/staff')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                    <ArrowLeft size={14} /> Back to Staff
                </button>
            </div>

            {/* Header Card */}
            <div className="p-6 rounded-xl border relative overflow-hidden"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-bold border shrink-0"
                        style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>
                        {getInitials(staff.displayName)}
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>{staff.displayName}</h1>
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold border"
                                style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>
                                {staff.role.replace(/_/g, ' ')}
                            </span>
                            <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-md border"
                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                <span className="w-2 h-2 rounded-full"
                                    style={{ background: staff.status === 'Active' ? 'var(--color-success)' : 'var(--color-danger)' }}></span>
                                <span className="text-xs font-semibold"
                                    style={{ color: staff.status === 'Active' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                    {staff.status}
                                </span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <div className="flex items-center gap-2">
                                <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                                {staff.department || 'General'} | {staff.position || 'Staff'}
                            </div>
                            <div className="flex items-center gap-2">
                                <CalIcon size={13} style={{ color: 'var(--text-muted)' }} />
                                Joined: {staff.dateOfJoining ? new Date(staff.dateOfJoining).toLocaleDateString() : 'N/A'}
                            </div>
                            <div className="flex items-center gap-2">
                                <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                                {staff.email}
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                                {staff.phoneNumber || 'No phone number'}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border shrink-0"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                         <div className="text-center px-3 border-r" style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{staffTasks.filter(t => t.status === 'IN_PROGRESS').length}</p>
                            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Active Tasks</p>
                         </div>
                         <div className="text-center px-3 border-r" style={{ borderColor: 'var(--border)' }}>
                            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{tasksCompletedThisMonth}</p>
                            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Done (Mo)</p>
                         </div>
                         <div className="text-center px-3">
                            <p className="text-xl font-bold tabular-nums" style={{ color: overdueTasks.length > 0 ? 'var(--color-danger)' : 'var(--text-heading)' }}>{overdueTasks.length}</p>
                            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Overdue</p>
                         </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="space-y-6">
                <div className="flex gap-1 overflow-x-auto pb-2 border-b hide-scrollbar" style={{ borderColor: 'var(--border)' }}>
                    {(['OVERVIEW', 'TASKS', 'ATTENDANCE', 'LEAVE', 'CLIENTS', 'ACTIVITY'] as StaffTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-t-lg text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
                                activeTab === tab
                                    ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]'
                                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-surface)]'
                            }`}
                        >
                            {tab === 'OVERVIEW' && <User size={14} />}
                            {tab === 'TASKS' && <CheckCircle2 size={14} />}
                            {tab === 'ATTENDANCE' && <Clock size={14} />}
                            {tab === 'LEAVE' && <CalendarDays size={14} />}
                            {tab === 'CLIENTS' && <Building2 size={14} />}
                            {tab === 'ACTIVITY' && <Activity size={14} />}
                            {tab === 'TASKS' ? `Tasks (${staffTasks.length})` :
                             tab === 'CLIENTS' ? `Clients (${assignedClients.length})` :
                             tab}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Task Health */}
                                <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                    <h4 className="text-xs font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                                        <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} /> Task Health
                                    </h4>
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--text-muted)' }}>In progress</span>
                                            <span className="font-semibold tabular-nums" style={{ color: 'var(--color-warning)' }}>{staffTasks.filter(t => t.status === 'IN_PROGRESS').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--text-muted)' }}>Not started</span>
                                            <span className="font-semibold tabular-nums" style={{ color: 'var(--text-body)' }}>{staffTasks.filter(t => t.status === 'NOT_STARTED').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--text-muted)' }}>Under review</span>
                                            <span className="font-semibold tabular-nums" style={{ color: 'var(--color-info)' }}>{staffTasks.filter(t => t.status === 'UNDER_REVIEW').length}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>Completed (this month)</span>
                                            <span className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{tasksCompletedThisMonth}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-semibold" style={{ color: 'var(--color-danger)' }}>
                                            <span>Overdue</span>
                                            <span className="tabular-nums">{overdueTasks.length}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Attendance Summary */}
                                <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                    <h4 className="text-xs font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                                        <Clock size={14} style={{ color: 'var(--accent)' }} /> Attendance (This Month)
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="text-center p-3 rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{attendanceThisMonth.length}</p>
                                            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Present Days</p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>{attendanceThisMonth.filter(a => a.status === 'LATE').length}</p>
                                            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Late Days</p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg border col-span-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                                                {attendanceThisMonth.reduce((sum, a) => sum + (a.workHours || 0), 0).toFixed(1)}
                                            </p>
                                            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Total Hours</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Client Assignments */}
                                <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                    <h4 className="text-xs font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                                        <Building2 size={14} style={{ color: 'var(--accent)' }} /> Focal Person For
                                    </h4>
                                    <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {assignedClients.length > 0 ? assignedClients.map(c => (
                                            <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                                <div>
                                                    <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-heading)' }}>{c.name}</p>
                                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.code}</p>
                                                </div>
                                                <span className="w-2 h-2 rounded-full" style={{ background: c.status === 'Active' ? 'var(--color-success)' : 'var(--color-danger)' }}></span>
                                            </div>
                                        )) : (
                                            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Not assigned as focal person for any clients.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent 5 Tasks */}
                            <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                <h4 className="text-xs font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                                    <Tag size={14} style={{ color: 'var(--accent)' }} /> Recent Tasks
                                </h4>
                                <div className="space-y-2">
                                    {staffTasks.slice(0, 5).map(task => {
                                        const isOverdue = task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();
                                        return (
                                            <div key={task.id} onClick={() => navigate(`/tasks?search=${task.title}`)} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                                <div>
                                                    <p className={`text-xs font-medium ${isOverdue ? 'text-rose-500' : ''}`} style={{ color: isOverdue ? undefined : 'var(--text-heading)' }}>{task.title}</p>
                                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{task.clientName || 'Internal'}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                                                        style={{ 
                                                            background: task.status === 'COMPLETED' ? 'rgba(79,178,134,0.1)' : 'var(--bg-elevated)',
                                                            color: task.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--text-muted)',
                                                            borderColor: task.status === 'COMPLETED' ? 'rgba(79,178,134,0.25)' : 'var(--border)'
                                                        }}>
                                                        {task.status.replace('_', ' ')}
                                                    </span>
                                                    {task.dueDate && <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{new Date(task.dueDate).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {staffTasks.length === 0 && <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No tasks assigned yet.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TASKS TAB */}
                    {activeTab === 'TASKS' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 mb-4">
                                {['ALL', 'ACTIVE', 'OVERDUE', 'COMPLETED'].map(filter => (
                                    <button 
                                        key={filter} 
                                        onClick={() => setTaskFilter(filter as any)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border"
                                        style={{
                                            background: taskFilter === filter ? 'var(--accent)' : 'var(--bg-surface)',
                                            color: taskFilter === filter ? 'var(--on-accent)' : 'var(--text-muted)',
                                            borderColor: taskFilter === filter ? 'var(--border-accent)' : 'var(--border)'
                                        }}
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
                                        <div key={task.id} className="p-4 rounded-xl border transition-colors cursor-pointer"
                                            style={{ background: 'var(--bg-surface)', borderColor: isOverdue ? 'rgba(224,112,122,0.4)' : 'var(--border)' }}
                                            onClick={() => navigate('/tasks')}>
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <h4 className="font-semibold text-xs line-clamp-2" style={{ color: 'var(--text-heading)' }}>{task.title}</h4>
                                                <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold border"
                                                    style={{ 
                                                        background: task.status === 'COMPLETED' ? 'rgba(79,178,134,0.1)' : 'var(--bg-elevated)',
                                                        color: task.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--text-muted)',
                                                        borderColor: task.status === 'COMPLETED' ? 'rgba(79,178,134,0.25)' : 'var(--border)'
                                                    }}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{task.clientName || 'Internal task'}</p>
                                            <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border"
                                                        style={{ 
                                                            background: task.priority === 'HIGH' ? 'rgba(224,112,122,0.1)' : 'var(--bg-elevated)',
                                                            color: task.priority === 'HIGH' ? 'var(--color-danger)' : 'var(--text-muted)',
                                                            borderColor: task.priority === 'HIGH' ? 'rgba(224,112,122,0.25)' : 'var(--border)'
                                                        }}>
                                                        {task.priority}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                                                        <CalIcon size={12} /> 
                                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
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
                        <div className="space-y-6 animate-in fade-in duration-300">
                             <div className="p-4 rounded-xl border flex gap-6 text-center divide-x"
                                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                <div className="flex-1"><p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{attendanceRecords.length}</p><p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Days Logged (60d)</p></div>
                                <div className="flex-1"><p className="text-xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{attendanceRecords.filter(a => a.status === 'PRESENT' || a.status === 'COMPLETED').length}</p><p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>On Time</p></div>
                                <div className="flex-1"><p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>{attendanceRecords.filter(a => a.status === 'LATE').length}</p><p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Late</p></div>
                                <div className="flex-1"><p className="text-xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{attendanceRecords.reduce((sum, a) => sum + (a.workHours || 0), 0).toFixed(1)}</p><p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Total Hours</p></div>
                            </div>
                            
                            {attendanceRecords.length > 0 ? (
                                <div className="rounded-xl overflow-hidden border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                                <th className="p-3 text-left">Date</th>
                                                <th className="p-3 text-left">Clock in</th>
                                                <th className="p-3 text-left">Clock out</th>
                                                <th className="p-3 text-center">Hours</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 text-left">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                            {attendanceRecords.map(record => {
                                                const isExpanded = expandedAttendanceRows.includes(record.id!);
                                                const hasWorkLogs = record.workLogs && record.workLogs.length > 0;
                                                return (
                                                    <React.Fragment key={record.id}>
                                                        <tr className={`hover:bg-[var(--bg-secondary)] transition-colors ${hasWorkLogs ? 'cursor-pointer' : ''}`} onClick={() => hasWorkLogs && toggleAttendanceRow(record.id!)}>
                                                            <td className="p-3 font-medium flex items-center gap-2 tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                                                {hasWorkLogs && (isExpanded ? <ChevronUp size={14} style={{ color: 'var(--accent)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />)}
                                                                {new Date(record.date).toLocaleDateString()}
                                                            </td>
                                                            <td className="p-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>{record.clockIn ? new Date(record.clockIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</td>
                                                            <td className="p-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>{record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</td>
                                                            <td className="p-3 text-center font-semibold tabular-nums" style={{ color: 'var(--text-heading)' }}>{record.workHours?.toFixed(1) || '—'}</td>
                                                            <td className="p-3 text-center">
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                                                                    style={{
                                                                        background: (record.status === 'PRESENT' || record.status === 'COMPLETED') ? 'rgba(79,178,134,0.1)' : 'rgba(217,164,65,0.1)',
                                                                        color: (record.status === 'PRESENT' || record.status === 'COMPLETED') ? 'var(--color-success)' : 'var(--color-warning)',
                                                                        borderColor: (record.status === 'PRESENT' || record.status === 'COMPLETED') ? 'rgba(79,178,134,0.25)' : 'rgba(217,164,65,0.25)'
                                                                    }}>
                                                                    {record.status}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }} title={record.workDescription}>{record.workDescription || '—'}</td>
                                                        </tr>
                                                        {isExpanded && hasWorkLogs && (
                                                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                                                <td colSpan={6} className="p-3">
                                                                    <div className="space-y-2 pl-4 border-l-2" style={{ borderColor: 'var(--border-accent)' }}>
                                                                        {record.workLogs?.map((log, i) => (
                                                                            <div key={i} className="flex items-start gap-4 text-xs">
                                                                                <span className="w-16 font-semibold tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>{log.duration} hrs</span>
                                                                                <span className="w-44 font-medium shrink-0 truncate pr-2 border-r" style={{ borderColor: 'var(--border)', color: 'var(--text-heading)' }}>{log.clientName || 'Internal'}</span>
                                                                                <span className="flex-1" style={{ color: 'var(--text-muted)' }}>{log.description}</span>
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
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="p-4 rounded-xl border flex gap-6 text-center divide-x"
                                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                <div className="flex-1"><p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{staffLeave.filter(l => l.status === 'APPROVED').length}</p><p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Approved (YTD)</p></div>
                                <div className="flex-1"><p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>{staffLeave.filter(l => l.status === 'PENDING').length}</p><p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Pending Requests</p></div>
                                {(staff as any).leaveBalance !== undefined && (
                                    <div className="flex-1"><p className="text-xl font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{(staff as any).leaveBalance}</p><p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>Balance Remaining</p></div>
                                )}
                            </div>
                            
                            {staffLeave.length > 0 ? (
                                <div className="rounded-xl overflow-hidden border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                                <th className="p-3 text-left">Leave type</th>
                                                <th className="p-3 text-left">Duration</th>
                                                <th className="p-3 text-center">Days</th>
                                                <th className="p-3 text-left">Reason</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 text-left">Applied on</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                            {staffLeave.map(leave => {
                                                const days = Math.max(1, Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                                return (
                                                    <tr key={leave.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                                                        <td className="p-3 font-medium" style={{ color: 'var(--text-heading)' }}>{leave.type}</td>
                                                        <td className="p-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</td>
                                                        <td className="p-3 text-center font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{days}</td>
                                                        <td className="p-3 text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }} title={leave.reason}>{leave.reason}</td>
                                                        <td className="p-3 text-center">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold border"
                                                                style={{
                                                                    background: leave.status === 'APPROVED' ? 'rgba(79,178,134,0.1)' : leave.status === 'REJECTED' ? 'rgba(224,112,122,0.1)' : 'rgba(217,164,65,0.1)',
                                                                    color: leave.status === 'APPROVED' ? 'var(--color-success)' : leave.status === 'REJECTED' ? 'var(--color-danger)' : 'var(--color-warning)',
                                                                    borderColor: leave.status === 'APPROVED' ? 'rgba(79,178,134,0.25)' : leave.status === 'REJECTED' ? 'rgba(224,112,122,0.25)' : 'rgba(217,164,65,0.25)'
                                                                }}>
                                                                {leave.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>{new Date(leave.createdAt).toLocaleDateString()}</td>
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
                        <div className="space-y-4 animate-in fade-in duration-300">
                             {assignedClients.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {assignedClients.map(client => (
                                        <div key={client.id} className="p-4 rounded-xl border flex flex-col h-full transition-colors"
                                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold border"
                                                        style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>
                                                        {client.code?.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-xs leading-tight" style={{ color: 'var(--text-heading)' }}>{client.name}</h4>
                                                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{client.code}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-auto pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                                                <span className="text-[10px] px-2 py-0.5 rounded border truncate max-w-[120px]"
                                                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{client.serviceType}</span>
                                                <button onClick={() => navigate(`/clients/${client.id}`)} className="text-xs font-semibold hover:underline" style={{ color: 'var(--accent)' }}>View Hub →</button>
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
                        <div className="space-y-3 animate-in fade-in duration-300">
                            {staffActivityLogs.length === 0 ? (
                                <EmptyState icon={Activity} title="No activity recorded" description="Actions performed by this staff member will appear here." />
                            ) : (
                                <div className="space-y-2">
                                    {staffActivityLogs.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
                                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                                                style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)', color: 'var(--accent)' }}>
                                                <Activity size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <p className="text-xs font-medium" style={{ color: 'var(--text-heading)' }}>{log.action?.replace(/_/g, ' ')}</p>
                                                    <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                                                </div>
                                                {log.clientName && (
                                                    <p className="text-xs mt-0.5 cursor-pointer hover:underline" style={{ color: 'var(--accent)' }} onClick={() => log.clientId && navigate(`/clients/${log.clientId}`)}>@ {log.clientName}</p>
                                                )}
                                                {log.details && typeof log.details === 'string' && (
                                                    <p className="text-xs mt-1 p-2 rounded border break-words" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{log.details}</p>
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
