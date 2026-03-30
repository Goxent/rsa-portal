
import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Briefcase, Calendar, Plus, Search, Grid, List, Shield, X, Edit, Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { UserProfile, UserRole, StaffDirectoryProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { userKeys } from '../hooks/useStaff';
import { getAvatarColor, getInitials } from '../utils/userUtils';
import toast from 'react-hot-toast';

const StaffPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    const [fullUsers, setFullUsers] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('All');
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const [formData, setFormData] = useState<Partial<UserProfile>>({
        displayName: '',
        email: '',
        role: UserRole.STAFF,
        department: 'Audit',
        phoneNumber: '',
        address: '',
        position: 'Staff',
        dateOfJoining: '',
        status: 'Active',
        gender: 'Male',
    });

    // Fetch users using React Query (shared cache with Detail page)
    const { data: users = [], isLoading, refetch } = useQuery({
        queryKey: userKeys.all,
        queryFn: AuthService.getAllUsers,
        select: (data) => data.map(u => ({
            uid: u.uid,
            displayName: u.displayName,
            email: u.email,
            role: u.role,
            department: u.department,
            position: u.position,
            phoneNumber: u.phoneNumber,
            status: u.status,
            photoURL: u.photoURL,
            gender: u.gender,
            dateOfJoining: u.dateOfJoining
        } as StaffDirectoryProfile))
    });

    useEffect(() => {
        // Fetch full profiles for editing logic (only if admin)
        if (isAdmin) {
            AuthService.getAllUsers().then(setFullUsers);
        }
    }, [isAdmin]);

    useEffect(() => {
        const allowed = [UserRole.ADMIN, UserRole.MASTER_ADMIN] as string[];
        if (user && !allowed.includes(user.role)) {
            navigate('/dashboard');
            return;
        }
    }, [user, navigate]);

    const handleOpenAdd = () => {
        setIsEditing(false);
        setSelectedUser(null);
        setFormData({
            displayName: '',
            email: '',
            role: UserRole.STAFF,
            department: 'Audit',
            phoneNumber: '',
            address: '',
            position: 'Staff',
            dateOfJoining: new Date().toISOString().split('T')[0],
            status: 'Active',
            gender: 'Male',
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (staff: StaffDirectoryProfile) => {
        const fullProfile = fullUsers.find(u => u.uid === staff.uid);
        if (!fullProfile) return; // Should not happen

        setIsEditing(true);
        setSelectedUser(fullProfile);
        setFormData({ ...fullProfile });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (isSaving) return;
        setIsSaving(true);

        try {
            if (isEditing && selectedUser) {
                await AuthService.updateUserProfile(selectedUser.uid, formData);
                if (formData.status === 'Inactive' && formData.email) {
                    await AuthService.deleteStaffUser(selectedUser.uid, formData.email);
                }
                toast.success('Profile updated!');
            } else {
                await AuthService.createStaffUser(formData);
                toast.success('Invitation email sent to ' + formData.email);
            }
            await refetch();
            if (isAdmin) AuthService.getAllUsers().then(setFullUsers);
            
            setIsModalOpen(false);
        } catch (error: any) {
            setFormError(error.message);
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // A–Z sort helper for role display
    const getRoleLabel = (role: UserRole): string => {
        switch (role) {
            case UserRole.MASTER_ADMIN: return 'Master Admin';
            case UserRole.ADMIN: return 'Admin';
            case UserRole.MANAGER: return 'Manager';
            case UserRole.STAFF: return 'User';
            default: return String(role);
        }
    };

    const filteredUsers = users
        .filter(u => {
            const matchesSearch = u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDept = selectedDepartment === 'All' || u.department === selectedDepartment;
            return matchesSearch && matchesDept;
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const departments = ['All', 'Audit', 'Tax', 'Advisory', 'Admin'];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 bg-transparent">
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">Staff Directory</h1>
                    <p className="text-sm text-gray-400">Manage employee profiles and access permissions</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 flex items-center shadow-lg shadow-brand-900/40 transition-all hover:-translate-y-0.5 border border-brand-500/30 group"
                >
                    <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform duration-300" /> Invite Staff Member
                </button>
            </div>

            {/* Department Filters */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2 hide-scrollbar">
                {departments.map(dept => (
                    <button
                        key={dept}
                        onClick={() => setSelectedDepartment(dept)}
                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${
                            selectedDepartment === dept
                                ? 'bg-brand-500/20 text-brand-300 border-brand-500/30 shadow-lg shadow-brand-500/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5 border-transparent'
                        }`}
                    >
                        {dept}
                    </button>
                ))}
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center glass-panel p-4 rounded-xl border border-white/5">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-lg bg-navy-800/50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-gray-100"
                        placeholder="Search staff by name, email or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center bg-white/5 p-1 rounded-lg border border-white/10">
                    <button onClick={() => setViewMode('GRID')} className={`p-1.5 rounded ${viewMode === 'GRID' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>
                        <Grid size={16} />
                    </button>
                    <button onClick={() => setViewMode('LIST')} className={`p-1.5 rounded ${viewMode === 'LIST' ? 'bg-white/10 text-white' : 'text-gray-400'}`}>
                        <List size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'GRID' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredUsers.map((staff, index) => {
                        const avatarStyle = getAvatarColor(staff.uid);

                        return (
                            <div
                                key={staff.uid}
                                className="glass-panel p-0 rounded-2xl overflow-hidden group border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-1"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Card Header with Fluid Gradient */}
                                <div className={`p-6 bg-gradient-to-br ${avatarStyle.from} ${avatarStyle.to} relative overflow-hidden`}>
                                    {/* Abstract Shapes */}
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                                    <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-black/10 rounded-full blur-xl"></div>

                                    <div className="relative z-10 flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg backdrop-blur-md ${avatarStyle.bg} ${avatarStyle.text} border ${avatarStyle.border} group-hover:scale-110 transition-transform duration-500`}>
                                                {getInitials(staff.displayName)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-lg leading-tight tracking-tight group-hover:text-blue-200 transition-colors">
                                                    {staff.displayName}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-bold border border-brand-500/30 backdrop-blur-sm uppercase tracking-wider">
                                                        {getRoleLabel(staff.role)}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/20 border border-white/5 backdrop-blur-sm">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${staff.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${staff.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {staff.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleOpenEdit(staff)}
                                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-all backdrop-blur-md transform translate-x-2 group-hover:translate-x-0"
                                        >
                                            <Edit size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-6 space-y-4 bg-navy-900/40 backdrop-blur-sm">
                                    <div className="grid grid-cols-2 gap-4">

                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Position</p>
                                            <div className="flex items-center text-sm font-medium text-gray-200">
                                                <Shield size={14} className={`mr-2 ${avatarStyle.text}`} />
                                                <span className="truncate">{staff.position || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Department</p>
                                            <div className="flex items-center text-sm font-medium text-gray-200">
                                                <Briefcase size={14} className={`mr-2 ${avatarStyle.text}`} />
                                                <span className="truncate">{staff.department || 'General'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                                    <div className="space-y-2.5">
                                        <div className="flex items-center text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                                            <Mail size={12} className="mr-2 text-gray-500" />
                                            <span className="truncate">{staff.email}</span>
                                        </div>
                                        <div className="flex items-center text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                                            <Phone size={12} className="mr-2 text-gray-500" />
                                            <span className="truncate">{staff.phoneNumber || 'Not provided'}</span>
                                        </div>
                                        <div className="flex items-center text-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                                            <Calendar size={12} className="mr-2 text-gray-500" />
                                            <span>Joined: {staff.dateOfJoining || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="glass-panel rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-navy-900/50 text-gray-400 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4 font-heading">Name</th>
                                <th className="px-6 py-4 font-heading">Role / Position</th>
                                <th className="px-6 py-4 font-heading">Contact</th>

                                <th className="px-6 py-4 font-heading">Gender</th>
                                <th className="px-6 py-4 font-heading">Status</th>
                                <th className="px-6 py-4 font-heading">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((staff) => {
                                const avatarStyle = getAvatarColor(staff.uid);
                                return (
                                    <tr key={staff.uid} className="hover:bg-white/5 transition-colors border-b border-white/5">
                                        <td className="px-6 py-4 font-medium text-white flex items-center">
                                            <div className={`w-9 h-9 rounded-xl ${avatarStyle.bg} ${avatarStyle.text} flex items-center justify-center mr-3 text-xs font-black border ${avatarStyle.border}`}>
                                                {getInitials(staff.displayName)}
                                            </div>
                                            {staff.displayName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-white">{staff.position || getRoleLabel(staff.role)}</div>
                                            <div className="text-xs text-gray-500">{getRoleLabel(staff.role)}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <div className="text-gray-200 font-medium">{staff.email}</div>
                                            <div className="text-gray-500 mt-0.5">{staff.phoneNumber || 'No phone'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">{staff.gender || '-'}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${staff.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${staff.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {staff.status || 'Active'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleOpenEdit(staff)}
                                                className={`text-amber-400 hover:text-white transition-colors ${staff.role === UserRole.MASTER_ADMIN && user?.role !== UserRole.MASTER_ADMIN ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={staff.role === UserRole.MASTER_ADMIN && user?.role !== UserRole.MASTER_ADMIN}
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white font-heading">{isEditing ? 'Edit Staff Profile' : 'Send Workspace Invitation'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors hover:rotate-90 duration-200"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 overflow-y-auto">
                            {successMessage && (
                                <div className="mb-4 bg-emerald-500/20 text-emerald-200 px-4 py-3 rounded-lg flex items-center text-sm border border-emerald-500/30 animate-in fade-in duration-300">
                                    <CheckCircle2 size={16} className="mr-2 flex-shrink-0" /> {successMessage}
                                </div>
                            )}
                            {formError && (
                                <div className="mb-4 bg-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center text-sm border border-red-500/20">
                                    <AlertCircle size={16} className="mr-2" /> {formError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Full Name *</label>
                                    <input required className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Official Email *</label>
                                    <input type="email" required disabled={isEditing} className="w-full glass-input rounded-lg px-3 py-2 text-sm disabled:opacity-50" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="staff@rsa.com" />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Role / Permission</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}>
                                        <option value={UserRole.STAFF}>User</option>
                                        {(user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.ADMIN) && <option value={UserRole.ADMIN}>Admin</option>}
                                        {user?.role === UserRole.MASTER_ADMIN && <option value={UserRole.MASTER_ADMIN}>Master Admin</option>}
                                    </select>
                                    <div className="text-[10px] text-gray-500 mt-1">* Only Master Admin can assign Admin roles</div>
                                </div>


                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Job Position</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={formData.position}
                                        onChange={e => setFormData({ ...formData, position: e.target.value })}
                                    >
                                        <option value="">Select Position</option>
                                        <option value="Principal">Principal</option>
                                        <option value="Manager">Manager</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Staff">Staff</option>
                                        <option value="Article Trainee">Article Trainee</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Gender</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={formData.gender}
                                        onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Phone Number</label>
                                    <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Date of Joining</label>
                                    <input type="date" className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={formData.dateOfJoining} onChange={e => setFormData({ ...formData, dateOfJoining: e.target.value })} />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Status</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Address</label>
                                    <input className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full residential address" />
                                </div>
                            </div>

                            <div className="pt-6 mt-4 border-t border-white/10 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors text-sm disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={isSaving} className="bg-brand-600 hover:bg-brand-500 disabled:opacity-70 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center min-w-[150px] justify-center transition-all">
                                    {isSaving ? (
                                        <><Loader2 size={16} className="mr-2 animate-spin" /> {isEditing ? 'Saving...' : 'Sending...'}</>
                                    ) : (
                                        <>{isEditing ? <Save size={16} className="mr-2" /> : <Mail size={16} className="mr-2" />} {isEditing ? 'Save Changes' : 'Send Invitation'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
};

export default StaffPage;
