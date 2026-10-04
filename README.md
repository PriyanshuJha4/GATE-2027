# GATE 2027 Preparation Dashboard

Personal exam-prep dashboard built with Next.js (Vercel) + Supabase (PostgreSQL).

## Features
- Frictionless multi-user profiles (name + email, no password)
- Live dashboard header: date/time, syllabus %, overall progress, avg mock score
- Reverse calendar milestone countdowns
- 19-week Non-Negotiables Matrix (editable focus notes + 7 checkboxes per week)
- Error Log with subject/date filters and root-cause reasons
- Spaced-repetition nudges (3/7/30-day re-test reminders from your error log)
- Roadmap & Milestones (static phase overview)
- Study Links resource hub (add/edit/delete)
- Formula & Short-Note Vault with Google Drive links + tag search
- Subject-wise weightage bar chart
- Mock test score trend graph (recharts)

## Setup

1. Create a free Supabase project at supabase.com
2. In the SQL Editor, run `database/schema.sql`
3. Copy `.env.local.example` to `.env.local` and fill in your Supabase URL + anon key
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
5. Open http://localhost:3000, click "+ Add User" to create your first profile

## Deploy
Push to GitHub, then import the repo on vercel.com. Add the same two environment
variables in Vercel's Project Settings before deploying.

## Security note
This uses "frictionless" profile selection (no password), with permissive Row
Level Security policies suitable for personal/family use where only you hold
the Supabase anon key. Do not make this public without adding real
authentication and tightening the RLS policies in `database/schema.sql`.

## Phone sync (offline dashboard -> cloud bridge -> phone)
The cloud is only a **bridge**; the permanent copy lives on the phone.

1. In Vercel -> Settings -> Environment Variables add `SYNC_ACCESS_KEY` (your own long passphrase, min 8 chars). `SUPABASE_SERVICE_ROLE_KEY` must exist too. Redeploy.
2. **Laptop:** in the offline dashboard make a backup *with PDFs* (`/api/backup?pdfs=1`). Open `https://<your-app>.vercel.app/sync`, enter the passphrase, choose the zip. Each file goes straight to a private Supabase Storage bucket (`gate-sync`) and is verified.
3. **Phone:** open `/sync` (use "Add to Home screen" first so the browser keeps the data), enter the passphrase, press *Download to this phone*. Every file is checked (size + SHA-256) and stored in the phone's app storage, then the phone confirms to the cloud.
4. **Clean cloud:** press *Clean cloud*. It only works after a phone confirmed a verified download.
5. Read everything at `/offline` (flashcards with spaced repetition, error log with screenshots, PDFs) with no internet.
6. For a copy that survives even a browser-data wipe: *Save everything as ZIP to phone* (goes to Downloads/Files). It has the same format as the offline dashboard's backup, so phone reviews can be restored on the laptop in merge mode.

Limits: 50 MB per file on the free Supabase plan; PDF annotations are not drawn on the phone yet (they are kept in the data).
