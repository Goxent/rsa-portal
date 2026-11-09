// ENV VARS USED — must be set in Vercel Dashboard > Settings > Environment Variables
// (Do NOT prefix with VITE_ — these are server-only)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (getApps().length === 0) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        } as any)
    });
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!process.env.CRON_SECRET) {
        console.error('CRON_SECRET environment variable is not configured.');
        return res.status(500).json({ error: 'Server misconfiguration: CRON_SECRET not set.' });
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('Starting cleanup of old audit logs (>90 days)...');

        // ICAN NSAS 230: audit documentation must be retained for 7 years minimum
        const RETENTION_DAYS = 2555;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
        const cutoffISO = cutoffDate.toISOString();

        const q = db.collection('auditLogs')
            .where('timestamp', '<', cutoffISO)
            .where('category', 'in', ['OPERATIONAL', 'SESSION'])
            .limit(1000);
        const snapshot = await q.get();

        let logsArchived = 0;

        for (const logDoc of snapshot.docs) {
            await db.collection('auditLogs').doc(logDoc.id).update({
                archived: true,
                archivedAt: FieldValue.serverTimestamp()
            });
            logsArchived++;
        }

        console.log(`Cleanup complete. Old audit logs archived: ${logsArchived}`);

        return res.status(200).json({
            success: true,
            retentionDays: RETENTION_DAYS,
            cutoffDate: cutoffISO,
            logsArchived,
        });

    } catch (error: any) {
        console.error('Cleanup Cron Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
