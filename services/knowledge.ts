import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Resource } from '../types';

const COLLECTION_NAME = 'knowledge_base';

export const KnowledgeService = {
    // Get all resources
    getAllResources: async (): Promise<Resource[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Resource));
        } catch (error) {
            console.error("Error fetching knowledge base:", error);
            return [];
        }
    },

    // Get resources by category
    getResourcesByCategory: async (category: string): Promise<Resource[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where('category', '==', category),
                orderBy('updatedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Resource));
        } catch (error) {
            console.error(`Error fetching category ${category}:`, error);
            return [];
        }
    },

    // Add new resource
    addResource: async (resource: Omit<Resource, 'id'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...resource,
                updatedAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding resource:", error);
            throw error;
        }
    },

    // Update resource
    updateResource: async (id: string, updates: Partial<Resource>): Promise<void> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error updating resource:", error);
            throw error;
        }
    },

    // Delete resource
    deleteResource: async (id: string): Promise<void> => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting resource:", error);
            throw error;
        }
    }
};
