-- ---------- Business details printed on documents ----------
alter table public.business_settings
  add column email               text default 'info@imageniestudio.in',
  add column phone               text default '+91 99721 51617',
  add column bank_name           text,
  add column bank_account_name   text,
  add column bank_account_number text,
  add column bank_ifsc           text check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  add column upi_id              text,
  add column invoice_terms       text default 'Payment due within 15 days of the invoice date.',
  add column quotation_terms     text default 'This quotation is valid for 30 days.';

update public.business_settings
   set address = coalesce(address, 'Flat/Door/Block No. 201, Dreams Heritage, Block 1, Vakayil Lane, Sawmill Road, Thrissur, Kerala 680007');

-- ---------- Quotations and invoices ----------
create type public.doc_kind as enum ('quotation', 'invoice');
create type public.doc_status as enum ('draft', 'sent', 'accepted', 'declined', 'paid', 'cancelled');

create table public.document_counters (
  kind        public.doc_kind not null,
  fy_start    int not null,
  last_number int not null default 0,
  primary key (kind, fy_start)
);

create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  kind              public.doc_kind not null,
  number            text,                                   -- assigned when issued (leaves draft)
  status            public.doc_status not null default 'draft',
  issue_date        date not null default current_date,
  due_date          date,                                   -- invoice: due date; quotation: valid until

  customer_name     text not null check (char_length(btrim(customer_name)) between 1 and 200),
  customer_address  text,
  customer_email    text,
  customer_phone    text,
  customer_gstin    text check (customer_gstin is null or customer_gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  customer_state    text,                                   -- place of supply

  subtotal          numeric(12,2) not null default 0,
  tax_total         numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,

  notes             text,
  terms             text,

  quotation_id      uuid references public.documents(id) on delete set null,
  subscription_id   uuid references public.subscriptions(id) on delete set null,
  lead_id           uuid references public.leads(id) on delete set null,
  transaction_id    uuid references public.transactions(id) on delete set null,

  constraint documents_number_unique unique (kind, number),
  constraint status_fits_kind check (
    (kind = 'quotation' and status in ('draft','sent','accepted','declined','cancelled')) or
    (kind = 'invoice'   and status in ('draft','sent','paid','cancelled'))
  )
);
create index documents_kind_date_idx on public.documents (kind, issue_date desc);
create index documents_quotation_idx on public.documents (quotation_id);
create index documents_subscription_idx on public.documents (subscription_id);
create index documents_lead_idx on public.documents (lead_id);
create index documents_transaction_idx on public.documents (transaction_id);

create table public.document_items (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  position     int not null default 0,
  description  text not null check (char_length(btrim(description)) between 1 and 1000),
  hsn_sac      text,
  quantity     numeric(12,3) not null default 1 check (quantity > 0),
  unit         text,
  unit_price   numeric(12,2) not null default 0 check (unit_price >= 0),
  gst_rate     numeric(5,2) not null default 0 check (gst_rate between 0 and 28)
);
create index document_items_document_idx on public.document_items (document_id, position);

create trigger documents_set_updated_at before update on public.documents
for each row execute function public.set_updated_at();

-- Number a document the first time it leaves draft: INV/26-27/001, QT/26-27/001.
-- Sequential per financial year, max 16 characters as GST invoice rules require.
create function public.assign_document_number() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  fy int;
  n int;
begin
  if new.number is null and new.status <> 'draft' then
    fy := extract(year from new.issue_date)::int - case when extract(month from new.issue_date) < 4 then 1 else 0 end;
    insert into public.document_counters (kind, fy_start, last_number) values (new.kind, fy, 1)
    on conflict (kind, fy_start) do update set last_number = public.document_counters.last_number + 1
    returning last_number into n;
    new.number := case new.kind when 'invoice' then 'INV' else 'QT' end
                  || '/' || lpad((fy % 100)::text, 2, '0') || '-' || lpad(((fy + 1) % 100)::text, 2, '0')
                  || '/' || lpad(n::text, 3, '0');
  end if;
  return new;
end;
$$;
create trigger documents_assign_number before insert or update of status on public.documents
for each row execute function public.assign_document_number();

-- Keep document totals in step with its line items.
create function public.recalc_document_totals() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  doc uuid := coalesce(new.document_id, old.document_id);
begin
  update public.documents d
     set subtotal  = coalesce(x.sub, 0),
         tax_total = coalesce(x.tax, 0),
         total     = coalesce(x.sub, 0) + coalesce(x.tax, 0)
    from (
      select round(sum(quantity * unit_price), 2) as sub,
             sum(round(quantity * unit_price * gst_rate / 100, 2)) as tax
        from public.document_items where document_id = doc
    ) x
   where d.id = doc;
  return null;
end;
$$;
create trigger document_items_recalc after insert or update or delete on public.document_items
for each row execute function public.recalc_document_totals();

-- ---------- Actions ----------
create function public.convert_quotation_to_invoice(p_quotation_id uuid) returns uuid
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
     customer_gstin, customer_state, notes, terms, quotation_id, subscription_id, lead_id)
  values
    ('invoice', 'draft', current_date, current_date + 15, q.customer_name, q.customer_address, q.customer_email,
     q.customer_phone, q.customer_gstin, q.customer_state, q.notes, terms, q.id, q.subscription_id, q.lead_id)
  returning id into new_id;

  insert into public.document_items (document_id, position, description, hsn_sac, quantity, unit, unit_price, gst_rate)
  select new_id, position, description, hsn_sac, quantity, unit, unit_price, gst_rate
    from public.document_items where document_id = q.id;

  update public.documents set status = 'accepted' where id = q.id and status in ('draft','sent');
  return new_id;
end;
$$;

create function public.mark_invoice_paid(p_invoice_id uuid, p_paid_on date default current_date,
                                         p_payment_method text default null, p_category text default 'Other income')
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.documents;
  txn uuid;
begin
  update public.documents set status = 'paid'
   where id = p_invoice_id and kind = 'invoice' and status in ('draft','sent')
  returning * into inv;
  if not found then raise exception 'Invoice not found, not allowed, or already paid or cancelled'; end if;

  insert into public.transactions
    (kind, txn_date, party, description, category, amount, tax_amount, currency, amount_inr,
     invoice_number, payment_method, status, subscription_id)
  values
    ('income', p_paid_on, inv.customer_name, 'Invoice ' || inv.number, coalesce(p_category, 'Other income'),
     inv.total, inv.tax_total, 'INR', inv.total, inv.number, p_payment_method, 'paid', inv.subscription_id)
  returning id into txn;

  update public.documents set transaction_id = txn where id = inv.id;
  return txn;
end;
$$;

revoke all on function public.convert_quotation_to_invoice(uuid), public.mark_invoice_paid(uuid, date, text, text) from public, anon;
grant execute on function public.convert_quotation_to_invoice(uuid), public.mark_invoice_paid(uuid, date, text, text) to authenticated;

-- ---------- Admin-only access ----------
alter table public.documents enable row level security;
alter table public.document_items enable row level security;
alter table public.document_counters enable row level security;
revoke all on public.documents, public.document_items, public.document_counters from anon, authenticated;
grant select, insert, update, delete on public.documents, public.document_items to authenticated;
grant select, insert, update on public.document_counters to authenticated;

create policy "Admins manage documents" on public.documents for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage document items" on public.document_items for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins use document counters" on public.document_counters for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
