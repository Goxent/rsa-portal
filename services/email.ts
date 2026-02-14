export const EmailService = {
    /**
     * Send an email using our Vercel Serverless Function (Resend)
     */
    sendEmail: async (toItem: { name: string; email: string } | string, subject: string, htmlContent: string) => {
        const to = typeof toItem === 'string' ? toItem : toItem.email;
        const name = typeof toItem === 'string' ? '' : toItem.name;

        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to,
                    subject,
                    html: htmlContent,
                    fromName: 'RSA System'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error("Resend Email Error:", error);
                throw new Error(error.error || "Failed to send email");
            }

            const data = await response.json();
            console.log("Email Sent Successfully:", data);
            return data;
        } catch (error) {
            console.error("Email Service Error:", error);
            // Don't block the app flow if email fails, just log it
        }
    },

    sendTaskAssignment: async (toEmail: string, userName: string, taskTitle: string, taskLink: string) => {
        const subject = `New Task: ${taskTitle}`;
        // Premium, Clean Email Template
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
                <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">RSA System</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Task Assignment Notification</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px;">
                        <p style="color: #374151; font-size: 16px; margin-top: 0;">Hello <strong>${userName}</strong>,</p>
                        <p style="color: #4b5563; line-height: 1.6;">You have been assigned a new task. Please review the details below and take necessary action.</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                            <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Task Title</p>
                            <p style="margin: 8px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 600;">${taskTitle}</p>
                        </div>

                        <div style="text-align: center; margin-top: 32px;">
                            <a href="${taskLink}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s;">View Task Details</a>
                        </div>
                        
                        <p style="color: #94a3b8; font-size: 14px; margin-top: 32px; text-align: center;">If the button above does not work, copy and paste this link into your browser:<br><span style="color: #2563eb;">${taskLink}</span></p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                         <p style="color: #64748b; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} RSA System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        await EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendEventInvitation: async (toEmail: string, userName: string, eventTitle: string, eventDate: string, eventLink: string) => {
        const subject = `Invitation: ${eventTitle}`;
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
                <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">RSA System</h1>
                        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Calendar Invitation</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px;">
                        <p style="color: #374151; font-size: 16px; margin-top: 0;">Hello <strong>${userName}</strong>,</p>
                        <p style="color: #4b5563; line-height: 1.6;">You are invited to an upcoming event. Please mark your calendar.</p>
                        
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
                            <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Event Details</p>
                            <h2 style="margin: 8px 0 4px 0; color: #0f172a; font-size: 20px; font-weight: 700;">${eventTitle}</h2>
                            <p style="margin: 4px 0 0 0; color: #7c3aed; font-weight: 600; font-size: 16px;">📅 ${eventDate}</p>
                        </div>

                        <div style="text-align: center; margin-top: 32px;">
                            <a href="${eventLink}" style="background-color: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s;">View Event</a>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                         <p style="color: #64748b; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} RSA System. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        await EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    }
};
