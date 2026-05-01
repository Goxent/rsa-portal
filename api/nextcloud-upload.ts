import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { fileName, fileData, mimeType } = req.body;
        if (!fileName || !fileData) return res.status(400).json({ error: 'fileName and fileData required' });

        const username = process.env.NEXTCLOUD_USERNAME;
        const password = process.env.NEXTCLOUD_APP_PASSWORD;
        const baseUrl = process.env.NEXTCLOUD_URL;

        if (!username || !password || !baseUrl) {
            return res.status(412).json({ error: 'Nextcloud credentials not configured' });
        }

        // WebDAV URL for Nextcloud
        // Format: {baseUrl}/remote.php/dav/files/{username}/{filePath}
        const uploadUrl = `${baseUrl}/remote.php/dav/files/${username}/${fileName}`;

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
        const viewUrl = `${baseUrl}/index.php/apps/files/?dir=/&openfile=${fileName}`;

        res.status(200).json({ 
            success: true, 
            id: fileName, 
            url: viewUrl,
            message: 'File uploaded to Nextcloud successfully'
        });
    } catch (error: any) {
        console.error('Nextcloud Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
}
