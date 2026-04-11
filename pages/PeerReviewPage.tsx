import React, { useState, useEffect } from 'react';
import {
    Users, Star, MessageSquare, Send,
    ShieldAlert, Info, CheckCircle2, Search, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { UserProfile, PeerReview } from '../types';
import { toast } from 'react-hot-toast';
import { PeerFeedbackService } from '../services/peer-feedback';

interface ReviewModalProps {
    target: UserProfile;
    onClose: () => void;
    onSuccess: () => void;
}

const PeerReviewModal: React.FC<ReviewModalProps> = ({ target, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [ratings, setRatings] = useState({
        competence: 5,
        reliability: 5,
        teamwork: 5,
        communication: 5
    });
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!comment.trim()) {
            toast.error("Please provide a short comment.");
            return;
        }

        setIsSubmitting(true);
        try {
            const currentMonth = new Date().toISOString().substring(0, 7);
            await PeerFeedbackService.submitReview({
                reviewer_id: user!.uid,
                reviewee_id: target.uid,
                cycle_id: currentMonth,
                ratings: {
                    teamwork: ratings.teamwork,
                    communication: ratings.communication,
                    technical_skills: 5, // Default for now
                    reliability: ratings.reliability,
                    helpfulness: 5 // Default for now
                },
                specific_feedback: comment,
                strengths: [],
                areas_for_improvement: [],
                would_work_with_again: true,
                is_anonymous: true
            });
            toast.success(`Review submitted for ${target.displayName}!`);
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || "Failed to submit review");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Review {target.displayName}</h3>
                        <p className="text-xs text-gray-400">Your feedback is anonymous and constructive.</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {(['competence', 'reliability', 'teamwork', 'communication'] as const).map((key) => (
                        <div key={key} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-bold text-gray-300 capitalize">{key}</label>
                                <span className="text-brand-400 font-mono text-sm">{ratings[key]}/5</span>
                            </div>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => setRatings(prev => ({ ...prev, [key]: val }))}
                                        className={`flex-1 h-8 rounded-lg border transition-all ${ratings[key] >= val
                                            ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                                            : 'bg-white/5 border-white/5 text-gray-600'
                                            }`}
                                    >
                                        <Star size={12} className={`mx-auto ${ratings[key] >= val ? 'fill-brand-400' : ''}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-300">Constructive Feedback</label>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What does this colleague do well? What could they improve?"
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white h-24 focus:outline-none focus:border-brand-500/50 resize-none"
                    />
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PeerReviewPage: React.FC = () => {
    const { user } = useAuth();
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [reviewedIds, setReviewedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<UserProfile | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, [user]);

    const fetchInitialData = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const currentMonth = new Date().toISOString().substring(0, 7);
            const [staffList, submittedReviews] = await Promise.all([
                getDocs(query(collection(db, 'users'), where('role', '!=', 'ADMIN'))),
                PeerFeedbackService.getReviewsByReviewer(user.uid, currentMonth)
            ]);

            setStaff(staffList.docs
                .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
                .filter(u => u.uid !== user?.uid)
            );
            setReviewedIds(submittedReviews);
        } catch (error) {
            console.error("Error fetching peer review data", error);
            toast.error("Failed to load feedback portal");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStaff = staff.filter(s =>
        s.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-heading">360° Peer Feedback</h1>
                    <p className="text-sm text-gray-400">Provide constructive feedback to your colleagues to help them grow.</p>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search colleagues..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50"
                    />
                </div>
            </div>

            <div className="bg-brand-500/10 border border-brand-500/20 p-6 rounded-2xl flex items-start gap-4">
                <Info className="text-brand-400 shrink-0" size={24} />
                <div className="space-y-1">
                    <h3 className="text-brand-400 font-bold">Feedback Guidelines</h3>
                    <p className="text-sm text-gray-300">Reviews represent 10% of the total performance score. Responses are aggregated anonymously at month-end.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.map(member => {
                    const hasReviewed = reviewedIds.includes(member.uid);
                    return (
                        <div key={member.uid} className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-brand-500/40 transition-all hover:bg-white/[0.02] flex flex-col justify-between relative group overflow-hidden">
                            {hasReviewed && (
                                <div className="absolute top-0 right-0 p-1 bg-brand-500 text-white rounded-bl-xl shadow-lg animate-in slide-in-from-tr duration-500">
                                    <CheckCircle2 size={14} />
                                </div>
                            )}

                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-navy-800 flex items-center justify-center font-bold text-white border border-white/5 overflow-hidden">
                                    {member.photoURL ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" /> : member.displayName?.[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">{member.displayName}</h3>
                                    <p className="text-xs text-gray-500 capitalize">{member.department || 'Staff'}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                                    <span className="text-xs text-gray-400">Status</span>
                                    {hasReviewed ? (
                                        <span className="text-[10px] text-brand-400 font-black uppercase tracking-widest">Feedback Submitted</span>
                                    ) : (
                                        <span className="text-[10px] text-orange-400 font-black uppercase tracking-widest">Pending Review</span>
                                    )}
                                </div>

                                <button
                                    disabled={hasReviewed}
                                    className={`w-full font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${hasReviewed
                                        ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                        : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/20'
                                        }`}
                                    onClick={() => setSelectedStaff(member)}
                                >
                                    <MessageSquare size={14} /> {hasReviewed ? 'Reviewed' : 'Start Review'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedStaff && (
                <PeerReviewModal
                    target={selectedStaff}
                    onClose={() => setSelectedStaff(null)}
                    onSuccess={() => {
                        setSelectedStaff(null);
                        fetchInitialData();
                    }}
                />
            )}
        </div>
    );
};

export default PeerReviewPage;
