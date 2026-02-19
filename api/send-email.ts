import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Enable CORS for development/production
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
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

    const apiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    if (!apiKey) {
        console.error('RESEND_API_KEY is missing in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: Missing Email API Key.' });
    }

    const resend = new Resend(apiKey);

    try {
        console.log(`Attempting to send email to: ${to} with subject: ${subject}`);
        const { data, error } = await resend.emails.send({
            from: `${fromName || 'RSA System'} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            html: html,
        });

        if (error) {
            console.error('Resend API Error:', error);
            // Return the specific error message from Resend for better debugging
            return res.status(400).json({ error: error.message, details: error });
        }

        console.log('Email sent successfully:', data);
        return res.status(200).json({ success: true, data });
    } catch (error: any) {
        console.error('Unexpected Email Sending Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
