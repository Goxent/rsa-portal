import React, { useState, useEffect, useMemo } from 'react';
import { 
    Folder, FileText, Search, ExternalLink, Grid, List, BookOpen, 
    Shield, Calculator, FileCheck, Users, Eye, X, Mail, Sparkles, 
    Send, Bot, Plus, ChevronRight, Home, Save, Trash2, Download, 
    File, Loader2, Clock, Info, CheckCircle2, AlertCircle, Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { TaskTemplate, AuditPhase } from '../types';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { useTemplates } from '../hooks/useTemplates';
import LibraryTab from '../components/resources/LibraryTab';

// ─── Sub-Components ───────────────────────────────────────────────────────────

const TemplateCard = ({ template, onClick }: { template: TaskTemplate, onClick: () => void }) => {
    const phases = new Set(template.subtaskDetails?.map(s => s.phase).filter(Boolean));
    return (
        <div onClick={onClick} className="glass-panel p-6 group hover:border-brand-500 transition-all duration-500 cursor-pointer flex flex-col h-full relative overflow-hidden bg-navy-950/40 backdrop-blur-md">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl group-hover:bg-brand-500/10 transition-all duration-500" />
            <div className="flex justify-between items-start mb-6">
                <div className="p-3.5 rounded-2xl bg-brand-500/10 text-brand-400 group-hover:scale-110 group-hover:bg-brand-500/20 transition-all duration-500 border border-brand-500/20 shadow-lg shadow-brand-500/10">
                    <FileCheck size={28} />
                </div>
                {template.expectedDays && (
                    <div className="text-[10px] font-black text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded-xl border border-brand-500/20 uppercase tracking-widest">
                        {template.expectedDays} Day Goal
                    </div>
                )}
            </div>
            <h3 className="text-white font-black text-xl mb-3 group-hover:text-brand-300 transition-colors line-clamp-1 tracking-tight">{template.name}</h3>
            <p className="text-navy-800 text-xs line-clamp-3 mb-8 flex-1 leading-relaxed font-medium uppercase tracking-[0.05em]">{template.description}</p>
            <div className="flex items-center justify-between pt-5 border-t border-white/5 mt-auto bg-white/[0.02] -mx-6 px-6 -mb-6 pb-6">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{template.subtaskDetails?.length || 0} Procedures</span>
                <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl border-2 uppercase tracking-widest ${phases.size > 1 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-lg shadow-purple-500/10' : 'bg-brand-500/10 text-brand-400 border-brand-500/20 shadow-lg shadow-brand-500/10'}`}>
                    {phases.size > 1 ? 'Multi-Phase' : Array.from(phases)[0]?.replace(/_/g, ' ') || 'General'}
                </span>
            </div>
        </div>
    );
};

const TemplatePreviewDrawer = ({ template, isOpen, onClose }: { template: TaskTemplate | null, isOpen: boolean, onClose: () => void }) => {
    if (!template) return null;
    return (
        <div className={`fixed inset-0 z-[100] ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-md transition-opacity duration-500" onClick={onClose} />
            <div className={`absolute right-0 top-0 h-full w-full max-w-xl bg-[#06080a] border-l border-white/10 shadow-2xl transition-transform duration-700 cubic-bezier(0.23, 1, 0.32, 1) transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full flex flex-col p-10 space-y-10 overflow-y-auto custom-scrollbar relative">
                    <div className="absolute top-0 right-0 p-8">
                        <button onClick={onClose} className="p-3 text-gray-600 hover:text-white bg-white/5 rounded-2xl border border-white/10 transition-all"><X size={24} /></button>
                    </div>
                    
                    <div className="space-y-4 pt-12">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-8 bg-brand-500 rounded-full" />
                            <h2 className="text-3xl font-black text-white tracking-tight uppercase">{template.name}</h2>
                        </div>
                        <p className="text-xs text-brand-400 font-black uppercase tracking-[0.4em] ml-5">{template.category} FRAMEWORK</p>
                    </div>

                    <div className="bg-navy-950/50 border border-white/5 rounded-3xl p-6">
                        <p className="text-gray-400 text-sm leading-relaxed font-medium italic">"{template.description}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="glass-panel p-6 border-brand-500/20 bg-brand-500/5">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Engagment Goal</p>
                            <p className="text-white font-black text-xl uppercase tracking-widest">{template.expectedDays || '-'} Days</p>
                        </div>
                        <div className="glass-panel p-6 border-white/10">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Priority Level</p>
                            <p className="text-white font-black text-xl uppercase tracking-widest">{template.priority}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-500/10 rounded-xl text-brand-400"><Send size={14} /></div>
                            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em]">Institutional Procedures</h3>
                        </div>
                        <div className="space-y-3">
                            {template.subtaskDetails?.map((s, i) => (
                                <div key={i} className="flex gap-5 p-5 bg-navy-950/50 border border-white/5 rounded-2xl group hover:border-brand-500/30 transition-all">
                                    <span className="text-brand-500 font-black text-xs pt-1 opacity-40 group-hover:opacity-100 transition-opacity">0{i+1}</span>
                                    <div className="space-y-2">
                                        <p className="text-[14px] font-bold text-gray-200 leading-tight tracking-tight group-hover:text-white transition-colors">{s.title}</p>
                                        {s.phase && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-sm shadow-brand-500/50" />
                                                <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest">{s.phase.replace(/_/g, ' ')}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="sticky bottom-0 pt-10 pb-4 bg-gradient-to-t from-[#06080a] via-[#06080a] to-transparent">
                        <button className="w-full bg-brand-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-brand-600 transition-all shadow-2xl shadow-brand-500/30 active:scale-[0.98]" onClick={onClose}>Deploy Audit Sequence</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type ActiveTab = 'templates' | 'knowledge' | 'library';

const ResourcesPage: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<ActiveTab>('templates');
    const [searchQuery, setSearchQuery] = useState('');
    const { data: templates = [], isLoading: templatesLoading } = useTemplates();
    const [phaseFilter, setPhaseFilter] = useState<AuditPhase | 'ALL'>('ALL');
    const [previewTemplate, setPreviewTemplate] = useState<TaskTemplate | null>(null);

    return (
        <div className="h-full flex flex-col bg-transparent overflow-hidden font-inter">
            {/* Header / Nav */}
            <div className="sticky top-0 z-30 bg-navy-950/60 backdrop-blur-2xl border-b border-white/5 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                            <BookOpen className="text-white" size={24} />
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Information Hub</h1>
                    </div>
                    <nav className="flex bg-navy-950 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                        {[
                            { id: 'templates', label: 'Frameworks', icon: <Grid size={13} />, roles: ['ADMIN', 'MASTER_ADMIN', 'MANAGER'] },
                            { id: 'knowledge', label: 'Compliance', icon: <Shield size={13} /> },
                            { id: 'library', label: 'Archives', icon: <Folder size={13} /> }
                        ].filter(t => !t.roles || t.roles.includes(user?.role || '')).map(t => (
                            <button 
                                key={t.id} 
                                onClick={() => setActiveTab(t.id as ActiveTab)} 
                                className={`px-6 py-2.5 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 ${activeTab === t.id ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' : 'text-gray-500 hover:text-brand-400'}`}
                            >
                                {activeTab === t.id ? t.icon : null}
                                {t.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 pb-32 custom-scrollbar">
                {activeTab === 'templates' ? (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">Audit Frameworks</h2>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Standardized institutional engagement protocols</p>
                            </div>
                            <div className="flex gap-2 bg-navy-950 p-1.5 rounded-2xl border border-white/10">
                                <button onClick={() => setPhaseFilter('ALL')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${phaseFilter === 'ALL' ? 'bg-white text-navy-950 shadow-lg shadow-white/10' : 'text-gray-600 hover:text-white'}`}>Global View</button>
                                {(['ONBOARDING', 'PLANNING_AND_EXECUTION', 'REVIEW_AND_CONCLUSION'] as AuditPhase[]).map(p => (
                                    <button key={p} onClick={() => setPhaseFilter(p)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${phaseFilter === p ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-gray-600 hover:text-brand-400'}`}>
                                        {p === 'ONBOARDING' ? 'Setup' : p === 'PLANNING_AND_EXECUTION' ? 'Execution' : 'Review'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {templatesLoading ? <LoadingSkeleton variant="card" count={4} /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                {templates.filter(t => {
                                    const p = new Set(t.subtaskDetails?.map(s => s.phase).filter(Boolean));
                                    return phaseFilter === 'ALL' || p.has(phaseFilter);
                                }).map((t, idx) => (
                                    <div key={t.id} style={{ animationDelay: `${idx * 50}ms` }} className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
                                        <TemplateCard template={t} onClick={() => setPreviewTemplate(t)} />
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {templates.length === 0 && !templatesLoading && (
                            <div className="flex flex-col items-center justify-center py-24 text-gray-500 border-2 border-dashed border-white/5 rounded-3xl">
                                <Grid size={64} className="mb-4 opacity-5" />
                                <p className="font-black uppercase tracking-widest text-xs">No frameworks cataloged</p>
                                <p className="text-[10px] uppercase tracking-widest mt-1 opacity-40 italic">Synchronize with Master Directory to populate.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <LibraryTab categoryFilter={activeTab === 'knowledge' ? 'Knowledge' : undefined} />
                    </div>
                )}
            </div>

            <TemplatePreviewDrawer template={previewTemplate} isOpen={!!previewTemplate} onClose={() => setPreviewTemplate(null)} />
        </div>
    );
};

export default ResourcesPage;
