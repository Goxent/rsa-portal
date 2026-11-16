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
            case 'TASK_CREATED': return <Activity className="text-[var(--color-success)]" size={14} />;
            case 'TASK_SIGN_OFF': return <ShieldCheck className="text-[var(--accent)]" size={14} />;
            case 'TASK_ARCHIVED': return <History className="text-[var(--color-warning)]" size={14} />;
            case 'TASK_STATUS_CHANGE': return <ArrowRight className="text-[var(--color-info)]" size={14} />;
            case 'TASK_DELETED': return <Trash2 className="text-[var(--color-danger)]" size={14} />;
            default: return <Activity className="text-[var(--text-muted)]" size={14} />;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col gap-3 p-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)]" />
                ))}
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <History size={36} className="text-[var(--text-muted)] opacity-30 mb-3" />
                <p className="text-xs font-semibold text-[var(--text-heading)]">No history recorded yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">Audit logs will appear here as the task evolves</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 px-1 mb-1">
                <ShieldCheck size={15} className="text-[var(--accent)]" />
                <span className="text-xs font-semibold text-[var(--text-heading)]">Audit trail</span>
            </div>
            
            <div className="relative space-y-1">
                {/* Vertical Line */}
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-[var(--border)]" />

                {logs.map((log, idx) => {
                    let detailsObj: any = {};
                    try {
                        detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                    } catch (e) {
                        detailsObj = { message: log.details };
                    }

                    const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);

                    return (
                        <div key={log.id || idx} className="relative flex gap-3 p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--bg-surface)] transition-colors group">
                            <div className="z-10 w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center shrink-0">
                                {getActionIcon(log.action)}
                            </div>
                            
                            <div className="flex-1 min-w-0 py-0.5">
                                <div className="flex items-center justify-between gap-2">
                                    <h5 className="text-xs font-semibold text-[var(--text-heading)] capitalize truncate">
                                        {log.action.replace(/_/g, ' ').toLowerCase()}
                                    </h5>
                                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                                        {formatDistanceToNow(date, { addSuffix: true })}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col gap-1 mt-0.5">
                                    <p className="text-xs text-[var(--text-muted)]">
                                        Action performed by <span className="text-[var(--text-secondary)] font-medium">{log.userName}</span>
                                    </p>
                                    
                                    {log.action === 'TASK_SIGN_OFF' && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] border w-fit" style={{ background: 'rgba(79,178,134,0.1)', borderColor: 'rgba(79,178,134,0.25)', color: 'var(--color-success)' }}>
                                            <ShieldCheck size={11} />
                                            <span className="text-[10px] font-medium">
                                                {detailsObj.role} layer sealed
                                            </span>
                                        </div>
                                    )}

                                    {log.action === 'TASK_STATUS_CHANGE' && detailsObj.oldStatus && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-medium">
                                            <span>{detailsObj.oldStatus.replace(/_/g, ' ').toLowerCase()}</span>
                                            <ArrowRight size={10} />
                                            <span className="text-[var(--accent)]">{detailsObj.newStatus.replace(/_/g, ' ').toLowerCase()}</span>
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
