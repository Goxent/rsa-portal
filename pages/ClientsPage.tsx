import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Search, Filter, FileText, MoreVertical,
    Edit, Trash2, Phone, Mail, MapPin, BadgeCheck, Building2,
    Briefcase, Calendar, X, Save, ChevronDown, CheckCircle2, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Client, UserRole, UserProfile } from '../types';
import { AuthService } from '../services/firebase';
import { toast } from 'react-hot-toast';
import StaffSelect from '../components/StaffSelect';
import { ClientCardSkeleton } from '../components/ui/LoadingSkeleton';

import { INITIAL_CLIENTS } from '../constants/initialClients';

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
    const [filterSigningAuthority, setFilterSigningAuthority] = useState('ALL');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);

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

    const handleSeedClients = async () => {
        if (!confirm(`Are you sure you want to seed ${INITIAL_CLIENTS.length} clients from the preset list? Duplicates will be skipped.`)) return;

        setIsSeeding(true);
        try {
            const result = await AuthService.seedClients(INITIAL_CLIENTS);
            toast.success(`Seeding Complete! Added: ${result.added}, Skipped: ${result.skipped}`);
            loadData();
        } catch (error) {
            console.error("Seeding failed:", error);
            toast.error("Failed to seed clients");
        } finally {
            setIsSeeding(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalCode = formData.code;

        // Auto-generate code if empty
        if (!finalCode) {
            const existingCodes = clients.map(c => c.code).filter(c => c);

            // Try to find a numeric pattern
            const numbers = existingCodes.map(c => parseInt(c.replace(/\D/g, ''))).filter(n => !isNaN(n));
            const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;

            // Format: C-001 or similar if no pattern, but let's try to infer or default
            // If most start with something, use it? For now, default to C-{number}
            finalCode = `C-${String(nextNum).padStart(3, '0')}`;
        }

        if (!formData.name) {
            toast.error('Name is required');
            return;
        }

        setIsSaving(true);
        try {
            // Sanitize data: Remove undefined/null values but KEEP empty strings (to allow clearing fields)
            const cleanData = Object.entries(formData).reduce((acc, [key, value]) => {
                if (value !== undefined && value !== null) {
                    acc[key] = value;
                }
                return acc;
            }, {} as any);

            const clientData: Client = {
                ...cleanData,
                code: finalCode,
                updatedAt: new Date().toISOString()
            };

            if (editingId) {
                await AuthService.updateClient({ ...clientData, id: editingId });
                toast.success('Client updated successfully');
            } else {
                await AuthService.addClient(clientData as Client);
                toast.success('Client created successfully');
            }

            setIsModalOpen(false);
            setEditingId(null);
            setFormData(initialFormState);
            loadData();
        } catch (error: any) {
            console.error('Save error:', error);
            toast.error('Failed to save client: ' + (error.message || 'Unknown error'));
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
        const matchesService = filterService === 'ALL' || c.serviceType === filterService;
        const matchesSignee = filterSigningAuthority === 'ALL' || c.signingAuthority === filterSigningAuthority;
        return matchesSearch && matchesService && matchesSignee;
    });

    const getAuditorName = (id?: string) => {
        if (!id) return 'Unassigned';
        return staffList.find(s => s.uid === id)?.displayName || 'Unknown';
    };

    // Helper to get display name (now fully static, but keeping function for consistency if needed)
    const getSigningAuthorityName = (client: Client) => {
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
                    <div className="flex gap-3">
                        <button
                            onClick={handleSeedClients}
                            disabled={isSeeding}
                            className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 px-4 py-2.5 rounded-xl font-medium flex items-center shadow-lg transition-all"
                        >
                            {isSeeding ? 'Seeding...' : 'Seed Clients'}
                        </button>
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
                    </div>
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

                    <select
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={filterSigningAuthority}
                        onChange={(e) => setFilterSigningAuthority(e.target.value)}
                    >
                        <option value="ALL">All Auditors</option>
                        <option value="R. Sapkota & Associates">R. Sapkota & Associates</option>
                        <option value="TN Acharya & Co.">TN Acharya & Co.</option>
                        <option value="Pankaj Thapa Associates">Pankaj Thapa Associates</option>
                        <option value="NP Sharma & Co.">NP Sharma & Co.</option>
                        <option value="Others">Others</option>
                    </select>
                </div>
            </div>

            {/* Client Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map((client, index) => {
                    // Safe color generation
                    const seedString = client.code || client.name || 'default';
                    const colors = [
                        'from-blue-500/20 to-cyan-500/5',
                        'from-purple-500/20 to-pink-500/5',
                        'from-emerald-500/20 to-teal-500/5',
                        'from-orange-500/20 to-red-500/5',
                        'from-indigo-500/20 to-violet-500/5'
                    ];

                    let colorIndex = 0;
                    if (seedString && seedString.length > 0) {
                        colorIndex = (seedString.charCodeAt(0) + seedString.charCodeAt(seedString.length - 1)) % colors.length;
                    }

                    const bgGradient = colors[colorIndex] || colors[0];
                    const accentColor = bgGradient.split(' ')[0].replace('from-', 'text-').replace('/20', '-400');
                    const borderColor = bgGradient.split(' ')[0].replace('from-', 'border-').replace('/20', '/30');

                    return (
                        <div
                            key={client.id}
                            className={`glass-panel p-0 rounded-2xl overflow-hidden group border border-white/5 hover:border-white/20 transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/10 hover:-translate-y-1`}
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Card Header with Fluid Gradient */}
                            <div className={`p-6 bg-gradient-to-br ${bgGradient} relative overflow-hidden`}>
                                {/* Abstract Shapes */}
                                <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
                                <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-black/10 rounded-full blur-xl"></div>

                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black shadow-lg backdrop-blur-md bg-white/10 text-white border border-white/20`}>
                                            {client.code.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg leading-tight tracking-tight group-hover:text-blue-200 transition-colors">
                                                {client.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 text-white/70 font-mono border border-white/10 backdrop-blur-sm">
                                                    {client.code}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border backdrop-blur-sm font-bold uppercase tracking-wider ${client.status === 'Active'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                    }`}>
                                                    {client.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col gap-1 transform translate-x-2 group-hover:translate-x-0">
                                            <button
                                                onClick={() => handleEdit(client)}
                                                className="p-2 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors backdrop-blur-md"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(client.id)}
                                                className="p-2 hover:bg-rose-500/20 rounded-lg text-white/70 hover:text-rose-400 transition-colors backdrop-blur-md"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-6 space-y-5 bg-navy-900/40 backdrop-blur-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Service</p>
                                        <div className="flex items-center text-sm font-medium text-gray-200">
                                            <Briefcase size={14} className={`mr-2 ${accentColor}`} />
                                            <span className="truncate" title={client.serviceType}>{client.serviceType}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Sector</p>
                                        <div className="flex items-center text-sm font-medium text-gray-200">
                                            <Building2 size={14} className={`mr-2 ${accentColor}`} />
                                            <span className="truncate" title={client.industry}>{client.industry || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Compliance Badges */}
                                <div className="flex gap-2 flex-wrap">
                                    {client.vatReturn && (
                                        <span className="text-[10px] bg-emerald-500/5 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/20 font-bold flex items-center gap-1">
                                            <CheckCircle2 size={10} /> VAT Return
                                        </span>
                                    )}
                                    {client.itrReturn && (
                                        <span className="text-[10px] bg-blue-500/5 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/20 font-bold flex items-center gap-1">
                                            <FileText size={10} /> ITR Filing
                                        </span>
                                    )}
                                    {!client.vatReturn && !client.itrReturn && (
                                        <span className="text-[10px] text-gray-600 italic px-1">No services configured</span>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                                {/* Signing & Auditor Info */}
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 group/item">
                                        <div className="mt-0.5 p-1.5 rounded-full bg-white/5 text-gray-400 group-hover/item:text-white group-hover/item:bg-white/10 transition-colors">
                                            <BadgeCheck size={12} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Signing Authority</p>
                                            <p className="text-xs text-gray-300 font-medium">{getSigningAuthorityName(client)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 group/item">
                                        <div className="mt-0.5 p-1.5 rounded-full bg-white/5 text-gray-400 group-hover/item:text-white group-hover/item:bg-white/10 transition-colors">
                                            <User size={12} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Lead Auditor</p>
                                            <p className="text-xs text-gray-300 font-medium">{getAuditorName(client.auditorId)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Hover Reveal details - Contact, PAN, etc can go here if we want more density, 
                                    but let's keep it clean. Maybe tooltip or expand? 
                                    For now, let's keep PAN if available.
                                */}
                                {client.pan && (
                                    <div className="pt-2">
                                        <div className="bg-black/20 rounded-lg px-3 py-2 flex items-center justify-between border border-white/5">
                                            <span className="text-[10px] text-gray-500 font-mono">PAN</span>
                                            <span className="text-xs text-brand-200 font-mono tracking-wider">{client.pan}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {loading && (
                <ClientCardSkeleton count={6} />
            )}

            {!loading && filteredClients.length === 0 && (
                <div className="text-center py-20">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Building2 size={32} className="text-gray-600" />
                    </div>
                    <p className="text-xl font-bold text-white">No clients found</p>
                    <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
                        Try adjusting your filters or add a new client to the directory.
                    </p>
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
                                        <label className="block text-xs font-medium text-gray-400 mb-1">
                                            Client Name <span className="text-red-400">*</span>
                                        </label>
                                        <input required type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm"
                                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Acme Corp Pvt Ltd" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">
                                            Client Code <span className="text-[10px] text-gray-500">(Auto-generated if empty)</span>
                                        </label>
                                        <input type="text" className="w-full glass-input rounded-lg px-4 py-2.5 text-sm font-mono"
                                            value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. ACME-01 (Optional)" />
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
                                        <div className="grid grid-cols-1 gap-2">
                                            <select
                                                className="w-full glass-input rounded-lg px-4 py-2.5 text-sm appearance-none"
                                                value={['R. Sapkota & Associates', 'TN Acharya & Co.', 'Pankaj Thapa Associates', 'NP Sharma & Co.'].includes(formData.signingAuthority || '') ? formData.signingAuthority : 'Others'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'Others') {
                                                        setFormData({ ...formData, signingAuthority: '', signingAuthorityId: '' });
                                                    } else {
                                                        setFormData({ ...formData, signingAuthority: val, signingAuthorityId: '' });
                                                    }
                                                }}
                                            >
                                                <option value="R. Sapkota & Associates">R. Sapkota & Associates</option>
                                                <option value="TN Acharya & Co.">TN Acharya & Co.</option>
                                                <option value="Pankaj Thapa Associates">Pankaj Thapa Associates</option>
                                                <option value="NP Sharma & Co.">NP Sharma & Co.</option>
                                                <option value="Others">Others (Manual Entry)</option>
                                            </select>

                                            {(!['R. Sapkota & Associates', 'TN Acharya & Co.', 'Pankaj Thapa Associates', 'NP Sharma & Co.'].includes(formData.signingAuthority || '') || formData.signingAuthority === '') && (
                                                <input
                                                    type="text"
                                                    placeholder="Enter Signing Authority Name"
                                                    className="w-full glass-input rounded-lg px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-2"
                                                    value={formData.signingAuthority}
                                                    onChange={e => setFormData({ ...formData, signingAuthority: e.target.value, signingAuthorityId: '' })}
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
                                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2">Internal Focal Person</h3>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Assigned Internal Focal Person</label>
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
