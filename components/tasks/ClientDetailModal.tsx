import React, { useMemo, useState } from 'react';
import { 
    X, Building2, Briefcase, BadgeCheck, Phone, Mail, MapPin, 
    Calendar as CalIcon, FileText, CheckCircle2, Activity, ShieldCheck, 
    Clock, Tag, User, ExternalLink, ArrowRight, Plus, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client, Task, UserProfile } from '../../types';
import { ComplianceEvent } from '../../types/advanced';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../common/EmptyState';
import { FileUploader } from '../common/FileUploader';
import { StorageService } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { AuthService, auth } from '../../services/firebase';
import { toast } from 'react-hot-toast';

interface ClientDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    allTasks: Task[];
    allStaff: UserProfile[];
    complianceEvents: ComplianceEvent[];
    onOpenTask?: (task: Task) => void;
}

type Tab = 'OVERVIEW' | 'TASKS' | 'DOCUMENTS' | 'COMPLIANCE' | 'HISTORY';

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
    isOpen,
    onClose,
    client,
    allTasks,
    allStaff,
    complianceEvents,
    onOpenTask
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;
    
    const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');
    const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
    const [isUploadMode, setIsUploadMode] = useState(false);
    const [newDocTitle, setNewDocTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const clientTasks = useMemo(() => {
        if (!client) return [];
        return allTasks.filter(t => t.clientIds?.includes(client.id));
    }, [allTasks, client]);

    const clientCompliance = useMemo(() => {
        if (!client) return [];
        return complianceEvents.filter(e => e.clientName === client.name);
    }, [complianceEvents, client]);

    const focalPerson = useMemo(() => {
        if (!client) return null;
        return allStaff.find(s => s.uid === client.auditorId);
    }, [allStaff, client]);

    const stats = useMemo(() => ({
        active: clientTasks.filter(t => t.status !== 'COMPLETED').length,
        completed: clientTasks.filter(t => t.status === 'COMPLETED').length,
        compliance: clientCompliance.length
    }), [clientTasks, clientCompliance]);

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

    if (!isOpen || !client) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 10 }}
                    className="relative w-full max-w-5xl bg-[var(--bg-main)] border border-[var(--border)] rounded-[var(--radius-xl)] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                >
                    {/* Header Banner */}
                    <div className="shrink-0 p-6 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-4 items-start">
                                <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-lg font-bold text-[var(--accent)] shrink-0">
                                    {client.code?.substring(0, 2).toUpperCase() || 'CL'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-xl font-semibold text-[var(--text-heading)]">{client.name}</h2>
                                        <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-mono text-[var(--text-muted)]">
                                            {client.code}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
                                        <span className="flex items-center gap-1"><Briefcase size={13} className="text-[var(--accent)]" /> {client.serviceType}</span>
                                        <span className="flex items-center gap-1"><Tag size={13} className="text-[var(--accent)]" /> {client.industry}</span>
                                        <span className="flex items-center gap-1.5" style={{ color: client.status === 'Active' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: client.status === 'Active' ? 'var(--color-success)' : 'var(--color-danger)' }} />
                                            {client.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {isAdmin && (
                                    <button
                                        onClick={() => navigate(`/clients/${client.id}`)}
                                        className="h-8 px-3 rounded-[var(--radius-md)] bg-[var(--bg-surface)] hover:bg-[var(--bg-main)] text-[var(--text-heading)] transition-colors flex items-center gap-1.5 text-xs font-medium border border-[var(--border)]"
                                    >
                                        <ExternalLink size={14} />
                                        Full profile
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] hover:bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors border border-[var(--border)]"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex gap-8 mt-5 border-t border-[var(--border)] pt-4">
                            {[
                                { label: 'Active tasks', value: stats.active },
                                { label: 'Completed', value: stats.completed },
                                { label: 'Compliance items', value: stats.compliance },
                            ].map(s => (
                                <div key={s.label}>
                                    <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
                                    <p className="text-base font-semibold tabular-nums text-[var(--text-heading)] mt-0.5">{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="shrink-0 px-6 bg-[var(--bg-surface)] border-b border-[var(--border)] flex gap-4">
                        {(['OVERVIEW', 'TASKS', 'DOCUMENTS', 'COMPLIANCE', 'HISTORY'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-[var(--accent)] text-[var(--accent)] font-semibold' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-heading)]'}`}
                            >
                                {tab === 'OVERVIEW' ? 'Overview' : tab === 'TASKS' ? 'Tasks' : tab === 'DOCUMENTS' ? 'Documents' : tab === 'COMPLIANCE' ? 'Compliance' : 'History'}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[var(--bg-main)]">
                        {activeTab === 'OVERVIEW' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-6">
                                    <section className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-5 border border-[var(--border)] space-y-4">
                                        <h3 className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-2">
                                            <Building2 size={15} className="text-[var(--accent)]" /> Organization info
                                        </h3>
                                        <div className="grid grid-cols-2 gap-y-4">
                                            <div>
                                                <p className="text-xs text-[var(--text-muted)]">PAN number</p>
                                                <p className="text-xs font-medium text-[var(--text-heading)] mt-0.5">{client.pan || 'Not provided'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[var(--text-muted)]">Signing authority</p>
                                                <p className="text-xs font-medium text-[var(--text-heading)] mt-0.5">{client.signingAuthority || 'N/A'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-xs text-[var(--text-muted)]">Address</p>
                                                <p className="text-xs font-medium text-[var(--text-heading)] flex items-center gap-1.5 mt-0.5">
                                                    <MapPin size={13} className="text-[var(--color-danger)]" /> {client.address || 'No address set'}
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-5 border border-[var(--border)] space-y-4">
                                        <h3 className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-2">
                                            <ShieldCheck size={15} className="text-[var(--accent)]" /> Statutory & compliance (Nepal)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-y-4">
                                            <div>
                                                <p className="text-xs text-[var(--text-muted)]">VAT number</p>
                                                <p className="text-xs font-medium text-[var(--text-heading)] mt-0.5">{client.vatNumber || 'Not registered'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-[var(--text-muted)]">Fiscal year end</p>
                                                <p className="text-xs font-medium text-[var(--text-heading)] mt-0.5">{client.fiscalYearEnd || 'Ashad End'}</p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-5 border border-[var(--border)] space-y-3">
                                        <h3 className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-2">
                                            <User size={15} className="text-[var(--accent)]" /> Focal person (staff)
                                        </h3>
                                        {focalPerson ? (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-xs font-semibold text-[var(--accent)]">
                                                    {focalPerson.displayName?.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-[var(--text-heading)]">{focalPerson.displayName}</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{focalPerson.email}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-[var(--text-muted)] italic">No internal focal person assigned.</p>
                                        )}
                                    </section>
                                </div>

                                <section className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-5 border border-[var(--border)] space-y-4">
                                    <h3 className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-2">
                                        <Phone size={15} className="text-[var(--accent)]" /> Contact details
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border)] flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center">
                                                <Phone size={15} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[var(--text-muted)]">Phone number</p>
                                                <p className="text-xs font-medium text-[var(--text-heading)] mt-0.5">{client.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-[var(--bg-surface)] rounded-[var(--radius-md)] border border-[var(--border)] flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center">
                                                <Mail size={15} />
                                            </div>
                                            <div>
                                                <p className="text-xs text-[var(--text-muted)]">Email address</p>
                                                <p className="text-xs font-medium text-[var(--text-heading)] mt-0.5">{client.email || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'DOCUMENTS' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-[var(--text-heading)]">Client knowledge base</h3>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => setIsAddDocModalOpen(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold hover:opacity-90 transition-colors"
                                        >
                                            <Plus size={14} /> Add document
                                        </button>
                                    )}
                                </div>

                                {client.documents && client.documents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {client.documents.map((doc, idx) => (
                                            <div key={doc.id || `doc-${idx}`} className="p-3.5 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-heading)]">
                                                        <FileText size={16} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-[var(--text-heading)] text-xs">{doc.title}</h4>
                                                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{doc.category} • {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-heading)] opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ArrowRight size={14} />
                                                    </a>
                                                    {isAdmin && (
                                                        <button 
                                                            onClick={() => handleDeleteDocument(doc.id)}
                                                            className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--color-danger)] opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-16 flex flex-col items-center justify-center bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] border border-dashed border-[var(--border)]">
                                        <FileText size={36} className="text-[var(--text-muted)] opacity-30 mb-2" />
                                        <h4 className="text-xs font-semibold text-[var(--text-heading)] mb-0.5">No documents attached</h4>
                                        <p className="text-xs text-[var(--text-muted)]">Upload KYC, registrations, or legal documents here.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'TASKS' && (
                            <div className="space-y-2">
                                {clientTasks.length > 0 ? (
                                    clientTasks.map((task, idx) => (
                                        <div key={task.id || `task-${idx}`} className="p-3.5 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors flex items-center justify-between group">
                                            <div>
                                                <h4 className="font-medium text-[var(--text-heading)] text-xs mb-1">{task.title}</h4>
                                                <div className="flex gap-3 text-[11px] text-[var(--text-muted)]">
                                                    <span className="flex items-center gap-1"><CalIcon size={12} /> Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1"><User size={12} /> {task.assignedToNames?.[0] || 'Unassigned'}</span>
                                                </div>
                                            </div>
                                            <div className="px-2.5 py-1 rounded-[var(--radius-sm)] border text-xs font-medium" style={{ background: task.status === 'COMPLETED' ? 'rgba(79,178,134,0.1)' : 'rgba(217,164,65,0.1)', borderColor: task.status === 'COMPLETED' ? 'rgba(79,178,134,0.25)' : 'rgba(217,164,65,0.25)', color: task.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                                                {task.status.replace('_', ' ').toLowerCase()}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-16 flex flex-col items-center opacity-40">
                                        <EmptyState icon={Briefcase} title="Empty Board" description="No tasks scheduled for this client." />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'COMPLIANCE' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {clientCompliance.length > 0 ? (
                                    clientCompliance.map((event, idx) => (
                                        <div key={event.id || `event-${idx}`} className="p-4 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-[var(--border)] border-l-4 border-l-[var(--color-warning)] space-y-2">
                                            <div className="flex justify-between items-start">
                                                <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[11px] font-medium text-[var(--text-muted)]">{event.category}</span>
                                                <div className="flex items-center gap-1 text-xs font-medium text-[var(--color-warning)]">
                                                    <Clock size={12} />
                                                    {new Date(event.dueDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <h4 className="text-xs font-semibold text-[var(--text-heading)]">{event.title}</h4>
                                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{event.description}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 py-16 flex flex-col items-center opacity-40">
                                        <EmptyState icon={ShieldCheck} title="Clean Compliance" description="No statutory compliance events found." />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {activeTab === 'HISTORY' && (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-muted)]">
                                <Activity size={36} className="mb-2 opacity-30" />
                                <h3 className="text-xs font-semibold text-[var(--text-heading)] mb-1">History log</h3>
                                <p className="text-xs">Activity logs are being integrated into the client profile.</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Footnote */}
                    <div className="shrink-0 px-6 py-2.5 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex justify-between items-center text-xs text-[var(--text-muted)]">
                        <span>Organization Management System • R. Sapkota & Associates</span>
                        <span>Client view</span>
                    </div>
                </motion.div>
            </div>
            
            {/* Add Document Modal */}
            <AnimatePresence>
                {isAddDocModalOpen && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsAddDocModalOpen(false)}
                            className="absolute inset-0 bg-black/60"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-md bg-[var(--bg-main)] border border-[var(--border)] rounded-[var(--radius-xl)] overflow-hidden shadow-2xl p-6"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-4">Add document</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Document title</label>
                                    <input 
                                        type="text"
                                        value={newDocTitle}
                                        onChange={(e) => setNewDocTitle(e.target.value)}
                                        placeholder="e.g., PAN Certificate"
                                        className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-xs text-[var(--text-heading)] outline-none focus:border-[var(--accent)] transition-colors"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-medium text-[var(--text-muted)]">Source</label>
                                        <div className="flex bg-[var(--bg-surface)] p-0.5 rounded-[var(--radius-md)] border border-[var(--border)]">
                                            <button 
                                                onClick={() => setIsUploadMode(true)}
                                                className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${isUploadMode ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)]'}`}
                                            >
                                                Upload
                                            </button>
                                            <button 
                                                onClick={() => setIsUploadMode(false)}
                                                className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors ${!isUploadMode ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)]'}`}
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
                                            placeholder="Google Drive URL..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleAddDocument({
                                                        title: newDocTitle || 'Drive Link',
                                                        url: (e.target as HTMLInputElement).value,
                                                        category: 'Other'
                                                    });
                                                }
                                            }}
                                            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-xs text-[var(--text-heading)] outline-none focus:border-[var(--accent)] transition-colors"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button 
                                    onClick={() => setIsAddDocModalOpen(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </AnimatePresence>
    );
};

export default ClientDetailModal;
