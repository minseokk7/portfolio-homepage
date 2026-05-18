-- Run this in Supabase SQL Editor.
-- Replace the email below with the Supabase Auth user that will manage notices.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author text not null,
  image_url text,
  image_path text,
  created_at timestamptz not null default now()
);

alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists image_path text;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notice-images',
  'notice-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read notice images" on storage.objects;
drop policy if exists "Only admin can upload notice images" on storage.objects;
drop policy if exists "Only admin can update notice images" on storage.objects;
drop policy if exists "Only admin can delete notice images" on storage.objects;

create policy "Public can read notice images"
on storage.objects
for select
to public
using (bucket_id = 'notice-images');

create policy "Only admin can upload notice images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'notice-images'
  and auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
);

create policy "Only admin can update notice images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'notice-images'
  and auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
)
with check (
  bucket_id = 'notice-images'
  and auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
);

create policy "Only admin can delete notice images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'notice-images'
  and auth.jwt() ->> 'email' = '<ADMIN_EMAIL>'
);
