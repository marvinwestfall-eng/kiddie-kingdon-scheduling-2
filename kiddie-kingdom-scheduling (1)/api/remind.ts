import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsContext } from './_lib/sheets';
import { getMailer } from './_lib/mailer';

const TOTAL_SLOTS_PER_DATE = 10; // 2 services × 5 slots each

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date } = req.body || {};
  if (!date) return res.status(400).json({ error: 'Missing date' });

  let ctx;
  try {
    ctx = await getSheetsContext();
  } catch (e: any) {
    return res.status(503).json({ error: e?.message || 'Not configured' });
  }

  const { sheets, spreadsheetId, volunteersTabName, scheduleTabName } = ctx;
  const transporter = getMailer();

  if (!transporter) {
    return res
      .status(500)
      .json({ error: 'Gmail not configured in environment variables to send emails.' });
  }

  try {
    // 1. Pull all volunteer emails (column C of Volunteers tab)
    const dirResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${volunteersTabName}'!A2:E`,
    });
    const emails = (dirResp.data.values || [])
      .map((row: any[]) => row[2])
      .filter((e: any) => e && String(e).trim().length > 0);

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No volunteer email addresses on file.' });
    }

    // 2. Count current bookings for the target date
    const schedResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${scheduleTabName}'!A2:D`,
    });
    const bookingsForDate = (schedResp.data.values || []).filter((r: any[]) => r[0] === date);

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      bcc: emails.join(','),
      subject: `Help Needed: Kiddie Kingdom Volunteer Slots for ${date}`,
      text:
        `Hi Team,\n\n` +
        `We still have open spots for Kiddie Kingdom on Sunday, ${date}. ` +
        `So far we have ${bookingsForDate.length} out of ${TOTAL_SLOTS_PER_DATE} required slots filled.\n\n` +
        `Please log into the Kiddie Kingdom App to grab an available shift!\n\n` +
        `Thanks,\nYour Kingdom Admin`,
    });

    return res.status(200).json({ success: true, count: emails.length });
  } catch (error: any) {
    console.error('Reminder error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to send reminders: ' + (error?.message || String(error)) });
  }
}
