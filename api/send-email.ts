import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for development/production
    const allowedOrigin = process.env.VITE_APP_URL || process.env.FRONTEND_URL || '*'; // Fallback to '*' for local dev
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
    let parsedTo: string | string[] = '';
    if (typeof to === 'string') {
        parsedTo = to;
    } else if (Array.isArray(to)) {
        parsedTo = to.map(t => typeof t === 'object' && t.email ? t.email : t);
    } else if (typeof to === 'object' && to.email) {
        parsedTo = to.email;
    } else {
        return res.status(400).json({ error: 'Invalid "to" recipient format.' });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.VITE_EMAIL_FROM || 'onboarding@resend.dev';

    if (!resendApiKey) {
        const errorMsg = 'CRITICAL ERROR: RESEND_API_KEY is not set in environment variables.';
        console.error(`[Email Service] ${errorMsg}`);
        return res.status(500).json({ 
            error: 'Server configuration error: Missing Resend API Key.',
            tip: 'Check your environment variables for RESEND_API_KEY.'
        });
    }

    try {
        console.log(`Email Service: Attempting to send via Resend to ${JSON.stringify(parsedTo)}`);
        
        const resend = new Resend(resendApiKey);

        const { data, error } = await resend.emails.send({
            from: fromName ? `"${fromName}" <${emailFrom}>` : `RSA Portal <${emailFrom}>`,
            to: parsedTo,
            subject: subject,
            html: html,
        });

        if (error) {
            console.error('Resend SDK Error:', error);
            return res.status(400).json({ error: 'Resend failed to send email', details: error });
        }

        console.log('Email Service: Success!', data?.id);
        return res.status(200).json({ success: true, messageId: data?.id });

    } catch (error: any) {
        console.error('Email Service Error:', {
            message: error.message,
            stack: error.stack
        });
        return res.status(500).json({ 
            error: 'Failed to send email', 
            details: error.message
        });
    }
}

