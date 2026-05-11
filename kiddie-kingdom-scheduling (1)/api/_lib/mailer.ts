import nodemailer from 'nodemailer';

/**
 * Returns a configured nodemailer transporter or null if Gmail credentials
 * are missing. Each handler should check for null before sending.
 */
export function getMailer() {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
}
