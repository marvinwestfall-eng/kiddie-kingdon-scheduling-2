import type { VercelRequest, VercelResponse } from '@vercel/node';
import { tryGetSheetsContext } from './_lib/sheets';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { ctx, error } = await tryGetSheetsContext();
  res.status(200).json({
    configured: Boolean(ctx),
    mockMode: false,
    connectionError: error,
  });
}
