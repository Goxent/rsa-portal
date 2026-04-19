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
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ error: 'fileId required' });

        if (!process.env.GOOGLE_SERVICE_EMAIL || !process.env.GOOGLE_SERVICE_EMAIL.includes('@')) {
            return res.status(412).json({ 
                error: 'Google Drive credentials not configured on the server',
                code: 'MISSING_DRIVE_CREDENTIALS',
                details: 'GOOGLE_SERVICE_EMAIL is missing or invalid'
            });
        }

        if (!process.env.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY.length < 100) {
            return res.status(412).json({ 
                error: 'Google Drive credentials not configured on the server',
                code: 'MISSING_DRIVE_CREDENTIALS',
                details: 'GOOGLE_PRIVATE_KEY is missing or invalid'
            });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive',
            ],
        });

        const drive = google.drive({ version: 'v3', auth });

        await drive.files.delete({
            fileId: fileId
        });

        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Drive Delete Error:', error);
        res.status(500).json({ error: error.message });
    }
}
