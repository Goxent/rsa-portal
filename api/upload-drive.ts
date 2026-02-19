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
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // Handle newlines
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientEmail || !privateKey || !folderId) {
        console.error('Missing Google Drive Configuration');
        return res.status(500).json({ error: 'Server configuration error: Missing Drive Credentials.' });
    }

    try {
        // Parse Form Data using formidable
        const data: any = await new Promise((resolve, reject) => {
            const form = new IncomingForm();
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve({ fields, files });
            });
        });

        const file = data.files.file?.[0] || data.files.file; // data.files.file is likely an array in newer formidable

        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Authenticate with Google
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Upload to Drive
        const fileMetadata = {
            name: file.originalFilename || 'uploaded_file',
            parents: [folderId],
        };

        const media = {
            mimeType: file.mimetype,
            body: fs.createReadStream(file.filepath),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink, webContentLink',
        });

        // Make it Public (Reader) - Optional, but useful for templates
        // If we want creating user ONLY, we rely on the User being signed into Google.
        // But since this is a System Template, let's make it readable by anyone with the link
        // OR better yet, just return the ID.
        // For now, let's share it with "anyone with link" as 'reader' so staff can view it.
        await drive.permissions.create({
            fileId: response.data.id!,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // Cleanup temp file
        // fs.unlinkSync(file.filepath); // Vercel cleans up /tmp automatically, but good practice

        return res.status(200).json({
            success: true,
            file: {
                id: response.data.id,
                name: response.data.name,
                url: response.data.webViewLink, // Open in Drive Viewer
                downloadUrl: response.data.webContentLink // Direct Download
            }
        });

    } catch (error: any) {
        console.error('Drive Upload Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to upload to Drive' });
    }
}
