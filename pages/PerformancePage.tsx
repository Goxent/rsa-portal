import React, { useState, useEffect } from 'react';
import {
    Trophy, TrendingUp, Clock, CheckCircle2,
    Loader2, Award, FileDown,
    Info, HelpCircle, Lock
} from 'lucide-react';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
                    for (const u of users) {
                        const stats = await PerformanceService.getStaffPerformance(u.uid, selectedMonth);
                        scores[u.uid] = stats;
                    }
                    setPerformanceData(scores);
                }
            } else {
                setFinalizedCycle(null);
                const scores: Record<string, PerformanceStats> = {};
                for (const u of users) {
                    const stats = await PerformanceService.getQuarterlyPerformance(u.uid, selectedQuarter, selectedYear);
                    scores[u.uid] = stats;
                }
                setPerformanceData(scores);
            }

            if (selectedMonth === 0) {
                const som = await PerformanceService.getStaffOfTheMonth();
                if (som) {
                    const profile = users.find(u => u.uid === som.staffId);
                    if (profile) {
                        setStaffOfTheMonth({ profile, score: som.score });
                    }
                }
            }

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
        if (!window.confirm("Are you sure you want to finalize performance for the previous month? This will freeze all scores and identify the Staff of the Month.")) return;

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

    const exportPDF = () => {
        const pdfDoc = new jsPDF();
        const targetDate = subMonths(new Date(), selectedMonth);

        pdfDoc.setFillColor(42, 106, 75);
        pdfDoc.rect(0, 0, 210, 45, 'F');

        pdfDoc.setFontSize(22);
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("R. SAPKOTA & ASSOCIATES", 105, 18, { align: "center" });

        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(230, 245, 238);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.text("Chartered Accountants | Mid-Baneshwor, Kathmandu", 105, 26, { align: "center" });

        pdfDoc.setFontSize(14);
        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("Staff Performance Evaluation Report", 105, 38, { align: "center" });

        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(100);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.text(`Period: ${format(targetDate, 'MMMM yyyy')}`, 14, 55);
        pdfDoc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 61);
        pdfDoc.text(`Total Staff Evaluated: ${staff.length}`, 14, 67);

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

        autoTable(pdfDoc, {
            head: [tableColumn],
            body: tableRows as any,
            startY: 75,
            theme: 'grid',
            headStyles: {
                fillColor: [42, 106, 75],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 8
            },
            styles: {
                fontSize: 8,
                cellPadding: 3,
                textColor: [30, 41, 59]
            },
            alternateRowStyles: {
                fillColor: [245, 247, 246]
            },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { halign: 'center', fontStyle: 'bold' },
                2: { halign: 'center' }
            }
        });

        const finalY = (pdfDoc as any).lastAutoTable.finalY + 15;
        pdfDoc.setFontSize(11);
        pdfDoc.setTextColor(42, 106, 75);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.text("Benchmark Summary", 14, finalY);

        const avgScore = Object.values(performanceData).reduce((sum, s) => sum + s.totalScore, 0) / (staff.length || 1);
        const exceptional = Object.values(performanceData).filter(s => s.performanceTier === 'Exceptional').length;
        const needsImprovement = Object.values(performanceData).filter(s =>
            s.performanceTier === 'Needs Improvement' || s.performanceTier === 'Critical'
        ).length;

        pdfDoc.setFontSize(9);
        pdfDoc.setTextColor(100);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.text(`• Average Team Score: ${avgScore.toFixed(1)}%`, 18, finalY + 8);
        pdfDoc.text(`• Exceptional Performers: ${exceptional} staff members`, 18, finalY + 14);
        pdfDoc.text(`• Needing Improvement: ${needsImprovement} staff members`, 18, finalY + 20);

        const pageCount = pdfDoc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdfDoc.setPage(i);
            pdfDoc.setFontSize(8);
            pdfDoc.setTextColor(150);
            pdfDoc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
            pdfDoc.text("Confidential - RSA Portal Performance Analytics", 14, 285);
        }

        pdfDoc.save(`RSA_Performance_Report_${format(targetDate, 'MMM_yyyy')}.pdf`);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={36} className="animate-spin text-[var(--accent)] mb-3" />
                <p className="text-sm text-[var(--text-muted)]">Analyzing performance metrics...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="font-display text-2xl font-semibold text-[var(--text-heading)] tracking-tight">Performance evaluation</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[var(--text-muted)]">Staff performance metrics and benchmarking</p>
                        <button
                            type="button"
                            onClick={() => setShowScoringInfo(!showScoringInfo)}
                            className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                        >
                            <HelpCircle size={13} />
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border)]">
                        <button
                            type="button"
                            onClick={() => setViewMode('monthly')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'monthly' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'}`}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('quarterly')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === 'quarterly' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'}`}
                        >
                            Quarterly
                        </button>
                    </div>

                    <div className="flex bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border)]">
                        <button
                            type="button"
                            onClick={() => setActiveTab('roster')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeTab === 'roster' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'}`}
                        >
                            Staff roster
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('leaderboard')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${activeTab === 'leaderboard' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-heading)]'}`}
                        >
                            Leaderboard
                        </button>
                    </div>

                    {viewMode === 'monthly' ? (
                        <>
                            {AuthService.isAdmin(user?.role) && selectedMonth === 0 && !finalizedCycle && (
                                <button
                                    type="button"
                                    onClick={handleFinalize}
                                    disabled={isFinalizing}
                                    className="bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-[var(--on-accent)] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center transition-opacity"
                                >
                                    {isFinalizing ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Lock size={13} className="mr-1.5" />}
                                    Finalize {format(subMonths(new Date(), 1), 'MMM')} performance
                                </button>
                            )}
                            {finalizedCycle && (
                                <div className="flex items-center gap-1.5 bg-[var(--accent-dim)] border border-[var(--border-accent)] px-2.5 py-1 rounded-md">
                                    <Lock size={12} className="text-[var(--accent)]" />
                                    <span className="text-xs font-medium text-[var(--accent)]">Finalized</span>
                                </div>
                            )}
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--border-accent)]"
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
                                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--border-accent)]"
                            >
                                <option value={0}>Q1 (Jan – Mar)</option>
                                <option value={1}>Q2 (Apr – Jun)</option>
                                <option value={2}>Q3 (Jul – Sep)</option>
                                <option value={3}>Q4 (Oct – Dec)</option>
                            </select>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-heading)] focus:outline-none focus:border-[var(--border-accent)]"
                            >
                                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                            </select>
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={exportPDF}
                        className="bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--border-mid)] text-[var(--text-heading)] px-3 py-1.5 rounded-lg text-xs font-medium flex items-center transition-colors"
                    >
                        <FileDown size={13} className="mr-1.5 text-[var(--accent)]" /> Export PDF
                    </button>
                </div>
            </div>

            {showScoringInfo && (
                <div className="bg-[var(--bg-surface)] p-5 rounded-xl border border-[var(--border)]">
                    <h3 className="text-sm font-semibold text-[var(--text-heading)] mb-3 flex items-center">
                        <Info size={16} className="mr-2 text-[var(--accent)]" /> Weighted scoring algorithm
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: 'Completion rate', weight: '30%', desc: 'Tasks completed vs assigned' },
                            { label: 'On-time delivery', weight: '25%', desc: 'Completed before due date' },
                            { label: 'Punctuality', weight: '20%', desc: 'Clock-in consistency' },
                            { label: 'Quality score', weight: '15%', desc: 'Accuracy and feedback' },
                            { label: 'Difficulty bonus', weight: '10%', desc: 'Complexity and priority' },
                        ].map((item, i) => (
                            <div key={i} className="bg-[var(--bg-main)] p-3 rounded-lg border border-[var(--border)] space-y-1">
                                <p className="text-xs font-medium text-[var(--text-heading)]">{item.label}</p>
                                <p className="font-display text-xl font-semibold text-[var(--accent)] tabular-nums">{item.weight}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Staff of the Month Section */}
            {staffOfTheMonth && selectedMonth === 0 && (
                <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-accent)] flex flex-col md:flex-row items-center gap-6 relative">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full border-2 border-[var(--accent)] p-0.5 overflow-hidden">
                            {staffOfTheMonth.profile.photoURL ? (
                                <img src={staffOfTheMonth.profile.photoURL} alt={staffOfTheMonth.profile.displayName} className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <div className="w-full h-full bg-[var(--bg-elevated)] flex items-center justify-center text-xl font-semibold text-[var(--accent)]">
                                    {staffOfTheMonth.profile.displayName?.[0]}
                                </div>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-[var(--accent)] p-1.5 rounded-full text-[var(--on-accent)]">
                            <Trophy size={14} />
                        </div>
                    </div>

                    <div className="text-center md:text-left space-y-1.5 flex-1">
                        <span className="px-2.5 py-0.5 bg-[var(--accent-dim)] text-[var(--accent)] text-xs font-medium rounded-md border border-[var(--border-accent)]">Staff of the month</span>
                        <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">{staffOfTheMonth.profile.displayName}</h2>
                        <p className="text-xs text-[var(--text-muted)] max-w-md">Recognized for exceptional task completion rate and punctuality throughout the previous month.</p>

                        <div className="flex flex-wrap gap-3 mt-3">
                            <div className="bg-[var(--bg-main)] px-3.5 py-1.5 rounded-lg border border-[var(--border)]">
                                <p className="text-[11px] text-[var(--text-muted)]">Performance score</p>
                                <p className="font-display text-base font-semibold text-[var(--accent)] tabular-nums">{staffOfTheMonth.score.toFixed(1)}%</p>
                            </div>
                            <div className="bg-[var(--bg-main)] px-3.5 py-1.5 rounded-lg border border-[var(--border)]">
                                <p className="text-[11px] text-[var(--text-muted)]">Status</p>
                                <p className="text-xs font-medium text-[var(--text-heading)] flex items-center mt-0.5"><Award size={14} className="mr-1 text-[var(--color-warning)]" /> Outstanding</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Benchmark Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-muted)]">Average team score</p>
                    <p className="font-display text-2xl font-semibold text-[var(--text-heading)] tabular-nums mt-1">
                        {(Object.values(performanceData).reduce((sum, s) => sum + s.totalScore, 0) / Math.max(staff.length, 1)).toFixed(1)}%
                    </p>
                </div>
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-muted)]">Exceptional performers</p>
                    <p className="font-display text-2xl font-semibold text-[var(--color-success)] tabular-nums mt-1">
                        {Object.values(performanceData).filter(s => s.performanceTier === 'Exceptional').length}
                    </p>
                </div>
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-muted)]">Needs improvement</p>
                    <p className="font-display text-2xl font-semibold text-[var(--color-warning)] tabular-nums mt-1">
                        {Object.values(performanceData).filter(s => s.performanceTier === 'Needs Improvement' || s.performanceTier === 'Critical').length}
                    </p>
                </div>
                <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
                    <p className="text-xs text-[var(--text-muted)]">Overdue tasks</p>
                    <p className="font-display text-2xl font-semibold text-[var(--color-danger)] tabular-nums mt-1">
                        {Object.values(performanceData).reduce((sum, s) => sum + s.overdueTasks, 0)}
                    </p>
                </div>
            </div>

            {/* Main Content Area */}
            {activeTab === 'roster' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {staff.map((member) => {
                        const stats = performanceData[member.uid];
                        if (!stats) return null;

                        return (
                            <div
                                key={member.uid}
                                onClick={() => setExpandedStaffId(expandedStaffId === member.uid ? null : member.uid)}
                                className={`bg-[var(--bg-surface)] p-4 rounded-xl border transition-colors cursor-pointer ${expandedStaffId === member.uid ? 'border-[var(--border-accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border)] hover:border-[var(--border-mid)]'}`}
                            >
                                <div className="flex items-center gap-3.5 mb-3">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center font-semibold text-[var(--text-heading)] border border-[var(--border)]">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} className="w-full h-full object-cover rounded-lg" alt="" />
                                            ) : (
                                                member.displayName?.[0]
                                            )}
                                        </div>
                                        {stats.totalScore >= 90 && (
                                            <div className="absolute -top-1 -right-1 bg-[var(--color-warning)] text-black rounded-full p-0.5">
                                                <Trophy size={9} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-sm text-[var(--text-heading)] truncate">{member.displayName}</h3>
                                        <p className="text-xs text-[var(--text-muted)] capitalize truncate">{member.role.replace('_', ' ').toLowerCase()} • {member.department || 'General'}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-base font-semibold tabular-nums ${stats.totalScore > 85 ? 'text-[var(--color-success)]' : stats.totalScore > 60 ? 'text-[var(--accent)]' : 'text-[var(--color-warning)]'}`}>
                                            {stats.totalScore.toFixed(0)}
                                        </span>
                                        <span className="text-xs text-[var(--text-subtle)]">/100</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                                        <span>Weighted performance</span>
                                        <span className="text-[var(--text-heading)] font-medium tabular-nums">{stats.totalScore.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500 bg-[var(--accent)]"
                                            style={{ width: `${stats.totalScore}%` }}
                                        />
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedStaffId === member.uid && (
                                        <div className="pt-3 mt-3 border-t border-[var(--border)] grid grid-cols-2 gap-2">
                                            <div className="bg-[var(--bg-main)] p-2 rounded-lg border border-[var(--border)]">
                                                <p className="text-[11px] text-[var(--text-muted)] mb-0.5">Fulfillment</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-[var(--text-heading)] tabular-nums">{(stats.assignmentFulfillment || 0).toFixed(0)}%</span>
                                                    <TrendingUp size={11} className="text-[var(--color-success)]" />
                                                </div>
                                            </div>
                                            <div className="bg-[var(--bg-main)] p-2 rounded-lg border border-[var(--border)]">
                                                <p className="text-[11px] text-[var(--text-muted)] mb-0.5">On-time rate</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-[var(--text-heading)] tabular-nums">{(stats.dueDateFulfillment || 0).toFixed(0)}%</span>
                                                    <Clock size={11} className="text-[var(--color-warning)]" />
                                                </div>
                                            </div>
                                            <div className="bg-[var(--bg-main)] p-2 rounded-lg border border-[var(--border)]">
                                                <p className="text-[11px] text-[var(--text-muted)] mb-0.5">Avg cycle time</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-[var(--text-heading)] tabular-nums">{(stats.avgCycleTime || 0).toFixed(1)} <span className="text-[10px] text-[var(--text-muted)] font-normal">days</span></span>
                                                </div>
                                            </div>
                                            <div className="bg-[var(--bg-main)] p-2 rounded-lg border border-[var(--border)]">
                                                <p className="text-[11px] text-[var(--text-muted)] mb-0.5">Tasks</p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-semibold text-[var(--text-heading)] tabular-nums">{stats.completedTasks} / {stats.totalTasks}</span>
                                                    <CheckCircle2 size={11} className="text-[var(--color-success)]" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!expandedStaffId && (
                                        <p className="text-[11px] text-[var(--text-muted)] text-center pt-1">Click to view details</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border)]">
                    <div className="space-y-2.5">
                        {staff
                            .sort((a, b) => (performanceData[b.uid]?.totalScore || 0) - (performanceData[a.uid]?.totalScore || 0))
                            .map((member, index) => {
                                const stats = performanceData[member.uid];
                                if (!stats) return null;
                                return (
                                    <div key={member.uid} className="flex items-center gap-4 p-3 bg-[var(--bg-main)] rounded-lg border border-[var(--border)] hover:border-[var(--border-mid)] transition-colors">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs tabular-nums ${
                                            index === 0 ? 'bg-[var(--color-warning)] text-black' : 
                                            index === 1 ? 'bg-gray-300 text-black' : 
                                            index === 2 ? 'bg-amber-700 text-white' : 
                                            'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]'
                                        }`}>
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center font-semibold text-xs text-[var(--text-heading)] border border-[var(--border)]">
                                                {member.displayName?.[0]}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm text-[var(--text-heading)]">{member.displayName}</h4>
                                                <p className="text-xs text-[var(--text-muted)]">{member.department || 'General'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-[11px] text-[var(--text-muted)]">Total score</p>
                                                <p className="text-sm font-semibold tabular-nums text-[var(--text-heading)]">{stats.totalScore.toFixed(1)}%</p>
                                            </div>
                                            <div className="w-24 hidden sm:block">
                                                <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                                                    <div className="h-full bg-[var(--accent)]" style={{ width: `${stats.totalScore}%` }} />
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
