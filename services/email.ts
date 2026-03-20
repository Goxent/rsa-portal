export const EmailService = {
    /**
     * Send an email using our Vercel Serverless Function (Resend)
     */
    sendEmail: async (to: string | { email: string; name: string }, subject: string, html: string): Promise<boolean> => {
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, html }),
            });
            return response.ok;
        } catch (error) {
            console.error('Email send failed:', error);
            return false;
        }
    },

    sendTaskAssignment: async (toEmail: string, userName: string, taskTitle: string, taskLink: string, clientName: string, dueDate: string, priority: string): Promise<boolean> => {
        const subject = `New Task Assigned: ${taskTitle}`;

        let priorityBg = '#f3f4f6';
        let priorityColor = '#374151';

        if (priority === 'HIGH') {
            priorityBg = '#fee2e2';
            priorityColor = '#dc2626';
        } else if (priority === 'URGENT') {
            priorityBg = '#fef2f2';
            priorityColor = '#b91c1c';
        } else if (priority === 'MEDIUM') {
            priorityBg = '#dbeafe';
            priorityColor = '#1d4ed8';
        } else if (priority === 'LOW') {
            priorityBg = '#ecfdf5';
            priorityColor = '#059669';
        }

        const html = `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                <!-- Header -->
                <div style="background-color: #1e293b; padding: 40px 32px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 0.5px;">RSA System</h1>
                    <p style="color: #94a3b8; margin: 12px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Task Assignment</p>
                </div>

                <!-- Content -->
                <div style="padding: 48px 40px 32px 40px;">
                    <p style="color: #475569; font-size: 16px; margin-top: 0;">Dear <strong>${userName}</strong>,</p>
                    <p style="color: #475569; line-height: 1.6; font-size: 15px; margin-bottom: 32px;">You have been assigned a new task. Please log in to the portal to review the full details.</p>

                    <!-- Task Card -->
                    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 24px; margin-bottom: 40px;">
                        <h2 style="margin: 0 0 20px 0; color: #09090b; font-size: 20px; font-weight: 700;">${taskTitle}</h2>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 15px; width: 100px;">Client:</td>
                                <td style="padding: 8px 0; color: #09090b; font-size: 15px; font-weight: 600;">${clientName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 15px;">Due Date:</td>
                                <td style="padding: 8px 0; color: #09090b; font-size: 15px; font-weight: 600;">${dueDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 15px;">Priority:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background-color: ${priorityBg}; color: ${priorityColor}; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">${priority}</span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <!-- Action Button -->
                    <div style="text-align: center; margin-bottom: 40px;">
                        <a href="${taskLink}" style="background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.25); transition: background-color 0.2s;">View Task Details</a>
                    </div>

                    <!-- Sign-off -->
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 32px;">
                        <p style="color: #64748b; font-size: 15px; margin: 0;">Best regards,</p>
                        <p style="color: #09090b; font-weight: 700; font-size: 16px; margin: 8px 0 0 0;">R. Sapkota & Associates</p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} R. Sapkota & Associates. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
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
                        <h2 style="margin: 0 0 8px 0; color: #09090b; font-size: 20px;">${eventTitle}</h2>
                        <p style="margin: 0; color: #0d9488; font-weight: 600; font-size: 16px;">📅 ${eventDate}</p>
                    </div>

                    <div style="text-align: center; margin-top: 32px;">
                        <a href="${eventLink}" style="background-color: #0d9488; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2);">View Event Details</a>
                    </div>

                    <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                        <p style="color: #475569; font-size: 15px; margin: 0;">Best regards,</p>
                        <p style="color: #09090b; font-weight: 700; font-size: 16px; margin: 4px 0 0 0;">R.Sapkota & Associates</p>
                    </div>
                </div>

                <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} R.Sapkota & Associates. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
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
                        <p style="color: #09090b; font-weight: 700; font-size: 16px; margin: 4px 0 0 0;">R.Sapkota & Associates</p>
                    </div>
                </div>

                <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} R.Sapkota & Associates. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendCommentMention: async (toEmail: string, userName: string, authorName: string, taskTitle: string, clientName: string, commentText: string, taskLink: string) => {
        const subject = `Mentioned in Comment: ${taskTitle}`;
        const html = `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 32px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">RSA System</h1>
                    <p style="color: #ddd6fe; margin: 8px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">New Mention</p>
                </div>

                <!-- Content -->
                <div style="padding: 40px;">
                    <p style="color: #334155; font-size: 16px; margin-top: 0;">Dear <strong>${userName}</strong>,</p>
                    <p style="color: #475569; line-height: 1.6;"><strong>${authorName}</strong> mentioned you in <strong>${taskTitle}</strong> and <strong>${clientName}</strong> along with the message:</p>

                    <div style="background-color: #f5f3ff; border-left: 4px solid #8b5cf6; border-radius: 4px; padding: 24px; margin: 24px 0;">
                        <p style="margin: 0; color: #4c1d95; font-style: italic; font-size: 15px;">"${commentText}"</p>
                    </div>

                    <div style="text-align: center; margin-top: 32px;">
                        <a href="${taskLink}" style="background-color: #7c3aed; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(124, 58, 237, 0.2);">Reply to Comment</a>
                    </div>

                    <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 24px;">
                        <p style="color: #475569; font-size: 15px; margin: 0;">Best regards,</p>
                        <p style="color: #09090b; font-weight: 700; font-size: 16px; margin: 4px 0 0 0;">R. Sapkota & Associates</p>
                    </div>
                </div>

                <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} R. Sapkota & Associates. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendWorkflowStatusChange: async (toEmail: string, userName: string, taskTitle: string, oldStatus: string, newStatus: string, taskLink: string) => {
        const subject = `Task Status Update: ${taskTitle} is now ${newStatus.replace('_', ' ')}`;
        const html = `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                <!-- Header -->
                <div style="background-color: #1e293b; padding: 40px 32px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 0.5px;">RSA System</h1>
                    <p style="color: #94a3b8; margin: 12px 0 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Workflow Update</p>
                </div>

                <!-- Content -->
                <div style="padding: 48px 40px 32px 40px;">
                    <p style="color: #475569; font-size: 16px; margin-top: 0;">Dear <strong>${userName}</strong>,</p>
                    <p style="color: #475569; line-height: 1.6; font-size: 15px; margin-bottom: 32px;">The status of your task <strong>"${taskTitle}"</strong> has been updated.</p>

                    <!-- Status Change Card -->
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 40px; text-align: center; border: 1px solid #e2e8f0;">
                        <div style="display: inline-block; vertical-align: middle;">
                            <span style="display: block; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">From</span>
                            <span style="background-color: #f1f5f9; color: #475569; padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 700;">${oldStatus.replace('_', ' ')}</span>
                        </div>
                        <div style="display: inline-block; vertical-align: middle; margin: 0 24px;">
                            <span style="color: #94a3b8; font-size: 24px;">&rarr;</span>
                        </div>
                        <div style="display: inline-block; vertical-align: middle;">
                            <span style="display: block; color: #3b82f6; font-size: 12px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">To</span>
                            <span style="background-color: #dbeafe; color: #1d4ed8; padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 700;">${newStatus.replace('_', ' ')}</span>
                        </div>
                    </div>

                    <div style="text-align: center; margin-bottom: 40px;">
                        <a href="${taskLink}" style="background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.25);">Review Task Progress</a>
                    </div>

                    <div style="border-top: 1px solid #e2e8f0; padding-top: 32px;">
                        <p style="color: #64748b; font-size: 15px; margin: 0;">Best regards,</p>
                        <p style="color: #09090b; font-weight: 700; font-size: 16px; margin: 8px 0 0 0;">R. Sapkota & Associates</p>
                    </div>
                </div>

                <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} R. Sapkota & Associates. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    }
};
