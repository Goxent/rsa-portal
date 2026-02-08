// Staff Productivity Metrics Service
// Calculate and analyze staff productivity data

import { Task, UserProfile, AttendanceRecord } from '../types';
import { AuthService } from './firebase';

export interface StaffMetrics {
    staffId: string;
    staffName: string;
    department?: string;
    role: string;

    // Task metrics
    totalTasks: number;
    completedTasks: number;
    activeTasks: number;
    overdueTasks: number;
    completionRate: number;

    // Time metrics
    avgCompletionTimeHours: number;
    tasksCompletedThisWeek: number;
    tasksCompletedThisMonth: number;

    // Quality metrics
    qualityScore: number; // Based on tasks with no revisions (if tracked)
    onTimeRate: number;   // Completed before due date

    // Overall
    productivityScore: number; // 0-100
    trend: 'up' | 'down' | 'stable';
}

export interface ProductivityFilters {
    dateRange: 'week' | 'month' | 'quarter' | 'year';
    department?: string;
    sortBy: 'name' | 'score' | 'completion' | 'tasks';
    sortOrder: 'asc' | 'desc';
}

const getDateRange = (range: ProductivityFilters['dateRange']): { start: Date; end: Date } => {
    const now = new Date();
    const end = now;
    let start: Date;

    switch (range) {
        case 'week':
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'quarter':
            start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
};

export class StaffProductivityService {
    /**
     * Calculate metrics for a single staff member
     */
    static calculateStaffMetrics(
        staff: UserProfile,
        allTasks: Task[],
        dateRange: { start: Date; end: Date }
    ): StaffMetrics {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Filter tasks assigned to this staff member
        const staffTasks = allTasks.filter(t => t.assignedTo.includes(staff.uid));

        // Tasks within date range (by creation or due date)
        const tasksInRange = staffTasks.filter(t => {
            const taskDate = new Date(t.createdAt || t.dueDate);
            return taskDate >= dateRange.start && taskDate <= dateRange.end;
        });

        // Task counts
        const completedTasks = tasksInRange.filter(t => t.status === 'COMPLETED');
        const activeTasks = tasksInRange.filter(t =>
            t.status !== 'COMPLETED' && t.status !== 'BLOCKED'
        );
        const overdueTasks = tasksInRange.filter(t =>
            t.status !== 'COMPLETED' && t.dueDate < todayStr
        );

        // Completion rate
        const completionRate = tasksInRange.length > 0
            ? (completedTasks.length / tasksInRange.length) * 100
            : 100;

        // Average completion time (for completed tasks with timestamps)
        let avgCompletionTimeHours = 0;
        const tasksWithCompletionTime = completedTasks.filter(t => t.createdAt && t.completedAt);
        if (tasksWithCompletionTime.length > 0) {
            const totalHours = tasksWithCompletionTime.reduce((sum, t) => {
                const created = new Date(t.createdAt!);
                const completed = new Date(t.completedAt!);
                const hours = (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
                return sum + hours;
            }, 0);
            avgCompletionTimeHours = totalHours / tasksWithCompletionTime.length;
        }

        // Tasks completed this week/month
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const tasksCompletedThisWeek = completedTasks.filter(t =>
            t.completedAt && new Date(t.completedAt) >= weekAgo
        ).length;

        const tasksCompletedThisMonth = completedTasks.filter(t =>
            t.completedAt && new Date(t.completedAt) >= monthStart
        ).length;

        // On-time rate (completed before or on due date)
        const onTimeTasks = completedTasks.filter(t => {
            if (!t.completedAt) return true;
            return t.completedAt <= t.dueDate;
        });
        const onTimeRate = completedTasks.length > 0
            ? (onTimeTasks.length / completedTasks.length) * 100
            : 100;

        // Quality score (placeholder - would need revision tracking)
        const qualityScore = Math.min(100, onTimeRate * 0.8 + (completionRate * 0.2));

        // Calculate overall productivity score
        // Weighted: 40% completion, 30% on-time, 20% quality, 10% volume
        const volumeScore = Math.min(100, (tasksInRange.length / 10) * 100);
        const productivityScore = Math.round(
            (completionRate * 0.4) +
            (onTimeRate * 0.3) +
            (qualityScore * 0.2) +
            (volumeScore * 0.1)
        );

        // Trend calculation (compare current to previous period)
        // Simplified: stable for now, would need historical data
        const trend: 'up' | 'down' | 'stable' =
            productivityScore >= 70 ? 'up' :
                productivityScore >= 50 ? 'stable' : 'down';

        return {
            staffId: staff.uid,
            staffName: staff.displayName,
            department: staff.department,
            role: staff.role,
            totalTasks: tasksInRange.length,
            completedTasks: completedTasks.length,
            activeTasks: activeTasks.length,
            overdueTasks: overdueTasks.length,
            completionRate: Math.round(completionRate * 10) / 10,
            avgCompletionTimeHours: Math.round(avgCompletionTimeHours * 10) / 10,
            tasksCompletedThisWeek,
            tasksCompletedThisMonth,
            qualityScore: Math.round(qualityScore),
            onTimeRate: Math.round(onTimeRate * 10) / 10,
            productivityScore,
            trend,
        };
    }

    /**
     * Get productivity metrics for all staff
     */
    static async getAllStaffMetrics(filters: ProductivityFilters): Promise<StaffMetrics[]> {
        const [allUsers, allTasks] = await Promise.all([
            AuthService.getAllUsers(),
            AuthService.getAllTasks(),
        ]);

        const { start, end } = getDateRange(filters.dateRange);

        // Filter out admin roles if needed
        const staffMembers = allUsers.filter(u =>
            u.role !== 'MASTER_ADMIN' &&
            (!filters.department || u.department === filters.department)
        );

        // Calculate metrics for each staff member
        const metrics = staffMembers.map(staff =>
            this.calculateStaffMetrics(staff, allTasks, { start, end })
        );

        // Sort results
        const sortMultiplier = filters.sortOrder === 'asc' ? 1 : -1;
        metrics.sort((a, b) => {
            switch (filters.sortBy) {
                case 'name':
                    return sortMultiplier * a.staffName.localeCompare(b.staffName);
                case 'score':
                    return sortMultiplier * (a.productivityScore - b.productivityScore);
                case 'completion':
                    return sortMultiplier * (a.completionRate - b.completionRate);
                case 'tasks':
                    return sortMultiplier * (a.totalTasks - b.totalTasks);
                default:
                    return 0;
            }
        });

        return metrics;
    }

    /**
     * Get completion trend data for charts
     */
    static async getCompletionTrend(
        staffId: string | null,
        dateRange: ProductivityFilters['dateRange']
    ): Promise<{ date: string; completed: number; created: number }[]> {
        const allTasks = await AuthService.getAllTasks();
        const { start } = getDateRange(dateRange);

        // Filter tasks
        const tasks = staffId
            ? allTasks.filter(t => t.assignedTo.includes(staffId))
            : allTasks;

        // Group by date
        const dataMap = new Map<string, { completed: number; created: number }>();

        tasks.forEach(task => {
            if (task.createdAt) {
                const createdDate = task.createdAt.split('T')[0];
                if (new Date(createdDate) >= start) {
                    const entry = dataMap.get(createdDate) || { completed: 0, created: 0 };
                    entry.created++;
                    dataMap.set(createdDate, entry);
                }
            }

            if (task.completedAt) {
                const completedDate = task.completedAt.split('T')[0];
                if (new Date(completedDate) >= start) {
                    const entry = dataMap.get(completedDate) || { completed: 0, created: 0 };
                    entry.completed++;
                    dataMap.set(completedDate, entry);
                }
            }
        });

        // Convert to sorted array
        return Array.from(dataMap.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get unique departments for filtering
     */
    static async getDepartments(): Promise<string[]> {
        const users = await AuthService.getAllUsers();
        const departments = new Set<string>();
        users.forEach(u => {
            if (u.department) departments.add(u.department);
        });
        return Array.from(departments).sort();
    }
}
