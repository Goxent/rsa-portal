import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft, Building2, Briefcase, BadgeCheck, Phone, Mail, MapPin,
    Calendar as CalIcon, FileText, CheckCircle2,
    Clock, User, Plus, ArrowRight, Trash2, ExternalLink
} from 'lucide-react';
import { Client, Task, UserProfile } from '../types';
import { AuthService, auth, getAttendanceByClientId } from '../services/firebase';
import { PageLoader } from '../components/ui/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import { FileUploader } from '../components/common/FileUploader';
import { StorageService } from '../services/storage';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTasks } from '../hooks/useTasks';
import { clientKeys } from '../hooks/useClients';
import { userKeys } from '../hooks/useStaff';
import NepaliDate from 'nepali-date-converter';

type Tab = 'OVERVIEW' | 'TASKS' | 'DOCUMENTS' | 'WORK_LOGS';

const ClientDetailPage: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
    const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [newDocTitle, setNewDocTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);




    // Fetch Client Data
    const { data: clients = [], isLoading: clientsLoading } = useQuery({
        queryKey: clientKeys.all,
        queryFn: AuthService.getAllClients
    });

    const { data: staffList = [], isLoading: staffLoading } = useQuery({
        queryKey: userKeys.all,
        queryFn: AuthService.getAllStaff
    });

    // Fetch Tasks
    const { data: allTasks = [], isLoading: tasksLoading } = useTasks();



    const client = clients.find(c => c.id === clientId);
    const isLoading = clientsLoading || staffLoading || tasksLoading;

    const clientTasks = useMemo(() => {
        if (!client) return [];
        return allTasks.filter(t => t.clientIds?.includes(client.id));
    }, [allTasks, client]);



    // Fetch attendance/work logs linked to this client
    const { data: clientWorkLogs = [] } = useQuery({
        queryKey: ['attendance', 'client', clientId],
        queryFn: () => getAttendanceByClientId(clientId!),
        enabled: !!clientId
    });



    const overdueTasks = useMemo(() => clientTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED'), [clientTasks]);





    const handleAddDocument = async (docData: { title: string, url: string, category: any, id?: string }) => {

        if (!client) return;
        setIsSaving(true);
        try {
            const newDoc = {
                id: docData.id || `doc_${Date.now()}`,
                title: docData.title,
                url: docData.url,
                category: docData.category,
                uploadedAt: new Date().toISOString(),
                uploadedBy: auth.currentUser?.uid || 'system'
            };

            const updatedClient = {
                ...client,
                documents: [...(client.documents || []), newDoc]
            };

            await AuthService.updateClient(updatedClient);
            setIsAddDocModalOpen(false);
            setNewDocTitle('');
            toast.success('Document added successfully');
        } catch (error) {
            toast.error('Failed to add document');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDocument = async (docId: string) => {
        if (!client) return;
        try {
            const updatedClient = {
                ...client,
                documents: (client.documents || []).filter(d => d.id !== docId)
            };
            await AuthService.updateClient(updatedClient);
            toast.success('Document removed');
        } catch (error) {
            toast.error('Failed to remove document');
        }
    };

    if (isLoading) return <PageLoader />;

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-full pt-20">
                <Building2 size={64} className="text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Client Not Found</h2>
                <p className="text-gray-400 mb-6">The client you are looking for does not exist or has been removed.</p>
                <button
                    onClick={() => navigate('/clients')}
                    className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all"
                >
                    Back to Clients
                </button>
            </div>
        );
    }

    const focalPerson = staffList.find(s => s.uid === client.auditorId);

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
            {/* Back Button */}
            <button
                onClick={() => navigate('/clients')}
                className="flex items-center text-sm font-bold text-gray-400 hover:text-white transition-colors group"
            >
                <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Directory
            </button>

            {/* Client Header */}
            <div className="glass-panel p-8 rounded-2xl relative overflow-hidden bg-gradient-to-br from-navy-900/60 to-black/40">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar / Code Card */}
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-3xl font-black text-amber-400 shadow-xl shadow-blue-900/20 shrink-0">
                        {client.code?.substring(0, 2).toUpperCase() || 'CL'}
                    </div>

                    <div className="flex-1 space-y-4">
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-3xl font-black text-white">{client.name}</h1>
                                <span className="px-2.5 py-1 rounded bg-black/40 border border-white/10 text-xs font-mono text-gray-400">
                                    {client.code}
                                </span>
                                <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border ${client.status === 'Active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    }`}>
                                    {client.status}
                                </span>
                            </div>
                            <div className="flex gap-4 mt-2 text-sm font-medium text-gray-400">
                                {client.pan && (
                                    <span className="flex items-center"><BadgeCheck size={14} className="mr-1.5 text-brand-400" /> PAN: {client.pan}</span>
                                )}
                                <span className="flex items-center"><Briefcase size={14} className="mr-1.5 text-amber-400" /> {client.serviceType}</span>
                                <span className="flex items-center"><Building2 size={14} className="mr-1.5 text-purple-400" /> {client.industry || 'General Sector'}</span>
                            </div>
                        </div>

                        {/* Quick Stats / Info Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Lead Auditor / Focal</p>
                                <div className="flex items-center text-sm text-gray-200 font-medium">
                                    <User size={14} className="mr-2 text-amber-400" />
                                    {focalPerson?.displayName || 'Unassigned'}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Firm Authority</p>
                                <div className="flex items-center text-sm text-gray-200 font-medium truncate" title={client.signingAuthority}>
                                    <BadgeCheck size={14} className="mr-2 text-amber-400" />
                                    {client.signingAuthority || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Contact</p>
                                <div className="flex flex-col gap-1 text-sm text-gray-200 font-medium">
                                    {client.phone && <span className="flex items-center"><Phone size={12} className="mr-2 text-emerald-400" /> {client.phone}</span>}
                                    {client.email && <span className="flex items-center"><Mail size={12} className="mr-2 text-amber-400" /> <span className="truncate">{client.email}</span></span>}
                                    {!client.phone && !client.email && <span className="text-gray-500 italic">No contact info</span>}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Location</p>
                                <div className="flex items-center text-sm text-gray-200 font-medium">
                                    <MapPin size={14} className="mr-2 text-rose-400" />
                                    <span className="truncate">{client.address || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Nepal Statutory Info Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">VAT Number</p>
                                <div className="text-sm text-gray-200 font-medium">
                                    {client.vatNumber || 'Not Registered'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs & Content */}
            <div className="space-y-6">
                <div className="flex gap-1 overflow-x-auto pb-2 border-b border-white/10 hide-scrollbar">
                    {(['OVERVIEW', 'TASKS', 'DOCUMENTS', 'WORK_LOGS'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                                activeTab === tab
                                    ? 'bg-white/10 text-white border-b-2 border-brand-500'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab === 'OVERVIEW' && <Building2 size={15} />}
                            {tab === 'TASKS' && <CheckCircle2 size={15} />}

                            {tab === 'DOCUMENTS' && <FileText size={15} />}
                            {tab === 'WORK_LOGS' && <Clock size={15} />}

                            {tab === 'TASKS' ? `Tasks (${clientTasks.length})` :
                             tab === 'WORK_LOGS' ? `Work Logs (${clientWorkLogs.length})` :
                             tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'OVERVIEW' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Engagement Info */}
                                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Briefcase size={14} className="text-amber-400" /> Engagement Info</h4>
                                    <div className="space-y-3 text-sm">
                                        <div><span className="text-gray-500 text-xs">Audit Period:</span><p className="text-white font-medium">{client.auditPeriod || 'Not Set'}</p></div>
                                        <div><span className="text-gray-500 text-xs">Start / End:</span><p className="text-white font-medium">{client.auditStartDate ? new Date(client.auditStartDate).toLocaleDateString() : '—'} → {client.auditEndDate ? new Date(client.auditEndDate).toLocaleDateString() : '—'}</p></div>
                                        <div><span className="text-gray-500 text-xs">Signing Authority:</span><p className="text-white font-medium">{client.signingAuthority || 'N/A'}</p></div>
                                        <div><span className="text-gray-500 text-xs">Focal Person:</span><p className="text-white font-medium">{focalPerson?.displayName || 'Unassigned'}</p></div>
                                        {client.engagementLetterUrl && (
                                            <a href={client.engagementLetterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-brand-400 hover:text-brand-300 text-xs font-bold mt-2"><ExternalLink size={12} /> View Engagement Letter</a>
                                        )}
                                    </div>
                                </div>
                                {/* Work Status */}
                                <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400" /> Work Status</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 rounded-xl p-3 text-center"><p className="text-2xl font-black text-white">{clientTasks.length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Total Tasks</p></div>
                                        <div className="bg-emerald-500/5 rounded-xl p-3 text-center"><p className="text-2xl font-black text-emerald-400">{clientTasks.filter(t => t.status === 'COMPLETED').length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Completed</p></div>
                                        <div className="bg-rose-500/5 rounded-xl p-3 text-center"><p className="text-2xl font-black text-rose-400">{overdueTasks.length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Overdue</p></div>
                                        <div className="bg-amber-500/5 rounded-xl p-3 text-center"><p className="text-2xl font-black text-amber-400">{clientTasks.filter(t => t.status === 'IN_PROGRESS').length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">In Progress</p></div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* DOCUMENTS TAB */}

                    {activeTab === 'DOCUMENTS' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                             <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white">Knowledge Base & KYC</h3>
                                <button 
                                    onClick={() => setIsAddDocModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-lg shadow-brand-900/20"
                                >
                                    <Plus size={16} /> Add Document
                                </button>
                            </div>

                            {client.documents && client.documents.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {client.documents.map(doc => (
                                        <div key={doc.id} className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-brand-500/30 transition-all group">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
                                                    <FileText size={24} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-white text-base truncate">{doc.title}</h4>
                                                    <p className="text-xs text-brand-400 font-bold uppercase">{doc.category}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                                <div className="flex items-center gap-2">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors">
                                                        View <ArrowRight size={14} />
                                                    </a>
                                                    <button 
                                                        onClick={() => handleDeleteDocument(doc.id)}
                                                        className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center glass-panel rounded-[32px] border-dashed border-2 border-white/10">
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                        <FileText size={32} className="text-gray-600" />
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">No documents attached</h4>
                                    <p className="text-gray-500 text-sm max-w-md text-center">Repository for KYC, registration certificates, and legal documents is empty for this client.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TASKS TAB */}
                    {activeTab === 'TASKS' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {clientTasks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {clientTasks.map(task => (
                                        <div key={task.id} className="glass-card p-5 rounded-2xl hover:border-brand-500/30 transition-all cursor-pointer" onClick={() => navigate('/tasks')}>
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="font-bold text-white text-sm line-clamp-2">{task.title}</h4>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${task.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                                    }`}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-gray-400 mt-4 pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-1.5">
                                                    <CalIcon size={12} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Date'}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <User size={12} /> {task.assignedToNames?.[0] || 'Unassigned'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={CheckCircle2}
                                    title="No associated tasks"
                                    description="This client currently has no active or completed tasks."
                                />
                            )}
                        </div>
                    )}





                    {/* WORK_LOGS TAB */}
                    {activeTab === 'WORK_LOGS' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {clientWorkLogs.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="glass-panel p-4 rounded-xl text-center"><p className="text-2xl font-black text-white">{clientWorkLogs.reduce((sum, w) => sum + (w.workHours || 0), 0).toFixed(1)}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Total Hours</p></div>
                                        <div className="glass-panel p-4 rounded-xl text-center"><p className="text-2xl font-black text-amber-400">{new Set(clientWorkLogs.map(w => w.userId)).size}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Unique Staff</p></div>
                                        <div className="glass-panel p-4 rounded-xl text-center"><p className="text-2xl font-black text-emerald-400">{clientWorkLogs.length}</p><p className="text-[10px] text-gray-500 font-bold uppercase">Sessions</p></div>
                                    </div>
                                    <div className="glass-panel rounded-2xl overflow-hidden border border-white/5">
                                        <table className="w-full text-sm">
                                            <thead><tr className="border-b border-white/10 text-xs text-gray-500 uppercase">
                                                <th className="p-4 text-left font-bold">Date</th><th className="p-4 text-left font-bold">Staff</th><th className="p-4 text-left font-bold">Clock In</th><th className="p-4 text-left font-bold">Clock Out</th><th className="p-4 text-left font-bold">Hours</th><th className="p-4 text-left font-bold">Description</th><th className="p-4 text-left font-bold">Status</th>
                                            </tr></thead>
                                            <tbody>{clientWorkLogs.map(log => (
                                                <tr key={log.id} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="p-4 text-gray-300">{new Date(log.date).toLocaleDateString()}</td>
                                                    <td className="p-4 text-white font-medium">{log.userName}</td>
                                                    <td className="p-4 text-gray-300">{log.clockIn ? new Date(log.clockIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</td>
                                                    <td className="p-4 text-gray-300">{log.clockOut ? new Date(log.clockOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</td>
                                                    <td className="p-4 text-gray-200 font-medium">{log.workHours?.toFixed(1) || '—'}</td>
                                                    <td className="p-4 text-gray-400 max-w-[200px] truncate">{log.workDescription || '—'}</td>
                                                    <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{log.status}</span></td>
                                                </tr>
                                            ))}</tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <EmptyState icon={Clock} title="No work logs" description="Attendance records linked to this client will appear here." />
                            )}
                        </div>
                    )}


                </div>
            </div>
        </div>


        {/* Add Document Modal */}
        <AnimatePresence>
            {isAddDocModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsAddDocModalOpen(false)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative w-full max-w-md bg-navy-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6"
                    >
                        <h3 className="text-xl font-bold text-white mb-4">Attach Document</h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Document Title</label>
                                <input 
                                    type="text"
                                    value={newDocTitle}
                                    onChange={(e) => setNewDocTitle(e.target.value)}
                                    placeholder="e.g., Audit Report 2080"
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-500 transition-all font-medium"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest">Storage Source</label>
                                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                                        <button 
                                            onClick={() => setIsUploadMode(true)}
                                            className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${isUploadMode ? 'bg-brand-600 text-white' : 'text-gray-500'}`}
                                        >
                                            Upload
                                        </button>
                                        <button 
                                            onClick={() => setIsUploadMode(false)}
                                            className={`px-3 py-1 text-[10px] font-black rounded-md transition-all ${!isUploadMode ? 'bg-brand-600 text-white' : 'text-gray-500'}`}
                                        >
                                            Link
                                        </button>
                                    </div>
                                </div>

                                {isUploadMode ? (
                                    <FileUploader 
                                        onUploadComplete={(fileData) => handleAddDocument({
                                            title: newDocTitle || fileData.name,
                                            url: fileData.url,
                                            category: 'KYC',
                                            id: fileData.id
                                        })}
                                    />
                                ) : (
                                    <input 
                                        type="text"
                                        placeholder="Drive or External Link..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleAddDocument({
                                                    title: newDocTitle || 'Linked Doc',
                                                    url: (e.target as HTMLInputElement).value,
                                                    category: 'Other'
                                                });
                                            }
                                        }}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-brand-500 transition-all text-sm"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsAddDocModalOpen(false)}
                                className="px-4 py-2 text-xs font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                            >
                                Cancel
                            </button>
                            {!isUploadMode && (
                                <button 
                                    onClick={() => {
                                        const input = document.querySelector('input[placeholder="Drive or External Link..."]') as HTMLInputElement;
                                        if (input?.value) {
                                            handleAddDocument({
                                                title: newDocTitle || 'Linked Doc',
                                                url: input.value,
                                                category: 'Other'
                                            });
                                        }
                                    }}
                                    className="px-6 py-2 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-900/40"
                                >
                                    Save Link
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        </>
    );
};

export default ClientDetailPage;
