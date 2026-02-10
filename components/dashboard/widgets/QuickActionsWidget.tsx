import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Clock,
    Users,
    FileText,
    Calendar,
    CheckSquare
} from 'lucide-react';

interface QuickActionsWidgetProps { }

const QuickActionsWidget: React.FC<QuickActionsWidgetProps> = () => {
    const navigate = useNavigate();

    const actions = [
        { icon: Plus, label: 'New Task', path: '/tasks', color: 'bg-brand-500 hover:bg-brand-400' },
        { icon: Clock, label: 'Clock In', path: '/attendance', color: 'bg-green-500 hover:bg-green-400' },
        { icon: FileText, label: 'Resources', path: '/resources', color: 'bg-orange-500 hover:bg-orange-400' },
        { icon: Calendar, label: 'Calendar', path: '/calendar', color: 'bg-cyan-500 hover:bg-cyan-400' },
        { icon: CheckSquare, label: 'Tasks', path: '/tasks', color: 'bg-pink-500 hover:bg-pink-400' },
    ];

    return (
        <div className="grid grid-cols-3 gap-2">
            {actions.map((action) => (
                <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className={`
            flex flex-col items-center justify-center p-3 rounded-xl
            ${action.color} text-white transition-all transform hover:scale-105
            shadow-lg
          `}
                >
                    <action.icon size={20} className="mb-1" />
                    <span className="text-xs font-medium">{action.label}</span>
                </button>
            ))}
        </div>
    );
};

export default QuickActionsWidget;
