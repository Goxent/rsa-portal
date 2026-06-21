// ─── NextcloudService ───────────────────────────────────────────────────────────

export const NextcloudService = {
    /**
     * Upload a file to Nextcloud via Vercel API proxy
     */
    uploadFile: async (
        file: File, 
        onProgress?: (percent: number) => void
    ): Promise<{ $id: string; name: string; sizeOriginal: number; mimeType: string; url: string }> => {
        // Convert file to base64
        const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });

        const fileName = `${Date.now()}-${file.name}`;
        const mimeType = file.type || 'application/octet-stream';

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/nextcloud-upload');
            xhr.setRequestHeader('Content-Type', 'application/json');

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const data = JSON.parse(xhr.responseText);
                    resolve({
                        $id: data.id,
                        name: file.name,
                        sizeOriginal: file.size,
                        mimeType: file.type,
                        url: data.url
                    });
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.error || 'Failed to upload to Nextcloud'));
                    } catch {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));
            
            xhr.send(JSON.stringify({
                fileName,
                fileData: base64Data,
                mimeType
            }));
        });
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
        return `${import.meta.env.VITE_NEXTCLOUD_URL}/index.php/apps/files/?dir=/&openfile=${encodeURIComponent(fileId)}`;
    }
};
