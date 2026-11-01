-- =====================================================================
-- Double-entry ledger for Imagenie Solutions (proprietorship).
-- Books start 1 November 2026. Replaces the single-entry `transactions`.
-- Every money movement is a journal entry whose lines must balance
-- (total debits = total credits); the database enforces this.
-- =====================================================================

-- ---------- Settings ----------
alter table public.business_settings
  add column books_start_date date not null default '2026-11-01',
  add column business_type    text not null default 'proprietorship'
    check (business_type in ('proprietorship', 'partnership', 'llp', 'company')),
  add column owner_name       text;

-- ---------- Chart of accounts ----------
create type public.account_type as enum ('asset', 'liability', 'equity', 'income', 'expense');
create type public.account_kind as enum (
  'bank', 'cash', 'credit_card',            -- money accounts
  'receivable', 'payable', 'tds_receivable',
  'gst_input', 'gst_output',
  'capital', 'drawings',
  'income', 'expense', 'other'
);

create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  code          text not null unique check (code ~ '^[0-9]{4}$'),
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  type          public.account_type not null,
  kind          public.account_kind not null,
  is_system     boolean not null default false,   -- used by posting rules; can't be removed
  is_active     boolean not null default true,
  bank_name     text,
  last4         text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  description   text,
  constraint accounts_name_unique unique (name),
  constraint kind_fits_type check (
    (kind in ('bank','cash','receivable','tds_receivable','gst_input') and type = 'asset') or
    (kind in ('credit_card','payable','gst_output') and type = 'liability') or
    (kind in ('capital','drawings') and type = 'equity') or
    (kind = 'income' and type = 'income') or
    (kind = 'expense' and type = 'expense') or
    (kind = 'other')
  )
);
create trigger accounts_set_updated_at before update on public.accounts
for each row execute function public.set_updated_at();

insert into public.accounts (code, name, type, kind, is_system, description) values
  ('1000', 'Cash in hand',                'asset',     'cash',           false, null),
  ('1100', 'Bank account',                'asset',     'bank',           false, 'Rename to your bank, e.g. "HDFC current account".'),
  ('1200', 'Customers owe us',            'asset',     'receivable',     true,  'Invoiced but not yet paid (accounts receivable).'),
  ('1300', 'TDS deducted by customers',   'asset',     'tds_receivable', true,  'Tax customers deducted at source; claim it in your income tax return.'),
  ('1400', 'Input CGST',                  'asset',     'gst_input',      true,  'GST paid on purchases, claimable once registered.'),
  ('1401', 'Input SGST',                  'asset',     'gst_input',      true,  null),
  ('1402', 'Input IGST',                  'asset',     'gst_input',      true,  null),
  ('2000', 'We owe vendors',              'liability', 'payable',        true,  'Bills received but not yet paid (accounts payable).'),
  ('2100', 'Mastercard credit card',      'liability', 'credit_card',    false, 'Balance is what you owe the card.'),
  ('2200', 'Output CGST',                 'liability', 'gst_output',     true,  'GST charged on invoices, owed to the government.'),
  ('2201', 'Output SGST',                 'liability', 'gst_output',     true,  null),
  ('2202', 'Output IGST',                 'liability', 'gst_output',     true,  null),
  ('3000', 'Owner''s capital',            'equity',    'capital',        true,  'Money the owner put into the business, plus opening balances.'),
  ('3100', 'Owner''s drawings',           'equity',    'drawings',       true,  'Money the owner took out for personal use.'),
  ('4010', 'Qwait income',                'income',    'income',         true,  null),
  ('4020', 'Smrithi income',              'income',    'income',         true,  null),
  ('4030', 'LoveAll income',              'income',    'income',         true,  null),
  ('4100', 'Custom app projects',         'income',    'income',         true,  null),
  ('4200', 'Video production',            'income',    'income',         true,  null),
  ('4900', 'Other income',                'income',    'income',         true,  null),
  ('4910', 'Interest received',           'income',    'income',         false, null),
  ('5010', 'Software and subscriptions',  'expense',   'expense',        false, null),
  ('5020', 'Hosting and domains',         'expense',   'expense',        false, null),
  ('5030', 'Equipment',                   'expense',   'expense',        false, 'Small equipment. Ask your accountant about larger purchases (assets).'),
  ('5040', 'Travel',                      'expense',   'expense',        false, null),
  ('5050', 'Marketing',                   'expense',   'expense',        false, null),
  ('5060', 'Salaries and contractors',    'expense',   'expense',        false, null),
  ('5070', 'Rent and utilities',          'expense',   'expense',        false, null),
  ('5080', 'Professional fees',           'expense',   'expense',        false, null),
  ('5090', 'Bank and card charges',       'expense',   'expense',        false, null),
  ('5900', 'Other expenses',              'expense',   'expense',        true,  null);
