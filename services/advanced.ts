import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { TimeEntry, ChatMessage, ChatChannel, ComplianceEvent, Template, Workflow } from '../types/advanced';

// =============================================
// TIME TRACKING SERVICE
// =============================================

export const TimeTrackingService = {
    async startTimer(entry: Partial<TimeEntry>): Promise<string> {
        const newEntry: Omit<TimeEntry, 'id'> = {
            userId: entry.userId!,
            userName: entry.userName!,
            taskId: entry.taskId,
            taskTitle: entry.taskTitle,
            clientId: entry.clientId,
            clientName: entry.clientName,
            projectName: entry.projectName || 'General',
            description: entry.description || '',
            startTime: new Date().toISOString(),
            duration: 0,
            billable: entry.billable ?? false,
            hourlyRate: entry.hourlyRate,
            tags: entry.tags || [],
            date: new Date().toISOString().split('T')[0],
            status: 'RUNNING',
            createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(collection(db, 'timeEntries'), newEntry);
        return docRef.id;
    },

    async stopTimer(id: string): Promise<void> {
        const docRef = doc(db, 'timeEntries', id);
        const endTime = new Date().toISOString();
        await updateDoc(docRef, {
            endTime,
            status: 'COMPLETED',
        });
    },

    async updateDuration(id: string, duration: number): Promise<void> {
        await updateDoc(doc(db, 'timeEntries', id), { duration });
    },

    async getTimeEntries(userId?: string): Promise<TimeEntry[]> {
        const q = userId
            ? query(collection(db, 'timeEntries'), where('userId', '==', userId), orderBy('createdAt', 'desc'))
            : query(collection(db, 'timeEntries'), orderBy('createdAt', 'desc'));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry));
    },

    async deleteEntry(id: string): Promise<void> {
        await deleteDoc(doc(db, 'timeEntries', id));
    },
};

// =============================================
// CHAT SERVICE
// =============================================

export const ChatService = {
    async createChannel(channel: Omit<ChatChannel, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, 'chatChannels'), channel);
        return docRef.id;
    },

    async sendMessage(message: Omit<ChatMessage, 'id'>): Promise<void> {
        await addDoc(collection(db, 'chatMessages'), message);

        // Update channel's lastMessage
        const channelRef = doc(db, 'chatChannels', message.channelId);
        await updateDoc(channelRef, {
            lastMessage: message,
        });
    },

    subscribeToMessages(channelId: string, callback: (messages: ChatMessage[]) => void) {
        const q = query(
            collection(db, 'chatMessages'),
            where('channelId', '==', channelId),
            orderBy('timestamp', 'asc')
        );

        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            callback(messages);
        });
    },

    async getChannels(userId: string): Promise<ChatChannel[]> {
        const q = query(collection(db, 'chatChannels'), where('members', 'array-contains', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatChannel));
    },

    async updateChannel(id: string, updates: Partial<ChatChannel>): Promise<void> {
        await updateDoc(doc(db, 'chatChannels', id), updates);
    },

    async deleteChannel(id: string): Promise<void> {
        // Delete all messages in the channel first
        const messagesQuery = query(collection(db, 'chatMessages'), where('channelId', '==', id));
        const messagesSnapshot = await getDocs(messagesQuery);
        const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        // Delete the channel
        await deleteDoc(doc(db, 'chatChannels', id));
    },

    // User Integration: Add new user to all public channels
    async addUserToPublicChannels(userId: string): Promise<void> {
        const publicChannelsQuery = query(collection(db, 'chatChannels'), where('type', '==', 'PUBLIC'));
        const snapshot = await getDocs(publicChannelsQuery);

        const updatePromises = snapshot.docs.map(async (channelDoc) => {
            const channelData = channelDoc.data() as ChatChannel;
            if (!channelData.members.includes(userId)) {
                const updatedMembers = [...channelData.members, userId];
                await updateDoc(doc(db, 'chatChannels', channelDoc.id), { members: updatedMembers });
            }
        });

        await Promise.all(updatePromises);
    },

    // Ensure a default 'general' channel exists
    async ensureGeneralChannel(creatorId: string): Promise<string> {
        // Check if general channel exists
        const generalQuery = query(collection(db, 'chatChannels'), where('name', '==', 'general'));
        const snapshot = await getDocs(generalQuery);

        if (!snapshot.empty) {
            return snapshot.docs[0].id;
        }

        // Create general channel if it doesn't exist
        const generalChannel: Omit<ChatChannel, 'id'> = {
            name: 'general',
            description: 'General discussion for all team members',
            type: 'PUBLIC',
            members: [creatorId],
            createdBy: creatorId,
            createdAt: new Date().toISOString(),
        };

        return await this.createChannel(generalChannel);
    },

    // Remove user from all channels when user is deleted
    async removeUserFromAllChannels(userId: string): Promise<void> {
        const userChannelsQuery = query(collection(db, 'chatChannels'), where('members', 'array-contains', userId));
        const snapshot = await getDocs(userChannelsQuery);

        const updatePromises = snapshot.docs.map(async (channelDoc) => {
            const channelData = channelDoc.data() as ChatChannel;
            const updatedMembers = channelData.members.filter(m => m !== userId);
            await updateDoc(doc(db, 'chatChannels', channelDoc.id), { members: updatedMembers });
        });

        await Promise.all(updatePromises);
    },

    async markAsRead(messageId: string, userId: string): Promise<void> {
        const msgRef = doc(db, 'chatMessages', messageId);
        const msgDoc = await getDocs(query(collection(db, 'chatMessages'), where('__name__', '==', messageId)));
        if (!msgDoc.empty) {
            const data = msgDoc.docs[0].data() as ChatMessage;
            const readBy = data.readBy || [];
            if (!readBy.includes(userId)) {
                await updateDoc(msgRef, {
                    readBy: [...readBy, userId],
                });
            }
        }
    },
};

