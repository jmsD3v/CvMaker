-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  linkedin text,
  github text,
  location text
);
alter table public.profiles enable row level security;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id);

-- experience
create table public.experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  company text not null,
  location text,
  start_date date not null,
  end_date date,
  description text,
  highlights text[] default '{}'
);
alter table public.experience enable row level security;
create policy "Users manage own experience" on public.experience
  for all using (auth.uid() = user_id);

-- education
create table public.education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  degree text not null,
  institution text not null,
  status text not null default 'in_progress',
  start_year int,
  end_year int
);
alter table public.education enable row level security;
create policy "Users manage own education" on public.education
  for all using (auth.uid() = user_id);

-- certifications
create table public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  issuer text not null,
  issued_date date,
  category text not null default 'other',
  file_url text,
  file_type text,
  raw_text text,
  created_at timestamp with time zone default now()
);
alter table public.certifications enable row level security;
create policy "Users manage own certifications" on public.certifications
  for all using (auth.uid() = user_id);

-- trigger: auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, email)
  values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