update public.accounts set last4 = '8414' where code = '2100';

-- Look up an account id by its code (codes of system accounts never change).
create function private.acct(p_code text) returns uuid
language sql stable set search_path = '' as $$
  select id from public.accounts where code = p_code;
$$;
grant execute on function private.acct(text) to authenticated;

-- ---------- Contacts: customers and vendors ----------
create type public.party_role as enum ('customer', 'vendor', 'both');

create table public.parties (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  role        public.party_role not null default 'customer',
  contact_person text,
  email       text,
  phone       text,
  address     text,
  gstin       text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  state       text,
  notes       text
);
create unique index parties_name_unique on public.parties (lower(btrim(name)));
create trigger parties_set_updated_at before update on public.parties
for each row execute function public.set_updated_at();

alter table public.leads          add column party_id uuid references public.parties(id) on delete set null;
alter table public.subscriptions  add column party_id uuid references public.parties(id) on delete set null;
alter table public.documents      add column party_id uuid references public.parties(id) on delete set null;
create index leads_party_idx on public.leads (party_id);
create index subscriptions_party_idx on public.subscriptions (party_id);
create index documents_party_idx on public.documents (party_id);

alter table public.document_items add column income_account_id uuid references public.accounts(id) on delete restrict;
create index document_items_account_idx on public.document_items (income_account_id);

-- ---------- Bills: link to vendor, expense account and the account that pays ----------
alter table public.recurring_expenses
  add column party_id            uuid references public.parties(id) on delete set null,
  add column expense_account_id  uuid references public.accounts(id) on delete restrict,
  add column pay_from_account_id uuid references public.accounts(id) on delete set null;
create index recurring_expenses_party_idx on public.recurring_expenses (party_id);
create index recurring_expenses_expense_acct_idx on public.recurring_expenses (expense_account_id);
create index recurring_expenses_pay_from_idx on public.recurring_expenses (pay_from_account_id);

-- Move the existing bill over: Anthropic becomes a vendor; Claude Pro is software, paid by card.
insert into public.parties (name, role, state, notes)
select distinct vendor, 'vendor'::public.party_role, 'Outside India', 'Added from Bills.' from public.recurring_expenses;
update public.recurring_expenses r
   set party_id = p.id,
       expense_account_id = coalesce(
         (select a.id from public.accounts a where a.kind = 'expense' and lower(a.name) = lower(r.category)),
         case when r.category = 'Bank charges' then private.acct('5090') else private.acct('5900') end),
       pay_from_account_id = private.acct('2100')
  from public.parties p
 where lower(p.name) = lower(r.vendor);
update public.recurring_expenses set expense_account_id = private.acct('5010') where expense_account_id is null;
alter table public.recurring_expenses alter column expense_account_id set not null;
alter table public.recurring_expenses drop column category, drop column payment_method;

-- ---------- Retire single-entry transactions ----------
drop function public.mark_bill_paid(uuid, date, numeric);
drop function public.mark_subscription_paid(uuid, date);
drop function public.mark_invoice_paid(uuid, date, text, text);
alter table public.documents drop column transaction_id;
drop table public.transactions;
drop type public.txn_status;
drop type public.txn_kind;

-- ---------- Journal ----------
create type public.entry_source as enum (
  'manual', 'opening', 'money_in', 'money_out', 'transfer',
  'invoice', 'invoice_payment', 'bill_payment'
);

create table public.journal_entries (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            text default (auth.jwt() ->> 'email'),
  entry_no              int generated always as identity unique,
  entry_date            date not null,
  memo                  text not null check (char_length(btrim(memo)) between 1 and 300),
  source                public.entry_source not null default 'manual',
  party_id              uuid references public.parties(id) on delete set null,
  reference             text,                      -- vendor invoice no., UTR, cheque no.
  receipt_path          text,
  currency              text not null default 'INR' check (currency in ('INR','USD','EUR','GBP')),
  foreign_amount        numeric(14,2),             -- original amount when paid in another currency
  gst_amount            numeric(14,2) not null default 0, -- GST on this entry, for reference and reports
  document_id           uuid references public.documents(id) on delete restrict,
  recurring_expense_id  uuid references public.recurring_expenses(id) on delete set null,
  subscription_id       uuid references public.subscriptions(id) on delete set null
);
create index journal_entries_date_idx on public.journal_entries (entry_date desc, entry_no desc);
create index journal_entries_document_idx on public.journal_entries (document_id);
create index journal_entries_party_idx on public.journal_entries (party_id);
create index journal_entries_bill_idx on public.journal_entries (recurring_expense_id);
create index journal_entries_subscription_idx on public.journal_entries (subscription_id);
create trigger journal_entries_set_updated_at before update on public.journal_entries
for each row execute function public.set_updated_at();

