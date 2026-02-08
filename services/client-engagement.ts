// Client Engagement Scoring Service
// Calculates and tracks client engagement levels based on interactions

import { Client } from '../types';
import { AuthService } from './firebase';

export type EngagementTier = 'inactive' | 'low' | 'medium' | 'high' | 'champion';

export interface ClientEngagementScore {
    clientId: string;
    clientName: string;
    businessName?: string;

    // Individual scores (0-100)
    taskActivityScore: number;      // Based on active tasks & completion
    communicationScore: number;     // Based on recent communications
    billingScore: number;           // Based on payment timeliness
    documentScore: number;          // Based on document submissions
    retentionScore: number;         // Based on tenure & consistency

    // Overall
    totalScore: number;             // Weighted average 0-100
    tier: EngagementTier;
    riskLevel: 'low' | 'medium' | 'high';
    lastInteraction?: string;

    // Insights
    strengths: string[];
    improvements: string[];
}

export interface EngagementTrend {
    date: string;
    avgScore: number;
    activeClients: number;
    atRiskClients: number;
}

interface EngagementFilters {
    tier?: EngagementTier;
    riskLevel?: 'low' | 'medium' | 'high';
    sortBy: 'score' | 'name' | 'risk';
    sortOrder: 'asc' | 'desc';
}

// Tier thresholds
const TIER_THRESHOLDS: Record<EngagementTier, { min: number; max: number }> = {
    inactive: { min: 0, max: 20 },
    low: { min: 21, max: 40 },
    medium: { min: 41, max: 60 },
    high: { min: 61, max: 80 },
    champion: { min: 81, max: 100 },
};

const getTier = (score: number): EngagementTier => {
    if (score <= 20) return 'inactive';
    if (score <= 40) return 'low';
    if (score <= 60) return 'medium';
    if (score <= 80) return 'high';
    return 'champion';
};

const getRiskLevel = (score: number): 'low' | 'medium' | 'high' => {
    if (score >= 60) return 'low';
    if (score >= 40) return 'medium';
    return 'high';
};

export class ClientEngagementService {
    /**
     * Calculate engagement score for a single client
     */
    static async calculateClientScore(client: Client): Promise<ClientEngagementScore> {
        const now = new Date();

        // Fetch related data
        const allTasks = await AuthService.getAllTasks();
        const clientTasks = allTasks.filter(t => t.clientId === client.id);

        // Task Activity Score (30% weight)
        // Based on: active tasks, completion rate, recent activity
        const activeTasks = clientTasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'BLOCKED');
        const completedTasks = clientTasks.filter(t => t.status === 'COMPLETED');
        const recentTasks = clientTasks.filter(t => {
            const taskDate = new Date(t.createdAt || t.dueDate);
            const daysDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 90;
        });

        let taskActivityScore = 50; // Base score
        if (recentTasks.length > 0) taskActivityScore += 20;
        if (activeTasks.length > 0) taskActivityScore += 15;
        if (completedTasks.length > 0) {
            const completionRate = completedTasks.length / clientTasks.length;
            taskActivityScore += Math.round(completionRate * 15);
        }
        taskActivityScore = Math.min(100, taskActivityScore);

        // Communication Score (20% weight)
        // Based on: contact info completeness, recent interactions
        let communicationScore = 30; // Base
        if (client.contactPersonName) communicationScore += 20;
        if (client.contactPersonPhone) communicationScore += 15;
        if (client.email) communicationScore += 15;
        if (recentTasks.length > 0) communicationScore += 20;
        communicationScore = Math.min(100, communicationScore);

        // Billing Score (25% weight)
        // Based on: billing history, payment status
        let billingScore = 50; // Base
        if (client.billingAmount && Number(client.billingAmount) > 0) {
            billingScore += 20;
            if (client.paymentStatus === 'PAID') {
                billingScore += 30;
            } else if (client.paymentStatus === 'PARTIAL') {
                billingScore += 15;
            }
        }
        billingScore = Math.min(100, billingScore);

        // Document Score (15% weight)
        // Based on: document submissions, PAN availability
        let documentScore = 40; // Base
        if (client.pan) documentScore += 30;
        if (client.contactPersonPan) documentScore += 30;
        documentScore = Math.min(100, documentScore);

