import React, { useState, useEffect } from 'react';
import {
    Trophy, TrendingUp, Clock, CheckCircle2, User,
    Calendar, ArrowUpRight, ArrowDownRight, Loader2,
    BarChart3, Award, Star, FileDown, AlertTriangle, Zap,
    CheckCircle, XCircle, Info, HelpCircle, Lock, Unlock
} from 'lucide-react';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, limit } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { PerformanceCycle } from '../types';
import { PerformanceService, PerformanceStats } from '../services/performance';
import { AuthService } from '../services/firebase';
import { UserProfile } from '../types';
import { format, subMonths } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';

const PerformancePage: React.FC = () => {
    const { user } = useAuth();
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<Record<string, PerformanceStats>>({});
    const [staffOfTheMonth, setStaffOfTheMonth] = useState<{ profile: UserProfile, score: number } | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(0);
    const [finalizedCycle, setFinalizedCycle] = useState<PerformanceCycle | null>(null);
    const [activeTab, setActiveTab] = useState<'roster' | 'leaderboard'>('roster');
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [showScoringInfo, setShowScoringInfo] = useState(false);
    const [viewMode, setViewMode] = useState<'monthly' | 'quarterly'>('monthly');
    const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, [selectedMonth, viewMode, selectedQuarter, selectedYear]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const users = await AuthService.getAllStaff();
            setStaff(users);

            if (viewMode === 'monthly') {
                // Check if month is finalized
                const monthKey = subMonths(new Date(), selectedMonth).toISOString().substring(0, 7);
                const cycleDoc = await getDoc(doc(db, 'performance_cycles', `${monthKey}_default`));

                if (cycleDoc.exists()) {
                    const cycleData = cycleDoc.data() as PerformanceCycle;
                    setFinalizedCycle(cycleData);

                    const scores: Record<string, PerformanceStats> = {};
                    Object.entries(cycleData.staff_scores).forEach(([uid, s]: [string, any]) => {
                        scores[uid] = {
                            totalTasks: s.metrics?.total_tasks || 0,
                            completedTasks: s.metrics?.completed_tasks || 0,
                            onTimeTasks: s.metrics?.on_time_tasks || 0,
                            overdueTasks: 0,
                            completionRate: s.components.completion_rate,
                            onTimeRate: s.components.on_time_delivery,
                            punctualityScore: s.components.punctuality,
                            qualityScore: s.components.task_quality,
                            difficultyBonus: s.components.task_difficulty,
                            totalScore: s.total_score,
                            eligibility: {
                                qualified: s.eligibility.qualified,
                                failedCriteria: s.eligibility.failed_criteria || []
                            },
                            highPriorityTasks: 0,
                            highPriorityCompleted: 0,
                            highPriorityRate: 0,
                            avgWorkHours: 0,
                            presentDays: s.metrics?.present_days || 0,
                            lateDays: 0,
                            absentDays: 0,
                            benchmark: null,
                            performanceTier: s.total_score >= 90 ? 'Exceptional' : s.total_score >= 75 ? 'Strong' : s.total_score >= 60 ? 'Meeting Expectations' : s.total_score >= 40 ? 'Needs Improvement' : 'Critical',
                            avgCycleTime: 0,
                            assignmentFulfillment: 0,
                            dueDateFulfillment: 0
                        };
                    });
                    setPerformanceData(scores);
                } else {
                    setFinalizedCycle(null);
                    const scores: Record<string, PerformanceStats> = {};
                    for (const user of users) {
                        const stats = await PerformanceService.getStaffPerformance(user.uid, selectedMonth);
                        scores[user.uid] = stats;
                    }
                    setPerformanceData(scores);
                }
            } else {
                // Quarterly Mode
                setFinalizedCycle(null);
                const scores: Record<string, PerformanceStats> = {};
                for (const user of users) {
                    const stats = await PerformanceService.getQuarterlyPerformance(user.uid, selectedQuarter, selectedYear);
                    scores[user.uid] = stats;
                }
                setPerformanceData(scores);
            }

            // Staff of the month logic
            if (selectedMonth === 0) {
                const som = await PerformanceService.getStaffOfTheMonth();
                if (som) {
                    const profile = users.find(u => u.uid === som.staffId);
                    if (profile) {
                        setStaffOfTheMonth({ profile, score: som.score });
                    }
                }
            }

            // Calculate benchmarks (live only for current month or if cycle doesn't have them)
            const scoresList = Object.values(performanceData);
            if (scoresList.length > 0) {
                const allScores = scoresList.map(s => s.totalScore).sort((a, b) => b - a);
                const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;

                setPerformanceData(prev => {
                    const updated = { ...prev };
                    Object.keys(updated).forEach(uid => {
                        const rank = allScores.indexOf(updated[uid].totalScore) + 1;
                        updated[uid] = {
                            ...updated[uid],
                            benchmark: {
                                isAboveAverage: updated[uid].totalScore > avgScore,
                                rank,
                                totalStaff: allScores.length,
                                percentile: Math.round(((allScores.length - rank + 1) / allScores.length) * 100)
                            }
                        };
                    });
                    return updated;
                });
            }

        } catch (error) {
            console.error("Failed to load performance data", error);
            toast.error("Error loading performance metrics");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalize = async () => {
        if (!window.confirm("Are you sure you want to finalize performance for the PREVIOUS month? This will freeze all scores and identify the Staff of the Month.")) return;

        setIsFinalizing(true);
        try {
            const lastMonth = subMonths(new Date(), 1);
            const monthKey = lastMonth.toISOString().substring(0, 7);
            await PerformanceService.finalizeMonthlyPerformance(monthKey, 'default');
            toast.success(`Performance finalized for ${format(lastMonth, 'MMMM yyyy')}!`);
            fetchInitialData();
        } catch (error) {
            console.error("Finalization failed", error);
            toast.error("Failed to finalize performance");
        } finally {
            setIsFinalizing(false);
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'Exceptional': return 'text-brand-400 bg-brand-500/10 border-brand-500/30';
            case 'Strong': return 'text-brand-400 bg-brand-500/10 border-brand-500/30';
            case 'Meeting Expectations': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'Needs Improvement': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            default: return 'text-red-400 bg-red-500/10 border-red-500/30';
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        const targetDate = subMonths(new Date(), selectedMonth);

        // Enhanced Letterhead with violet gradient
        doc.setFillColor(124, 58, 237); // Violet-600
        doc.rect(0, 0, 210, 45, 'F');

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("R. SAPKOTA & ASSOCIATES", 105, 18, { align: "center" });

        doc.setFontSize(10);
        doc.setTextColor(233, 213, 255); // Light violet
        doc.setFont("helvetica", "normal");
        doc.text("Chartered Accountants | Mid-Baneshwor, Kathmandu", 105, 26, { align: "center" });

        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Staff Performance Evaluation Report", 105, 38, { align: "center" });

        // Report info
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text(`Period: ${format(targetDate, 'MMMM yyyy')}`, 14, 55);
        doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 61);
        doc.text(`Total Staff Evaluated: ${staff.length}`, 14, 67);

        // Table data
        const tableColumn = ["Staff", "Score", "Tier", "Tasks", "Completion", "On-Time", "Punctuality", "Priority"];
        const tableRows = staff.map(member => {
            const stats = performanceData[member.uid];
            if (!stats) return null;
            return [
                member.displayName,
                stats.totalScore.toFixed(1) + '%',
                stats.performanceTier,
                `${stats.completedTasks}/${stats.totalTasks}`,
                stats.completionRate.toFixed(0) + '%',
                stats.onTimeRate.toFixed(0) + '%',
                stats.punctualityScore.toFixed(0) + '%',
                stats.highPriorityRate.toFixed(0) + '%'
            ];
        }).filter(Boolean);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows as any,
            startY: 75,
            theme: 'grid',
            headStyles: {
                fillColor: [124, 58, 237],  // Violet-600
                textColor: [255, 255, 255], // White
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 8
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                fillColor: [250, 245, 255], // Light violet
                textColor: [76, 29, 149]    // Violet-900
            },
            alternateRowStyles: {
                fillColor: [237, 233, 254]  // Violet-100
            },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { halign: 'center', fontStyle: 'bold' },
                2: { halign: 'center' }
            }
        });

        // Benchmark summary
        const finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(11);
        doc.setTextColor(59, 130, 246);
        doc.setFont("helvetica", "bold");
        doc.text("Benchmark Summary", 14, finalY);

        const avgScore = Object.values(performanceData).reduce((sum, s) => sum + s.totalScore, 0) / staff.length;
        const exceptional = Object.values(performanceData).filter(s => s.performanceTier === 'Exceptional').length;
        const needsImprovement = Object.values(performanceData).filter(s =>
            s.performanceTier === 'Needs Improvement' || s.performanceTier === 'Critical'
        ).length;

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text(`• Average Team Score: ${avgScore.toFixed(1)}%`, 18, finalY + 8);
        doc.text(`• Exceptional Performers: ${exceptional} staff members`, 18, finalY + 14);
        doc.text(`• Needing Improvement: ${needsImprovement} staff members`, 18, finalY + 20);

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
            doc.text("Confidential - RSA Portal Performance Analytics", 14, 285);
        }

        doc.save(`RSA_Performance_Report_${format(targetDate, 'MMM_yyyy')}.pdf`);
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">Performance Evaluation</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-400">Comprehensive staff performance metrics and benchmarking</p>
                        <button
                            onClick={() => setShowScoringInfo(!showScoringInfo)}
                            className="text-gray-500 hover:text-brand-400 transition-colors"
                        >
                            <HelpCircle size={14} />
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-4">
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'monthly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white'}`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setViewMode('quarterly')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'quarterly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white'}`}
                        >
                            Quarterly
                        </button>
                    </div>

                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-4">
                        <button
                            onClick={() => setActiveTab('roster')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'roster' ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'text-gray-400'}`}
                        >
                            Staff Roster
                        </button>
                        <button
                            onClick={() => setActiveTab('leaderboard')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'text-gray-400'}`}
                        >
                            Leaderboard
                        </button>
                    </div>

                    {viewMode === 'monthly' ? (
                        <>
                            {AuthService.isAdmin(user?.role) && selectedMonth === 0 && !finalizedCycle && (
                                <button
                                    onClick={handleFinalize}
                                    disabled={isFinalizing}
                                    className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-lg transition-all"
                                >
                                    {isFinalizing ? <Loader2 size={16} className="animate-spin mr-2" /> : <Lock size={16} className="mr-2" />}
                                    Finalize {format(subMonths(new Date(), 1), 'MMM')} Performance
                                </button>
                            )}
                            {finalizedCycle && (
                                <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 px-3 py-1.5 rounded-lg">
                                    <Lock size={14} className="text-brand-400" />
                                    <span className="text-xs font-bold text-brand-400 uppercase tracking-tight">Finalized</span>
                                </div>
                            )}
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value={0}>{format(new Date(), 'MMMM yyyy')}</option>
                                <option value={1}>{format(subMonths(new Date(), 1), 'MMMM yyyy')}</option>
                                <option value={2}>{format(subMonths(new Date(), 2), 'MMMM yyyy')}</option>
                                <option value={3}>{format(subMonths(new Date(), 3), 'MMMM yyyy')}</option>
                            </select>
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedQuarter}
                                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value={0}>Q1 (Jan - Mar)</option>
                                <option value={1}>Q2 (Apr - Jun)</option>
                                <option value={2}>Q3 (Jul - Sep)</option>
                                <option value={3}>Q4 (Oct - Dec)</option>
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            >
                                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                            </select>
                        </div>
                    )}
                    <button
                        onClick={exportPDF}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                    >
                        <FileDown size={16} className="mr-2" /> Export PDF
                    </button>
                </div>
            </div>

            {showScoringInfo && (
                <div className="glass-panel p-6 rounded-2xl border border-brand-500/30 bg-brand-500/5 animate-in slide-in-from-top duration-300">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                        <Info size={20} className="mr-2 text-brand-400" /> Weighted Scoring Algorithm
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Completion Rate', weight: '30%', desc: 'Tasks completed vs assigned' },
                            { label: 'On-Time Delivery', weight: '25%', desc: 'Completed before due date' },
                            { label: 'Punctuality', weight: '20%', desc: 'Clock-in consistency' },
                            { label: 'Quality Score', weight: '15%', desc: 'Accuracy and feedback' },
                            { label: 'Difficulty Bonus', weight: '10%', desc: 'Complexity and priority' },
                        ].map((item, i) => (
                            <div key={i} className="space-y-1 text-center md:text-left">
                                <p className="text-sm font-bold text-white">{item.label}</p>
                                <p className="text-2xl font-black text-brand-400">{item.weight}</p>
                                <p className="text-[10px] text-gray-500">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Staff of the Month Section */}
            {staffOfTheMonth && selectedMonth === 0 && (
                <div className="relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-600/20 to-brand-/20 rounded-3xl blur-3xl -z-10 animate-pulse" />
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
                                    <p className="text-xl font-mono font-bold text-brand-400">{staffOfTheMonth.score.toFixed(1)}%</p>
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
            )
            }

            {/* Team Benchmark Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl border-l-4 border-l-brand-500">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Avg Team Score</p>
                    <p className="text-2xl font-bold text-white">
                        {(Object.values(performanceData).reduce((sum, s) => sum + s.totalScore, 0) / Math.max(staff.length, 1)).toFixed(1)}%
                    </p>
                </div>
                <div className="glass-panel p-4 rounded-xl border-l-4 border-l-brand-">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Exceptional</p>
                    <p className="text-2xl font-bold text-brand-400">
                        {Object.values(performanceData).filter(s => s.performanceTier === 'Exceptional').length}
                    </p>
                </div>
                <div className="glass-panel p-4 rounded-xl border-l-4 border-l-orange-500">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Needs Improvement</p>
                    <p className="text-2xl font-bold text-orange-400">
                        {Object.values(performanceData).filter(s => s.performanceTier === 'Needs Improvement' || s.performanceTier === 'Critical').length}
                    </p>
                </div>
                <div className="glass-panel p-4 rounded-xl border-l-4 border-l-red-500">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Overdue Tasks</p>
                    <p className="text-2xl font-bold text-red-400">
                        {Object.values(performanceData).reduce((sum, s) => sum + s.overdueTasks, 0)}
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            {activeTab === 'roster' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                    {staff.map((member) => {
                        const stats = performanceData[member.uid];
                        if (!stats) return null;

                        return (
                            <div
                                key={member.uid}
                                onClick={() => setExpandedStaffId(expandedStaffId === member.uid ? null : member.uid)}
                                className={`glass-panel p-6 rounded-2xl border transition-all cursor-pointer ${expandedStaffId === member.uid ? 'border-brand-500 ring-2 ring-brand-500/20 bg-white/[0.04]' : 'border-white/10 hover:border-brand-500/40 hover:bg-white/[0.02]'}`}
                            >
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-xl bg-navy-800 flex items-center justify-center font-bold text-white border border-white/5">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} className="w-full h-full object-cover rounded-xl" alt="" />
                                            ) : (
                                                member.displayName?.[0]
                                            )}
                                        </div>
                                        {stats.totalScore >= 90 && (
                                            <div className="absolute -top-1 -right-1 bg-yellow-500 text-navy-900 rounded-full p-0.5 border-2 border-navy-900">
                                                <Trophy size={10} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-white">{member.displayName}</h3>
                                        <p className="text-xs text-gray-500 capitalize">{member.role.replace('_', ' ')} • {member.department || 'General'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-lg font-mono font-bold ${stats.totalScore > 85 ? 'text-brand-400' : stats.totalScore > 60 ? 'text-brand-400' : 'text-orange-400'}`}>
                                            {stats.totalScore.toFixed(0)}
                                        </span>
                                        <span className="text-[10px] text-gray-600 font-bold">/100</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400">Weighted Performance</span>
                                        <span className="text-white font-mono">{stats.totalScore.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${stats.totalScore > 85 ? 'bg-brand-500' : stats.totalScore > 60 ? 'bg-brand-500' : 'bg-orange-500'}`}
                                            style={{ width: `${stats.totalScore}%` }}
                                        />
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedStaffId === member.uid && (
                                        <div className="pt-4 mt-4 border-t border-white/5 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="bg-white/5 p-2 rounded-lg">
                                                <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Fulfillment</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-white">{(stats.assignmentFulfillment || 0).toFixed(0)}%</span>
                                                    <TrendingUp size={10} className="text-brand-400" />
                                                </div>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-lg">
                                                <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">On-Time Rate</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-white">{(stats.dueDateFulfillment || 0).toFixed(0)}%</span>
                                                    <Clock size={10} className="text-amber-400" />
                                                </div>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-lg">
                                                <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Avg Cycle Time</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-white">{(stats.avgCycleTime || 0).toFixed(1)} <span className="text-[8px] text-gray-500 uppercase">Days</span></span>
                                                    <Zap size={10} className="text-yellow-400" />
                                                </div>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-lg">
                                                <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Tasks</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-white">{stats.completedTasks} / {stats.totalTasks}</span>
                                                    <CheckCircle2 size={10} className="text-brand-400" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!expandedStaffId && (
                                        <p className="text-[9px] text-gray-600 text-center animate-pulse">Click to view detailed metrics</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="glass-panel p-8 rounded-3xl border border-white/10 animate-in fade-in zoom-in-95 duration-500">
                    <div className="space-y-4">
                        {staff
                            .sort((a, b) => (performanceData[b.uid]?.totalScore || 0) - (performanceData[a.uid]?.totalScore || 0))
                            .map((member, index) => {
                                const stats = performanceData[member.uid];
                                if (!stats) return null;
                                return (
                                    <div key={member.uid} className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-all group">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-amber-600 text-black' : 'text-gray-500'}`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-navy-800 flex items-center justify-center font-bold text-white border border-white/5">
                                                {member.displayName?.[0]}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white">{member.displayName}</h4>
                                                <p className="text-[10px] text-gray-500 uppercase font-black">{member.department || 'General'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold">Total Score</p>
                                                <p className="text-lg font-mono font-bold text-white">{stats.totalScore.toFixed(1)}%</p>
                                            </div>
                                            <div className="w-24">
                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-brand-500" style={{ width: `${stats.totalScore}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformancePage;
