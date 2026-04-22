import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    updateDoc, 
    doc,
    arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';
import { Notice } from '../types';
import { EmailService } from './email';

export const NoticeService = {
    /**
     * Create a new notice and store it in Firestore.
     * Triggers email notifications if requested.
     */
    createNotice: async (noticeData: Omit<Notice, 'id'>, recipientEmails?: string[]): Promise<string> => {
        try {
            // 1. Save to Firestore
            const docRef = await addDoc(collection(db, 'notices'), {
                ...noticeData,
                createdAt: noticeData.createdAt || new Date().toISOString(),
                readBy: noticeData.readBy || []
            });

            // 2. Trigger Emails if requested
            if (noticeData.sendEmail && recipientEmails && recipientEmails.length > 0) {
                // We send emails in background/parallel to avoid blocking UI
                NoticeService.sendBulkEmails(recipientEmails, noticeData);
            }

            return docRef.id;
        } catch (error) {
            console.error('Error creating notice:', error);
            throw error;
        }
    },

    /**
     * Internal helper to send emails to multiple recipients.
     */
    sendBulkEmails: async (emails: string[], notice: Omit<Notice, 'id'>) => {
        for (const email of emails) {
            try {
                await EmailService.sendOfficialNotice(
                    email, 
                    'Team Member', 
                    notice.title, 
                    notice.content, 
                    notice.priority
                );
            } catch (err) {
                console.error(`Failed to send email notice to ${email}:`, err);
            }
        }
    },

    /**
     * Fetch all notices relevant to the current user.
     * If userId is provided, filters for that user or 'ALL'.
     */
    getNotices: async (userId?: string): Promise<Notice[]> => {
        try {
            if (userId) {
                // To bypass "Missing or insufficient permissions" errors, we query specifically for what the user is allowed to see.
                // Firestore doesn't support 'OR' between array-contains and equality easily in one query.
                // We run two queries in parallel: one for 'ALL' recipients and one for specific user ID.
                
                const qAll = query(
                    collection(db, 'notices'), 
                    where('recipients', '==', 'ALL'),
                    orderBy('createdAt', 'desc')
                );
                
                const qUser = query(
                    collection(db, 'notices'),
                    where('recipients', 'array-contains', userId),
                    orderBy('createdAt', 'desc')
                );

                const [snapAll, snapUser] = await Promise.all([
                    getDocs(qAll),
                    getDocs(qUser)
                ]);

                // Merge and deduplicate (though unlikely to have duplicates between 'ALL' and specific array)
                const results: Notice[] = [];
                const seenIds = new Set<string>();

                [...snapAll.docs, ...snapUser.docs].forEach(doc => {
                    if (!seenIds.has(doc.id)) {
                        results.push({ id: doc.id, ...doc.data() } as Notice);
                        seenIds.add(doc.id);
                    }
                });

                // Re-sort because we merged two separate queries
                return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            } else {
                // For Admins (when userId is not passed), fetch all notices
                const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                
                const results: Notice[] = [];
                querySnapshot.forEach((doc) => {
                    results.push({ id: doc.id, ...doc.data() } as Notice);
                });
                return results;
            }
        } catch (error: any) {
            console.error('Error fetching notices:', error);
            // If it's a permission error, show a more helpful message to console
            if (error.code === 'permission-denied') {
                console.warn('Permission denied while fetching notices. Check Firestore security rules.');
            }
            return [];
        }
    },

    /**
     * Mark a notice as read by a specific user.
     */
    markAsRead: async (noticeId: string, userId: string): Promise<void> => {
        try {
            const noticeRef = doc(db, 'notices', noticeId);
            await updateDoc(noticeRef, {
                readBy: arrayUnion(userId)
            });
        } catch (error) {
            console.error('Error marking notice as read:', error);
        }
    }
};
