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
                    relative w-full h-full rounded-xl overflow-hidden
                    bg-secondary border border-border shadow-card
                    transition-all duration-300
                    ${!isDragging ? 'hover:border-[rgba(101,154,43,0.35)] hover:shadow-[0_8px_32px_var(--accent-glow)]' : ''}
                    ${isDragging ? 'shadow-2xl ring-2 ring-accent/30 scale-[1.02] z-50 bg-surface' : ''}
                    ${isEditing ? 'ring-2 ring-dashed ring-accent/30' : ''}
                `}
                style={{
                    background: 'radial-gradient(circle at top right, rgba(101,154,43,0.06) 0%, var(--bg-secondary) 100%)'
                }}
            >
                {/* Widget Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
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
                        {/* Category indicator */}
                        <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]" />
                        <h3 className="text-[11px] font-bold text-accent dark:text-brand-400 uppercase tracking-[0.12em]">{widget.title}</h3>
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
                <div className="p-4 h-[calc(100%-45px)] overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default WidgetWrapper;
