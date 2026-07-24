import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

export interface DecodedToken {
    uid: string;
    email?: string;
}

let adminInitError: Error | null = null;
try {
    if (!admin.apps.length) {
        const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'rsa-system1';
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;
        
        if (privateKey) {
            // Remove extra quotes and fix newlines
            privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey
            })
        });
    }
} catch (error: any) {
    console.error('Firebase init error:', error);
    adminInitError = error;
}

export const getAdminDb = () => admin.firestore();

export default async function verifyFirebaseToken(req: VercelRequest, res: VercelResponse): Promise<DecodedToken | null> {
    if (adminInitError) {
        res.status(500).json({ error: 'Firebase Admin SDK initialization failed.', details: adminInitError.message });
        return null;
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or malformed Authorization header.' });
        return null;
    }

    const token = authHeader.split('Bearer ')[1].trim();

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return {
            uid: decodedToken.uid,
            email: decodedToken.email
        };
    } catch (error) {
        console.error('Firebase token verification error:', error);
        res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
        return null;
    }
}
