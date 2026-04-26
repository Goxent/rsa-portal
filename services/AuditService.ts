import { db } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

export type AuditAction = 
    | 'TASK_CREATED' 
    | 'TASK_STATUS_CHANGE' 
    | 'TASK_ARCHIVED' 
    | 'TASK_SIGN_OFF' 
    | 'TASK_DELETED'
    | 'CLIENT_CREATED'
    | 'USER_ROLE_CHANGE'
    | 'LOGIN_SUCCESS'
    | 'SOP_MODIFIED';

export interface AuditLogEntry {
    id?: string;
    action: AuditAction;
    userId: string;
    userName: string;
    targetId: string; // ID of task, client, user etc.
    targetName?: string;
    details: string; // JSON or human readable string
    ip?: string;
    userAgent?: string;
    timestamp: any;
}

export const AuditService = {
    async logAction(
        action: AuditAction, 
        user: { uid: string, displayName: string }, 
        target: { id: string, name?: string }, 
        details: any
    ) {
        try {
            const logEntry: Omit<AuditLogEntry, 'id'> = {
                action,
                userId: user.uid,
                userName: user.displayName || 'Unknown',
                targetId: target.id,
                targetName: target.name,
                details: typeof details === 'string' ? details : JSON.stringify(details),
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent
            };

            await addDoc(collection(db, 'auditLogs'), logEntry);
        } catch (error) {
            console.error('Failed to log audit action:', error);
        }
    },

    async getLogsByTarget(targetId: string, maxResults = 50) {
        const q = query(
            collection(db, 'auditLogs'),
            where('targetId', '==', targetId),
            orderBy('timestamp', 'desc'),
            limit(maxResults)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
    }
};
