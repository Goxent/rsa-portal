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
    LEAVE_REQUESTED = 'LEAVE_REQUESTED',
    LEAVE_APPROVED = 'LEAVE_APPROVED',
    LEAVE_REJECTED = 'LEAVE_REJECTED',

    // Resource Management
    RESOURCE_CREATED = 'RESOURCE_CREATED',
    RESOURCE_DELETED = 'RESOURCE_DELETED',

    // System Actions
    SETTINGS_CHANGED = 'SETTINGS_CHANGED',
    BACKUP_CREATED = 'BACKUP_CREATED',

    // Authentication
    LOGIN_SUCCESS = 'LOGIN_SUCCESS',
    LOGIN_FAILURE = 'LOGIN_FAILURE',
    LOGOUT = 'LOGOUT',
    SESSION_EXPIRED = 'SESSION_EXPIRED',

    // Document & Risk Area Actions
    DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
    DOCUMENT_DELETED = 'DOCUMENT_DELETED',
    RISK_AREA_ADDED = 'RISK_AREA_ADDED',
    RISK_AREA_UPDATED = 'RISK_AREA_UPDATED',
    RISK_AREA_DELETED = 'RISK_AREA_DELETED',

    // Notes
    CLIENT_NOTE_UPDATED = 'CLIENT_NOTE_UPDATED',

    // Session Security
    CONCURRENT_LOGIN_PREVENTED = 'CONCURRENT_LOGIN_PREVENTED',

    // Attendance Management
    ATTENDANCE_REQUEST_CREATED = 'ATTENDANCE_REQUEST_CREATED',
    ATTENDANCE_REQUEST_APPROVED = 'ATTENDANCE_REQUEST_APPROVED',
    ATTENDANCE_REQUEST_REJECTED = 'ATTENDANCE_REQUEST_REJECTED',
}

export interface AuditLog {
    userId: string;
    userName: string; // Map to performedBy/adminName in UI
    action: AuditAction;
    targetType: 'user' | 'client' | 'task' | 'leave' | 'resource' | 'system' | 'attendance';
    targetId: string;
    targetName?: string;
    details?: string | Record<string, any>;
    oldData?: any;
    newData?: any;
    timestamp: string;
    ipAddress?: string;
}

/**
 * Create an audit log entry
 */
export const createAuditLog = async (log: Omit<AuditLog, 'timestamp'>) => {
    try {
        await addDoc(collection(db, 'auditLogs'), {
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
        userName: userDisplayName,
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
        userName: adminDisplayName,
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
        userName: userDisplayName,
        action,
        targetType: 'task',
        targetId: taskId,
        targetName: taskTitle,
        details,
    });
};

/**
 * Helper function to log leave operations
 */
export const logLeaveAction = async (
    action: AuditAction,
    userId: string,
    userName: string,
    leaveId: string,
    leaveType: string,
    details?: string | Record<string, any>
) => {
    await createAuditLog({
        userId,
        userName,
        action,
        targetType: 'leave',
        targetId: leaveId,
        targetName: leaveType,
        details,
    });
};
/**
 * Helper function to log attendance operations
 */
export const logAttendanceAction = async (
    action: AuditAction,
    userId: string,
    userName: string,
    targetId: string,
    targetName: string,
    details?: string | Record<string, any>
) => {
    await createAuditLog({
        userId,
        userName,
        action,
        targetType: 'attendance',
        targetId,
        targetName,
        details,
    });
};
