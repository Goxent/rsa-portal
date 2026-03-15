import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft, Building2, Briefcase, BadgeCheck, Phone, Mail, MapPin,
    Calendar as CalIcon, FileText, CheckCircle2, Activity, ShieldCheck,
    Clock, Tag, User, Plus, ArrowRight, Trash2
} from 'lucide-react';
import { Client, Task, UserProfile } from '../types';
import { ComplianceEvent } from '../types/advanced';
import { AuthService, auth } from '../services/firebase';
import { ComplianceService, complianceKeys } from '../services/advanced';
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

type Tab = 'TASKS' | 'DOCUMENTS' | 'COMPLIANCE' | 'ACTIVITY';

const ClientDetailPage: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<Tab>('TASKS');
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

    // Fetch Compliance
    const { data: complianceEvents = [], isLoading: complianceLoading } = useQuery({
        queryKey: complianceKeys.all,
        queryFn: () => ComplianceService.getEvents()
    });

    const client = clients.find(c => c.id === clientId);
    const isLoading = clientsLoading || staffLoading || tasksLoading || complianceLoading;

    const clientTasks = useMemo(() => {
        if (!client) return [];
        return allTasks.filter(t => t.clientIds?.includes(client.id));
    }, [allTasks, client]);

    const clientCompliance = useMemo(() => {
        if (!client) return [];
        // Match by name or if client id was added to compliance
        return complianceEvents.filter(e => e.clientName === client.name);
    }, [complianceEvents, client]);

    const clientActivity = useMemo(() => {
        // Mocking an activity timeline from tasks for now
        // Normally you'd have an audit log
        if (!client) return [];
        const activities = clientTasks.map(t => ({
            id: t.id,
            title: `Task "${t.title}" was created`,
            date: t.createdAt,
            type: 'TASK_CREATED'
        }));

        const completions = clientTasks.filter(t => t.status === 'COMPLETED').map(t => ({
            id: `${t.id}_comp`,
            title: `Task "${t.title}" was marked as completed`,
            date: (t as any).updatedAt || t.createdAt,
            type: 'TASK_COMPLETED'
        }));

        const complianceActs = clientCompliance.map(c => ({
            id: c.id,
            title: `Compliance Event "${c.title}" generated`,
            date: c.createdAt,
            type: 'COMPLIANCE_ADDED'
        }));

        return [...activities, ...completions, ...complianceActs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [clientTasks, clientCompliance, client]);

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
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-3xl font-black text-blue-400 shadow-xl shadow-blue-900/20 shrink-0">
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
                                <span className="flex items-center"><Briefcase size={14} className="mr-1.5 text-blue-400" /> {client.serviceType}</span>
                                <span className="flex items-center"><Building2 size={14} className="mr-1.5 text-purple-400" /> {client.industry || 'General Sector'}</span>
                            </div>
                        </div>

                        {/* Quick Stats / Info Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Lead Auditor / Focal</p>
                                <div className="flex items-center text-sm text-gray-200 font-medium">
                                    <User size={14} className="mr-2 text-indigo-400" />
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
                                    {client.email && <span className="flex items-center"><Mail size={12} className="mr-2 text-blue-400" /> <span className="truncate">{client.email}</span></span>}
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
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Reg No.</p>
                                <div className="text-sm text-gray-200 font-medium">
                                    {client.registrationNumber || 'N/A'}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Tax Clearance</p>
                                <div className="text-sm text-emerald-400 font-bold">
                                    {client.taxClearanceUntil || 'Pending'}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Ward/Dist</p>
                                <div className="text-sm text-gray-200 font-medium truncate">
                                    {client.wardNumber ? `W-${client.wardNumber}, ` : ''}{client.district || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs & Content */}
            <div className="space-y-6">
                <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10 hide-scrollbar">
                    {(['TASKS', 'DOCUMENTS', 'COMPLIANCE', 'ACTIVITY'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab
                                ? 'bg-white/10 text-white border-b-2 border-brand-500'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab === 'TASKS' && <CheckCircle2 size={16} />}
                            {tab === 'DOCUMENTS' && <FileText size={16} />}
                            {tab === 'COMPLIANCE' && <ShieldCheck size={16} />}
                            {tab === 'ACTIVITY' && <Activity size={16} />}
                            {tab === 'TASKS' ? `Active Tasks (${clientTasks.length})` : tab}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
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
                                                    task.status === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
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

                    {/* COMPLIANCE TAB */}
                    {activeTab === 'COMPLIANCE' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {clientCompliance.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {clientCompliance.map(event => (
                                        <div key={event.id} className="glass-panel p-5 rounded-2xl border-l-4 border-l-brand-500">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300 uppercase tracking-wider">
                                                            {event.category}
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 uppercase tracking-wider border border-brand-500/30">
                                                            {event.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-white text-lg">{event.title}</h4>
                                                    <p className="text-sm text-gray-400 mt-1">{event.description}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-xs font-medium text-gray-400">
                                                <Clock size={14} className="text-amber-400" />
                                                Due: <span className="text-gray-200">{new Date(event.dueDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={ShieldCheck}
                                    title="No compliance events"
                                    description="No statutory compliance events found for this client."
                                />
                            )}
                        </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === 'ACTIVITY' && (
                        <div className="space-y-0 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {clientActivity.length > 0 ? (
                                clientActivity.map((activity, index) => (
                                    <div key={activity.id + index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active py-4">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-navy-900 bg-brand-500 text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl shadow-brand-500/20 z-10">
                                            {activity.type === 'TASK_CREATED' && <Plus size={16} />}
                                            {activity.type === 'TASK_COMPLETED' && <CheckCircle2 size={16} />}
                                            {activity.type === 'COMPLIANCE_ADDED' && <ShieldCheck size={16} />}
                                        </div>
                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] glass-panel p-4 rounded-xl border border-white/5 hover:border-brand-500/30 transition-all">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">{activity.type.replace('_', ' ')}</span>
                                                <time className="text-[10px] text-gray-500 font-mono">{new Date(activity.date).toLocaleString()}</time>
                                            </div>
                                            <p className="text-sm font-medium text-gray-200">{activity.title}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <EmptyState
                                    icon={Activity}
                                    title="No recent activity"
                                    description="Activity history will appear here once interactions happen."
                                />
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
