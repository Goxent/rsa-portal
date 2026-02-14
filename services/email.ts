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

    sendTaskAssignment: async (toEmail: string, userName: string, taskTitle: string, taskLink: string, clientName: string, dueDate: string, priority: string) => {
        const subject = `New Task Assigned: ${taskTitle}`;
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
                <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #172554 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">RSA System</h1>
                        <p style="color: #93c5fd; margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Task Assignment</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px;">
                        <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear <strong>${userName}</strong>,</p>
                        <p style="color: #475569; line-height: 1.6;">You have been assigned a new task. Please log in to the portal to review the full details.</p>
                        
                        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px; padding: 24px; margin: 24px 0;">
                            <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">${taskTitle}</h2>
                            
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px;">Client:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${clientName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Due Date:</td>
                                    <td style="padding: 8px 0; color: #0f172a; font-weight: 500;">${dueDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Priority:</td>
                                    <td style="padding: 8px 0;">
                                        <span style="background-color: ${priority === 'High' ? '#fee2e2' : '#dbeafe'}; color: ${priority === 'High' ? '#991b1b' : '#1e40af'}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${priority}</span>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <div style="text-align: center; margin-top: 32px;">
                            <a href="${taskLink}" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">View Task Details</a>
                        </div>
                        
                        <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                            <p style="color: #475569; font-size: 15px; margin: 0;">Best regards,</p>
                            <p style="color: #0f172a; font-weight: 700; font-size: 16px; margin: 4px 0 0 0;">R. Sapkota & Associates</p>
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
        await EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendEventInvitation: async (toEmail: string, userName: string, eventTitle: string, eventDate: string, eventLink: string) => {
        const subject = `Invitation: ${eventTitle}`;
        const html = `
            <!DOCTYPE html>
            <html>
            <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
                <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 32px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">RSA System</h1>
                        <p style="color: #ccfbf1; margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Calendar Invitation</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px;">
                        <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear <strong>${userName}</strong>,</p>
                        <p style="color: #475569; line-height: 1.6;">You are invited to an upcoming event. Please mark your calendar accordingly.</p>
                        
                        <div style="background-color: #f8fafc; border-left: 4px solid #0d9488; border-radius: 4px; padding: 24px; margin: 24px 0;">
                            <h2 style="margin: 0 0 8px 0; color: #0f172a; font-size: 20px;">${eventTitle}</h2>
                            <p style="margin: 0; color: #0d9488; font-weight: 600; font-size: 16px;">📅 ${eventDate}</p>
                        </div>

                        <div style="text-align: center; margin-top: 32px;">
                            <a href="${eventLink}" style="background-color: #0d9488; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2);">View Event Details</a>
                        </div>
                        
                       <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                            <p style="color: #475569; font-size: 15px; margin: 0;">Best regards,</p>
                            <p style="color: #0f172a; font-weight: 700; font-size: 16px; margin: 4px 0 0 0;">R. Sapkota & Associates</p>
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
        await EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendDueDateReminder: async (toEmail: string, userName: string, taskTitle: string, taskLink: string, clientName: string) => {
        const subject = `Reminder: Task Due Today - ${taskTitle}`;
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
                        <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear <strong>${userName}</strong>,</p>
                        <p style="color: #475569; line-height: 1.6;">This is a reminder that the following task is <strong>due today</strong>.</p>
                        
                        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 24px; margin: 24px 0;">
                            <h2 style="margin: 0 0 16px 0; color: #7f1d1d; font-size: 20px;">${taskTitle}</h2>
                            <p style="margin: 0; color: #991b1b; font-size: 14px;">Client: <strong>${clientName}</strong></p>
                        </div>

                        <div style="text-align: center; margin-top: 32px;">
                            <a href="${taskLink}" style="background-color: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">View Task</a>
                        </div>
                        
                       <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                            <p style="color: #475569; font-size: 15px; margin: 0;">Best regards,</p>
                            <p style="color: #0f172a; font-weight: 700; font-size: 16px; margin: 4px 0 0 0;">R. Sapkota & Associates</p>
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
        await EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    }
};
