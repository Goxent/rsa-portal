import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft, Building2, Briefcase, BadgeCheck, Phone, Mail, MapPin,
    Calendar as CalIcon, FileText, CheckCircle2,
    Clock, User, Plus, ArrowRight, Trash2, ExternalLink, Copy, Lock
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Client, Task, UserProfile, UserRole } from '../types';
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
import { AuditWorkspace } from '../components/audit/AuditWorkspace';
import { FolderArchive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type Tab = 'OVERVIEW' | 'TASKS' | 'DOCUMENTS' | 'WORK_LOGS';

const ClientDetailPage: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

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

    const taskStats = useMemo(() => {
        const statuses = { NOT_STARTED: 0, IN_PROGRESS: 0, IN_REVIEW: 0, COMPLETED: 0, BLOCKED: 0 };
        clientTasks.forEach(t => {
             if (statuses[t.status as keyof typeof statuses] !== undefined) {
                 statuses[t.status as keyof typeof statuses]++;
             }
        });
        return [
            { name: 'To do', value: statuses.NOT_STARTED, color: '#64748b' },
            { name: 'In progress', value: statuses.IN_PROGRESS, color: 'var(--color-info)' },
            { name: 'Review', value: statuses.IN_REVIEW, color: 'var(--color-warning)' },
            { name: 'Completed', value: statuses.COMPLETED, color: 'var(--color-success)' },
            { name: 'Blocked', value: statuses.BLOCKED, color: 'var(--color-danger)' }
        ].filter(s => s.value > 0);
    }, [clientTasks]);

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

    const isStaff = user?.role === UserRole.STAFF;
    const isPermitted = !isStaff || (client?.permittedStaff?.includes(user?.uid || ''));

    if (client && !isPermitted) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
                <div 
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                    <Lock size={36} style={{ color: 'var(--text-muted)' }} />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>Access denied</h2>
                <p className="text-sm max-w-md leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                    You do not have permission to view or manage this client's profile.
                </p>
                <button
                    onClick={() => navigate('/clients')}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                    Back to directory
                </button>
            </div>
        );
    }

    if (!client) {
        return (
            <div className="flex flex-col items-center justify-center h-full pt-20">
                <Building2 size={56} className="mb-4" style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-heading)' }}>Client not found</h2>
                <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>The client you are looking for does not exist or has been removed.</p>
                <button
                    onClick={() => navigate('/clients')}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                    Back to clients
                </button>
            </div>
        );
    }

    const focalPerson = staffList.find(s => s.uid === client.auditorId);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 bg-transparent">
            <div className="space-y-6 max-w-7xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/clients')}
                    className="flex items-center text-sm font-medium transition-colors group"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-heading)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                    <ArrowLeft size={16} className="mr-2" />
                    Back to directory
                </button>

                {/* Client Header Card */}
                <div 
                    className="p-6 rounded-xl relative overflow-hidden border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                    <div 
                        className="absolute left-0 top-0 bottom-0 w-1" 
                        style={{ background: client.status === 'Active' ? 'var(--accent)' : 'var(--color-danger)' }}
                    />

                    <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
                        {/* Avatar / Code Card */}
                        <div 
                            className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 border"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', borderColor: 'var(--border-mid)' }}
                        >
                            {client.code?.substring(0, 2).toUpperCase() || 'CL'}
                        </div>

                        <div className="flex-1 space-y-4">
                            <div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-heading)' }}>{client.name}</h1>
                                    <span 
                                        className="px-2 py-0.5 rounded text-xs font-mono border"
                                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
                                    >
                                        {client.code}
                                    </span>
                                    <span 
                                        className="px-2.5 py-0.5 rounded-full text-xs font-medium border"
                                        style={{ 
                                            background: client.status === 'Active' ? 'var(--accent-dim)' : 'rgba(224,112,122,0.1)', 
                                            color: client.status === 'Active' ? 'var(--accent)' : 'var(--color-danger)', 
                                            borderColor: client.status === 'Active' ? 'var(--border-accent)' : 'rgba(224,112,122,0.25)' 
                                        }}
                                    >
                                        {client.status}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-4 mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                                    {client.pan && (
                                        <span className="flex items-center group">
                                            <BadgeCheck size={14} className="mr-1.5" style={{ color: 'var(--accent)' }} /> 
                                            PAN: <span className="font-mono ml-1" style={{ color: 'var(--text-heading)' }}>{client.pan}</span>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(client.pan!);
                                                    toast.success('PAN copied to clipboard');
                                                }}
                                                className="ml-2 p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors"
                                                title="Copy PAN"
                                                aria-label="Copy PAN"
                                            >
                                                <Copy size={12} />
                                            </button>
                                        </span>
                                    )}
                                    <span className="flex items-center">
                                        <Briefcase size={14} className="mr-1.5" style={{ color: 'var(--color-warning)' }} /> 
                                        {client.serviceType}
                                    </span>
                                    <span className="flex items-center">
                                        <Building2 size={14} className="mr-1.5" style={{ color: 'var(--color-info)' }} /> 
                                        {client.industry || 'General sector'}
                                    </span>
                                </div>
                            </div>

                            {/* Quick Stats / Info Row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                                <div>
                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Lead auditor / focal</p>
                                    <div className="flex items-center text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                                        <User size={14} className="mr-2" style={{ color: 'var(--color-warning)' }} />
                                        {focalPerson?.displayName || 'Unassigned'}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Firm authority</p>
                                    <div className="flex items-center text-sm font-medium truncate" style={{ color: 'var(--text-heading)' }} title={client.signingAuthority}>
                                        <BadgeCheck size={14} className="mr-2" style={{ color: 'var(--color-warning)' }} />
                                        {client.signingAuthority || 'N/A'}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Contact</p>
                                    <div className="flex flex-col gap-1 text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                                        {client.phone && <span className="flex items-center"><Phone size={12} className="mr-2" style={{ color: 'var(--accent)' }} /> {client.phone}</span>}
                                        {client.email && <span className="flex items-center"><Mail size={12} className="mr-2" style={{ color: 'var(--color-warning)' }} /> <span className="truncate">{client.email}</span></span>}
                                        {!client.phone && !client.email && <span className="italic" style={{ color: 'var(--text-muted)' }}>No contact info</span>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Location</p>
                                    <div className="flex items-center text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
                                        <MapPin size={14} className="mr-2" style={{ color: 'var(--color-danger)' }} />
                                        <span className="truncate">{client.address || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Statutory Info */}
                            {client.vatNumber && (
                                <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                                    <span className="text-xs font-medium mr-2" style={{ color: 'var(--text-muted)' }}>VAT number:</span>
                                    <span className="text-sm font-mono font-medium" style={{ color: 'var(--text-heading)' }}>{client.vatNumber}</span>
                                </div>
                            )}
                        </div>

                        {/* Mini Task Chart */}
                        <div 
                            className="w-full md:w-56 shrink-0 flex flex-col items-center justify-center p-3.5 rounded-xl border"
                            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                        >
                            <p className="text-xs font-semibold w-full mb-1" style={{ color: 'var(--text-muted)' }}>Task distribution</p>
                            {taskStats.length > 0 ? (
                                <div className="h-24 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={taskStats}
                                                innerRadius={22}
                                                outerRadius={36}
                                                paddingAngle={2}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {taskStats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                                contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px', padding: '4px 8px' }}
                                                itemStyle={{ color: 'var(--text-heading)' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-24 w-full flex items-center justify-center text-xs italic" style={{ color: 'var(--text-muted)' }}>
                                    No tasks assigned
                                </div>
                            )}
                            {taskStats.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-1 justify-center">
                                    {taskStats.map(s => (
                                        <div key={s.name} className="flex items-center gap-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                            {s.name} ({s.value})
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs & Content */}
                <div className="space-y-6">
                    <div className="flex gap-1 overflow-x-auto pb-1 border-b hide-scrollbar" style={{ borderColor: 'var(--border)' }}>
                        {(['OVERVIEW', 'TASKS', 'DOCUMENTS', 'WORK_LOGS'] as Tab[]).map((tab) => {
                            const isActive = activeTab === tab;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-t-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 ${isActive ? '' : 'border-transparent'}`}
                                    style={{
                                        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                                        borderColor: isActive ? 'var(--accent)' : 'transparent',
                                        background: isActive ? 'var(--bg-elevated)' : 'transparent'
                                    }}
                                >
                                    {tab === 'OVERVIEW' && <Building2 size={14} />}
                                    {tab === 'TASKS' && <CheckCircle2 size={14} />}
                                    {tab === 'DOCUMENTS' && <FileText size={14} />}
                                    {tab === 'WORK_LOGS' && <Clock size={14} />}

                                    {tab === 'OVERVIEW' ? 'Overview' :
                                     tab === 'TASKS' ? `Tasks (${clientTasks.length})` :
                                     tab === 'DOCUMENTS' ? `Documents (${client.documents?.length || 0})` :
                                     `Work logs (${clientWorkLogs.length})`}
                                </button>
                            );
                        })}
                    </div>

                    <div className="min-h-[400px]">
                        {/* OVERVIEW TAB */}
                        {activeTab === 'OVERVIEW' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Engagement Info */}
                                    <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                                            <Briefcase size={15} /> Engagement info
                                        </h4>
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Audit period:</span>
                                                <p className="font-medium" style={{ color: 'var(--text-heading)' }}>{client.auditPeriod || 'Not set'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Start / end:</span>
                                                <p className="font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                                    {client.auditStartDate ? new Date(client.auditStartDate).toLocaleDateString() : '—'} → {client.auditEndDate ? new Date(client.auditEndDate).toLocaleDateString() : '—'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Signing authority:</span>
                                                <p className="font-medium" style={{ color: 'var(--text-heading)' }}>{client.signingAuthority || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Focal person:</span>
                                                <p className="font-medium" style={{ color: 'var(--text-heading)' }}>{focalPerson?.displayName || 'Unassigned'}</p>
                                            </div>
                                            {client.engagementLetterUrl && (
                                                <a 
                                                    href={client.engagementLetterUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium mt-2 transition-opacity hover:opacity-80"
                                                    style={{ color: 'var(--accent)' }}
                                                >
                                                    <ExternalLink size={12} /> View engagement letter
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Work Status */}
                                    <div className="p-5 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                                            <CheckCircle2 size={15} /> Work status
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3.5 rounded-lg border text-center" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>{clientTasks.length}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Total tasks</p>
                                            </div>
                                            <div className="p-3.5 rounded-lg border text-center" style={{ background: 'rgba(79,178,134,0.06)', borderColor: 'rgba(79,178,134,0.2)' }}>
                                                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>{clientTasks.filter(t => t.status === 'COMPLETED').length}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Completed</p>
                                            </div>
                                            <div className="p-3.5 rounded-lg border text-center" style={{ background: 'rgba(224,112,122,0.06)', borderColor: 'rgba(224,112,122,0.2)' }}>
                                                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-danger)' }}>{overdueTasks.length}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Overdue</p>
                                            </div>
                                            <div className="p-3.5 rounded-lg border text-center" style={{ background: 'rgba(217,164,65,0.06)', borderColor: 'rgba(217,164,65,0.2)' }}>
                                                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>{clientTasks.filter(t => t.status === 'IN_PROGRESS').length}</p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>In progress</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DOCUMENTS TAB */}
                        {activeTab === 'DOCUMENTS' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>Knowledge base & KYC</h3>
                                    <button 
                                        onClick={() => setIsAddDocModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-opacity"
                                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                                    >
                                        <Plus size={14} /> Add document
                                    </button>
                                </div>

                                {client.documents && client.documents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {client.documents.map(doc => (
                                            <div 
                                                key={doc.id} 
                                                className="p-4 rounded-xl border transition-colors group"
                                                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
                                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                            >
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div 
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                                        style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                                                    >
                                                        <FileText size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-sm truncate" style={{ color: 'var(--text-heading)' }}>{doc.title}</h4>
                                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{doc.category}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                                                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                        {new Date(doc.uploadedAt).toLocaleDateString()}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <a 
                                                            href={doc.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="flex items-center gap-1 text-xs font-medium transition-colors"
                                                            style={{ color: 'var(--accent)' }}
                                                        >
                                                            View <ArrowRight size={12} />
                                                        </a>
                                                        <button 
                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                            className="p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-rose-500/10"
                                                            style={{ color: 'var(--color-danger)' }}
                                                            aria-label="Delete document"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div 
                                        className="py-14 flex flex-col items-center justify-center rounded-xl border border-dashed text-center p-6"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                    >
                                        <div 
                                            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                                        >
                                            <FileText size={24} />
                                        </div>
                                        <h4 className="text-base font-semibold mb-1" style={{ color: 'var(--text-heading)' }}>No documents attached</h4>
                                        <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                                            Repository for KYC, registration certificates, and legal documents is empty for this client.
                                        </p>
                                    </div>
                                )}

                                <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div 
                                            className="w-9 h-9 rounded-lg flex items-center justify-center border"
                                            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--border-accent)' }}
                                        >
                                            <FolderArchive size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold" style={{ color: 'var(--text-heading)' }}>Engagement documentation</h3>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Standardized audit folders repository</p>
                                        </div>
                                    </div>
                                    <div 
                                        className="h-[600px] border rounded-xl overflow-hidden relative"
                                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                    >
                                        <AuditWorkspace clientId={client.id} clientName={client.name} isReadOnly={false} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TASKS TAB */}
                        {activeTab === 'TASKS' && (
                            <div className="space-y-4">
                                {clientTasks.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {clientTasks.map(task => {
                                            const statusColor = task.status === 'COMPLETED' ? 'var(--color-success)' :
                                                               task.status === 'IN_PROGRESS' ? 'var(--color-warning)' :
                                                               'var(--text-muted)';
                                            const statusBg = task.status === 'COMPLETED' ? 'rgba(79,178,134,0.1)' :
                                                             task.status === 'IN_PROGRESS' ? 'rgba(217,164,65,0.1)' :
                                                             'var(--bg-elevated)';
                                            return (
                                                <div 
                                                    key={task.id} 
                                                    className="p-4 rounded-xl border transition-colors cursor-pointer"
                                                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                                                    onClick={() => navigate('/tasks')}
                                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-mid)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                                >
                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                        <h4 className="font-semibold text-sm line-clamp-2" style={{ color: 'var(--text-heading)' }}>{task.title}</h4>
                                                        <span 
                                                            className="px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap border"
                                                            style={{ color: statusColor, background: statusBg, borderColor: 'var(--border)' }}
                                                        >
                                                            {task.status.replace('_', ' ').toLowerCase()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                                        <div className="flex items-center gap-1.5 tabular-nums">
                                                            <CalIcon size={12} /> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <User size={12} /> {task.assignedToNames?.[0] || 'Unassigned'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                            <div className="space-y-6">
                                {clientWorkLogs.length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                                    {clientWorkLogs.reduce((sum, w) => sum + (w.workHours || 0), 0).toFixed(1)}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Total hours</p>
                                            </div>
                                            <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>
                                                    {new Set(clientWorkLogs.map(w => w.userId)).size}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Unique staff</p>
                                            </div>
                                            <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                                <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>
                                                    {clientWorkLogs.length}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Sessions</p>
                                            </div>
                                        </div>
                                        <div className="rounded-xl overflow-hidden border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                                                        <th className="p-3 text-left font-semibold">Date</th>
                                                        <th className="p-3 text-left font-semibold">Staff</th>
                                                        <th className="p-3 text-left font-semibold">Clock in</th>
                                                        <th className="p-3 text-left font-semibold">Clock out</th>
                                                        <th className="p-3 text-right font-semibold">Hours</th>
                                                        <th className="p-3 text-left font-semibold">Description</th>
                                                        <th className="p-3 text-left font-semibold">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {clientWorkLogs.map(log => {
                                                        const isPresent = log.status === 'PRESENT' || log.status === 'COMPLETED';
                                                        return (
                                                            <tr 
                                                                key={log.id} 
                                                                className="border-b transition-colors hover:bg-[var(--bg-secondary)]"
                                                                style={{ borderColor: 'var(--border)' }}
                                                            >
                                                                <td className="p-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>{new Date(log.date).toLocaleDateString()}</td>
                                                                <td className="p-3 font-medium" style={{ color: 'var(--text-heading)' }}>{log.userName}</td>
                                                                <td className="p-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                                    {log.clockIn ? (log.clockIn.includes(':') && !log.clockIn.includes('T') ? log.clockIn : (isNaN(new Date(log.clockIn).getTime()) ? log.clockIn : new Date(log.clockIn).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}))) : '—'}
                                                                </td>
                                                                <td className="p-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                                                    {log.clockOut ? (log.clockOut.includes(':') && !log.clockOut.includes('T') ? log.clockOut : (isNaN(new Date(log.clockOut).getTime()) ? log.clockOut : new Date(log.clockOut).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}))) : '—'}
                                                                </td>
                                                                <td className="p-3 text-right font-medium tabular-nums" style={{ color: 'var(--text-heading)' }}>
                                                                    {log.workHours?.toFixed(1) || '—'}
                                                                </td>
                                                                <td className="p-3 max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>{log.workDescription || '—'}</td>
                                                                <td className="p-3">
                                                                    <span 
                                                                        className="px-2 py-0.5 rounded text-[11px] font-medium border"
                                                                        style={{ 
                                                                            color: isPresent ? 'var(--color-success)' : 'var(--color-warning)',
                                                                            background: isPresent ? 'rgba(79,178,134,0.1)' : 'rgba(217,164,65,0.1)',
                                                                            borderColor: isPresent ? 'rgba(79,178,134,0.25)' : 'rgba(217,164,65,0.25)'
                                                                        }}
                                                                    >
                                                                        {log.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
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
                            className="absolute inset-0 bg-black/60"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="relative w-full max-w-md border rounded-xl overflow-hidden shadow-xl p-6"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                        >
                            <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-heading)' }}>Attach document</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Document title</label>
                                    <input 
                                        type="text"
                                        value={newDocTitle}
                                        onChange={(e) => setNewDocTitle(e.target.value)}
                                        placeholder="e.g., Audit Report 2080"
                                        className="w-full px-3.5 py-2 border rounded-lg text-sm outline-none transition-colors"
                                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-heading)' }}
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Storage source</label>
                                        <div className="flex p-0.5 rounded-lg border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                                            <button 
                                                onClick={() => setIsUploadMode(true)}
                                                className="px-3 py-1 text-xs font-medium rounded transition-colors"
                                                style={{
                                                    background: isUploadMode ? 'var(--accent)' : 'transparent',
                                                    color: isUploadMode ? 'var(--on-accent)' : 'var(--text-muted)'
                                                }}
                                            >
                                                Upload
                                            </button>
                                            <button 
                                                onClick={() => setIsUploadMode(false)}
                                                className="px-3 py-1 text-xs font-medium rounded transition-colors"
                                                style={{
                                                    background: !isUploadMode ? 'var(--accent)' : 'transparent',
                                                    color: !isUploadMode ? 'var(--on-accent)' : 'var(--text-muted)'
                                                }}
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
                                            placeholder="Drive or external link..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddDocument({
                                                        title: newDocTitle || 'Linked Doc',
                                                        url: (e.target as HTMLInputElement).value,
                                                        category: 'Other'
                                                    });
                                                }
                                            }}
                                            className="w-full px-3.5 py-2 border rounded-lg text-sm outline-none transition-colors"
                                            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-heading)' }}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-2.5">
                                <button 
                                    onClick={() => setIsAddDocModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium rounded-lg transition-colors border"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                >
                                    Cancel
                                </button>
                                {!isUploadMode && (
                                    <button 
                                        onClick={() => {
                                            const input = document.querySelector('input[placeholder="Drive or external link..."]') as HTMLInputElement;
                                            if (input?.value) {
                                                handleAddDocument({
                                                    title: newDocTitle || 'Linked Doc',
                                                    url: input.value,
                                                    category: 'Other'
                                                });
                                            }
                                        }}
                                        className="px-4 py-2 rounded-lg text-xs font-medium transition-opacity"
                                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                                    >
                                        Save link
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClientDetailPage;
