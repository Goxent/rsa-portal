// Predictive Workload Balancing Service
// Analyzes workload patterns and suggests optimal task distribution

import { Task, UserProfile, TaskStatus } from '../types';
import { AuthService } from './firebase';

export interface WorkloadPrediction {
    staffId: string;
    staffName: string;
    role: string;
    department?: string;

    // Current state
    currentLoad: number;         // Active tasks count
    currentHours: number;        // Estimated hours of current work
    capacity: number;            // Max recommended tasks

    // Predictions
    predictedLoadNextWeek: number;
    predictedLoadNextMonth: number;
    burnoutRisk: 'low' | 'medium' | 'high';

    // Recommendations
    canTakeMore: boolean;
    suggestedReduction: number;  // Tasks to redistribute
    optimalLoad: number;
}

export interface WorkloadRecommendation {
    taskId: string;
    taskTitle: string;
    currentAssignee: string;
    currentAssigneeName: string;
    suggestedAssignee: string;
    suggestedAssigneeName: string;
    reason: string;
    priority: 'low' | 'medium' | 'high';
    estimatedImpact: string;
}

export interface TeamWorkloadSummary {
    totalStaff: number;
    avgLoad: number;
    overloadedCount: number;         // >80% capacity
    underutilizedCount: number;      // <40% capacity
    optimalCount: number;            // 40-80%
    redistributionOpportunities: number;
    balanceScore: number;            // 0-100
}

// Capacity defaults based on role
const ROLE_CAPACITY: Record<string, number> = {
    MASTER_ADMIN: 10,
    ADMIN: 8,
    MANAGER: 12,
    STAFF: 15,
};

// Estimated hours per priority
const PRIORITY_HOURS: Record<string, number> = {
    URGENT: 8,
    HIGH: 6,
    MEDIUM: 4,
    LOW: 2,
};

export class WorkloadPredictionService {
    /**
     * Calculate workload for a single staff member
     */
    static calculateStaffWorkload(
        staff: UserProfile,
        allTasks: Task[]
    ): WorkloadPrediction {
        const now = new Date();
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Get tasks assigned to this staff
        const staffTasks = allTasks.filter(t => t.assignedTo.includes(staff.uid));
        const activeTasks = staffTasks.filter(t =>
            t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.HALTED
        );

        // Current load
        const currentLoad = activeTasks.length;
        const capacity = ROLE_CAPACITY[staff.role] || 10;

        // Estimate current hours
        const currentHours = activeTasks.reduce((sum, t) => {
            return sum + (PRIORITY_HOURS[t.priority] || 4);
        }, 0);

        // Predict next week's load (tasks due in next 7 days)
        const tasksDueNextWeek = activeTasks.filter(t =>
            new Date(t.dueDate) <= nextWeek
        ).length;

        // Predict next month's load (heuristic: current + new assignments trend)
        const recentlyAssigned = staffTasks.filter(t => {
            if (!t.createdAt) return false;
            const created = new Date(t.createdAt);
            const daysSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceCreation <= 30;
        }).length;

        const avgNewTasksPerWeek = recentlyAssigned / 4;
        const predictedLoadNextWeek = Math.round(currentLoad + avgNewTasksPerWeek * 0.5);
        const predictedLoadNextMonth = Math.round(currentLoad + avgNewTasksPerWeek * 3);

        // Calculate burnout risk
        const loadPercentage = (currentLoad / capacity) * 100;
        let burnoutRisk: 'low' | 'medium' | 'high' = 'low';
        if (loadPercentage >= 90) burnoutRisk = 'high';
        else if (loadPercentage >= 70) burnoutRisk = 'medium';

        // Recommendations
        const canTakeMore = loadPercentage < 70;
        const suggestedReduction = loadPercentage > 100
            ? Math.ceil(currentLoad - capacity)
            : 0;
        const optimalLoad = Math.round(capacity * 0.7);

        return {
            staffId: staff.uid,
            staffName: staff.displayName,
            role: staff.role,
            department: staff.department,
            currentLoad,
            currentHours,
            capacity,
            predictedLoadNextWeek,
            predictedLoadNextMonth,
            burnoutRisk,
            canTakeMore,
            suggestedReduction,
            optimalLoad,
        };
    }

    /**
     * Get workload predictions for all staff
     */
    static async getAllWorkloadPredictions(): Promise<WorkloadPrediction[]> {
        const [allUsers, allTasks] = await Promise.all([
            AuthService.getAllUsers(),
            AuthService.getAllTasks(),
        ]);

        // Filter to active staff only
        const activeStaff = allUsers.filter(u => u.role !== 'MASTER_ADMIN');

        return activeStaff.map(staff =>
            this.calculateStaffWorkload(staff, allTasks)
        );
    }

