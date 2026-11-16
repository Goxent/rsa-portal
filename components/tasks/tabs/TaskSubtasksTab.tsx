import React from 'react';
import { Map, Activity, CheckCircle2, Plus } from 'lucide-react';
import { Task, SubTask, AuditPhase } from '../../../types';

export const PHASE_ORDER = {
    [AuditPhase.ONBOARDING]: 1,
    [AuditPhase.PLANNING_AND_EXECUTION]: 2,
    [AuditPhase.REVIEW_AND_CONCLUSION]: 3
};

export const PHASE_LABELS_FULL = {
    [AuditPhase.ONBOARDING]: 'Onboarding',
    [AuditPhase.PLANNING_AND_EXECUTION]: 'Planning and Execution',
    [AuditPhase.REVIEW_AND_CONCLUSION]: 'Review and Conclusion'
};

export const PHASE_ICONS = {
    [AuditPhase.ONBOARDING]: <Map size={14} />,
    [AuditPhase.PLANNING_AND_EXECUTION]: <Activity size={14} />,
    [AuditPhase.REVIEW_AND_CONCLUSION]: <CheckCircle2 size={14} />
};

export interface TaskSubtasksTabProps {
    task: Partial<Task>;
    currentPhase: AuditPhase; // The task's actual saved current phase
    watchedPhase: AuditPhase; // The phase currently selected in the UI stepper
    canAddSubtasks: boolean;
    localSubtaskTitles: Record<string, string>;
    setLocalSubtaskTitles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handlePhaseSwitch: (phase: AuditPhase) => void;
    handleQuickAddSubtask: (phase: AuditPhase) => void;
    renderSubtask: (st: SubTask, index: number) => React.ReactNode;
}

const TaskSubtasksTab: React.FC<TaskSubtasksTabProps> = ({
    task,
    currentPhase,
    watchedPhase,
    canAddSubtasks,
    localSubtaskTitles,
    setLocalSubtaskTitles,
    handlePhaseSwitch,
    handleQuickAddSubtask,
    renderSubtask
}) => {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-[1600px] w-full mx-auto p-4 md:p-6 space-y-6 pb-24">
                
                {/* Engagement Stepper */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-1.5 flex items-center justify-between w-fit mx-auto">
                    {[
                        { id: AuditPhase.ONBOARDING, label: 'Onboarding', icon: <Map size={14} /> },
                        { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Planning & execution', icon: <Activity size={14} /> },
                        { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Review & conclusion', icon: <CheckCircle2 size={14} /> }
                    ].map((p, i, arr) => {
                        const isActive = watchedPhase === p.id;
                        const isPast = PHASE_ORDER[watchedPhase] > PHASE_ORDER[p.id];
                        
                        return (
                            <React.Fragment key={p.id}>
                                <button
                                    onClick={() => handlePhaseSwitch(p.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] text-xs font-medium transition-colors ${
                                        isActive 
                                            ? 'bg-[var(--accent)] text-[var(--on-accent)]' 
                                            : isPast 
                                                ? 'text-[var(--text-heading)] hover:bg-[var(--bg-secondary)]' 
                                                : 'text-[var(--text-muted)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-secondary)]'
                                    }`}
                                >
                                    <div className="flex items-center justify-center">
                                        {isPast ? <CheckCircle2 size={14} className="text-[var(--color-success)]" /> : p.icon}
                                    </div>
                                    <span>{p.label}</span>
                                </button>
                                {i < arr.length - 1 && <div className="w-px h-4 bg-[var(--border)] mx-1" />}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 w-full gap-y-6">
                    {[AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION].map(phase => {
                        const phaseSubtasks = (task.subtasks || []).filter(st => st.phase === phase);
                        const isCurrent = currentPhase === phase;
                        const isPast = PHASE_ORDER[phase] < PHASE_ORDER[currentPhase];
                        
                        if (!isCurrent && !isPast) return null;

                        return (
                            <div key={phase} className={`space-y-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-lg)] p-5 ${!isCurrent ? 'opacity-90' : ''}`}>
                                {/* Phase Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center border border-[var(--border-accent)] bg-[var(--accent-dim)] text-[var(--accent)]">
                                            {PHASE_ICONS[phase]}
                                        </div>
                                        <div>
                                            <h5 className="text-xs font-semibold text-[var(--text-heading)] flex items-center">
                                                {PHASE_LABELS_FULL[phase]}
                                                {isCurrent && (
                                                    <span className="inline-flex items-center gap-1 ml-2.5 px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-medium border" style={{ background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)', color: 'var(--color-success)' }}>
                                                        Active
                                                    </span>
                                                )}
                                            </h5>
                                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                                {isPast ? 'Verification log' : 'Execution queue'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                                            {phaseSubtasks.filter(s => s.isCompleted).length}/{phaseSubtasks.length} done
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {phaseSubtasks.length === 0 ? (
                                        <div className="py-6 text-center border border-dashed border-[var(--border)] rounded-[var(--radius-md)] bg-[var(--bg-surface)]">
                                            <p className="text-xs text-[var(--text-muted)]">No procedures defined for this phase</p>
                                        </div>
                                    ) : (
                                        phaseSubtasks.map((st, i) => renderSubtask(st, i))
                                    )}
                                </div>

                                {isCurrent && canAddSubtasks && (
                                    <div className="flex gap-2.5 items-center px-3.5 py-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] mt-3 focus-within:border-[var(--accent)] transition-colors group">
                                        <Plus size={14} className="text-[var(--text-muted)] group-focus-within:text-[var(--accent)] transition-colors" />
                                        <input
                                            type="text"
                                            value={localSubtaskTitles[phase] || ''}
                                            onChange={(e) => setLocalSubtaskTitles(prev => ({ ...prev, [phase]: e.target.value }))}
                                            placeholder={`Add procedure to ${PHASE_LABELS_FULL[phase]}...`}
                                            className="flex-1 bg-transparent text-xs text-[var(--text-heading)] outline-none placeholder:text-[var(--text-muted)]"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleQuickAddSubtask(phase);
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TaskSubtasksTab;
