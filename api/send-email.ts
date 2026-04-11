import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for development/production
    const allowedOrigin = process.env.VITE_APP_URL || process.env.FRONTEND_URL || 'https://rsa-portal.web.app'; // Must be restricted in production
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

    // Parse 'to' field safely to support string, array of strings, or { email, name } objects
    let parsedTo = '';
    if (typeof to === 'string') {
        parsedTo = to;
    } else if (Array.isArray(to)) {
        parsedTo = to.map(t => typeof t === 'object' && t.email ? t.email : t).join(',');
    } else if (typeof to === 'object' && to.email) {
        parsedTo = `${to.name ? `"${to.name}" ` : ''}<${to.email}>`;
    } else {
        return res.status(400).json({ error: 'Invalid "to" recipient format.' });
    }

    // Gmail SMTP Configuration
    const emailUser = process.env.EMAIL_USER || 'anil99sunar@gmail.com';
    const emailPass = process.env.EMAIL_PASSWORD;

    if (!emailPass) {
        const errorMsg = 'CRITICAL ERROR: EMAIL_PASSWORD is not set in environment variables. Gmail SMTP cannot connect without an App Password.';
        console.error(`[Email Service] ${errorMsg}`);
        return res.status(500).json({ 
            error: 'Server configuration error: Missing Email Credentials.',
            tip: 'If running locally, ensure EMAIL_PASSWORD is in your .env.local file. If on Vercel, check Project Settings -> Environment Variables.'
        });
    }

    try {
        console.log(`Email Service: Attempting to send via Gmail to ${parsedTo}`);
        
        // Use more explicit host/port settings which can be more stable in serverless
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // Use SSL
            auth: {
                user: emailUser,
                pass: emailPass,
            },
            // Debugging
            debug: true,
            logger: true
        });

        // Verify connection before sending
        try {
            await transporter.verify();
            console.log('Email Service: Connection verified successfully');
        } catch (verifyError: any) {
            console.error('Email Service: SMTP Verification Failed:', verifyError);
            // We continue anyway, but the log will be helpful
        }

        const mailOptions = {
            from: `"${fromName || 'RSA Portal'}" <${emailUser}>`,
            to: parsedTo,
            subject: subject,
            html: html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email Service: Success!', info.messageId);

        return res.status(200).json({ success: true, messageId: info.messageId });

    } catch (error: any) {
        console.error('Email Service Error:', {
            message: error.message,
            code: error.code,
            command: error.command
        });
        return res.status(500).json({ 
            error: 'Failed to send email', 
            details: error.message,
            code: error.code 
        });
    }
}
