
import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Briefcase, Calendar, Plus, Search, Grid, List, Shield, X, Edit, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { useNavigate } from 'react-router-dom';

const StaffPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

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

    useEffect(() => {
        // Only Admin allowed
        // Only Admin or Master Admin allowed
        const allowed = [UserRole.ADMIN, UserRole.MASTER_ADMIN] as string[];
        if (user && !allowed.includes(user.role)) {
            navigate('/dashboard');
            return;
        }
        fetchUsers();
    }, [user]);

    const fetchUsers = async () => {
        const data = await AuthService.getAllUsers();
        setUsers(data);
    };

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

    const handleOpenEdit = (staff: UserProfile) => {
        setIsEditing(true);
        setSelectedUser(staff);
        setFormData({ ...staff });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (isSaving) return; // Prevent duplicate submissions
        setIsSaving(true);

        try {
            if (isEditing && selectedUser) {
                await AuthService.updateUserProfile(selectedUser.uid, formData);
            } else {
                await AuthService.createStaffUser(formData);
            }
            await fetchUsers();
            setIsModalOpen(false);
        } catch (error: any) {
            setFormError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    const filteredUsers = users.filter(u =>
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">Staff Directory</h1>
                    <p className="text-sm text-gray-400">Manage employee profiles and access permissions</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 flex items-center shadow-lg shadow-brand-900/40 transition-all hover:-translate-y-0.5 border border-brand-500/30"
                >
                    <Plus size={18} className="mr-2" /> Add Staff Member
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center glass-panel p-4 rounded-xl">
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
                        // Deterministic color generation
                        const colors = [
                            'from-blue-600/20 to-cyan-400/10',
                            'from-purple-600/20 to-pink-400/10',
                            'from-emerald-600/20 to-teal-400/10',
                            'from-orange-600/20 to-amber-400/10',
                            'from-indigo-600/20 to-violet-400/10',
                            'from-rose-600/20 to-red-400/10'
                        ];
                        const colorIndex = staff.uid.charCodeAt(0) % colors.length;
                        const bgGradient = colors[colorIndex];
                        const accentColor = bgGradient.split(' ')[0].replace('from-', 'text-').replace('-600/20', '-400');

                        return (
                            <div
                                key={staff.uid}
                                className="glass-panel p-0 rounded-2xl overflow-hidden group border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-1"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Card Header with Fluid Gradient */}
                                <div className={`p-6 bg-gradient-to-br ${bgGradient} relative overflow-hidden`}>
                                    {/* Abstract Shapes */}
                                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                                    <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-black/10 rounded-full blur-xl"></div>

                                    <div className="relative z-10 flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg backdrop-blur-md bg-white/10 text-white border border-white/20 group-hover:scale-110 transition-transform duration-500">
                                                {getInitials(staff.displayName)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-lg leading-tight tracking-tight group-hover:text-blue-200 transition-colors">
                                                    {staff.displayName}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white/70 font-mono border border-white/10 backdrop-blur-sm">
                                                        {staff.role}
                                                    </span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-sm font-bold uppercase tracking-wider ${staff.status === 'Active'
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                        }`}>
                                                        {staff.status}
                                                    </span>
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
                                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Department</p>
                                            <div className="flex items-center text-sm font-medium text-gray-200">
                                                <Briefcase size={14} className={`mr-2 ${accentColor}`} />
                                                <span className="truncate">{staff.department}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Position</p>
                                            <div className="flex items-center text-sm font-medium text-gray-200">
                                                <Shield size={14} className={`mr-2 ${accentColor}`} />
                                                <span className="truncate">{staff.position || 'N/A'}</span>
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
                                <th className="px-6 py-4 font-heading">Department</th>
                                <th className="px-6 py-4 font-heading">Gender</th>
                                <th className="px-6 py-4 font-heading">Status</th>
                                <th className="px-6 py-4 font-heading">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((staff) => (
                                <tr key={staff.uid} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center mr-3 text-xs font-bold border border-white/10">
                                            {getInitials(staff.displayName)}
                                        </div>
                                        {staff.displayName}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">{staff.position || staff.role}</div>
                                        <div className="text-xs text-gray-500">{staff.role}</div>
                                    </td>
                                    <td className="px-6 py-4 text-xs">
                                        <div>{staff.email}</div>
                                        <div className="text-gray-500">{staff.phoneNumber}</div>
                                    </td>
                                    <td className="px-6 py-4">{staff.department}</td>
                                    <td className="px-6 py-4">{staff.gender || '-'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${staff.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                            {staff.status || 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleOpenEdit(staff)}
                                            className={`text-blue-400 hover:text-white transition-colors ${staff.role === UserRole.MASTER_ADMIN && user?.role !== UserRole.MASTER_ADMIN ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={staff.role === UserRole.MASTER_ADMIN && user?.role !== UserRole.MASTER_ADMIN}
                                        >
                                            <Edit size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white font-heading">{isEditing ? 'Edit Staff Profile' : 'Add New Staff'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 overflow-y-auto">
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
                                        <option value={UserRole.STAFF}>Staff</option>
                                        <option value={UserRole.MANAGER}>Manager</option>
                                        {(user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.ADMIN) && <option value={UserRole.ADMIN}>Admin</option>}
                                        {user?.role === UserRole.MASTER_ADMIN && <option value={UserRole.MASTER_ADMIN}>Master Admin</option>}
                                    </select>
                                    <div className="text-[10px] text-gray-500 mt-1">* Only Master Admin can assign Admin/Master roles</div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Department</label>
                                    <select className="w-full glass-input rounded-lg px-3 py-2 text-sm" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}>
                                        <option value="Audit">Audit</option>
                                        <option value="Tax">Tax</option>
                                        <option value="Management">Management</option>
                                        <option value="General">General</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase">Job Position</label>
                                    <select
                                        className="w-full glass-input rounded-lg px-3 py-2 text-sm"
                                        value={formData.position}
                                        onChange={e => setFormData({ ...formData, position: e.target.value })}
                                    >
                                        <option value="">Select Position</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Staff">Staff</option>
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
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors text-sm">Cancel</button>
                                <button type="submit" className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center">
                                    <Save size={16} className="mr-2" /> Save Profile
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffPage;
