-- ---------- Admins: an allowlist of emails that may use /admin ----------
create schema if not exists private;

create table public.admin_users (
  email      text primary key check (email = lower(email)),
  name       text,
  created_at timestamptz not null default now()
);
comment on table public.admin_users is 'Emails allowed into the website /admin. Anyone else who signs in sees nothing.';

insert into public.admin_users (email, name) values
  ('vmidhun@gmail.com', 'Midhun'),
  ('nanda.athani@gmail.com', 'Nanda');

-- True when the signed-in user's email is on the allowlist.
-- Lives in a non-exposed schema; security definer so it can read the allowlist under RLS.
create function private.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
create policy "Admins can see the admin list"
on public.admin_users for select to authenticated
using ((select private.is_admin()));

-- ---------- Leads: admins can read and work them ----------
grant select, update, delete on public.leads to authenticated;

create policy "Admins can read leads"
on public.leads for select to authenticated
using ((select private.is_admin()));

create policy "Admins can update leads"
on public.leads for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete leads"
on public.leads for delete to authenticated
using ((select private.is_admin()));

-- ---------- Subscriptions: customers paying for a product or service ----------
create type public.subscription_status as enum ('trial', 'active', 'past_due', 'cancelled', 'expired');
create type public.billing_cycle as enum ('monthly', 'quarterly', 'yearly', 'one_time');

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  customer        text not null check (char_length(btrim(customer)) between 1 and 200),
  contact_name    text,
  contact_email   text,
  contact_phone   text,

  product         text not null check (product in ('Qwait', 'Smrithi', 'LoveAll', 'Custom app', 'Video production')),
  plan            text,
  amount_inr      numeric(12,2) not null default 0 check (amount_inr >= 0),
  billing_cycle   public.billing_cycle not null default 'monthly',
  status          public.subscription_status not null default 'active',
  start_date      date not null default current_date,
  renewal_date    date,

  lead_id         uuid references public.leads(id) on delete set null,
  notes           text
);
comment on table public.subscriptions is 'Who pays Imagenie for what, and when it renews. Managed from /admin.';

create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_renewal_idx on public.subscriptions (renewal_date) where renewal_date is not null;
create index subscriptions_lead_idx on public.subscriptions (lead_id);

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;

create policy "Admins can read subscriptions"
on public.subscriptions for select to authenticated
using ((select private.is_admin()));
create policy "Admins can add subscriptions"
on public.subscriptions for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins can update subscriptions"
on public.subscriptions for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy "Admins can delete subscriptions"
on public.subscriptions for delete to authenticated
using ((select private.is_admin()));
