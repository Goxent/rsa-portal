
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
                <div className="glass-panel p-3 rounded-xl shadow-2xl backdrop-blur-md bg-gray-900/80 border-white/10">
                    <p className="font-bold text-white mb-1">{label}</p>
                    <p className="text-xs text-gray-400 mb-2">{payload[0].payload.role}</p>
                    <p className="text-sm text-brand-400">
                        {payload[0].value} Active Tasks
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="glass-panel hover-lift p-6 rounded-2xl border border-white/5 h-full flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users size={20} className="text-brand-400" />
                        Team Workload
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">
                        {staffStats.busy.length} staff active • {staffStats.free.length} available
                    </p>
                </div>
                {staffStats.free.length > 0 && (
                    <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium text-emerald-400">
                            {staffStats.free.length} Free
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
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                width={70}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar dataKey="tasks" radius={[0, 4, 4, 0]} barSize={24}>
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={
                                            entry.tasks > 8 ? '#ef4444' : // High load
                                                entry.tasks > 4 ? '#f59e0b' : // Medium load
                                                    '#3b82f6'                     // Low load
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 border border-dashed border-white/10 rounded-xl bg-white/5">
                    <Users size={24} className="mb-2 opacity-50" />
                    <p className="text-sm">No active workload data</p>
                </div>
            )}

            {/* Availability Footer */}
            {staffStats.free.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-gray-500 mb-2 uppercase font-bold tracking-wider">Available Staff</p>
                    <div className="flex flex-wrap gap-2">
                        {staffStats.free.slice(0, 4).map(staff => (
                            <span key={staff.uid} className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-300 hover:bg-white/10 transition-colors cursor-default">
                                {staff.displayName.split(' ')[0]}
                            </span>
                        ))}
                        {staffStats.free.length > 4 && (
                            <span className="text-xs px-2 py-1 bg-white/5 border border-white/10 rounded-md text-gray-500">
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
