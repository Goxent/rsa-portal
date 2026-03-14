// Audit Logger Service
// Centralized logging for all user actions

import {
    AuditLogEntry,
    AuditAction,
    AuditLogFilters,
    AuditRiskLevel,
    ACTION_RISK_LEVELS,
    SecurityAlert,
    SecurityStats
} from '../types/security';
import { db } from './firebase';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    Timestamp,
    doc,
    updateDoc,
} from 'firebase/firestore';

const AUDIT_COLLECTION = 'auditLogs';
const ALERTS_COLLECTION = 'security_alerts';
const MAX_LOGS_PER_QUERY = 500;

// Generate unique session ID
const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem('audit_session_id');
    if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('audit_session_id', sessionId);
    }
    return sessionId;
};

// Get basic metadata
const getMetadata = () => ({
    userAgent: navigator.userAgent,
    sessionId: getSessionId(),
    // Note: IP address would typically come from server-side
});

export class AuditLogger {
    private static currentUser: { uid: string; displayName: string; email: string } | null = null;

    /**
     * Set the current user for logging
     */
    static setCurrentUser(user: { uid: string; displayName: string; email: string } | null) {
        this.currentUser = user;
    }

    /**
     * Log an audit event
     */
    static async log(
        action: AuditAction,
        resource: string,
        options: {
            resourceId?: string;
            changes?: { before?: Record<string, any>; after?: Record<string, any> };
            description?: string;
            riskLevel?: AuditRiskLevel;
        } = {}
    ): Promise<string | null> {
        if (!this.currentUser) {
            console.warn('AuditLogger: No current user set');
            return null;
        }

        try {
            const entry: Omit<AuditLogEntry, 'id'> = {
                timestamp: new Date().toISOString(),
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName,
                userEmail: this.currentUser.email,
                action,
                resource,
                resourceId: options.resourceId,
                changes: options.changes,
                metadata: getMetadata(),
                riskLevel: options.riskLevel || ACTION_RISK_LEVELS[action] || 'low',
                description: options.description || this.generateDescription(action, resource),
            };

            const docRef = await addDoc(collection(db, AUDIT_COLLECTION), entry);

            // Check for suspicious patterns
            await this.checkForAlerts(entry);

            return docRef.id;
        } catch (error) {
            console.error('AuditLogger: Failed to log action', error);
            return null;
        }
    }

    /**
     * Generate default description for action
     */
    private static generateDescription(action: AuditAction, resource: string): string {
        const [category, verb] = action.split('.') as [string, string];
        return `${verb.replace('_', ' ')} on ${resource}`;
    }

    /**
     * Check for suspicious activity patterns
     */
    private static async checkForAlerts(entry: Omit<AuditLogEntry, 'id'>): Promise<void> {
        // Check for multiple failed logins
        if (entry.action === 'auth.login_failed') {
            const recentFailures = await this.getRecentFailedLogins(entry.userId, 15); // 15 minutes
            if (recentFailures >= 5) {
                await this.createAlert({
                    type: 'failed_login',
                    severity: 'warning',
                    userId: entry.userId,
                    description: `Multiple failed login attempts (${recentFailures}) for ${entry.userName}`,
                });
            }
        }

        // Check for bulk deletions
        if (entry.action.endsWith('.delete')) {
            const recentDeletes = await this.getRecentDeleteCount(entry.userId, 5); // 5 minutes
            if (recentDeletes >= 5) {
                await this.createAlert({
                    type: 'bulk_delete',
                    severity: 'critical',
                    userId: entry.userId,
                    description: `Bulk deletion detected: ${recentDeletes} items deleted by ${entry.userName}`,
                });
            }
        }

        // Check for role changes
        if (entry.action === 'user.role_change') {
            await this.createAlert({
                type: 'permission_change',
                severity: 'warning',
                userId: entry.userId,
                description: `Role change detected for user by ${entry.userName}`,
            });
        }
    }

