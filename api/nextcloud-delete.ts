import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-secret');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Lightweight secret-based auth (no firebase-admin needed)
    const secret = process.env.API_SECRET;
    if (secret) {
        const provided = req.headers['x-api-secret'] || req.headers.authorization?.replace('Bearer ', '');
        if (provided !== secret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ error: 'fileId required' });

        const username = process.env.NEXTCLOUD_USER;
        const password = process.env.NEXTCLOUD_APP_PASSWORD;
        const baseUrl = process.env.NEXTCLOUD_URL;

        if (!username || !password || !baseUrl) {
            return res.status(412).json({ error: 'Nextcloud credentials not configured' });
        }

        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const docsFolder = process.env.NEXTCLOUD_DOCS_FOLDER;
        const folderPath = docsFolder ? `${docsFolder}/` : '';
        const deleteUrl = `${cleanBaseUrl}/remote.php/dav/files/${username}/${folderPath}${encodeURIComponent(fileId)}`;

        const auth = Buffer.from(`${username}:${password}`).toString('base64');

        const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Bypass-Tunnel-Reminder': 'true',
            },
        });

        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            return res.status(response.status).json({
                error: `Nextcloud Delete Failed: HTTP ${response.status}`,
                details: errorText.substring(0, 500),
            });
        }

        return res.status(200).json({ success: true, message: 'File deleted from Nextcloud' });

    } catch (error: any) {
        console.error('Nextcloud Delete Error:', error);
        const cause = error.cause ? ` (Cause: ${error.cause})` : '';
        return res.status(500).json({
            error: `${error.message}${cause}`,
            code: error.code || 'UNKNOWN_ERROR',
        });
    }
}
