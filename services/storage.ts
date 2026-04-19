import { GoogleDriveService } from './googleDrive';
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
            // 1. Try Google Drive First
            try {
                const uploadedFile = await GoogleDriveService.uploadFile(file);
                const fileId = uploadedFile.$id;
                const viewUrl = GoogleDriveService.getFileView(fileId);

                return {
                    success: true,
                    data: {
                        id: fileId,
                        name: file.name,
                        url: viewUrl,
                        type: StorageService.getFileType(file.type)
                    }
                };
            } catch (driveError: any) {
                // If Drive fails because of configuration, fallback to Appwrite
                const isConfigError = driveError.message?.includes('not configured') || 
                                     driveError.message?.includes('MISSING_DRIVE_CREDENTIALS');
                
                if (isConfigError) {
                    console.warn("Google Drive not configured, falling back to Appwrite...");
                    const appwriteFile = await AppwriteService.uploadFile(file);
                    return {
                        success: true,
                        data: {
                            id: appwriteFile.$id,
                            name: appwriteFile.name,
                            url: AppwriteService.getFileView(appwriteFile.$id),
                            type: StorageService.getFileType(file.type)
                        }
                    };
                }
                throw driveError; // Re-throw if it's a different kind of error
            }
        } catch (error: any) {
            console.error("Storage upload error:", error);
            return { success: false, error: error.message || "Failed to upload file" };
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
        // If fileId looks like a Google Drive ID (usually longer and alphanumeric)
        // vs Appwrite ID (usually shorter/custom). 
        // For simplicity, we try Google Drive path first, then Appwrite.
        try {
            if (fileId.length > 20) { // Typical Drive IDs are around 33 chars
                return GoogleDriveService.getFileView(fileId);
            }
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
        if (!fileId) return '';
        try {
            if (fileId.length > 20) {
                return GoogleDriveService.getFileDownload(fileId);
            }
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
            if (fileId.length > 20) {
                await GoogleDriveService.deleteFile(fileId);
            } else {
                await AppwriteService.deleteFile(fileId);
            }
            return { success: true };
        } catch (error: any) {
            console.error("Storage delete error:", error);
            return { success: false, error: error.message || "Failed to delete file" };
        }
    }
};
