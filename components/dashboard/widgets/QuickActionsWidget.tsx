import React, { useState } from 'react';
import { Plus, Users, Calendar, LogIn, LogOut, FileText, CheckSquare, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-hot-toast';

const QuickActionsWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Simple state to simulate loading/action if needed
    const [loading, setLoading] = useState<string | null>(null);

    const actions = [
        {
            id: 'new_task',
            label: 'New Task',
            icon: CheckSquare,
            color: 'bg-blue-500',
            onClick: () => navigate('/tasks') // Ideally opens a modal, but nav for now
        },
        {
            id: 'add_client',
            label: 'Add Client',
            icon: Users,
            color: 'bg-emerald-500',
            onClick: () => navigate('/clients')
        },
        {
            id: 'calendar',
            label: 'Schedule',
            icon: Calendar,
            color: 'bg-purple-500',
            onClick: () => navigate('/calendar')
        },
        {
            id: 'attendance',
            label: 'Attend.',
            icon: Zap,
            color: 'bg-amber-500',
            onClick: () => {
                const element = document.getElementById('attendance-widget-root');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                    element.classList.add('ring-2', 'ring-brand-500');
                    setTimeout(() => element.classList.remove('ring-2', 'ring-brand-500'), 2000);
                } else {
                    navigate('/attendance');
                }
            }
        },
        {
            id: 'resources',
            label: 'Library',
            icon: FileText,
            color: 'bg-pink-500',
            onClick: () => navigate('/knowledge-base')
        }
    ];

    const handleAction = async (action: any) => {
        setLoading(action.id);
        try {
            await action.onClick();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="grid grid-cols-5 gap-2 h-full items-center">
            {actions.map(action => (
                <button
                    key={action.id}
                    onClick={() => handleAction(action)}
                    disabled={!!loading}
                    className="flex flex-col items-center justify-center gap-2 group p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                    <div className={`p-3 rounded-xl text-white shadow-lg shadow-black/20 group-hover:scale-110 transition-transform ${action.color}`}>
                        <action.icon size={20} />
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium group-hover:text-white transition-colors">
                        {action.label}
                    </span>
                </button>
            ))}
        </div>
    );
};

export default QuickActionsWidget;
