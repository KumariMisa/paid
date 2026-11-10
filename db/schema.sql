create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  business_name text not null,
  upi_id text,
  mcp_key text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  number text not null,
  slug text unique not null,
  client_name text not null,
  client_email text,
  issue_date date not null default current_date,
  due_date date not null,
  currency text not null default 'INR',
  tax_percent numeric(5,2) not null default 0,
  items jsonb not null default '[]',
  notes text,
  status text not null default 'draft' check (status in ('draft','sent','paid')),
  created_via text not null default 'web',
  view_count integer not null default 0,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  client_reported_paid_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, number)
);

create table if not exists invoice_events (
  id bigserial primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists invoices_user_idx on invoices(user_id, created_at desc);
create index if not exists events_invoice_idx on invoice_events(invoice_id, created_at);
