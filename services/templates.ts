
import { db } from './firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { TaskTemplate } from '../types';

export const TemplateService = {
    getAllTemplates: async (): Promise<TaskTemplate[]> => {
        const q = query(collection(db, 'task_templates'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TaskTemplate));
    },

    createTemplate: async (template: Partial<TaskTemplate>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'task_templates'), {
            ...template,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    },

    updateTemplate: async (id: string, updates: Partial<TaskTemplate>): Promise<void> => {
        const docRef = doc(db, 'task_templates', id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: new Date().toISOString()
        });
    },

    deleteTemplate: async (id: string): Promise<void> => {
        const docRef = doc(db, 'task_templates', id);
        await deleteDoc(docRef);
    }
};
