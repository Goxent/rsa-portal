export const EmailService = {
    /**
     * Send an email using Brevo API
     */
    sendEmail: async (toItem: { name: string; email: string } | string, subject: string, htmlContent: string) => {
        const apiKey = import.meta.env.VITE_BREVO_API_KEY;
        if (!apiKey) {
            console.warn("Brevo API Key missing. Email not sent.");
            return;
        }

        const to = typeof toItem === 'string' ? [{ email: toItem }] : [{ email: toItem.email, name: toItem.name }];

        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': apiKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: {
                        name: 'RSA System',
                        email: 'no-reply@rsa-system.com' // Should be a verified sender in Brevo
                    },
                    to,
                    subject,
                    htmlContent
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error("Brevo Email Error:", error);
                throw new Error("Failed to send email");
            }
        } catch (error) {
            console.error("Email Service Error:", error);
            // Don't block the app flow if email fails, just log it
        }
    },

    sendTaskAssignment: async (toEmail: string, userName: string, taskTitle: string, taskLink: string) => {
        const subject = `New Task Assigned: ${taskTitle}`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #2563eb;">New Task Assignment</h2>
                <p>Hello ${userName},</p>
                <p>You have been assigned a new task: <strong>${taskTitle}</strong>.</p>
                <div style="margin: 20px 0;">
                    <a href="${taskLink}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Task</a>
                </div>
                <p>Please log in to the system for more details.</p>
                <hr style="border: 1px solid #eee; margin-top: 30px;" />
                <p style="font-size: 12px; color: #666;">RSA System Notification</p>
            </div>
        `;
        await EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendEventInvitation: async (toEmail: string, userName: string, eventTitle: string, eventDate: string, eventLink: string) => {
        const subject = `Event Invitation: ${eventTitle}`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #7c3aed;">Event Invitation</h2>
                <p>Hello ${userName},</p>
                <p>You are invited to: <strong>${eventTitle}</strong></p>
                <p><strong>Date:</strong> ${eventDate}</p>
                <div style="margin: 20px 0;">
                    <a href="${eventLink}" style="background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Event</a>
                </div>
                <hr style="border: 1px solid #eee; margin-top: 30px;" />
                <p style="font-size: 12px; color: #666;">RSA System Notification</p>
            </div>
        `;
        await EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    }
};
