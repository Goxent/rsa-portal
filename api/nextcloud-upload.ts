import type { VercelRequest, VercelResponse } from '@vercel/node';
import verifyFirebaseToken from './_verifyFirebaseToken';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    const allowedOrigin = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const caller = await verifyFirebaseToken(req, res);
    if (!caller) return;

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { fileName, fileData, mimeType } = req.body;
        if (!fileName || !fileData) return res.status(400).json({ error: 'fileName and fileData required' });

        if (Buffer.from(fileData, 'base64').byteLength > 10 * 1024 * 1024) {
            return res.status(413).json({ error: 'File exceeds 10 MB limit.' });
        }

        const username = process.env.NEXTCLOUD_USERNAME;
        const password = process.env.NEXTCLOUD_APP_PASSWORD;
        const baseUrl = process.env.NEXTCLOUD_URL;

        if (!username || !password || !baseUrl) {
            return res.status(412).json({ error: 'Nextcloud credentials not configured' });
        }

        // WebDAV URL for Nextcloud
        // Reverting to the standard /remote.php/dav/files/{username}/{filePath}
        // but ensuring proper encoding and adding a trailing slash after username.
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const uploadUrl = `${cleanBaseUrl}/remote.php/dav/files/${username}/${encodeURIComponent(fileName)}`;

        // Basic Auth Header
        const auth = Buffer.from(`${username}:${password}`).toString('base64');

        // Convert base64 fileData back to buffer
        const buffer = Buffer.from(fileData, 'base64');

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': mimeType || 'application/octet-stream',
            },
            body: buffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Nextcloud Upload Failed: ${response.status} ${errorText}`);
        }

        // Return the URL where the file can be viewed
        // For Nextcloud, public links are different, but for authenticated access we can use the WebDAV URL or a direct link if known.
        // For now, we'll return the WebDAV URL as the ID and a likely preview URL.
        const viewUrl = `${cleanBaseUrl}/index.php/apps/files/?dir=/&openfile=${fileName}`;

        res.status(200).json({ 
            success: true, 
            id: fileName, 
            url: viewUrl,
            message: 'File uploaded to Nextcloud successfully'
        });
    } catch (error: any) {
        console.error('Nextcloud Upload Error:', error);
        // Provide more context for "fetch failed" errors
        const errorMessage = error.cause ? `${error.message} (Cause: ${error.cause})` : error.message;
        res.status(500).json({ 
            error: errorMessage,
            code: error.code || 'UNKNOWN_ERROR',
            suggestion: 'Ensure your Nextcloud server is accessible from the public internet and port 8080 is forwarded.'
        });
    }
}
