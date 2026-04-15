
import React from 'react';

interface LoadingSkeletonProps {
    className?: string;
    variant?: 'text-sm' | 'text-lg' | 'card' | 'row' | 'avatar';
    count?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
    className = '',
    variant = 'text-sm',
    count = 1
}) => {
    const variantClasses = {
        'text-sm': 'h-3.5 w-full rounded-full',
        'text-lg': 'h-5 w-[60%] rounded-full',
        card: 'h-[120px] w-full rounded-[var(--radius-lg)]',
        row: 'h-[44px] w-full rounded-[var(--radius-md)]',
        avatar: 'h-9 w-9 rounded-full'
    };

    const skeletons = Array.from({ length: count }, (_, i) => (
        <div
            key={i}
            className={`skeleton ${variantClasses[variant]} ${className}`}
        />
    ));

    if (count > 1) {
        return (
            <div className="stagger-children w-full">
                {skeletons}
            </div>
        );
    }

    return skeletons[0];
};

import RSALogo from '../common/RSALogo';

/**
 * Full page loading state with premium brand entrance
 */
export const PageLoader: React.FC = () => (
    <div className="flex flex-col h-screen items-center justify-center bg-main animate-in fade-in duration-500">
        <div className="text-center space-y-8">
            <RSALogo size="lg" animated className="mx-auto scale-125" />
            <div className="space-y-3">
                <p className="text-accent text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
                    R. Sapkota & Associates
                </p>
                <div className="flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-bounce" />
                </div>
            </div>
        </div>
    </div>
);

/**
 * Dashboard skeleton loader
 */
export const DashboardSkeleton: React.FC = () => (
    <div className="space-y-6 animate-fade-in">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card p-6">
                    <LoadingSkeleton variant="text" className="w-20 mb-3" />
                    <LoadingSkeleton variant="text" className="h-8 w-16 mb-2" />
                    <LoadingSkeleton variant="text" className="w-24" />
                </div>
            ))}
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <LoadingSkeleton variant="card" className="h-64" />
            </div>
            <div>
                <LoadingSkeleton variant="card" className="h-64" />
            </div>
        </div>
    </div>
);

/**
 * Task list skeleton loader
 */
export const TaskListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
    <div className="space-y-3">
        {[...Array(count)].map((_, i) => (
            <div key={i} className="glass-card p-4 flex gap-4 items-center">
                <LoadingSkeleton variant="avatar" />
                <div className="flex-1 space-y-2">
                    <LoadingSkeleton variant="text" className="w-3/4" />
                    <LoadingSkeleton variant="text" className="w-1/2 h-3" />
                </div>
                <LoadingSkeleton variant="button" className="w-16" />
            </div>
        ))}
    </div>
);

/**
 * Client card skeleton loader
 */
export const ClientCardSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(count)].map((_, i) => (
            <div key={i} className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <LoadingSkeleton variant="avatar" className="w-12 h-12" />
                    <div className="flex-1 space-y-2">
                        <LoadingSkeleton variant="text" className="w-2/3" />
                        <LoadingSkeleton variant="text" className="w-1/3 h-3" />
                    </div>
                </div>
                <div className="space-y-2">
                    <LoadingSkeleton variant="text" className="w-full h-3" />
                    <LoadingSkeleton variant="text" className="w-4/5 h-3" />
                </div>
                <div className="flex gap-2">
                    <LoadingSkeleton variant="button" className="flex-1" />
                    <LoadingSkeleton variant="button" className="w-10" />
                </div>
            </div>
        ))}
    </div>
);

/**
 * Table skeleton loader
 */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
    rows = 5,
    cols = 4
}) => (
    <div className="space-y-2">
        {/* Header */}
        <div className="flex gap-4 p-4 border-b border-white/10">
            {[...Array(cols)].map((_, i) => (
                <LoadingSkeleton key={i} variant="text" className={`h-4 ${i === 0 ? 'w-1/3' : 'w-1/6'}`} />
            ))}
        </div>
        {/* Rows */}
        {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border-b border-white/5">
                {[...Array(cols)].map((_, j) => (
                    <LoadingSkeleton key={j} variant="text" className={`h-4 ${j === 0 ? 'w-1/3' : 'w-1/6'}`} />
                ))}
            </div>
        ))}
    </div>
);

/**
 * Individual Dashboard Widget Skeleton
 */
export const DashboardWidgetSkeleton: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
    <div className={`glass-card p-6 flex flex-col space-y-4 ${height} w-full`}>
        <div className="flex justify-between items-center">
            <LoadingSkeleton variant="text" className="w-1/3 h-5" />
            <LoadingSkeleton variant="button" className="w-8 h-8 rounded-lg" />
        </div>
        <div className="flex-1 flex items-center justify-center">
            <LoadingSkeleton variant="text" className="w-full h-full opacity-10 rounded-lg" />
        </div>
    </div>
);

/**
 * Metric Card Skeleton (Small)
 */
export const MetricSkeleton: React.FC = () => (
    <div className="glass-card p-5 flex items-center justify-between">
        <div className="space-y-2 w-1/2">
            <LoadingSkeleton variant="text" className="w-12 h-3" />
            <LoadingSkeleton variant="text" className="w-20 h-6" />
        </div>
        <LoadingSkeleton variant="avatar" className="w-10 h-10 rounded-lg" />
    </div>
);

export default LoadingSkeleton;

