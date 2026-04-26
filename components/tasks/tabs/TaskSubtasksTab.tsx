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
            <div className="max-w-[1600px] w-full mx-auto p-3 md:p-4 space-y-4 pb-32">
                
                {/* Engagement Stepper Redesigned */}
                <div className="bg-white dark:bg-white/5 rounded-[24px] p-2 flex items-center justify-between shadow-sm border border-black/5 dark:border-white/10 w-fit mx-auto">
                    {[
                        { id: AuditPhase.ONBOARDING, label: 'Onboarding', icon: <Map size={16} /> },
                        { id: AuditPhase.PLANNING_AND_EXECUTION, label: 'Planning and Execution', icon: <Activity size={16} /> },
                        { id: AuditPhase.REVIEW_AND_CONCLUSION, label: 'Review and Conclusion', icon: <CheckCircle2 size={16} /> }
                    ].map((p, i, arr) => {
                        const isActive = watchedPhase === p.id;
                        const isPast = PHASE_ORDER[watchedPhase] > PHASE_ORDER[p.id];
                        
                        return (
                            <React.Fragment key={p.id}>
                                <button
                                    onClick={() => handlePhaseSwitch(p.id)}
                                    className={`flex items-center gap-3 px-6 py-2.5 rounded-full transition-all duration-300 ${
                                        isActive 
                                            ? 'bg-emerald-50 dark:bg-brand-500/20 text-emerald-700 dark:text-brand-400' 
                                            : isPast 
                                                ? 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5' 
                                                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 opacity-60'
                                    }`}
                                >
                                    <div className={`p-1 rounded-full ${isActive ? 'bg-emerald-100 dark:bg-brand-500/30' : ''}`}>
                                        {isPast ? <CheckCircle2 size={16} /> : p.icon}
                                    </div>
                                    <span className="text-[12px] font-bold tracking-tight">{p.label}</span>
                                </button>
                                {i < arr.length - 1 && <div className="w-px h-6 bg-black/5 dark:bg-white/5 mx-2" />}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 w-full gap-y-8">
                    {[AuditPhase.ONBOARDING, AuditPhase.PLANNING_AND_EXECUTION, AuditPhase.REVIEW_AND_CONCLUSION].map(phase => {
                        const phaseSubtasks = (task.subtasks || []).filter(st => st.phase === phase);
                        const isCurrent = currentPhase === phase;
                        const isPast = PHASE_ORDER[phase] < PHASE_ORDER[currentPhase];
                        
                        if (!isCurrent && !isPast) return null;

                        return (
                            <div key={phase} className={`space-y-4 bg-white dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-[28px] p-6 shadow-sm ${!isCurrent ? 'opacity-80' : ''}`}>
                                {/* Phase Header */}
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
                                            isCurrent 
                                                ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' 
                                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        }`}>
                                            {PHASE_ICONS[phase]}
                                        </div>
                                        <div>
                                            <h5 className="text-[13px] font-black uppercase tracking-widest text-white">
                                                {PHASE_LABELS_FULL[phase]} {isCurrent && <span className="inline-flex items-center gap-1.5 ml-3 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 text-[9px] border border-brand-500/20">● Active</span>}
                                            </h5>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                {isPast ? 'Verification Log' : 'Execution Queue'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="h-px flex-1 bg-black/5 dark:bg-white/5 mx-8" />
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                            {phaseSubtasks.filter(s => s.isCompleted).length}/{phaseSubtasks.length} Done
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {phaseSubtasks.length === 0 ? (
                                        <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-[24px] bg-white/[0.01]">
                                            <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest font-bold">No sub-tasks defined for this phase</p>
                                        </div>
                                    ) : (
                                        phaseSubtasks.map((st, i) => renderSubtask(st, i))
                                    )}
                                </div>

                                {isCurrent && canAddSubtasks && (
                                    <div className="flex gap-3 items-center px-4 py-2 rounded-[20px] border border-white/5 bg-white/[0.02] mt-4 focus-within:border-brand-500/30 transition-all shadow-inner group">
                                        <Plus size={14} className="text-gray-600 group-focus-within:text-brand-400 transition-colors" />
                                        <input
                                            type="text"
                                            value={localSubtaskTitles[phase] || ''}
                                            onChange={(e) => setLocalSubtaskTitles(prev => ({ ...prev, [phase]: e.target.value }))}
                                            placeholder={`Add sub-task to ${PHASE_LABELS_FULL[phase]}...`}
                                            className="flex-1 bg-transparent text-[12px] text-white outline-none font-bold placeholder:text-gray-700"
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
