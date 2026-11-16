import React, { useMemo, useState } from 'react';
import { Task, UserProfile } from '../../types';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface StaffCapacityHeatmapProps {
    users: UserProfile[];
    tasks: Task[];
}

const StaffCapacityHeatmap: React.FC<StaffCapacityHeatmapProps> = ({ users, tasks }) => {
    const [startDate, setStartDate] = useState(new Date());

    // Helper to get start of week (Sunday)
    const getStartOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        return new Date(date.setDate(date.getDate() - day));
    };

    // Generate 6 weeks from start date
    const weeks = useMemo(() => {
        const start = getStartOfWeek(startDate);
        const w = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + (i * 7));
            w.push(d);
        }
        return w;
    }, [startDate]);

    // Calculate Capacity
    const capacityData = useMemo(() => {
        const data = new Map<string, Map<string, number>>();

        users.forEach(u => {
            data.set(u.uid, new Map());
            weeks.forEach(w => {
                data.get(u.uid)!.set(w.toISOString().split('T')[0], 0);
            });
        });

        tasks.forEach(task => {
            if (!task.dueDate || !task.assignedTo || task.assignedTo.length === 0 ||
                task.status === 'COMPLETED' || task.status === 'HALTED') return;

            const taskDate = new Date(task.dueDate);
            const taskWeekStart = getStartOfWeek(taskDate);
            const weekStr = taskWeekStart.toISOString().split('T')[0];

            task.assignedTo.forEach(uid => {
                const userMap = data.get(uid);
                if (userMap && userMap.has(weekStr)) {
                    userMap.set(weekStr, userMap.get(weekStr)! + 1);
                }
            });
        });

        return data;
    }, [users, tasks, weeks]);

    const getCellColor = (count: number) => {
        if (count === 0) return 'bg-[var(--bg-secondary)] text-[var(--text-subtle)] border-transparent';
        if (count <= 3) return 'bg-[rgba(79,178,134,0.1)] text-[var(--color-success)] border-[rgba(79,178,134,0.25)]';
        if (count <= 6) return 'bg-[rgba(106,163,217,0.1)] text-[var(--color-info)] border-[rgba(106,163,217,0.25)]';
        if (count <= 9) return 'bg-[rgba(217,164,65,0.12)] text-[var(--color-warning)] border-[rgba(217,164,65,0.3)]';
        return 'bg-[rgba(224,112,122,0.12)] text-[var(--color-danger)] border-[rgba(224,112,122,0.3)] font-semibold';
    };

    const handleNext = () => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + 7);
        setStartDate(d);
    };

    const handlePrev = () => {
        const d = new Date(startDate);
        d.setDate(d.getDate() - 7);
        setStartDate(d);
    };

    return (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] overflow-hidden flex flex-col h-full">
            <div className="p-3.5 border-b border-[var(--border)] flex flex-wrap justify-between items-center gap-3 bg-[var(--bg-main)]">
                <div className="flex items-center gap-2">
                    <Calendar className="text-[var(--accent)]" size={16} />
                    <h3 className="text-sm font-semibold text-[var(--text-heading)]">Staff task workload grid</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrev} className="p-1 hover:bg-[var(--accent-dim)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors">
                        <ChevronLeft size={18} />
                    </button>
                    <span className="text-xs font-medium tabular-nums text-[var(--text-muted)] min-w-[120px] text-center">
                        {weeks[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weeks[weeks.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <button onClick={handleNext} className="p-1 hover:bg-[var(--accent-dim)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-heading)] transition-colors">
                        <ChevronRight size={18} />
                    </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[rgba(79,178,134,0.15)] border border-[rgba(79,178,134,0.3)] rounded-sm"></div> 1–3</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[rgba(106,163,217,0.15)] border border-[rgba(106,163,217,0.3)] rounded-sm"></div> 4–6</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[rgba(217,164,65,0.15)] border border-[rgba(217,164,65,0.3)] rounded-sm"></div> 7–9</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-[rgba(224,112,122,0.15)] border border-[rgba(224,112,122,0.3)] rounded-sm"></div> 10+</div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[var(--bg-secondary)] sticky top-0 z-10 border-b border-[var(--border)]">
                            <th className="p-3 font-medium text-[var(--text-muted)] text-xs border-b border-[var(--border)] min-w-[200px] sticky left-0 bg-[var(--bg-secondary)] z-20">Staff member</th>
                            {weeks.map((w, i) => (
                                <th key={i} className="p-3 text-xs font-medium text-[var(--text-muted)] tabular-nums border-b border-l border-[var(--border)] text-center min-w-[100px]">
                                    W/C {w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => {
                            const userWeeks = capacityData.get(user.uid);
                            return (
                                <tr key={user.uid} className="hover:bg-[var(--accent-dim)] transition-colors border-b border-[var(--border)]">
                                    <td className="p-3 sticky left-0 bg-[var(--bg-surface)] border-r border-[var(--border)] z-10 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-xs font-semibold text-[var(--text-heading)]">
                                            {user.displayName?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-[var(--text-heading)]">{user.displayName}</div>
                                            <div className="text-xs text-[var(--text-muted)]">{user.position || 'Staff'}</div>
                                        </div>
                                    </td>
                                    {weeks.map((w, i) => {
                                        const dateStr = w.toISOString().split('T')[0];
                                        const count = userWeeks?.get(dateStr) || 0;
                                        return (
                                            <td key={i} className="p-1 border-l border-[var(--border)] relative group">
                                                <div className={`h-11 rounded-md flex items-center justify-center text-xs tabular-nums border transition-colors ${getCellColor(count)}`}>
                                                    {count > 0 ? `${count} tasks` : '—'}
                                                </div>
                                                {count > 0 && (
                                                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-[var(--bg-elevated)] text-[var(--text-heading)] text-xs py-1 px-2.5 rounded-md shadow-md pointer-events-none z-30 whitespace-nowrap border border-[var(--border)]">
                                                        Active tasks: {count}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StaffCapacityHeatmap;
