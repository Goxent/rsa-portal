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

// Widget Components (will be created separately)
import TaskStatsWidget from './widgets/TaskStatsWidget';
import MyTasksWidget from './widgets/MyTasksWidget';
import CalendarWidget from './widgets/CalendarWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import PerformanceWidget from './widgets/PerformanceWidget';
import TeamWorkloadWidget from './widgets/TeamWorkloadWidget';
import PendingActionsWidget from './widgets/PendingActionsWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import ClientStatsWidget from './widgets/ClientStatsWidget';
import StaffStatsWidget from './widgets/StaffStatsWidget';
import ImpactStatsWidget from './widgets/ImpactStatsWidget';
import ComplianceCountdownWidget from './widgets/ComplianceCountdownWidget';
import AllTasksWidget from './widgets/AllTasksWidget';

interface WidgetContainerProps {
    userId: string;
    isAdmin: boolean;
    dashboardData: any; // Passed from Dashboard.tsx
}

const WidgetContainer: React.FC<WidgetContainerProps> = ({
    userId,
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

                // Version check: if admin layout is missing 'all-tasks', update it
                const needsReset = isAdmin && !validConfig.some((w: WidgetConfig) => w.type === 'all-tasks');
                if (needsReset || validConfig.length === 0) {
                    const fresh = getDefaultWidgetConfig(isAdmin);
                    setWidgets(fresh);
                    AuthService.saveWidgetConfig(userId, fresh);
                } else {
                    setWidgets(validConfig);
                }
            } else {
                const fresh = getDefaultWidgetConfig(isAdmin);
                setWidgets(fresh);
                // Save default to Firestore immediately? Optional.
                // AuthService.saveWidgetConfig(userId, fresh); 
            }
        };
        loadWidgets();
    }, [userId, isAdmin]);

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
            case 'impact-stats':
                return <ImpactStatsWidget {...props} />;
            case 'compliance-countdown':
                return <ComplianceCountdownWidget />;
            case 'all-tasks':
                return <AllTasksWidget recentTasks={dashboardData.recentTasks} userMap={dashboardData.userMap} isLoading={dashboardData.isLoading} />;
            case 'task-stats':
                return <TaskStatsWidget {...props} />;
            case 'my-tasks':
                return <MyTasksWidget {...props} />;
            case 'calendar':
                return <CalendarWidget {...props} />;
            case 'quick-actions':
                return <QuickActionsWidget {...props} />;
            case 'performance':
                return <PerformanceWidget {...props} />;
            case 'team-workload':
                return <TeamWorkloadWidget {...props} />;

            case 'recent-activity':
                return <RecentActivityWidget {...props} />;
            case 'client-stats':
                return <ClientStatsWidget widget={widget} clientStats={dashboardData.clientStats} />;
            case 'staff-stats':
                return <StaffStatsWidget widget={widget} staffStats={dashboardData.staffStats} />;
            default:
                return <div className="text-gray-400 text-sm">Unknown widget type</div>;
        }
    };

    const availableWidgets = WIDGET_REGISTRY.filter(
        (meta) => (!meta.adminOnly || isAdmin) && !widgets.some((w) => w.type === meta.type)
    );

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <div className="flex gap-2">
                    {isEditing ? (
                        <>
                            <button
                                onClick={() => setShowWidgetPicker(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-medium transition-all"
                            >
                                <Plus size={16} />
                                Add Widget
                            </button>
                            <button
                                onClick={() => setIsEditing(false)}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-medium transition-all"
                            >
                                <Save size={16} />
                                Done
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-all"
                        >
                            <Edit3 size={16} />
                            Customize
                        </button>
                    )}
                </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-modal rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Add Widget</h2>
                            <button
                                onClick={() => setShowWidgetPicker(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {availableWidgets.length === 0 ? (
                            <p className="text-gray-400 text-center py-8">
                                All available widgets are already on your dashboard.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {availableWidgets.map((meta) => (
                                    <button
                                        key={meta.type}
                                        onClick={() => handleAddWidget(meta.type)}
                                        className="p-4 glass-card hover:border-brand-500/50 text-left transition-all group"
                                    >
                                        <h3 className="font-semibold text-white group-hover:text-brand-400 transition-colors">
                                            {meta.title}
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">{meta.description}</p>
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
