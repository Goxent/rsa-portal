export const DriveService = {
    /**
     * Upload a file to Google Drive via our Vercel API
     */
    uploadFile: async (file: File): Promise<{
        id: string;
        name: string;
        url: string;
        downloadUrl: string;
    }> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload-drive', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload to Google Drive');
        }

        const data = await response.json();
        return data.file;
    }
};
