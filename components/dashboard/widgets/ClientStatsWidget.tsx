import React from 'react';
import { Building2, BadgeCheck, Briefcase } from 'lucide-react';
import { WidgetConfig } from '../widgetTypes';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ClientStatsWidgetProps {
    widget: WidgetConfig;
    clientStats: {
        total: number;
        active: number;
        mySigned: number;
        byService: Record<string, number>;
    };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ClientStatsWidget: React.FC<ClientStatsWidgetProps> = ({ clientStats }) => {

    // Prepare data for Pie Chart
    const data = Object.entries(clientStats.byService || {})
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5); // Start with top 5

    // Group others
    const othersCount = Object.entries(clientStats.byService || {})
        .sort((a, b) => b[1] - a[1])
        .slice(5)
        .reduce((acc, curr) => acc + curr[1], 0);

    if (othersCount > 0) {
        data.push({ name: 'Others', value: othersCount });
    }

    return (
        <div className="h-full flex flex-col">
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 p-3 rounded-lg flex flex-col justify-center items-center text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold">Total Clients</p>
                    <p className="text-2xl font-bold text-white mt-1">{clientStats.total}</p>
                    <div className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full mt-1">
                        {clientStats.active} Active
                    </div>
                </div>
                <div className="bg-white/5 p-3 rounded-lg flex flex-col justify-center items-center text-center border border-amber-500/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-amber-500/5"></div>
                    <BadgeCheck size={16} className="text-amber-400 mb-1" />
                    <p className="text-xs text-amber-400 uppercase font-bold">My Signing</p>
                    <p className="text-2xl font-bold text-white mt-1 relative z-10">{clientStats.mySigned}</p>
                </div>
            </div>

            <div className="flex-1 min-h-[120px] relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.5)" />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                {data.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 text-xs">
                        <Building2 size={24} className="mb-2 opacity-50" />
                        No Data Available
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientStatsWidget;
