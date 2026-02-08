import React, { useState, useEffect } from 'react';
import {
    Trophy, TrendingUp, Clock, CheckCircle2, User,
    Calendar, ArrowUpRight, ArrowDownRight, Loader2,
    BarChart3, Award, Star
} from 'lucide-react';
import { PerformanceService, PerformanceStats } from '../services/performance';
import { AuthService } from '../services/firebase';
import { UserProfile } from '../types';
import { format, subMonths } from 'date-fns';

const PerformancePage: React.FC = () => {
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<Record<string, PerformanceStats>>({});
    const [staffOfTheMonth, setStaffOfTheMonth] = useState<{ profile: UserProfile, score: number } | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const users = await AuthService.getAllStaff();
            setStaff(users);

            const scores: Record<string, PerformanceStats> = {};
            let topStaffRef = null;
            let topScore = -1;

            for (const user of users) {
                const stats = await PerformanceService.getStaffPerformance(user.uid);
                scores[user.uid] = stats;

                // For Staff of the Month, check previous month
                const lastMonthStats = await PerformanceService.getStaffPerformance(user.uid, 1);
                if (lastMonthStats.totalScore > topScore && lastMonthStats.totalTasks > 0) {
                    topScore = lastMonthStats.totalScore;
                    topStaffRef = { profile: user, score: topScore };
                }
            }
            setPerformanceData(scores);
            setStaffOfTheMonth(topStaffRef);
        } catch (error) {
            console.error("Failed to load performance data", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <Loader2 size={48} className="animate-spin text-brand-500 mb-4" />
                <p className="text-gray-400 font-medium">Analyzing historical performance data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">Performance Evaluation</h1>
                    <p className="text-sm text-gray-400">Monthly staff performance metrics and historical analysis</p>
                </div>
                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-brand-400 text-sm font-bold flex items-center">
                    <Calendar size={16} className="mr-2" /> {format(new Date(), 'MMMM yyyy')}
                </div>
            </div>

            {/* Staff of the Month Section */}
            {staffOfTheMonth && (
                <div className="relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-600/20 to-emerald-600/20 rounded-3xl blur-3xl -z-10 animate-pulse" />
                    <div className="glass-panel p-8 rounded-3xl border-2 border-brand-500/30 flex flex-col md:flex-row items-center gap-8 relative">
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full border-4 border-brand-500 p-1 shadow-2xl overflow-hidden ring-8 ring-brand-500/10">
                                {staffOfTheMonth.profile.photoURL ? (
                                    <img src={staffOfTheMonth.profile.photoURL} alt={staffOfTheMonth.profile.displayName} className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <div className="w-full h-full bg-navy-800 flex items-center justify-center text-3xl font-bold text-brand-400">
                                        {staffOfTheMonth.profile.displayName?.[0]}
                                    </div>
                                )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-brand-500 p-2 rounded-full shadow-lg border-4 border-navy-900 text-white">
                                <Trophy size={20} />
                            </div>
                        </div>

                        <div className="text-center md:text-left space-y-2">
                            <span className="px-3 py-1 bg-brand-500/20 text-brand-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-brand-500/30">Official Staff of the Month</span>
                            <h2 className="text-4xl font-black text-white">{staffOfTheMonth.profile.displayName}</h2>
                            <p className="text-gray-400 max-w-md">Recognized for exceptional task completion rate and punctuality throughout the previous month.</p>

                            <div className="flex flex-wrap gap-4 mt-4">
                                <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Performance Score</p>
                                    <p className="text-xl font-mono font-bold text-emerald-400">{staffOfTheMonth.score.toFixed(1)}%</p>
                                </div>
                                <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Status</p>
                                    <p className="text-xl font-bold text-white flex items-center"><Award size={18} className="mr-2 text-yellow-500" /> Outstanding</p>
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:block ml-auto opacity-10 group-hover:opacity-20 transition-opacity">
                            <Award size={160} />
                        </div>
                    </div>
                </div>
            )}

            {/* Detailed Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staff.map((member) => {
                    const stats = performanceData[member.uid];
                    if (!stats) return null;

                    return (
                        <div key={member.uid} className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500/40 transition-all hover:bg-white/[0.02]">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-navy-800 flex items-center justify-center font-bold text-white border border-white/5">
                                    {member.displayName?.[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{member.displayName}</h3>
                                    <p className="text-xs text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
                                </div>
                                <div className="ml-auto flex items-center">
                                    <span className={`text-lg font-mono font-bold ${stats.totalScore > 85 ? 'text-emerald-400' : stats.totalScore > 60 ? 'text-brand-400' : 'text-orange-400'}`}>
                                        {stats.totalScore.toFixed(0)}
                                    </span>
                                    <span className="text-[10px] text-gray-600 font-bold ml-1">/100</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-400 flex items-center"><CheckCircle2 size={12} className="mr-1" /> Completion Rate</span>
                                        <span className="text-white font-mono">{stats.completionRate.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-brand-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${stats.completionRate}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-400 flex items-center"><Clock size={12} className="mr-1" /> Punctuality Score</span>
                                        <span className="text-white font-mono">{stats.punctualityScore.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${stats.punctualityScore}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/5 text-center">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">Tasks Assigned</p>
                                        <p className="text-sm font-bold text-white">{stats.totalTasks}</p>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/5 text-center">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">On-Time</p>
                                        <p className="text-sm font-bold text-white">{stats.onTimeTasks}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PerformancePage;
