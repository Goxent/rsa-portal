import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`empty-state ${className}`}>
            <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center mb-5 shadow-sm">
                <Icon size={28} className="text-accent opacity-70" />
            </div>
            <h3 className="empty-state-title">{title}</h3>
            <p className="empty-state-desc max-w-sm">
                {description}
            </p>
            {action && (
                <button
                    onClick={action.onClick}
                    className="btn-primary mt-5"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};

export default EmptyState;
