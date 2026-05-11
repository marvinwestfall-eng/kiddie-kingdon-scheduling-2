# Kiddie Kingdom — Volunteer Scheduling

A React + Vite app for managing Sunday volunteer shifts. Reads and writes to a Google Sheet (default: **Kiddie Kingdom Mar - Dec**) via a service account, with optional Gmail-powered reminder emails. Built to deploy to Vercel via GitHub with zero infrastructure.

## What changed from the AI Studio / Express version

The original app ran an Express server (`server.ts`) that served Vite middleware and exposed the `/api/*` routes. That model doesn't work on Vercel. This rebuild splits the routes into individual **Vercel Functions** under `/api/`, with shared logic in `/api/_lib/`. The React frontend is untouched — every `fetch('/api/...')` still hits the same paths, just answered by a Vercel Function instead of Express.

The architecture is now:

```
/api/
  status.ts        GET    /api/status      — config check (used by setup screen)
  directory.ts    GET    /api/directory   — list volunteers
  schedule.ts    GET    /api/schedule    — list booked shifts
  login.ts          POST   /api/login         — name + phone authentication
  book.ts          POST   /api/book          — sign up for a shift
                    DELETE /api/book          — cancel a shift
  remind.ts      POST   /api/remind      — BCC all volunteers about open spots
  _lib/
    sheets.ts    — shared Sheets client (singleton, lazy-init)
    mailer.ts  — shared nodemailer factory
```

## Deploy to Vercel via GitHub

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USER/kiddie-kingdom-scheduling.git
git push -u origin main
```

### 2. Set up a Google service account

You need this so Vercel's serverless functions can read and write the sheet on the app's behalf — without anyone signing in.

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project (or pick an existing one).
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create Credentials → Service Account**.
4. After creating it, click into the account → **Keys → Add Key → Create new key → JSON**. A JSON file downloads. Keep it safe — this is the only copy.
5. Open your Google Sheet (**Kiddie Kingdom Mar - Dec** by default), click **Share**, paste the service account's `client_email` (looks like `name@project.iam.gserviceaccount.com`), and give it **Editor** access.

### 3. Import the GitHub repo into Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import your repo.
2. Vercel detects Vite automatically. Don't change the build settings — they're already in `vercel.json`.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | the `client_email` from your JSON |
   | `GOOGLE_PRIVATE_KEY` | the `private_key` from your JSON — **paste the whole string with the `\n` escapes intact**, including the `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines |
   | `GOOGLE_SHEET_ID` | (optional) the sheet ID — defaults to the Kiddie Kingdom Mar - Dec sheet `1HGJZzSwcFBhWcaIIC91esu_ZMTq69EWX_YyRB-IFJSM` |
   | `GMAIL_USER` | the Gmail account that sends reminders |
   | `GMAIL_APP_PASSWORD` | a 16-char [App Password](https://myaccount.google.com/apppasswords) — requires 2FA on the Gmail account |
   | `SUPER_USER_EMAIL` | the email that gets admin powers and is used to bootstrap "Kingdom Admin" |

   Hit **Deploy**. First build takes ~1 minute.

### 4. Verify

Visit your `*.vercel.app` URL. If the env vars are correct, you'll land on the login screen. If something's off, the **Setup Required** screen tells you exactly which env var is missing or malformed.

Every push to `main` triggers an automatic redeploy.

## Running locally

You need the Vercel CLI so the `/api/*.ts` functions actually run in development:

```bash
npm install -g vercel
npm install
vercel link          # connect this local folder to your Vercel project
vercel env pull      # pulls env vars into .env.local
npm run dev          # runs `vercel dev` on port 3000
```

`vercel dev` runs Vite for the frontend and shims the Vercel Functions runtime for `/api/*`, so the app behaves exactly the same as in production.

> Plain `npm run dev:vite` works too if you just want to tweak the UI — the `/api/*` calls will 404 in that mode.

## Configuration notes

### The Google Sheet layout

The app expects two tabs. Both are created automatically with headers if they don't exist.

**Volunteers tab** (rows from row 2 down):

| Column | A | B | C | D | E |
|---|---|---|---|---|---|
| Header | Name | Phone | Email | Birthday | CreatedAt |

**Schedule tab**:

| Column | A | B | C | D |
|---|---|---|---|---|
| Header | Date | Time | Role | VolunteerName |

The login check is case-insensitive for name and ignores spaces / dashes / `+` / `()` on the phone number — so `082 555 0192` and `+27825550192` match the same row.

### "Kingdom Admin" bootstrap

If the Volunteers tab is empty and someone logs in with name `Kingdom Admin` plus any phone number, the app:
1. Treats them as admin (uses `SUPER_USER_EMAIL` for their email)
2. Appends them to the Volunteers tab so they're permanently registered

This is to avoid a chicken-and-egg problem on a fresh sheet.

### Shift rules

- Each shift = `date` × `time` slot, capacity **5**.
- Only **one Teacher** per shift — the role is hidden in the picker after it's taken.
- "Tentative" sign-ups are stored as `Name (Tentative)` in the VolunteerName column and rendered with the strike-through orange badge in the UI.

### Reminder emails

`POST /api/remind` with `{ date }` BCCs every email in the Volunteers tab with a message showing how many of 10 slots are filled. The original Express code had two commented-out `transporter.sendMail` calls for booking and cancellation notifications — those are still commented out here. Uncomment them inside `api/book.ts` and `api/remind.ts` if you want them back.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Private Key Format Error" on the setup screen | The `\n` escapes got stripped when pasting into Vercel. Re-paste from the JSON file, keeping the literal `\n` sequences. |
| "Verify your Service Account has Editor permissions" | You forgot to share the sheet with the service account email, or shared it as Viewer instead of Editor. |
| Booking succeeds but doesn't show up on the sheet | The sheet ID is wrong, or the service account is editing a different copy. Double-check `GOOGLE_SHEET_ID`. |
| Reminder email returns "Gmail not configured" | `GMAIL_USER` or `GMAIL_APP_PASSWORD` missing. App Passwords require 2-Step Verification to be enabled on the Google account. |
| Functions time out on first request after a deploy | Cold start + ensure-tabs check is slow on the first hit. Subsequent requests reuse the cached client. The default `maxDuration` in `vercel.json` is already bumped to 15-30s for the heavier endpoints. |

## Tech stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS v4 (with brutalist `brutal-border` utility classes in `src/index.css`)
- Vercel Functions (Node runtime) for the API
- `googleapis` for Sheets, `nodemailer` for Gmail
- `date-fns` for Sunday-rolling and birthday matching
