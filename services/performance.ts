import { db } from './firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Task, AttendanceRecord, TaskStatus } from '../types';
import { startOfMonth, endOfMonth, isBefore, isAfter, subMonths } from 'date-fns';

export interface PerformanceStats {
    totalTasks: number;
    completedTasks: number;
    onTimeTasks: number;
    completionRate: number;
    onTimeRate: number;
    punctualityScore: number;
    totalScore: number;
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
        const presentationDays = attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
        const lateDays = attendance.filter(a => a.status === 'LATE').length;

        // Scoring Logic (out of 100)
        // 40% Completion Rate
        // 30% On-Time Rate
        // 30% Punctuality (Late status penalty)

        const completionRate = monthlyTasks.length > 0 ? (completed.length / monthlyTasks.length) * 100 : 100;
        const onTimeRate = completed.length > 0 ? (onTime.length / completed.length) * 100 : 100;
        const punctualityScore = presentationDays > 0 ? ((presentationDays - lateDays) / presentationDays) * 100 : 100;

        const totalScore = (completionRate * 0.4) + (onTimeRate * 0.3) + (punctualityScore * 0.3);

        return {
            totalTasks: monthlyTasks.length,
            completedTasks: completed.length,
            onTimeTasks: onTime.length,
            completionRate,
            onTimeRate,
            punctualityScore,
            totalScore
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
