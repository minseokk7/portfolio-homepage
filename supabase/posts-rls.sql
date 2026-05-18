-- Run this in Supabase SQL Editor.
-- Replace the email below with the Supabase Auth user that will manage notices.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author text not null,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
drop policy if exists "Anyone can create posts" on public.posts;
drop policy if exists "Anyone can update posts" on public.posts;
drop policy if exists "Anyone can delete posts" on public.posts;
drop policy if exists "Only admin can insert posts" on public.posts;
drop policy if exists "Only admin can update posts" on public.posts;
drop policy if exists "Only admin can delete posts" on public.posts;

create policy "Anyone can read posts"
on public.posts
for select
using (true);

create policy "Only admin can insert posts"
on public.posts
for insert
to authenticated
with check (
  auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
);

create policy "Only admin can update posts"
on public.posts
for update
to authenticated
using (
  auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
)
with check (
  auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
);

create policy "Only admin can delete posts"
on public.posts
for delete
to authenticated
using (
  auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
);