create table public.journal_lines (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.journal_entries(id) on delete cascade,
  account_id   uuid not null references public.accounts(id) on delete restrict,
  debit        numeric(14,2) not null default 0 check (debit >= 0),
  credit       numeric(14,2) not null default 0 check (credit >= 0),
  party_id     uuid references public.parties(id) on delete set null,
  description  text,
  constraint one_sided check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_account_idx on public.journal_lines (account_id);
create index journal_lines_party_idx on public.journal_lines (party_id);

-- Every entry must have at least two lines and balance, checked at commit
-- so an entry and its lines can be written in one transaction in any order.
create function private.check_entry_balanced() returns trigger
language plpgsql set search_path = '' as $$
declare
  eid uuid;
  dr numeric;
  cr numeric;
  n int;
begin
  if tg_table_name = 'journal_entries' then eid := new.id;
  else eid := coalesce(new.entry_id, old.entry_id);
  end if;
  if not exists (select 1 from public.journal_entries where id = eid) then return null; end if;
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*) into dr, cr, n
    from public.journal_lines where entry_id = eid;
  if n < 2 then raise exception 'A journal entry needs at least two lines.'; end if;
  if dr <> cr then raise exception 'This entry doesn''t balance: debits ₹% but credits ₹%.', dr, cr; end if;
  return null;
end;
$$;
create constraint trigger journal_lines_balanced
after insert or update or delete on public.journal_lines
deferrable initially deferred for each row execute function private.check_entry_balanced();
create constraint trigger journal_entries_balanced
after insert on public.journal_entries
deferrable initially deferred for each row execute function private.check_entry_balanced();

-- ---------- Access: admins only; invoice postings are changed only by cancelling ----------
alter table public.accounts enable row level security;
alter table public.parties enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
revoke all on public.accounts, public.parties, public.journal_entries, public.journal_lines from anon, authenticated;
grant select, insert, update, delete on public.accounts, public.parties, public.journal_entries, public.journal_lines to authenticated;

create policy "Admins read accounts" on public.accounts for select to authenticated using ((select private.is_admin()));
create policy "Admins add accounts" on public.accounts for insert to authenticated with check ((select private.is_admin()));
create policy "Admins edit accounts" on public.accounts for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins remove own accounts" on public.accounts for delete to authenticated
  using ((select private.is_admin()) and not is_system);

create policy "Admins manage contacts" on public.parties for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Admins read entries" on public.journal_entries for select to authenticated using ((select private.is_admin()));
create policy "Admins add entries" on public.journal_entries for insert to authenticated with check ((select private.is_admin()));
create policy "Admins edit entries" on public.journal_entries for update to authenticated
  using ((select private.is_admin()) and source <> 'invoice') with check ((select private.is_admin()) and source <> 'invoice');
create policy "Admins delete entries" on public.journal_entries for delete to authenticated
  using ((select private.is_admin()) and source <> 'invoice');

create policy "Admins read lines" on public.journal_lines for select to authenticated using ((select private.is_admin()));
create policy "Admins add lines" on public.journal_lines for insert to authenticated with check ((select private.is_admin()));
create policy "Admins edit lines" on public.journal_lines for update to authenticated
  using ((select private.is_admin()) and exists (select 1 from public.journal_entries e where e.id = entry_id and e.source <> 'invoice'))
  with check ((select private.is_admin()));
create policy "Admins delete lines" on public.journal_lines for delete to authenticated
  using ((select private.is_admin()) and exists (select 1 from public.journal_entries e where e.id = entry_id and e.source <> 'invoice'));

