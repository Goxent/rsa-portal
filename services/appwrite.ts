import { Client, Storage, ID } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID;

if (!endpoint || !projectId || !bucketId) {
    console.warn("Appwrite configuration missing. Storage features will be disabled.");
}

const client = new Client();

if (endpoint && projectId) {
    client
        .setEndpoint(endpoint)
        .setProject(projectId);
}

export const storage = new Storage(client);
export const BUCKET_ID = bucketId || '';

export const AppwriteService = {
    /**
     * Upload a file to Appwrite Storage
     * @param file File object to upload
     * @returns Promise resolving to the file ID
     */
    uploadFile: async (file: File): Promise<string> => {
        if (!BUCKET_ID) throw new Error("Appwrite Bucket ID not configured. Check VITE_APPWRITE_BUCKET_ID in .env or Vercel settings.");

        try {
            const response = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                file
            );
            return response.$id;
        } catch (error) {
            console.error("Appwrite Upload Error:", error);
            throw error;
        }
    },

    /**
     * Get a view URL for a file (for images/PDFs)
     * @param fileId ID of the file
     */
    getFileView: (fileId: string): string => {
        if (!BUCKET_ID) return '';
        return storage.getFileView(BUCKET_ID, fileId).toString();
    },

    /**
     * Get a download URL for a file
     * @param fileId ID of the file
     */
    getFileDownload: (fileId: string): string => {
        if (!BUCKET_ID) return '';
        return storage.getFileDownload(BUCKET_ID, fileId).toString();
    },

    /**
     * Delete a file
     * @param fileId ID of the file to delete
     */
    deleteFile: async (fileId: string): Promise<void> => {
        if (!BUCKET_ID) throw new Error("Appwrite Bucket ID not configured. Check VITE_APPWRITE_BUCKET_ID in .env or Vercel settings.");
        try {
            await storage.deleteFile(BUCKET_ID, fileId);
        } catch (error) {
            console.error("Appwrite Delete Error:", error);
            throw error;
        }
    }
};
