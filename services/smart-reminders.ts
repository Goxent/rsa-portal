// Smart Reminders & Scheduling Service
// Intelligent notification scheduling based on user behavior and deadlines

import { Task, UserProfile } from '../types';
import { AuthService } from './firebase';
import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, getDocs, updateDoc, doc, deleteDoc, Timestamp } from 'firebase/firestore';

export type ReminderType =
    | 'task_due'
    | 'task_overdue'
    | 'follow_up'
    | 'client_check_in'
    | 'attendance_reminder'
    | 'billing_reminder'
    | 'custom';

export type ReminderPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SmartReminder {
    id?: string;
    userId: string;
    type: ReminderType;
    priority: ReminderPriority;
    title: string;
    message: string;
    scheduledFor: string;
    createdAt: string;
    dismissed: boolean;
    snoozedUntil?: string;
    metadata?: {
        taskId?: string;
        clientId?: string;
        eventId?: string;
    };
    recurring?: {
        frequency: 'daily' | 'weekly' | 'monthly';
        endDate?: string;
    };
}

export interface ReminderPreferences {
    userId: string;
    enabledTypes: ReminderType[];
    quietHoursStart?: string; // HH:mm format
    quietHoursEnd?: string;
    advanceNotice: {
        task_due: number; // hours before
        billing_reminder: number;
        client_check_in: number;
    };
    emailNotifications: boolean;
    pushNotifications: boolean;
}

const REMINDERS_COLLECTION = 'smart_reminders';
const PREFERENCES_COLLECTION = 'reminder_preferences';

// Default advance notice in hours
const DEFAULT_ADVANCE_NOTICE = {
    task_due: 24,
    billing_reminder: 72,
    client_check_in: 168, // 1 week
};

