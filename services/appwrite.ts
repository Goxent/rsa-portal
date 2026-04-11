import { Client, Storage, ID, Query, Models } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;

if (!endpoint || !projectId || !bucketId) {
    console.warn('Appwrite configuration missing. Storage features will be disabled.');
}

const client = new Client();

if (endpoint && projectId) {
    client
        .setEndpoint(endpoint)
        .setProject(projectId);
}

export const storage = new Storage(client);
export const BUCKET_ID = bucketId || '';

// ─── Path helpers ──────────────────────────────────────────────────────────────
// Appwrite Storage is a flat bucket. We simulate folder hierarchy by embedding
// the logical path as a prefix in the stored file name metadata (via Firestore).
// Appwrite file IDs are stored in Firestore; Appwrite holds the actual binary.

export const buildAuditPath = (
    clientId: string,
    fiscalYear: string,
    folderKey: string,
    lineItem?: string
): string => {
    const base = `${clientId}__${fiscalYear}__${folderKey}`;
    return lineItem ? `${base}__${lineItem}` : base;
};

// ─── AppwriteService ───────────────────────────────────────────────────────────

export const AppwriteService = {
    /**
     * Upload a file to Appwrite Storage.
     * Returns the full Models.File object (id, name, size, mimeType, etc.)
     */
    uploadFile: async (file: File): Promise<Models.File> => {
        if (!BUCKET_ID) throw new Error('Appwrite Bucket ID not configured. Check VITE_APPWRITE_BUCKET_ID.');
        return storage.createFile(BUCKET_ID, ID.unique(), file);
    },

    /**
     * List files in the bucket. Optional name search for prefix filtering.
     */
    listFiles: async (search?: string): Promise<Models.FileList> => {
        if (!BUCKET_ID) throw new Error('Appwrite Bucket ID not configured.');
        const queries: string[] = [Query.limit(200), Query.orderDesc('$createdAt')];
        if (search) queries.push(Query.search('name', search));
        return storage.listFiles(BUCKET_ID, queries);
    },

    /**
     * Get metadata for a specific file.
     */
    getFileMeta: async (fileId: string): Promise<Models.File> => {
        if (!BUCKET_ID) throw new Error('Appwrite Bucket ID not configured.');
        return storage.getFile(BUCKET_ID, fileId);
    },

    /**
     * Get a view URL for a file (images/PDFs open inline).
     */
    getFileView: (fileId: string): string => {
        if (!BUCKET_ID) return '';
        return storage.getFileView(BUCKET_ID, fileId).toString();
    },

    /**
     * Get a direct download URL.
     */
    getFileDownload: (fileId: string): string => {
        if (!BUCKET_ID) return '';
        return storage.getFileDownload(BUCKET_ID, fileId).toString();
    },

    /**
     * Delete a file from storage.
     */
    deleteFile: async (fileId: string): Promise<void> => {
        if (!BUCKET_ID) throw new Error('Appwrite Bucket ID not configured.');
        await storage.deleteFile(BUCKET_ID, fileId);
    },
};