        // Retention Score (10% weight)
        // Based on: client tenure
        let retentionScore = 50; // Base
        if (client.createdAt) {
            const createdDate = new Date(client.createdAt);
            const monthsActive = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsActive >= 12) retentionScore = 100;
            else if (monthsActive >= 6) retentionScore = 80;
            else if (monthsActive >= 3) retentionScore = 60;
        }

        // Calculate weighted total
        const totalScore = Math.round(
            (taskActivityScore * 0.30) +
            (communicationScore * 0.20) +
            (billingScore * 0.25) +
            (documentScore * 0.15) +
            (retentionScore * 0.10)
        );

        // Generate insights
        const strengths: string[] = [];
        const improvements: string[] = [];

        if (taskActivityScore >= 70) strengths.push('Active task engagement');
        else improvements.push('Increase task activity');

        if (communicationScore >= 70) strengths.push('Good communication data');
        else improvements.push('Complete contact information');

        if (billingScore >= 70) strengths.push('Healthy billing relationship');
        else improvements.push('Improve billing status');

        if (documentScore >= 70) strengths.push('Complete documentation');
        else improvements.push('Collect missing documents');

        // Find last interaction date
        let lastInteraction: string | undefined;
        const sortedTasks = clientTasks
            .filter(t => t.updatedAt)
            .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());
        if (sortedTasks.length > 0) {
            lastInteraction = sortedTasks[0].updatedAt;
        }

        return {
            clientId: client.id!,
            clientName: client.name,
            businessName: client.businessName,
            taskActivityScore,
            communicationScore,
            billingScore,
            documentScore,
            retentionScore,
            totalScore,
            tier: getTier(totalScore),
            riskLevel: getRiskLevel(totalScore),
            lastInteraction,
            strengths,
            improvements,
        };
    }

    /**
     * Get engagement scores for all clients
     */
    static async getAllClientScores(filters: EngagementFilters): Promise<ClientEngagementScore[]> {
        const clients = await AuthService.getAllClients();

        // Calculate scores for all clients
        const scores = await Promise.all(
            clients.map(client => this.calculateClientScore(client))
        );

        // Apply filters
        let filtered = scores;

        if (filters.tier) {
            filtered = filtered.filter(s => s.tier === filters.tier);
        }

        if (filters.riskLevel) {
            filtered = filtered.filter(s => s.riskLevel === filters.riskLevel);
        }

        // Sort
        const sortMultiplier = filters.sortOrder === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
            switch (filters.sortBy) {
                case 'score':
                    return sortMultiplier * (a.totalScore - b.totalScore);
                case 'name':
                    return sortMultiplier * a.clientName.localeCompare(b.clientName);
                case 'risk':
                    const riskOrder = { high: 0, medium: 1, low: 2 };
                    return sortMultiplier * (riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
                default:
                    return 0;
            }
        });

        return filtered;
    }

    /**
     * Get summary statistics
     */
    static async getEngagementSummary(): Promise<{
        totalClients: number;
        avgScore: number;
        tierBreakdown: Record<EngagementTier, number>;
        atRiskCount: number;
        championsCount: number;
    }> {
        const scores = await this.getAllClientScores({ sortBy: 'score', sortOrder: 'desc' });

        const tierBreakdown: Record<EngagementTier, number> = {
            inactive: 0,
            low: 0,
            medium: 0,
            high: 0,
            champion: 0,
        };

        let totalScore = 0;
        let atRiskCount = 0;

        scores.forEach(s => {
            totalScore += s.totalScore;
            tierBreakdown[s.tier]++;
            if (s.riskLevel === 'high') atRiskCount++;
        });

        return {
            totalClients: scores.length,
            avgScore: scores.length > 0 ? Math.round(totalScore / scores.length) : 0,
            tierBreakdown,
            atRiskCount,
            championsCount: tierBreakdown.champion,
        };
    }

    /**
     * Get clients at risk (for alerts/interventions)
     */
    static async getAtRiskClients(): Promise<ClientEngagementScore[]> {
        const scores = await this.getAllClientScores({ sortBy: 'score', sortOrder: 'asc' });
        return scores.filter(s => s.riskLevel === 'high');
    }
}
