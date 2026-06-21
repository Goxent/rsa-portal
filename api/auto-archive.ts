// api/auto-archive.ts
// Vercel Serverless Cron Job — runs weekly to auto-archive tasks completed >30 days ago.
// ENV VARS USED: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, CRON_SECRET

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Initialize Firebase (Singleton pattern)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Security Check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log("Starting auto-archive job...");

        // 2. Calculate the cutoff date: 30 days ago
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const cutoffStr = cutoffDate.toISOString();

        console.log(`Archiving tasks completed before: ${cutoffStr}`);

        // 3. Query COMPLETED tasks that have been completed for >30 days
        const snapshot = await db.collection('tasks')
            .where('status', '==', 'COMPLETED')
            .where('completedAt', '<=', cutoffStr)
            .get();

        if (snapshot.empty) {
            console.log("No tasks eligible for auto-archiving.");
            return res.status(200).json({ message: 'No tasks to archive', count: 0 });
        }

        // 4. Batch archive in groups of 500 (Firestore batch limit)
        let archivedCount = 0;
        const batchSize = 500;
        const docs = snapshot.docs;

        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + batchSize);

            for (const taskDoc of chunk) {
                const task = taskDoc.data();

                batch.update(taskDoc.ref, {
                    status: 'ARCHIVED',
                    archivedAt: new Date().toISOString(),
                    archivedBy: 'system-auto-archive',
                    archivedFiscalYear: task.fiscalYear || null,
                    updatedAt: new Date().toISOString(),
                });

                // Write audit log entry
                const auditRef = db.collection('audit_logs').doc();
                batch.set(auditRef, {
                    action: 'TASK_AUTO_ARCHIVED',
                    actorId: 'system',
                    actorName: 'Automated System',
                    targetId: taskDoc.id,
                    targetName: task.title || 'Unknown Task',
                    timestamp: new Date().toISOString(),
                    details: {
                        reason: 'Task completed for more than 30 days',
                        completedAt: task.completedAt,
                    }
                });
            }

            await batch.commit();
            archivedCount += chunk.length;
            console.log(`Archived batch of ${chunk.length} tasks (total so far: ${archivedCount})`);
        }

        console.log(`Auto-archive complete. Total archived: ${archivedCount}`);
        return res.status(200).json({
            success: true,
            archivedCount,
            cutoffDate: cutoffStr,
        });

    } catch (error: any) {
        console.error("Auto-archive job error:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
