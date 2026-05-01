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
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ error: 'fileId (fileName) required' });

        const username = process.env.NEXTCLOUD_USERNAME;
        const password = process.env.NEXTCLOUD_APP_PASSWORD;
        const baseUrl = process.env.NEXTCLOUD_URL;

        if (!username || !password || !baseUrl) {
            return res.status(412).json({ error: 'Nextcloud credentials not configured' });
        }

        const deleteUrl = `${baseUrl}/remote.php/dav/files/${username}/${fileId}`;
        const auth = Buffer.from(`${username}:${password}`).toString('base64');

        const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${auth}`,
            }
        });

        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            throw new Error(`Nextcloud Delete Failed: ${response.status} ${errorText}`);
        }

        res.status(200).json({ success: true, message: 'File deleted from Nextcloud' });
    } catch (error: any) {
        console.error('Nextcloud Delete Error:', error);
        res.status(500).json({ error: error.message });
    }
}
