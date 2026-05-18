create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author text not null,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists "Anyone can read posts" on public.posts;
create policy "Anyone can read posts"
on public.posts
for select
to public
using (true);

drop policy if exists "Anyone can create posts" on public.posts;
drop policy if exists "Anyone can delete posts" on public.posts;
drop policy if exists "Anyone can update posts" on public.posts;
drop policy if exists "Only admin can insert posts" on public.posts;
drop policy if exists "Only admin can update posts" on public.posts;
drop policy if exists "Only admin can delete posts" on public.posts;

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

do $$
begin
  alter publication supabase_realtime add table public.posts;
exception
  when duplicate_object then null;
end $$;
