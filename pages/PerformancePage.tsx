import React, { useState, useEffect } from 'react';
import {
    Trophy, TrendingUp, Clock, CheckCircle2, User,
    Calendar, ArrowUpRight, ArrowDownRight, Loader2,
    BarChart3, Award, Star, FileDown, AlertTriangle, Zap
} from 'lucide-react';
import { PerformanceService, PerformanceStats } from '../services/performance';
import { AuthService } from '../services/firebase';
import { UserProfile } from '../types';
import { format, subMonths } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PerformancePage: React.FC = () => {
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<Record<string, PerformanceStats>>({});
    const [staffOfTheMonth, setStaffOfTheMonth] = useState<{ profile: UserProfile, score: number } | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(0); // 0 = current month

    useEffect(() => {
        fetchInitialData();
    }, [selectedMonth]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const users = await AuthService.getAllStaff();
            setStaff(users);

            const scores: Record<string, PerformanceStats> = {};
            let topStaffRef = null;
            let topScore = -1;

            for (const user of users) {
                const stats = await PerformanceService.getStaffPerformance(user.uid, selectedMonth);
                scores[user.uid] = stats;

                // For Staff of the Month, check previous month
                if (selectedMonth === 0) {
                    const lastMonthStats = await PerformanceService.getStaffPerformance(user.uid, 1);
                    if (lastMonthStats.totalScore > topScore && lastMonthStats.totalTasks > 0) {
                        topScore = lastMonthStats.totalScore;
                        topStaffRef = { profile: user, score: topScore };
                    }
                }
            }

            // Calculate benchmarks
            const allScores = Object.values(scores).map(s => s.totalScore).sort((a, b) => b - a);
            const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;

            Object.keys(scores).forEach((uid) => {
                const rank = allScores.indexOf(scores[uid].totalScore) + 1;
                scores[uid] = {
                    ...scores[uid],
                    benchmark: {
                        isAboveAverage: scores[uid].totalScore > avgScore,
                        rank,
                        totalStaff: allScores.length,
                        percentile: Math.round(((allScores.length - rank + 1) / allScores.length) * 100)
                    }
                };
            });

            setPerformanceData(scores);
            setStaffOfTheMonth(topStaffRef);
        } catch (error) {
            console.error("Failed to load performance data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'Exceptional': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
            case 'Strong': return 'text-brand-400 bg-brand-500/10 border-brand-500/30';
            case 'Meeting Expectations': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
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
        doc.text("R. Sapkota & Associates", 105, 18, { align: "center" });

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
                    <p className="text-sm text-gray-400">Comprehensive staff performance metrics and benchmarking</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
                    >
                        <option value={0}>{format(new Date(), 'MMMM yyyy')}</option>
                        <option value={1}>{format(subMonths(new Date(), 1), 'MMMM yyyy')}</option>
                        <option value={2}>{format(subMonths(new Date(), 2), 'MMMM yyyy')}</option>
                        <option value={3}>{format(subMonths(new Date(), 3), 'MMMM yyyy')}</option>
                    </select>
                    <button
                        onClick={exportPDF}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-lg"
                    >
                        <FileDown size={16} className="mr-2" /> Export PDF
                    </button>
                </div>
            </div>

            {/* Staff of the Month Section */}
            {staffOfTheMonth && selectedMonth === 0 && (
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

            {/* Team Benchmark Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl border-l-4 border-l-brand-500">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Avg Team Score</p>
                    <p className="text-2xl font-bold text-white">
                        {(Object.values(performanceData).reduce((sum, s) => sum + s.totalScore, 0) / Math.max(staff.length, 1)).toFixed(1)}%
                    </p>
                </div>
                <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Exceptional</p>
                    <p className="text-2xl font-bold text-emerald-400">
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

            {/* Detailed Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staff.map((member) => {
                    const stats = performanceData[member.uid];
                    if (!stats) return null;

                    return (
                        <div key={member.uid} className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500/40 transition-all hover:bg-white/[0.02]">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-navy-800 flex items-center justify-center font-bold text-white border border-white/5">
                                    {member.displayName?.[0]}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white">{member.displayName}</h3>
                                    <p className="text-xs text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`text-lg font-mono font-bold ${stats.totalScore > 85 ? 'text-emerald-400' : stats.totalScore > 60 ? 'text-brand-400' : 'text-orange-400'}`}>
                                        {stats.totalScore.toFixed(0)}
                                    </span>
                                    <span className="text-[10px] text-gray-600 font-bold">/100</span>
                                </div>
                            </div>

                            {/* Performance Tier Badge */}
                            <div className="mb-4">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getTierColor(stats.performanceTier)}`}>
                                    {stats.performanceTier}
                                </span>
                                {stats.benchmark && (
                                    <span className="ml-2 text-[10px] text-gray-500">
                                        Rank #{stats.benchmark.rank} of {stats.benchmark.totalStaff}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-3">
                                {/* Completion Rate */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400 flex items-center"><CheckCircle2 size={12} className="mr-1" /> Completion Rate</span>
                                        <span className="text-white font-mono">{stats.completionRate.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${stats.completionRate}%` }} />
                                    </div>
                                </div>

                                {/* Punctuality Score */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400 flex items-center"><Clock size={12} className="mr-1" /> Punctuality Score</span>
                                        <span className="text-white font-mono">{stats.punctualityScore.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.punctualityScore}%` }} />
                                    </div>
                                </div>

                                {/* High Priority Handling */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-400 flex items-center"><Zap size={12} className="mr-1" /> Priority Handling</span>
                                        <span className="text-white font-mono">{stats.highPriorityRate.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-navy-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${stats.highPriorityRate}%` }} />
                                    </div>
                                </div>

                                {/* Extended Stats Grid */}
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
                                    <div className="bg-black/20 p-2 rounded-lg text-center">
                                        <p className="text-[9px] text-gray-500 uppercase">Tasks</p>
                                        <p className="text-sm font-bold text-white">{stats.completedTasks}/{stats.totalTasks}</p>
                                    </div>
                                    <div className="bg-black/20 p-2 rounded-lg text-center">
                                        <p className="text-[9px] text-gray-500 uppercase">Avg Hours</p>
                                        <p className="text-sm font-bold text-white">{stats.avgWorkHours.toFixed(1)}</p>
                                    </div>
                                    <div className="bg-black/20 p-2 rounded-lg text-center">
                                        <p className="text-[9px] text-gray-500 uppercase">Late Days</p>
                                        <p className="text-sm font-bold text-orange-400">{stats.lateDays}</p>
                                    </div>
                                </div>

                                {stats.overdueTasks > 0 && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center text-xs text-red-400">
                                        <AlertTriangle size={12} className="mr-2" />
                                        {stats.overdueTasks} overdue task{stats.overdueTasks > 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PerformancePage;
