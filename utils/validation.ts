import { z } from 'zod';

// ============================================
// USER VALIDATION SCHEMAS
// ============================================

export const userProfileSchema = z.object({
    displayName: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
    email: z.string().email('Invalid email address'),
    phoneNumber: z.string().optional().refine(
        (val) => !val || /^[\d\s\-\+\(\)]+$/.test(val),
        'Invalid phone number format'
    ),
    department: z.string().min(1, 'Department is required'),
    position: z.string().min(1, 'Position is required'),
    address: z.string().optional(),
    dateOfJoining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    gender: z.enum(['Male', 'Female', 'Other']),
});

// ============================================
// CLIENT VALIDATION SCHEMAS
// ============================================

export const clientSchema = z.object({
    name: z.string().min(2, 'Client name must be at least 2 characters').max(200, 'Name is too long'),
    email: z.string().email('Invalid email address').or(z.string().length(0)),
    phone: z.string().min(7, 'Phone number must be at least 7 digits').optional().or(z.string().length(0)),
    address: z.string().optional(),
    serviceType: z.string().min(1, 'Service type is required'),
    contactPerson: z.string().optional(),
    taxId: z.string().optional(),
    businessType: z.string().optional(),
    riskCategory: z.enum(['Low', 'Medium', 'High']).optional(),
    previousAuditReportLink: z.string().url('Invalid URL format').optional().or(z.string().length(0)),
    financialHistory: z.string().optional(),
    revenueTrend: z.enum(['Growing', 'Stable', 'Declining']).optional(),
});

// ============================================
// TASK VALIDATION SCHEMAS
// ============================================

export const taskSchema = z.object({
    title: z.string().min(3, 'Task title must be at least 3 characters').max(200, 'Title is too long'),
    description: z.string().optional(),
    clientId: z.string().min(1, 'Client selection is required'),
    assignedTo: z.array(z.string()).min(1, 'At least one staff member must be assigned'),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED']),
    estimatedHours: z.number().min(0).optional(),
    tags: z.array(z.string()).optional(),
});

// ============================================
// LEAVE REQUEST VALIDATION SCHEMAS
// ============================================

export const leaveRequestSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    leaveType: z.enum(['SICK', 'CASUAL', 'ANNUAL', 'OTHER']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    reason: z.string().min(10, 'Reason must be at least 10 characters').max(500, 'Reason is too long'),
}).refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    {
        message: 'End date must be after or equal to start date',
        path: ['endDate'],
    }
);

// ============================================
// RESOURCE VALIDATION SCHEMAS
// ============================================

export const resourceSchema = z.object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(200, 'Title is too long'),
    description: z.string().optional(),
    category: z.enum(['NSA', 'NFRS', 'Tax', 'Law', 'SOP', 'Templates', 'Other']),
    folder: z.string().optional(),
    fileUrl: z.string().url('Invalid URL format').optional(),
    link: z.string().url('Invalid URL format').optional(),
    tags: z.array(z.string()).optional(),
});

// ============================================
// ATTENDANCE VALIDATION SCHEMAS
// ============================================

export const attendanceSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    checkInTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)').optional(),
    status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE']),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate data against a schema and return errors
 */
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } => {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors = result.error.errors.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`);
    return { success: false, errors };
};

/**
 * Get first error message from validation result
 */
export const getFirstError = (errors?: string[]): string => {
    return errors?.[0] || 'Validation failed';
};
