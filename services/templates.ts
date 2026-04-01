import { db, storage } from './firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { TaskTemplate, Attachment, TemplateFolder } from '../types';

export const TemplateService = {
    // ── FOLDERS ─────────────────────────────────────────────────────────────
    getFolders: async (): Promise<TemplateFolder[]> => {
        const q = query(collection(db, 'template_folders'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TemplateFolder));
    },

    createFolder: async (folder: Omit<TemplateFolder, 'id' | 'createdAt'>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'template_folders'), {
            ...folder,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    },

    updateFolder: async (id: string, updates: Partial<TemplateFolder>): Promise<void> => {
        const docRef = doc(db, 'template_folders', id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: new Date().toISOString()
        });
    },

    deleteFolder: async (id: string): Promise<void> => {
        const docRef = doc(db, 'template_folders', id);
        await deleteDoc(docRef);
    },

    // ── TEMPLATES ───────────────────────────────────────────────────────────
    getAllTemplates: async (category?: string): Promise<TaskTemplate[]> => {
        let q = query(collection(db, 'task_templates'), orderBy('name', 'asc'));

        if (category && category !== 'ALL') {
            q = query(collection(db, 'task_templates'), where('category', '==', category), orderBy('name', 'asc'));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TaskTemplate));
    },

    createTemplate: async (template: Partial<TaskTemplate>): Promise<string> => {
        const docRef = await addDoc(collection(db, 'task_templates'), {
            ...template,
            usageCount: 0,
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
    },



    useTemplate: async (id: string): Promise<void> => {
        const docRef = doc(db, 'task_templates', id);
        try {
            await updateDoc(docRef, {
                usageCount: increment(1)
            });
        } catch (error) {
            console.error("Error updating template usage:", error);
        }
    }
};
