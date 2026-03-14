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
        console.error('Email credentials missing. EMAIL_PASSWORD not set.');
        return res.status(500).json({ error: 'Server configuration error: Missing Email Credentials.' });
    }

    try {
        console.log(`Attempting to send email via Gmail to: ${to}`);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        const mailOptions = {
            from: `"${fromName || 'RSA System'}" <${emailUser}>`,
            to: parsedTo,
            subject: subject,
            html: html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);

        return res.status(200).json({ success: true, data: info });

    } catch (error: any) {
        console.error('Nodemailer Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to send email via Gmail' });
    }
}