// =============================================
// COMPLIANCE SERVICE
// =============================================

export const ComplianceService = {
    async createEvent(event: Omit<ComplianceEvent, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, 'complianceEvents'), event);
        return docRef.id;
    },

    async getEvents(userId?: string): Promise<ComplianceEvent[]> {
        const q = userId
            ? query(collection(db, 'complianceEvents'), where('assignedTo', 'array-contains', userId), orderBy('dueDate', 'asc'))
            : query(collection(db, 'complianceEvents'), orderBy('dueDate', 'asc'));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ComplianceEvent));
    },

    async updateEvent(id: string, updates: Partial<ComplianceEvent>): Promise<void> {
        await updateDoc(doc(db, 'complianceEvents', id), updates);
    },

    async deleteEvent(id: string): Promise<void> {
        await deleteDoc(doc(db, 'complianceEvents', id));
    },

    async completeEvent(id: string): Promise<void> {
        await updateDoc(doc(db, 'complianceEvents', id), {
            status: 'COMPLETED',
            completedAt: new Date().toISOString(),
        });
    },
};

// =============================================
// TEMPLATE SERVICE
// =============================================

export const TemplateService = {
    async createTemplate(template: Omit<Template, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, 'templates'), {
            ...template,
            usageCount: 0,
        });
        return docRef.id;
    },

    async getTemplates(category?: string): Promise<Template[]> {
        const q = category
            ? query(collection(db, 'templates'), where('category', '==', category), orderBy('usageCount', 'desc'))
            : query(collection(db, 'templates'), orderBy('usageCount', 'desc'));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Template));
    },

    async useTemplate(id: string): Promise<void> {
        const templateRef = doc(db, 'templates', id);
        const snapshot = await getDocs(query(collection(db, 'templates'), where('__name__', '==', id)));
        if (!snapshot.empty) {
            const data = snapshot.docs[0].data() as Template;
            await updateDoc(templateRef, {
                usageCount: (data.usageCount || 0) + 1,
                lastUsed: new Date().toISOString(),
            });
        }
    },

    async deleteTemplate(id: string): Promise<void> {
        await deleteDoc(doc(db, 'templates', id));
    },
};

// =============================================
// WORKFLOW SERVICE
// =============================================

export const WorkflowService = {
    async createWorkflow(workflow: Omit<Workflow, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(db, 'workflows'), workflow);
        return docRef.id;
    },

    async getWorkflows(): Promise<Workflow[]> {
        const snapshot = await getDocs(collection(db, 'workflows'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow));
    },

    async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<void> {
        await updateDoc(doc(db, 'workflows', id), updates);
    },

    async deleteWorkflow(id: string): Promise<void> {
        await deleteDoc(doc(db, 'workflows', id));
    },
};
