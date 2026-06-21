import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

export interface DecodedToken {
    uid: string;
    email?: string;
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

export const getAdminDb = () => admin.firestore();

export default async function verifyFirebaseToken(req: VercelRequest, res: VercelResponse): Promise<DecodedToken | null> {
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
