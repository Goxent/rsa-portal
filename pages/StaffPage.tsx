
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
                    {filteredUsers.map((staff) => (
                        <div key={staff.uid} className="glass-panel p-6 rounded-xl hover:border-brand-500/40 transition-all group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-4">
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center text-xl font-bold text-white border-2 border-white/10 shadow-lg">
                                        {getInitials(staff.displayName)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{staff.displayName}</h3>
                                        <p className="text-brand-400 text-sm">{staff.position || staff.role}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleOpenEdit(staff)} className="text-gray-500 hover:text-white transition-colors">
                                    <Edit size={16} />
                                </button>
                            </div>

                            <div className="space-y-3 pt-2 border-t border-white/5">
                                <div className="flex items-center text-sm text-gray-400">
                                    <Mail size={14} className="mr-2 text-brand-500" /> {staff.email}
                                </div>
                                <div className="flex items-center text-sm text-gray-400">
                                    <Phone size={14} className="mr-2 text-brand-500" /> {staff.phoneNumber || 'N/A'}
                                </div>
                                <div className="flex items-center text-sm text-gray-400">
                                    <Briefcase size={14} className="mr-2 text-brand-500" /> {staff.department}
                                </div>
                                <div className="flex items-center text-sm text-gray-400">
                                    <User size={14} className="mr-2 text-brand-500" /> {staff.gender || 'Not Specified'}
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${staff.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {staff.status || 'Active'}
                                    </span>
                                    <span className="text-[10px] text-gray-500">Joined: {staff.dateOfJoining || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
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
