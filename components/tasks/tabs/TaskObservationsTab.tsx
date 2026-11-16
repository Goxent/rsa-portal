import React from 'react';
import { Plus, Trash2, ShieldAlert, FileSearch, CheckCircle2, User, Calendar, BookOpen, Send } from 'lucide-react';
import { AuditObservation } from '../../../types';

export interface TaskObservationsTabProps {
    observations: AuditObservation[];
    isTaskCompleted: boolean;
    canEditTask: boolean;
    isAdminOrMaster: boolean;
    isEngagementTeamMember: boolean;
    currentUserId?: string;
    onAdd: () => void;
    onUpdate: (id: string, updates: Partial<AuditObservation>) => void;
    onRemove: (id: string) => void;
}

const TaskObservationsTab: React.FC<TaskObservationsTabProps> = ({
    observations,
    isTaskCompleted,
    canEditTask,
    isAdminOrMaster,
    isEngagementTeamMember,
    currentUserId,
    onAdd,
    onUpdate,
    onRemove,
}) => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
            <div className="max-w-[1600px] w-full mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2.5">
                            <h4 className="text-sm font-semibold text-[var(--text-heading)]">Audit observations</h4>
                            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium border tabular-nums" style={{ background: 'rgba(217,164,65,0.1)', borderColor: 'rgba(217,164,65,0.25)', color: 'var(--color-warning)' }}>
                                {observations.length} findings
                            </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                            Documentation of technical issues, internal control deficiencies, and management letter points
                        </p>
                    </div>
                    {!isTaskCompleted && canEditTask && (
                        <button
                            onClick={onAdd}
                            className="px-4 py-2 bg-[var(--accent)] text-[var(--on-accent)] rounded-[var(--radius-md)] text-xs font-semibold hover:opacity-90 transition-colors flex items-center gap-1.5"
                        >
                            <Plus size={14} /> Log observation
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    {observations.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--bg-secondary)]">
                            <FileSearch size={40} className="mx-auto text-[var(--text-muted)] opacity-30 mb-3" />
                            <p className="text-xs font-semibold text-[var(--text-heading)]">No findings recorded</p>
                            <p className="text-xs text-[var(--text-muted)] mt-1">Clear engagement. No technical observations found during execution.</p>
                        </div>
                    ) : (
                        observations.map((obs) => (
                             <div key={obs.id} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 space-y-4">
                                 <div className="flex flex-wrap items-center justify-between gap-4">
                                     <div className="flex-1 min-w-[280px] flex items-center gap-3">
                                         <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">
                                             <ShieldAlert size={16} />
                                         </div>
                                         <div className="flex-1 flex flex-col">
                                            <input 
                                                value={obs.title} 
                                                onChange={e => onUpdate(obs.id, { title: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask || (isAdminOrMaster && currentUserId !== obs.createdBy && !isEngagementTeamMember)}
                                                className="bg-transparent text-sm font-semibold text-[var(--text-heading)] border-none outline-none placeholder:text-[var(--text-muted)] w-full"
                                                placeholder="Observation title..."
                                            />
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[11px] text-[var(--text-muted)]">Created by:</span>
                                                <span className="text-[11px] font-medium text-[var(--text-secondary)]">{obs.createdByName || 'Unknown'}</span>
                                            </div>
                                         </div>
                                     </div>

                                     {/* Control Pills: Severity, Status, Delete */}
                                     <div className="flex items-center gap-2 flex-wrap">
                                         {/* Status selector */}
                                         <select
                                             value={obs.status || 'OPEN'}
                                             onChange={e => onUpdate(obs.id, { status: e.target.value as any })}
                                             disabled={isTaskCompleted || !canEditTask}
                                             className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium border bg-[var(--bg-surface)] text-[var(--text-heading)] border-[var(--border)] outline-none cursor-pointer"
                                         >
                                             <option value="DRAFT">Draft</option>
                                             <option value="OPEN">Open</option>
                                             <option value="IN_PROGRESS">In Progress</option>
                                             <option value="CLOSED">Closed / Resolved</option>
                                         </select>

                                         {/* Severity selector */}
                                         <select 
                                             value={obs.severity} 
                                             onChange={e => onUpdate(obs.id, { severity: e.target.value as any })}
                                             disabled={isTaskCompleted || !canEditTask}
                                             style={
                                                 obs.severity === 'CRITICAL' ? { color: 'var(--color-danger)', background: 'rgba(224,112,122,0.1)', borderColor: 'rgba(224,112,122,0.2)' } :
                                                 obs.severity === 'HIGH' ? { color: 'var(--color-warning)', background: 'rgba(217,164,65,0.1)', borderColor: 'rgba(217,164,65,0.25)' } :
                                                 obs.severity === 'MEDIUM' ? { color: 'var(--color-info)', background: 'rgba(106,163,217,0.1)', borderColor: 'rgba(106,163,217,0.25)' } :
                                                 { color: 'var(--color-success)', background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)' }
                                             }
                                             className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium border outline-none cursor-pointer"
                                         >
                                             <option value="LOW">Low risk</option>
                                             <option value="MEDIUM">Medium risk</option>
                                             <option value="HIGH">High risk</option>
                                             <option value="CRITICAL">Critical risk</option>
                                         </select>

                                         {/* Delete Button */}
                                         {!isTaskCompleted && (currentUserId === obs.createdBy || isAdminOrMaster) && (
                                             <button 
                                                 onClick={() => onRemove(obs.id)} 
                                                 className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-danger)] transition-colors"
                                                 title="Delete Observation"
                                             >
                                                 <Trash2 size={13} />
                                             </button>
                                         )}
                                     </div>
                                 </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-[var(--color-warning)] rounded-full" /> Condition & context (finding)
                                        </label>
                                        <textarea 
                                            value={obs.observation}
                                            onChange={e => onUpdate(obs.id, { observation: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors min-h-[50px] resize-y"
                                            placeholder="Describe the finding in detail..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-[var(--color-danger)] rounded-full" /> Implication / risk (criteria)
                                        </label>
                                        <textarea 
                                            value={obs.implication}
                                            onChange={e => onUpdate(obs.id, { implication: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors min-h-[50px] resize-y"
                                            placeholder="What is the potential financial or compliance impact?"
                                        />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 bg-[var(--accent)] rounded-full" /> Audit recommendation
                                        </label>
                                        <textarea 
                                            value={obs.recommendation}
                                            onChange={e => onUpdate(obs.id, { recommendation: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors min-h-[50px] resize-y"
                                            placeholder="Recommended corrective action / internal control improvement..."
                                        />
                                    </div>

                                    {/* Management Response & Disposition Tracking */}
                                    <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-[var(--border)]">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 bg-[var(--color-info)] rounded-full" /> Management response
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-heading)]">
                                                <input 
                                                    type="checkbox"
                                                    checked={!!obs.communicated}
                                                    onChange={e => onUpdate(obs.id, { communicated: e.target.checked })}
                                                    disabled={isTaskCompleted || !canEditTask}
                                                    className="rounded border-[var(--border)] bg-[var(--bg-surface)] text-[var(--accent)] focus:ring-0"
                                                />
                                                <Send size={11} className="text-[var(--color-info)]" />
                                                <span>Communicated to client</span>
                                            </label>
                                        </div>
                                        <textarea 
                                            value={obs.managementResponse || ''}
                                            onChange={e => onUpdate(obs.id, { managementResponse: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2 text-xs text-[var(--text-heading)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors min-h-[45px] resize-y"
                                            placeholder="Client management reply or action plan agreed upon..."
                                        />
                                    </div>

                                    {/* WP Ref, Responsible Person, Target Date */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:col-span-2 bg-[var(--bg-surface)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <BookOpen size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                                            <input 
                                                type="text"
                                                value={obs.wpRef || ''}
                                                onChange={e => onUpdate(obs.id, { wpRef: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask}
                                                placeholder="WP Ref (e.g. B.3)"
                                                className="bg-transparent text-xs text-[var(--text-heading)] border-b border-[var(--border)] focus:border-[var(--accent)] outline-none w-full py-0.5 placeholder:text-[var(--text-muted)]"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <User size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                                            <input 
                                                type="text"
                                                value={obs.owner || ''}
                                                onChange={e => onUpdate(obs.id, { owner: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask}
                                                placeholder="Responsible person / role"
                                                className="bg-transparent text-xs text-[var(--text-heading)] border-b border-[var(--border)] focus:border-[var(--accent)] outline-none w-full py-0.5 placeholder:text-[var(--text-muted)]"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                                            <input 
                                                type="text"
                                                value={obs.dueDate || ''}
                                                onChange={e => onUpdate(obs.id, { dueDate: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask}
                                                placeholder="Agreed date (YYYY-MM-DD)"
                                                className="bg-transparent text-xs text-[var(--text-heading)] border-b border-[var(--border)] focus:border-[var(--accent)] outline-none w-full py-0.5 placeholder:text-[var(--text-muted)]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskObservationsTab;
