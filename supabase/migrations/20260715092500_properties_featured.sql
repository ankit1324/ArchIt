-- Featured listings: lister paid the featured fee; pins render highlighted
alter table public.properties
  add column if not exists featured boolean not null default false;