    /**
     * Generate redistribution recommendations
     */
    static async getRedistributionRecommendations(): Promise<WorkloadRecommendation[]> {
        const predictions = await this.getAllWorkloadPredictions();
        const allTasks = await AuthService.getAllTasks();
        const recommendations: WorkloadRecommendation[] = [];

        // Find overloaded staff
        const overloaded = predictions.filter(p =>
            p.currentLoad > p.capacity || p.burnoutRisk === 'high'
        );

        // Find underutilized staff
        const underutilized = predictions.filter(p =>
            p.canTakeMore && p.currentLoad < p.optimalLoad
        );

        if (underutilized.length === 0) return recommendations;

        for (const over of overloaded) {
            // Get their lower-priority active tasks
            const theirTasks = allTasks.filter(t =>
                t.assignedTo.includes(over.staffId) &&
                t.status !== TaskStatus.COMPLETED &&
                t.status !== TaskStatus.HALTED &&
                (t.priority === 'LOW' || t.priority === 'MEDIUM')
            );

            for (const task of theirTasks.slice(0, over.suggestedReduction || 2)) {
                // Find best candidate for reassignment
                const candidate = underutilized
                    .filter(u => u.department === over.department || !over.department)
                    .sort((a, b) => a.currentLoad - b.currentLoad)[0];

                if (candidate) {
                    recommendations.push({
                        taskId: task.id!,
                        taskTitle: task.title,
                        currentAssignee: over.staffId,
                        currentAssigneeName: over.staffName,
                        suggestedAssignee: candidate.staffId,
                        suggestedAssigneeName: candidate.staffName,
                        reason: `${over.staffName} is at ${Math.round((over.currentLoad / over.capacity) * 100)}% capacity (${over.burnoutRisk} burnout risk)`,
                        priority: over.burnoutRisk === 'high' ? 'high' : 'medium',
                        estimatedImpact: `Reduces ${over.staffName}'s load by ${Math.round(100 / over.currentLoad)}%`,
                    });
                }
            }
        }

        return recommendations;
    }

    /**
     * Get team summary statistics
     */
    static async getTeamSummary(): Promise<TeamWorkloadSummary> {
        const predictions = await this.getAllWorkloadPredictions();

        const totalStaff = predictions.length;
        const avgLoad = totalStaff > 0
            ? predictions.reduce((sum, p) => sum + p.currentLoad, 0) / totalStaff
            : 0;

        let overloadedCount = 0;
        let underutilizedCount = 0;
        let optimalCount = 0;

        predictions.forEach(p => {
            const loadPct = (p.currentLoad / p.capacity) * 100;
            if (loadPct > 80) overloadedCount++;
            else if (loadPct < 40) underutilizedCount++;
            else optimalCount++;
        });

        const recommendations = await this.getRedistributionRecommendations();

        // Balance score: higher is better (100 = perfectly balanced)
        const variance = predictions.length > 0
            ? predictions.reduce((sum, p) => {
                const loadPct = (p.currentLoad / p.capacity) * 100;
                const deviation = Math.abs(loadPct - 60); // 60% is ideal
                return sum + deviation;
            }, 0) / predictions.length
            : 0;

        const balanceScore = Math.max(0, Math.round(100 - variance));

        return {
            totalStaff,
            avgLoad: Math.round(avgLoad * 10) / 10,
            overloadedCount,
            underutilizedCount,
            optimalCount,
            redistributionOpportunities: recommendations.length,
            balanceScore,
        };
    }

    /**
     * Find best assignee for a new task
     */
    static async suggestAssignee(
        taskPriority: string,
        department?: string
    ): Promise<{ staffId: string; staffName: string; reason: string } | null> {
        const predictions = await this.getAllWorkloadPredictions();

        // Filter by department if specified
        let candidates = predictions.filter(p => p.canTakeMore);
        if (department) {
            const deptCandidates = candidates.filter(p => p.department === department);
            if (deptCandidates.length > 0) candidates = deptCandidates;
        }

        if (candidates.length === 0) return null;

        // Sort by capacity available
        candidates.sort((a, b) => {
            const aCapacity = a.capacity - a.currentLoad;
            const bCapacity = b.capacity - b.currentLoad;
            return bCapacity - aCapacity;
        });

        const best = candidates[0];
        return {
            staffId: best.staffId,
            staffName: best.staffName,
            reason: `${best.staffName} has ${best.capacity - best.currentLoad} capacity available (current: ${best.currentLoad}/${best.capacity})`,
        };
    }
}
