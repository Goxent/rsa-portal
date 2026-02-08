// Security Types and Interfaces

export type AuditAction =
    | 'auth.login'
    | 'auth.logout'
    | 'auth.login_failed'
    | 'auth.password_reset'
    | 'user.create'
    | 'user.update'
    | 'user.delete'
    | 'user.role_change'
    | 'task.create'
    | 'task.update'
    | 'task.delete'
    | 'task.status_change'
    | 'task.assign'
    | 'client.create'
    | 'client.update'
    | 'client.delete'
    | 'attendance.clock_in'
    | 'attendance.clock_out'
    | 'attendance.manual_entry'
    | 'leave.request'
    | 'leave.approve'
    | 'leave.reject'
    | 'resource.upload'
    | 'resource.download'
    | 'resource.delete'
    | 'settings.update'
    | 'export.generate'
    | 'search.query';

export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogEntry {
    id: string;
    timestamp: string;
    userId: string;
    userName: string;
    userEmail: string;
    action: AuditAction;
    resource: string;
    resourceId?: string;
    changes?: {
        before?: Record<string, any>;
        after?: Record<string, any>;
    };
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        sessionId?: string;
        location?: { city?: string; country?: string };
    };
    riskLevel: AuditRiskLevel;
    description: string;
}

export interface AuditLogFilters {
    userId?: string;
    action?: AuditAction;
    resource?: string;
    riskLevel?: AuditRiskLevel;
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
}

export interface SecurityAlert {
    id: string;
    type: 'failed_login' | 'suspicious_activity' | 'permission_change' | 'bulk_delete' | 'unusual_access';
    severity: 'warning' | 'critical';
    userId?: string;
    description: string;
    timestamp: string;
    resolved: boolean;
}

export interface SecurityStats {
    totalLogins24h: number;
    failedLogins24h: number;
    dataChanges24h: number;
    activeAlerts: number;
    securityScore: number;
}

// Permission definitions
export const PERMISSIONS = {
    MASTER_ADMIN: ['*'],
    ADMIN: [
        'read:all',
        'write:tasks',
        'write:clients',
        'write:users',
        'delete:tasks',
        'delete:clients',
        'read:audit_logs',
        'manage:settings',
        'export:data',
    ],
    MANAGER: [
        'read:all',
        'write:tasks',
        'write:own_clients',
        'read:team_audit_logs',
        'export:reports',
    ],
    STAFF: [
        'read:own',
        'write:own_tasks',
        'read:assigned_clients',
    ],
} as const;

// Risk level assignment rules
export const ACTION_RISK_LEVELS: Record<AuditAction, AuditRiskLevel> = {
    'auth.login': 'low',
    'auth.logout': 'low',
    'auth.login_failed': 'medium',
    'auth.password_reset': 'medium',
    'user.create': 'medium',
    'user.update': 'low',
    'user.delete': 'high',
    'user.role_change': 'critical',
    'task.create': 'low',
    'task.update': 'low',
    'task.delete': 'medium',
    'task.status_change': 'low',
    'task.assign': 'low',
    'client.create': 'low',
    'client.update': 'low',
    'client.delete': 'high',
    'attendance.clock_in': 'low',
    'attendance.clock_out': 'low',
    'attendance.manual_entry': 'medium',
    'leave.request': 'low',
    'leave.approve': 'low',
    'leave.reject': 'low',
    'resource.upload': 'low',
    'resource.download': 'low',
    'resource.delete': 'medium',
    'settings.update': 'high',
    'export.generate': 'medium',
    'search.query': 'low',
};
