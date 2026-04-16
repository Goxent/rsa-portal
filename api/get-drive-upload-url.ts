import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for local development testing
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
        const { fileName, mimeType } = req.body;
        if (!fileName) return res.status(400).json({ error: 'fileName required' });

        if (!process.env.GOOGLE_SERVICE_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            throw new Error('Google Drive credentials not configured on the server');
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_EMAIL,
                // Replace escaped literal \n string sequences back to real newlines
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive',
            ],
        });

        const token = await auth.getAccessToken();
        const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

        // Start Resumable Upload Session
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Upload-Content-Type': mimeType || 'application/octet-stream'
            },
            body: JSON.stringify({
                name: fileName,
                parents: FOLDER_ID ? [FOLDER_ID] : []
            })
        });

        // The exact upload URL is provided in the Location header
        const uploadUrl = response.headers.get('Location');
        if (!response.ok || !uploadUrl) {
            const err = await response.text();
            throw new Error(`Failed to get upload URL: ${err}`);
        }

        res.status(200).json({ uploadUrl });
    } catch (error: any) {
        console.error('Drive URL Error:', error);
        res.status(500).json({ error: error.message });
    }
}
