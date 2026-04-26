import React, { useState, useEffect } from 'react';
import { History, User, Clock, ShieldCheck, Activity, Trash2, ArrowRight } from 'lucide-react';
import { AuditLogEntry, AuditService } from '../../../services/AuditService';
import { formatDistanceToNow } from 'date-fns';

interface TaskHistoryTabProps {
    taskId: string;
}

const TaskHistoryTab: React.FC<TaskHistoryTabProps> = ({ taskId }) => {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const fetchedLogs = await AuditService.getLogsByTarget(taskId);
                setLogs(fetchedLogs);
            } catch (err) {
                console.error('Failed to fetch audit logs:', err);
            } finally {
                setLoading(false);
            }
        };

        if (taskId) fetchLogs();
    }, [taskId]);

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'TASK_CREATED': return <Activity className="text-emerald-500" size={14} />;
            case 'TASK_SIGN_OFF': return <ShieldCheck className="text-purple-500" size={14} />;
            case 'TASK_ARCHIVED': return <History className="text-amber-500" size={14} />;
            case 'TASK_STATUS_CHANGE': return <ArrowRight className="text-blue-500" size={14} />;
            case 'TASK_DELETED': return <Trash2 className="text-rose-500" size={14} />;
            default: return <Activity className="text-gray-500" size={14} />;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-4 p-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-white/5 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <History size={48} className="mb-4" />
                <p className="text-sm font-black uppercase tracking-widest">No history recorded yet</p>
                <p className="text-[10px] uppercase tracking-tighter mt-1">Audit logs will appear here as the task evolves</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1 mb-2">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/80">Blockchain-Verified Audit Trail</span>
            </div>
            
            <div className="relative space-y-0.5">
                {/* Vertical Line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-px bg-white/5" />

                {logs.map((log, idx) => {
                    let detailsObj: any = {};
                    try {
                        detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                    } catch (e) {
                        detailsObj = { message: log.details };
                    }

                    const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);

                    return (
                        <div key={log.id || idx} className="relative flex gap-4 p-3 rounded-2xl hover:bg-white/[0.02] transition-colors group">
                            <div className="z-10 w-14 h-14 rounded-2xl bg-[#0f1218] border border-white/5 flex items-center justify-center shrink-0 shadow-sm group-hover:border-white/10 transition-colors">
                                {getActionIcon(log.action)}
                            </div>
                            
                            <div className="flex-1 min-w-0 py-1">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-gray-200 truncate">
                                        {log.action.replace(/_/g, ' ')}
                                    </h5>
                                    <span className="text-[9px] font-medium text-gray-500 whitespace-nowrap">
                                        {formatDistanceToNow(date, { addSuffix: true })}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-[10px] text-gray-500 leading-relaxed">
                                        Action performed by <span className="text-gray-300 font-bold">{log.userName}</span>
                                    </p>
                                    
                                    {log.action === 'TASK_SIGN_OFF' && (
                                        <div className="flex items-center gap-2 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg w-fit">
                                            <ShieldCheck size={10} className="text-purple-400" />
                                            <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">
                                                {detailsObj.role} Layer Sealed
                                            </span>
                                        </div>
                                    )}

                                    {log.action === 'TASK_STATUS_CHANGE' && detailsObj.oldStatus && (
                                        <div className="flex items-center gap-2 text-[9px] font-bold text-gray-600">
                                            <span className="uppercase tracking-widest">{detailsObj.oldStatus}</span>
                                            <ArrowRight size={10} />
                                            <span className="uppercase tracking-widest text-brand-400">{detailsObj.newStatus}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TaskHistoryTab;
