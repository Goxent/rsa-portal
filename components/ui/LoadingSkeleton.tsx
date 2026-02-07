
import React from 'react';

interface LoadingSkeletonProps {
    className?: string;
    variant?: 'text' | 'card' | 'avatar' | 'button';
    count?: number;
}

/**
 * Loading skeleton component for displaying placeholder content
 */
const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
    className = '',
    variant = 'text',
    count = 1
}) => {
    const variantClasses = {
        text: 'h-4 w-full rounded',
        card: 'h-32 w-full rounded-xl',
        avatar: 'h-10 w-10 rounded-full',
        button: 'h-10 w-24 rounded-lg'
    };

    const skeletons = Array.from({ length: count }, (_, i) => (
        <div
            key={i}
            className={`animate-pulse bg-slate-700/50 ${variantClasses[variant]} ${className}`}
            style={{ animationDelay: `${i * 100}ms` }}
        />
    ));

    return count > 1 ? <>{skeletons}</> : skeletons[0];
};

/**
 * Full page loading state with centered spinner
 */
export const PageLoader: React.FC = () => (
    <div className="flex h-screen items-center justify-center bg-dark-900">
        <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto" />
            <p className="text-blue-400 animate-pulse">Loading...</p>
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

export default LoadingSkeleton;
