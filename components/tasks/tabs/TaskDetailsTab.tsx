import React from 'react';
import { Briefcase, ClipboardCheck, Eye, FolderOpen, MessageSquare, ShieldCheck, CheckCircle2, Settings2 } from 'lucide-react';
import { Task, AuditPhase, UserProfile } from '../../../types';
import { AuditDocFile } from '../../../services/auditDocs';

export const PHASE_LABELS_FULL = {
    [AuditPhase.ONBOARDING]: 'Onboarding & Risk Assmt',
    [AuditPhase.PLANNING_AND_EXECUTION]: 'Planning & Execution',
    [AuditPhase.REVIEW_AND_CONCLUSION]: 'Review & Conclusion'
};

export interface TaskDetailsTabProps {
    task: Partial<Task>;
    usersList: UserProfile[];
    auditFiles: AuditDocFile[];
    setActiveDetailTab: (tab: string) => void;
    isArchived: boolean;
}

const TaskDetailsTab: React.FC<TaskDetailsTabProps> = ({
    task,
    usersList,
    auditFiles,
    setActiveDetailTab,
    isArchived
}) => {
    const getMemberName = (uid?: string) => {
        if (!uid) return null;
        return usersList.find(u => u.uid === uid)?.displayName || 'Unknown';
    };

    const teamMembers = [
        { role: 'Team Leader', id: task.teamLeaderId, color: 'brand' },
        { role: 'QC Reviewer', id: task.engagementReviewerId, color: 'purple' },
        { role: 'Signing Partner', id: task.signingPartnerId, color: 'rose' }
    ].filter(m => m.id);

    const assignedStaff = (task.assignedTo || []).map(uid => getMemberName(uid)).filter(Boolean) as string[];

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-[1600px] w-full mx-auto p-4 md:p-6 space-y-6 pb-32">
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Column: Core Identity (Read-only) */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--border)] shadow-none">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-dim)] flex items-center justify-center border border-[var(--border-accent)] text-[var(--accent)]">
                                    <Briefcase size={16} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-semibold text-[var(--text-heading)]">Engagement overview</h4>
                                    <p className="text-[11px] text-[var(--text-muted)] font-normal">Core information summary</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Title</label>
                                    <p className="text-xs font-semibold text-[var(--text-heading)]">{task.title}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Client</label>
                                    <p className="text-xs font-semibold text-[var(--text-heading)]">{task.clientName || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Fiscal year</label>
                                    <p className="text-xs font-semibold tabular-nums text-[var(--color-success)]">FY {task.fiscalYear}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Status & phase</label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] text-[var(--accent)] text-[10px] font-medium border border-[var(--border-accent)] capitalize">
                                            {task.status?.replace('_', ' ').toLowerCase()}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[rgba(79,178,134,0.1)] text-[var(--color-success)] text-[10px] font-medium border border-[rgba(79,178,134,0.25)]">
                                            {(PHASE_LABELS_FULL as any)[task.auditPhase as AuditPhase] || task.auditPhase}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Start date</label>
                                    <p className="text-xs font-semibold tabular-nums text-[var(--text-heading)]">{task.startDate || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Deadline</label>
                                    <p className="text-xs font-semibold tabular-nums text-[var(--color-danger)]">{task.dueDate}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Lead auditor</label>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[10px] font-semibold text-[var(--accent)]">
                                            {task.assignedToNames?.[0]?.charAt(0) || 'A'}
                                        </div>
                                        <p className="text-xs font-semibold text-[var(--text-heading)]">{task.assignedToNames?.[0] || 'Unassigned'}</p>
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-1.5 pt-3 border-t border-[var(--border)]">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Description / audit scope</label>
                                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic">
                                        "{task.description || 'No engagement scope defined.'}"
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Engagement Team Section */}
                        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--border)] shadow-none">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-dim)] flex items-center justify-center border border-[var(--border-accent)] text-[var(--accent)]">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-semibold text-[var(--text-heading)]">Engagement team</h4>
                                        <p className="text-[11px] text-[var(--text-muted)]">Assigned staff & hierarchy</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setActiveDetailTab('SETTINGS')}
                                    className="px-3 py-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] rounded-[var(--radius-md)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors border border-[var(--border)]"
                                >
                                    Modify team
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Hierarchy Roles */}
                                {teamMembers.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {teamMembers.map((member) => (
                                            <div key={member.role} className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border)] flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[10px] font-semibold text-[var(--accent)]">
                                                    {getMemberName(member.id)?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-medium text-[var(--text-muted)]">{member.role}</p>
                                                    <p className="text-xs font-semibold text-[var(--text-heading)]">{getMemberName(member.id)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Assigned Staff List */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-medium text-[var(--text-muted)]">Assigned audit staff</label>
                                    <div className="flex flex-wrap gap-2">
                                        {assignedStaff.length > 0 ? (
                                            assignedStaff.map((name, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border)]">
                                                    <div className="w-4 h-4 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-[8px] font-semibold text-[var(--accent)]">
                                                        {name.charAt(0)}
                                                    </div>
                                                    <span className="text-xs font-medium text-[var(--text-secondary)]">{name}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-[var(--text-muted)] italic">No staff members assigned to this engagement yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Key Pulse Metrics */}
                    <div className="space-y-6">
                        <div className="bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] p-6 border border-[var(--border)] shadow-none space-y-5">
                            <h4 className="text-xs font-semibold text-[var(--text-heading)]">Key metrics</h4>
                            
                            <div className="space-y-4">
                                {/* Progress */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs text-[var(--text-muted)]">Execution progress</span>
                                        <span className="text-base font-semibold tabular-nums text-[var(--accent)]">{Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / (task.subtasks || []).length) * 100 || 0)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border)]">
                                        <div 
                                            className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                                            style={{ width: `${Math.round(((task.subtasks || []).filter(s => s.isCompleted).length / (task.subtasks || []).length) * 100 || 0)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] p-3 border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors cursor-pointer group" onClick={() => setActiveDetailTab('PROCEDURES')}>
                                        <div className="flex items-center gap-1.5 mb-1 text-[var(--text-muted)]">
                                            <ClipboardCheck size={12} />
                                            <span className="text-[11px] font-medium">Procedures</span>
                                        </div>
                                        <p className="text-base font-semibold tabular-nums text-[var(--text-heading)]">{(task.subtasks || []).filter(s => s.isCompleted).length}<span className="text-xs text-[var(--text-muted)] font-normal"> / {(task.subtasks || []).length}</span></p>
                                    </div>

                                    <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] p-3 border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors cursor-pointer group" onClick={() => setActiveDetailTab('OBSERVATIONS')}>
                                        <div className="flex items-center gap-1.5 mb-1 text-[var(--text-muted)]">
                                            <Eye size={12} />
                                            <span className="text-[11px] font-medium">Findings</span>
                                        </div>
                                        <p className="text-base font-semibold tabular-nums text-[var(--text-heading)]">{(task.observations || []).length}</p>
                                    </div>

                                    <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] p-3 border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors cursor-pointer group" onClick={() => setActiveDetailTab('EVIDENCE')}>
                                        <div className="flex items-center gap-1.5 mb-1 text-[var(--text-muted)]">
                                            <FolderOpen size={12} />
                                            <span className="text-[11px] font-medium">Documents</span>
                                        </div>
                                        <p className="text-base font-semibold tabular-nums text-[var(--text-heading)]">{auditFiles.length}</p>
                                    </div>

                                    <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] p-3 border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors cursor-pointer group" onClick={() => setActiveDetailTab('COMMENTS')}>
                                        <div className="flex items-center gap-1.5 mb-1 text-[var(--text-muted)]">
                                            <MessageSquare size={12} />
                                            <span className="text-[11px] font-medium">Activity</span>
                                        </div>
                                        <p className="text-base font-semibold tabular-nums text-[var(--text-heading)]">{(task.comments || []).length}</p>
                                    </div>

                                    <div className="bg-[var(--bg-surface)] rounded-[var(--radius-md)] p-3 border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors cursor-pointer group col-span-2" onClick={() => setActiveDetailTab('REVIEW_CHECKLIST')}>
                                        <div className="flex items-center justify-between mb-1.5 text-[var(--text-muted)]">
                                            <div className="flex items-center gap-1.5">
                                                <ShieldCheck size={12} />
                                                <span className="text-[11px] font-medium">Review protocol</span>
                                            </div>
                                            <span className="text-[10px] font-medium text-[var(--accent)]">3-Layer check</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {[
                                                { label: 'TL', done: !!task.teamLeadApprovedAt },
                                                { label: 'ER', done: !!task.engagementReviewerApprovedAt },
                                                { label: 'SP', done: !!task.signingPartnerApprovedAt }
                                            ].map(lv => (
                                                <div key={lv.label} className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-[var(--radius-sm)] border text-xs font-medium transition-colors ${
                                                    lv.done 
                                                        ? 'bg-[rgba(79,178,134,0.1)] border-[rgba(79,178,134,0.25)] text-[var(--color-success)]' 
                                                        : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)]'
                                                }`}>
                                                    {lv.done ? <CheckCircle2 size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-current opacity-30" />}
                                                    <span>{lv.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!isArchived && (
                                <button 
                                    onClick={() => setActiveDetailTab('SETTINGS')}
                                    className="w-full py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-secondary)] rounded-[var(--radius-md)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-heading)] transition-colors border border-[var(--border)] flex items-center justify-center gap-2"
                                >
                                    <Settings2 size={13} /> Manage engagement
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsTab;
