-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ===== Users (frictionless profile, not real auth) =====
create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    created_at timestamptz default now()
);

-- ===== Weekly Non-Negotiables Matrix (19 weeks per user) =====
create table if not exists weekly_progress (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    week_number int not null,
    focus_notes text,
    completed boolean default false,
    class_notes boolean default false,
    dpp_questions boolean default false,
    pyqs boolean default false,
    mock_test boolean default false,
    error_log boolean default false,
    short_notes boolean default false,
    updated_at timestamptz default now(),
    unique (user_id, week_number)
);

-- ===== Error Log (mistake review) =====
create table if not exists error_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    log_date date not null default current_date,
    subject text not null,
    topic text,
    question text,
    reason text,
    created_at timestamptz default now()
);

-- ===== Study Links (resource hub) =====
create table if not exists study_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    title text not null,
    url text not null,
    created_at timestamptz default now()
);

-- ===== Formula & Short-Note Vault =====
create table if not exists formula_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    subject text not null,
    title text not null,
    tags text[] default '{}',
    drive_link text,
    content text,
    created_at timestamptz default now()
);

-- ===== Mock Test Scores (for Mock Test Logs) =====
create table if not exists mock_tests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    test_date date not null,
    subject text,
    score numeric not null,
    max_score numeric not null default 100,
    created_at timestamptz default now()
);

-- ===== Subject Weightage (shared reference data, not per-user) =====
create table if not exists subject_weightage (
    id uuid primary key default gen_random_uuid(),
    subject text not null unique,
    avg_marks numeric not null,
    notes text
);

-- Row Level Security: keep it simple for a personal-use dashboard.
-- If you deploy this where others could see your Supabase anon key,
-- tighten these policies (e.g. match auth.uid()) before going further.
alter table users enable row level security;
alter table weekly_progress enable row level security;
alter table error_logs enable row level security;
alter table study_links enable row level security;
alter table formula_notes enable row level security;
alter table mock_tests enable row level security;
alter table subject_weightage enable row level security;

create policy "allow all - users" on users for all using (true) with check (true);
create policy "allow all - weekly_progress" on weekly_progress for all using (true) with check (true);
create policy "allow all - error_logs" on error_logs for all using (true) with check (true);
create policy "allow all - study_links" on study_links for all using (true) with check (true);
create policy "allow all - formula_notes" on formula_notes for all using (true) with check (true);
create policy "allow all - mock_tests" on mock_tests for all using (true) with check (true);
create policy "allow all - subject_weightage" on subject_weightage for all using (true) with check (true);

-- Seed: subject weightage (edit with your own PYQ analysis numbers)
insert into subject_weightage (subject, avg_marks, notes) values
    ('Data Structures & Algorithms', 10, 'Consistently high-weightage across years'),
    ('Operating Systems', 8, 'Deadlock, scheduling, memory management recur often'),
    ('DBMS', 7, 'Normalization and transactions are frequent'),
    ('Computer Networks', 6, 'TCP/UDP and routing recur'),
    ('COA', 6, 'Pipelining and cache recur'),
    ('TOC', 5, ''),
    ('Compiler Design', 4, ''),
    ('Digital Logic', 5, ''),
    ('Discrete Mathematics', 6, ''),
    ('Engineering Mathematics', 8, ''),
    ('C Programming', 5, ''),
    ('Aptitude', 15, 'General + Quantitative + Verbal + Analytical + Spatial combined')
on conflict (subject) do nothing;