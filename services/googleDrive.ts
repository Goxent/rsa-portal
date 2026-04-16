// ─── GoogleDriveService ──────────────────────────────────────────────────────────

export const GoogleDriveService = {
    /**
     * Upload a file to Google Drive directly from the browser using a Backend-generated Resumable URL.
     * Returns an object that matches the expected Appwrite File format.
     */
    uploadFile: async (file: File): Promise<{ $id: string; name: string; sizeOriginal: number; mimeType: string }> => {
        // 1. Get the resumable upload URL from our Vercel API
        const resUrl = await fetch('/api/get-drive-upload-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream'
            })
        });

        if (!resUrl.ok) {
            const error = await resUrl.json();
            throw new Error(error.error || 'Failed to initialize Google Drive upload session');
        }

        const { uploadUrl } = await resUrl.json();

        // 2. PUT the actual file data directly to Google Drive via the Resumable URL
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Length': file.size.toString(),
            },
            body: file
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Google Drive Upload Failed: ${errorText}`);
        }

        const driveData = await uploadResponse.json();

        // Drive returns: { id, name, mimeType }
        // We wrap it in a mock structure to satisfy existing Appwrite types in the app
        return {
            $id: driveData.id,
            name: driveData.name,
            sizeOriginal: file.size,
            mimeType: driveData.mimeType || file.type,
        };
    },

    /**
     * Get a view URL for a file (opens inline if public, or requires Google login).
     */
    getFileView: (fileId: string): string => {
        if (!fileId) return '';
        return `https://drive.google.com/file/d/${fileId}/view`;
    },

    /**
     * Get a direct download URL.
     */
    getFileDownload: (fileId: string): string => {
        if (!fileId) return '';
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    },

    /**
     * Delete a file from Google Drive via backend proxy.
     */
    deleteFile: async (fileId: string): Promise<void> => {
        if (!fileId) return;
        const res = await fetch('/api/delete-drive-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileId })
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to delete file from Google Drive');
        }
    },
};
