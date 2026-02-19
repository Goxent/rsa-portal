import type { VercelRequest, VercelResponse } from '@vercel/node';
import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';

// Disable default body parser to handle FormData
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        // CORS
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
        );

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        // Check Env Vars
        const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

        // Debug Log (Masked)
        console.log("Drive API Invoked. Config check:", {
            email: clientEmail ? "Present" : "MISSING",
            folder: folderId ? "Present" : "MISSING",
            key: privateKey ? `Present (Length: ${privateKey.length})` : "MISSING"
        });

        if (!clientEmail || !privateKey || !folderId) {
            return res.status(500).json({
                error: 'Server configuration error: Missing Drive Credentials.',
                details: { hasEmail: !!clientEmail, hasKey: !!privateKey, hasFolder: !!folderId }
            });
        }

        // Fix Private Key - Vercel UI sometimes mangles newlines
        // If it starts with a quote, it might be double-escaped
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }
        // Replace literal \n with actual newlines
        const sanitizedKey = privateKey.replace(/\\n/g, '\n');

        // Parse Form Data
        const form = new IncomingForm({
            keepExtensions: true,
            maxFileSize: 20 * 1024 * 1024, // 20MB
        });

        const { fields, files }: any = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve({ fields, files });
            });
        });

        // formidable v3 returns files as arrays
        const file = Array.isArray(files.file) ? files.file[0] : files.file;

        if (!file) {
            return res.status(400).json({ error: 'No file found in request' });
        }

        console.log("File received:", {
            name: file.originalFilename,
            type: file.mimetype,
            size: file.size,
            path: file.filepath
        });

        // Authenticate
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: sanitizedKey,
            },
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Upload
        const response = await drive.files.create({
            requestBody: {
                name: file.originalFilename || 'uploaded_file',
                parents: [folderId],
            },
            media: {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.filepath),
            },
            fields: 'id, name, webViewLink, webContentLink',
        });

        // Share
        await drive.permissions.create({
            fileId: response.data.id!,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return res.status(200).json({
            success: true,
            file: {
                id: response.data.id,
                name: response.data.name,
                url: response.data.webViewLink,
                downloadUrl: response.data.webContentLink
            }
        });

    } catch (error: any) {
        console.error('CRITICAL Drive Error:', error);
        return res.status(500).json({
            error: 'Server Error during Drive Upload',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

