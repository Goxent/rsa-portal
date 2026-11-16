import React, { useState } from 'react';
import { 
    Folder, FileCheck, BookOpen, Shield, Grid, X, Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TaskTemplate, AuditPhase } from '../types';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { useTemplates } from '../hooks/useTemplates';
import LibraryTab from '../components/resources/LibraryTab';

// ─── Sub-Components ───────────────────────────────────────────────────────────

const TemplateCard = ({ template, onClick }: { template: TaskTemplate, onClick: () => void }) => {
    const phases = new Set(template.subtaskDetails?.map(s => s.phase).filter(Boolean));
    const procedureCount = template.subtaskDetails?.length || 0;

    return (
        <div 
            onClick={onClick} 
            className="bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--border-mid)] rounded-xl p-5 transition-colors duration-150 cursor-pointer flex flex-col h-full group"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--border-accent)]">
                    <FileCheck size={20} />
                </div>
                {template.expectedDays && (
                    <div className="text-xs font-medium text-[var(--accent)] bg-[var(--accent-dim)] px-2.5 py-1 rounded-md border border-[var(--border-accent)] tabular-nums">
                        {template.expectedDays} day goal
                    </div>
                )}
            </div>
            <h3 className="text-[var(--text-heading)] font-semibold text-base mb-1.5 group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                {template.name}
            </h3>
            <p className="text-[var(--text-muted)] text-xs line-clamp-3 mb-6 flex-1 leading-relaxed">
                {template.description}
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] mt-auto text-xs text-[var(--text-muted)]">
                <span className="tabular-nums">{procedureCount} {procedureCount === 1 ? 'procedure' : 'procedures'}</span>
                <span className={`px-2.5 py-0.5 rounded-md border text-[11px] font-medium ${
                    phases.size > 1 
                        ? 'bg-[rgba(106,163,217,0.1)] text-[var(--color-info)] border-[rgba(106,163,217,0.25)]' 
                        : 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--border-accent)]'
                }`}>
                    {phases.size > 1 ? 'Multi-phase' : (Array.from(phases)[0]?.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()) || 'General')}
                </span>
            </div>
        </div>
    );
};

