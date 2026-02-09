// Time Tracking Types
export interface TimeEntry {
    id: string;
    userId: string;
    userName: string;
    taskId?: string;
    taskTitle?: string;
    clientId?: string;
    clientName?: string;
    projectName?: string;
    description: string;
    startTime: string; // ISO timestamp
    endTime?: string; // ISO timestamp (null if running)
    duration: number; // seconds
    billable: boolean;
    hourlyRate?: number;
    tags?: string[];
    date: string; // YYYY-MM-DD
    status: 'RUNNING' | 'PAUSED' | 'COMPLETED';
    createdAt: string;
}

// Workflow Automation Types
export interface WorkflowStage {
    id: string;
    name: string;
    color: string;
    order: number;
}

export interface WorkflowRule {
    id: string;
    name: string;
    trigger: 'STATUS_CHANGE' | 'DATE_REACHED' | 'MANUAL' | 'FIELD_UPDATE';
    conditions: {
        field: string;
        operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
        value: any;
    }[];
    actions: {
        type: 'ASSIGN_USER' | 'SEND_EMAIL' | 'UPDATE_FIELD' | 'CREATE_TASK';
        params: Record<string, any>;
    }[];
    enabled: boolean;
}

export interface Workflow {
    id: string;
    name: string;
    description: string;
    entityType: 'TASK' | 'CLIENT' | 'PROJECT';
    stages: WorkflowStage[];
    rules: WorkflowRule[];
    createdBy: string;
    createdAt: string;
}

// Chat Types
export interface ChatMessage {
    id: string;
    channelId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    content: string;
    attachments?: {
        name: string;
        url: string;
        type: string;
    }[];
    timestamp: string;
    edited?: boolean;
    editedAt?: string;
    readBy: string[]; // Array of user IDs
}

export interface ChatChannel {
    id: string;
    name: string;
    description?: string;
    type: 'PUBLIC' | 'PRIVATE' | 'DIRECT';
    members: string[]; // User IDs
    createdBy: string;
    createdAt: string;
    lastMessage?: ChatMessage;
    unreadCount?: number;
}

// Compliance Types
export interface ComplianceEvent {
    id: string;
    title: string;
    description: string;
    category: 'TAX' | 'AUDIT' | 'REGULATORY' | 'INTERNAL';
    dueDate: string; // YYYY-MM-DD
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';
    assignedTo: string[];
    clientId?: string;
    clientName?: string;
    checklist?: {
        id: string;
        title: string;
        completed: boolean;
    }[];
    attachments?: string[];
    isRecurring: boolean;
    recurrenceRule?: {
        frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
        interval: number;
    };
    createdBy: string;
    createdAt: string;
    completedAt?: string;
}

// Template Types
export interface Template {
    id: string;
    name: string;
    description: string;
    category: 'TASK' | 'CHECKLIST' | 'DOCUMENT' | 'WORKFLOW';
    type: string; // Specific type within category
    content: any; // Template structure (depends on category)
    tags: string[];
    public: boolean; // Available to all users
    createdBy: string;
    createdAt: string;
    usageCount: number;
    lastUsed?: string;
}

// Analytics Types
export interface AnalyticsMetric {
    label: string;
    value: number;
    change?: number; // Percentage change
    trend?: 'up' | 'down' | 'stable';
}

export interface ChartDataPoint {
    label: string;
    value: number;
    date?: string;
}
