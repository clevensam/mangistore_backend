import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  tls: {
    rejectUnauthorized: false,
  },
});

const FROM = process.env.DEFAULT_FROM_EMAIL || 'noreply@mangistore.com';

export async function verifyEmailConfig(): Promise<void> {
  await transporter.verify();
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const mailOptions = {
    from: FROM,
    to,
    subject: 'Your Mangi Store Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 16px; border: 1px solid #f1f5f9;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #ea580c; font-size: 24px; margin: 0;">Mangi Store</h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 4px 0 0;">Email Verification</p>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Use the code below to verify your email address and complete your account setup. This code expires in <strong>15 minutes</strong>.</p>
        <div style="background: #fef7ee; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <span style="font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #c2410c; font-family: monospace;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin-bottom: 0;">If you did not create an account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 0;" />
        <p style="color: #cbd5e1; font-size: 12px; text-align: center; margin: 12px 0 0;">&copy; ${new Date().getFullYear()} Mangi Store. All rights reserved.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
