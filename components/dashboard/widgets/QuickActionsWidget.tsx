import React, { useState } from 'react';
import {
    CheckSquare, Users, Calendar, Zap, FileText,
    LayoutDashboard, UserCheck, BarChart2, Settings,
    ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { UserRole } from '../../../types';

interface ActionItem {
    id: string;
    label: string;
    description: string;
    icon: React.ElementType;
    gradient: string;
    path: string;
    adminOnly?: boolean;
    badge?: string;
}

const ALL_ACTIONS: ActionItem[] = [
    {
        id: 'tasks',
        label: 'My Tasks',
        description: 'View & manage tasks',
        icon: CheckSquare,
        gradient: 'from-brand-600 to-indigo-600',
        path: '/tasks',
    },
    {
        id: 'attendance',
        label: 'Attendance',
        description: 'Clock in / out',
        icon: UserCheck,
        gradient: 'from-emerald-600 to-teal-600',
        path: '/attendance',
    },
    {
        id: 'calendar',
        label: 'Calendar',
        description: 'Schedule & events',
        icon: Calendar,
        gradient: 'from-purple-600 to-violet-600',
        path: '/calendar',
    },
    {
        id: 'knowledge',
        label: 'Knowledge Base',
        description: 'Docs & resources',
        icon: FileText,
        gradient: 'from-pink-600 to-rose-600',
        path: '/knowledge-base',
    },
    {
        id: 'clients',
        label: 'Clients',
        description: 'Client directory',
        icon: Users,
        gradient: 'from-amber-600 to-orange-600',
        path: '/clients',
        adminOnly: true,
    },
    {
        id: 'resource-planning',
        label: 'Resource Plan',
        description: 'Team workload',
        icon: BarChart2,
        gradient: 'from-cyan-600 to-blue-600',
        path: '/resource-planning',
        adminOnly: true,
    },
    {
        id: 'staff',
        label: 'Staff',
        description: 'Team directory',
        icon: Users,
        gradient: 'from-violet-600 to-purple-600',
        path: '/staff',
        adminOnly: true,
    },
];

const QuickActionsWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER_ADMIN;

    const visibleActions = ALL_ACTIONS.filter(a => !a.adminOnly || isAdmin);

    return (
        <div className="space-y-1.5">
            {/* Role badge */}
            <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest border ${isAdmin
                        ? 'bg-brand-500/15 border-brand-500/25 text-brand-300'
                        : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
                    }`}>
                    {isAdmin ? '⚡ Admin View' : '👤 Staff View'}
                </span>
                <span className="text-[10px] text-gray-600">{visibleActions.length} shortcuts</span>
            </div>

            {/* Action grid */}
            <div className="grid grid-cols-2 gap-2">
                {visibleActions.map(action => {
                    const Icon = action.icon;
                    return (
                        <button
                            key={action.id}
                            onClick={() => navigate(action.path)}
                            className="group flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/8 hover:border-white/18 transition-all duration-200 text-left hover:scale-[1.02]"
                        >
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${action.gradient} shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
                                <Icon size={14} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">{action.label}</div>
                                <div className="text-[10px] text-gray-500 truncate">{action.description}</div>
                            </div>
                            <ChevronRight size={12} className="text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default QuickActionsWidget;
