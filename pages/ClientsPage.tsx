import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Search, Building2, MapPin, Phone, Mail,
    Briefcase, FileText, Globe, MoreVertical, CreditCard,
    LayoutGrid, List as ListIcon, Loader2, AlertTriangle,
    CheckCircle2, XCircle, Trash2, Edit
} from 'lucide-react';
import { Client, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/firebase';
import { toast } from 'react-hot-toast';

const ClientsPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form Data
    const initialFormState: Partial<Client> = {
        name: '',
        code: '',
        serviceType: 'Audit',
        status: 'Active',
        email: '',
        phone: '',
        address: '',
        city: 'Kathmandu',
        panNumber: '',
        contactPersonName: '',
        contactPersonNumber: '',
        industry: 'Trading',
        category: 'B',
        riskProfile: 'LOW',
        auditorSignatory: 'R. Sapkota & Associates',
        billingAmount: 0,
        isPaymentReceived: false,
        fiscalYear: '2080-81',
        notes: ''
    };
    const [formData, setFormData] = useState<Partial<Client>>(initialFormState);

    useEffect(() => {
        if (user) {
            const allowedRoles = [UserRole.ADMIN, UserRole.MASTER_ADMIN];
            if (!allowedRoles.includes(user.role)) {
                // navigate('/dashboard'); // Optional: redirect if restricted
            }
            fetchClients();
        }
    }, [user]);

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const data = await AuthService.getAllClients();
            setClients(data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load clients");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setIsEditing(false);
        setSelectedClient(null);
        setFormData(initialFormState);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (client: Client) => {
        setIsEditing(true);
        setSelectedClient(client);
        setFormData({ ...client });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return toast.error("Client Name is required");

        setIsSubmitting(true);
        try {
            if (isEditing && selectedClient) {
                // Ensure we have a valid ID
                if (!selectedClient.id) {
                    toast.error("Invalid client ID");
                    return;
                }
                await AuthService.updateClient({ ...selectedClient, ...formData } as Client);
                toast.success("Client updated successfully");
            } else {
                await AuthService.addClient({
                    ...formData,
                    id: '', // will be set by firebase
                    code: formData.code || `CL-${Math.floor(Math.random() * 10000)}`,
                    folderLink: '' // Required field
                } as Client);
                toast.success("Client added successfully");
            }
            fetchClients();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error("Client submit error:", error);
            toast.error(error.message || "Operation failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedClient) return;
        if (!window.confirm(`Delete ${selectedClient.name}? This cannot be undone.`)) return;

        try {
            await AuthService.deleteClient(selectedClient.id);
            toast.success("Client deleted");
            fetchClients();
            setIsModalOpen(false);
        } catch (error) {
            toast.error("Delete failed");
        }
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.panNumber?.includes(searchTerm)
    );

    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

    // Risk Badge Component
    const RiskBadge = ({ level }: { level?: string }) => {
        const colors = {
            'HIGH': 'bg-red-500/10 text-red-400 border-red-500/20',
            'MEDIUM': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
            'LOW': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        };
        const colorClass = colors[level as keyof typeof colors] || colors['LOW'];
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${colorClass}`}>
                {level || 'LOW'} Risk
            </span>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">Client Directory</h1>
                    <p className="text-sm text-gray-400">Manage client profiles, billing, and audit status</p>
                </div>
                <button
                    onClick={handleOpenAdd}
                    className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center shadow-lg shadow-brand-900/40 transition-all hover:scale-105 active:scale-95 border border-brand-500/30"
                >
                    <Plus size={18} className="mr-2" /> Add Client
                </button>
            </div>

            {/* Controls */}
            <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center sticky top-0 bg-navy-900/90 backdrop-blur-md z-10 border-b border-white/5">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, code, or PAN..."
                        className="w-full bg-black/40 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 border border-white/10 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
                    <button onClick={() => setViewMode('GRID')} className={`p-2 rounded-md ${viewMode === 'GRID' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><LayoutGrid size={18} /></button>
                    <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-md ${viewMode === 'LIST' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}><ListIcon size={18} /></button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 size={40} className="animate-spin text-brand-500" /></div>
            ) : filteredClients.length === 0 ? (
                <div className="text-center py-20 opacity-50">
                    <Building2 size={64} className="mx-auto mb-4 text-gray-600" />
                    <p className="text-xl font-bold text-gray-400">No Clients Found</p>
                </div>
            ) : viewMode === 'GRID' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredClients.map(client => (
                        <div key={client.id} onClick={() => handleOpenEdit(client)} className="glass-panel p-6 rounded-xl hover:border-brand-500/30 transition-all cursor-pointer group relative overflow-hidden hover:shadow-2xl">
                            <div className="absolute top-0 right-0 p-4 opacity-50"><RiskBadge level={client.riskProfile} /></div>

                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-navy-700 to-navy-600 flex items-center justify-center text-lg font-bold text-white border border-white/10 shadow-inner">
                                    {getInitials(client.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white truncate pr-16">{client.name}</h3>
                                    <p className="text-xs text-brand-400 font-mono">{client.code} • {client.serviceType}</p>
                                </div>
                            </div>

                            <div className="space-y-3 border-t border-white/5 pt-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 flex items-center"><MapPin size={12} className="mr-2" /> City</span>
                                    <span className="text-gray-300">{client.city || client.address || 'N/A'}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 flex items-center"><Phone size={12} className="mr-2" /> Contact</span>
                                    <span className="text-gray-300">{client.contactPersonName ? client.contactPersonName.split(' ')[0] : 'N/A'}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 flex items-center"><CreditCard size={12} className="mr-2" /> Billing</span>
                                    <span className={`font-mono font-bold ${client.isPaymentReceived ? 'text-emerald-400' : 'text-orange-400'}`}>
                                        Rs. {client.billingAmount?.toLocaleString() || 0}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                                <span className="flex items-center">{client.auditorSignatory || 'RSA'}</span>
                                <span className={client.isPaymentReceived ? 'text-emerald-500 flex items-center' : 'text-orange-500 flex items-center'}>
                                    {client.isPaymentReceived ? <CheckCircle2 size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                                    {client.isPaymentReceived ? 'Paid' : 'Pending'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-panel rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-white/5 text-gray-400 font-bold border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4">Client Name</th>
                                <th className="px-6 py-4">Service</th>
                                <th className="px-6 py-4">Contact Person</th>
                                <th className="px-6 py-4">Billing</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredClients.map(client => (
                                <tr key={client.id} onClick={() => handleOpenEdit(client)} className="hover:bg-white/5 cursor-pointer transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white">{client.name}</div>
                                        <div className="text-xs text-gray-500 font-mono">{client.code}</div>
                                    </td>
                                    <td className="px-6 py-4">{client.serviceType}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">{client.contactPersonName || '-'}</div>
                                        <div className="text-xs text-gray-500">{client.contactPersonNumber}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-white">Rs. {client.billingAmount?.toLocaleString()}</div>
                                        <div className="text-xs text-gray-500">{client.fiscalYear}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <RiskBadge level={client.riskProfile} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-gray-400 hover:text-white"><Edit size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Combined Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                    <div className="glass-modal rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center">
                                {isEditing ? 'Edit Client Profile' : 'New Client Registration'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><XCircle size={24} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Section 1: Basic Details */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-b border-white/10 pb-2 mb-4">Basic Information</h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Client Name *</label>
                                            <input required className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Company Name" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Client Code</label>
                                            <input className="w-full glass-input p-2.5 rounded-lg text-sm font-mono" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="Auto-generate if empty" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">PAN Number</label>
                                            <input className="w-full glass-input p-2.5 rounded-lg text-sm font-mono" value={formData.panNumber} onChange={e => setFormData({ ...formData, panNumber: e.target.value })} placeholder="987654321" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Industry</label>
                                            <select className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value as any })}>
                                                <option value="Trading">Trading</option>
                                                <option value="Manufacturing">Manufacturing</option>
                                                <option value="Hydropower">Hydropower</option>
                                                <option value="Service">Service</option>
                                                <option value="Consulting">Consulting</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Service Type</label>
                                            <select className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.serviceType} onChange={e => setFormData({ ...formData, serviceType: e.target.value as any })}>
                                                <option value="Audit">Audit</option>
                                                <option value="Tax">Tax</option>
                                                <option value="Consulting">Consulting</option>
                                                <option value="Accounting">Accounting</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Office Address</label>
                                        <input className="w-full glass-input p-2.5 rounded-lg text-sm mb-2" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Street Address" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <input className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="City" />
                                            <select className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.riskProfile} onChange={e => setFormData({ ...formData, riskProfile: e.target.value as any })}>
                                                <option value="LOW">Low Risk</option>
                                                <option value="MEDIUM">Medium Risk</option>
                                                <option value="HIGH">High Risk</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Contact & Billing */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest border-b border-white/10 pb-2 mb-4">Contact & Billing</h3>

                                    <div className="bg-white/5 p-4 rounded-xl space-y-3">
                                        <label className="text-xs font-bold text-gray-400 uppercase">Contact Person</label>
                                        <input className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.contactPersonName} onChange={e => setFormData({ ...formData, contactPersonName: e.target.value })} placeholder="Name" />
                                        <div className="grid grid-cols-2 gap-3">
                                            <input className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.contactPersonNumber} onChange={e => setFormData({ ...formData, contactPersonNumber: e.target.value })} placeholder="Mobile Number" />
                                            <input className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Email (Optional)" />
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-4 rounded-xl space-y-3">
                                        <label className="text-xs font-bold text-gray-400 uppercase">Audit & Fees</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <label className="block text-[10px] text-gray-500 mb-1">Auditor / Signatory</label>
                                                <select className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.auditorSignatory} onChange={e => setFormData({ ...formData, auditorSignatory: e.target.value })}>
                                                    <option value="R. Sapkota & Associates">R. Sapkota (Main)</option>
                                                    <option value="Pankaj Thapa Associates">Pankaj Thapa</option>
                                                    <option value="NP Sharma & Co.">NP Sharma</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">Fee Amount</label>
                                                <input type="number" className="w-full glass-input p-2.5 rounded-lg text-sm font-mono" value={formData.billingAmount} onChange={e => setFormData({ ...formData, billingAmount: Number(e.target.value) })} placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">Fiscal Year</label>
                                                <input className="w-full glass-input p-2.5 rounded-lg text-sm" value={formData.fiscalYear} onChange={e => setFormData({ ...formData, fiscalYear: e.target.value })} placeholder="2080-81" />
                                            </div>
                                        </div>
                                        <div className="pt-2 flex items-center">
                                            <input type="checkbox" id="paid" className="w-4 h-4 rounded bg-white/10 border-white/20 text-brand-600 focus:ring-brand-500" checked={formData.isPaymentReceived} onChange={e => setFormData({ ...formData, isPaymentReceived: e.target.checked })} />
                                            <label htmlFor="paid" className="ml-2 text-sm text-gray-300">Payment Received</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>

                        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-between items-center">
                            {isEditing && (
                                <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center">
                                    <Trash2 size={16} className="mr-2" /> Delete
                                </button>
                            )}
                            <div className="flex gap-3 ml-auto">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                                <button onClick={handleSubmit} disabled={isSubmitting} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center">
                                    {isSubmitting && <Loader2 size={16} className="animate-spin mr-2" />}
                                    {isEditing ? 'Update Client' : 'Register Client'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientsPage;
