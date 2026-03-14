
import React, { useState, useEffect } from 'react';
import { CalendarDays, CheckCircle, Clock, Plus, X, AlertCircle, AlertTriangle, Mail, XCircle, ChevronDown, Check, ThumbsDown, UserCog, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LeaveRequest, UserRole, UserProfile } from '../types';
import { AuthService } from '../services/firebase';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { leaveSchema, LeaveFormValues } from '../utils/validationSchemas';

const ARTICLESHIP_LEAVE_LIMIT = 120; // 3 Years Total

const LeavePage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
    const [allStaff, setAllStaff] = useState<UserProfile[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'my' | 'admin'>(isAdmin ? 'admin' : 'my');
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
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

    const totalDaysTaken = myApprovedLeaves.reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0);
    const balanceRemaining = ARTICLESHIP_LEAVE_LIMIT - totalDaysTaken;

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
        if (window.confirm(`Are you sure you want to ${status} this request?`)) {
            await AuthService.updateLeaveStatus(id, status);
            loadLeaves();
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
            case 'APPROVED': return <span className="flex items-center text-green-300 text-xs font-bold bg-green-500/20 border border-green-500/30 px-2 py-1 rounded-full w-fit"><CheckCircle size={12} className="mr-1" /> APPROVED</span>;
            case 'REJECTED': return <span className="flex items-center text-red-300 text-xs font-bold bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-full w-fit"><XCircle size={12} className="mr-1" /> REJECTED</span>;
            default: return <span className="flex items-center text-amber-300 text-xs font-bold bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded-full w-fit"><Clock size={12} className="mr-1" /> PENDING</span>;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Leave Management</h1>
                    <p className="text-sm text-gray-400">Articleship Leave Balance (3 Years)</p>
                </div>
                <div className="flex items-center gap-4">
                    {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN) && (
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-2">
                            <button
                                onClick={() => setActiveTab('admin')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                Staff Balances
                            </button>
                            <button
                                onClick={() => setActiveTab('my')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'my' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                My Leaves
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-900/40 flex items-center border border-blue-500/30 transition-all hover:-translate-y-0.5"
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
                                                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
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
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mt-1">Total Limit: {ARTICLESHIP_LEAVE_LIMIT} Days</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-300">
                                <thead>
                                    <tr className="text-gray-400 border-b border-white/10 uppercase text-[10px] tracking-wider bg-black/20 font-black">
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Position</th>
                                        <th className="px-6 py-4">Leaves Taken</th>
                                        <th className="px-6 py-4">Adjustment</th>
                                        <th className="px-6 py-4">Net Balance</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {allStaff.map(staffMember => {
                                        const staffLeaves = leaves.filter(l => l.userId === staffMember.uid && l.status === 'APPROVED');
                                        const taken = staffLeaves.reduce((acc, curr) => acc + calculateDays(curr.startDate, curr.endDate), 0);
                                        const adj = staffMember.leaveAdjustment || 0;
                                        const net = ARTICLESHIP_LEAVE_LIMIT - (taken + adj);

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
                                                <td className="px-6 py-4 font-mono font-bold text-blue-400">{taken}d</td>
                                                <td className="px-6 py-4 font-mono">
                                                    <span className={adj > 0 ? 'text-orange-400' : adj < 0 ? 'text-emerald-400' : 'text-gray-500'}>
                                                        {adj > 0 ? `+${adj}` : adj}d
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold font-mono ${net < 20 ? 'text-red-400' : 'text-emerald-400'}`}>{net}d</span>
                                                        <div className="w-20 bg-white/5 rounded-full h-1 hidden md:block">
                                                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.max(0, (net / ARTICLESHIP_LEAVE_LIMIT) * 100)}%` }}></div>
                                                        </div>
                                                    </div>
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
            ) : (
                <>
                    {/* Balance Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {/* Total Balance Card */}
                        <div className="glass-panel p-6 rounded-xl relative overflow-hidden md:col-span-2 group hover:bg-white/5 transition-all">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <CalendarDays size={100} />
                            </div>
                            <div className="relative z-10 flex flex-col justify-between h-full">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium text-gray-400">Total Leaves Taken</p>
                                        <h2 className="text-4xl font-bold text-white mt-1">{totalDaysTaken} <span className="text-lg text-gray-500 font-medium">/ {ARTICLESHIP_LEAVE_LIMIT} Days</span></h2>
                                    </div>
                                    <div className="p-2 bg-blue-500/20 text-blue-300 rounded-lg border border-blue-500/20"><CalendarDays size={20} /></div>
                                </div>

                                <div className="mt-6">
                                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                                        <span>Utilization</span>
                                        <span>{Math.round((totalDaysTaken / ARTICLESHIP_LEAVE_LIMIT) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full shadow-[0_0_10px_currentColor] transition-all duration-1000 ${totalDaysTaken > 100 ? 'bg-red-500 text-red-500' :
                                                totalDaysTaken > 60 ? 'bg-amber-500 text-amber-500' : 'bg-blue-500 text-blue-500'
                                                }`}
                                            style={{ width: `${Math.min((totalDaysTaken / ARTICLESHIP_LEAVE_LIMIT) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Card */}
                        <div className="glass-panel p-6 rounded-xl md:col-span-2 flex flex-col justify-center space-y-3">
                            <h3 className="text-sm font-medium text-gray-400 mb-1 border-b border-white/5 pb-2">Breakdown</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300 flex items-center"><div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div> Exam</span>
                                    <span className="font-bold text-white">{breakdown.Exam}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300 flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Sick</span>
                                    <span className="font-bold text-white">{breakdown.Sick}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300 flex items-center"><div className="w-2 h-2 rounded-full bg-orange-500 mr-2"></div> Home</span>
                                    <span className="font-bold text-white">{breakdown.Home}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300 flex items-center"><div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div> Casual</span>
                                    <span className="font-bold text-white">{breakdown.Casual}</span>
                                </div>
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
                                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
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
                                                className={`w-full rounded-lg px-3 py-2.5 text-sm appearance-none cursor-pointer border ${errors.type ? 'border-red-500' : 'border-gray-600'} bg-gray-800 text-white focus:ring-2 focus:ring-blue-500`}
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
                                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-900/30 flex justify-center items-center transition-all transform active:scale-[0.98] disabled:opacity-50"
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
    );
};

export default LeavePage;
