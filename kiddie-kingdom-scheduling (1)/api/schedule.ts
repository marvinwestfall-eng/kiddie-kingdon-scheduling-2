import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsContext } from './_lib/sheets';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { sheets, spreadsheetId, scheduleTabName } = await getSheetsContext();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${scheduleTabName}'!A2:D`,
    });

    const rows = response.data.values || [];
    const schedule = rows.map((row: any[]) => ({
      date: row[0] || '',
      time: row[1] || '',
      role: row[2] || '',
      volunteerName: row[3] || '',
    }));

    res.status(200).json(schedule);
  } catch (error: any) {
    console.error('Schedule error:', error);
    res.status(503).json({ error: error?.message || 'Failed to fetch schedule' });
  }
}
