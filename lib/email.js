// Email service using Resend
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'team@soulprintengine.ai';
const APP_NAME = 'SoulPrint';
const APP_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://soulprintengine.ai';

// Email templates
const emailStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; margin: 0; padding: 40px 20px; }
  .container { max-width: 560px; margin: 0 auto; background: #111; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
  .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 32px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 28px; letter-spacing: 4px; font-weight: 800; }
  .content { padding: 32px; color: #e5e5e5; line-height: 1.6; }
  .content h2 { color: white; margin-top: 0; font-size: 22px; }
  .content p { margin: 16px 0; }
  .code-box { background: #000; border: 2px dashed #f97316; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
  .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #f97316; font-family: monospace; }
  .btn { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
  .footer { padding: 24px 32px; background: #0a0a0a; text-align: center; color: #666; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.05); }
  .footer a { color: #f97316; text-decoration: none; }
  .highlight { color: #f97316; font-weight: 600; }
`;

// Welcome email template
function welcomeEmailTemplate(userName) {
  return `
<!DOCTYPE html>
<html>
<head><style>${emailStyles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>SOULPRINT</h1>
    </div>
    <div class="content">
      <h2>Welcome${userName ? `, ${userName}` : ''}! 🎉</h2>
      <p>Thanks for joining <span class="highlight">SoulPrint</span> — your AI that actually gets you.</p>
      <p>Unlike other AI assistants, SoulPrint learns your communication style, remembers your preferences, and adapts to how you think. No more re-explaining yourself every conversation.</p>
      <p>Here's what happens next:</p>
      <ul style="color: #999; padding-left: 20px;">
        <li>Complete your onboarding assessment</li>
        <li>Start chatting — SoulPrint will learn as you go</li>
        <li>Import your chat history for instant personalization</li>
      </ul>
      <center><a href="${APP_URL}/chat" class="btn">Get Started →</a></center>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SoulPrint Engine. All rights reserved.</p>
      <p><a href="${APP_URL}/privacy">Privacy Policy</a> · <a href="${APP_URL}/terms">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;
}

// Waitlist accepted email template
function acceptedEmailTemplate(userName) {
  return `
<!DOCTYPE html>
<html>
<head><style>${emailStyles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>SOULPRINT</h1>
    </div>
    <div class="content">
      <h2>You're In! 🚀</h2>
      <p>Great news${userName ? `, ${userName}` : ''}! Your access to <span class="highlight">SoulPrint</span> has been approved.</p>
      <p>Your personalized AI assistant is ready and waiting — it already knows your communication style from your assessment.</p>
      <p>Log in now to start chatting:</p>
      <center><a href="${APP_URL}/auth" class="btn">Log In Now →</a></center>
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you have any questions, just reply to this email. We're here to help!</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SoulPrint Engine. All rights reserved.</p>
      <p><a href="${APP_URL}/privacy">Privacy Policy</a> · <a href="${APP_URL}/terms">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;
}

// Beta access code email template
function betaCodeEmailTemplate(code, recipientName) {
  return `
<!DOCTYPE html>
<html>
<head><style>${emailStyles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>SOULPRINT</h1>
    </div>
    <div class="content">
      <h2>Your Beta Access Code 🔑</h2>
      <p>Hey${recipientName ? ` ${recipientName}` : ''}! You've been invited to join the <span class="highlight">SoulPrint</span> beta.</p>
      <p>Use this exclusive access code to skip the waitlist:</p>
      <div class="code-box">
        <div class="code">${code}</div>
      </div>
      <p>To get started:</p>
      <ol style="color: #999; padding-left: 20px;">
        <li>Go to <a href="${APP_URL}/auth" style="color: #f97316;">${APP_URL}</a></li>
        <li>Create an account or sign in</li>
        <li>Enter your access code when prompted</li>
      </ol>
      <center><a href="${APP_URL}/auth" class="btn">Join Beta Now →</a></center>
      <p style="color: #666; font-size: 14px; margin-top: 24px;">This code is valid for the beta period. Don't share it publicly!</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SoulPrint Engine. All rights reserved.</p>
      <p><a href="${APP_URL}/privacy">Privacy Policy</a> · <a href="${APP_URL}/terms">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;
}

// Password reset email template (for non-Firebase users)
function passwordResetEmailTemplate(resetLink) {
  return `
<!DOCTYPE html>
<html>
<head><style>${emailStyles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>SOULPRINT</h1>
    </div>
    <div class="content">
      <h2>Reset Your Password</h2>
      <p>We received a request to reset your password for your <span class="highlight">SoulPrint</span> account.</p>
      <p>Click the button below to create a new password:</p>
      <center><a href="${resetLink}" class="btn">Reset Password →</a></center>
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you didn't request this, you can safely ignore this email. This link expires in 1 hour.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SoulPrint Engine. All rights reserved.</p>
      <p><a href="${APP_URL}/privacy">Privacy Policy</a> · <a href="${APP_URL}/terms">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;
}

// Generic announcement email template
function announcementEmailTemplate(title, content, ctaText, ctaUrl) {
  return `
<!DOCTYPE html>
<html>
<head><style>${emailStyles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>SOULPRINT</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <div style="color: #ccc;">${content}</div>
      ${ctaText && ctaUrl ? `<center><a href="${ctaUrl}" class="btn">${ctaText} →</a></center>` : ''}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SoulPrint Engine. All rights reserved.</p>
      <p><a href="${APP_URL}/privacy">Privacy Policy</a> · <a href="${APP_URL}/terms">Terms of Service</a></p>
    </div>
  </div>
</body>
</html>`;
}

// Send email function
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${SENDER_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      replyTo: replyTo || SENDER_EMAIL,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`Email sent to ${to}: ${subject}`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('Email send failed:', err);
    return { success: false, error: err.message };
  }
}

// Convenience functions
export async function sendWelcomeEmail(email, userName) {
  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}! 🎉`,
    html: welcomeEmailTemplate(userName),
  });
}

export async function sendAcceptedEmail(email, userName) {
  return sendEmail({
    to: email,
    subject: `You're In! Your ${APP_NAME} Access is Approved 🚀`,
    html: acceptedEmailTemplate(userName),
  });
}

export async function sendBetaCodeEmail(email, code, recipientName) {
  return sendEmail({
    to: email,
    subject: `Your ${APP_NAME} Beta Access Code 🔑`,
    html: betaCodeEmailTemplate(code, recipientName),
  });
}

export async function sendAnnouncementEmail(email, title, content, ctaText, ctaUrl) {
  return sendEmail({
    to: email,
    subject: `${title} | ${APP_NAME}`,
    html: announcementEmailTemplate(title, content, ctaText, ctaUrl),
  });
}

// New user registration notification to admin
export async function sendNewUserNotification(adminEmail, user) {
  const isWaitlist = !user.accepted;
  const subject = isWaitlist 
    ? `⏳ New Waitlist Signup - ${APP_NAME}`
    : `🎉 New User Registration - ${APP_NAME}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head><style>${emailStyles}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>SOULPRINT</h1>
    </div>
    <div class="content">
      <h2>${isWaitlist ? 'New Waitlist Signup! ⏳' : 'New User Registered! 🎉'}</h2>
      <p>A new user has ${isWaitlist ? 'joined the waitlist' : 'registered'} on <span class="highlight">SoulPrint</span>.</p>
      
      <div style="background: #0a0a0a; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="margin: 8px 0;"><strong style="color: #f97316;">Email:</strong> ${user.email}</p>
        <p style="margin: 8px 0;"><strong style="color: #f97316;">Registered:</strong> ${new Date().toLocaleString()}</p>
        ${user.beta_code_used ? `<p style="margin: 8px 0;"><strong style="color: #f97316;">Beta Code:</strong> ${user.beta_code_used}</p>` : ''}
        <p style="margin: 8px 0;"><strong style="color: #f97316;">Status:</strong> ${user.accepted ? '✅ Auto-accepted' : '⏳ On waitlist'}</p>
      </div>
      
      ${isWaitlist ? `
      <div style="background: #fef3c7; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
          <strong>Action Required:</strong> This user needs approval in the admin panel, or you can send them a beta code.
        </p>
      </div>
      ` : ''}
      
      <center><a href="${APP_URL}/admin" class="btn">Go to Admin Panel →</a></center>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SoulPrint Engine. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendAcceptedEmail,
  sendBetaCodeEmail,
  sendAnnouncementEmail,
  sendNewUserNotification,
};
