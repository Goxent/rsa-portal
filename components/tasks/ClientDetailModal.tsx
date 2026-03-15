import React, { useMemo, useState } from 'react';
import { 
    X, Building2, Briefcase, BadgeCheck, Phone, Mail, MapPin, 
    Calendar as CalIcon, FileText, CheckCircle2, Activity, ShieldCheck, 
    Clock, Tag, User, ExternalLink, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client, Task, UserProfile } from '../../types';
import { ComplianceEvent } from '../../types/advanced';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../common/EmptyState';

interface ClientDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    allTasks: Task[];
    allStaff: UserProfile[];
    complianceEvents: ComplianceEvent[];
    onOpenTask?: (task: Task) => void;
}

type Tab = 'OVERVIEW' | 'TASKS' | 'COMPLIANCE' | 'HISTORY';

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
    const [activeTab, setActiveTab] = useState<Tab>('OVERVIEW');

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

    if (!isOpen || !client) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-5xl bg-[#0a0f1e] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                >
                    {/* Header Banner */}
                    <div className="shrink-0 p-8 pb-6 bg-gradient-to-br from-blue-600/10 to-transparent border-b border-white/5 relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        
                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex gap-6 items-start">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-2xl font-black text-blue-400 shadow-xl shadow-blue-900/20 shrink-0">
                                    {client.code?.substring(0, 2).toUpperCase() || 'CL'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-3xl font-black text-white">{client.name}</h2>
                                        <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-gray-400">
                                            {client.code}
                                        </span>
                                    </div>
                                    <div className="flex gap-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                        <span className="flex items-center gap-1.5"><Briefcase size={14} className="text-blue-500" /> {client.serviceType}</span>
                                        <span className="flex items-center gap-1.5"><Tag size={14} className="text-indigo-500" /> {client.industry}</span>
                                        <span className={`flex items-center gap-1.5 ${client.status === 'Active' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${client.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            {client.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/clients/${client.id}`)}
                                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all flex items-center gap-2 text-sm font-bold border border-white/5"
                                >
                                    <ExternalLink size={18} />
                                    Full Profile
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex gap-8 mt-8 border-t border-white/5 pt-6 relative z-10">
                            {[
                                { label: 'Active Tasks', value: stats.active, color: 'text-blue-400' },
                                { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
                                { label: 'Compliance items', value: stats.compliance, color: 'text-amber-400' },
                            ].map(s => (
                                <div key={s.label}>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1">{s.label}</p>
                                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="shrink-0 px-8 bg-black/20 flex gap-6">
                        {(['OVERVIEW', 'TASKS', 'COMPLIANCE', 'HISTORY'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {activeTab === 'OVERVIEW' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="space-y-6">
                                    <section className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <Building2 size={16} className="text-blue-500" /> Organization Info
                                        </h3>
                                        <div className="grid grid-cols-2 gap-y-6">
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1">PAN Number</p>
                                                <p className="text-white font-bold">{client.pan || 'Not provided'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1">Signing Authority</p>
                                                <p className="text-white font-bold">{client.signingAuthority || 'N/A'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] font-bold text-gray-600 uppercase mb-1">Address</p>
                                                <p className="text-white font-medium flex items-center gap-2">
                                                    <MapPin size={14} className="text-rose-400" /> {client.address || 'No address set'}
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <User size={16} className="text-amber-500" /> Focal Person (Staff)
                                        </h3>
                                        {focalPerson ? (
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-black text-blue-400 uppercase">
                                                    {focalPerson.displayName?.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-white font-bold text-lg">{focalPerson.displayName}</p>
                                                    <p className="text-gray-500 text-xs font-medium">{focalPerson.email}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic text-sm">No internal focal person assigned.</p>
                                        )}
                                    </section>
                                </div>

                                <section className="bg-white/5 rounded-2xl p-6 border border-white/5">
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                        <Phone size={16} className="text-emerald-500" /> Contact Details
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                                                <Phone size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-600 uppercase">Phone Number</p>
                                                <p className="text-white font-bold">{client.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
                                                <Mail size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-600 uppercase">Email Address</p>
                                                <p className="text-white font-bold">{client.email || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'TASKS' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {clientTasks.length > 0 ? (
                                    clientTasks.map(task => (
                                        <div key={task.id} className="p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all flex items-center justify-between group">
                                            <div>
                                                <h4 className="font-bold text-white text-base mb-1 group-hover:text-blue-400 transition-colors">{task.title}</h4>
                                                <div className="flex gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                    <span className="flex items-center gap-1.5"><CalIcon size={12} /> Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1.5"><User size={12} /> {task.assignedToNames?.[0] || 'Unassigned'}</span>
                                                </div>
                                            </div>
                                            <div className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${task.status === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                                                {task.status.replace('_', ' ')}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-20 flex flex-col items-center opacity-40">
                                        <EmptyState icon={Briefcase} title="Empty Board" description="No tasks scheduled for this client." />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'COMPLIANCE' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {clientCompliance.length > 0 ? (
                                    clientCompliance.map(event => (
                                        <div key={event.id} className="p-6 bg-white/5 rounded-2xl border-l-[6px] border border-white/5 border-l-amber-500">
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-black text-gray-500 uppercase tracking-widest">{event.category}</span>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                                                    <Clock size={14} />
                                                    {new Date(event.dueDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <h4 className="text-white font-black text-lg mb-2">{event.title}</h4>
                                            <p className="text-sm text-gray-400 leading-relaxed">{event.description}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 py-20 flex flex-col items-center opacity-40">
                                        <EmptyState icon={ShieldCheck} title="Clean Compliance" description="No statutory compliance events found." />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* History could be an activity log, but for now we'll just show a simplified list */}
                        {activeTab === 'HISTORY' && (
                            <div className="flex flex-col items-center justify-center py-20 opacity-30">
                                <Activity size={64} className="mb-4 text-gray-600" />
                                <h3 className="text-xl font-bold text-white mb-2">History Under Dev</h3>
                                <p className="text-sm text-gray-400">Activity logs are being integrated into the Client profile.</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Footnote */}
                    <div className="shrink-0 p-6 bg-black/40 border-t border-white/5 flex justify-between items-center text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                        <span>Organization Management System • R. Sapkota & Associates</span>
                        <span>v2.0 Premium Workflow</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ClientDetailModal;
