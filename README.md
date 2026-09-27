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