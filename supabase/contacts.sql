create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  source text not null default 'website',
  created_at timestamptz not null default now(),
  constraint contacts_name_length check (char_length(trim(name)) between 1 and 80),
  constraint contacts_email_length check (char_length(trim(email)) between 3 and 160),
  constraint contacts_email_shape check (position('@' in email) > 1),
  constraint contacts_message_length check (char_length(trim(message)) between 1 and 2000),
  constraint contacts_source_length check (char_length(trim(source)) between 1 and 80)
);

create index if not exists contacts_created_at_idx on public.contacts (created_at desc);

alter table public.contacts enable row level security;

drop policy if exists "Anyone can create contact messages" on public.contacts;
drop policy if exists "Only admin can read contact messages" on public.contacts;
drop policy if exists "Only admin can delete contact messages" on public.contacts;

create policy "Anyone can create contact messages"
on public.contacts
for insert
to anon, authenticated
with check (true);

create policy "Only admin can read contact messages"
on public.contacts
for select
to authenticated
using (auth.jwt() ->> 'email' = '<ADMIN_EMAIL>');

create policy "Only admin can delete contact messages"
on public.contacts
for delete
to authenticated
using (auth.jwt() ->> 'email' = '<ADMIN_EMAIL>');
