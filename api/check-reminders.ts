// ENV VARS USED — must be set in Vercel Dashboard > Settings > Environment Variables
// (Do NOT prefix with VITE_ — these are server-only)
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
    // 1. Security Check (CRON_SECRET)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
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

        console.log(`Looking for tasks due on or before: ${todayStr}`);

        // 3. Query Tasks - includes both due today AND overdue
        const snapshot = await db.collection('tasks')
            .where('dueDate', '<=', todayStr)
            .where('status', 'not-in', ['COMPLETED', 'ARCHIVED'])
            .get();

        if (snapshot.empty) {
            console.log("No tasks due or overdue.");
            return res.status(200).json({ message: 'No tasks due or overdue', count: 0 });
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
                    const userDoc = await db.collection('users').doc(uid).get();
                    if (!userDoc.exists) continue;

                    const userData = userDoc.data();
                    if (!userData || !userData.email) continue;

                    // Determine Client Name
                    let clientName = task.clientName || 'Internal';

                    // Send Reminder
                    // Note: We need to import EmailService or inline the fetch call.
                    // Since EmailService uses `fetch('/api/send-email')` which is checking relative URL,
                    // it might fail in Node environment without full URL.
                    // Better to CALL the send-email function DIRECTLY or use the Resend SDK DIRECTLY here.
                    // To avoid circular dependency or URL issues, let's use Resend SDK directly here.
                    const nodemailer = await import('nodemailer');
                    const transporter = nodemailer.default.createTransport({
                        host: 'smtp.gmail.com',
                        port: 587,
                        secure: false, // Use STARTTLS
                        auth: {
                            user: process.env.EMAIL_USER,
                            pass: process.env.EMAIL_PASS,
                        },
                        connectionTimeout: 15000,
                        greetingTimeout: 15000,
                        socketTimeout: 15000,
                        dnsTimeout: 10000,
                    });

                    // Determine due status label
                    const isOverdue = task.dueDate < todayStr;
                    const statusLabel = isOverdue ? 'OVERDUE' : 'DUE TODAY';
                    const headerColor = isOverdue ? '#7f1d1d' : '#b91c1c';
                    const headerGradient = isOverdue ? 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)' : 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
                    const badgeBg = isOverdue ? '#450a0a' : '#fef2f2';
                    const badgeBorder = isOverdue ? '#991b1b' : '#ef4444';
                    const badgeText = isOverdue ? '#fca5a5' : '#7f1d1d';
                    const daysOverdue = isOverdue
                        ? Math.ceil((new Date(todayStr).getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                        : 0;

                    // Construct Email HTML
                    const subject = isOverdue
                        ? `⚠️ OVERDUE (${daysOverdue}d): ${task.title}`
                        : `🔔 Reminder: Task Due Today - ${task.title}`;
                    const html = `
                        <!DOCTYPE html>
                        <html>
                        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
                            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                                <!-- Header -->
                                <div style="background: ${headerGradient}; padding: 32px; text-align: center;">
                                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">RSA System</h1>
                                    <p style="color: #fecaca; margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${statusLabel}</p>
                                </div>
                                
                                <!-- Content -->
                                <div style="padding: 40px;">
                                    <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear <strong>${userData.displayName || 'Team Member'}</strong>,</p>
                                    <p style="color: #475569; line-height: 1.6;">${isOverdue
                                        ? `This task is <strong style="color: #b91c1c;">OVERDUE by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}</strong> and requires immediate attention.`
                                        : `This is a reminder that the following task is <strong>due today</strong>.`
                                    }</p>
                                    
                                    <div style="background-color: ${badgeBg}; border-left: 4px solid ${badgeBorder}; border-radius: 4px; padding: 24px; margin: 24px 0;">
                                        <h2 style="margin: 0 0 16px 0; color: ${badgeText}; font-size: 20px;">${task.title}</h2>
                                        <p style="margin: 0 0 8px 0; color: ${badgeText}; font-size: 14px;">Client: <strong>${clientName}</strong></p>
                                        <p style="margin: 0; color: ${badgeText}; font-size: 14px;">Due: <strong>${task.dueDate}</strong></p>
                                        ${isOverdue ? `<p style="margin: 8px 0 0 0; color: #ef4444; font-size: 14px; font-weight: 700;">⚠️ ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue</p>` : ''}
                                    </div>

                                    <div style="text-align: center; margin-top: 32px;">
                                        <a href="https://${req.headers.host}/#/tasks" style="background-color: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">View Task Now</a>
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

                    const emailFrom = process.env.EMAIL_FROM || process.env.MAIL_FROM || process.env.EMAIL_USER;

                    await transporter.sendMail({
                        from: `RSA System <${emailFrom}>`,
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
