import React, { useState, useEffect } from 'react';
import {
    Settings, Users, Database, Trash2, AlertCircle, CheckCircle2,
    Loader2, Search, ShieldCheck, Key, ShieldOff, Archive
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { UserRole, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';
import { getNepaliFiscalYear, generateFiscalYearOptions } from '../utils/nepaliDate';

const SystemSettingsPage: React.FC = () => {
    React.useEffect(() => {
        document.title = 'System Settings — RSA';
        return () => { document.title = 'RSA'; };
    }, []);
    const { user } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isAuthUpdating, setIsAuthUpdating] = useState<string | null>(null);
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

    const authorizedCount = users.filter(u => u.taskCreationAuthorized === true).length;
    const complianceAuthorizedCount = users.filter(u => u.complianceCreationAuthorized === true).length;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-[var(--accent)]" size={36} />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-heading)] flex items-center">
                        <Settings className="mr-3 text-[var(--accent)]" size={24} />
                        System Settings
                    </h1>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Master admin control panel for user management and system configuration</p>
                </div>
            </div>

            {statusMessage && (
                <div className={`p-3.5 rounded-lg flex items-center border text-xs font-medium ${
                    statusMessage.type === 'success'
                        ? 'bg-[rgba(79,178,134,0.1)] border-[rgba(79,178,134,0.25)] text-[var(--color-success)]'
                        : 'bg-[rgba(224,112,122,0.1)] border-[rgba(224,112,122,0.25)] text-[var(--color-danger)]'
                }`}>
                    {statusMessage.type === 'success'
                        ? <CheckCircle2 size={16} className="mr-2 shrink-0" />
                        : <AlertCircle size={16} className="mr-2 shrink-0" />}
                    {statusMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column: Role Management + Task Authorization */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Unified Access & Role Management */}
                    <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border)]">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center">
                                    <ShieldCheck size={18} className="mr-2 text-[var(--accent)]" />
                                    Access & Authorization Control
                                </h3>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">Manage system roles, engagement initiation, and compliance calendar access centrally.</p>
                            </div>
                            <div className="relative w-full md:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="text-[var(--text-muted)] border-b border-[var(--border)] font-medium">
                                    <tr>
                                        <th className="px-3 py-2.5">User</th>
                                        <th className="px-3 py-2.5">System Role</th>
                                        <th className="px-3 py-2.5 text-center">Task Creation</th>
                                        <th className="px-3 py-2.5 text-center">Compliance Auth</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {filteredUsers.map(u => (
                                        <tr key={u.uid} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                                            <td className="px-3 py-3 min-w-[180px]">
                                                <div className="flex items-center">
                                                    <div className="w-8 h-8 rounded-full bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent)] font-semibold text-xs mr-2.5 flex-shrink-0">
                                                        {u.displayName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-[var(--text-heading)] leading-tight">{u.displayName}</div>
                                                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <select
                                                        disabled={isUpdating === u.uid || u.uid === user?.uid}
                                                        value={u.role}
                                                        onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                        className={`bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 cursor-pointer ${
                                                            u.role === UserRole.MASTER_ADMIN ? 'text-[var(--accent)]' : u.role === UserRole.ADMIN ? 'text-[var(--accent)]' : 'text-[var(--text-heading)]'
                                                        }`}
                                                    >
                                                        {Object.values(UserRole).map(role => (
                                                            <option key={role} value={role}>{role.replace('_', ' ')}</option>
                                                        ))}
                                                    </select>
                                                    {isUpdating === u.uid && (
                                                        <Loader2 className="animate-spin text-[var(--accent)]" size={14} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {u.role === UserRole.MASTER_ADMIN || u.role === UserRole.ADMIN ? (
                                                    <span className="text-[11px] text-[var(--text-muted)] italic block">Inherited</span>
                                                ) : isAuthUpdating === u.uid ? (
                                                    <Loader2 className="animate-spin text-[var(--accent)] mx-auto block" size={14} />
                                                ) : (
                                                    <button
                                                        onClick={() => u.taskCreationAuthorized ? handleRevokeTaskCreation(u.uid) : handleGrantTaskCreation(u.uid)}
                                                        className={`w-8 h-4 rounded-full relative transition-colors mx-auto block ${u.taskCreationAuthorized ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                                                        title={u.taskCreationAuthorized ? 'Revoke task creation' : 'Grant task creation'}
                                                    >
                                                        <div className={`w-3 h-3 bg-white rounded-full absolute top-[2px] transition-all ${u.taskCreationAuthorized ? 'left-[18px]' : 'left-0.5'}`} />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-center">
                                                {u.role === UserRole.MASTER_ADMIN || u.role === UserRole.ADMIN ? (
                                                    <span className="text-[11px] text-[var(--text-muted)] italic block">Inherited</span>
                                                ) : isComplianceAuthUpdating === u.uid ? (
                                                    <Loader2 className="animate-spin text-[var(--accent)] mx-auto block" size={14} />
                                                ) : (
                                                    <button
                                                        onClick={() => u.complianceCreationAuthorized ? handleRevokeComplianceCreation(u.uid) : handleGrantComplianceCreation(u.uid)}
                                                        className={`w-8 h-4 rounded-full relative transition-colors mx-auto block ${u.complianceCreationAuthorized ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                                                        title={u.complianceCreationAuthorized ? 'Revoke compliance creation' : 'Grant compliance creation'}
                                                    >
                                                        <div className={`w-3 h-3 bg-white rounded-full absolute top-[2px] transition-all ${u.complianceCreationAuthorized ? 'left-[18px]' : 'left-0.5'}`} />
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
                    <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border)]">
                        <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-4 flex items-center">
                            <ShieldCheck size={18} className="mr-2 text-[var(--accent)]" />
                            Security Overview
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--text-muted)]">Total users</span>
                                <span className="text-[var(--text-heading)] font-semibold tabular-nums">{users.length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--text-muted)]">Master admins</span>
                                <span className="text-[var(--accent)] font-semibold tabular-nums">{users.filter(u => u.role === UserRole.MASTER_ADMIN).length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--text-muted)]">Admins</span>
                                <span className="text-[var(--accent)] font-semibold tabular-nums">{users.filter(u => u.role === UserRole.ADMIN).length}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--text-muted)]">Task-authorized</span>
                                <span className="text-[var(--color-warning)] font-semibold tabular-nums">{authorizedCount}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[var(--text-muted)]">Compliance-authorized</span>
                                <span className="text-[var(--color-info)] font-semibold tabular-nums">{complianceAuthorizedCount}</span>
                            </div>
                        </div>
                        <div className="mt-5 pt-4 border-t border-[var(--border)] space-y-2">
                            <button 
                                onClick={() => navigate('/audit-logs')}
                                className="w-full bg-[var(--bg-main)] hover:bg-[var(--bg-elevated)] text-[var(--text-heading)] py-2 rounded-lg text-xs font-medium transition-colors border border-[var(--border)] flex items-center justify-center"
                            >
                                <Database size={14} className="mr-2 text-[var(--accent)]" /> View Audit Logs
                            </button>
                            <button 
                                onClick={() => navigate('/archived-tasks')}
                                className="w-full bg-[var(--bg-main)] hover:bg-[var(--bg-elevated)] text-[var(--text-heading)] py-2 rounded-lg text-xs font-medium transition-colors border border-[var(--border)] flex items-center justify-center"
                            >
                                <Archive size={14} className="mr-2 text-[var(--color-warning)]" /> View Archived Tasks
                            </button>
                        </div>
                    </div>

                    {/* Archive Management */}
                    <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border)]">
                        <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-1.5 flex items-center">
                            <Archive size={18} className="mr-2 text-[var(--color-warning)]" /> Archive Management
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mb-3">Clean up your workspace by archiving old completed tasks by Nepali Fiscal Year.</p>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Select Fiscal Year</label>
                                <select 
                                    value={archiveFY}
                                    onChange={(e) => setArchiveFY(e.target.value)}
                                    className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-heading)] font-semibold focus:border-[var(--accent)] outline-none cursor-pointer"
                                >
                                    {generateFiscalYearOptions(2080).reverse().map(fy => (
                                        <option key={fy} value={fy}>{fy}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <button
                                onClick={handleArchiveTasks}
                                disabled={isArchiving}
                                className="w-full bg-[rgba(217,164,65,0.1)] hover:bg-[rgba(217,164,65,0.18)] text-[var(--color-warning)] py-2 rounded-lg text-xs font-semibold transition-colors border border-[rgba(217,164,65,0.25)] flex items-center justify-center disabled:opacity-50"
                            >
                                {isArchiving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Archive size={14} className="mr-2" />}
                                Archive FY {archiveFY} Tasks
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[rgba(224,112,122,0.25)]">
                        <h3 className="text-sm font-semibold text-[var(--color-danger)] mb-1.5 flex items-center">
                            <Trash2 size={18} className="mr-2" /> Danger Zone
                        </h3>
                        <p className="text-xs text-[var(--text-muted)] mb-3">Permanent system-wide actions. Use with extreme caution.</p>
                        <div className="space-y-2">
                            <button
                                onClick={handleMigrateAllowlist}
                                disabled={isMigrating}
                                className="w-full bg-[var(--bg-main)] hover:bg-[var(--bg-elevated)] text-[var(--text-heading)] py-2 rounded-lg text-xs font-medium transition-colors border border-[var(--border)] flex items-center justify-center disabled:opacity-50"
                            >
                                {isMigrating ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
                                Migrate Staff to Allowlist
                            </button>
                            <button className="w-full bg-[rgba(224,112,122,0.1)] hover:bg-[rgba(224,112,122,0.18)] text-[var(--color-danger)] py-2 rounded-lg text-xs font-semibold transition-colors border border-[rgba(224,112,122,0.25)]">
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
