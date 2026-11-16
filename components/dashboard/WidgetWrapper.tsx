import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Maximize2, Minimize2 } from 'lucide-react';
import { WidgetConfig, getWidgetSizeClasses, WIDGET_REGISTRY } from './widgetTypes';

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

    // Resolve category from registry
    const meta = WIDGET_REGISTRY.find(m => m.type === widget.type);
    const category = meta?.category ?? 'tasks';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                relative group
                ${getWidgetSizeClasses(widget.size)}
                ${isDragging ? 'z-50 opacity-80 scale-[1.02]' : 'z-0 focus-within:z-[50]'}
                transition-all duration-200
            `}
        >
            <div
                className={`
                    relative w-full h-full rounded-[var(--radius-lg)] overflow-hidden
                    bg-secondary border border-border shadow-card
                    transition-colors duration-150
                    ${!isDragging ? 'hover:border-[var(--border-mid)]' : ''}
                    ${isDragging ? 'shadow-2xl ring-2 ring-accent/30 scale-[1.01] z-50 bg-surface' : ''}
                    ${isEditing ? 'ring-2 ring-dashed ring-accent/30' : ''}
                `}
            >
                {/* Widget Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                    <div className="flex items-center gap-2.5">
                        {isEditing && (
                            <button
                                {...attributes}
                                {...listeners}
                                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-border transition-colors"
                            >
                                <GripVertical size={14} className="text-muted" />
                            </button>
                        )}
                        <h3 className="text-[0.8125rem] font-semibold text-heading tracking-[-0.005em]">{widget.title}</h3>
                    </div>

                    {isEditing && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onResize?.(widget.id)}
                                className="p-1.5 rounded hover:bg-border transition-colors text-muted hover:text-heading"
                                title="Resize widget"
                            >
                                {widget.size === 'lg' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                            </button>
                            <button
                                onClick={() => onRemove?.(widget.id)}
                                className="p-1.5 rounded hover:bg-status-halted-dim transition-colors text-muted hover:text-status-halted"
                                title="Remove widget"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Widget Content */}
                <div className="p-4 h-[calc(100%-49px)] overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default WidgetWrapper;
