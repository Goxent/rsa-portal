import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileId } = req.query;
    if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ error: 'fileId query param required' });
    }

    const username = process.env.NEXTCLOUD_USER;
    const password = process.env.NEXTCLOUD_APP_PASSWORD;
    const baseUrl = process.env.NEXTCLOUD_URL;

    if (!username || !password || !baseUrl) {
        return res.status(412).json({ error: 'Nextcloud credentials not configured' });
    }

    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const docsFolder = process.env.NEXTCLOUD_DOCS_FOLDER;
    const folderPath = docsFolder ? `${docsFolder}/` : '';
    const fileUrl = `${cleanBaseUrl}/remote.php/dav/files/${username}/${folderPath}${encodeURIComponent(fileId)}`;

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(fileUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Bypass-Tunnel-Reminder': 'true',
            },
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return res.status(response.status).json({
                error: `Failed to fetch file: HTTP ${response.status}`,
            });
        }

        // Forward content headers to browser
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const contentLength = response.headers.get('content-length');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileId}"`);
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.setHeader('Cache-Control', 'private, max-age=300');

        // Stream the file body back to the browser
        const buffer = await response.arrayBuffer();
        res.status(200).send(Buffer.from(buffer));

    } catch (error: any) {
        console.error('Nextcloud Download Error:', error);
        const cause = error.cause ? ` (Cause: ${error.cause})` : '';
        return res.status(500).json({ error: `${error.message}${cause}` });
    }
}