const TemplatePreviewDrawer = ({ template, isOpen, onClose }: { template: TaskTemplate | null, isOpen: boolean, onClose: () => void }) => {
    if (!template) return null;
    return (
        <div className={`fixed inset-0 z-[100] ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300" onClick={onClose} />
            <div className={`absolute right-0 top-0 h-full w-full max-w-xl bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full flex flex-col p-8 space-y-6 overflow-y-auto custom-scrollbar relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)] tracking-tight">{template.name}</h2>
                            <p className="text-xs text-[var(--accent)] font-medium mt-1">{template.category} framework</p>
                        </div>
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-heading)] bg-[var(--bg-main)] rounded-lg border border-[var(--border)] transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="bg-[var(--bg-main)] border border-[var(--border)] rounded-xl p-4">
                        <p className="text-[var(--text-muted)] text-sm leading-relaxed italic">"{template.description}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[var(--bg-main)] rounded-xl border border-[var(--border)] p-4">
                            <p className="text-xs text-[var(--text-muted)] mb-1">Engagement goal</p>
                            <p className="text-[var(--text-heading)] font-semibold text-lg tabular-nums">{template.expectedDays || '—'} days</p>
                        </div>
                        <div className="bg-[var(--bg-main)] rounded-xl border border-[var(--border)] p-4">
                            <p className="text-xs text-[var(--text-muted)] mb-1">Priority level</p>
                            <p className="text-[var(--text-heading)] font-semibold text-lg">{template.priority}</p>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-[var(--accent-dim)] rounded-md text-[var(--accent)]"><Send size={13} /></div>
                            <h3 className="text-xs font-semibold text-[var(--text-heading)]">Procedures</h3>
                        </div>
                        <div className="space-y-2.5">
                            {template.subtaskDetails?.map((s, i) => (
                                <div key={i} className="flex gap-3 p-3.5 bg-[var(--bg-main)] border border-[var(--border)] rounded-lg hover:border-[var(--border-mid)] transition-colors">
                                    <span className="text-[var(--accent)] font-semibold text-xs pt-0.5 tabular-nums">0{i+1}</span>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-[var(--text-heading)] leading-snug">{s.title}</p>
                                        {s.phase && (
                                            <p className="text-[11px] text-[var(--text-muted)]">
                                                {s.phase.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="sticky bottom-0 pt-4 pb-2 bg-[var(--bg-surface)] border-t border-[var(--border)]">
                        <button 
                            type="button"
                            className="w-full bg-[var(--accent)] text-[var(--on-accent)] py-2.5 rounded-lg font-medium text-xs hover:opacity-90 transition-opacity" 
                            onClick={onClose}
                        >
                            Close drawer
                        </button>
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
    const { data: templates = [], isLoading: templatesLoading } = useTemplates();
    const [phaseFilter, setPhaseFilter] = useState<AuditPhase | 'ALL'>('ALL');
    const [previewTemplate, setPreviewTemplate] = useState<TaskTemplate | null>(null);

    return (
        <div className="h-full flex flex-col bg-transparent overflow-hidden">
            {/* Header / Nav */}
            <div className="sticky top-0 z-30 bg-[var(--bg-surface)] border-b border-[var(--border)] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[var(--accent-dim)] border border-[var(--border-accent)] rounded-lg flex items-center justify-center text-[var(--accent)]">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-semibold text-[var(--text-heading)] tracking-tight">Information hub</h1>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Frameworks, compliance guidance, and archived documents</p>
                        </div>
                    </div>
                    <nav className="flex bg-[var(--bg-main)] p-1 rounded-lg border border-[var(--border)]">
                        {[
                            { id: 'templates', label: 'Frameworks', icon: <Grid size={13} />, roles: ['ADMIN', 'MASTER_ADMIN', 'MANAGER'] },
                            { id: 'knowledge', label: 'Compliance', icon: <Shield size={13} /> },
                            { id: 'library', label: 'Archives', icon: <Folder size={13} /> }
                        ].filter(t => !t.roles || t.roles.includes(user?.role || '')).map(t => (
                            <button 
                                key={t.id} 
                                type="button"
                                onClick={() => setActiveTab(t.id as ActiveTab)} 
                                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
                                    activeTab === t.id 
                                        ? 'bg-[var(--accent)] text-[var(--on-accent)]' 
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                                }`}
                            >
                                {activeTab === t.id ? t.icon : null}
                                {t.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24 custom-scrollbar">
                {activeTab === 'templates' ? (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold text-[var(--text-heading)]">Audit frameworks</h2>
                                <p className="text-xs text-[var(--text-muted)] mt-0.5">Standardized engagement protocols</p>
                            </div>
                            <div className="flex gap-1 bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border)]">
                                <button 
                                    type="button"
                                    onClick={() => setPhaseFilter('ALL')} 
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                        phaseFilter === 'ALL' 
                                            ? 'bg-[var(--accent)] text-[var(--on-accent)]' 
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                                    }`}
                                >
                                    Global view
                                </button>
                                {(['ONBOARDING', 'PLANNING_AND_EXECUTION', 'REVIEW_AND_CONCLUSION'] as AuditPhase[]).map(p => (
                                    <button 
                                        key={p} 
                                        type="button"
                                        onClick={() => setPhaseFilter(p)} 
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                            phaseFilter === p 
                                                ? 'bg-[var(--accent)] text-[var(--on-accent)]' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                                        }`}
                                    >
                                        {p === 'ONBOARDING' ? 'Setup' : p === 'PLANNING_AND_EXECUTION' ? 'Execution' : 'Review'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {templatesLoading ? <LoadingSkeleton variant="card" count={4} /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {templates.filter(t => {
                                    const p = new Set(t.subtaskDetails?.map(s => s.phase).filter(Boolean));
                                    return phaseFilter === 'ALL' || p.has(phaseFilter);
                                }).map((t) => (
                                    <div key={t.id}>
                                        <TemplateCard template={t} onClick={() => setPreviewTemplate(t)} />
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {templates.length === 0 && !templatesLoading && (
                            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--bg-surface)]">
                                <Grid size={40} className="mb-2 opacity-30" />
                                <p className="font-medium text-sm text-[var(--text-heading)]">No frameworks cataloged</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Synchronize with Master Directory to populate.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <LibraryTab categoryFilter={activeTab === 'knowledge' ? 'Knowledge' : undefined} />
                    </div>
                )}
            </div>

            <TemplatePreviewDrawer template={previewTemplate} isOpen={!!previewTemplate} onClose={() => setPreviewTemplate(null)} />
        </div>
    );
};

export default ResourcesPage;