-- ---------- Posting ----------
-- Post (or, with p_entry_id, replace) an entry from JSON:
-- { entry_date, memo, source, party_id, reference, receipt_path, currency, foreign_amount, gst_amount,
--   document_id, recurring_expense_id, subscription_id, lines: [{ account_id, debit, credit, party_id, description }] }
create function public.save_journal_entry(p jsonb, p_entry_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  eid uuid := p_entry_id;
  start date;
  d date := (p ->> 'entry_date')::date;
  src public.entry_source := coalesce(nullif(p ->> 'source', ''), 'manual')::public.entry_source;
  ln jsonb;
  dr numeric;
  cr numeric;
begin
  if d is null then raise exception 'Choose a date.'; end if;
  select books_start_date into start from public.business_settings limit 1;
  if src <> 'opening' and d < start then
    raise exception 'Entries can''t be dated before the books start on %.', to_char(start, 'DD Mon YYYY');
  end if;
  if src in ('invoice', 'invoice_payment') and p_entry_id is null and coalesce(p ->> 'via', '') <> 'posting_rule' then
    raise exception 'Invoice entries are made from the invoice itself.';
  end if;

  if eid is null then
    insert into public.journal_entries
      (entry_date, memo, source, party_id, reference, receipt_path, currency, foreign_amount, gst_amount,
       document_id, recurring_expense_id, subscription_id)
    values
      (d, coalesce(nullif(btrim(p ->> 'memo'), ''), 'Entry'), src, nullif(p ->> 'party_id', '')::uuid,
       nullif(btrim(p ->> 'reference'), ''), nullif(p ->> 'receipt_path', ''),
       coalesce(nullif(p ->> 'currency', ''), 'INR'), nullif(p ->> 'foreign_amount', '')::numeric,
       coalesce(nullif(p ->> 'gst_amount', '')::numeric, 0),
       nullif(p ->> 'document_id', '')::uuid, nullif(p ->> 'recurring_expense_id', '')::uuid, nullif(p ->> 'subscription_id', '')::uuid)
    returning id into eid;
  else
    update public.journal_entries set
      entry_date = d,
      memo = coalesce(nullif(btrim(p ->> 'memo'), ''), memo),
      party_id = nullif(p ->> 'party_id', '')::uuid,
      reference = nullif(btrim(p ->> 'reference'), ''),
      receipt_path = nullif(p ->> 'receipt_path', ''),
      currency = coalesce(nullif(p ->> 'currency', ''), 'INR'),
      foreign_amount = nullif(p ->> 'foreign_amount', '')::numeric,
      gst_amount = coalesce(nullif(p ->> 'gst_amount', '')::numeric, 0)
    where id = eid and source not in ('invoice', 'invoice_payment');
    if not found then raise exception 'This entry can''t be edited here. Invoice entries are changed from the invoice.'; end if;
    delete from public.journal_lines where entry_id = eid;
  end if;

  for ln in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]'::jsonb)) loop
    dr := round(coalesce(nullif(ln ->> 'debit', '')::numeric, 0), 2);
    cr := round(coalesce(nullif(ln ->> 'credit', '')::numeric, 0), 2);
    if dr = 0 and cr = 0 then continue; end if;
    if dr > 0 and cr > 0 then
      -- one amount per line: net it
      if dr > cr then dr := dr - cr; cr := 0; else cr := cr - dr; dr := 0; end if;
      if dr = 0 and cr = 0 then continue; end if;
    end if;
    insert into public.journal_lines (entry_id, account_id, debit, credit, party_id, description)
    values (eid, (ln ->> 'account_id')::uuid, dr, cr,
            coalesce(nullif(ln ->> 'party_id', '')::uuid, nullif(p ->> 'party_id', '')::uuid),
            nullif(btrim(ln ->> 'description'), ''));
  end loop;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into dr, cr from public.journal_lines where entry_id = eid;
  if dr = 0 then raise exception 'Enter an amount.'; end if;
  if dr <> cr then raise exception 'This entry doesn''t balance: debits ₹% but credits ₹%.', dr, cr; end if;
  return eid;
end;
$$;

-- GST split helper: CGST+SGST when supplier and customer are in the same state, IGST otherwise.
create function private.gst_lines(p_tax numeric, p_same_state boolean, p_cgst text, p_sgst text, p_igst text)
returns table (account_id uuid, amount numeric)
language sql stable set search_path = '' as $$
  select private.acct(p_cgst), round(p_tax / 2, 2) where p_tax > 0 and p_same_state
  union all
  select private.acct(p_sgst), p_tax - round(p_tax / 2, 2) where p_tax > 0 and p_same_state
  union all
  select private.acct(p_igst), p_tax where p_tax > 0 and not p_same_state;
