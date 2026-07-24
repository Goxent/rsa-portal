import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '25mb',
        },
    },
};

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
        const { fileName, fileData, mimeType } = req.body;
        if (!fileName || !fileData) {
            return res.status(400).json({ error: 'fileName and fileData required' });
        }

        const fileSizeBytes = Buffer.from(fileData, 'base64').byteLength;
        if (fileSizeBytes > 20 * 1024 * 1024) {
            return res.status(413).json({ error: 'File exceeds 20 MB limit.' });
        }

        const username = process.env.NEXTCLOUD_USER;
        const password = process.env.NEXTCLOUD_APP_PASSWORD;
        const baseUrl = process.env.NEXTCLOUD_URL;

        if (!username || !password || !baseUrl) {
            return res.status(412).json({
                error: 'Nextcloud credentials not configured',
                missing: { user: !username, password: !password, url: !baseUrl }
            });
        }

        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const docsFolder = process.env.NEXTCLOUD_DOCS_FOLDER;
        const encodedFileName = encodeURIComponent(fileName);
        const folderPath = docsFolder ? `${docsFolder}/` : '';
        const uploadUrl = `${cleanBaseUrl}/remote.php/dav/files/${username}/${folderPath}${encodedFileName}`;

        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        const buffer = Buffer.from(fileData, 'base64');
        const baseHeaders: Record<string, string> = {
            'Authorization': `Basic ${auth}`,
            'Bypass-Tunnel-Reminder': 'true',
            'Content-Length': String(buffer.byteLength),
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

        let response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { ...baseHeaders, 'Content-Type': mimeType || 'application/octet-stream' },
            body: buffer,
            signal: controller.signal,
        });
        clearTimeout(timeout);

        // If folder doesn't exist (409 Conflict), create it then retry
        if (response.status === 409 && docsFolder) {
            const folderUrl = `${cleanBaseUrl}/remote.php/dav/files/${username}/${docsFolder}/`;
            await fetch(folderUrl, { method: 'MKCOL', headers: baseHeaders });
            response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { ...baseHeaders, 'Content-Type': mimeType || 'application/octet-stream' },
                body: buffer,
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({
                error: `Nextcloud Upload Failed: HTTP ${response.status}`,
                details: errorText.substring(0, 500),
            });
        }

        const viewUrl = `${cleanBaseUrl}/index.php/apps/files/?dir=/${docsFolder || ''}`;
        return res.status(200).json({
            success: true,
            id: fileName,
            url: viewUrl,
            message: 'File uploaded to Nextcloud successfully',
        });

    } catch (error: any) {
        console.error('Nextcloud Upload Error:', error);
        const cause = error.cause ? ` (Cause: ${error.cause})` : '';
        return res.status(500).json({
            error: `${error.message}${cause}`,
            code: error.code || 'UNKNOWN_ERROR',
        });
    }
}
