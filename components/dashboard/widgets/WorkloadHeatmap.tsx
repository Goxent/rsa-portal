
import React from 'react';
import { useTheme } from '../../../context/ThemeContext';
import { UserProfile } from '../../../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, AlertCircle } from 'lucide-react';

interface WorkloadHeatmapProps {
    staffStats: {
        busy: (UserProfile & { taskCount: number })[];
        free: UserProfile[];
    };
    totalTasks: number;
}

const WorkloadHeatmap: React.FC<WorkloadHeatmapProps> = ({ staffStats, totalTasks }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Prepare data for the chart
    // We'll show top 5 busiest staff
    const data = staffStats.busy
        .sort((a, b) => b.taskCount - a.taskCount)
        .slice(0, 5)
        .map(staff => ({
            name: staff.displayName.split(' ')[0], // First name only
            tasks: staff.taskCount,
            role: staff.role
        }));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="p-2.5 rounded-[var(--radius-md)] border text-xs shadow-md" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                    <p className="font-semibold mb-0.5" style={{ color: 'var(--text-heading)' }}>{label}</p>
                    <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>{payload[0].payload.role}</p>
                    <p className="font-medium" style={{ color: 'var(--accent)' }}>
                        {payload[0].value} active tasks
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="rounded-[var(--radius-lg)] border p-5 h-full flex flex-col transition-colors duration-150" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-start mb-5">
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-heading)' }}>
                        <Users size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                        Team workload
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {staffStats.busy.length} active · {staffStats.free.length} available
                    </p>
                </div>
                {staffStats.free.length > 0 && (
                    <div className="px-2.5 py-0.5 border rounded-full flex items-center gap-1.5" style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-accent)' }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                            {staffStats.free.length} free
                        </span>
                    </div>
                )}
            </div>

            {data.length > 0 ? (
                <div className="w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                                width={70}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-surface)' }} />
                            <Bar dataKey="tasks" radius={[0, 4, 4, 0]} barSize={20}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={
                                            entry.tasks > 8 ? 'var(--color-danger)' :
                                            entry.tasks > 4 ? 'var(--color-warning)' :
                                            'var(--accent)'
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border rounded-[var(--radius-md)] text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <Users size={22} strokeWidth={1.75} className="mb-2 opacity-40" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No active workload data</p>
                </div>
            )}

            {/* Availability Footer */}
            {staffStats.free.length > 0 && (
                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Available staff</p>
                    <div className="flex flex-wrap gap-1.5">
                        {staffStats.free.slice(0, 4).map(staff => (
                            <span key={staff.uid} className="text-xs px-2 py-0.5 border rounded-[var(--radius-sm)]" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-body)' }}>
                                {staff.displayName.split(' ')[0]}
                            </span>
                        ))}
                        {staffStats.free.length > 4 && (
                            <span className="text-xs px-2 py-0.5 border rounded-[var(--radius-sm)]" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                                +{staffStats.free.length - 4} more
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkloadHeatmap;
