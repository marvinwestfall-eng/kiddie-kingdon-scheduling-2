import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsContext } from './_lib/sheets';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { sheets, spreadsheetId, volunteersTabName } = await getSheetsContext();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${volunteersTabName}'!A2:D`,
    });

    const rows = response.data.values || [];
    const directory = rows.map((row: any[]) => ({
      name: row[0] || '',
      phone: row[1] || '',
      email: row[2] || '',
      birthday: row[3] || '',
    }));

    res.status(200).json(directory);
  } catch (error: any) {
    console.error('Directory error:', error);
    res.status(503).json({ error: error?.message || 'Failed to fetch directory' });
  }
}
