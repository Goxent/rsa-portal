import React from 'react';
import { TrendingUp, Users, AlertCircle, CheckCircle, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ImpactStatsWidgetProps {
    clientStats: { total: number; active: number; mySigned: number };
    taskData: { name: string; value: number }[];
    staffStats?: { busy: any[]; free: any[] };
    isLoading?: boolean;
}

const ImpactStatsWidget: React.FC<ImpactStatsWidgetProps> = ({ clientStats, taskData, staffStats, isLoading }) => {
    if (isLoading) return <div className="animate-pulse h-32 bg-white/5 rounded-xl"></div>;

    const totalTasks = taskData.reduce((acc, curr) => acc + curr.value, 0);
    const completedTasks = taskData.find(t => t.name === 'Completed')?.value || 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const stats = [
        {
            label: 'Total Clients',
            value: clientStats.total,
            subValue: `${clientStats.active} Active`,
            icon: Users,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            trend: '+12%', // Mock trend for now
            trendUp: true
        },
        {
            label: 'Task Completion',
            value: `${completionRate}%`,
            subValue: `${completedTasks} / ${totalTasks} Tasks`,
            icon: CheckCircle,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            trend: '+5%',
            trendUp: true
        },
        {
            label: 'Pending Actions',
            value: taskData.find(t => t.name === 'Pending')?.value || 0,
            subValue: 'Requires Attention',
            icon: AlertCircle,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            trend: '-2%',
            trendUp: false
        },
        {
            label: 'Est. Revenue', // Placeholder for future integration
            value: 'NPR 2.4L',
            subValue: 'This Month',
            icon: Wallet,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            trend: '+8%',
            trendUp: true
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, idx) => (
                <div key={idx} className="glass-card p-4 rounded-xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl ${stat.bg} ${stat.color} opacity-50`}>
                        <stat.icon size={20} />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                            <span className={`text-xs flex items-center ${stat.trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {stat.trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {stat.trend}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{stat.subValue}</p>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                </div>
            ))}
        </div>
    );
};

export default ImpactStatsWidget;
