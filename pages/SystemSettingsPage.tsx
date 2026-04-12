
import React, { useState, useEffect } from 'react';
import {
    Settings, Users, Database, Trash2, AlertCircle, CheckCircle2,
    Loader2, Search, ShieldCheck, Key, ShieldOff, Archive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { UserRole, UserProfile, TaskStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { getNepaliFiscalYear, generateFiscalYearOptions } from '../utils/nepaliDate';
import { toast } from 'react-hot-toast';

const SystemSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [authSearchTerm, setAuthSearchTerm] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isAuthUpdating, setIsAuthUpdating] = useState<string | null>(null);
    const [complianceAuthSearchTerm, setComplianceAuthSearchTerm] = useState('');
    const [isComplianceAuthUpdating, setIsComplianceAuthUpdating] = useState<string | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [archiveFY, setArchiveFY] = useState('');

    useEffect(() => {
        setArchiveFY(getNepaliFiscalYear(new Date()));
    }, []);

    useEffect(() => {
        if (!user || user.role !== UserRole.MASTER_ADMIN) {
            navigate('/dashboard');
            return;
        }
        fetchUsers();
    }, [user]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await AuthService.getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (uid: string, newRole: UserRole) => {
        setIsUpdating(uid);
        try {
            await AuthService.updateUserRole(uid, newRole);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
            setStatusMessage({ type: 'success', text: `Role updated for user.` });
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: "Failed to update role." });
        } finally {
            setIsUpdating(null);
        }
    };

    const handleGrantTaskCreation = async (uid: string) => {
        setIsAuthUpdating(uid);
        try {
            await AuthService.grantTaskCreation(uid);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, taskCreationAuthorized: true } : u));
            setStatusMessage({ type: 'success', text: 'Task creation access granted.' });
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'Failed to grant access.' });
        } finally {
            setIsAuthUpdating(null);
        }
    };

    const handleRevokeTaskCreation = async (uid: string) => {
        setIsAuthUpdating(uid);
        try {
            await AuthService.revokeTaskCreation(uid);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, taskCreationAuthorized: false } : u));
            setStatusMessage({ type: 'success', text: 'Task creation access revoked.' });
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'Failed to revoke access.' });
        } finally {
            setIsAuthUpdating(null);
        }
    };

    const handleGrantComplianceCreation = async (uid: string) => {
        setIsComplianceAuthUpdating(uid);
        try {
            await AuthService.grantComplianceCreation(uid);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, complianceCreationAuthorized: true } : u));
            setStatusMessage({ type: 'success', text: 'Compliance creation access granted.' });
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'Failed to grant compliance access.' });
        } finally {
            setIsComplianceAuthUpdating(null);
        }
    };

    const handleRevokeComplianceCreation = async (uid: string) => {
        setIsComplianceAuthUpdating(uid);
        try {
            await AuthService.revokeComplianceCreation(uid);
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, complianceCreationAuthorized: false } : u));
            setStatusMessage({ type: 'success', text: 'Compliance creation access revoked.' });
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: 'Failed to revoke compliance access.' });
        } finally {
            setIsComplianceAuthUpdating(null);
        }
    };

    const handleArchiveTasks = async () => {
        if (!archiveFY) return;
        const msg = `This will move all COMPLETED tasks from Fiscal Year ${archiveFY} to ARCHIVED status. They will no longer appear in the main Tasks page. Proceed?`;
        if (!window.confirm(msg)) return;
        
        setIsArchiving(true);
        try {
            const count = await AuthService.archiveTasksByFiscalYear(archiveFY);
            setStatusMessage({ type: 'success', text: `Successfully archived ${count} tasks for FY ${archiveFY}.` });
            setTimeout(() => setStatusMessage(null), 5000);
        } catch (error: any) {
            console.error(error);
            setStatusMessage({ type: 'error', text: "Archiving failed: " + error.message });
        } finally {
            setIsArchiving(false);
        }
    };

    const handleMigrateAllowlist = async () => {
        if (!window.confirm("This will copy all existing active staff emails into the new Staff Allowlist. Proceed?")) return;
        setIsMigrating(true);
        try {
            await AuthService.migrateExistingStaffToAllowlist();
            setStatusMessage({ type: 'success', text: "Staff allowlist migration completed successfully." });
        } catch (error: any) {
            console.error(error);
            setStatusMessage({ type: 'error', text: "Failed to migrate allowlist: " + error.message });
        } finally {
            setIsMigrating(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Only show non-admin/manager users in the task authorization panel
    const authEligibleUsers = users.filter(u =>
        u.role !== UserRole.MASTER_ADMIN &&
        u.role !== UserRole.ADMIN &&
        u.uid !== user?.uid &&
        (u.displayName.toLowerCase().includes(authSearchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(authSearchTerm.toLowerCase()))
    );

    const authorizedCount = users.filter(u => u.taskCreationAuthorized === true).length;
    const complianceAuthorizedCount = users.filter(u => u.complianceCreationAuthorized === true).length;

    // Only show non-admin/manager users in the compliance authorization panel
    const complianceAuthEligibleUsers = users.filter(u =>
        u.role !== UserRole.MASTER_ADMIN &&
        u.role !== UserRole.ADMIN &&
        u.uid !== user?.uid &&
        (u.displayName.toLowerCase().includes(complianceAuthSearchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(complianceAuthSearchTerm.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-brand-500" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading flex items-center">
                        <Settings className="mr-3 text-brand-500" size={28} />
                        System Settings
                    </h1>
                    <p className="text-sm text-gray-400">Master Admin control panel for user management and system configuration</p>
                </div>
            </div>

            {statusMessage && (
                <div className={`p-4 rounded-xl flex items-center border animate-in slide-in-from-top ${statusMessage.type === 'success'
                    ? 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {statusMessage.type === 'success'
                        ? <CheckCircle2 size={18} className="mr-2" />
                        : <AlertCircle size={18} className="mr-2" />}
                    {statusMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left column: Role Management + Task Authorization */}
                <div className="lg:col-span-2 space-y-6">

                    {/* ── Unified Access & Role Management ── */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center">
                                    <ShieldCheck size={20} className="mr-2 text-brand-400" />
                                    Access & Authorization Control
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">Manage system roles, engagement initiation, and compliance calendar access centrally.</p>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-navy-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-gray-400 border-b border-white/5 uppercase text-[10px] tracking-widest font-bold">
                                    <tr>
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">System Role</th>
                                        <th className="px-4 py-3 text-center">Task Creation</th>
                                        <th className="px-4 py-3 text-center">Compliance Auth</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredUsers.map(u => (
                                        <tr key={u.uid} className="group hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-4 min-w-[200px]">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/20 flex items-center justify-center text-brand-200 font-bold mr-3 flex-shrink-0">
                                                        {u.displayName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white leading-tight">{u.displayName}</div>
                                                        <div className="text-[11px] text-gray-500 mt-0.5">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        disabled={isUpdating === u.uid || u.uid === user?.uid}
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                        className={`bg-navy-900 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 uppercase ${u.role === UserRole.MASTER_ADMIN ? 'text-purple-400' : u.role === UserRole.ADMIN ? 'text-brand-400' : 'text-gray-300'}`}
                                                    >
                                                        {Object.values(UserRole).map(role => (
                                                            <option key={role} value={role}>{role.replace('_', ' ')}</option>
                                                        ))}
                                                    </select>
                                                    {isUpdating === u.uid && (
                                                        <Loader2 className="animate-spin text-brand-500" size={14} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {u.role === UserRole.MASTER_ADMIN || u.role === UserRole.ADMIN ? (
                                                    <span className="text-[10px] text-gray-500 italic block mt-1 tracking-wider uppercase">Inherited</span>
                                                ) : isAuthUpdating === u.uid ? (
                                                    <Loader2 className="animate-spin text-amber-500 mx-auto block mt-1" size={16} />
                                                ) : (
                                                    <button
                                                        onClick={() => u.taskCreationAuthorized ? handleRevokeTaskCreation(u.uid) : handleGrantTaskCreation(u.uid)}
                                                        className={`w-9 h-5 rounded-full relative transition-colors mx-auto block ${u.taskCreationAuthorized ? 'bg-amber-500' : 'bg-white/10'}`}
                                                    >
                                                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${u.taskCreationAuthorized ? 'left-[18px]' : 'left-1'}`} />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {u.role === UserRole.MASTER_ADMIN || u.role === UserRole.ADMIN ? (
                                                    <span className="text-[10px] text-gray-500 italic block mt-1 tracking-wider uppercase">Inherited</span>
                                                ) : isComplianceAuthUpdating === u.uid ? (
                                                    <Loader2 className="animate-spin text-indigo-500 mx-auto block mt-1" size={16} />
                                                ) : (
                                                    <button
                                                        onClick={() => u.complianceCreationAuthorized ? handleRevokeComplianceCreation(u.uid) : handleGrantComplianceCreation(u.uid)}
                                                        className={`w-9 h-5 rounded-full relative transition-colors mx-auto block ${u.complianceCreationAuthorized ? 'bg-indigo-500' : 'bg-white/10'}`}
                                                    >
                                                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${u.complianceCreationAuthorized ? 'left-[18px]' : 'left-1'}`} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Security Overview + Danger Zone */}
                <div className="space-y-6">
                    <div className="glass-panel p-6 rounded-2xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                            <ShieldCheck size={20} className="mr-2 text-accent-purple" />
                            Security Overview
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Total Users</span>
                                <span className="text-white font-bold">{users.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Master Admins</span>
                                <span className="text-purple-300 font-bold">{users.filter(u => u.role === UserRole.MASTER_ADMIN).length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Admins</span>
                                <span className="text-brand-300 font-bold">{users.filter(u => u.role === UserRole.ADMIN).length}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Task-Authorized</span>
                                <span className="text-amber-300 font-bold">{authorizedCount}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">Compliance-Authorized</span>
                                <span className="text-indigo-300 font-bold">{complianceAuthorizedCount}</span>
                            </div>
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <button 
                                onClick={() => navigate('/audit-logs')}
                                className="w-full bg-navy-800 hover:bg-navy-700 text-gray-300 py-2.5 rounded-xl text-sm font-semibold transition-colors border border-white/5 flex items-center justify-center mb-2"
                            >
                                <Database size={16} className="mr-2 text-indigo-400" /> View Audit Logs
                            </button>
                            <button 
                                onClick={() => navigate('/archived-tasks')}
                                className="w-full bg-navy-800 hover:bg-navy-700 text-gray-300 py-2.5 rounded-xl text-sm font-semibold transition-colors border border-white/5 flex items-center justify-center"
                            >
                                <Archive size={16} className="mr-2 text-amber-400" /> View Archived Tasks
                            </button>
                        </div>
                    </div>

                    {/* ── Archive Management ── */}
                    <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5">
                        <h3 className="text-lg font-bold text-amber-400 mb-2 flex items-center">
                            <Archive size={20} className="mr-2" /> Archive Management
                        </h3>
                        <p className="text-xs text-gray-400 mb-4">Clean up your workspace by archiving old completed tasks by Nepali Fiscal Year.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Select Fiscal Year</label>
                                <select 
                                    value={archiveFY}
                                    onChange={(e) => setArchiveFY(e.target.value)}
                                    className="w-full bg-navy-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-amber-400 font-bold focus:ring-1 focus:ring-amber-500 outline-none"
                                >
                                    {generateFiscalYearOptions(2080).reverse().map(fy => (
                                        <option key={fy} value={fy}>{fy}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <button
                                onClick={handleArchiveTasks}
                                disabled={isArchiving}
                                className="w-full bg-amber-600/20 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold transition-all border border-amber-500/30 flex items-center justify-center disabled:opacity-50"
                            >
                                {isArchiving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Archive size={16} className="mr-2" />}
                                Archive FY {archiveFY} Tasks
                            </button>
                        </div>
                    </div>

                    <div className="glass-panel p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
                        <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center">
                            <Trash2 size={20} className="mr-2" /> Danger Zone
                        </h3>
                        <p className="text-xs text-gray-400 mb-4">Permanent system-wide actions. Use with extreme caution.</p>
                        <div className="space-y-3">
                            <button
                                onClick={handleMigrateAllowlist}
                                disabled={isMigrating}
                                className="w-full bg-amber-600/20 hover:bg-amber-600 text-blue-200 py-2.5 rounded-xl text-sm font-bold transition-all border border-amber-500/30 mb-2 flex items-center justify-center disabled:opacity-50"
                            >
                                {isMigrating ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                                Migrate Staff to Allowlist
                            </button>
                            <button className="w-full bg-red-600/20 hover:bg-red-600 text-red-200 py-2.5 rounded-xl text-sm font-bold transition-all border border-red-500/30">
                                Clear System Cache
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsPage;
