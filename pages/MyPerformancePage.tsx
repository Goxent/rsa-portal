import React, { useState, useEffect } from 'react';
import {
    Trophy, TrendingUp, Clock, CheckCircle2,
    Calendar, Award, Star, Zap, Activity,
    Target, Flame, Shield, ChevronRight, Info, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PerformanceService, PerformanceStats } from '../services/performance';
import { PerformanceCycle } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { format, subMonths } from 'date-fns';
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
            // Get current month performance
            const stats = await PerformanceService.getStaffPerformance(user!.uid, 0);
            setCurrentStats(stats);

            // Get past 6 finalized cycles
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
                <Activity className="animate-spin text-brand-500 mb-4" size={48} />
                <p className="text-gray-400">Loading your performance metrics...</p>
            </div>
        );
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'Exceptional': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'Strong': return 'text-brand-400 bg-brand-500/10 border-brand-500/20';
            case 'Meeting Expectations': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            default: return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-brand-500/20">
                        {user?.displayName?.[0] || 'U'}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white tracking-tight">Your Performance</h1>
                        <p className="text-gray-400 flex items-center gap-2 mt-1">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            {currentStats.performanceTier} Performer • {currentStats.totalScore.toFixed(0)} Points this month
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    {(['overview', 'achievements', 'goals'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeTab === tab
                                ? 'bg-brand-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-brand-500 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-brand-500/10 group-hover:text-brand-500/20 transition-colors">
                                <Trophy size={64} />
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Current Score</p>
                            <h3 className="text-4xl font-black text-white">{currentStats.totalScore.toFixed(1)}%</h3>
                            <div className="mt-4 flex items-center text-xs text-emerald-400 font-bold">
                                <TrendingUp size={14} className="mr-1" /> Above average by 4.2%
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-emerald-500 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors">
                                <CheckCircle2 size={64} />
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Completion</p>
                            <h3 className="text-4xl font-black text-white">{currentStats.completionRate.toFixed(0)}%</h3>
                            <p className="text-[10px] text-gray-400 mt-4 uppercase font-bold">{currentStats.completedTasks}/{currentStats.totalTasks} Tasks Finished</p>
                        </div>

                        <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-orange-500 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-orange-500/10 group-hover:text-orange-500/20 transition-colors">
                                <Clock size={64} />
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Punctuality</p>
                            <h3 className="text-4xl font-black text-white">{currentStats.punctualityScore.toFixed(0)}%</h3>
                            <div className="mt-4 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500" style={{ width: `${currentStats.punctualityScore}%` }} />
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-3xl border-l-4 border-l-indigo-500 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-indigo-500/10 group-hover:text-indigo-500/20 transition-colors">
                                <Flame size={64} />
                            </div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Daily Streak</p>
                            <h3 className="text-4xl font-black text-white">12 Days</h3>
                            <p className="text-[10px] text-gray-400 mt-4 uppercase font-bold">Keep it up to earn 50 Bonus XP!</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Scoring Breakdown */}
                        <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border-white/5">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center">
                                    <Activity className="mr-2 text-brand-400" size={20} /> Metric Analysis
                                </h3>
                                <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${getTierColor(currentStats.performanceTier)}`}>
                                    Tier: {currentStats.performanceTier}
                                </div>
                            </div>

                            <div className="space-y-6">
                                {[
                                    { label: 'Task Throughput', value: currentStats.completionRate, color: 'bg-brand-500', weight: '30%' },
                                    { label: 'SLA Compliance', value: currentStats.onTimeRate, color: 'bg-emerald-500', weight: '25%' },
                                    { label: 'Attendance & Punctuality', value: currentStats.punctualityScore, color: 'bg-orange-500', weight: '20%' },
                                    { label: 'Quality of Submissions', value: currentStats.qualityScore, color: 'bg-blue-500', weight: '15%' },
                                    { label: 'Difficulty Overhead', value: currentStats.difficultyBonus * 10, color: 'bg-indigo-500', weight: '10%' },
                                ].map((metric, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-300 font-medium">{metric.label}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500 text-[10px] uppercase font-bold italic">Weight: {metric.weight}</span>
                                                <span className="text-white font-bold font-mono">{metric.value.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-navy-800 rounded-full p-0.5">
                                            <div
                                                className={`h-full rounded-full ${metric.color} shadow-lg shadow-${metric.color.split('-')[1]}-500/20`}
                                                style={{ width: `${metric.value}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Finalized Cycles */}
                        <div className="glass-panel p-8 rounded-3xl border-white/5 h-full">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center">
                                <Calendar className="mr-2 text-brand-400" size={20} /> History
                            </h3>
                            {history.length > 0 ? (
                                <div className="space-y-4">
                                    {history.map((cycle, i) => {
                                        const myScore = cycle.staff_scores[user!.uid];
                                        return (
                                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-brand-500/30 transition-all cursor-pointer group">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-navy-800 p-2.5 rounded-xl text-brand-400 group-hover:scale-110 transition-transform font-bold text-xs uppercase text-center">
                                                        {cycle.month.split('-')[1]}<br />{cycle.month.split('-')[0].substring(2)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{format(new Date(cycle.month), 'MMMM yyyy')}</p>
                                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Score: {myScore.total_score.toFixed(1)}%</p>
                                                    </div>
                                                </div>
                                                {myScore.total_score >= 80 ? <Star className="text-yellow-500 fill-yellow-500" size={16} /> : <ChevronRight className="text-gray-600" size={16} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                                    <Shield size={48} className="mb-2" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-center">No finalized cycles<br />found yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'achievements' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in zoom-in-95 duration-500">
                    {ACHIEVEMENT_REGISTRY.map((ach, i) => {
                        const Icon = (Icons as any)[ach.icon] || Icons.Award;
                        const isUnlocked = currentStats.totalScore > 80 || i < 2;

                        return (
                            <div key={ach.id} className={`glass-panel p-6 rounded-3xl border-2 transition-all group ${isUnlocked ? 'border-brand-500/30 opacity-100 hover:scale-[1.02]' : 'border-white/5 opacity-50 grayscale'}`}>
                                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 mb-4 shadow-lg">
                                    <Icon size={28} />
                                </div>
                                <h4 className="font-bold text-white text-lg mb-1">{ach.name}</h4>
                                <p className="text-xs text-gray-500 leading-relaxed font-medium">{ach.description}</p>
                                <div className="mt-4 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-brand-400/60">{ach.rarity}</span>
                                    {!isUnlocked && <Lock size={12} className="text-gray-600" />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {activeTab === 'goals' && (
                <div className="glass-panel p-8 rounded-3xl border-white/5 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center text-brand-400 mb-2">
                            <Target size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-white">Future Goal Setting</h3>
                        <p className="text-gray-400 max-w-sm">We're building a structured way for you to set and track personal career goals with your manager. Stay tuned!</p>
                        <button className="bg-brand-600 px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 hover:scale-105 transition-transform">
                            Suggest a Goal
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyPerformancePage;
