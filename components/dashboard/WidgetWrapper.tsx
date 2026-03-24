import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Maximize2, Minimize2, Settings } from 'lucide-react';
import { WidgetConfig, getWidgetSizeClasses } from './widgetTypes';

interface WidgetWrapperProps {
    widget: WidgetConfig;
    children: React.ReactNode;
    onRemove?: (id: string) => void;
    onResize?: (id: string) => void;
    isEditing?: boolean;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
    widget,
    children,
    onRemove,
    onResize,
    isEditing = false,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: widget.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
        relative group
        ${getWidgetSizeClasses(widget.size)}
        ${isDragging ? 'z-50 opacity-80 scale-105' : 'z-0 focus-within:z-[999]'}
        transition-all duration-200
      `}
        >
            <div
                className={`
          relative w-full h-full rounded-2xl overflow-hidden
          glass-panel ${!isDragging ? 'hover-lift' : ''}
          ${isDragging ? 'shadow-[0_20px_60px_rgba(0,0,0,0.5)] ring-2 ring-brand-500/50 scale-105 z-50 !bg-white/5 dark:!bg-black/40' : ''}
          ${isEditing ? 'ring-2 ring-dashed ring-amber-500/30 !border-transparent' : ''}
        `}
            >
                {/* Subtle top glow line for premium feel */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent"></div>

                {/* Widget Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/50 dark:border-white/[0.05] bg-white/40 dark:bg-white/[0.01]">
                    <div className="flex items-center gap-2.5">
                        {isEditing && (
                            <button
                                {...attributes}
                                {...listeners}
                                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            >
                                <GripVertical size={16} className="text-slate-400 dark:text-gray-500" />
                            </button>
                        )}
                        <h3 className="text-[13px] font-bold tracking-wide text-slate-800 dark:text-gray-200 uppercase">{widget.title}</h3>
                    </div>

                    {isEditing && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onResize?.(widget.id)}
                                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                                title="Resize widget"
                            >
                                {widget.size === 'lg' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                            <button
                                onClick={() => onRemove?.(widget.id)}
                                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/20 transition-colors text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                title="Remove widget"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Widget Content */}
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default WidgetWrapper;
