import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const taskSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    clientId: z.string().min(1, 'Client is required'),
    dueDate: z.string().min(1, 'Due date is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'CLIENT_REVIEW', 'COMPLETED']),
    estimatedHours: z.number().min(0).optional(),
    tags: z.array(z.string()).optional(),
    assignedTo: z.array(z.string()).optional(),
    description: z.string().optional(),
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

export type LoginFormValues = z.infer<typeof loginSchema>;
export type TaskFormValues = z.infer<typeof taskSchema>;
export type ClientFormValues = z.infer<typeof clientSchema>;
export type LeaveFormValues = z.infer<typeof leaveSchema>;
