import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsContext } from './_lib/sheets';

const SHIFT_CAPACITY = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, time, role, volunteerName } = req.body || {};
  if (!date || !time || !role || !volunteerName) {
    return res.status(400).json({
      error:
        req.method === 'DELETE' ? 'Missing required cancellation fields' : 'Missing required fields',
    });
  }

  let ctx;
  try {
    ctx = await getSheetsContext();
  } catch (e: any) {
    return res.status(503).json({ error: e?.message || 'Not configured' });
  }

  const { sheets, spreadsheetId, scheduleTabName, scheduleTabId } = ctx;

  if (req.method === 'POST') {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${scheduleTabName}'!A2:D`,
      });
      const rows = response.data.values || [];
      const bookingsForShift = rows.filter((r: any[]) => r[0] === date && r[1] === time);

      if (bookingsForShift.length >= SHIFT_CAPACITY) {
        return res.status(400).json({ error: 'This shift is already full.' });
      }

      if (role === 'Teacher' && bookingsForShift.some((r: any[]) => r[2] === 'Teacher')) {
        return res
          .status(400)
          .json({ error: 'A Teacher has already been assigned for this shift.' });
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${scheduleTabName}'!A:D`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[date, time, role, volunteerName]],
        },
      });

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Booking error:', error);
      return res
        .status(500)
        .json({ error: 'Failed to book shift: ' + (error?.message || String(error)) });
    }
  }

  // DELETE — cancel an existing booking by locating its row index
  if (scheduleTabId == null) {
    return res.status(503).json({ error: 'Google Sheets not configured properly (tab id missing)' });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${scheduleTabName}'!A2:D`,
    });
    const rows = response.data.values || [];

    const rowIndex = rows.findIndex(
      (row: any[]) =>
        row[0] === date && row[1] === time && row[2] === role && row[3] === volunteerName
    );

    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Booking not found to cancel.' });
    }

    // rows[0] corresponds to sheet row 2 (zero-indexed: 1), so the
    // deleteDimension startIndex is rowIndex + 1.
    const sheetRowIndex = rowIndex + 1;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: scheduleTabId,
                dimension: 'ROWS',
                startIndex: sheetRowIndex,
                endIndex: sheetRowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Cancellation error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to cancel shift: ' + (error?.message || String(error)) });
  }
}
