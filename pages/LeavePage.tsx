
import React, { useState, useEffect } from 'react';
import { CalendarDays, CheckCircle, Clock, Plus, X, AlertCircle, AlertTriangle, Mail, XCircle, ChevronDown, Check, ThumbsDown, UserCog, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LeaveRequest, UserRole, UserProfile } from '../types';
import { AuthService } from '../services/firebase';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leaveSchema, LeaveFormValues } from '../utils/validationSchemas';
import LeaveCalendar from '../components/leave/LeaveCalendar';

const ARTICLESHIP_LEAVE_LIMIT = 120; // 3 Years Total

const CircularProgress: React.FC<{ 
    value: number, 
    max: number, 
    color: string, 
    label: string, 
    size?: number 
}> = ({ value, max, color, label, size = 80 }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-2 group cursor-help">
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="50%" cy="50%" r={radius}
                        className="stroke-white/5 fill-none"
                        strokeWidth="6"
                    />
                    <circle
                         cx="50%" cy="50%" r={radius}
                         className={`fill-none transition-all duration-1000 ease-out`}
                         style={{ 
                            stroke: color,
                            strokeDasharray: circumference,
                            strokeDashoffset: offset,
                            strokeLinecap: 'round'
                         }}
                         strokeWidth="6"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[14px] font-black text-white leading-none">{value}</span>
                    <span className="text-[8px] text-gray-500 font-bold uppercase mt-0.5 tracking-tighter">/ {max}</span>
                </div>
            </div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center group-hover:text-white transition-colors">{label}</span>
        </div>
    );
};

// Helper to get current Nepali Year range (approx April 14th to April 13th)
const getCurrentNepaliYearRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const day = now.getDate();

    // If it's before April 14, we're in the previous year's range (which ends this April)
    // If it's April 14 or later, we're in the new BS year (which ends next April)
    if (month < 3 || (month === 3 && day < 14)) {
        return { start: `${year - 1}-04-14`, end: `${year}-04-13` };
    }
    return { start: `${year}-04-14`, end: `${year + 1}-04-13` };
};

