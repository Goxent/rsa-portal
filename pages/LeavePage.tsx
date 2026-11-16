import React, { useState, useEffect } from 'react';
import { 
    CalendarDays, CheckCircle, Clock, Plus, X, AlertTriangle, 
    Mail, XCircle, ChevronDown, Check, UserCog, Loader2, Activity, BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LeaveRequest, UserRole, UserProfile } from '../types';
import { AuthService } from '../services/firebase';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leaveSchema, LeaveFormValues } from '../utils/validationSchemas';
import LeaveCalendar from '../components/leave/LeaveCalendar';
import { ConfirmationModal } from '../components/ConfirmationModal';
import NepaliDate from 'nepali-date-converter';

import { ARTICLESHIP_LEAVE_LIMIT } from '../constants/leaveConfig';

// Convert an AD ISO date string to BS formatted string
const toBSStr = (adStr: string): string => {
    try {
        if (!adStr) return '';
        const nd = new NepaliDate(new Date(adStr + 'T00:00:00'));
        return nd.format('DD MMM, YYYY');
    } catch {
        return '';
    }
};

const CircularProgress: React.FC<{ 
    value: number, 
    max: number, 
    color: string, 
    label: string, 
    size?: number 
}> = ({ value, max, color, label, size = 72 }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-2.5 group cursor-help">
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="50%" cy="50%" r={radius}
                        className="stroke-border fill-none"
                        strokeWidth="5"
                    />
                    <circle
                         cx="50%" cy="50%" r={radius}
                         className="fill-none transition-all duration-[1500ms] ease-out"
                         style={{ 
                            stroke: color,
                            strokeDasharray: circumference,
                            strokeDashoffset: offset,
                            strokeLinecap: 'round'
                         }}
                         strokeWidth="5"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[13px] font-bold text-heading leading-none tabular-nums">{value}</span>
                    <span className="text-[10px] text-muted font-medium mt-0.5 tracking-tighter tabular-nums">/ {max}</span>
                </div>
            </div>
            <span className="text-xs font-medium text-muted text-center group-hover:text-heading transition-colors">{label}</span>
        </div>
    );
};

// Helper to get current Nepali Year range (approx April 14th to April 13th)
const getCurrentNepaliYearRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    if (month < 3 || (month === 3 && day < 14)) {
        return { start: `${year - 1}-04-14`, end: `${year}-04-13` };
    }
    return { start: `${year}-04-14`, end: `${year + 1}-04-13` };
};

