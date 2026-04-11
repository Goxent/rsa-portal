import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import { AuthService } from '../../services/firebase';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus, Edit3, Save, X } from 'lucide-react';
import { WidgetConfig, WIDGET_REGISTRY, getDefaultWidgetConfig } from './widgetTypes';
import WidgetWrapper from './WidgetWrapper';

// Widget Components
import TaskStatsWidget from './widgets/TaskStatsWidget';
import MyTasksWidget from './widgets/MyTasksWidget';
import CalendarWidget from './widgets/CalendarWidget';
import PendingActionsWidget from './widgets/PendingActionsWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import AllTasksWidget from './widgets/AllTasksWidget';
import TasksOverviewWidget from './widgets/TasksOverviewWidget';

// Newly Migrated from static layout
import FocusWidget from './widgets/FocusWidget';
import WorkloadHeatmap from './widgets/WorkloadHeatmap';
import { UserRole } from '../../types';

interface WidgetContainerProps {
    userId: string;
    userRole: UserRole;
    isAdmin: boolean;
    dashboardData: any; // Passed from Dashboard.tsx
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({
    userId,
    userRole,
    isAdmin,
    dashboardData,
}) => {
    const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [showWidgetPicker, setShowWidgetPicker] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Load widget config from Firestore
    useEffect(() => {
        const loadWidgets = async () => {
            const savedConfig = await AuthService.getWidgetConfig(userId);

            if (savedConfig && savedConfig.length > 0) {
                // Filter out any widgets that no longer exist in the registry
                const validConfig = savedConfig.filter((w: WidgetConfig) =>
                    WIDGET_REGISTRY.some((meta) => meta.type === w.type)
                );

                // If no widgets are left (e.g if they were all old types), provide defaults
                if (validConfig.length === 0) {
                    const fresh = getDefaultWidgetConfig(userRole);
                    setWidgets(fresh);
                    AuthService.saveWidgetConfig(userId, fresh);
                } else {
                    // ── MIGRATION: Deduplicate Task Widgets ──────────────────
                    // Since All Tasks and My Tasks are now merged into Tasks Overview,
                    // we remove any duplicates for existing users.
                    const taskWidgetTypes = ['tasks-overview', 'all-tasks', 'my-tasks'];
                    const existingTaskWidgets = validConfig.filter(w => taskWidgetTypes.includes(w.type));
                    
                    if (existingTaskWidgets.length > 1) {
                        const firstTaskWidgetId = existingTaskWidgets[0].id;
                        const deduplicated = validConfig.filter(w => 
                            !taskWidgetTypes.includes(w.type) || w.id === firstTaskWidgetId
                        ).map(w => w.id === firstTaskWidgetId ? { ...w, type: 'tasks-overview' as const, title: 'Tasks Overview' } : w);
                        
                        setWidgets(deduplicated);
                        AuthService.saveWidgetConfig(userId, deduplicated);
                        return;
                    }

                    // Auto-Add Logic for Essential Widgets (Calendar)
                    const hasCalendar = validConfig.some((w: WidgetConfig) => w.type === 'calendar');
                    if (!hasCalendar) {
                        const newWidgets = [...validConfig];
                        newWidgets.unshift({
                            id: `w_cal_${Date.now()}`,
                            type: 'calendar',
                            title: 'Upcoming Schedule',
                            position: 0,
                            size: 'md',
                            visible: true
                        });
                        const finalWidgets = newWidgets.map((w, i) => ({ ...w, position: i }));
                        setWidgets(finalWidgets);
                        AuthService.saveWidgetConfig(userId, finalWidgets);
                    } else {
                        setWidgets(validConfig);
                    }
                }
            } else {
                const fresh = getDefaultWidgetConfig(userRole);
                setWidgets(fresh);
                AuthService.saveWidgetConfig(userId, fresh);
            }
        };
        loadWidgets();
    }, [userId, userRole]);

    // Save widget config
    const saveWidgetConfig = (config: WidgetConfig[]) => {
        setWidgets(config); // Optimistic update
        AuthService.saveWidgetConfig(userId, config);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = widgets.findIndex((w) => w.id === active.id);
            const newIndex = widgets.findIndex((w) => w.id === over.id);
            const newWidgets = arrayMove(widgets, oldIndex, newIndex).map((w, i) => ({
                ...w,
                position: i,
            }));
            saveWidgetConfig(newWidgets);
        }
    };

