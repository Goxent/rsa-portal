import { db } from './firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';
import { Task, AttendanceRecord, TaskStatus } from '../types';
import { startOfMonth, endOfMonth, isBefore, isAfter, subMonths, differenceInDays } from 'date-fns';
import { PeerFeedbackService } from './peer-feedback';
import { UserProfile, UserRole } from '../types';

export interface PerformanceStats {
    totalTasks: number;
    completedTasks: number;
    onTimeTasks: number;
    overdueTasks: number;
    completionRate: number;
    onTimeRate: number;
    punctualityScore: number;
    qualityScore: number;
    difficultyBonus: number;
    totalScore: number;

    // Eligibility info
    eligibility: {
        qualified: boolean;
        reason?: string;
        failedCriteria: string[];
    };

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
    static readonly WEIGHTS = {
        completion_rate: 0.30,
        on_time_delivery: 0.25,
        punctuality: 0.20,
        peer_feedback: 0.10,
        task_quality: 0.10,
        task_difficulty: 0.05
    };

    static async getStaffPerformance(staffId: string, monthOffset: number = 0): Promise<PerformanceStats> {
        const targetDate = subMonths(new Date(), monthOffset);
        const start = startOfMonth(targetDate);
        const end = endOfMonth(targetDate);

        // Fetch User Profile for eligibility (tenure)
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', staffId)));
        const userProfile = userDoc.docs[0]?.data() as UserProfile;

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
            const due = new Date(t.dueDate);
            return (isAfter(created, start) && isBefore(created, end)) ||
                (isAfter(due, start) && isBefore(due, end));
        });

        const completed = monthlyTasks.filter(t => t.status === TaskStatus.COMPLETED);

        // On-Time Delivery Calculation
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

        const presentDays = attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'HALF_DAY').length;
        const lateDays = attendance.filter(a => a.status === 'LATE').length;
        const absentDays = attendance.filter(a => a.status === 'ABSENT').length;

        // Calculate average work hours
        const totalWorkHours = attendance.reduce((sum, a) => sum + (a.workHours || 0), 0);
        const avgWorkHours = presentDays > 0 ? totalWorkHours / presentDays : 0;

        // Quality Score Logic (Prompt 3.D)
        const qualityScores = monthlyTasks.map(task => {
            let score = 100;
            // Penalties
            if (task.completedAt && task.dueDate && isAfter(new Date(task.completedAt), new Date(task.dueDate))) score -= 10;
            if (task.priority === 'URGENT') score -= 5; // Prompt says "Shouldn't need urgency"

            // Subtasks as a proxy for complexity/revisions if not present
            if (task.subtasks && task.subtasks.length > 5) score += 5;

            return Math.max(0, Math.min(100, score));
        });
        const qualityScore = qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 100;

        // Difficulty Bonus (Prompt 3.E)
        const difficulties = monthlyTasks.map(task => {
            let diff = 1;
            if (task.clientIds && task.clientIds.length > 1) diff += 0.5;
            if (task.subtasks && task.subtasks.length > 5) diff += 0.3;
            if (task.priority === 'URGENT') diff += 1;
            if (task.priority === 'HIGH') diff += 0.5;
            return diff;
        });
        const avgDifficulty = difficulties.length > 0 ? difficulties.reduce((a, b) => a + b, 0) / difficulties.length : 1;
        const difficultyBonus = Math.min(100, avgDifficulty * 20);

        // Peer Feedback Integration (Prompt 3.C)
        const monthKey = targetDate.toISOString().substring(0, 7);
        const peerSummary = await PeerFeedbackService.getAggregatedFeedback(staffId, monthKey);
        const peerScore = peerSummary ? (peerSummary.avg_ratings.teamwork + peerSummary.avg_ratings.communication + peerSummary.avg_ratings.technical_skills + peerSummary.avg_ratings.reliability + peerSummary.avg_ratings.helpfulness) * 4 : 80; // Default to 80 if no reviews

        // Standard metrics
        const completionRate = monthlyTasks.length > 0 ? (completed.length / monthlyTasks.length) * 100 : 100;
        const onTimeRate = completed.length > 0 ? (onTime.length / completed.length) * 100 : 100;
        const punctualityScore = presentDays > 0 ? ((presentDays - lateDays) / presentDays) * 100 : 100;

        // Eligibility Check (Prompt 2)
        const failedCriteria: string[] = [];
        if (completed.length < 10) failedCriteria.push('MIN_TASKS');
        if (presentDays < 20) failedCriteria.push('MIN_DAYS_ACTIVE');
        const attendanceRate = attendance.length > 0 ? (presentDays / attendance.length) * 100 : 0;
        if (attendanceRate < 80) failedCriteria.push('MIN_ATTENDANCE');

        if (userProfile?.dateOfJoining) {
            const tenureDays = differenceInDays(new Date(), new Date(userProfile.dateOfJoining));
            if (tenureDays < 30) failedCriteria.push('NEW_JOINER');
        }

        const eligibility = {
            qualified: failedCriteria.length === 0,
            failedCriteria,
            reason: failedCriteria.length > 0 ? `Failed: ${failedCriteria.join(', ')}` : undefined
        };

        // Weighted Scoring (Prompt 3.F)
        const totalScore = (
            (completionRate * this.WEIGHTS.completion_rate) +
            (onTimeRate * this.WEIGHTS.on_time_delivery) +
            (punctualityScore * this.WEIGHTS.punctuality) +
            (peerScore * this.WEIGHTS.peer_feedback) +
            (qualityScore * this.WEIGHTS.task_quality) +
            (difficultyBonus * this.WEIGHTS.task_difficulty)
        );

        // High priority task handling (URGENT + HIGH)
        const highPriorityTasks = monthlyTasks.filter(t =>
            t.priority === 'URGENT' || t.priority === 'HIGH'
        );
        const highPriorityCompleted = highPriorityTasks.filter(t => t.status === TaskStatus.COMPLETED);
        const highPriorityRate = highPriorityTasks.length > 0
            ? (highPriorityCompleted.length / highPriorityTasks.length) * 100
            : 100;

        // Overdue tasks
        const overdueTasks = monthlyTasks.filter(t =>
            t.status !== TaskStatus.COMPLETED &&
            new Date(t.dueDate) < new Date()
        );

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
            qualityScore,
            difficultyBonus,
            totalScore,
            eligibility,
            highPriorityTasks: highPriorityTasks.length,
            highPriorityCompleted: highPriorityCompleted.length,
            highPriorityRate,
            avgWorkHours,
            presentDays,
            lateDays,
            absentDays,
            benchmark: null,
            performanceTier
        };
    }

    static async finalizeMonthlyPerformance(month: string, tenantId: string): Promise<string> {
        // Implementation of month-end finalization logic
        const staffDocs = await getDocs(query(collection(db, 'users'), where('role', '!=', UserRole.MASTER_ADMIN)));
        const staff = staffDocs.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

        const scores: Record<string, any> = {};
        for (const s of staff) {
            const stats = await this.getStaffPerformance(s.uid, 1); // Previous month
            scores[s.uid] = {
                user_id: s.uid,
                user_name: s.displayName,
                total_score: stats.totalScore,
                components: {
                    completion_rate: stats.completionRate,
                    on_time_delivery: stats.onTimeRate,
                    punctuality: stats.punctualityScore,
                    task_quality: stats.qualityScore,
                    task_difficulty: stats.difficultyBonus
                },
                eligibility: {
                    qualified: stats.eligibility.qualified,
                    failed_criteria: stats.eligibility.failedCriteria
                },
                metrics: {
                    completed_tasks: stats.completedTasks,
                    punctuality_score: stats.punctualityScore,
                    on_time_rate: stats.onTimeRate
                }
            };
        }

        // Rank staff (Qualified only for Staff of the Month)
        const rankedStaff = Object.values(scores)
            .filter(s => s.eligibility.qualified)
            .sort((a, b) => {
                // Tie-breaker rules (Prompt 1.5)
                if (b.total_score !== a.total_score) return b.total_score - a.total_score;
                if (b.metrics.completed_tasks !== a.metrics.completed_tasks) return b.metrics.completed_tasks - a.metrics.completed_tasks;
                if (b.metrics.punctuality_score !== a.metrics.punctuality_score) return b.metrics.punctuality_score - a.metrics.punctuality_score;
                return b.metrics.on_time_rate - a.metrics.on_time_rate;
            });

        const topStaff = rankedStaff[0];

        // Calculate team stats
        const allScores = Object.values(scores).map(s => s.total_score);
        const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const sortedScores = [...allScores].sort((a, b) => a - b);
        const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];

        const cycleId = `${month}_${tenantId}`;
        const cycleData = {
            id: cycleId,
            tenant_id: tenantId,
            month,
            status: 'FINALIZED',
            finalized_at: new Date().toISOString(),
            staff_scores: scores,
            staff_of_month: topStaff ? {
                user_id: topStaff.user_id,
                score: topStaff.total_score,
                rank: 1,
                reason: `Exceptional performance in ${month} with a score of ${topStaff.total_score.toFixed(1)}%`
            } : null,
            team_stats: {
                avg_score: avgScore,
                median_score: medianScore,
                total_tasks: Object.values(scores).reduce((sum, s) => sum + (s.metrics.completed_tasks || 0), 0)
            }
        };

        // Save to Firestore
        const { doc, setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'performance_cycles', cycleId), cycleData);

        return cycleId;
    }

    static async getStaffOfTheMonth(): Promise<{ staffId: string; score: number } | null> {
        // Optimized to check performance_cycles first
        const lastMonth = subMonths(new Date(), 1);
        const monthKey = lastMonth.toISOString().substring(0, 7); // YYYY-MM
        const { doc, getDoc } = await import('firebase/firestore');

        // Assuming tenantId is 'default' for now or passed in
        const cycleDoc = await getDoc(doc(db, 'performance_cycles', `${monthKey}_default`));
        if (cycleDoc.exists()) {
            const data = cycleDoc.data();
            if (data.staff_of_month) {
                return { staffId: data.staff_of_month.user_id, score: data.staff_of_month.score };
            }
        }

        // Fallback to calculation if not finalized
        const staffQuery = query(collection(db, 'users'), where('role', '!=', 'ADMIN'));
        const staffSnap = await getDocs(staffQuery);
        const staffMembers = staffSnap.docs.map(doc => doc.id);

        let topStaff = null;
        let maxScore = -1;

        for (const id of staffMembers) {
            const stats = await this.getStaffPerformance(id, 1);
            if (stats.totalScore > maxScore && stats.totalTasks > 0 && stats.eligibility.qualified) {
                maxScore = stats.totalScore;
                topStaff = { staffId: id, score: maxScore };
            }
        }

        return topStaff;
    }
}
