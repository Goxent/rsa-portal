import { AppwriteService } from './appwrite';

export interface StorageFile {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'pdf' | 'doc' | 'other';
}

export const StorageService = {
    /**
     * Upload a file and return its metadata including a viewable URL
     */
    upload: async (file: File): Promise<{ success: boolean; data?: StorageFile; error?: string }> => {
        try {
            const fileId = await AppwriteService.uploadFile(file);
            const viewUrl = AppwriteService.getFileView(fileId);

            let type: StorageFile['type'] = 'other';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type === 'application/pdf') type = 'pdf';
            else if (file.type.includes('word') || file.type.includes('document')) type = 'doc';

            return {
                success: true,
                data: {
                    id: fileId,
                    name: file.name,
                    url: viewUrl,
                    type
                }
            };
        } catch (error: any) {
            console.error("Storage upload error:", error);
            return { success: false, error: error.message || "Failed to upload file" };
        }
    },

    /**
     * Get a URL for viewing a file
     */
    getViewUrl: (fileId: string): string => {
        try {
            return AppwriteService.getFileView(fileId);
        } catch (error) {
            console.error("Storage getViewUrl error:", error);
            return '';
        }
    },

    /**
     * Get a URL for downloading a file
     */
    getDownloadUrl: (fileId: string): string => {
        try {
            return AppwriteService.getFileDownload(fileId);
        } catch (error) {
            console.error("Storage getDownloadUrl error:", error);
            return '';
        }
    },

    /**
     * Delete a file
     */
    delete: async (fileId: string): Promise<{ success: boolean; error?: string }> => {
        try {
            await AppwriteService.deleteFile(fileId);
            return { success: true };
        } catch (error: any) {
            console.error("Storage delete error:", error);
            return { success: false, error: error.message || "Failed to delete file" };
        }
    }
};
