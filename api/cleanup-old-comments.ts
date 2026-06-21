// ENV VARS USED — must be set in Vercel Dashboard > Settings > Environment Variables
// (Do NOT prefix with VITE_ — these are server-only)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

const db = admin.firestore();

/**
 * Cleanup Old Comments — Vercel Cron Job
 * 
 * Removes task comments older than 90 days to reduce Firestore storage.
 * Runs daily via Vercel Cron.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Security: Require CRON_SECRET
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('Starting cleanup of old task comments (>90 days)...');

        const RETENTION_DAYS = 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
        const cutoffISO = cutoffDate.toISOString();

        console.log(`Cutoff date: ${cutoffISO}`);

        // Fetch all tasks
        const snapshot = await db.collection('tasks').get();

        let tasksProcessed = 0;
        let tasksUpdated = 0;
        let commentsRemoved = 0;

        for (const taskDoc of snapshot.docs) {
            const data = taskDoc.data();
            const comments: any[] = data.comments || [];

            // Skip tasks with no comments
            if (comments.length === 0) continue;

            tasksProcessed++;

            // Keep only comments within retention period
            const recentComments = comments.filter((c: any) => {
                if (!c.createdAt) return true; // Keep comments without a timestamp (safety)
                return c.createdAt > cutoffISO;
            });

            const removedCount = comments.length - recentComments.length;

            if (removedCount > 0) {
                await db.collection('tasks').doc(taskDoc.id).update({
                    comments: recentComments,
                });
                tasksUpdated++;
                commentsRemoved += removedCount;
                console.log(`Task ${taskDoc.id}: removed ${removedCount} old comment(s)`);
            }
        }

        console.log(`Cleanup complete. Tasks scanned: ${tasksProcessed}, updated: ${tasksUpdated}, comments removed: ${commentsRemoved}`);

        return res.status(200).json({
            success: true,
            retentionDays: RETENTION_DAYS,
            cutoffDate: cutoffISO,
            tasksScanned: tasksProcessed,
            tasksUpdated,
            commentsRemoved,
        });

    } catch (error: any) {
        console.error('Cleanup Cron Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