    /**
     * Get recent failed login count
     */
    private static async getRecentFailedLogins(userId: string, minutesAgo: number): Promise<number> {
        const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
        const q = query(
            collection(db, AUDIT_COLLECTION),
            where('userId', '==', userId),
            where('action', '==', 'auth.login_failed'),
            where('timestamp', '>=', cutoff)
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    }

    /**
     * Get recent delete count
     */
    private static async getRecentDeleteCount(userId: string, minutesAgo: number): Promise<number> {
        const cutoff = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
        const q = query(
            collection(db, AUDIT_COLLECTION),
            where('userId', '==', userId),
            where('timestamp', '>=', cutoff)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.filter(d => d.data().action?.endsWith('.delete')).length;
    }

    /**
     * Create a security alert
     */
    private static async createAlert(
        alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'resolved'>
    ): Promise<void> {
        try {
            await addDoc(collection(db, ALERTS_COLLECTION), {
                ...alert,
                timestamp: new Date().toISOString(),
                resolved: false,
            });
        } catch (error) {
            console.error('Failed to create security alert', error);
        }
    }

    /**
     * Query audit logs with filters
     */
    static async getLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
        let q = query(
            collection(db, AUDIT_COLLECTION),
            orderBy('timestamp', 'desc'),
            limit(MAX_LOGS_PER_QUERY)
        );

        // Apply filters
        if (filters.userId) {
            q = query(q, where('userId', '==', filters.userId));
        }
        if (filters.action) {
            q = query(q, where('action', '==', filters.action));
        }
        if (filters.riskLevel) {
            q = query(q, where('riskLevel', '==', filters.riskLevel));
        }
        if (filters.startDate) {
            q = query(q, where('timestamp', '>=', filters.startDate));
        }
        if (filters.endDate) {
            q = query(q, where('timestamp', '<=', filters.endDate));
        }

        try {
            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as AuditLogEntry[];

            // Client-side search filter
            if (filters.searchQuery) {
                const search = filters.searchQuery.toLowerCase();
                return logs.filter(log =>
                    log.userName.toLowerCase().includes(search) ||
                    log.description.toLowerCase().includes(search) ||
                    log.resource.toLowerCase().includes(search)
                );
            }

            return logs;
        } catch (error) {
            console.error('Failed to get audit logs', error);
            return [];
        }
    }

    /**
     * Get security alerts
     */
    static async getAlerts(includeResolved = false): Promise<SecurityAlert[]> {
        let q = query(
            collection(db, ALERTS_COLLECTION),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        if (!includeResolved) {
            q = query(q, where('resolved', '==', false));
        }

        try {
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as SecurityAlert[];
        } catch (error) {
            console.error('Failed to get security alerts', error);
            return [];
        }
    }

    /**
     * Resolve a security alert
     */
    static async resolveAlert(alertId: string): Promise<void> {
        try {
            await updateDoc(doc(db, ALERTS_COLLECTION, alertId), {
                resolved: true,
            });
        } catch (error) {
            console.error('Failed to resolve alert', error);
        }
    }

    /**
     * Get security statistics
     */
    static async getSecurityStats(): Promise<SecurityStats> {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        try {
            // Get logs from last 24 hours
            const logs = await this.getLogs({ startDate: yesterday });

            const logins = logs.filter(l => l.action === 'auth.login').length;
            const failedLogins = logs.filter(l => l.action === 'auth.login_failed').length;
            const dataChanges = logs.filter(l =>
                l.action.includes('create') ||
                l.action.includes('update') ||
                l.action.includes('delete')
            ).length;

            // Get active alerts
            const alerts = await this.getAlerts(false);

            // Calculate security score (0-100)
            let score = 100;

            // Deduct for failed logins
            score -= Math.min(20, failedLogins * 2);

            // Deduct for active alerts
            score -= Math.min(30, alerts.length * 10);

            // Deduct for high-risk actions
            const highRiskCount = logs.filter(l =>
                l.riskLevel === 'high' || l.riskLevel === 'critical'
            ).length;
            score -= Math.min(20, highRiskCount * 5);

            return {
                totalLogins24h: logins,
                failedLogins24h: failedLogins,
                dataChanges24h: dataChanges,
                activeAlerts: alerts.length,
                securityScore: Math.max(0, score),
            };
        } catch (error) {
            console.error('Failed to get security stats', error);
            return {
                totalLogins24h: 0,
                failedLogins24h: 0,
                dataChanges24h: 0,
                activeAlerts: 0,
                securityScore: 0,
            };
        }
    }
}

// Export convenience function
export const logAudit = AuditLogger.log.bind(AuditLogger);
