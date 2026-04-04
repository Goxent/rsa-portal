import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, query, where, limit } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!getApps().length) {
    initializeApp(firebaseConfig);
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (req.query.secret !== process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        console.log('Starting cleanup of old audit logs (>90 days)...');

        const RETENTION_DAYS = 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
        const cutoffISO = cutoffDate.toISOString();

        const q = query(
            collection(db, 'auditLogs'), 
            where('timestamp', '<', cutoffISO),
            limit(1000)
        );
        const snapshot = await getDocs(q);

        let logsDeleted = 0;

        for (const logDoc of snapshot.docs) {
            await deleteDoc(doc(db, 'auditLogs', logDoc.id));
            logsDeleted++;
        }

        console.log(`Cleanup complete. Old audit logs removed: ${logsDeleted}`);

        return res.status(200).json({
            success: true,
            retentionDays: RETENTION_DAYS,
            cutoffDate: cutoffISO,
            logsDeleted,
        });

    } catch (error: any) {
        console.error('Cleanup Cron Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
