const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

/**
 * Email Service
 * Handles email delivery for invitations and notifications
 */
class EmailService {
  constructor() {
    this.sesClient = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@home-inventory.com';
    this.baseUrl = process.env.FRONTEND_URL || 'https://home-inventory.com';
  }

  /**
   * Send invitation email
   * @param {string} email - Recipient email address
   * @param {string} token - Invitation token
   * @param {object} invitationDetails - Invitation details (inventoryName, inviterName, role)
   * @returns {Promise<object>} Email send result
   */
  async sendInvitationEmail(email, token, invitationDetails) {
    if (!email || !token || !invitationDetails) {
      throw new Error('Email, token, and invitation details are required');
    }

    const { inventoryName, inviterName, role } = invitationDetails;
    
    if (!inventoryName || !inviterName || !role) {
      throw new Error('Invitation details must include inventoryName, inviterName, and role');
    }

    try {
      const invitationUrl = `${this.baseUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
      
      const subject = `Invitation to join "${inventoryName}" inventory`;
      
      const htmlBody = this.generateInvitationEmailHTML({
        email,
        inventoryName,
        inviterName,
        role,
        invitationUrl,
        expiryDays: 7
      });

      const textBody = this.generateInvitationEmailText({
        email,
        inventoryName,
        inviterName,
        role,
        invitationUrl,
        expiryDays: 7
      });

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [email]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: 'UTF-8'
            },
            Text: {
              Data: textBody,
              Charset: 'UTF-8'
            }
          }
        }
      });

      const result = await this.sesClient.send(command);
      
      console.log(`Invitation email sent to ${email}, MessageId: ${result.MessageId}`);
      
      return {
        messageId: result.MessageId,
        email,
        subject,
        sentAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw new Error(`Failed to send invitation email: ${error.message}`);
    }
  }

  /**
   * Generate HTML email body for invitation
   * @param {object} params - Email parameters
   * @returns {string} HTML email body
   */
  generateInvitationEmailHTML(params) {
    const { inventoryName, inviterName, role, invitationUrl, expiryDays } = params;
    
    const roleDisplayName = this.getRoleDisplayName(role);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inventory Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .button:hover { background-color: #0056b3; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>You're Invited!</h1>
        <p><strong>${inviterName}</strong> has invited you to join the <strong>"${inventoryName}"</strong> inventory.</p>
    </div>
    
    <div class="content">
        <p>You've been invited to join as a <strong>${roleDisplayName}</strong>.</p>
        
        <p>Click the button below to accept this invitation:</p>
        
        <a href="${invitationUrl}" class="button">Accept Invitation</a>
        
        <div class="warning">
            <strong>Important:</strong> This invitation will expire in ${expiryDays} days. 
            If you don't have an account yet, you'll be prompted to create one.
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p><a href="${invitationUrl}">${invitationUrl}</a></p>
    </div>
    
    <div class="footer">
        <p>This invitation was sent by ${inviterName}. If you weren't expecting this invitation, you can safely ignore this email.</p>
        <p>Home Inventory Management System</p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email body for invitation
   * @param {object} params - Email parameters
   * @returns {string} Plain text email body
   */
  generateInvitationEmailText(params) {
    const { inventoryName, inviterName, role, invitationUrl, expiryDays } = params;
    
    const roleDisplayName = this.getRoleDisplayName(role);
    
    return `
You're Invited!

${inviterName} has invited you to join the "${inventoryName}" inventory as a ${roleDisplayName}.

To accept this invitation, visit the following link:
${invitationUrl}

IMPORTANT: This invitation will expire in ${expiryDays} days. If you don't have an account yet, you'll be prompted to create one.

If you weren't expecting this invitation, you can safely ignore this email.

---
Home Inventory Management System
`;
  }

  /**
   * Get display name for role
   * @param {string} role - Role identifier
   * @returns {string} Human-readable role name
   */
  getRoleDisplayName(role) {
    const roleNames = {
      'owner': 'Owner',
      'administrator': 'Administrator',
      'member': 'Member',
      'read_only': 'Read-Only Member'
    };
    
    return roleNames[role] || 'Member';
  }

  /**
   * Send notification email (for future use)
   * @param {string} email - Recipient email
   * @param {string} subject - Email subject
   * @param {string} message - Email message
   * @returns {Promise<object>} Email send result
   */
  async sendNotificationEmail(email, subject, message) {
    if (!email || !subject || !message) {
      throw new Error('Email, subject, and message are required');
    }

    try {
      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: {
          ToAddresses: [email]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Text: {
              Data: message,
              Charset: 'UTF-8'
            }
          }
        }
      });

      const result = await this.sesClient.send(command);
      
      console.log(`Notification email sent to ${email}, MessageId: ${result.MessageId}`);
      
      return {
        messageId: result.MessageId,
        email,
        subject,
        sentAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending notification email:', error);
      throw new Error(`Failed to send notification email: ${error.message}`);
    }
  }

  /**
   * Validate email configuration
   * @returns {Promise<boolean>} True if email service is properly configured
   */
  async validateConfiguration() {
    try {
      // Check if required environment variables are set
      if (!this.fromEmail) {
        throw new Error('FROM_EMAIL environment variable is required');
      }

      if (!this.baseUrl) {
        throw new Error('FRONTEND_URL environment variable is required');
      }

      // Test SES configuration by attempting to get send quota
      // This is a lightweight way to verify SES is accessible
      const { GetSendQuotaCommand } = require('@aws-sdk/client-ses');
      await this.sesClient.send(new GetSendQuotaCommand({}));
      
      return true;
    } catch (error) {
      console.error('Email service configuration validation failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService();