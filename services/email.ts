export const EmailService = {
    /**
     * Send an email using our Vercel Serverless Function (Gmail/SMTP via Nodemailer)
     */
     sendEmail: async (to: string | { email: string; name: string }, subject: string, html: string, fromName?: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        try {
            // Support absolute API URL if provided (important for GitHub Pages + Vercel API setup)
            const apiBase = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiBase}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, subject, html, fromName }),
            });

            if (!response.ok) {
                let detail = '';
                let tip = '';
                try {
                    const errorJson = await response.json();
                    detail = errorJson.details || errorJson.error || JSON.stringify(errorJson);
                    tip = errorJson.tip;
                    // If there's a tip in the response, log it
                    if (tip) console.warn('Email Tip:', tip);
                } catch {
                    detail = await response.text();
                }
                console.error(`Email send failed | Status: ${response.status} (${response.statusText}) | Detail: ${detail}`);
                return { success: false, error: detail, tip };
            }

            return { success: true };
        } catch (error: any) {
            console.error('Email send failed | Network or Exception Error:', error);
            return { success: false, error: error.message || 'Network error occurred' };
        }
    },

    /**
     * Internal helper to wrap content in the premium RSA branding.
     */
    getTemplateWrapper: (
        contentHtml: string,
        typePill: string,
        actionLabel?: string,
        actionLink?: string,
        buttonStyle?: 'green' | 'danger' | 'info'
    ): string => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const btnStart = buttonStyle === 'danger' ? '#c4445a' : buttonStyle === 'info' ? '#3d82c9' : '#659a2b';
        const btnEnd = buttonStyle === 'danger' ? '#8a2e3e' : buttonStyle === 'info' ? '#1e60a8' : '#3f6018';

        const actionButton = (actionLabel && actionLink) ? `
            <div style="text-align:center; margin:28px 0 8px;">
                <a href="${actionLink}" style="display:inline-block; background:linear-gradient(135deg,${btnStart},${btnEnd}); color:#ffffff; text-decoration:none; padding:13px 32px; border-radius:10px; font-size:14px; font-weight:700; border: none; outline: none; letter-spacing:0.3px; font-family:${fontStack};">${actionLabel}</a>
            </div>
        ` : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f0f2ec; -webkit-font-smoothing: antialiased;">
            <div style="max-width: 600px; margin: 32px auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04); border: 1px solid #edf0e8;">
                <!-- Header Block -->
                <div style="background: linear-gradient(to bottom right, #1c2216, #111a0b); padding: 36px 32px 30px; text-align: center;">
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px; border-collapse: collapse;">
                        <tr>
                            <td align="center" valign="middle" style="width:64px; height:44px; background:linear-gradient(135deg,#659a2b,#3f6018); border-radius:10px; color:#ffffff; font-size:18px; font-weight:800; font-family:${fontStack}; letter-spacing: 0.05em;">
                                RSA
                            </td>
                        </tr>
                    </table>
                    <p style="color:#ffffff; font-size:19px; font-weight:700; letter-spacing:-0.3px; margin:0 0 10px; font-family:${fontStack};">R. Sapkota &amp; Associates</p>
                    <span style="display:inline-block; background:rgba(101,154,43,0.22); color:#b8d98a; border:1px solid rgba(101,154,43,0.38); border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:4px 14px; font-family:${fontStack};">${typePill}</span>
                </div>

                <!-- Content Block -->
                <div style="padding:36px 40px; color:#475569; font-family:${fontStack};">
                    ${contentHtml}
                    ${actionButton}

                    <!-- Sign-off Block -->
                    <div style="margin-top:32px; padding-top:22px; border-top:1px solid #f1f5f9;">
                        <p style="color:#94a3b8; font-size:13px; margin:0 0 4px; font-family:${fontStack};">Warm regards,</p>
                        <p style="color:#1e293b; font-size:15px; font-weight:800; margin:0; letter-spacing:-0.2px; font-family:${fontStack};">R. Sapkota &amp; Associates</p>
                    </div>
                </div>

                <!-- Footer Block -->
                <div style="background:#f8faf5; border-top:1px solid #edf0e8; padding:18px 32px; text-align:center;">
                    <p style="color:#94a3b8; font-size:11px; margin:0; line-height:1.6; font-family:${fontStack};">
                        &copy; ${new Date().getFullYear()} R. Sapkota &amp; Associates. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    },

    sendTaskAssignment: async (toEmail: string, userName: string, taskTitle: string, taskLink: string, clientName: string, dueDate: string, priority: string, taskDescription?: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `New Task Assigned: ${taskTitle} — ${clientName}`;

        let priorityPillStyle = 'background:rgba(101,154,43,0.10); color:#527a22; border:1px solid rgba(101,154,43,0.22);';
        if (priority === 'HIGH' || priority === 'URGENT') {
            priorityPillStyle = 'background:rgba(196,68,90,0.10); color:#ad3049; border:1px solid rgba(196,68,90,0.22);';
        } else if (priority === 'MEDIUM') {
            priorityPillStyle = 'background:rgba(201,138,42,0.10); color:#8a5c10; border:1px solid rgba(201,138,42,0.22);';
        }

        const commonPill = 'display:inline-block; border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; padding:3px 10px;';

        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Dear <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                You have been assigned to a new engagement. Below are the details for your review.
            </p>

            <!-- Task card -->
            <div style="border:1px solid #e8f0de; background:#f5f9ee; border-radius:10px; overflow:hidden; margin-bottom:28px;">
                <!-- Card header -->
                <div style="padding:16px 20px 12px; border-bottom:1px solid #dce9cc;">
                    <p style="font-size:17px; font-weight:700; color:#1e293b; margin:0 0 6px; font-family:${fontStack};">${taskTitle}</p>
                    <span style="display:inline-block; background:rgba(101,154,43,0.15); color:#527a22; border:1px solid rgba(101,154,43,0.25); border-radius:99px; font-size:10px; font-weight:700; padding:2px 10px; font-family:${fontStack};">${clientName}</span>
                </div>

                <!-- Card rows -->
                <div style="padding:14px 20px;">
                    <table style="width:100%; border-collapse:collapse; font-family:${fontStack};">
                        <tr>
                            <td style="padding:7px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#94a3b8; width:90px;">Due date</td>
                            <td style="padding:7px 0; font-size:14px; font-weight:600; color:#1e293b;">${dueDate}</td>
                        </tr>
                        <tr>
                            <td style="padding:7px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#94a3b8;">Priority</td>
                            <td style="padding:7px 0;"><span style="${commonPill} ${priorityPillStyle}">${priority}</span></td>
                        </tr>
                    </table>

                    ${taskDescription ? `
                    <div style="margin-top:14px; padding-top:14px; border-top:1px solid #dce9cc;">
                        <p style="margin:0; font-size:13px; color:#64748b; line-height:1.65; font-family:${fontStack};">${taskDescription}</p>
                    </div>` : ''}
                </div>
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Task Assignment', 'View Task Details', taskLink, 'green');
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Portal');
    },

    sendEventInvitation: async (toEmail: string, userName: string, eventTitle: string, eventDate: string, eventLink: string, eventType?: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const isHoliday = eventType === 'HOLIDAY';
        const subject = isHoliday ? `Holiday Notice: ${eventTitle}` : `You're Invited: ${eventTitle} on ${eventDate}`;

        // Robust Date Parsing for the Calendar Icon
        // eventDate might be "YYYY-MM-DD at HH:mm" or "MM/DD/YYYY at HH:mm"
        const dateOnly = eventDate.split(' at ')[0].trim();
        let d = new Date(dateOnly);
        
        // If standard parsing fails, try adding T00:00:00 or fixing common formats
        if (isNaN(d.getTime())) {
            // Try YYYY-MM-DD format
            d = new Date(dateOnly + 'T00:00:00');
        }
        
        // If still invalid and in MM/DD/YYYY format, try to rearrange
        if (isNaN(d.getTime()) && dateOnly.includes('/')) {
            const [m, day, y] = dateOnly.split('/');
            if (m && day && y) {
                d = new Date(`${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
            }
        }
        
        const isValid = !isNaN(d.getTime());
        const month = isValid ? d.toLocaleString('en-US', { month: 'short' }).toUpperCase() : 'DATE';
        const day = isValid ? d.getDate().toString() : '!!';
        const year = isValid ? d.getFullYear().toString() : '';

        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Hi <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                ${isHoliday 
                    ? `Please take note of the upcoming holiday: <strong>${eventTitle}</strong>. Our office will remain closed on this day.` 
                    : `You are invited to an upcoming session. Please mark your calendar accordingly.`}
            </p>

            <!-- Event card — table based for compatibility -->
            <table style="width:100%; border-collapse:collapse; background:#f5f9ee; border:1px solid #e8f0de; border-radius:10px; margin-bottom:28px; font-family:${fontStack};">
                <tr>
                    <td style="padding:22px 24px;">
                        <table style="width:100%; border-collapse:collapse;">
                            <tr>
                                <td style="width:76px; vertical-align:top; padding-right:20px;">
                                    <div style="background:#ffffff; border:1px solid #e8f0de; border-radius:8px; padding:12px 16px; text-align:center; min-width:76px;">
                                        <p style="margin:0; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#659a2b; font-family:${fontStack};">${month}</p>
                                        <p style="margin:2px 0; font-size:28px; font-weight:800; color:#1e293b; line-height:1.1; font-family:${fontStack};">${day}</p>
                                        <p style="margin:0; font-size:11px; color:#94a3b8; font-family:${fontStack};">${year}</p>
                                    </div>
                                </td>
                                <td style="vertical-align:middle;">
                                    <p style="font-size:17px; font-weight:700; color:#1e293b; margin:0 0 5px; font-family:${fontStack};">${eventTitle}</p>
                                    <p style="font-size:13px; color:#64748b; margin:0; font-family:${fontStack};">All team members</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Calendar Invitation', 'Add to Calendar', eventLink, 'info');
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Portal');
    },

    sendDueDateReminder: async (toEmail: string, userName: string, taskTitle: string, taskLink: string, clientName: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `Urgent — Task Due Today: ${taskTitle}`;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f0f2ec; -webkit-font-smoothing: antialiased;">
            <div style="max-width: 600px; margin: 32px auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04); border: 1px solid #edf0e8;">
                <!-- Red Alert Header -->
                <div style="background: linear-gradient(to bottom right, #1e1414, #120a0a); padding: 36px 32px 30px; text-align: center;">
                    <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px; border-collapse: collapse;">
                        <tr>
                            <td align="center" valign="middle" style="width:64px; height:44px; background:linear-gradient(135deg,#c4445a,#8a2e3e); border-radius:10px; color:#ffffff; font-size:18px; font-weight:800; font-family:${fontStack}; letter-spacing: 0.05em;">
                                RSA
                            </td>
                        </tr>
                    </table>
                    <p style="color:#ffffff; font-size:19px; font-weight:700; letter-spacing:-0.3px; margin:0 0 10px; font-family:${fontStack};">R. Sapkota &amp; Associates</p>
                    <span style="display:inline-block; background:rgba(196,68,90,0.20); color:#e89aa8; border:1px solid rgba(196,68,90,0.35); border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; padding:4px 14px; font-family:${fontStack};">Due Date Reminder</span>
                </div>

                <!-- Content Block -->
                <div style="padding:36px 40px; color:#475569; font-family:${fontStack};">
                    <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">Dear <strong>${userName}</strong>,</p>
                    <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">This is a priority reminder — your task is <strong style="color:#c4445a;">due today</strong>. Please ensure all required documentation is submitted promptly.</p>

                    <!-- Due date card -->
                    <div style="background:#fff8f8; border:1px solid #ffd5d5; border-left:4px solid #c4445a; border-radius:0 10px 10px 0; padding:18px 20px; margin-bottom:28px;">
                        <span style="display:inline-block; background:rgba(196,68,90,0.10); color:#ad3049; border-radius:99px; font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; padding:3px 10px; margin-bottom:10px; font-family:${fontStack};">Deadline today</span>
                        <p style="font-size:17px; font-weight:700; color:#1e293b; margin:0 0 4px; font-family:${fontStack};">${taskTitle}</p>
                        <p style="font-size:13px; color:#64748b; margin:0; font-family:${fontStack};">Client: <strong>${clientName}</strong></p>
                    </div>

                    <!-- Action Button -->
                    <div style="text-align:center; margin:28px 0 8px;">
                        <a href="${taskLink}" style="display:inline-block; background:linear-gradient(135deg,#c4445a,#8a2e3e); color:#ffffff; text-decoration:none; padding:13px 32px; border-radius:10px; font-size:14px; font-weight:700; letter-spacing:0.3px; font-family:${fontStack};">Review Task Now</a>
                    </div>

                    <!-- Sign-off Block -->
                    <div style="margin-top:32px; padding-top:22px; border-top:1px solid #f1f5f9;">
                        <p style="color:#94a3b8; font-size:13px; margin:0 0 4px; font-family:${fontStack};">Warm regards,</p>
                        <p style="color:#1e293b; font-size:15px; font-weight:800; margin:0; letter-spacing:-0.2px; font-family:${fontStack};">R. Sapkota &amp; Associates</p>
                    </div>
                </div>

                <!-- Footer Block -->
                <div style="background:#f8faf5; border-top:1px solid #edf0e8; padding:18px 32px; text-align:center;">
                    <p style="color:#94a3b8; font-size:11px; margin:0; line-height:1.6; font-family:${fontStack};">
                        &copy; ${new Date().getFullYear()} R. Sapkota &amp; Associates. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;

        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Portal');
    },

    sendCommentMention: async (toEmail: string, userName: string, authorName: string, taskTitle: string, clientName: string, commentText: string, taskLink: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `${authorName} mentioned you in ${taskTitle}`;
        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Hi <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                <strong style="color:#1e293b;">${authorName}</strong> mentioned you in a discussion on
                <strong style="color:#1e293b;">${taskTitle}</strong>.
            </p>

            <!-- Quote block with green left accent -->
            <div style="position:relative; background:#f5f9ee; border:1px solid #e8f0de; border-left:3px solid #659a2b; border-radius:0 10px 10px 0; padding:18px 20px 18px 22px; margin-bottom:28px;">
                <p style="font-size:12px; font-weight:700; color:#659a2b; margin:0 0 8px; font-family:${fontStack};">${authorName}</p>
                <p style="font-size:14px; color:#475569; line-height:1.65; font-style:italic; margin:0 0 12px; font-family:${fontStack};">"${commentText}"</p>
                <p style="font-size:12px; color:#94a3b8; margin:0; font-family:${fontStack};">${taskTitle} &middot; ${clientName}</p>
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, 'DISCUSSION MENTION', 'View Discussion', taskLink, 'green');
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Portal');
    },

    sendWorkflowStatusChange: async (toEmail: string, userName: string, taskTitle: string, oldStatus: string, newStatus: string, taskLink: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `Workflow Update: ${taskTitle} — ${oldStatus.replace(/_/g, ' ')} → ${newStatus.replace(/_/g, ' ')}`;
        
        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Hello <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                The status of <strong style="color:#1e293b;">${taskTitle}</strong> has been updated by your reviewer.
            </p>

            <!-- Status flow card -->
            <table style="width:100%; border-collapse:collapse; background:#f8faf5; border:1px solid #e8f0de; border-radius:10px; margin-bottom:28px; font-family:${fontStack};">
                <tr>
                    <td style="padding:24px; text-align:center;">
                        <table style="margin:0 auto; border-collapse:collapse;">
                            <tr>
                                <!-- Old status -->
                                <td style="padding:0 8px; text-align:center; vertical-align:top;">
                                    <p style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin:0 0 8px; font-family:${fontStack};">Previous</p>
                                    <span style="display:inline-block; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; border-radius:99px; font-size:12px; font-weight:700; padding:6px 16px; font-family:${fontStack};">${oldStatus.replace(/_/g, ' ')}</span>
                                </td>
                                <!-- Arrow -->
                                <td style="padding:0 12px; vertical-align:middle; padding-top:24px;">
                                    <span style="color:#c8d5be; font-size:18px;">&rarr;</span>
                                </td>
                                <!-- New status -->
                                <td style="padding:0 8px; text-align:center; vertical-align:top;">
                                    <p style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#659a2b; margin:0 0 8px; font-family:${fontStack};">Current</p>
                                    <span style="display:inline-block; background:rgba(101,154,43,0.15); color:#527a22; border:1px solid rgba(101,154,43,0.30); border-radius:99px; font-size:12px; font-weight:700; padding:6px 16px; font-family:${fontStack};">${newStatus.replace(/_/g, ' ')}</span>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Workflow Update', 'View Task Progress', taskLink, 'green');
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Portal');
    },

    sendLeaveStatusChange: async (toEmail: string, userName: string, leaveType: string, start: string, end: string, status: string, reason?: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `Leave ${status === 'APPROVED' ? 'Approved' : 'Rejected'}: ${leaveType} (${start} to ${end})`;
        
        const isApproved = status === 'APPROVED';
        const cardBg      = isApproved ? '#f0f7e6' : '#fff8f8';
        const cardBorder  = isApproved ? '#c8e09a' : '#ffd5d5';
        const statusColor = isApproved ? '#3f6018' : '#8a2e3e';
        const statusLabel = isApproved ? 'Leave Approved' : 'Leave Rejected';
        const icon        = isApproved ? '✓' : '✕';
        const iconColor   = isApproved ? '#527a22' : '#c4445a';
        const noteBorder  = isApproved ? 'rgba(101,154,43,0.20)' : 'rgba(196,68,90,0.20)';
        const btnStyle    = isApproved ? 'green' : 'danger';

        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Hello <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                Your request for <strong style="color:#1e293b;">${leaveType}</strong> from
                <strong style="color:#1e293b;">${start}</strong> to
                <strong style="color:#1e293b;">${end}</strong> has been reviewed.
            </p>

            <!-- Decision card -->
            <div style="background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:24px; margin-bottom:28px; text-align:center;">
                <p style="font-size:32px; font-weight:800; color:${iconColor}; margin:0 0 10px; line-height:1; font-family:${fontStack};">${icon}</p>
                <p style="font-size:20px; font-weight:800; color:${statusColor}; margin:0 0 6px; font-family:${fontStack};">${statusLabel}</p>
                <p style="font-size:13px; color:#64748b; margin:0; font-family:${fontStack};">${leaveType} &middot; ${start} to ${end}</p>

                ${reason ? `
                <div style="background:rgba(255,255,255,0.7); border:1px solid ${noteBorder}; border-radius:8px; padding:12px 16px; margin-top:18px; text-align:left;">
                    <p style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin:0 0 5px; font-family:${fontStack};">Note from admin</p>
                    <p style="font-size:13px; color:#475569; font-style:italic; margin:0; line-height:1.6; font-family:${fontStack};">"${reason}"</p>
                </div>` : ''}
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Leave Decision', 'View My Leaves', `${window.location.origin}/#/leaves`, btnStyle as any);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Portal');
    },

    sendAttendanceStatusChange: async (toEmail: string, userName: string, date: string, status: string, reason?: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `Attendance Log ${status}: ${date}`;
        
        const isApproved = status === 'APPROVED';
        const cardBg      = isApproved ? '#f0f7e6' : '#fff8f8';
        const cardBorder  = isApproved ? '#c8e09a' : '#ffd5d5';
        const statusColor = isApproved ? '#3f6018' : '#8a2e3e';
        const statusLabel = isApproved ? 'Log Approved' : 'Log Rejected';
        const icon        = isApproved ? '✓' : '✕';
        const iconColor   = isApproved ? '#527a22' : '#c4445a';
        const noteBorder  = isApproved ? 'rgba(101,154,43,0.20)' : 'rgba(196,68,90,0.20)';
        const btnStyle    = isApproved ? 'green' : 'danger';

        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Hello <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                Your manual attendance log request for <strong style="color:#1e293b;">${date}</strong> has been reviewed.
            </p>

            <!-- Decision card -->
            <div style="background:${cardBg}; border:1px solid ${cardBorder}; border-radius:10px; padding:24px; margin-bottom:28px; text-align:center;">
                <p style="font-size:32px; font-weight:800; color:${iconColor}; margin:0 0 10px; line-height:1; font-family:${fontStack};">${icon}</p>
                <p style="font-size:20px; font-weight:800; color:${statusColor}; margin:0 0 6px; font-family:${fontStack};">${statusLabel}</p>
                <p style="font-size:13px; color:#64748b; margin:0; font-family:${fontStack};">Manual Log &middot; ${date}</p>

                ${reason ? `
                <div style="background:rgba(255,255,255,0.7); border:1px solid ${noteBorder}; border-radius:8px; padding:12px 16px; margin-top:18px; text-align:left;">
                    <p style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin:0 0 5px; font-family:${fontStack};">Note from admin</p>
                    <p style="font-size:13px; color:#475569; font-style:italic; margin:0; line-height:1.6; font-family:${fontStack};">"${reason}"</p>
                </div>` : ''}
            </div>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Attendance Update', 'View Attendance', `${window.location.origin}/#/attendance`, btnStyle as any);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Portal');
    },

    sendStaffInvitation: async (toEmail: string, userName: string, inviterName: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `${inviterName} invited you to join RSA Portal`;
        const signupLink = `${window.location.origin}/#/signup?email=${encodeURIComponent(toEmail)}`;
        
        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Hello <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                <strong style="color:#1e293b;">${inviterName}</strong> from <strong style="color:#1e293b;">R. Sapkota &amp; Associates</strong> has invited you to join the official RSA digital workspace.
            </p>

            <div style="background:linear-gradient(135deg,#f5f9ee,#eef5e0); border:1px solid #d8ebb5; border-radius:10px; padding:22px 24px; margin-bottom:28px;">
                <p style="font-size:12px; font-weight:700; color:#3f6018; margin:0 0 14px; text-transform:uppercase; letter-spacing:0.07em; font-family:${fontStack};">Your Digital Workspace Features</p>

                <table style="width:100%; border-collapse:collapse; font-family:${fontStack};">
                    <tr><td style="padding:6px 0; vertical-align:top; width:16px;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:#659a2b; margin-top:5px;"></span></td><td style="padding:6px 0; font-size:13px; color:#475569; padding-left:10px; line-height:1.5;"><strong>Daily Operations:</strong> Real-time attendance, leave requests, and performance tracking.</td></tr>
                    <tr><td style="padding:6px 0; vertical-align:top;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:#659a2b; margin-top:5px;"></span></td><td style="padding:6px 0; font-size:13px; color:#475569; padding-left:10px; line-height:1.5;"><strong>Audit Workflow:</strong> Centralized task management, client documentation, and status monitoring.</td></tr>
                    <tr><td style="padding:6px 0; vertical-align:top;"><span style="display:block; width:6px; height:6px; border-radius:50%; background:#659a2b; margin-top:5px;"></span></td><td style="padding:6px 0; font-size:13px; color:#475569; padding-left:10px; line-height:1.5;"><strong>Collaboration:</strong> Secure document sharing, internal messaging, and compliance resources.</td></tr>
                </table>
            </div>

            <p style="font-size:13px; color:#64748b; font-family:${fontStack}; margin-bottom: 20px;">
                Please use the button below to accept your invitation and set up your account.
            </p>
        `;

        const html = EmailService.getTemplateWrapper(content, 'Workspace Invitation', 'Accept Invitation & Sign Up', signupLink, 'green');
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, `${inviterName} via RSA Portal`);
    },

    sendOfficialNotice: async (toEmail: string, userName: string, title: string, contentText: string, priority: string): Promise<{ success: boolean; error?: string; tip?: string }> => {
        const fontStack = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
        const subject = `Official Firm Notice: ${title}`;
        
        let priorityColor = '#659a2b';
        let priorityBg = 'rgba(101,154,43,0.1)';
        let btnStyle: 'green' | 'danger' | 'info' = 'green';
        
        if (priority === 'HIGH') {
            priorityColor = '#c4445a';
            priorityBg = 'rgba(196,68,90,0.1)';
            btnStyle = 'danger';
        } else if (priority === 'MEDIUM') {
            priorityColor = '#c98a2a';
            priorityBg = 'rgba(201,138,42,0.1)';
            btnStyle = 'info';
        }

        const content = `
            <p style="font-size:16px; color:#1e293b; margin:0 0 10px; font-family:${fontStack};">
                Dear <strong>${userName}</strong>,
            </p>
            <p style="font-size:14px; line-height:1.7; color:#64748b; margin:0 0 24px; font-family:${fontStack};">
                An official notice has been broadcast to the firm. Please review the details below.
            </p>

            <!-- Notice card -->
            <div style="background:${priorityBg}; border:1px solid ${priorityColor}40; border-radius:12px; padding:24px; margin-bottom:28px;">
                <div style="display:inline-block; background:${priorityColor}; color:#ffffff; padding:3px 12px; border-radius:99px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:14px; font-family:${fontStack};">
                    ${priority} Priority
                </div>
                <h3 style="margin:0 0 12px 0; color:#1e293b; font-size:20px; font-weight:800; letter-spacing:-0.5px; line-height:1.2; font-family:${fontStack};">
                    ${title}
                </h3>
                <div style="color:#475569; font-size:14px; line-height:1.6; font-family:${fontStack};">
                    ${contentText.replace(/\n/g, '<br/>')}
                </div>
            </div>

            <p style="font-size:13px; color:#64748b; font-family:${fontStack}; margin-bottom: 20px;">
                You can view the full discussion and related documents in the RSA Portal.
            </p>
        `;

        const html = EmailService.getTemplateWrapper(content, 'OFFICIAL NOTICE', 'Open RSA Portal', `${window.location.origin}/#/notices`, btnStyle);
        return EmailService.sendEmail({ email: toEmail, name: userName }, subject, html, 'RSA Board');
    }
};
