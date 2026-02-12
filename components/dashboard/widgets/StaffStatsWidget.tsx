import React from 'react';
import { Users, Briefcase } from 'lucide-react';
import { WidgetConfig } from '../widgetTypes';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface StaffStatsWidgetProps {
    widget: WidgetConfig;
    staffStats: {
        byDepartment: Record<string, number>;
    };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const StaffStatsWidget: React.FC<StaffStatsWidgetProps> = ({ staffStats }) => {

    const data = Object.entries(staffStats.byDepartment || {})
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const totalStaff = data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="bg-brand-500/20 p-2 rounded-lg">
                        <Users size={16} className="text-brand-400" />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-white leading-none">{totalStaff}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold">Total Staff</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-[120px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={80}
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                {data.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 text-xs">
                        <Briefcase size={24} className="mb-2 opacity-50" />
                        No Department Data
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffStatsWidget;
