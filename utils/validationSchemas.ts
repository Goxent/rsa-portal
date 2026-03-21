import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const taskSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    clientId: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().min(1, 'Due date is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'UNDER_REVIEW', 'HALTED', 'COMPLETED', 'ARCHIVED']),
    estimatedHours: z.number().min(0).optional(),
    tags: z.array(z.string()).optional(),
    assignedTo: z.array(z.string()).optional(),
    teamLeaderId: z.string().optional(),
    description: z.string().optional(),
    auditPhase: z.enum(['ONBOARDING', 'PLANNING_AND_EXECUTION', 'REVIEW_AND_CONCLUSION', 'NONE']).optional(),
});

export const clientSchema = z.object({
    name: z.string().min(1, 'Company Name is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    pan: z.string().optional(),
    industry: z.string().optional(),
    contactPerson: z.object({
        name: z.string().optional(),
        email: z.string().email('Invalid email').optional().or(z.literal('')),
        phone: z.string().optional(),
    }).optional(),
});

export const leaveSchema = z.object({
    type: z.enum(['SICK', 'CASUAL', 'EARNED', 'UNPAID']),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().min(1, 'Reason is required'),
});

export const signupSchema = loginSchema.extend({
    confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
export type TaskFormValues = z.infer<typeof taskSchema>;
export type ClientFormValues = z.infer<typeof clientSchema>;
export type LeaveFormValues = z.infer<typeof leaveSchema>;