const LeavePage: React.FC = () => {
    React.useEffect(() => {
        document.title = 'Leave — RSA';
        return () => { document.title = 'RSA'; };
    }, []);
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
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        variant?: 'danger' | 'warning' | 'info';
        onConfirm?: () => void;
    }>({ open: false, title: '', message: '' });

    const { register, handleSubmit, reset, watch: watchForm, formState: { errors } } = useForm<LeaveFormValues>({
        resolver: zodResolver(leaveSchema),
        defaultValues: {
            type: 'Sick',
            startDate: '',
            endDate: '',
            reason: ''
        }
    });

    const watchedStartDate = watchForm('startDate');
    const watchedEndDate = watchForm('endDate');
    const startBSStr = toBSStr(watchedStartDate);
    const endBSStr = toBSStr(watchedEndDate);

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user) {
            loadLeaves();
            if (isAdmin) {
                AuthService.getAllStaff().then(setAllStaff);
            }
        }
    }, [user, isAdmin]);

    const loadLeaves = async () => {
        if (!user) return;
        const userId = isAdmin ? undefined : user.uid;
        const data = await AuthService.getAllLeaves(userId);
        setLeaves(data);
    };

    const myApprovedLeaves = leaves.filter(l => l.status === 'APPROVED' && (!isAdmin || l.userId === user?.uid));

    // L1 Fix: Count working days only (Sunday to Friday; Saturday is day 6)
    const calculateDays = (start: string, end: string) => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        if (s > e) return 0;

        let workingDays = 0;
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== 6) { // Skip Saturday
                workingDays++;
            }
        }
        return workingDays;
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

    const breakdown = { Sick: 0, Casual: 0, Exam: 0, Home: 0, Other: 0 };
    myApprovedLeaves.forEach(l => {
        const days = calculateDays(l.startDate, l.endDate);
        if (l.type === 'Sick') breakdown.Sick += days;
        else if (l.type === 'Casual') breakdown.Casual += days;
        else if (l.type === 'Exam') breakdown.Exam += days;
        else if (l.type === 'Home') breakdown.Home += days;
        else breakdown.Other += days;
    });

    const onSubmit = async (data: LeaveFormValues) => {
        if (isSaving) return;

        // L2 Fix: Validate start and end dates
        if (data.startDate > data.endDate) {
            toast.error('End date must be on or after start date.');
            return;
        }

        // L2 Fix: Check for overlapping leaves with existing pending or approved requests
        const hasOverlap = myApprovedLeaves.some(l => {
            if (l.status === 'REJECTED') return false;
            return (
                (data.startDate >= l.startDate && data.startDate <= l.endDate) ||
                (data.endDate >= l.startDate && data.endDate <= l.endDate) ||
                (data.startDate <= l.startDate && data.endDate >= l.endDate)
            );
        });

        if (hasOverlap) {
            toast.error('You already have a leave request covering this date range.');
            return;
        }

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
                createdAt: new Date().toLocaleDateString('en-CA')
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

        setConfirmModal({
            open: true,
            title: status === 'APPROVED' ? 'Approve Leave Request' : 'Reject Leave Request',
            message: `Are you sure you want to ${status.toLowerCase()} this leave request?`,
            confirmLabel: status === 'APPROVED' ? 'Approve' : 'Reject',
            variant: status === 'APPROVED' ? 'info' : 'danger',
            onConfirm: async () => {
                await AuthService.updateLeaveStatus(id, status);
                loadLeaves();
                toast.success(`Leave request ${status.toLowerCase()}ed`);
            }
        });
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
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border"
                        style={{ color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' }}>
                        <CheckCircle size={12} />
                        Approved
                    </div>
                );
            case 'REJECTED': 
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border"
                        style={{ color: 'var(--color-danger)', background: 'rgba(224,112,122,0.1)', borderColor: 'rgba(224,112,122,0.2)' }}>
                        <XCircle size={12} />
                        Rejected
                    </div>
                );
            default: 
                return (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border"
                        style={{ color: 'var(--color-warning)', background: 'rgba(217,164,65,0.1)', borderColor: 'rgba(217,164,65,0.25)' }}>
                        <Clock size={12} />
                        Pending
                    </div>
                );
        }
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 bg-transparent">
            <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
                
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-heading">Leave Management</h1>
                        <p className="text-sm text-muted">
                            {isArticleTrainee
                                ? `Articleship Cumulative Quota (120 Days Total)`
                                : `Manage and track leave requests — Annual Allowance`
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-surface p-1 rounded-lg border border-border">
                            <button
                                onClick={() => setActiveTab('my')}
                                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'my' ? 'bg-secondary text-heading shadow-card' : 'text-muted hover:text-heading'}`}
                            >
                                My history
                            </button>
                            <button
                                onClick={() => setActiveTab('calendar')}
                                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'calendar' ? 'bg-secondary text-heading shadow-card' : 'text-muted hover:text-heading'}`}
                            >
                                Calendar
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => setActiveTab('admin')}
                                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-2 ${activeTab === 'admin' ? 'bg-secondary text-heading shadow-card' : 'text-muted hover:text-heading'}`}
                                >
                                    Admin panel
                                    {leaves.filter(l => l.status === 'PENDING').length > 0 && (
                                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold"
                                            style={{ background: 'var(--color-danger)' }}>
                                            {leaves.filter(l => l.status === 'PENDING').length}
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-accent text-accent-fg px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity flex items-center"
                        >
                            <Plus size={16} className="mr-2" /> Request
                        </button>
                    </div>
                </div>

                {activeTab === 'calendar' ? (
                    <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-card p-1">
                        <LeaveCalendar leaves={leaves} isAdmin={isAdmin} currentUserId={user?.uid || ''} />
                    </div>
                ) : activeTab === 'admin' && isAdmin ? (
                    <div className="space-y-6">
                        {/* Pending Admin Section */}
                        {leaves.some(l => l.status === 'PENDING') && (
                            <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-card">
                                <div className="px-6 py-4 border-b border-border flex items-center gap-3">
                                    <AlertTriangle size={18} className="text-status-pending" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-heading">Pending approvals</h3>
                                        <p className="text-xs text-muted mt-0.5">Action required</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-secondary/30 text-xs font-semibold text-muted">
                                                <th className="px-6 py-3">Employee</th>
                                                <th className="px-6 py-3">Type</th>
                                                <th className="px-6 py-3">Duration</th>
                                                <th className="px-6 py-3">Reason</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {leaves.filter(l => l.status === 'PENDING').map(leave => (
                                                <tr key={leave.id} className="hover:bg-accent/5 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-heading">{leave.userName}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-secondary border-border text-muted`}>
                                                            {leave.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xs text-heading font-medium">
                                                            {leave.startDate === leave.endDate ? leave.startDate : `${leave.startDate} → ${leave.endDate}`}
                                                            <span className="text-muted ml-1 font-normal">({calculateDays(leave.startDate, leave.endDate)}d)</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-muted italic line-clamp-1">{leave.reason}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                onClick={() => handleStatusUpdate(leave.id, 'APPROVED')}
                                                                className="px-3 py-1.5 bg-status-completed-dim text-status-completed rounded-md border border-status-completed-dim hover:bg-status-completed hover:text-white transition-all text-[10px] font-bold uppercase"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusUpdate(leave.id, 'REJECTED')}
                                                                className="px-3 py-1.5 bg-status-halted-dim text-status-halted rounded-md border border-status-halted-dim hover:bg-status-halted hover:text-white transition-all text-[10px] font-bold uppercase"
                                                            >
                                                                Reject
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

                        {/* Staff Balance Admin Table */}
                        <div className="bg-secondary rounded-xl border border-border overflow-hidden shadow-card">
                            <div className="px-6 py-4 border-b border-border">
                                <h3 className="text-sm font-semibold text-heading">Staff leave utilization</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-secondary/50 text-xs font-semibold text-muted">
                                            <th className="px-6 py-4">Employee</th>
                                            <th className="px-6 py-4">Position</th>
                                            <th className="px-6 py-4">Used</th>
                                            <th className="px-6 py-4">Adj</th>
                                            <th className="px-6 py-4">Status / balance</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {allStaff.map(staff => {
                                            const isStaffArticle = staff.position === 'Article Trainee';
                                            const sLeaves = leaves.filter(l => l.userId === staff.uid && l.status === 'APPROVED');
                                            const taken = isStaffArticle
                                                ? sLeaves.reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0)
                                                : sLeaves.filter(l => l.startDate >= npStart && l.startDate <= npEnd).reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0);
                                            const adj = staff.leaveAdjustment || 0;
                                            const net = isStaffArticle ? ARTICLESHIP_LEAVE_LIMIT - (taken + adj) : null;

                                            return (
                                                <tr key={staff.uid} className="hover:bg-white/5 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-heading border border-accent/20">
                                                                {staff.displayName?.[0] || '?'}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-heading group-hover:text-accent transition-colors">{staff.displayName}</div>
                                                                <div className="text-[10px] text-muted">{staff.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-muted">{staff.position || 'Staff'}</td>
                                                    <td className="px-6 py-4 tabular-nums font-semibold text-accent">{taken}d</td>
                                                    <td className="px-6 py-4 tabular-nums">
                                                        <span className={adj > 0 ? 'text-status-in-progress' : adj < 0 ? 'text-accent' : 'text-muted'}>
                                                            {adj > 0 ? `+${adj}` : adj}d
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {isStaffArticle ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-semibold tabular-nums text-xs ${net! < 20 ? 'text-status-halted' : 'text-accent'}`}>{net} days</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted text-xs font-medium">Active</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setAdjustmentData({ uid: staff.uid, name: staff.displayName, amount: staff.leaveAdjustment || 0 });
                                                                setIsAdjustModalOpen(true);
                                                            }}
                                                            className="p-2 hover:bg-accent/10 rounded-lg text-muted hover:text-accent transition-colors"
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
                ) : (
                    <>
                        {/* Summary Widget Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            
                            {/* Usage Card */}
                            <div className={`${isArticleTrainee ? 'lg:col-span-12' : 'lg:col-span-5'} bg-secondary p-6 rounded-2xl border border-border shadow-card relative overflow-hidden group`}>
                                <div className="absolute top-[-20px] right-[-20px] p-6 opacity-[0.03]">
                                    <CalendarDays size={180} />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <p className="text-xs font-semibold text-accent">Quota utilization</p>
                                            <h2 className="text-4xl font-bold font-display text-heading mt-2 tabular-nums">
                                                {totalDaysTaken}
                                                <span className="text-muted ml-3 text-sm font-medium opacity-60">
                                                    / {isArticleTrainee ? ARTICLESHIP_LEAVE_LIMIT : 'Annual'}
                                                </span>
                                            </h2>
                                        </div>
                                        <div className="p-3 bg-accent/10 text-accent rounded-xl border border-accent/20">
                                            <Activity size={20} />
                                        </div>
                                    </div>

                                    {isArticleTrainee ? (
                                        <div className="bg-surface p-4 rounded-xl border border-border">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                                                    <BookOpen size={12} />
                                                </div>
                                                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Articleship allowance — 120 days total</span>
                                            </div>
                                            <div className="flex justify-between text-xs font-medium text-muted mb-3">
                                                <span>Total consumed</span>
                                                <span className={`tabular-nums ${totalDaysTaken > 100 ? 'text-status-halted' : 'text-accent'}`}>
                                                    {balanceRemaining} days available
                                                </span>
                                            </div>
                                            <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden ring-1 ring-white/5">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-[2000ms] ${totalDaysTaken > 100 ? 'bg-status-halted' : 'bg-accent'}`}
                                                    style={{ width: `${Math.min((totalDaysTaken / ARTICLESHIP_LEAVE_LIMIT) * 100, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted italic mt-2 opacity-60">Cumulative across 3-year term. No annual reset for trainees.</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-4 p-4 bg-accent/5 rounded-xl border border-accent/10">
                                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent border border-accent/20">
                                                <CheckCircle size={18} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-heading font-bold">Standard Allowance</p>
                                                <p className="text-[10px] text-muted">Fiscal Year: {npStart} to {npEnd}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Breakdown Card - Hidden for Article Trainees */}
                            {!isArticleTrainee && (
                                <div className="lg:col-span-7 bg-surface p-6 rounded-2xl border border-border flex flex-col justify-between shadow-card">
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-xs font-semibold text-muted">Leave type analysis</h3>
                                        <span className="text-xs bg-secondary px-2.5 py-1 rounded text-muted border border-border font-medium">Analytics</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <CircularProgress value={breakdown.Sick} max={12} color="var(--color-danger)" label="Sick" />
                                        <CircularProgress value={breakdown.Casual} max={6} color="var(--color-warning)" label="Casual" />
                                        <CircularProgress value={breakdown.Exam} max={15} color="#8b5cf6" label="Exam" />
                                        <CircularProgress value={breakdown.Home + breakdown.Other} max={15} color="var(--accent)" label="Others" />
                                    </div>
                                    
                                    <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
                                        <p className="text-[10px] text-muted italic font-medium">Auto-derived from approved requests across the active period.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Recent History Section */}
                        <div className="bg-surface rounded-xl border border-border overflow-hidden shadow-card">
                            <div className="px-6 py-4 border-b border-border bg-secondary/30 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-heading">Request timeline</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-xs font-semibold text-muted bg-secondary/30">
                                            {isAdmin && <th className="px-6 py-3">Staff</th>}
                                            <th className="px-6 py-3">Applied</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Period</th>
                                            <th className="px-6 py-3">Days</th>
                                            <th className="px-6 py-3">Reason</th>
                                            <th className="px-6 py-3 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {leaves.map((leave) => (
                                            <tr key={leave.id} className="hover:bg-accent/5 transition-colors">
                                                {isAdmin && (
                                                    <td className="px-6 py-4 text-xs font-bold text-heading">
                                                        {leave.userName}
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-xs font-medium text-muted font-mono">{leave.createdAt}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-secondary border border-border text-heading">{leave.type}</span>
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-heading text-xs">
                                                    {leave.startDate === leave.endDate ? leave.startDate : `${leave.startDate} → ${leave.endDate}`}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-accent">{calculateDays(leave.startDate, leave.endDate)}d</td>
                                                <td className="px-6 py-4 text-xs text-muted max-w-xs truncate italic">"{leave.reason}"</td>
                                                <td className="px-6 py-4 text-right">
                                                    {getStatusBadge(leave.status)}
                                                </td>
                                            </tr>
                                        ))}
                                        {leaves.length === 0 && (
                                            <tr>
                                                <td colSpan={isAdmin ? 7 : 6} className="px-6 py-10 text-center text-muted text-xs italic">No activity recorded for this period.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Request Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-secondary rounded-2xl border border-border w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-heading">New leave request</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-heading transition-colors"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted block mb-2">Leave type</label>
                                <select
                                    className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-heading focus:border-accent outline-none appearance-none"
                                    {...register('type')}
                                >
                                    <option value="Sick">Sick Leave</option>
                                    <option value="Casual">Casual Leave</option>
                                    <option value="Exam">Exam Leave</option>
                                    <option value="Other">Other Leave</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted block mb-2">Start date</label>
                                    <input type="date" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-heading focus:border-accent outline-none" {...register('startDate')} />
                                    {startBSStr && (
                                        <p className="text-[10px] text-accent font-semibold mt-1 pl-1">{startBSStr} BS</p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted block mb-2">End date</label>
                                    <input type="date" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-heading focus:border-accent outline-none" {...register('endDate')} />
                                    {endBSStr && (
                                        <p className="text-[10px] text-accent font-semibold mt-1 pl-1">{endBSStr} BS</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted block mb-2">Detailed reason</label>
                                <textarea rows={3} className="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-heading focus:border-accent outline-none" {...register('reason')} />
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-accent text-accent-fg py-2.5 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mail size={16} className="mr-2" />}
                                {isSaving ? 'Processing...' : 'Send request'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {rejectionTarget && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setRejectionTarget(null)} />
                    <div className="relative bg-secondary rounded-2xl border border-border w-full max-w-sm overflow-hidden animate-in scale-in duration-150">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-xs font-semibold text-heading">Reject request</h3>
                            <button onClick={() => setRejectionTarget(null)} className="text-muted hover:text-heading transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-6">
                            <textarea
                                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-heading outline-none focus:border-status-halted transition-all min-h-[100px]"
                                placeholder="State reason for rejection..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                            />
                            <div className="flex gap-3 mt-5">
                                <button onClick={() => setRejectionTarget(null)} className="flex-1 py-2 text-xs font-semibold text-muted hover:text-heading transition-colors">Cancel</button>
                                <button
                                    onClick={confirmRejection}
                                    disabled={!rejectionReason.trim() || isSaving}
                                    className="flex-1 bg-status-halted text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                                >
                                    Confirm rejection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Adjustment Modal */}
            {isAdjustModalOpen && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setIsAdjustModalOpen(false)} />
                    <div className="relative bg-secondary rounded-2xl border border-border w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-heading">Adjust balance</h3>
                            <button onClick={() => setIsAdjustModalOpen(false)} className="text-muted hover:text-heading transition-colors"><X size={18} /></button>
                        </div>
                        <div className="p-6">
                            <div className="text-center mb-6">
                                <p className="text-xs text-muted font-medium mb-1">Target individual</p>
                                <p className="text-lg font-bold text-heading">{adjustmentData.name}</p>
                            </div>
                            <div className="bg-surface border border-border rounded-xl p-6 mb-6">
                                <input
                                    type="number"
                                    className="w-full bg-transparent text-center text-4xl font-black text-accent outline-none tabular-nums"
                                    value={adjustmentData.amount}
                                    onChange={(e) => setAdjustmentData({ ...adjustmentData, amount: parseInt(e.target.value) || 0 })}
                                />
                                <p className="text-xs text-muted text-center mt-2 font-medium">Adjusted days</p>
                            </div>
                            <button
                                onClick={handleAdjustLeave}
                                disabled={isSaving}
                                className="w-full bg-accent text-accent-fg py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                            >
                                {isSaving ? 'Updating...' : 'Save adjustment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmLabel={confirmModal.confirmLabel}
                variant={confirmModal.variant}
                onConfirm={() => {
                    confirmModal.onConfirm?.();
                    setConfirmModal(prev => ({ ...prev, open: false }));
                }}
                onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
};

export default LeavePage;
