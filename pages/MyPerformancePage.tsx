import React, { useState, useEffect } from 'react';
import {
    Trophy, TrendingUp, Clock, CheckCircle2,
    Calendar, Star, Flame, Shield, ChevronRight, Activity, Target, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PerformanceService, PerformanceStats } from '../services/performance';
import { PerformanceCycle } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { ACHIEVEMENT_REGISTRY } from '../utils/achievements';
import * as Icons from 'lucide-react';

const MyPerformancePage: React.FC = () => {
    const { user } = useAuth();
    const [currentStats, setCurrentStats] = useState<PerformanceStats | null>(null);
    const [history, setHistory] = useState<PerformanceCycle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'goals'>('overview');

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const stats = await PerformanceService.getStaffPerformance(user!.uid, 0);
            setCurrentStats(stats);

            const q = query(
                collection(db, 'performance_cycles'),
                where('status', '==', 'FINALIZED'),
                orderBy('finalized_at', 'desc'),
                limit(6)
            );
            const snapshot = await getDocs(q);
            const pastCycles = snapshot.docs
                .map(doc => doc.data() as PerformanceCycle)
                .filter(cycle => cycle.staff_scores[user!.uid]);
            setHistory(pastCycles);

        } catch (error) {
            console.error("Error fetching personal performance", error);
            toast.error("Failed to load performance data");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading || !currentStats) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Activity className="animate-spin text-[var(--accent)] mb-3" size={32} />
                <p className="text-sm text-[var(--text-muted)]">Loading performance metrics...</p>
            </div>
        );
    }

    const getTierStyle = (tier: string) => {
        switch (tier) {
            case 'Exceptional': return 'text-[var(--color-success)] bg-[rgba(79,178,134,0.1)] border-[rgba(79,178,134,0.25)]';
            case 'Strong': return 'text-[var(--accent)] bg-[var(--accent-dim)] border-[var(--border-accent)]';
            case 'Meeting Expectations': return 'text-[var(--color-warning)] bg-[rgba(217,164,65,0.1)] border-[rgba(217,164,65,0.25)]';
            default: return 'text-[var(--color-danger)] bg-[rgba(224,112,122,0.1)] border-[rgba(224,112,122,0.25)]';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-lg font-semibold text-[var(--accent)]">
                        {user?.displayName?.[0] || 'U'}
                    </div>
                    <div>
                        <h1 className="font-display text-2xl font-semibold text-[var(--text-heading)] tracking-tight">Your performance</h1>
                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                            <Star size={12} className="text-[var(--color-warning)] fill-[var(--color-warning)]" />
                            <span>{currentStats.performanceTier} performer</span> • <span className="tabular-nums">{currentStats.totalScore.toFixed(0)} points this month</span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-1 bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border)]">
                    {(['overview', 'achievements', 'goals'] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                                activeTab === tab
                                    ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-[var(--text-muted)]">Current score</span>
                                <Trophy size={15} className="text-[var(--accent)]" />
                            </div>
                            <h3 className="font-display text-2xl font-semibold text-[var(--text-heading)] tabular-nums">{currentStats.totalScore.toFixed(1)}%</h3>
                            <div className="mt-2 flex items-center text-xs text-[var(--color-success)] font-medium">
                                <TrendingUp size={12} className="mr-1" /> Above average by 4.2%
                            </div>
                        </div>

                        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-[var(--text-muted)]">Completion</span>
                                <CheckCircle2 size={15} className="text-[var(--color-success)]" />
                            </div>
                            <h3 className="font-display text-2xl font-semibold text-[var(--text-heading)] tabular-nums">{currentStats.completionRate.toFixed(0)}%</h3>
                            <p className="text-[11px] text-[var(--text-muted)] mt-2 tabular-nums">{currentStats.completedTasks}/{currentStats.totalTasks} tasks finished</p>
                        </div>

                        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-[var(--text-muted)]">Punctuality</span>
                                <Clock size={15} className="text-[var(--color-warning)]" />
                            </div>
                            <h3 className="font-display text-2xl font-semibold text-[var(--text-heading)] tabular-nums">{currentStats.punctualityScore.toFixed(0)}%</h3>
                            <div className="mt-2.5 w-full h-1 bg-[var(--border)] rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--accent)]" style={{ width: `${currentStats.punctualityScore}%` }} />
                            </div>
                        </div>

                        <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-[var(--text-muted)]">Daily streak</span>
                                <Flame size={15} className="text-[var(--color-warning)]" />
                            </div>
                            <h3 className="font-display text-2xl font-semibold text-[var(--text-heading)] tabular-nums">12 days</h3>
                            <p className="text-[11px] text-[var(--text-muted)] mt-2">Consistent daily activity</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Scoring Breakdown */}
                        <div className="lg:col-span-2 bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border)]">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-sm font-semibold text-[var(--text-heading)] flex items-center">
                                    <Activity className="mr-2 text-[var(--accent)]" size={16} /> Metric analysis
                                </h3>
                                <div className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getTierStyle(currentStats.performanceTier)}`}>
                                    Tier: {currentStats.performanceTier}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { label: 'Task throughput', value: currentStats.completionRate, weight: '30%' },
                                    { label: 'SLA compliance', value: currentStats.onTimeRate, weight: '25%' },
                                    { label: 'Attendance & punctuality', value: currentStats.punctualityScore, weight: '20%' },
                                    { label: 'Quality of submissions', value: currentStats.qualityScore, weight: '15%' },
                                    { label: 'Difficulty overhead', value: currentStats.difficultyBonus * 10, weight: '10%' },
                                ].map((metric, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-[var(--text-heading)] font-medium">{metric.label}</span>
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-[var(--text-muted)] text-[11px]">Weight: {metric.weight}</span>
                                                <span className="text-[var(--text-heading)] font-semibold tabular-nums">{metric.value.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-[var(--accent)]"
                                                style={{ width: `${metric.value}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Finalized Cycles */}
                        <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border)] h-full">
                            <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-4 flex items-center">
                                <Calendar className="mr-2 text-[var(--accent)]" size={16} /> History
                            </h3>
                            {history.length > 0 ? (
                                <div className="space-y-2">
                                    {history.map((cycle, i) => {
                                        const myScore = cycle.staff_scores[user!.uid];
                                        return (
                                            <div key={i} className="flex items-center justify-between p-3 bg-[var(--bg-main)] rounded-lg border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] font-semibold text-xs tabular-nums text-center">
                                                        {cycle.month.split('-')[1]}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium text-[var(--text-heading)]">{format(new Date(cycle.month), 'MMMM yyyy')}</p>
                                                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">Score: {myScore.total_score.toFixed(1)}%</p>
                                                    </div>
                                                </div>
                                                {myScore.total_score >= 80 ? <Star className="text-[var(--color-warning)] fill-[var(--color-warning)]" size={14} /> : <ChevronRight className="text-[var(--text-subtle)]" size={14} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
                                    <Shield size={36} className="mb-2 opacity-30" />
                                    <p className="text-xs text-center">No finalized cycles found yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'achievements' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {ACHIEVEMENT_REGISTRY.map((ach, i) => {
                        const Icon = (Icons as any)[ach.icon] || Icons.Award;
                        const isUnlocked = currentStats.totalScore > 80 || i < 2;

                        return (
                            <div key={ach.id} className={`bg-[var(--bg-surface)] p-4 rounded-xl border transition-colors ${isUnlocked ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-50'}`}>
                                <div className="w-10 h-10 rounded-lg bg-[var(--accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent)] mb-3">
                                    <Icon size={20} />
                                </div>
                                <h4 className="font-semibold text-sm text-[var(--text-heading)] mb-1">{ach.name}</h4>
                                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{ach.description}</p>
                                <div className="mt-3 flex items-center justify-between text-xs">
                                    <span className="text-[11px] font-medium text-[var(--accent)]">{ach.rarity}</span>
                                    {!isUnlocked && <Lock size={12} className="text-[var(--text-subtle)]" />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'goals' && (
                <div className="bg-[var(--bg-surface)] p-8 rounded-xl border border-[var(--border)]">
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                        <div className="w-12 h-12 bg-[var(--accent-dim)] border border-[var(--border-accent)] rounded-xl flex items-center justify-center text-[var(--accent)] mb-1">
                            <Target size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--text-heading)]">Future goal setting</h3>
                        <p className="text-xs text-[var(--text-muted)] max-w-sm">We are building a structured way for you to set and track personal career goals with your manager. Stay tuned!</p>
                        <button type="button" className="bg-[var(--accent)] text-[var(--on-accent)] px-4 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
                            Suggest a goal
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyPerformancePage;
