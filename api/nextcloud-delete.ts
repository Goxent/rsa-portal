import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function initFirebase() {
    if (getApps().length > 0) return;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'rsa-system1';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
        privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey } as any) });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    }
    try {
        initFirebase();
        const token = authHeader.split('Bearer ')[1].trim();
        await getAuth().verifyIdToken(token);
    } catch (authErr: any) {
        console.error('Auth error:', authErr.message);
        return res.status(401).json({ error: 'Invalid or expired session.', details: authErr.message });
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
                error: `Nextcloud Delete Failed: ${response.status}`,
                details: errorText.substring(0, 500),
            });
        }

        res.status(200).json({ success: true, message: 'File deleted from Nextcloud' });
    } catch (error: any) {
        console.error('Nextcloud Delete Error:', error);
        const errorMessage = error.cause ? `${error.message} (Cause: ${error.cause})` : error.message;
        res.status(500).json({ error: errorMessage, code: error.code || 'UNKNOWN_ERROR' });
    }
}
