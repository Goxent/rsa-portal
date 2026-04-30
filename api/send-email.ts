// ENV VARS USED — must be set in Vercel Dashboard > Settings > Environment Variables
// (Do NOT prefix with VITE_ — these are server-only)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for development/production
    const allowedOrigin = process.env.APP_URL || process.env.FRONTEND_URL || '*'; 
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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

    const { to, subject, html, fromName } = req.body;

    if (!to || !subject || !html) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Parse 'to' field safely
    let parsedTo: string = '';
    if (typeof to === 'string') {
        parsedTo = to;
    } else if (Array.isArray(to)) {
        parsedTo = to.map(t => typeof t === 'object' && t.email ? t.email : t).join(', ');
    } else if (typeof to === 'object' && to.email) {
        parsedTo = to.email;
    } else {
        return res.status(400).json({ error: 'Invalid "to" recipient format.' });
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    // Support both EMAIL_FROM and MAIL_FROM per user's request
    const emailFrom = process.env.EMAIL_FROM || process.env.MAIL_FROM || emailUser;

    if (!emailUser || !emailPass) {
        const errorMsg = 'CRITICAL ERROR: EMAIL_USER or EMAIL_PASS/EMAIL_PASSWORD is not set in environment variables.';
        console.error(`[Email Service] ${errorMsg}`);
        return res.status(500).json({ 
            error: 'Server configuration error: Missing Gmail/SMTP credentials.',
            tip: 'Please set EMAIL_USER and EMAIL_PASSWORD in your environment variables (Vercel Dashboard).'
        });
    }

    try {
        console.log(`Email Service: Attempting to send via Gmail SMTP (smtp.gmail.com) to ${parsedTo}`);
        console.log(`Email Service: Using sender address: ${emailFrom}`);
        
        // Explicit configuration is often more stable in serverless environments than 'service: gmail'
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // Use STARTTLS
            auth: {
                user: emailUser,
                pass: emailPass,
            },
            // Increase timeout for serverless stability
            connectionTimeout: 15000, 
            greetingTimeout: 15000,
            socketTimeout: 15000,
            dnsTimeout: 10000,
            // Add internal logging if enabled
            logger: process.env.NODE_ENV === 'development',
            debug: process.env.NODE_ENV === 'development',
        });

        const mailOptions = {
            from: fromName ? `"${fromName}" <${emailFrom}>` : `RSA Portal <${emailFrom}>`,
            to: parsedTo,
            subject: subject,
            html: html,
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('Email Service: Success!', info.messageId);
        return res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error: any) {
        console.error('Email Service Error Detail:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
            message: error.message
        });

        // Provide a helpful tip for common Gmail errors
        let tip = 'Check your EMAIL_USER and EMAIL_PASSWORD.';
        let userMessage = error.message || 'Unknown SMTP error';

        if (error.message?.includes('Invalid login') || error.responseCode === 535) {
            tip = 'Gmail rejected your login. Ensure you are using a 16-character APP PASSWORD, not your regular Google password, and that 2FA is enabled.';
            userMessage = 'Gmail Authentication Failed (Check App Password)';
        } else if (error.code === 'ETIMEDOUT') {
            tip = 'Connection timed out. This might be a temporary network issue or Vercel outbound blocking.';
            userMessage = 'Connection Timeout (SMTP server unreachable)';
        } else if (error.code === 'EAUTH') {
            tip = 'Authentication failed. Please verify your credentials.';
        }

        return res.status(500).json({ 
            error: 'Failed to send email', 
            details: userMessage,
            code: error.code,
            tip: tip
        });
    }
}



