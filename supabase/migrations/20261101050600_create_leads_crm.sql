-- Website enquiries, worked through as a simple CRM pipeline.
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'won', 'lost');

create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- From the website form
  interest      text not null check (interest in ('A Labs product', 'A custom app', 'Video production')),
  name          text not null check (char_length(btrim(name)) between 1 and 200),
  organisation  text check (organisation is null or char_length(organisation) <= 200),
  email         text not null check (char_length(email) <= 320 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  phone         text check (phone is null or char_length(phone) <= 40),
  message       text check (message is null or char_length(message) <= 5000),
  source        text not null default 'website' check (char_length(source) <= 50),

  -- Worked by the Imagenie team
  status        public.lead_status not null default 'new',
  assigned_to   text,
  follow_up_on  date,
  notes         text
);

comment on table public.leads is 'Enquiries from the Imagenie website contact form. Team works them from the Supabase dashboard.';

create index leads_status_created_idx on public.leads (status, created_at desc);
create index leads_follow_up_idx on public.leads (follow_up_on) where follow_up_on is not null;

-- Keep updated_at current when the team edits a lead
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- Security: the public site may only INSERT the form fields. No reads, updates or deletes.
alter table public.leads enable row level security;

revoke all on public.leads from anon, authenticated;
grant insert (interest, name, organisation, email, phone, message, source) on public.leads to anon;

create policy "Website visitors can submit an enquiry"
on public.leads
for insert
to anon
with check (
  status = 'new'
  and assigned_to is null
  and follow_up_on is null
  and notes is null
  and source = 'website'
);
