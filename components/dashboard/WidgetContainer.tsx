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

// Newly Migrated from static layout
import AttendanceWidget from './AttendanceWidget';
import GreetingsWidget from './widgets/GreetingsWidget';
import FocusWidget from './widgets/FocusWidget';
import ComplianceBanner from './widgets/ComplianceBanner';
import WorkloadHeatmap from './widgets/WorkloadHeatmap';
import AiInsightWidget from './widgets/AiInsightWidget';
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
                    setWidgets(validConfig);
                }
            } else {
                const fresh = getDefaultWidgetConfig(userRole);
                setWidgets(fresh);
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
            case 'greetings':
                return <GreetingsWidget pendingCount={dashboardData.myOpenTasks} completedToday={dashboardData.completedToday} />;
            case 'attendance':
                return <AttendanceWidget />;
            case 'compliance-banner':
                return <ComplianceBanner deadlines={dashboardData.upcomingSchedule.filter((i: any) => i.type === 'DEADLINE' && i.subType === 'URGENT')} />;
            case 'focus':
                return <FocusWidget />;
            case 'workload-heatmap':
                return <WorkloadHeatmap staffStats={dashboardData.staffStats} totalTasks={dashboardData.relevantTasks?.length || 0} />;
            case 'ai-insight':
                return <AiInsightWidget />;
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
            {/* Toolbar — right-aligned, no sticky */}
            <div className="flex justify-end items-center mb-4 gap-2">
                {isEditing ? (
                    <>
                        <button
                            onClick={() => setShowWidgetPicker(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all"
                        >
                            <Plus size={13} /> Add Widget
                        </button>
                        <button
                            onClick={() => setIsEditing(false)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
                        >
                            <Save size={13} /> Done
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-white/[0.08]"
                    >
                        <Edit3 size={13} /> Customize Layout
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
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-200 ${isEditing ? 'border-2 border-dashed border-blue-500/20 rounded-2xl p-2' : ''}`}>
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
                    <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Widget</h2>
                            <button
                                onClick={() => setShowWidgetPicker(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors text-slate-500 dark:text-gray-400"
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
                                        className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl hover:border-brand-500 hover:shadow-lg dark:hover:border-brand-500/50 text-left transition-all group"
                                    >
                                        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                            {meta.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{meta.description}</p>
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
