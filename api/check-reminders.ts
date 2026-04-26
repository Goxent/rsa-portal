// ENV VARS USED — must be set in Vercel Dashboard > Settings > Environment Variables
// (Do NOT prefix with VITE_ — these are server-only)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { EmailService } from '../services/email';

// Re-use the client-side config or env vars for simplicity
// In a production serverless env, Admin SDK is preferred, but Client SDK works for simple queries.
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase (Singleton pattern)
if (!getApps().length) {
    initializeApp(firebaseConfig);
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Security Check (CRON_SECRET)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow manual testing if query param matches, or just require header
        // Vercel Cron sends header automatically
        // For security, strictly require it or a specific query param for testing
        if (req.query.secret !== process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        console.log("Checking for due tasks...");

        // 2. Calculate "Today" in YYYY-MM-DD (UTC or specific timezone? existing app uses YYYY-MM-DD strings)
        // Adjust for Nepal Time (UTC+5:45) if necessary, or just use server logic.
        // Assuming tasks are stored as "2024-02-14".
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        console.log(`Looking for tasks due on: ${todayStr}`);

        // 3. Query Tasks
        const q = query(
            collection(db, 'tasks'),
            where('dueDate', '==', todayStr),
            where('status', '!=', 'COMPLETED') // Don't remind if already done
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No tasks due today.");
            return res.status(200).json({ message: 'No tasks due today', count: 0 });
        }

        let emailCount = 0;
        const errors: any[] = [];

        // 4. Send Emails
        for (const taskDoc of snapshot.docs) {
            const task = taskDoc.data();
            const taskId = taskDoc.id;

            // Skip if no assignees
            if (!task.assignedTo || task.assignedTo.length === 0) continue;

            for (const uid of task.assignedTo) {
                try {
                    // Fetch User Details
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (!userDoc.exists()) continue;

                    const userData = userDoc.data();
                    if (!userData.email) continue;

                    // Determine Client Name
                    let clientName = task.clientName || 'Internal';

                    // Send Reminder
                    // Note: We need to import EmailService or inline the fetch call.
                    // Since EmailService uses `fetch('/api/send-email')` which is checking relative URL,
                    // it might fail in Node environment without full URL.
                    // Better to CALL the send-email function DIRECTLY or use the Resend SDK DIRECTLY here.
                    // To avoid circular dependency or URL issues, let's use Resend SDK directly here.

                    // ACTUALLY, reusing the `EmailService` from `../services/email` might be tricky 
                    // because it imports `fetch` relatively. 
                    // Let's copy the logic or direct fetch to absolute URL?
                    // Safest: Use Resend SDK directly in this file.

                    const nodemailer = await import('nodemailer');
                    const transporter = nodemailer.default.createTransport({
                        host: 'smtp.gmail.com',
                        port: 587,
                        secure: false,
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS,
                        },
                        connectionTimeout: 10000,
                    });

                    // Construct Email HTML
                    const subject = `Reminder: Task Due Today - ${task.title}`;
                    const html = `
                        <!DOCTYPE html>
                        <html>
                        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
                            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                                <!-- Header -->
                                <div style="background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); padding: 32px; text-align: center;">
                                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">RSA System</h1>
                                    <p style="color: #fecaca; margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Due Date Reminder</p>
                                </div>
                                
                                <!-- Content -->
                                <div style="padding: 40px;">
                                    <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear <strong>${userData.displayName || 'Team Member'}</strong>,</p>
                                    <p style="color: #475569; line-height: 1.6;">This is a reminder that the following task is <strong>due today</strong>.</p>
                                    
                                    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 24px; margin: 24px 0;">
                                        <h2 style="margin: 0 0 16px 0; color: #7f1d1d; font-size: 20px;">${task.title}</h2>
                                        <p style="margin: 0; color: #991b1b; font-size: 14px;">Client: <strong>${clientName}</strong></p>
                                    </div>

                                    <div style="text-align: center; margin-top: 32px;">
                                        <a href="https://${req.headers.host}/#/workflow" style="background-color: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">View Task</a>
                                    </div>
                                    
                                   <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                                        <p style="color: #475569; font-size: 15px; margin: 0;">Best regards,</p>
                                        <p style="color: #09090b; font-weight: 700; font-size: 16px; margin: 4px 0 0 0;">R. Sapkota & Associates</p>
                                    </div>
                                </div>
                                
                                <!-- Footer -->
                                <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                                     <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} RSA Attendance System. All rights reserved.</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `;

                    await transporter.sendMail({
                        from: `RSA System <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                        to: userData.email,
                        subject,
                        html
                    });

                    emailCount++;
                } catch (e) {
                    console.error(`Failed to send reminder to ${uid}:`, e);
                    errors.push({ uid, error: e.message });
                }
            }
        }

        return res.status(200).json({
            success: true,
            processed: snapshot.size,
            emailsSent: emailCount,
            errors
        });

    } catch (error) {
        console.error("Cron Job Error:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
