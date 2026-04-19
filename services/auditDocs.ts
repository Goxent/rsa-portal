/**
 * Audit Documentation Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Stores file metadata in Firestore + files in Appwrite Storage.
 * Architecture:
 *   Firestore `auditDocFiles`   → file metadata (clientId, FY, folder, etc.)
 *   Firestore `auditDocFolders` → custom user-created sub-folders per slot
 *   Appwrite Storage            → actual file binaries (fileId reference stored in Firestore)
 */

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    query,
    where,
    orderBy,
} from 'firebase/firestore';
import { GoogleDriveService } from './googleDrive';
import { AppwriteService } from './appwrite';
import { AuditFolderKey } from '../types';

const db = getFirestore();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditDocFile {
    id: string;              // Firestore document ID
    appwriteFileId: string;  // Appwrite Storage file ID
    clientId: string;
    clientName: string;
    fiscalYear: string;      // e.g. "2081-82"
    folderKey: AuditFolderKey;
    lineItem?: string;       // "B.3" — only for B folder line items
    lineItemLabel?: string;  // "B.3. Investments"
    customFolderId?: string; // If file lives inside a custom sub-folder
    fileName: string;
    fileSize: number;        // bytes
    mimeType: string;
    notes?: string;
    networkPath?: string;    // Future NAS UNC path
    uploadedBy: string;
    uploadedByName: string;
    uploadedAt: string;      // ISO
    taskId?: string;         // Linked Task
    taskType?: string;       // Linked Assignment Type (Statutory, Internal, etc)
    subtaskId?: string;      // Linked Procedure
}

export interface AuditDocFolder {
    id: string;              // Firestore document ID
    clientId: string;
    clientName: string;
    fiscalYear: string;
    folderKey: AuditFolderKey;
    lineItem?: string;       // parent line item (for B folder)
    name: string;
    taskId?: string;         // NEW: assignment link
    taskType?: string;       // NEW: assignment type link
    createdBy: string;
    createdByName: string;
    createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getMimeLabel = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PowerPoint';
    if (mimeType.startsWith('text/')) return 'Text';
    return 'File';
};

export { formatBytes, getMimeLabel };

// ─── AuditDocService ──────────────────────────────────────────────────────────

export const AuditDocService = {
    /**
     * Upload a file: push binary to Appwrite → store metadata in Firestore.
     */
    uploadFile: async (
        file: File,
        meta: Omit<AuditDocFile, 'id' | 'appwriteFileId' | 'fileName' | 'fileSize' | 'mimeType' | 'uploadedAt'>
    ): Promise<AuditDocFile> => {
        // 1. Push to Cloud Storage
        let storageFile: { $id: string };
        try {
            storageFile = await GoogleDriveService.uploadFile(file);
        } catch (driveError: any) {
            const isConfigError = driveError.message?.includes('not configured') || 
                                 driveError.message?.includes('MISSING_DRIVE_CREDENTIALS');
            
            if (isConfigError) {
                console.warn("Google Drive not configured for Audit Docs, falling back to Appwrite...");
                storageFile = await AppwriteService.uploadFile(file);
            } else {
                throw driveError;
            }
        }

        // 2. Store metadata in Firestore
        const record = AuditDocService.sanitizeData({
            appwriteFileId: storageFile.$id,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            uploadedAt: new Date().toISOString(),
            ...meta,
        });

        const docRef = await addDoc(collection(db, 'auditDocFiles'), record as any);
        return { id: docRef.id, ...record } as AuditDocFile;
    },

    /**
     * Get all files for a specific client + fiscal year + folder (+ optional line item).
     */
    getFiles: async (
        clientId: string,
        fiscalYear: string,
        folderKey: AuditFolderKey,
        lineItem?: string,
        taskId?: string
    ): Promise<AuditDocFile[]> => {
        const constraints = [
            where('clientId', '==', clientId),
            where('fiscalYear', '==', fiscalYear),
            where('folderKey', '==', folderKey),
        ];
        if (lineItem) constraints.push(where('lineItem', '==', lineItem));
        if (taskId) constraints.push(where('taskId', '==', taskId));

        const q = query(collection(db, 'auditDocFiles'), ...constraints);
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditDocFile));
        return results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    },

    /**
     * Get ALL files for a client + fiscal year (for aggregate stats).
     */
    getAllFiles: async (clientId: string, fiscalYear: string, taskId?: string): Promise<AuditDocFile[]> => {
        const constraints = [
            where('clientId', '==', clientId),
            where('fiscalYear', '==', fiscalYear),
        ];
        if (taskId) constraints.push(where('taskId', '==', taskId));
        
        const q = query(collection(db, 'auditDocFiles'), ...constraints);
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditDocFile));
        return results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    },

    /**
     * Update notes/networkPath for a file metadata record.
     */
    updateFileMeta: async (fileId: string, updates: Partial<Pick<AuditDocFile, 'notes' | 'networkPath'>>): Promise<void> => {
        const record = AuditDocService.sanitizeData(updates);
        await updateDoc(doc(db, 'auditDocFiles', fileId), record as any);
    },

    /**
     * Delete a file: remove from Appwrite Storage + remove Firestore metadata.
     */
    deleteFile: async (firestoreId: string, appwriteFileId: string): Promise<void> => {
        // Delete from Storage first
        if (appwriteFileId.length > 20) {
            await GoogleDriveService.deleteFile(appwriteFileId);
        } else {
            await AppwriteService.deleteFile(appwriteFileId);
        }
        // Then remove Firestore metadata
        await deleteDoc(doc(db, 'auditDocFiles', firestoreId));
    },

    // ─── Custom Folders ─────────────────────────────────────────────────────────
    
    /**
     * Helper to remove undefined values before Firestore operations
     */
    sanitizeData: <T extends object>(data: T): T => {
        const sanitized = { ...data } as any;
        Object.keys(sanitized).forEach(key => {
            if (sanitized[key] === undefined) {
                delete sanitized[key];
            }
        });
        return sanitized;
    },

    /**
     * Create a custom sub-folder within a main folder slot.
     */
    createFolder: async (
        folder: Omit<AuditDocFolder, 'id' | 'createdAt'>
    ): Promise<AuditDocFolder> => {
        const record = AuditDocService.sanitizeData({
            ...folder,
            createdAt: new Date().toISOString(),
        });
        const docRef = await addDoc(collection(db, 'auditDocFolders'), record as any);
        return { id: docRef.id, ...record } as AuditDocFolder;
    },

    /**
     * Get custom sub-folders for a main folder slot.
     */
    getFolders: async (
        clientId: string,
        fiscalYear: string,
        folderKey: AuditFolderKey,
        lineItem?: string,
        taskId?: string
    ): Promise<AuditDocFolder[]> => {
        const constraints = [
            where('clientId', '==', clientId),
            where('fiscalYear', '==', fiscalYear),
            where('folderKey', '==', folderKey),
        ];
        if (lineItem) constraints.push(where('lineItem', '==', lineItem));
        if (taskId) constraints.push(where('taskId', '==', taskId));

        const q = query(collection(db, 'auditDocFolders'), ...constraints);
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditDocFolder));
        return results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    /**
     * Delete a custom sub-folder (does NOT delete files inside — caller should handle).
     */
    deleteFolder: async (folderId: string): Promise<void> => {
        await deleteDoc(doc(db, 'auditDocFolders', folderId));
    },
};
