import React from 'react';

interface SkeletonCardProps {
    lines?: number;     // number of text line placeholders (default 3)
    hasAvatar?: boolean; // show a circular avatar placeholder on the left
    height?: number;    // card height in px (default auto)
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
    lines = 3,
    hasAvatar = false,
    height
}) => {
    return (
        <div
            className="flex gap-4 p-4 rounded-[20px] skeleton-bg border border-white/5"
            style={{ height: height ? `${height}px` : 'auto' }}
        >
            {hasAvatar && (
                <div className="w-12 h-12 rounded-full skeleton-pulse flex-shrink-0" />
            )}
            <div className="flex-1 flex flex-col justify-center gap-3 w-full">
                {Array.from({ length: lines }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-3 rounded skeleton-pulse ${
                            i === 0 ? 'w-3/4' : i === lines - 1 ? 'w-1/2' : 'w-full'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};
