import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export enum AuditAction {
    // User Management
    USER_CREATED = 'USER_CREATED',
    USER_UPDATED = 'USER_UPDATED',
    USER_DELETED = 'USER_DELETED',
    USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',

    // Client Management
    CLIENT_CREATED = 'CLIENT_CREATED',
    CLIENT_UPDATED = 'CLIENT_UPDATED',
    CLIENT_DELETED = 'CLIENT_DELETED',

    // Task Management
    TASK_CREATED = 'TASK_CREATED',
    TASK_UPDATED = 'TASK_UPDATED',
    TASK_DELETED = 'TASK_DELETED',
    TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',

    // Leave Management
    LEAVE_APPROVED = 'LEAVE_APPROVED',
    LEAVE_REJECTED = 'LEAVE_REJECTED',

    // Resource Management
    RESOURCE_CREATED = 'RESOURCE_CREATED',
    RESOURCE_DELETED = 'RESOURCE_DELETED',

    // System Actions
    SETTINGS_CHANGED = 'SETTINGS_CHANGED',
    BACKUP_CREATED = 'BACKUP_CREATED',
}

export interface AuditLog {
    userId: string;
    userDisplayName: string;
    action: AuditAction;
    targetType: 'user' | 'client' | 'task' | 'leave' | 'resource' | 'system';
    targetId: string;
    targetName?: string;
    details?: Record<string, any>;
    timestamp: string;
    ipAddress?: string;
}

/**
 * Create an audit log entry
 */
export const createAuditLog = async (log: Omit<AuditLog, 'timestamp'>) => {
    try {
        await addDoc(collection(db, 'audit_logs'), {
            ...log,
            timestamp: new Date().toISOString(),
            ipAddress: 'N/A', // Could be enhanced with IP detection
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw - audit logging should never break the main flow
    }
};

/**
 * Helper function to log client operations
 */
export const logClientAction = async (
    action: AuditAction,
    userId: string,
    userDisplayName: string,
    clientId: string,
    clientName: string,
    details?: Record<string, any>
) => {
    await createAuditLog({
        userId,
        userDisplayName,
        action,
        targetType: 'client',
        targetId: clientId,
        targetName: clientName,
        details,
    });
};

/**
 * Helper function to log user operations
 */
export const logUserAction = async (
    action: AuditAction,
    adminUserId: string,
    adminDisplayName: string,
    targetUserId: string,
    targetUserName: string,
    details?: Record<string, any>
) => {
    await createAuditLog({
        userId: adminUserId,
        userDisplayName: adminDisplayName,
        action,
        targetType: 'user',
        targetId: targetUserId,
        targetName: targetUserName,
        details,
    });
};

/**
 * Helper function to log task operations
 */
export const logTaskAction = async (
    action: AuditAction,
    userId: string,
    userDisplayName: string,
    taskId: string,
    taskTitle: string,
    details?: Record<string, any>
) => {
    await createAuditLog({
        userId,
        userDisplayName,
        action,
        targetType: 'task',
        targetId: taskId,
        targetName: taskTitle,
        details,
    });
};
