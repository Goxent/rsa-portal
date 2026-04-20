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
                createdAt: new Date().toISOString(),
                readBy: []
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
            let q;
            if (userId) {
                // In a real app, you might want to fetch 'ALL' notices plus ones specifically for this user
                // Firestore doesn't support OR queries easily across different field values like this without 'in'
                // For simplicity, we fetch all and filter in memory if needed, or use multiple queries.
                // Best: Fetch all for everyone and specifically for the user.
                q = query(
                    collection(db, 'notices'), 
                    orderBy('createdAt', 'desc')
                );
            } else {
                q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
            }

            const querySnapshot = await getDocs(q);
            const notices: Notice[] = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data() as any;
                const fitsRecipient = !userId || 
                                    data.recipients === 'ALL' || 
                                    (Array.isArray(data.recipients) && data.recipients.includes(userId));
                                    
                if (fitsRecipient) {
                    notices.push({ id: doc.id, ...data } as Notice);
                }
            });

            return notices;
        } catch (error) {
            console.error('Error fetching notices:', error);
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