$$;
grant execute on function private.gst_lines(numeric, boolean, text, text, text) to authenticated;

-- ---------- Invoices ----------
create view public.invoice_balances with (security_invoker = true) as
select d.id as document_id,
       d.total,
       coalesce(sum(l.credit), 0)::numeric(14,2) as paid,
       (d.total - coalesce(sum(l.credit), 0))::numeric(14,2) as balance
  from public.documents d
  left join public.journal_entries e on e.document_id = d.id and e.source = 'invoice_payment'
  left join public.journal_lines l on l.entry_id = e.id and l.account_id = private.acct('1200')
 where d.kind = 'invoice'
 group by d.id, d.total;
grant select on public.invoice_balances to authenticated;

-- Issue an invoice: number it and post Dr Customers owe us / Cr income and output GST.
create function public.issue_invoice(p_invoice_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.documents;
  s public.business_settings;
  eid uuid;
  diff numeric;
  same boolean;
  g record;
begin
  select * into s from public.business_settings limit 1;
  update public.documents set status = 'sent'
   where id = p_invoice_id and kind = 'invoice' and status = 'draft'
  returning * into inv;
  if not found then raise exception 'Invoice not found, or already issued.'; end if;
  if inv.issue_date < s.books_start_date then
    raise exception 'The invoice date is before the books start on %.', to_char(s.books_start_date, 'DD Mon YYYY');
  end if;
  if not exists (select 1 from public.document_items where document_id = inv.id) then raise exception 'Add at least one item.'; end if;
  if inv.total <= 0 then raise exception 'The invoice total must be more than zero.'; end if;
  if inv.tax_total > 0 and s.gstin is null then raise exception 'GST can''t be charged until a GSTIN is set in Settings.'; end if;

  insert into public.journal_entries (entry_date, memo, source, party_id, reference, gst_amount, document_id, subscription_id)
  values (inv.issue_date, 'Invoice ' || inv.number || ' to ' || inv.customer_name, 'invoice', inv.party_id, inv.number,
          inv.tax_total, inv.id, inv.subscription_id)
  returning id into eid;

  insert into public.journal_lines (entry_id, account_id, debit, party_id, description)
  values (eid, private.acct('1200'), inv.total, inv.party_id, 'Invoice ' || inv.number);

  insert into public.journal_lines (entry_id, account_id, credit, party_id)
  select eid, coalesce(income_account_id, private.acct('4900')), round(sum(quantity * unit_price), 2), inv.party_id
    from public.document_items where document_id = inv.id
   group by coalesce(income_account_id, private.acct('4900'))
  having round(sum(quantity * unit_price), 2) > 0;

  -- Rounding: make income lines add up exactly to the invoice subtotal.
  select inv.subtotal - coalesce(sum(credit), 0) into diff from public.journal_lines where entry_id = eid and credit > 0;
  if diff <> 0 then
    update public.journal_lines set credit = credit + diff
     where id = (select id from public.journal_lines where entry_id = eid and credit > 0 order by credit desc limit 1);
  end if;

  same := lower(coalesce(nullif(inv.customer_state, ''), s.state)) = lower(s.state);
  for g in select * from private.gst_lines(inv.tax_total, same, '2200', '2201', '2202') loop
    insert into public.journal_lines (entry_id, account_id, credit, party_id) values (eid, g.account_id, g.amount, inv.party_id);
  end loop;

  return eid;
end;
$$;

-- Record a payment against an issued invoice. Part payments allowed; TDS optional.
create function public.record_invoice_payment(
  p_invoice_id uuid, p_paid_on date, p_into_account_id uuid, p_amount numeric,
  p_tds numeric default 0, p_reference text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.documents;
  bal numeric;
  acc public.accounts;
  eid uuid;
begin
  select * into inv from public.documents where id = p_invoice_id and kind = 'invoice';
  if not found then raise exception 'Invoice not found.'; end if;
  if inv.status <> 'sent' then raise exception 'Only issued, unpaid invoices can take a payment.'; end if;
  select balance into bal from public.invoice_balances where document_id = inv.id;
  p_amount := round(coalesce(p_amount, 0), 2);
  p_tds := round(coalesce(p_tds, 0), 2);
  if p_amount < 0 or p_tds < 0 or p_amount + p_tds <= 0 then raise exception 'Enter the amount received.'; end if;
  if p_amount + p_tds > bal then raise exception 'That''s more than the ₹% still due.', bal; end if;
  select * into acc from public.accounts where id = p_into_account_id;
  if not found or acc.kind not in ('bank', 'cash') then raise exception 'Choose the bank or cash account the money went into.'; end if;

  insert into public.journal_entries (entry_date, memo, source, party_id, reference, document_id, subscription_id)
  values (p_paid_on, 'Payment for ' || inv.number || ' from ' || inv.customer_name, 'invoice_payment', inv.party_id,
          nullif(btrim(p_reference), ''), inv.id, inv.subscription_id)
  returning id into eid;

  if p_amount > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, party_id) values (eid, acc.id, p_amount, inv.party_id);
  end if;
  if p_tds > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, party_id, description)
    values (eid, private.acct('1300'), p_tds, inv.party_id, 'TDS on ' || inv.number);
  end if;
  insert into public.journal_lines (entry_id, account_id, credit, party_id, description)
  values (eid, private.acct('1200'), p_amount + p_tds, inv.party_id, inv.number);

  if p_amount + p_tds = bal then
    update public.documents set status = 'paid' where id = inv.id;
  end if;
  return eid;
