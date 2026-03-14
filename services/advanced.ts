import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, deleteDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { ComplianceEvent, Template } from '../types/advanced';

// =============================================
// COMPLIANCE SERVICE
// =============================================

export const complianceKeys = { all: ['compliance'] as const };

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


