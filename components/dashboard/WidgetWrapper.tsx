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
        ${getWidgetSizeClasses(widget.size)}
        ${isDragging ? 'z-50 opacity-80 scale-105' : 'z-0'}
        transition-all duration-200
      `}
        >
            <div
                className={`
          glass-panel rounded-2xl overflow-hidden h-full
          ${isDragging ? 'shadow-2xl ring-2 ring-brand-500' : ''}
          ${isEditing ? 'ring-1 ring-dashed ring-white/20' : ''}
        `}
            >
                {/* Widget Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                        {isEditing && (
                            <button
                                {...attributes}
                                {...listeners}
                                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-white/10 transition-colors"
                            >
                                <GripVertical size={16} className="text-gray-400" />
                            </button>
                        )}
                        <h3 className="text-sm font-semibold text-white">{widget.title}</h3>
                    </div>

                    {isEditing && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onResize?.(widget.id)}
                                className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                                title="Resize widget"
                            >
                                {widget.size === 'lg' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                            </button>
                            <button
                                onClick={() => onRemove?.(widget.id)}
                                className="p-1.5 rounded hover:bg-red-500/20 transition-colors text-gray-400 hover:text-red-400"
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
