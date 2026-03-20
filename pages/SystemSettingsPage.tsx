
import React, { useState, useEffect } from 'react';
import { Settings, Users, Shield, Database, Trash2, Save, AlertCircle, CheckCircle2, Loader2, UserPlus, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { UserRole, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';

const SystemSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [isMigrating, setIsMigrating] = useState(false);

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

    const handleSeedData = async () => {
        setIsLoading(true);
        try {
            await AuthService.seedDemoData();
            setStatusMessage({ type: 'success', text: "Demo data seeded successfully!" });
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (error) {
            setStatusMessage({ type: 'error', text: "Failed to seed demo data." });
        } finally {
            setIsLoading(false);
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
                <div className={`p-4 rounded-xl flex items-center border animate-in slide-in-from-top ${statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    {statusMessage.type === 'success' ? <CheckCircle2 size={18} className="mr-2" /> : <AlertCircle size={18} className="mr-2" />}
                    {statusMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Management Section */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="glass-panel p-6 rounded-2xl border border-white/10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <Users size={20} className="mr-2 text-brand-400" />
                                User Role Management
                            </h3>
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
                                        <th className="px-4 py-3">Current Role</th>
                                        <th className="px-4 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredUsers.map(u => (
                                        <tr key={u.uid} className="group hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/20 flex items-center justify-center text-brand-200 font-bold mr-3">
                                                        {u.displayName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-white">{u.displayName}</div>
                                                        <div className="text-xs text-gray-500">{u.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${u.role === UserRole.MASTER_ADMIN ? 'bg-purple-500/20 text-purple-300 border-purple-500/20' :
                                                    u.role === UserRole.ADMIN ? 'bg-brand-500/20 text-brand-300 border-brand-500/20' :
                                                        u.role === UserRole.MANAGER ? 'bg-amber-500/20 text-amber-300 border-amber-500/20' :
                                                            'bg-gray-500/20 text-gray-400 border-gray-500/20'
                                                    }`}>
                                                    {u.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <select
                                                    disabled={isUpdating === u.uid || u.uid === user?.uid}
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                                    className="bg-navy-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                                                >
                                                    {Object.values(UserRole).map(role => (
                                                        <option key={role} value={role}>{role.replace('_', ' ')}</option>
                                                    ))}
                                                </select>
                                                {isUpdating === u.uid && <Loader2 className="animate-spin inline-block ml-2 text-brand-500" size={14} />}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* System Stats / Logs Sidebar */}
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
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <button className="w-full bg-navy-800 hover:bg-navy-700 text-gray-300 py-2.5 rounded-xl text-sm font-semibold transition-colors border border-white/5 flex items-center justify-center">
                                <Database size={16} className="mr-2" /> View Audit Logs
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
                            <button
                                onClick={handleSeedData}
                                className="w-full bg-brand-600/20 hover:bg-brand-600 text-brand-200 py-2.5 rounded-xl text-sm font-bold transition-all border border-brand-500/30 mb-2"
                            >
                                Seed Demo Clients
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
