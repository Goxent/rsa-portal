import { NextcloudService } from './nextcloud';

export interface StorageFile {
    id: string;
    name: string;
    url: string;
    type: 'image' | 'pdf' | 'doc' | 'other';
}

export const StorageService = {
    /**
     * Upload a file and return its metadata including a viewable URL
     * Now using Nextcloud as the sole storage provider.
     */
    upload: async (file: File): Promise<{ success: boolean; data?: StorageFile; error?: string }> => {
        try {
            const uploadedFile = await NextcloudService.uploadFile(file);
            return {
                success: true,
                data: {
                    id: uploadedFile.$id, // No prefix needed as it's the only provider now
                    name: file.name,
                    url: uploadedFile.url,
                    type: StorageService.getFileType(file.type)
                }
            };
        } catch (error: any) {
            console.error("Storage upload error:", error);
            return { success: false, error: error.message || "Failed to upload file to Nextcloud" };
        }
    },

    /**
     * Helper to determine file type category
     */
    getFileType: (mimeType: string): StorageFile['type'] => {
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType === 'application/pdf') return 'pdf';
        if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
        return 'other';
    },

    /**
     * Get a URL for viewing a file
     */
    getViewUrl: (fileId: string): string => {
        if (!fileId) return '';
        try {
            // Remove 'nc-' prefix if it exists (from old records)
            const cleanId = fileId.startsWith('nc-') ? fileId.replace('nc-', '') : fileId;
            return NextcloudService.getFileView(cleanId);
        } catch (error) {
            console.error("Storage getViewUrl error:", error);
            return '';
        }
    },

    /**
     * Get a URL for downloading a file
     */
    getDownloadUrl: (fileId: string): string => {
        if (!fileId) return '';
        try {
            const cleanId = fileId.startsWith('nc-') ? fileId.replace('nc-', '') : fileId;
            return NextcloudService.getFileView(cleanId);
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
            const cleanId = fileId.startsWith('nc-') ? fileId.replace('nc-', '') : fileId;
            await NextcloudService.deleteFile(cleanId);
            return { success: true };
        } catch (error: any) {
            console.error("Storage delete error:", error);
            return { success: false, error: error.message || "Failed to delete file from Nextcloud" };
        }
    }
};
