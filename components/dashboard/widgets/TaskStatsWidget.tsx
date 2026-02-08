import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

interface TaskStatsWidgetProps {
    taskData?: { name: string; value: number }[];
}

const TaskStatsWidget: React.FC<TaskStatsWidgetProps> = ({ taskData = [] }) => {
    const total = taskData.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No tasks data available
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={taskData}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={45}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {taskData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                background: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#fff',
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
                {taskData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="text-gray-300">{item.name}</span>
                        </div>
                        <span className="font-semibold text-white">{item.value}</span>
                    </div>
                ))}
                <div className="pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Total</span>
                        <span className="font-bold text-white">{total}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskStatsWidget;
