-- ---------- Business settings (single row) ----------
create table public.business_settings (
  id          boolean primary key default true check (id),
  legal_name  text not null default 'Imagenie Solutions',
  gstin       text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  state       text not null default 'Kerala',
  address     text,
  updated_at  timestamptz not null default now()
);
insert into public.business_settings (id) values (true);
comment on table public.business_settings is 'One row: business details for /admin finance. gstin stays null until registered.';

create trigger business_settings_set_updated_at before update on public.business_settings
for each row execute function public.set_updated_at();

-- ---------- Bills: things Imagenie pays for on a schedule ----------
create table public.recurring_expenses (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  vendor          text not null check (char_length(btrim(vendor)) between 1 and 200),
  plan            text,
  category        text not null default 'Software and subscriptions',
  amount          numeric(12,2) not null check (amount >= 0),          -- total incl. tax, in `currency`
  currency        text not null default 'INR' check (currency in ('INR','USD','EUR','GBP')),
  amount_inr      numeric(12,2) check (amount_inr is null or amount_inr >= 0), -- usual INR charge, for foreign currency
  gst_rate        numeric(5,2) not null default 18 check (gst_rate between 0 and 28),
  billing_cycle   public.billing_cycle not null default 'monthly',
  next_due_date   date,
  status          text not null default 'active' check (status in ('active','paused','cancelled')),
  payment_method  text check (payment_method is null or payment_method in ('UPI','Card','Bank transfer','Cash','Other')),
  notes           text
);
create index recurring_expenses_due_idx on public.recurring_expenses (next_due_date) where status = 'active';
create trigger recurring_expenses_set_updated_at before update on public.recurring_expenses
for each row execute function public.set_updated_at();

-- ---------- Transactions: the ledger of money in and out ----------
create type public.txn_kind as enum ('income', 'expense');
create type public.txn_status as enum ('paid', 'pending');

create table public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  kind                  public.txn_kind not null,
  txn_date              date not null default current_date,
  party                 text not null check (char_length(btrim(party)) between 1 and 200), -- vendor or customer
  description           text,
  category              text not null,
  amount                numeric(12,2) not null check (amount >= 0),        -- total incl. tax, in `currency`
  tax_amount            numeric(12,2) not null default 0 check (tax_amount >= 0 and tax_amount <= amount), -- GST part, in `currency`
  currency              text not null default 'INR' check (currency in ('INR','USD','EUR','GBP')),
  amount_inr            numeric(12,2) check (amount_inr is null or amount_inr >= 0), -- total in INR; null = not known yet
  invoice_number        text,
  payment_method        text check (payment_method is null or payment_method in ('UPI','Card','Bank transfer','Cash','Other')),
  status                public.txn_status not null default 'paid',
  subscription_id       uuid references public.subscriptions(id) on delete set null,
  recurring_expense_id  uuid references public.recurring_expenses(id) on delete set null,
  receipt_path          text,
  notes                 text,
  constraint inr_known_for_inr check (currency <> 'INR' or amount_inr = amount)
);
create index transactions_date_idx on public.transactions (txn_date desc);
create index transactions_subscription_idx on public.transactions (subscription_id);
create index transactions_recurring_idx on public.transactions (recurring_expense_id);
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

-- ---------- Admin-only access ----------
alter table public.business_settings enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.transactions enable row level security;
revoke all on public.business_settings, public.recurring_expenses, public.transactions from anon, authenticated;
grant select, update on public.business_settings to authenticated;
grant select, insert, update, delete on public.recurring_expenses, public.transactions to authenticated;

create policy "Admins read settings" on public.business_settings for select to authenticated using ((select private.is_admin()));
create policy "Admins update settings" on public.business_settings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Admins manage bills" on public.recurring_expenses for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage transactions" on public.transactions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------- Paid actions: record the payment and move the due date on ----------
create function public.next_cycle_date(d date, cycle public.billing_cycle) returns date
language sql immutable set search_path = '' as $$
  select case cycle
    when 'monthly' then (d + interval '1 month')::date
    when 'quarterly' then (d + interval '3 months')::date
    when 'yearly' then (d + interval '1 year')::date
    else null end;
$$;

-- Runs as the signed-in user, so row-level security still decides who may do it.
create function public.mark_bill_paid(p_bill_id uuid, p_paid_on date default current_date, p_amount_inr numeric default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  b public.recurring_expenses;
  inr numeric;
  new_id uuid;
begin
  select * into b from public.recurring_expenses where id = p_bill_id;
  if not found then raise exception 'Bill not found or not allowed'; end if;

  inr := case when b.currency = 'INR' then b.amount else coalesce(p_amount_inr, b.amount_inr) end;

  insert into public.transactions
    (kind, txn_date, party, description, category, amount, tax_amount, currency, amount_inr, payment_method, recurring_expense_id)
  values
    ('expense', p_paid_on, b.vendor, concat_ws(' ', b.plan, 'renewal'), b.category, b.amount,
     round(b.amount - b.amount / (1 + b.gst_rate / 100), 2), b.currency, inr, b.payment_method, b.id)
  returning id into new_id;

  update public.recurring_expenses
     set next_due_date = public.next_cycle_date(coalesce(next_due_date, p_paid_on), billing_cycle),
         status = case when billing_cycle = 'one_time' then 'cancelled' else status end,
         amount_inr = case when currency <> 'INR' and p_amount_inr is not null then p_amount_inr else amount_inr end
   where id = b.id;

  return new_id;
end;
$$;

create function public.mark_subscription_paid(p_subscription_id uuid, p_paid_on date default current_date)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  s public.subscriptions;
  new_id uuid;
begin
  select * into s from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'Subscription not found or not allowed'; end if;

  insert into public.transactions
    (kind, txn_date, party, description, category, amount, tax_amount, currency, amount_inr, subscription_id)
  values
    ('income', p_paid_on, s.customer, concat_ws(', ', s.product, s.plan),
     case s.product when 'Custom app' then 'Custom app project' when 'Video production' then 'Video production' else 'Product subscription' end,
     s.amount_inr, 0, 'INR', s.amount_inr, s.id)
  returning id into new_id;

  update public.subscriptions
     set renewal_date = public.next_cycle_date(coalesce(renewal_date, p_paid_on), billing_cycle),
         status = case when status in ('past_due', 'trial') then 'active'::public.subscription_status else status end
   where id = s.id;

  return new_id;
end;
$$;

revoke all on function public.mark_bill_paid(uuid, date, numeric), public.mark_subscription_paid(uuid, date) from public, anon;
grant execute on function public.mark_bill_paid(uuid, date, numeric), public.mark_subscription_paid(uuid, date) to authenticated;

-- ---------- Private receipt storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/png','image/jpeg','image/webp','image/gif','application/pdf']);

create policy "Admins read receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (select private.is_admin()));
create policy "Admins upload receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (select private.is_admin()));
create policy "Admins delete receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (select private.is_admin()));
