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

        const responseText = await response.text();
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Non-JSON Response:", responseText);
            throw new Error(`Server Error: ${response.status} ${response.statusText}. Check Vercel Logs.`);
        }

        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload to Google Drive');
        }
        return data.file;
    }
};