export class SmartRemindersService {
    /**
     * Create a new reminder
     */
    static async createReminder(reminder: Omit<SmartReminder, 'id' | 'createdAt' | 'dismissed'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(db, REMINDERS_COLLECTION), {
                ...reminder,
                createdAt: new Date().toISOString(),
                dismissed: false,
            });
            return docRef.id;
        } catch (error) {
            console.error('Failed to create reminder:', error);
            throw error;
        }
    }

    /**
     * Get reminders for a user
     */
    static async getUserReminders(userId: string, includesDismissed = false): Promise<SmartReminder[]> {
        try {
            let q = query(
                collection(db, REMINDERS_COLLECTION),
                where('userId', '==', userId),
                orderBy('scheduledFor', 'asc')
            );

            const snapshot = await getDocs(q);
            let reminders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as SmartReminder[];

            if (!includesDismissed) {
                reminders = reminders.filter(r => !r.dismissed);
            }

            // Filter out snoozed reminders that haven't reached their snooze time
            const now = new Date().toISOString();
            reminders = reminders.filter(r => !r.snoozedUntil || r.snoozedUntil <= now);

            return reminders;
        } catch (error) {
            console.error('Failed to get reminders:', error);
            return [];
        }
    }

    /**
     * Get pending reminders (ready to be shown)
     */
    static async getPendingReminders(userId: string): Promise<SmartReminder[]> {
        const reminders = await this.getUserReminders(userId);
        const now = new Date().toISOString();
        return reminders.filter(r => r.scheduledFor <= now);
    }

    /**
     * Dismiss a reminder
     */
    static async dismissReminder(reminderId: string): Promise<void> {
        try {
            await updateDoc(doc(db, REMINDERS_COLLECTION, reminderId), {
                dismissed: true,
            });
        } catch (error) {
            console.error('Failed to dismiss reminder:', error);
        }
    }

    /**
     * Snooze a reminder
     */
    static async snoozeReminder(reminderId: string, snoozeMinutes: number): Promise<void> {
        try {
            const snoozeUntil = new Date(Date.now() + snoozeMinutes * 60 * 1000).toISOString();
            await updateDoc(doc(db, REMINDERS_COLLECTION, reminderId), {
                snoozedUntil: snoozeUntil,
            });
        } catch (error) {
            console.error('Failed to snooze reminder:', error);
        }
    }

    /**
     * Generate smart reminders based on tasks and events
     */
    static async generateTaskReminders(userId: string): Promise<void> {
        try {
            const tasks = await AuthService.getAllTasks();
            const userTasks = tasks.filter(t => t.assignedTo.includes(userId));
            const now = new Date();
            const hoursAhead = DEFAULT_ADVANCE_NOTICE.task_due;

            for (const task of userTasks) {
                if (task.status === 'COMPLETED' || task.status === 'BLOCKED') continue;

                const dueDate = new Date(task.dueDate);
                const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

                // Create reminder for upcoming tasks
                if (hoursUntilDue > 0 && hoursUntilDue <= hoursAhead) {
                    const existingReminders = await this.getUserReminders(userId);
                    const alreadyExists = existingReminders.some(
                        r => r.metadata?.taskId === task.id && r.type === 'task_due'
                    );

                    if (!alreadyExists) {
                        await this.createReminder({
                            userId,
                            type: 'task_due',
                            priority: this.getPriorityFromTask(task),
                            title: `Task Due Soon: ${task.title}`,
                            message: `Due in ${Math.round(hoursUntilDue)} hours`,
                            scheduledFor: new Date(dueDate.getTime() - hoursAhead * 60 * 60 * 1000).toISOString(),
                            metadata: { taskId: task.id },
                        });
                    }
                }

                // Create reminder for overdue tasks
                if (hoursUntilDue < 0) {
                    const existingReminders = await this.getUserReminders(userId);
                    const alreadyExists = existingReminders.some(
                        r => r.metadata?.taskId === task.id && r.type === 'task_overdue'
                    );

                    if (!alreadyExists) {
                        await this.createReminder({
                            userId,
                            type: 'task_overdue',
                            priority: 'urgent',
                            title: `Overdue Task: ${task.title}`,
                            message: `This task is ${Math.abs(Math.round(hoursUntilDue / 24))} days overdue`,
                            scheduledFor: now.toISOString(),
                            metadata: { taskId: task.id },
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to generate task reminders:', error);
        }
    }

    /**
     * Generate client follow-up reminders
     */
    static async generateClientFollowUps(userId: string): Promise<void> {
        try {
            const clients = await AuthService.getAllClients();
            const tasks = await AuthService.getAllTasks();
            const now = new Date();

            for (const client of clients) {
                // Find last interaction with client
                const clientTasks = tasks.filter(t => t.clientId === client.id);
                const sortedTasks = clientTasks
                    .filter(t => t.updatedAt)
                    .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());

                if (sortedTasks.length === 0) continue;

                const lastInteraction = new Date(sortedTasks[0].updatedAt!);
                const daysSinceInteraction = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);

                // Suggest follow-up if no interaction in 30+ days
                if (daysSinceInteraction >= 30) {
                    const existingReminders = await this.getUserReminders(userId);
                    const alreadyExists = existingReminders.some(
                        r => r.metadata?.clientId === client.id && r.type === 'client_check_in'
                    );

                    if (!alreadyExists) {
                        await this.createReminder({
                            userId,
                            type: 'client_check_in',
                            priority: daysSinceInteraction >= 60 ? 'high' : 'medium',
                            title: `Follow up with ${client.name}`,
                            message: `No activity for ${Math.round(daysSinceInteraction)} days`,
                            scheduledFor: now.toISOString(),
                            metadata: { clientId: client.id },
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to generate client follow-ups:', error);
        }
    }

    /**
     * Create a custom reminder
     */
    static async createCustomReminder(
        userId: string,
        title: string,
        message: string,
        scheduledFor: Date,
        priority: ReminderPriority = 'medium',
        recurring?: SmartReminder['recurring']
    ): Promise<string> {
        return this.createReminder({
            userId,
            type: 'custom',
            priority,
            title,
            message,
            scheduledFor: scheduledFor.toISOString(),
            recurring,
        });
    }

    /**
     * Get priority based on task properties
     */
    private static getPriorityFromTask(task: Task): ReminderPriority {
        switch (task.priority) {
            case 'URGENT': return 'urgent';
            case 'HIGH': return 'high';
            case 'MEDIUM': return 'medium';
            default: return 'low';
        }
    }

    /**
     * Get reminder statistics
     */
    static async getReminderStats(userId: string): Promise<{
        totalPending: number;
        byType: Record<ReminderType, number>;
        byPriority: Record<ReminderPriority, number>;
        urgentCount: number;
    }> {
        const reminders = await this.getPendingReminders(userId);

        const byType: Record<ReminderType, number> = {
            task_due: 0,
            task_overdue: 0,
            follow_up: 0,
            client_check_in: 0,
            attendance_reminder: 0,
            billing_reminder: 0,
            custom: 0,
        };

        const byPriority: Record<ReminderPriority, number> = {
            low: 0,
            medium: 0,
            high: 0,
            urgent: 0,
        };

        reminders.forEach(r => {
            byType[r.type]++;
            byPriority[r.priority]++;
        });

        return {
            totalPending: reminders.length,
            byType,
            byPriority,
            urgentCount: byPriority.urgent,
        };
    }

    /**
     * Run all reminder generators
     */
    static async runAllGenerators(userId: string): Promise<void> {
        await Promise.all([
            this.generateTaskReminders(userId),
            this.generateClientFollowUps(userId),
        ]);
    }
}
