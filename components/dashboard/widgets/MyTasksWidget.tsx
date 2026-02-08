import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Task } from '../../../types';

interface MyTasksWidgetProps {
    recentTasks?: Task[];
    userMap?: Record<string, any>;
}

const priorityConfig = {
    URGENT: { color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertTriangle },
    HIGH: { color: 'text-orange-400', bg: 'bg-orange-500/20', icon: Clock },
    MEDIUM: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Clock },
    LOW: { color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
};

const statusColors = {
    COMPLETED: 'bg-green-500',
    IN_PROGRESS: 'bg-blue-500',
    UNDER_REVIEW: 'bg-purple-500',
    NOT_STARTED: 'bg-gray-500',
    BLOCKED: 'bg-red-500',
};

const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({ recentTasks = [] }) => {
    const navigate = useNavigate();

    if (recentTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <CheckCircle size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No pending tasks</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {recentTasks.slice(0, 4).map((task) => {
                const priority = priorityConfig[task.priority] || priorityConfig.MEDIUM;
                const PriorityIcon = priority.icon;

                return (
                    <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                        onClick={() => navigate('/tasks')}
                    >
                        <div className={`p-2 rounded-lg ${priority.bg}`}>
                            <PriorityIcon size={16} className={priority.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-white truncate group-hover:text-brand-400 transition-colors">
                                {task.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-400">{task.clientName}</span>
                                <span className={`w-2 h-2 rounded-full ${statusColors[task.status as keyof typeof statusColors] || 'bg-gray-500'}`} />
                            </div>
                        </div>
                        <div className="text-xs text-gray-400">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                    </div>
                );
            })}

            <button
                onClick={() => navigate('/tasks')}
                className="flex items-center justify-center gap-2 w-full py-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
                View all tasks
                <ArrowRight size={14} />
            </button>
        </div>
    );
};

export default MyTasksWidget;
