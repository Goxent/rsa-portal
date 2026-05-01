// ─── NextcloudService ───────────────────────────────────────────────────────────

export const NextcloudService = {
    /**
     * Upload a file to Nextcloud via Vercel API proxy
     */
    uploadFile: async (file: File): Promise<{ $id: string; name: string; sizeOriginal: number; mimeType: string; url: string }> => {
        // Convert file to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                // Remove prefix: "data:image/png;base64,"
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });

        const response = await fetch('/api/nextcloud-upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: `${Date.now()}-${file.name}`,
                fileData: base64Data,
                mimeType: file.type || 'application/octet-stream'
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload to Nextcloud');
        }

        const data = await response.json();

        return {
            $id: data.id,
            name: file.name,
            sizeOriginal: file.size,
            mimeType: file.type,
            url: data.url
        };
    },

    /**
     * Delete a file from Nextcloud via Vercel API proxy
     */
    deleteFile: async (fileId: string): Promise<void> => {
        if (!fileId) return;
        const res = await fetch('/api/nextcloud-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileId })
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to delete file from Nextcloud');
        }
    },

    /**
     * Get view URL (if we have a consistent pattern, otherwise use the one from upload)
     */
    getFileView: (fileId: string): string => {
        if (!fileId) return '';
        // This is a guess based on standard Nextcloud structure
        // In a real scenario, we might store the full URL or use a proxy
        return `${import.meta.env.VITE_NEXTCLOUD_URL}/index.php/apps/files/?dir=/&openfile=${fileId}`;
    }
};
