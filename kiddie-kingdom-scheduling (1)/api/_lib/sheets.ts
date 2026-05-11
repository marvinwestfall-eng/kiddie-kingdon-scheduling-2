import { google } from 'googleapis';

/**
 * Shared Google Sheets client used by all /api/* handlers.
 *
 * Files prefixed with `_` (and folders prefixed with `_`) are NOT exposed
 * as routes by Vercel — so /api/_lib/* is safe to use for internal modules
 * that get bundled into each function but stay un-routable.
 *
 * Each Vercel function is its own lambda, so the module-level cache below
 * is per-function. Warm invocations of the same endpoint reuse the client;
 * cold starts re-initialise it. That's fine — it just costs one extra
 * Sheets API call on the first hit of each endpoint after a deploy.
 */

const DEFAULT_SHEET_ID = '1HGJZzSwcFBhWcaIIC91esu_ZMTq69EWX_YyRB-IFJSM';

export interface SheetsContext {
  sheets: any;
  spreadsheetId: string;
  volunteersTabName: string;
  scheduleTabName: string;
  scheduleTabId: number | null;
}

let cached: SheetsContext | null = null;
let cachedError: string | null = null;

/**
 * Cleans up a private key pulled from an env var. Handles three things
 * Vercel and other hosts tend to mangle:
 *   1. wrapping quotes
 *   2. literal "\n" sequences instead of real newlines
 *   3. PEM body that lost its 64-char line breaks
 */
function normalisePrivateKey(raw: string): string {
  let key = raw.replace(/^"|"$/g, '').replace(/^'|'$/g, '').replace(/\\n/g, '\n');

  const pemMatch = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (!pemMatch) {
    throw new Error('Missing BEGIN PRIVATE KEY or END PRIVATE KEY boundaries.');
  }

  const cleanBase64 = pemMatch[1].replace(/\s+/g, '');
  const wrapped = cleanBase64.match(/.{1,64}/g);
  if (!wrapped) {
    throw new Error('Private key body is empty after cleanup.');
  }
  return `-----BEGIN PRIVATE KEY-----\n${wrapped.join('\n')}\n-----END PRIVATE KEY-----\n`;
}

/**
 * Confirms the Volunteers + Schedule tabs exist on the target sheet,
 * creating + header-stamping them if missing. Returns the resolved tab
 * names (we keep the user's casing if they already exist) and the
 * sheetId of the Schedule tab (needed for row-deletes via batchUpdate).
 */
async function ensureSheetsExist(sheets: any, spreadsheetId: string) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const currentSheets = response.data.sheets.map((s: any) => s.properties);

  let volunteersTabName = 'Volunteers';
  let scheduleTabName = 'Schedule';
  let scheduleTabId: number | null = null;

  const volMatch = currentSheets.find(
    (s: any) => s.title.toLowerCase().trim() === 'volunteers'
  );
  const schedMatch = currentSheets.find(
    (s: any) => s.title.toLowerCase().trim() === 'schedule'
  );

  if (volMatch) {
    volunteersTabName = volMatch.title;
  } else {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Volunteers' } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Volunteers!A1:E1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Name', 'Phone', 'Email', 'Birthday', 'CreatedAt']],
      },
    });
  }

  if (schedMatch) {
    scheduleTabName = schedMatch.title;
    scheduleTabId = schedMatch.sheetId;
  } else {
    const createResp = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Schedule' } } }] },
    });
    scheduleTabId = createResp.data.replies[0].addSheet.properties.sheetId;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Schedule!A1:D1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['Date', 'Time', 'Role', 'VolunteerName']],
      },
    });
  }

  return { volunteersTabName, scheduleTabName, scheduleTabId };
}

/**
 * Returns a ready-to-use Sheets context, or throws with a user-friendly
 * message that the /api/status endpoint surfaces in the setup screen.
 */
export async function getSheetsContext(): Promise<SheetsContext> {
  if (cached) return cached;
  if (cachedError) throw new Error(cachedError);

  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID || DEFAULT_SHEET_ID;

  if (
    !GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !GOOGLE_PRIVATE_KEY ||
    GOOGLE_PRIVATE_KEY.includes('...')
  ) {
    cachedError =
      'Missing or invalid GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY in Environment Variables.';
    throw new Error(cachedError);
  }

  let formattedKey: string;
  try {
    formattedKey = normalisePrivateKey(GOOGLE_PRIVATE_KEY);
  } catch (e: any) {
    cachedError = 'Private Key Format Error: ' + e.message;
    throw new Error(cachedError);
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const { volunteersTabName, scheduleTabName, scheduleTabId } = await ensureSheetsExist(
      sheets,
      spreadsheetId
    );
    cached = {
      sheets,
      spreadsheetId,
      volunteersTabName,
      scheduleTabName,
      scheduleTabId,
    };
    return cached;
  } catch (error: any) {
    cachedError =
      'API Error: ' +
      (error?.message ||
        'Verify your Service Account has Editor permissions on the Sheet.');
    throw new Error(cachedError);
  }
}

/**
 * Non-throwing variant for the /api/status endpoint, which needs to
 * report the *reason* configuration failed rather than crash.
 */
export async function tryGetSheetsContext(): Promise<{
  ctx: SheetsContext | null;
  error: string | null;
}> {
  try {
    const ctx = await getSheetsContext();
    return { ctx, error: null };
  } catch (e: any) {
    return { ctx: null, error: e?.message || 'Unknown configuration error' };
  }
}
