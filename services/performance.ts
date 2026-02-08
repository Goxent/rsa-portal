import { db } from './firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Task, AttendanceRecord, TaskStatus } from '../types';
import { startOfMonth, endOfMonth, isBefore, isAfter, subMonths } from 'date-fns';

export interface PerformanceStats {
    totalTasks: number;
    completedTasks: number;
    onTimeTasks: number;
    overdueTasks: number;
    completionRate: number;
    onTimeRate: number;
    punctualityScore: number;
    totalScore: number;

    // Extended metrics
    highPriorityTasks: number;
    highPriorityCompleted: number;
    highPriorityRate: number;
    avgWorkHours: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;

    // Benchmark comparison
    benchmark: {
        isAboveAverage: boolean;
        rank: number;
        totalStaff: number;
        percentile: number;
    } | null;

    // Performance tier
    performanceTier: 'Exceptional' | 'Strong' | 'Meeting Expectations' | 'Needs Improvement' | 'Critical';
}

export class PerformanceService {
    static async getStaffPerformance(staffId: string, monthOffset: number = 0): Promise<PerformanceStats> {
        const targetDate = subMonths(new Date(), monthOffset);
        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);

        // Fetch Tasks for the month
        const tasksQuery = query(
            collection(db, 'tasks'),
            where('assignedTo', 'array-contains', staffId),
            orderBy('createdAt', 'desc')
        );
        const tasksSnap = await getDocs(tasksQuery);
        const allTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

        // Filter tasks created or due in this month
        const monthlyTasks = allTasks.filter(t => {
            const created = new Date(t.createdAt);
            return isAfter(created, start) && isBefore(created, end);
        });

        const completed = monthlyTasks.filter(t => t.status === TaskStatus.COMPLETED);
        const onTime = completed.filter(t => {
            if (!t.completedAt || !t.dueDate) return true;
            return isBefore(new Date(t.completedAt), new Date(t.dueDate));
        });

        // Fetch Attendance for the month
        const attendanceQuery = query(
            collection(db, 'attendance'),
            where('userId', '==', staffId),
            where('date', '>=', start.toISOString().split('T')[0]),
            where('date', '<=', end.toISOString().split('T')[0])
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        const attendance = attendanceSnap.docs.map(doc => doc.data() as AttendanceRecord);

        const totalDays = attendance.length;
        const presentDays = attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
        const lateDays = attendance.filter(a => a.status === 'LATE').length;
        const absentDays = attendance.filter(a => a.status === 'ABSENT').length;

        // Calculate average work hours
        const totalWorkHours = attendance.reduce((sum, a) => sum + (a.workHours || 0), 0);
        const avgWorkHours = presentDays > 0 ? totalWorkHours / presentDays : 0;

        // High priority task handling (URGENT + HIGH)
        const highPriorityTasks = monthlyTasks.filter(t =>
            t.priority === 'URGENT' || t.priority === 'HIGH'
        );
        const highPriorityCompleted = highPriorityTasks.filter(t => t.status === TaskStatus.COMPLETED);

        // Overdue tasks
        const now = new Date();
        const overdueTasks = monthlyTasks.filter(t =>
            t.status !== TaskStatus.COMPLETED &&
            new Date(t.dueDate) < now
        );

        // Scoring Logic (out of 100)
        // 35% Completion Rate
        // 25% On-Time Rate
        // 20% Punctuality (Late status penalty)
        // 20% High Priority Handling

        const completionRate = monthlyTasks.length > 0 ? (completed.length / monthlyTasks.length) * 100 : 100;
        const onTimeRate = completed.length > 0 ? (onTime.length / completed.length) * 100 : 100;
        const punctualityScore = presentDays > 0 ? ((presentDays - lateDays) / presentDays) * 100 : 100;
        const highPriorityRate = highPriorityTasks.length > 0
            ? (highPriorityCompleted.length / highPriorityTasks.length) * 100
            : 100;

        const totalScore = (completionRate * 0.35) + (onTimeRate * 0.25) + (punctualityScore * 0.20) + (highPriorityRate * 0.20);

        // Determine performance tier
        let performanceTier: PerformanceStats['performanceTier'];
        if (totalScore >= 90) performanceTier = 'Exceptional';
        else if (totalScore >= 75) performanceTier = 'Strong';
        else if (totalScore >= 60) performanceTier = 'Meeting Expectations';
        else if (totalScore >= 40) performanceTier = 'Needs Improvement';
        else performanceTier = 'Critical';

        return {
            totalTasks: monthlyTasks.length,
            completedTasks: completed.length,
            onTimeTasks: onTime.length,
            overdueTasks: overdueTasks.length,
            completionRate,
            onTimeRate,
            punctualityScore,
            totalScore,

            // Extended metrics
            highPriorityTasks: highPriorityTasks.length,
            highPriorityCompleted: highPriorityCompleted.length,
            highPriorityRate,
            avgWorkHours,
            presentDays,
            lateDays,
            absentDays,

            // Benchmark will be populated separately
            benchmark: null,
            performanceTier
        };
    }

    static async getStaffOfTheMonth(): Promise<{ staffId: string; score: number } | null> {
        const staffQuery = query(collection(db, 'users'), where('role', '!=', 'ADMIN'));
        const staffSnap = await getDocs(staffQuery);
        const staffMembers = staffSnap.docs.map(doc => doc.id);

        let topStaff = null;
        let maxScore = -1;

        for (const id of staffMembers) {
            const stats = await this.getStaffPerformance(id, 1); // Get previous month's performance
            if (stats.totalScore > maxScore && stats.totalTasks > 0) {
                maxScore = stats.totalScore;
                topStaff = { staffId: id, score: maxScore };
            }
        }

        return topStaff;
    }
}
