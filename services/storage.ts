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
    upload: async (file: File): Promise<StorageFile> => {
        const fileId = await AppwriteService.uploadFile(file);
        const viewUrl = AppwriteService.getFileView(fileId);

        let type: StorageFile['type'] = 'other';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type === 'application/pdf') type = 'pdf';
        else if (file.type.includes('word') || file.type.includes('document')) type = 'doc';

        return {
            id: fileId,
            name: file.name,
            url: viewUrl,
            type
        };
    },

    /**
     * Get a URL for viewing a file
     * For images/PDFs, returns a direct view link.
     * For docs, returns a download link (or can be used with Google Docs Viewer).
     */
    getViewUrl: (fileId: string): string => {
        return AppwriteService.getFileView(fileId);
    },

    /**
     * Get a URL for downloading a file
     */
    getDownloadUrl: (fileId: string): string => {
        return AppwriteService.getFileDownload(fileId);
    },

    /**
     * Delete a file
     */
    delete: async (fileId: string): Promise<void> => {
        await AppwriteService.deleteFile(fileId);
    }
};
