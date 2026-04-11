
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
    const [selectedTab, setSelectedTab] = useState('All');
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
                                u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (u.position || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTab = selectedTab === 'All' || 
                               u.position === selectedTab || 
                               (selectedTab === 'Staffs' && u.position === 'Staff') ||
                               (!u.position && selectedTab === 'Staffs'); // Default empty positions to Staff
            return matchesSearch && matchesTab;
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const filterTabs = ['All', 'Staffs', 'Article Trainee', 'Manager', 'Admin', 'Principal'];

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 bg-transparent">
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 
                        className="text-white" 
                        style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-heading)' }}
                    >
                        Staff Directory
                    </h1>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Manage employee profiles and access permissions
                    </p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="flex items-center transition-all hover:-translate-y-0.5 group btn-primary"
                    style={{ 
                        background: 'var(--accent)', 
                        color: 'white', 
                        padding: '0.625rem 1.5rem', 
                        borderRadius: 'var(--radius-xl)', 
                        fontSize: '0.875rem', 
                        fontWeight: 600,
                        boxShadow: '0 4px 12px var(--accent-glow)'
                    }}
                >
                    <Plus size={18} className="mr-2 group-hover:rotate-90 transition-transform duration-300" /> 
                    Invite Staff Member
                </button>
            </div>

            {/* Position Filters */}
            <div 
                className="flex items-center gap-1 overflow-x-auto p-1 hide-scrollbar"
                style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}
            >
                {filterTabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setSelectedTab(tab)}
                        className="px-5 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap"
                        style={{ 
                            background: selectedTab === tab ? 'var(--bg-secondary)' : 'transparent',
                            color: selectedTab === tab ? 'var(--text-heading)' : 'var(--text-muted)',
                            boxShadow: selectedTab === tab ? 'var(--shadow-card)' : 'none',
                            border: selectedTab === tab ? '1px solid var(--border)' : '1px solid transparent'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Controls */}
            <div 
                className="flex flex-col md:flex-row gap-4 justify-between items-center p-3"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}
            >
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5" size={18} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 outline-none text-sm"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }}
                        placeholder="Search staff by name, email or position..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div 
                    className="flex items-center p-1 border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: 'var(--radius-lg)' }}
                >
                    <button 
                        onClick={() => setViewMode('GRID')} 
                        className="p-1.5 transition-all"
                        style={{ 
                            background: viewMode === 'GRID' ? 'var(--bg-secondary)' : 'transparent',
                            color: viewMode === 'GRID' ? 'var(--accent)' : 'var(--text-muted)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: viewMode === 'GRID' ? 'var(--shadow-card)' : 'none'
                        }}
                    >
                        <Grid size={16} />
                    </button>
                    <button 
                        onClick={() => setViewMode('LIST')} 
                        className="p-1.5 transition-all"
                        style={{ 
                            background: viewMode === 'LIST' ? 'var(--bg-secondary)' : 'transparent',
                            color: viewMode === 'LIST' ? 'var(--accent)' : 'var(--text-muted)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: viewMode === 'LIST' ? 'var(--shadow-card)' : 'none'
                        }}
                    >
                        <List size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'GRID' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredUsers.map((staff, index) => {
                        return (
                            <div
                                key={staff.uid}
                                className="group relative transition-all duration-300 border hover:-translate-y-[2px]"
                                style={{ 
                                    background: 'var(--bg-secondary)', 
                                    borderColor: 'var(--border)', 
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '1.25rem',
                                    boxShadow: 'var(--shadow-card)',
                                    animationDelay: `${index * 30}ms`
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--border-accent)';
                                    e.currentTarget.style.boxShadow = '0 4px 20px var(--accent-glow)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                                }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="w-[52px] h-[52px] flex items-center justify-center font-bold text-[1.125rem] border shadow-sm"
                                            style={{ 
                                                background: 'var(--bg-surface)', 
                                                borderColor: 'var(--border)', 
                                                color: 'var(--accent)',
                                                borderRadius: '99px'
                                            }}
                                        >
                                            {getInitials(staff.displayName)}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                                                {staff.displayName}
                                            </h3>
                                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>
                                                {staff.department || 'General Department'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleOpenEdit(staff)}
                                        className="p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--bg-surface)]"
                                        style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}
                                    >
                                        <Edit size={16} />
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                    <span 
                                        className="text-[10.5px] font-bold px-2 py-0.5 uppercase tracking-wider"
                                        style={{ 
                                            borderRadius: '99px',
                                            background: (staff.role === UserRole.ADMIN || staff.role === UserRole.MASTER_ADMIN) 
                                                ? 'rgba(61,130,201,0.12)' 
                                                : staff.role === UserRole.MANAGER 
                                                    ? 'rgba(201,138,42,0.12)' 
                                                    : 'var(--bg-surface)',
                                            color: (staff.role === UserRole.ADMIN || staff.role === UserRole.MASTER_ADMIN)
                                                ? 'var(--color-info)'
                                                : staff.role === UserRole.MANAGER
                                                    ? 'var(--color-warning)'
                                                    : 'var(--text-muted)'
                                        }}
                                    >
                                        {getRoleLabel(staff.role)}
                                    </span>
                                    <div 
                                        className="flex items-center gap-1.5 px-2 py-0.5 border"
                                        style={{ 
                                            borderRadius: '99px',
                                            background: staff.status === 'Active' ? 'rgba(101,154,43,0.15)' : 'var(--bg-surface)',
                                            color: staff.status === 'Active' ? 'var(--accent)' : 'var(--text-muted)',
                                            borderColor: staff.status === 'Active' ? 'rgba(101,154,43,0.25)' : 'var(--border)'
                                        }}
                                    >
                                        <div 
                                            className="w-1.5 h-1.5 rounded-full" 
                                            style={{ background: staff.status === 'Active' ? 'var(--accent)' : 'var(--text-muted)' }} 
                                        />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                            {staff.status || 'Active'}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-[0.25rem] text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                                        <Mail size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                                        <span className="truncate">{staff.email}</span>
                                    </div>
                                    <div className="flex items-center gap-[0.25rem] text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                                        <Phone size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                                        <span>{staff.phoneNumber || 'Not provided'}</span>
                                    </div>
                                    <div className="flex items-center gap-[0.25rem] text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                                        <Calendar size={12} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                                        <span>Joined: {staff.dateOfJoining || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div 
                    className="overflow-hidden border"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)' }}
                >
                    <div 
                        className="grid items-center px-4 py-3 border-b uppercase tracking-wider font-black"
                        style={{ 
                            background: 'var(--bg-surface)', 
                            borderColor: 'var(--border)', 
                            gridTemplateColumns: '48px 2fr 1.5fr 1.5fr 1fr 80px',
                            fontSize: '10px',
                            color: 'var(--text-muted)'
                        }}
                    >
                        <div className="pl-2">Avatar</div>
                        <div>Full Name</div>
                        <div>Role / Position</div>
                        <div>Department</div>
                        <div>Status</div>
                        <div className="text-right">Action</div>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((staff) => (
                                <div 
                                    key={staff.uid} 
                                    className="grid items-center px-4 hover:bg-[var(--bg-surface)] transition-colors group"
                                    style={{ 
                                        height: '52px', 
                                        gridTemplateColumns: '48px 2fr 1.5fr 1.5fr 1fr 80px',
                                        background: 'var(--bg-secondary)'
                                    }}
                                >
                                    <div className="pl-1">
                                        <div 
                                            className="w-9 h-9 flex items-center justify-center font-bold border shadow-sm"
                                            style={{ 
                                                background: 'var(--bg-surface)', 
                                                borderColor: 'var(--border)', 
                                                color: 'var(--accent)',
                                                borderRadius: '99px',
                                                fontSize: '10px'
                                            }}
                                        >
                                            {getInitials(staff.displayName)}
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)' }}>{staff.displayName}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{staff.email}</span>
                                    </div>
                                    <div className="flex">
                                        <span 
                                            className="text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider"
                                            style={{ 
                                                borderRadius: '99px',
                                                background: (staff.role === UserRole.ADMIN || staff.role === UserRole.MASTER_ADMIN) 
                                                    ? 'rgba(61,130,201,0.12)' 
                                                    : staff.role === UserRole.MANAGER 
                                                        ? 'rgba(201,138,42,0.12)' 
                                                        : 'var(--bg-surface)',
                                                color: (staff.role === UserRole.ADMIN || staff.role === UserRole.MASTER_ADMIN)
                                                    ? 'var(--color-info)'
                                                    : staff.role === UserRole.MANAGER
                                                        ? 'var(--color-warning)'
                                                        : 'var(--text-muted)'
                                            }}
                                        >
                                            {staff.position || getRoleLabel(staff.role)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                        {staff.department || 'General'}
                                    </div>
                                    <div>
                                        <div 
                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 border"
                                            style={{ 
                                                borderRadius: '99px',
                                                background: staff.status === 'Active' ? 'rgba(101,154,43,0.15)' : 'var(--bg-surface)',
                                                color: staff.status === 'Active' ? 'var(--accent)' : 'var(--text-muted)',
                                                borderColor: staff.status === 'Active' ? 'rgba(101,154,43,0.25)' : 'var(--border)'
                                            }}
                                        >
                                            <div 
                                                className="w-1 h-1 rounded-full" 
                                                style={{ background: staff.status === 'Active' ? 'var(--accent)' : 'var(--text-muted)' }} 
                                            />
                                            <span className="text-[9px] font-bold uppercase">
                                                {staff.status || 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <button
                                            onClick={() => handleOpenEdit(staff)}
                                            className="p-2 transition-colors opacity-0 group-hover:opacity-100"
                                            style={{ color: 'var(--text-muted)' }}
                                            disabled={staff.role === UserRole.MASTER_ADMIN && user?.role !== UserRole.MASTER_ADMIN}
                                        >
                                            <Edit size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 bg-transparent">
                                <Search size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                                    No staff members found
                                </h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    Try adjusting your search or filters to find what you're looking for.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {filteredUsers.length === 0 && viewMode === 'GRID' && (
                <div className="flex flex-col items-center justify-center py-32">
                    <Search size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                        No results match your criteria
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Expand your search or try a different filter category.
                    </p>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ 
                        background: 'var(--modal-backdrop, rgba(0,0,0,0.6))',
                        backdropFilter: 'blur(4px)'
                    }}
                >
                    <div 
                        className="w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border animate-in slide-in-from-bottom-2 duration-300"
                        style={{ 
                            background: 'var(--bg-secondary)', 
                            borderColor: 'var(--border-mid)', 
                            borderRadius: 'var(--radius-xl)',
                            boxShadow: 'var(--shadow-modal)'
                        }}
                    >
                        <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
                            <h3 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                                {isEditing ? 'Edit Staff Profile' : 'Send Workspace Invitation'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }} className="p-2 hover:bg-[var(--bg-surface)] transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 overflow-y-auto">
                            {successMessage && (
                                <div className="mb-4 bg-brand-500/20 text-brand-200 px-4 py-3 rounded-lg flex items-center text-sm border border-brand-500/30 animate-in fade-in duration-300">
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
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Full Name *</label>
                                    <input required className="w-full px-3 py-2 text-sm border outline-none transition-all" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }} value={formData.displayName} onChange={e => setFormData({ ...formData, displayName: e.target.value })} />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Official Email *</label>
                                    <input type="email" required disabled={isEditing} className="w-full px-3 py-2 text-sm border outline-none transition-all disabled:opacity-50" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="staff@rsa.com" />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Role / Permission</label>
                                    <select className="w-full px-3 py-2 text-sm border outline-none transition-all" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }} value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}>
                                        <option value={UserRole.STAFF}>User</option>
                                        {(user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.ADMIN) && <option value={UserRole.ADMIN}>Admin</option>}
                                        {user?.role === UserRole.MASTER_ADMIN && <option value={UserRole.MASTER_ADMIN}>Master Admin</option>}
                                    </select>
                                    <div className="text-[10px] italic mt-1" style={{ color: 'var(--text-muted)' }}>* Only Master Admin can assign Admin roles</div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Job Position</label>
                                    <select
                                        className="w-full px-3 py-2 text-sm border outline-none transition-all"
                                        style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }}
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
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Gender</label>
                                    <select
                                        className="w-full px-3 py-2 text-sm border outline-none transition-all"
                                        style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }}
                                        value={formData.gender}
                                        onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Phone Number</label>
                                    <input className="w-full px-3 py-2 text-sm border outline-none transition-all" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }} value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Date of Joining</label>
                                    <input type="date" className="w-full px-3 py-2 text-sm border outline-none transition-all" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }} value={formData.dateOfJoining} onChange={e => setFormData({ ...formData, dateOfJoining: e.target.value })} />
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Status</label>
                                    <select className="w-full px-3 py-2 text-sm border outline-none transition-all" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', display: 'block' }}>Address</label>
                                    <input className="w-full px-3 py-2 text-sm border outline-none transition-all" style={{ background: 'var(--bg-main)', borderColor: 'var(--border)', color: 'var(--text-body)', borderRadius: 'var(--radius-md)' }} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full residential address" />
                                </div>
                            </div>

                            <div className="pt-6 mt-4 border-t flex justify-end space-x-3" style={{ borderColor: 'var(--border)' }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving} 
                                    className="px-6 py-2 text-xs font-bold uppercase tracking-widest shadow-lg flex items-center min-w-[150px] justify-center transition-all"
                                    style={{ 
                                        background: 'var(--accent)', 
                                        color: 'white', 
                                        borderRadius: 'var(--radius-xl)',
                                        boxShadow: '0 4px 12px var(--accent-glow)'
                                    }}
                                >
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
