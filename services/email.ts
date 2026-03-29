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

    /**
     * Internal helper to wrap content in the premium RSA branding.
     */
    getTemplateWrapper: (contentHtml: string, headerSubTitle: string, actionLabel?: string, actionLink?: string): string => {
        const actionButton = (actionLabel && actionLink) ? `
            <div style="text-align: center; margin-top: 48px; margin-bottom: 8px;">
                <a href="${actionLink}" style="background-color: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); letter-spacing: 0.3px;">${actionLabel}</a>
            </div>
        ` : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; -webkit-font-smoothing: antialiased;">
            <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);">
                <!-- Header -->
                <div style="background-color: #1e293b; padding: 48px 32px; text-align: center; background-image: linear-gradient(to bottom right, #1e293b, #0f172a);">
                    <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">RSA System</h1>
                    <div style="height: 2px; width: 40px; background-color: #3b82f6; margin: 16px auto;"></div>
                    <p style="color: #94a3b8; margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">${headerSubTitle}</p>
                </div>

                <!-- Content Body -->
                <div style="padding: 48px 40px; color: #334155;">
                    ${contentHtml}
                    ${actionButton}

                    <!-- Brand Sign-off -->
                    <div style="margin-top: 56px; padding-top: 32px; border-top: 1px solid #f1f5f9; text-align: left;">
                        <p style="color: #64748b; font-size: 14px; margin: 0;">Warm regards,</p>
                        <p style="color: #1e293b; font-weight: 800; font-size: 16px; margin: 8px 0 0 0; letter-spacing: -0.2px;">R. Sapkota & Associates</p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #f1f5f9;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">&copy; ${new Date().getFullYear()} R. Sapkota & Associates.<br/>All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    },

    sendTaskAssignment: async (toEmail: string, userName: string, taskTitle: string, taskLink: string, clientName: string, dueDate: string, priority: string, taskDescription?: string): Promise<boolean> => {
        const descSnippet = taskDescription ? ` - ${taskDescription.substring(0, 30)}${taskDescription.length > 30 ? '...' : ''}` : '';
        const subject = `New Task: ${taskTitle} | ${clientName}${descSnippet}`;

        let priorityColor = '#3b82f6';
        if (priority === 'HIGH' || priority === 'URGENT') priorityColor = '#ef4444';
        else if (priority === 'MEDIUM') priorityColor = '#f59e0b';

        const content = `
            <p style="font-size: 18px; margin-bottom: 24px;">Hello <strong>${userName}</strong>,</p>
            <p style="line-height: 1.6; font-size: 16px; color: #475569;">You have been assigned to a new engagement. Below are the key details for your review:</p>

            <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-top: 32px; border: 1px solid #f1f5f9; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                <h2 style="margin: 0 0 24px 0; color: #1e293b; font-size: 22px; font-weight: 800; line-height: 1.3;">${taskTitle}</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 0; color: #94a3b8; font-size: 14px; text-transform: uppercase; font-weight: 700; width: 110px;">Client</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 15px; font-weight: 600;">${clientName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #94a3b8; font-size: 14px; text-transform: uppercase; font-weight: 700;">Due Date</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 15px; font-weight: 600;">${dueDate}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; color: #94a3b8; font-size: 14px; text-transform: uppercase; font-weight: 700;">Priority</td>
                        <td style="padding: 10px 0; color: ${priorityColor}; font-size: 14px; font-weight: 800;">● ${priority}</td>
                    </tr>
                </table>
                ${taskDescription ? `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">${taskDescription}</p>
                </div>` : ''}
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, clientName, 'View Task Details', taskLink);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendEventInvitation: async (toEmail: string, userName: string, eventTitle: string, eventDate: string, eventLink: string) => {
        const subject = `Event Invitation: ${eventTitle}`;
        const content = `
            <p style="font-size: 18px; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
            <p style="line-height: 1.6; font-size: 16px; color: #475569;">You are invited to join an upcoming session. Please mark your calendar accordingly.</p>

            <div style="background-color: #f8fafc; border-radius: 12px; padding: 32px; margin-top: 32px; border: 1px solid #f1f5f9; text-align: center;">
                <div style="display: inline-block; background-color: #ffffff; padding: 12px 20px; border-radius: 8px; border: 1px solid #f1f5f9; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase;">Event Date</p>
                    <p style="margin: 4px 0 0 0; color: #1e293b; font-size: 18px; font-weight: 800;">${eventDate}</p>
                </div>
                <h2 style="margin: 0; color: #1e293b; font-size: 24px; font-weight: 800; line-height: 1.2;">${eventTitle}</h2>
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Calendar Invitation', 'Review Event Details', eventLink);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendDueDateReminder: async (toEmail: string, userName: string, taskTitle: string, taskLink: string, clientName: string) => {
        const subject = `Urgent Reminder: Task Due Today - ${taskTitle}`;
        const content = `
            <p style="font-size: 18px; margin-bottom: 24px;">Dear <strong>${userName}</strong>,</p>
            <p style="line-height: 1.6; font-size: 16px; color: #475569;">This is a priority reminder that your task is <strong>due today</strong>. Please ensure all required documentation is submitted.</p>

            <div style="background-color: #fef2f2; border-radius: 12px; padding: 32px; margin-top: 32px; border: 1px solid #fee2e2; border-left: 4px solid #ef4444;">
                <p style="margin: 0; color: #ef4444; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Deadline Today</p>
                <h2 style="margin: 12px 0 8px 0; color: #1e293b; font-size: 24px; font-weight: 800; line-height: 1.2;">${taskTitle}</h2>
                <p style="margin: 0; color: #64748b; font-size: 15px;">Client: <strong style="color: #475569;">${clientName}</strong></p>
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Due Date Reminder', 'Review Task Now', taskLink);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendCommentMention: async (toEmail: string, userName: string, authorName: string, taskTitle: string, clientName: string, commentText: string, taskLink: string) => {
        const subject = `New Mention: ${authorName} in ${taskTitle}`;
        const content = `
            <p style="font-size: 18px; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
            <p style="line-height: 1.6; font-size: 16px; color: #475569;"><strong>${authorName}</strong> mentioned you in a discussion regarding <strong>${taskTitle}</strong>.</p>

            <div style="margin-top: 32px; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; position: relative;">
                <p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.7; font-style: italic;">"${commentText}"</p>
            </div>

            <p style="margin-top: 24px; font-size: 14px; color: #94a3b8;">Task: <span style="color: #64748b; font-weight: 600;">${taskTitle}</span> | Client: <span style="color: #64748b; font-weight: 600;">${clientName}</span></p>
        `;

        const html = EmailService.getTemplateWrapper(content, 'New Mention', 'Reply to Comment', taskLink);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    },

    sendWorkflowStatusChange: async (toEmail: string, userName: string, taskTitle: string, oldStatus: string, newStatus: string, taskLink: string) => {
        const subject = `Workflow Update: ${taskTitle} Status Changed`;
        const content = `
            <p style="font-size: 18px; margin-bottom: 24px;">Hello <strong>${userName}</strong>,</p>
            <p style="line-height: 1.6; font-size: 16px; color: #475569;">The status of your engagement <strong>"${taskTitle}"</strong> has been updated.</p>

            <div style="margin-top: 32px; padding: 32px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
                    <div style="display: inline-block;">
                        <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase;">Previous</p>
                        <span style="background-color: #f1f5f9; color: #64748b; padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 700; border: 1px solid #e2e8f0;">${oldStatus.replace('_', ' ')}</span>
                    </div>
                    
                    <div style="display: inline-block; margin: 0 16px; color: #cbd5e1; font-size: 24px;">&rarr;</div>

                    <div style="display: inline-block;">
                        <p style="margin: 0 0 8px 0; color: #3b82f6; font-size: 11px; font-weight: 800; text-transform: uppercase;">Current</p>
                        <span style="background-color: #dbeafe; color: #1d4ed8; padding: 6px 16px; border-radius: 100px; font-size: 13px; font-weight: 700; border: 1px solid #bfdbfe;">${newStatus.replace('_', ' ')}</span>
                    </div>
                </div>
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Status Update', 'Review Task Progress', taskLink);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html);
    }
};
