import { db } from './firebase';
import {
    collection, addDoc, query, where,
    getDocs, orderBy, limit, serverTimestamp,
    doc, getDoc, setDoc
} from 'firebase/firestore';
import { PeerReview, PeerFeedbackSummary } from '../types';

export class PeerFeedbackService {
    static async submitReview(review: Omit<PeerReview, 'id' | 'submitted_at'>): Promise<string> {
        const reviewsRef = collection(db, 'peer_reviews');

        const q = query(
            reviewsRef,
            where('reviewer_id', '==', review.reviewer_id),
            where('reviewee_id', '==', review.reviewee_id),
            where('cycle_id', '==', review.cycle_id)
        );

        const existing = await getDocs(q);
        if (!existing.empty) {
            throw new Error("You have already submitted a review for this colleague for the current cycle.");
        }

        const docRef = await addDoc(reviewsRef, {
            ...review,
            submitted_at: new Date().toISOString()
        });

        return docRef.id;
    }

    static async getAggregatedFeedback(userId: string, cycleId: string): Promise<PeerFeedbackSummary | null> {
        const q = query(
            collection(db, 'peer_reviews'),
            where('reviewee_id', '==', userId),
            where('cycle_id', '==', cycleId)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        const reviews = snapshot.docs.map(doc => doc.data() as PeerReview);

        const avgRatings = {
            teamwork: reviews.reduce((sum, r) => sum + r.ratings.teamwork, 0) / reviews.length,
            communication: reviews.reduce((sum, r) => sum + r.ratings.communication, 0) / reviews.length,
            technical_skills: reviews.reduce((sum, r) => sum + r.ratings.technical_skills, 0) / reviews.length,
            reliability: reviews.reduce((sum, r) => sum + r.ratings.reliability, 0) / reviews.length,
            helpfulness: reviews.reduce((sum, r) => sum + r.ratings.helpfulness, 0) / reviews.length,
        };

        return {
            reviewee_id: userId,
            cycle_id: cycleId,
            total_reviews: reviews.length,
            avg_ratings: avgRatings,
            common_strengths: [],
            common_improvements: [],
            overall_sentiment: 'NEUTRAL'
        };
    }

    static async getReviewsByReviewer(reviewerId: string, cycleId: string): Promise<string[]> {
        const q = query(
            collection(db, 'peer_reviews'),
            where('reviewer_id', '==', reviewerId),
            where('cycle_id', '==', cycleId)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => (doc.data() as PeerReview).reviewee_id);
    }
}