    const handleRemoveWidget = (id: string) => {
        const newWidgets = widgets.filter((w) => w.id !== id);
        saveWidgetConfig(newWidgets);
    };

    const handleResizeWidget = (id: string) => {
        const sizes: ('sm' | 'md' | 'lg')[] = ['sm', 'md', 'lg'];
        const newWidgets = widgets.map((w) => {
            if (w.id === id) {
                const currentIndex = sizes.indexOf(w.size as 'sm' | 'md' | 'lg');
                const nextSize = sizes[(currentIndex + 1) % sizes.length];
                return { ...w, size: nextSize };
            }
            return w;
        });
        saveWidgetConfig(newWidgets);
    };

    const handleAddWidget = (type: string) => {
        const meta = WIDGET_REGISTRY.find((w) => w.type === type);
        if (!meta) return;

        const newWidget: WidgetConfig = {
            id: `w${Date.now()}`,
            type: meta.type,
            title: meta.title,
            position: widgets.length,
            size: meta.defaultSize,
            visible: true,
        };
        saveWidgetConfig([...widgets, newWidget]);
        setShowWidgetPicker(false);
    };

    const renderWidget = (widget: WidgetConfig) => {
        const props = { ...dashboardData, widget };

        switch (widget.type) {
            case 'focus':
                return <FocusWidget />;
            case 'tasks-overview':
            case 'all-tasks':
            case 'my-tasks':
                return <TasksOverviewWidget recentTasks={dashboardData.allTasks} userMap={dashboardData.userMap} isLoading={dashboardData.isLoading} />;
            case 'calendar':
                return <CalendarWidget upcomingSchedule={dashboardData.upcomingSchedule} isLoading={dashboardData.isLoading} />;
            default:
                return <div className="text-gray-400 text-sm">Unknown widget type</div>;
        }
    };

    const availableWidgets = WIDGET_REGISTRY.filter(
        (meta) => (!meta.adminOnly || isAdmin) && !widgets.some((w) => w.type === meta.type)
    );

    return (
        <div className="space-y-4">
            {/* Toolbar — right-aligned, no sticky */}
            <div className="flex justify-end items-center mb-4 gap-2">
                {isEditing ? (
                    <>
                        <button
                            onClick={() => setShowWidgetPicker(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-900/30 hover:-translate-y-0.5"
                        >
                            <Plus size={14} /> Add Widget
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-500 to-brand- hover:from-brand-400 hover:to-brand- text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-/20 hover:shadow-brand-/40 hover:-translate-y-0.5"
                        >
                            <Save size={14} /> Done
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-4 py-2 glass-panel hover-lift text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                        <Edit3 size={14} /> Customize Layout
                    </button>
                )}
            </div>

            {/* Widget Grid */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={widgets.map((w) => w.id)}
                    strategy={rectSortingStrategy}
                >
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-200 ${isEditing ? 'border-2 border-dashed border-brand-500/20 rounded-2xl p-2' : ''}`}>
                        {widgets.map((widget) => (
                            <WidgetWrapper
                                key={widget.id}
                                widget={widget}
                                isEditing={isEditing}
                                onRemove={handleRemoveWidget}
                                onResize={handleResizeWidget}
                            >
                                {renderWidget(widget)}
                            </WidgetWrapper>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Widget Picker Modal */}
            {showWidgetPicker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="glass-modal rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Widget</h2>
                            <button
                                onClick={() => setShowWidgetPicker(false)}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-500 dark:text-gray-400 hover:text-red-500"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {availableWidgets.length === 0 ? (
                            <p className="text-slate-500 dark:text-gray-400 text-center py-8">
                                All available widgets are already on your dashboard.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableWidgets.map((meta) => (
                                    <button
                                        key={meta.type}
                                        onClick={() => handleAddWidget(meta.type)}
                                        className="p-4 glass-card hover-lift text-left transition-all group flex flex-col gap-1"
                                    >
                                        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-amber-400 transition-colors">
                                            {meta.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 leading-relaxed">{meta.description}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WidgetContainer;
