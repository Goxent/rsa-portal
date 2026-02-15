import React, { useMemo, useState } from 'react';
import { Task, UserProfile } from '../../types';
import { ChevronLeft, ChevronRight, AlertCircle, Calendar } from 'lucide-react';

interface StaffCapacityHeatmapProps {
    users: UserProfile[];
    tasks: Task[];
}

const StaffCapacityHeatmap: React.FC<StaffCapacityHeatmapProps> = ({ users, tasks }) => {
    const [viewMode, setViewMode] = useState<'WEEK' | 'MONTH'>('WEEK'); // Future expansion
    const [startDate, setStartDate] = useState(new Date());

    // Helper to get start of week (Sunday)
    const getStartOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday start if needed, currently Sunday
        return new Date(date.setDate(date.getDate() - day));
    };

    // Generate 4 weeks from start date
    const weeks = useMemo(() => {
        const start = getStartOfWeek(startDate);
        const w = [];
        for (let i = 0; i < 6; i++) { // Show 6 weeks
            const d = new Date(start);
            d.setDate(d.getDate() + (i * 7));
            w.push(d);
        }
        return w;
    }, [startDate]);

    // Calculate Capacity
    const capacityData = useMemo(() => {
        const data = new Map<string, Map<string, number>>(); // UserId -> WeekStr -> TaskCount

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

            // Find which week this task belongs to
            const taskWeekStart = getStartOfWeek(taskDate);
            const weekStr = taskWeekStart.toISOString().split('T')[0];

            task.assignedTo.forEach(uid => {
                const userMap = data.get(uid);
                if (userMap && userMap.has(weekStr)) {
                    // Increment task count for this user in this week
                    userMap.set(weekStr, userMap.get(weekStr)! + 1);
                }
            });
        });

        return data;
    }, [users, tasks, weeks]);

    const getCellColor = (count: number) => {
        if (count === 0) return 'bg-white/5 text-gray-500';
        if (count <= 3) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'; // Light load
        if (count <= 6) return 'bg-blue-500/20 text-blue-300 border-blue-500/30'; // Optimal
        if (count <= 9) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'; // Heavy
        return 'bg-red-500/20 text-red-300 border-red-500/30 font-bold'; // Overload
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
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-2">
                    <Calendar className="text-blue-400" size={18} />
                    <h3 className="font-bold text-gray-200">Staff Task Workload Grid</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrev} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-mono text-gray-400 min-w-[100px] text-center">
                        {weeks[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -
                        {weeks[weeks.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <button onClick={handleNext} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500/20 border border-emerald-500/30 rounded"></div> 1-3</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500/20 border border-blue-500/30 rounded"></div> 4-6</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500/20 border border-amber-500/30 rounded"></div> 7-9</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500/20 border border-red-500/30 rounded"></div> 10+</div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-navy-900/50 sticky top-0 z-10 backdrop-blur-sm">
                            <th className="p-3 font-medium text-gray-400 text-sm border-b border-white/10 min-w-[200px] sticky left-0 bg-navy-900 z-20">Staff Member</th>
                            {weeks.map((w, i) => (
                                <th key={i} className="p-3 font-mono text-xs text-gray-400 border-b border-l border-white/10 text-center min-w-[100px]">
                                    W/C {w.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => {
                            const userWeeks = capacityData.get(user.uid);
                            return (
                                <tr key={user.uid} className="hover:bg-white/5 transition-colors border-b border-white/5">
                                    <td className="p-3 sticky left-0 bg-navy-900 border-r border-white/10 z-10 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-navy-800 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-300">
                                            {user.displayName?.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-200">{user.displayName}</div>
                                            <div className="text-xs text-gray-500">{user.position || 'Staff'}</div>
                                        </div>
                                    </td>
                                    {weeks.map((w, i) => {
                                        const dateStr = w.toISOString().split('T')[0];
                                        const count = userWeeks?.get(dateStr) || 0;
                                        return (
                                            <td key={i} className="p-1 border-l border-white/5 relative group">
                                                <div className={`h-12 rounded-lg flex items-center justify-center text-xs font-bold border transition-all ${getCellColor(count)}`}>
                                                    {count > 0 ? `${count} Tasks` : '-'}
                                                </div>
                                                {count > 0 && (
                                                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 bg-navy-900 text-white text-xs p-2 rounded shadow-lg pointer-events-none z-30 whitespace-nowrap border border-white/10">
                                                        Active Tasks: {count}
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