end;
$$;

-- Deleting a payment reopens a paid invoice.
create function private.reopen_invoice_after_payment_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.source = 'invoice_payment' and old.document_id is not null then
    update public.documents set status = 'sent' where id = old.document_id and status = 'paid';
  end if;
  return null;
end;
$$;
create trigger journal_entries_reopen_invoice after delete on public.journal_entries
for each row execute function private.reopen_invoice_after_payment_delete();

-- Cancel an issued invoice: posts a reversing entry, keeps the number.
create function public.cancel_invoice(p_invoice_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.documents;
  orig uuid;
  eid uuid;
  start date;
begin
  select * into inv from public.documents where id = p_invoice_id and kind = 'invoice';
  if not found then raise exception 'Invoice not found.'; end if;
  if inv.status <> 'sent' then raise exception 'Only issued, unpaid invoices can be cancelled.'; end if;
  if exists (select 1 from public.journal_entries where document_id = inv.id and source = 'invoice_payment') then
    raise exception 'This invoice has payments recorded. Delete them first.';
  end if;
  select books_start_date into start from public.business_settings limit 1;
  select id into orig from public.journal_entries where document_id = inv.id and source = 'invoice' order by created_at limit 1;

  if orig is not null then
    insert into public.journal_entries (entry_date, memo, source, party_id, reference, gst_amount, document_id)
    values (greatest(current_date, start), 'Cancelled invoice ' || inv.number, 'invoice', inv.party_id, inv.number,
            -inv.tax_total, inv.id)
    returning id into eid;
    insert into public.journal_lines (entry_id, account_id, debit, credit, party_id, description)
    select eid, account_id, credit, debit, party_id, 'Reversal' from public.journal_lines where entry_id = orig;
  end if;
  update public.documents set status = 'cancelled' where id = inv.id;
end;
$$;

create or replace function public.convert_quotation_to_invoice(p_quotation_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  q public.documents;
  terms text;
  new_id uuid;
begin
  select * into q from public.documents where id = p_quotation_id and kind = 'quotation';
  if not found then raise exception 'Quotation not found or not allowed'; end if;
  select invoice_terms into terms from public.business_settings limit 1;

  insert into public.documents
    (kind, status, issue_date, due_date, customer_name, customer_address, customer_email, customer_phone,
     customer_gstin, customer_state, notes, terms, quotation_id, subscription_id, lead_id, party_id)
  values
    ('invoice', 'draft', current_date, current_date + 15, q.customer_name, q.customer_address, q.customer_email,
     q.customer_phone, q.customer_gstin, q.customer_state, q.notes, terms, q.id, q.subscription_id, q.lead_id, q.party_id)
  returning id into new_id;

  insert into public.document_items (document_id, position, description, hsn_sac, quantity, unit, unit_price, gst_rate, income_account_id)
  select new_id, position, description, hsn_sac, quantity, unit, unit_price, gst_rate, income_account_id
    from public.document_items where document_id = q.id;

  update public.documents set status = 'accepted' where id = q.id and status in ('draft','sent');
  return new_id;
end;
$$;

-- ---------- Bills ----------
-- Pay a bill: Dr expense (and input GST if registered) / Cr the account that paid. Moves the due date on.
create function public.pay_bill(
  p_bill_id uuid, p_paid_on date, p_from_account_id uuid, p_amount_inr numeric,
  p_gst_inr numeric default null, p_reference text default null, p_receipt_path text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  b public.recurring_expenses;
  s public.business_settings;
  vendor public.parties;
  acc public.accounts;
  gst numeric;
  claim boolean;
  eid uuid;
  g record;
begin
  select * into b from public.recurring_expenses where id = p_bill_id;
  if not found then raise exception 'Bill not found.'; end if;
  select * into s from public.business_settings limit 1;
  select * into acc from public.accounts where id = p_from_account_id;
  if not found or acc.kind not in ('bank', 'cash', 'credit_card') then raise exception 'Choose the account that paid.'; end if;
  p_amount_inr := round(coalesce(p_amount_inr, 0), 2);
  if p_amount_inr <= 0 then raise exception 'Enter the amount paid in rupees.'; end if;
  gst := round(coalesce(p_gst_inr, p_amount_inr - p_amount_inr / (1 + b.gst_rate / 100)), 2);
  if gst < 0 or gst > p_amount_inr then raise exception 'GST can''t be more than the amount paid.'; end if;
  claim := s.gstin is not null and gst > 0;   -- unregistered businesses can't claim input GST: it stays part of the cost
  select * into vendor from public.parties where id = b.party_id;

  insert into public.journal_entries
    (entry_date, memo, source, party_id, reference, receipt_path, currency, foreign_amount, gst_amount, recurring_expense_id)
  values
    (p_paid_on, b.vendor || coalesce(', ' || b.plan, ''), 'bill_payment', b.party_id, nullif(btrim(p_reference), ''),
     p_receipt_path, b.currency, case when b.currency <> 'INR' then b.amount end, gst, b.id)
  returning id into eid;

  insert into public.journal_lines (entry_id, account_id, debit, party_id)
  values (eid, b.expense_account_id, case when claim then p_amount_inr - gst else p_amount_inr end, b.party_id);
  if claim then
    for g in select * from private.gst_lines(gst, lower(coalesce(vendor.state, s.state)) = lower(s.state), '1400', '1401', '1402') loop
      insert into public.journal_lines (entry_id, account_id, debit, party_id) values (eid, g.account_id, g.amount, b.party_id);
    end loop;
  end if;
  insert into public.journal_lines (entry_id, account_id, credit, party_id) values (eid, acc.id, p_amount_inr, b.party_id);

  update public.recurring_expenses
     set next_due_date = public.next_cycle_date(coalesce(next_due_date, p_paid_on), billing_cycle),
         status = case when billing_cycle = 'one_time' then 'cancelled' else status end,
         amount_inr = case when currency <> 'INR' then p_amount_inr else amount_inr end,
         pay_from_account_id = acc.id
   where id = b.id;
  return eid;
end;
$$;

-- ---------- Customer subscriptions ----------
-- Bill a subscription: creates and issues an invoice; with an account, also records it as paid.
create function public.bill_subscription(p_subscription_id uuid, p_date date default current_date, p_paid_into uuid default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  sub public.subscriptions;
  s public.business_settings;
  p public.parties;
  doc uuid;
  inv public.documents;
begin
  select * into sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'Subscription not found.'; end if;
  if sub.amount_inr <= 0 then raise exception 'Set the subscription amount first.'; end if;
  select * into s from public.business_settings limit 1;
  select * into p from public.parties where id = sub.party_id;

  insert into public.documents (kind, issue_date, due_date, customer_name, customer_email, customer_phone, customer_address,
                                customer_gstin, customer_state, terms, subscription_id, party_id)
  values ('invoice', p_date, p_date, sub.customer, coalesce(p.email, sub.contact_email), coalesce(p.phone, sub.contact_phone),
          p.address, p.gstin, coalesce(p.state, s.state), s.invoice_terms, sub.id, sub.party_id)
  returning id into doc;

  insert into public.document_items (document_id, position, description, quantity, unit, unit_price, gst_rate, income_account_id)
  values (doc, 0,
          concat_ws(', ', sub.product, sub.plan) || case when sub.renewal_date is not null and sub.billing_cycle <> 'one_time'
            then ', ' || to_char(coalesce(sub.renewal_date, p_date), 'DD Mon YYYY') || ' to '
                 || to_char(public.next_cycle_date(coalesce(sub.renewal_date, p_date), sub.billing_cycle) - 1, 'DD Mon YYYY')
            else '' end,
          1, case sub.billing_cycle when 'monthly' then 'month' when 'quarterly' then 'quarter' when 'yearly' then 'year' else null end,
          sub.amount_inr, case when s.gstin is not null then 18 else 0 end,
          private.acct(case sub.product when 'Qwait' then '4010' when 'Smrithi' then '4020' when 'LoveAll' then '4030'
                                        when 'Custom app' then '4100' when 'Video production' then '4200' else '4900' end));

  perform public.issue_invoice(doc);
  if p_paid_into is not null then
    select * into inv from public.documents where id = doc;
    perform public.record_invoice_payment(doc, p_date, p_paid_into, inv.total);
  end if;

  update public.subscriptions
     set renewal_date = public.next_cycle_date(coalesce(renewal_date, p_date), billing_cycle),
         status = case when status in ('past_due', 'trial') then 'active'::public.subscription_status else status end
   where id = sub.id;
  return doc;
end;
$$;

-- ---------- Opening balances ----------
-- p_balances: [{ account_id, amount }]. For assets the amount is what you have; for a credit card,
-- what you owe. The difference goes to Owner's capital. Replaces any earlier opening entry.
create function public.set_opening_balances(p_balances jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  start date;
  eid uuid;
  item jsonb;
  acc public.accounts;
  amt numeric;
  dr numeric;
  cr numeric;
begin
  select books_start_date into start from public.business_settings limit 1;
  delete from public.journal_entries where source = 'opening';
  insert into public.journal_entries (entry_date, memo, source) values (start, 'Opening balances', 'opening') returning id into eid;

  for item in select * from jsonb_array_elements(coalesce(p_balances, '[]'::jsonb)) loop
    amt := round(coalesce(nullif(item ->> 'amount', '')::numeric, 0), 2);
    if amt = 0 then continue; end if;
    select * into acc from public.accounts where id = (item ->> 'account_id')::uuid;
    if not found then raise exception 'Unknown account in opening balances.'; end if;
    if acc.type in ('asset', 'expense') then
      insert into public.journal_lines (entry_id, account_id, debit, credit) values (eid, acc.id, greatest(amt, 0), greatest(-amt, 0));
    else
      insert into public.journal_lines (entry_id, account_id, debit, credit) values (eid, acc.id, greatest(-amt, 0), greatest(amt, 0));
    end if;
  end loop;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into dr, cr from public.journal_lines where entry_id = eid;
  if dr = 0 and cr = 0 then
    delete from public.journal_entries where id = eid;
    return null;
  end if;
  if dr > cr then
    insert into public.journal_lines (entry_id, account_id, credit, description) values (eid, private.acct('3000'), dr - cr, 'Opening capital');
  elsif cr > dr then
    insert into public.journal_lines (entry_id, account_id, debit, description) values (eid, private.acct('3000'), cr - dr, 'Opening capital');
  end if;
  return eid;
end;
$$;

-- ---------- Reports ----------
-- Per-account activity for a period. Amounts are debit-minus-credit; the app shows them
-- the natural way round for each account type.
create function public.account_activity(p_from date, p_to date)
returns table (account_id uuid, opening numeric, debit numeric, credit numeric, closing numeric)
language sql stable security invoker set search_path = '' as $$
  select a.id,
         coalesce(sum(l.debit - l.credit) filter (where e.entry_date < p_from), 0),
         coalesce(sum(l.debit) filter (where e.entry_date >= p_from), 0),
         coalesce(sum(l.credit) filter (where e.entry_date >= p_from), 0),
         coalesce(sum(l.debit - l.credit), 0)
    from public.accounts a
    left join (public.journal_lines l join public.journal_entries e on e.id = l.entry_id and e.entry_date <= p_to)
      on l.account_id = a.id
   group by a.id;
$$;

revoke all on function
  public.save_journal_entry(jsonb, uuid), public.issue_invoice(uuid),
  public.record_invoice_payment(uuid, date, uuid, numeric, numeric, text), public.cancel_invoice(uuid),
  public.pay_bill(uuid, date, uuid, numeric, numeric, text, text), public.bill_subscription(uuid, date, uuid),
  public.set_opening_balances(jsonb), public.account_activity(date, date)
from public, anon;
grant execute on function
  public.save_journal_entry(jsonb, uuid), public.issue_invoice(uuid),
  public.record_invoice_payment(uuid, date, uuid, numeric, numeric, text), public.cancel_invoice(uuid),
  public.pay_bill(uuid, date, uuid, numeric, numeric, text, text), public.bill_subscription(uuid, date, uuid),
  public.set_opening_balances(jsonb), public.account_activity(date, date)
to authenticated;
