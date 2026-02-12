import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Search, Filter, FileText, MoreVertical,
    Edit, Trash2, Phone, Mail, MapPin, BadgeCheck, Building2,
    Briefcase, Calendar, X, Save, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Client, UserRole, UserProfile } from '../types';
import { AuthService } from '../services/firebase';
import { toast } from 'react-hot-toast';
import StaffSelect from '../components/StaffSelect';

const ClientsPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [staffList, setStaffList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterService, setFilterService] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const initialFormState: Partial<Client> = {
        name: '',
        code: '',
        serviceType: 'Statutory Audit',
        industry: 'Others',
        status: 'Active',
        email: '',
        phone: '',
        address: '',
        pan: '',
        contactPerson: '',
        auditorId: '',
        signingAuthorityId: '',
        signingAuthority: 'R. Sapkota & Associates' // Default
    };
    const [formData, setFormData] = useState<Partial<Client>>(initialFormState);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedClients, fetchedStaff] = await Promise.all([
                AuthService.getAllClients(),
                AuthService.getAllUsers()
            ]);
            setClients(fetchedClients);
            setStaffList(fetchedStaff);
        } catch (error) {
            console.error('Failed to load data:', error);
            toast.error('Failed to load clients');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.code) {
            toast.error('Name and Code are required');
            return;
        }

        setIsSaving(true);
        try {
            // Sanitize data: Remove undefined/null values
            const cleanData = Object.entries(formData).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    acc[key] = value;
                }
                return acc;
            }, {} as any);

            const clientData: Client = {
                ...cleanData,
                updatedAt: new Date().toISOString()
            };

            if (editingId) {
                await AuthService.updateClient({ ...clientData, id: editingId });
                toast.success('Client updated successfully');
            } else {
                await AuthService.addClient({
                    ...clientData,
                    createdAt: new Date().toISOString(),
                    id: crypto.randomUUID()
                });
                toast.success('Client created successfully');
            }

            setIsModalOpen(false);
            setEditingId(null);
            setFormData(initialFormState);
            loadData();
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save client');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (client: Client) => {
        setFormData(client);
        setEditingId(client.id);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this client?')) return;
        try {
            await AuthService.deleteClient(id);
            toast.success('Client deleted');
            loadData();
        } catch (error) {
            toast.error('Failed to delete');
        }
    };

    // Filtering
    const filteredClients = clients.filter(c => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.pan?.includes(searchTerm);
        const matchesFilter = filterService === 'ALL' || c.serviceType === filterService;
        return matchesSearch && matchesFilter;
    });

    const getAuditorName = (id?: string) => {
        if (!id) return 'Unassigned';
        return staffList.find(s => s.uid === id)?.displayName || 'Unknown';
    };

    const getSigningAuthorityName = (client: Client) => {
        if (client.signingAuthorityId) {
            return staffList.find(s => s.uid === client.signingAuthorityId)?.displayName || client.signingAuthority;
        }
        return client.signingAuthority || 'Not Specified';
    };

    const signingAuthorities = staffList.filter(s =>
        [UserRole.MASTER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(s.role)
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center">
                        <Building2 className="mr-3 text-blue-400" /> Client Directory
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Manage audit clients, tax filings, and contact details</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setFormData(initialFormState);
                            setIsModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium flex items-center shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
                    >
                        <Plus size={18} className="mr-2" /> Add Client
                    </button>
                )}
            </div>

            {/* Toolbar */}
            <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search clients by name, code, or PAN..."
                        className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <select
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={filterService}
                        onChange={(e) => setFilterService(e.target.value)}
                    >
                        <option value="ALL">All Services</option>
                        <option value="Statutory Audit">Statutory Audit</option>
                        <option value="Tax Filing">Tax Filing</option>
                        <option value="Compliance Audit">Compliance Audit</option>
                        <option value="Internal Audit">Internal Audit</option>
                        <option value="Advisory Services">Advisory Services</option>
                        <option value="Bookkeeping">Bookkeeping</option>
                    </select>
                </div>
            </div>

            {/* Client Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map(client => (
                    <div key={client.id} className="glass-panel p-0 rounded-xl overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
                        {/* Card Header */}
                        <div className="p-5 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent relative">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shadow-inner ${client.status === 'Active' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {client.code.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg leading-tight">{client.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300 font-mono">{client.code}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${client.status === 'Active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                }`}>{client.status}</span>
                                        </div>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button onClick={() => handleEdit(client)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-400"><Edit size={16} /></button>
                                        <button onClick={() => handleDelete(client.id)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Service Type</p>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <Briefcase size={14} className="mr-2 text-purple-400" /> {client.serviceType}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-gray-500 uppercase font-semibold">Client Type</p>
                                    <div className="flex items-center text-sm text-gray-300">
                                        <Building2 size={14} className="mr-2 text-orange-400" /> {client.industry || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* Compliance Badges */}
                            <div className="flex gap-2 flex-wrap">
                                {client.vatReturn && (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20 font-bold">VAT Registered</span>
                                )}
                                {client.itrReturn && (
                                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20 font-bold">ITR Filer</span>
                                )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/5">
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Signing Authority</p>
                                <div className="flex items-center text-sm text-gray-300">
                                    <BadgeCheck size={14} className="mr-2 text-indigo-400" />
                                    {getSigningAuthorityName(client)}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5 space-y-3">
                                <div className="flex items-center text-sm text-gray-400">
                                    <BadgeCheck size={16} className="mr-3 text-blue-500" />
                                    <span className="flex-1">Auditor:</span>
                                    <span className="text-white font-medium">{getAuditorName(client.auditorId)}</span>
                                </div>
                                {client.pan && (
                                    <div className="flex items-center text-sm text-gray-400">
                                        <FileText size={16} className="mr-3 text-gray-500" />
                                        <span className="flex-1">PAN No:</span>
                                        <span className="text-white font-mono">{client.pan}</span>
                                    </div>
                                )}
                                {client.contactPerson && (
                                    <div className="flex items-center text-sm text-gray-400">
                                        <Users size={16} className="mr-3 text-gray-500" />
                                        <span className="flex-1 truncate">{client.contactPerson}</span>
                                        <span className="text-white">{client.phone}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {loading && (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}

            {!loading && filteredClients.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <Building2 size={48} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-xl font-medium text-gray-400">No clients found</p>
                    <p className="text-sm text-gray-500">Try adjusting your filters or add a new client.</p>
                </div>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/10 shadow-2xl flex flex-col">
                        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-white/5 sticky top-0 backdrop-blur-md z-10">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                {editingId ? <Edit className="mr-2 text-blue-400" /> : <Plus className="mr-2 text-blue-400" />}
                                {editingId ? 'Edit Client' : 'New Client Profile'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">Basic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Client Name *</label>
                                        <input required type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Acme Corp Pvt Ltd" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Client Code *</label>
                                        <input required type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm font-mono"
                                            value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. ACME-01" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Assignment Type</label>
                                        <div className="relative">
                                            <select className="w-full glass-input rounded-lg px-4 py-2.5 text-sm appearance-none"
                                                value={formData.serviceType} onChange={e => setFormData({ ...formData, serviceType: e.target.value as any })}>
                                                <option value="Statutory Audit">Statutory Audit</option>
                                                <option value="Tax Filing">Tax Filing</option>
                                                <option value="Compliance Audit">Compliance Audit</option>
                                                <option value="Internal Audit">Internal Audit</option>
                                                <option value="Advisory Services">Advisory Services</option>
                                                <option value="Bookkeeping">Bookkeeping</option>
                                                <option value="VAT Filing">VAT Filing</option>
                                                <option value="ITR Filing">ITR Filing</option>
                                                <option value="Other">Other</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Client Type</label>
                                        <div className="relative">
                                            <select className="w-full glass-input rounded-lg px-4 py-2.5 text-sm appearance-none"
                                                value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value as any })}>
                                                <option value="Airlines">Airlines</option>
                                                <option value="Consulting">Consulting</option>
                                                <option value="Co-operatives">Co-operatives</option>
                                                <option value="Courier">Courier</option>
                                                <option value="Education">Education</option>
                                                <option value="Hotel & Restaurant">Hotel & Restaurant</option>
                                                <option value="Hydropower">Hydropower</option>
                                                <option value="Investment">Investment</option>
                                                <option value="IT Consulting">IT Consulting</option>
                                                <option value="Joint Venture">Joint Venture</option>
                                                <option value="Manufacturing">Manufacturing</option>
                                                <option value="NGO/INGO">NGO/INGO</option>
                                                <option value="NPO">NPO</option>
                                                <option value="Securities Broker">Securities Broker</option>
                                                <option value="Trading">Trading</option>
                                                <option value="Others">Others</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Signing Authority</label>
                                        <div className="space-y-3">
                                            {/* Toggle between Staff Select and Manual Text */}
                                            <div className="flex items-center space-x-4 mb-2">
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={!!formData.signingAuthorityId}
                                                        onChange={() => setFormData({ ...formData, signingAuthorityId: user?.uid, signingAuthority: user?.displayName })}
                                                        className="accent-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-300">Select Staff</span>
                                                </label>
                                                <label className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        checked={!formData.signingAuthorityId}
                                                        onChange={() => setFormData({ ...formData, signingAuthorityId: '', signingAuthority: '' })}
                                                        className="accent-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-300">Manual Entry</span>
                                                </label>
                                            </div>

                                            {formData.signingAuthorityId !== undefined && formData.signingAuthorityId !== '' ? (
                                                <StaffSelect
                                                    users={signingAuthorities}
                                                    value={formData.signingAuthorityId}
                                                    onChange={(val) => {
                                                        const selected = signingAuthorities.find(s => s.uid === val);
                                                        setFormData({
                                                            ...formData,
                                                            signingAuthorityId: val as string,
                                                            signingAuthority: selected?.displayName
                                                        });
                                                    }}
                                                    placeholder="Select Signing Partner..."
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    placeholder="Enter Signing Authority Name (e.g. Firm Name)"
                                                    className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                                    value={formData.signingAuthority}
                                                    onChange={e => setFormData({ ...formData, signingAuthority: e.target.value })}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contact & Tax Info */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">Contact & Tax Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">PAN Number</label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.pan} onChange={e => setFormData({ ...formData, pan: e.target.value })} placeholder="9-digit PAN" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Contact Person</label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Phone Number</label>
                                        <input type="tel" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
                                        <input type="email" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Office Address</label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* Assignment */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">Assignment</h3>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Assigned Internal Auditor</label>
                                    <StaffSelect
                                        users={staffList}
                                        value={formData.auditorId}
                                        onChange={(val) => setFormData({ ...formData, auditorId: val as string })}
                                        placeholder="Select Lead Auditor..."
                                    />
                                </div>
                                <div className="mt-4">
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="status" checked={formData.status === 'Active'} onChange={() => setFormData({ ...formData, status: 'Active' })} className="accent-blue-500" />
                                            <span className="text-sm text-gray-300">Active</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="status" checked={formData.status === 'Inactive'} onChange={() => setFormData({ ...formData, status: 'Inactive' })} className="accent-red-500" />
                                            <span className="text-sm text-gray-300">Inactive</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Compliance Settings */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">Compliance Services</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex items-center space-x-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.vatReturn || false}
                                            onChange={(e) => setFormData({ ...formData, vatReturn: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-gray-200">VAT Returns</span>
                                            <span className="block text-xs text-gray-500">Auto-reminders on 25th</span>
                                        </div>
                                    </label>

                                    <label className="flex items-center space-x-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.itrReturn || false}
                                            onChange={(e) => setFormData({ ...formData, itrReturn: e.target.checked })}
                                            className="w-5 h-5 rounded border-gray-500 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                        />
                                        <div>
                                            <span className="block text-sm font-bold text-gray-200">Income Tax (ITR)</span>
                                            <span className="block text-xs text-gray-500">Enable ITR Filing</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 gap-3 sticky bottom-0 bg-[#080b14]/90 p-4 border-t border-white/10 -mx-6 -mb-6 backdrop-blur">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 transition-colors text-sm font-medium">Cancel</button>
                                <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center">
                                    {isSaving ? <span className="animate-spin mr-2">⏳</span> : <Save size={18} className="mr-2" />}
                                    {editingId ? 'Update Client' : 'Create Client'}
                                </button>
                            </div>
                        </form >
                    </div >
                </div >
            )}
        </div >
    );
};

export default ClientsPage;
