import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSheetsContext } from './_lib/sheets';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { loginName, loginPhone } = req.body || {};
  if (!loginName || !loginPhone) {
    return res.status(400).json({ error: 'Missing name or phone number' });
  }

  let ctx;
  try {
    ctx = await getSheetsContext();
  } catch (e: any) {
    return res.status(503).json({ error: e?.message || 'Google Sheets API not connected.' });
  }

  const { sheets, spreadsheetId, volunteersTabName } = ctx;
  const SUPER_USER_EMAIL = process.env.SUPER_USER_EMAIL;

  const searchName = String(loginName).toLowerCase().trim();
  const searchPhone = String(loginPhone).toLowerCase().replace(/[\s\-+()]/g, '');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${volunteersTabName}'!A2:E`,
    });
    const rows = response.data.values || [];

    let user: any = null;
    for (const row of rows) {
      const name = (row[0] || '').toLowerCase().trim();
      const phone = (row[1] || '').toLowerCase().replace(/[\s\-+()]/g, '');
      const email = (row[2] || '').toLowerCase().trim();
      const birthday = (row[3] || '').trim();

      if (name === searchName && phone === searchPhone) {
        user = {
          name: row[0] || '',
          phone: row[1] || '',
          email: row[2] || '',
          birthday,
          isAdmin: email === SUPER_USER_EMAIL?.toLowerCase(),
        };
        break;
      }
    }

    // Auto-bootstrap "Kingdom Admin" on an empty/new sheet so the first
    // login from a clean slate doesn't lock the admin out.
    if (!user && SUPER_USER_EMAIL && searchName === 'kingdom admin') {
      user = {
        name: 'Kingdom Admin',
        phone: loginPhone,
        email: SUPER_USER_EMAIL,
        birthday: '',
        isAdmin: true,
      };
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${volunteersTabName}'!A:E`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [['Kingdom Admin', loginPhone, SUPER_USER_EMAIL, '', new Date().toISOString()]],
          },
        });
      } catch (err) {
        console.error('Failed to bootstrap Super User:', err);
      }
    }

    if (user) {
      return res.status(200).json(user);
    }

    if (rows.length === 0) {
      return res.status(404).json({
        error: `The tab named "${volunteersTabName}" is empty! Ensure Column A is Name, and Column B is Cell Number.`,
      });
    }

    return res.status(404).json({
      error: `User not found. Ask an admin to securely add your exact Name to Column A and Cell Number to Column B on the "${volunteersTabName}" tab.`,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res
      .status(500)
      .json({ error: 'Google Sheets Error: ' + (error?.message || 'Failed to login') });
  }
}
