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
                <div className="flex items-center justify-between px-2">
                    <div className="flex flex-col gap-2">
                        <h4 className="text-[15px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-3">
                            Audit Observations
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-black border border-amber-500/10">
                                {observations.length} FINDINGS
                            </span>
                        </h4>
                        <p className="text-[9px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.2em]">
                            Documentation of technical issues, internal control deficiencies, and management letter points
                        </p>
                    </div>
                    {!isTaskCompleted && canEditTask && (
                        <button
                            onClick={onAdd}
                            className="px-6 py-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all flex items-center gap-2 group"
                        >
                            <Plus size={14} /> Log New Observation
                        </button>
                    )}
                </div>

                <div className="space-y-6">
                    {observations.length === 0 ? (
                        <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[48px] bg-white/[0.01]">
                            <FileSearch size={64} className="mx-auto text-gray-800 opacity-20 mb-6" />
                            <p className="text-[13px] font-black text-gray-300 uppercase tracking-[0.2em]">No Findings Recorded</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">Clear engagement. No technical observations found during execution.</p>
                        </div>
                    ) : (
                        observations.map((obs) => (
                             <div key={obs.id} className="bg-[#0f1218] border border-white/5 rounded-[24px] p-6 space-y-5 relative group/obs hover:border-amber-500/20 transition-all shadow-xl">
                                 <div className="flex flex-wrap items-center justify-between gap-4">
                                     <div className="flex-1 min-w-[280px] flex items-center gap-4">
                                         <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner flex-shrink-0">
                                             <ShieldAlert size={18} />
                                         </div>
                                         <div className="flex-1 flex flex-col">
                                            <input 
                                                value={obs.title} 
                                                onChange={e => onUpdate(obs.id, { title: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask || (isAdminOrMaster && currentUserId !== obs.createdBy && !isEngagementTeamMember)}
                                                className="bg-transparent text-[16px] font-bold text-white border-none outline-none placeholder:text-gray-700 tracking-tight w-full"
                                                placeholder="Observation Title..."
                                            />
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Created by:</span>
                                                <span className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest">{obs.createdByName || 'Unknown'}</span>
                                            </div>
                                         </div>
                                     </div>

                                     {/* Control Pills: Severity, Status, WP Ref, Delete */}
                                     <div className="flex items-center gap-2.5 flex-wrap">
                                         {/* Status selector */}
                                         <select
                                             value={obs.status || 'OPEN'}
                                             onChange={e => onUpdate(obs.id, { status: e.target.value as any })}
                                             disabled={isTaskCompleted || !canEditTask}
                                             className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border bg-white/5 text-gray-300 border-white/10 outline-none"
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
                                             className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                                                 obs.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                                 obs.severity === 'HIGH' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                 obs.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                             }`}
                                         >
                                             <option value="LOW">Low Risk</option>
                                             <option value="MEDIUM">Medium Risk</option>
                                             <option value="HIGH">High Risk</option>
                                             <option value="CRITICAL">Critical Risk</option>
                                         </select>

                                         {/* Delete Button */}
                                         {!isTaskCompleted && (currentUserId === obs.createdBy || isAdminOrMaster) && (
                                             <button 
                                                 onClick={() => onRemove(obs.id)} 
                                                 className="p-1.5 text-gray-500 hover:text-rose-400 transition-all opacity-60 hover:opacity-100"
                                                 title="Delete Observation"
                                             >
                                                 <Trash2 size={14} />
                                             </button>
                                         )}
                                     </div>
                                 </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            <div className="w-1 h-2.5 bg-amber-500 rounded-full" /> Condition & Context (Finding)
                                        </label>
                                        <textarea 
                                            value={obs.observation}
                                            onChange={e => onUpdate(obs.id, { observation: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[12px] text-gray-200 outline-none focus:border-amber-500/30 transition-all min-h-[50px] shadow-inner resize-y"
                                            placeholder="Describe the finding in detail..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            <div className="w-1 h-2.5 bg-rose-500 rounded-full" /> Implication / Risk (Criteria)
                                        </label>
                                        <textarea 
                                            value={obs.implication}
                                            onChange={e => onUpdate(obs.id, { implication: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[12px] text-gray-200 outline-none focus:border-rose-500/30 transition-all min-h-[50px] shadow-inner resize-y"
                                            placeholder="What is the potential financial or compliance impact?"
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            <div className="w-1 h-2.5 bg-brand-500 rounded-full" /> Audit Recommendation
                                        </label>
                                        <textarea 
                                            value={obs.recommendation}
                                            onChange={e => onUpdate(obs.id, { recommendation: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[12px] text-gray-200 outline-none focus:border-brand-500/30 transition-all min-h-[50px] shadow-inner resize-y"
                                            placeholder="Recommended corrective action / internal control improvement..."
                                        />
                                    </div>

                                    {/* A13: Management Response & Disposition Tracking */}
                                    <div className="space-y-2 md:col-span-2 pt-2 border-t border-white/5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                                <div className="w-1 h-2.5 bg-cyan-400 rounded-full" /> Management Response
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-gray-400 hover:text-white">
                                                <input 
                                                    type="checkbox"
                                                    checked={!!obs.communicated}
                                                    onChange={e => onUpdate(obs.id, { communicated: e.target.checked })}
                                                    disabled={isTaskCompleted || !canEditTask}
                                                    className="rounded border-gray-600 bg-white/5 text-brand-500 focus:ring-0"
                                                />
                                                <Send size={10} className="text-cyan-400" />
                                                <span>Communicated to Client</span>
                                            </label>
                                        </div>
                                        <textarea 
                                            value={obs.managementResponse || ''}
                                            onChange={e => onUpdate(obs.id, { managementResponse: e.target.value })}
                                            readOnly={isTaskCompleted || !canEditTask}
                                            className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[12px] text-gray-200 outline-none focus:border-cyan-500/30 transition-all min-h-[45px] shadow-inner resize-y"
                                            placeholder="Client management reply or action plan agreed upon..."
                                        />
                                    </div>

                                    {/* A13 Meta Row: WP Ref, Responsible Person, Target Date */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:col-span-2 bg-black/20 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <BookOpen size={12} className="text-gray-500 flex-shrink-0" />
                                            <input 
                                                type="text"
                                                value={obs.wpRef || ''}
                                                onChange={e => onUpdate(obs.id, { wpRef: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask}
                                                placeholder="WP Ref (e.g. B.3)"
                                                className="bg-transparent text-[11px] text-white border-b border-white/10 focus:border-brand-500 outline-none w-full py-0.5"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <User size={12} className="text-gray-500 flex-shrink-0" />
                                            <input 
                                                type="text"
                                                value={obs.owner || ''}
                                                onChange={e => onUpdate(obs.id, { owner: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask}
                                                placeholder="Responsible Person / Role"
                                                className="bg-transparent text-[11px] text-white border-b border-white/10 focus:border-brand-500 outline-none w-full py-0.5"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={12} className="text-gray-500 flex-shrink-0" />
                                            <input 
                                                type="text"
                                                value={obs.dueDate || ''}
                                                onChange={e => onUpdate(obs.id, { dueDate: e.target.value })}
                                                readOnly={isTaskCompleted || !canEditTask}
                                                placeholder="Agreed Date (YYYY-MM-DD)"
                                                className="bg-transparent text-[11px] text-white border-b border-white/10 focus:border-brand-500 outline-none w-full py-0.5"
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