const LeavePage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [allStaff, setAllStaff] = useState<UserProfile[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'my' | 'admin' | 'calendar'>(isAdmin ? 'admin' : 'my');
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [rejectionTarget, setRejectionTarget] = useState<LeaveRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [adjustmentData, setAdjustmentData] = useState({ uid: '', name: '', amount: 0 });

    // Form Setup
    const { register, handleSubmit, reset, formState: { errors } } = useForm<LeaveFormValues>({
        resolver: zodResolver(leaveSchema),
        defaultValues: {
            type: 'SICK',
            startDate: '',
            endDate: '',
            reason: ''
        }
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user) {
            loadLeaves();
            if (isAdmin) {
                AuthService.getAllStaff().then(setAllStaff);
            }
        }
    }, [user]);

    const loadLeaves = async () => {
        if (!user) return;
        const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.MASTER_ADMIN;
        const userId = isAdmin ? undefined : user.uid;
        const data = await AuthService.getAllLeaves(userId);
        setLeaves(data);
    };

    // Calculate Stats
    const myApprovedLeaves = leaves.filter(l => l.status === 'APPROVED' && (user?.role !== UserRole.ADMIN || l.userId === user?.uid));

    // Helper to calculate days between dates
    const calculateDays = (start: string, end: string) => {
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e.getTime() - s.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
    };

    const isArticleTrainee = user?.position === 'Article Trainee';
    const { start: npStart, end: npEnd } = getCurrentNepaliYearRange();

    const currentYearApprovedLeaves = myApprovedLeaves.filter(l => {
        return l.startDate >= npStart && l.startDate <= npEnd;
    });

    const totalDaysTaken = isArticleTrainee
        ? myApprovedLeaves.reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0)
        : currentYearApprovedLeaves.reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0);

    const balanceRemaining = isArticleTrainee ? ARTICLESHIP_LEAVE_LIMIT - totalDaysTaken : null;

    // Breakdown by type
    const breakdown = {
        Sick: 0,
        Casual: 0,
        Exam: 0,
        Home: 0,
        Other: 0
    };

    myApprovedLeaves.forEach(l => {
        const days = calculateDays(l.startDate, l.endDate);
        if (breakdown[l.type as keyof typeof breakdown] !== undefined) {
            breakdown[l.type as keyof typeof breakdown] += days;
        } else {
            breakdown.Other += days;
        }
    });

    const onSubmit = async (data: LeaveFormValues) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const request: LeaveRequest = {
                id: '',
                userId: user?.uid || 'unknown',
                userName: user?.displayName || 'User',
                type: data.type as any,
                startDate: data.startDate,
                endDate: data.endDate,
                reason: data.reason,
                status: 'PENDING',
                createdAt: new Date().toISOString().split('T')[0]
            };
            await AuthService.requestLeave(request);
            await loadLeaves();
            setIsModalOpen(false);
            reset();
            toast.success('Leave request submitted successfully!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit leave request');
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED') {
            const leave = leaves.find(l => l.id === id);
            if (leave) {
                setRejectionTarget(leave);
                setRejectionReason('');
            }
            return;
        }

        if (window.confirm(`Are you sure you want to ${status} this request?`)) {
            await AuthService.updateLeaveStatus(id, status);
            loadLeaves();
            toast.success(`Leave request ${status.toLowerCase()}ed`);
        }
    };

    const confirmRejection = async () => {
        if (!rejectionTarget || !rejectionReason.trim()) return;
        setIsSaving(true);
        try {
            await AuthService.updateLeaveStatus(rejectionTarget.id, 'REJECTED', rejectionReason);
            toast.success('Leave request rejected with reason');
            setRejectionTarget(null);
            loadLeaves();
        } catch (error: any) {
            toast.error(error.message || 'Failed to reject leave');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdjustLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustmentData.uid) return;
        setIsSaving(true);
        try {
            await AuthService.updateUserProfile(adjustmentData.uid, {
                leaveAdjustment: adjustmentData.amount
            });
            toast.success(`Leave balance adjusted successfully`);
            setIsAdjustModalOpen(false);
            const users = await AuthService.getAllStaff();
            setAllStaff(users);
        } catch (error: any) {
            toast.error(error.message || 'Failed to adjust leave balance');
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': 
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                        Approved
                    </div>
                );
            case 'REJECTED': 
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                        <div className="w-1 h-1 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
                        Rejected
                    </div>
                );
            default: 
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        <div className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                        Pending
                    </div>
                );
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 bg-transparent">
            <div className="space-y-6 animate-in fade-in duration-500 pb-32 max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Leave Management</h1>
                    <p className="text-sm text-gray-400">
                        {user?.position === 'Article Trainee'
                            ? `Articleship Leave Balance (120 Days / 3 Years)`
                            : `Staff Leave Balances (Nepali Year ${new Date().getFullYear()}/${new Date().getFullYear() + 1})`
                        }
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
                        <button
                            onClick={() => setActiveTab('my')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'my' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            My History
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('admin')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Admin Panel
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'calendar' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Team Calendar
                        </button>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-700 shadow-lg shadow-amber-900/40 flex items-center border border-amber-500/30 transition-all hover:-translate-y-0.5"
                    >
                        <Plus size={18} className="mr-2" /> Request Leave
                    </button>
                </div>
            </div>

            {activeTab === 'admin' && (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) ? (
                <div className="space-y-8">
                    {/* Pending Requests Section */}
                    {leaves.some(l => l.status === 'PENDING') && (
                        <div className="glass-panel rounded-xl overflow-hidden border border-amber-500/30 shadow-2xl animate-in slide-in-from-bottom-2 duration-500">
                            <div className="px-6 py-4 border-b border-white/10 bg-amber-500/10 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-amber-200 flex items-center gap-2">
                                        <AlertTriangle size={18} /> Pending Approvals
                                    </h3>
                                    <p className="text-[10px] text-amber-200/60 uppercase tracking-widest font-black mt-1">Action Required</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead>
                                        <tr className="text-amber-200/60 border-b border-white/10 uppercase text-[10px] tracking-wider bg-black/20 font-black">
                                            <th className="px-6 py-3">Employee</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Dates</th>
                                            <th className="px-6 py-3">Reason</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {leaves.filter(l => l.status === 'PENDING').map(leave => (
                                            <tr key={leave.id} className="hover:bg-amber-500/5 transition-colors">
                                                <td className="px-6 py-4 font-bold text-white">{leave.userName}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${leave.type === 'Sick' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        leave.type === 'Exam' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                        }`}>
                                                        {leave.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs">
                                                        {leave.startDate === leave.endDate ? leave.startDate : `${leave.startDate} to ${leave.endDate}`}
                                                        <span className="text-gray-500 ml-1">({calculateDays(leave.startDate, leave.endDate)}d)</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-400 italic">{leave.reason}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleStatusUpdate(leave.id, 'APPROVED')}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/20 transition-all text-xs font-bold"
                                                        >
                                                            <Check size={14} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusUpdate(leave.id, 'REJECTED')}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/20 transition-all text-xs font-bold"
                                                        >
                                                            <X size={14} /> Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl animate-in slide-in-from-bottom-4 duration-500">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-white">Staff Leave Balances</h3>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mt-1">Rule: 120d for Article Trainees • Yearly for others</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead>
                                    <tr className="text-gray-400 border-b border-white/10 uppercase text-[10px] tracking-wider bg-black/20 font-black">
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Position</th>
                                        <th className="px-6 py-4 font-bold text-gray-300">Total / Yearly Taken</th>
                                        <th className="px-6 py-4">Adjustment</th>
                                        <th className="px-6 py-4">Status / Balance</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {allStaff.map(staffMember => {
                                        const isStaffArticleTrainee = staffMember.position === 'Article Trainee';
                                        const staffLeaves = leaves.filter(l => l.userId === staffMember.uid && l.status === 'APPROVED');

                                        // For Article Trainees, count all leaves (lifetime limit)
                                        // For others, count ONLY current Nepali Year
                                        const taken = isStaffArticleTrainee
                                            ? staffLeaves.reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0)
                                            : staffLeaves.filter(l => l.startDate >= npStart && l.startDate <= npEnd)
                                                .reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0);

                                        const adj = staffMember.leaveAdjustment || 0;
                                        const net = isStaffArticleTrainee ? ARTICLESHIP_LEAVE_LIMIT - (taken + adj) : null;

                                        return (
                                            <tr key={staffMember.uid} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400 border border-brand-500/20">
                                                            {staffMember.displayName[0]}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white group-hover:text-brand-400 transition-colors">{staffMember.displayName}</div>
                                                            <div className="text-[10px] text-gray-500">{staffMember.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs">{staffMember.position || 'Staff'}</td>
                                                <td className="px-6 py-4 font-mono font-bold text-amber-400">{taken}d</td>
                                                <td className="px-6 py-4 font-mono">
                                                    <span className={adj > 0 ? 'text-orange-400' : adj < 0 ? 'text-emerald-400' : 'text-gray-500'}>
                                                        {adj > 0 ? `+${adj}` : adj}d
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isStaffArticleTrainee ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-bold font-mono ${net! < 20 ? 'text-red-400' : 'text-emerald-400'}`}>{net}d Balance</span>
                                                            <div className="w-20 bg-white/5 rounded-full h-1 hidden md:block">
                                                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.max(0, (net! / ARTICLESHIP_LEAVE_LIMIT) * 100)}%` }}></div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500 text-xs italic">Yearly Total</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => {
                                                            setAdjustmentData({ uid: staffMember.uid, name: staffMember.displayName, amount: staffMember.leaveAdjustment || 0 });
                                                            setIsAdjustModalOpen(true);
                                                        }}
                                                        className="p-2 hover:bg-brand-500/20 rounded-lg text-brand-400 transition-all"
                                                        title="Adjust Balance"
                                                    >
                                                        <UserCog size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'calendar' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <LeaveCalendar leaves={leaves} staff={allStaff} />
                </div>
            ) : (
                <>
                    {/* Balance Cards (Modernized) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                        {/* Primary Balance Widget */}
                        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl relative overflow-hidden group hover:bg-white/5 transition-all border-l-4 border-l-brand-600">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <CalendarDays size={120} />
                            </div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-[10px] font-black text-brand-400 uppercase tracking-[2px]">Utilization Overview</p>
                                        <h2 className="text-3xl font-black text-white mt-1">
                                            {totalDaysTaken}
                                            <span className="text-gray-500 ml-2 text-sm font-bold uppercase tracking-widest">
                                                / {isArticleTrainee ? ARTICLESHIP_LEAVE_LIMIT : 'Annual'} Days
                                            </span>
                                        </h2>
                                    </div>
                                    <div className="p-3 bg-brand-500/20 text-brand-400 rounded-xl border border-brand-500/20 shadow-lg shadow-brand-500/10">
                                        <CalendarDays size={20} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {isArticleTrainee ? (
                                        <div className="p-4 bg-white/3 rounded-xl border border-white/5">
                                            <div className="flex justify-between text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wide">
                                                <span>Articleship Quota Progress</span>
                                                <span className={`${totalDaysTaken > 100 ? 'text-red-400' : 'text-brand-400'}`}>
                                                    {balanceRemaining} Days Left
                                                </span>
                                            </div>
                                            <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden p-0.5 border border-white/5">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-[1500ms] ease-out ${
                                                        totalDaysTaken > 100 ? 'bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 
                                                        'bg-gradient-to-r from-brand-600 to-indigo-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                                    }`}
                                                    style={{ width: `${Math.min((totalDaysTaken / ARTICLESHIP_LEAVE_LIMIT) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[9px] text-gray-500 mt-2 italic font-medium">Standard 3-year allowance as per ICAI/ICAN guidelines.</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                                <CheckCircle size={18} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-white font-bold">Standard Staff Balance</p>
                                                <p className="text-[10px] text-emerald-400/70 font-medium">Tracking current fiscal year: {npStart} to {npEnd}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Radial Breakdown Widget */}
                        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl flex flex-col justify-between border border-white/5">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[2px]">Type Breakdown</h3>
                                <span className="text-[10px] bg-white/5 px-2 py-1 rounded-md text-gray-400 border border-white/5 font-bold">Approved Only</span>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <CircularProgress 
                                    value={breakdown.Sick} 
                                    max={12} 
                                    color="#ef4444" 
                                    label="Sick" 
                                />
                                <CircularProgress 
                                    value={breakdown.Casual} 
                                    max={6} 
                                    color="#f59e0b" 
                                    label="Casual" 
                                />
                                <CircularProgress 
                                    value={breakdown.Exam} 
                                    max={isArticleTrainee ? 40 : 5} 
                                    color="#a855f7" 
                                    label="Exam" 
                                />
                                <CircularProgress 
                                    value={breakdown.Home + breakdown.Other} 
                                    max={15} 
                                    color="#3b82f6" 
                                    label="Other" 
                                />
                            </div>
                            
                            <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="flex gap-4">
                                   <div className="flex items-center gap-1.5">
                                       <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                       <span className="text-[9px] text-gray-500 font-bold uppercase">Total Approved</span>
                                   </div>
                                    <div className="flex items-center gap-1.5">
                                       <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                                       <span className="text-[9px] text-gray-500 font-bold uppercase">Quota Limit</span>
                                   </div>
                                </div>
                                <span className="text-[10px] text-brand-400 font-black cursor-pointer hover:underline uppercase">View Full Policy</span>
                            </div>
                        </div>
                    </div>

                    {/* Leave History Table */}
                    <div className="glass-panel rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                            <h3 className="font-bold text-white">Leave Requests & History</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead>
                                    <tr className="text-gray-400 border-b border-white/10 uppercase text-xs tracking-wider bg-black/20">
                                        <th className="px-6 py-3 font-medium">Employee</th>
                                        <th className="px-6 py-3 font-medium">Applied On</th>
                                        <th className="px-6 py-3 font-medium">Type</th>
                                        <th className="px-6 py-3 font-medium">Duration</th>
                                        <th className="px-6 py-3 font-medium">Reason</th>
                                        <th className="px-6 py-3 font-medium">Status</th>
                                        {user?.role === UserRole.ADMIN && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {leaves.map((leave) => (
                                        <tr key={leave.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{leave.userName}</td>
                                            <td className="px-6 py-4 text-gray-400 text-xs">
                                                <div>{leave.createdAt}</div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-white">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${leave.type === 'Sick' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    leave.type === 'Exam' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                    }`}>
                                                    {leave.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-300">
                                                {leave.startDate === leave.endDate ? (
                                                    <div>{leave.startDate}</div>
                                                ) : (
                                                    <div>
                                                        <span>{leave.startDate} to {leave.endDate}</span>
                                                        <div className="text-xs text-gray-500 mt-0.5">({calculateDays(leave.startDate, leave.endDate)} days)</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 truncate max-w-xs">{leave.reason}</td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(leave.status)}
                                            </td>
                                            {user?.role === UserRole.ADMIN && (
                                                <td className="px-6 py-4 text-right">
                                                    {leave.status === 'PENDING' ? (
                                                        leave.userId !== user.uid ? (
                                                            <div className="flex justify-end space-x-2">
                                                                <button onClick={() => handleStatusUpdate(leave.id, 'APPROVED')} className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg border border-green-500/20 transition-colors" title="Approve Request">
                                                                    <Check size={16} />
                                                                </button>
                                                                <button onClick={() => handleStatusUpdate(leave.id, 'REJECTED')} className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/20 transition-colors" title="Reject Request">
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-700/50 text-gray-400 text-[10px] border border-gray-600/30 cursor-help" title="You cannot approve your own request">
                                                                <UserCog size={10} className="mr-1" /> Self Request
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-xs text-gray-500 font-mono">
                                                            {leave.status === 'APPROVED' ? 'Processed' : 'Closed'}
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    {leaves.length === 0 && (
                                        <tr>
                                            <td colSpan={user?.role === UserRole.ADMIN ? 7 : 6} className="px-6 py-8 text-center text-gray-500">No leave history found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Request Modal */}
                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                            <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-white/10">
                                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                                    <h3 className="text-lg font-bold text-white">Request Leave</h3>
                                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                                </div>

                                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                                    <div className="relative">
                                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Leave Type</label>
                                        <div className="relative">
                                            <select
                                                className={`w-full rounded-lg px-3 py-2.5 text-sm appearance-none cursor-pointer border ${errors.type ? 'border-red-500' : 'border-gray-600'} bg-gray-800 text-white focus:ring-2 focus:ring-amber-500`}
                                                {...register('type')}
                                            >
                                                <option value="SICK">Sick Leave</option>
                                                <option value="CASUAL">Casual Leave</option>
                                                <option value="EARNED">Earned Leave</option>
                                                <option value="UNPAID">Unpaid Leave</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={16} />
                                        </div>
                                        {errors.type && <p className="text-red-400 text-xs mt-1">{errors.type.message}</p>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Start Date</label>
                                            <input
                                                type="date"
                                                className={`w-full rounded-lg px-3 py-2 text-sm glass-input ${errors.startDate ? 'border-red-500' : ''}`}
                                                {...register('startDate')}
                                            />
                                            {errors.startDate && <p className="text-red-400 text-xs mt-1">{errors.startDate.message}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">End Date</label>
                                            <input
                                                type="date"
                                                className={`w-full rounded-lg px-3 py-2 text-sm glass-input ${errors.endDate ? 'border-red-500' : ''}`}
                                                {...register('endDate')}
                                            />
                                            {errors.endDate && <p className="text-red-400 text-xs mt-1">{errors.endDate.message}</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Reason</label>
                                        <textarea
                                            rows={3}
                                            placeholder="e.g. Not feeling well, Family emergency..."
                                            className={`w-full rounded-lg px-3 py-2 text-sm glass-input ${errors.reason ? 'border-red-500' : ''}`}
                                            {...register('reason')}
                                        />
                                        {errors.reason && <p className="text-red-400 text-xs mt-1">{errors.reason.message}</p>}
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={isSaving}
                                            className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-amber-900/30 flex justify-center items-center transition-all transform active:scale-[0.98] disabled:opacity-50"
                                        >
                                            {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mail size={16} className="mr-2" />}
                                            {isSaving ? 'Submitting...' : 'Submit Request'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Admin Rejection Modal */}
            {rejectionTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">Reject Request</h3>
                            <button onClick={() => setRejectionTarget(null)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-400 mb-4 italic">Please provide a reason for rejecting <span className="text-white font-bold">{rejectionTarget.userName}</span>'s request.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase tracking-widest">Rejection Reason</label>
                                    <textarea
                                        className="w-full rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-white focus:border-red-500 outline-none text-sm min-h-[100px] transition-all"
                                        placeholder="Enter reason for rejection..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setRejectionTarget(null)}
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/5 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={confirmRejection}
                                        disabled={isSaving || !rejectionReason.trim()}
                                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg hover:shadow-red-500/20 disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Confirm Reject'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Adjust Balance Modal — rendered at top level so it works from any tab */}
            {isAdjustModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white">Adjust Leave Balance</h3>
                            <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-400 mb-4">Set manual leave adjustment for <span className="text-white font-bold">{adjustmentData.name}</span>. Positive values increase "taken" count (reducing balance).</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">Days to Adjust</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-lg px-4 py-3 bg-navy-900/50 border border-white/10 text-white focus:border-brand-500 outline-none font-mono text-center text-2xl"
                                        value={adjustmentData.amount}
                                        onChange={(e) => setAdjustmentData({ ...adjustmentData, amount: parseInt(e.target.value) || 0 })}
                                    />
                                    <div className="flex justify-between mt-2 px-1">
                                        <button type="button" onClick={() => setAdjustmentData(d => ({ ...d, amount: d.amount - 1 }))} className="text-[10px] text-emerald-400 font-bold hover:underline">-1 Day</button>
                                        <button type="button" onClick={() => setAdjustmentData(d => ({ ...d, amount: d.amount + 1 }))} className="text-[10px] text-orange-400 font-bold hover:underline">+1 Day</button>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={(e) => handleAdjustLeave(e as any)}
                                    disabled={isSaving}
                                    className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-brand-500/20 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Save Adjustment'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
};

export default LeavePage;
