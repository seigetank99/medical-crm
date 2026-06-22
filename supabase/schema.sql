-- OmniHealth / Medical CRM Supabase setup and migration script.
-- Review before running in production.

begin;

alter table public.dentists
drop constraint if exists valid_contact_status;

alter table public.dentists
alter column contact_status set default 'New';

update public.dentists
set contact_status = 'New'
where contact_status is null
   or contact_status = 'Not Contacted';

update public.dentists
set contact_status = 'Contacted'
where contact_status = 'Connected';

update public.dentists
set contact_status = 'Active Prospect'
where contact_status = 'Meeting Scheduled';

alter table public.dentists
add constraint valid_contact_status
check (contact_status in (
  'New',
  'Attempted',
  'Contacted',
  'Active Prospect',
  'Proposal Sent',
  'Client',
  'Nurture',
  'Unqualified',
  'Lost'
));

update public.dentists set specialty = 'General Dentist' where specialty = 'General Dentists';
update public.dentists set specialty = 'Orthodontist' where specialty = 'Orthodontists';
update public.dentists set specialty = 'Oral Surgeon' where specialty = 'Oral Surgeons';
update public.dentists set specialty = 'Pediatric Dentist' where specialty = 'Pediatric Dentists';
update public.dentists set specialty = 'Periodontist' where specialty = 'Periodontists';
update public.dentists set specialty = 'Endodontist' where specialty = 'Endodontists';

alter table public.dentists
add column if not exists lead_score int default 0,
add column if not exists last_contact_date date,
add column if not exists follow_up_priority text default 'Medium',
add column if not exists taxonomy_code text,
add column if not exists source_confidence int default 0,
add column if not exists osm_id text,
add column if not exists google_place_id text,
add column if not exists data_enriched_at timestamptz,
add column if not exists enrichment_status text,
add column if not exists enrichment_error text,
add column if not exists practice_domain text,
add column if not exists public_email text,
add column if not exists owner_confidence int default 0,
add column if not exists education_school text,
add column if not exists graduation_year_source text,
add column if not exists data_sources jsonb default '{}'::jsonb;

alter table public.dentists
drop constraint if exists valid_follow_up_priority;

alter table public.dentists
add constraint valid_follow_up_priority
check (follow_up_priority in (
  'Low',
  'Medium',
  'High',
  'Urgent'
));

-- dentists.id is bigint, so contact_notes.dentist_id must also be bigint.
-- This creates the correct table for new projects without destroying existing notes.
create table if not exists public.contact_notes (
  id bigint generated always as identity primary key,
  dentist_id bigint not null references public.dentists(id) on delete cascade,
  note text not null,
  contact_method text,
  contact_date date default current_date,
  created_at timestamptz not null default now()
);

create index if not exists contact_notes_dentist_id_idx
on public.contact_notes (dentist_id, created_at desc);

do $$
declare
  dentist_id_type text;
begin
  select data_type into dentist_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'contact_notes'
    and column_name = 'dentist_id';

  if dentist_id_type is not null and dentist_id_type <> 'bigint' then
    raise exception 'contact_notes.dentist_id must be bigint because dentists.id is bigint. If this table is empty, drop and recreate contact_notes with the definition in this file. If it has data, migrate it before changing the type.';
  end if;
end $$;

create table if not exists public.crm_tasks (
  id bigint generated always as identity primary key,
  dentist_id bigint references public.dentists(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  priority text default 'Medium',
  status text default 'Open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.crm_tasks
drop constraint if exists valid_task_priority;

alter table public.crm_tasks
add constraint valid_task_priority
check (priority in (
  'Low',
  'Medium',
  'High',
  'Urgent'
));

alter table public.crm_tasks
drop constraint if exists valid_task_status;

alter table public.crm_tasks
add constraint valid_task_status
check (status in (
  'Open',
  'In Progress',
  'Completed',
  'Canceled'
));

create index if not exists crm_tasks_dentist_id_idx
on public.crm_tasks (dentist_id, due_date);

create index if not exists crm_tasks_due_date_idx
on public.crm_tasks (due_date, status);

create table if not exists public.import_batches (
  id bigint generated always as identity primary key,
  batch_id text unique not null,
  file_name text,
  import_source text,
  total_rows int default 0,
  successful_rows int default 0,
  failed_rows int default 0,
  duplicate_rows int default 0,
  notes text,
  created_at timestamptz default now()
);

create index if not exists import_batches_batch_id_idx
on public.import_batches (batch_id);

create table if not exists public.enrichment_queue (
  id bigint generated always as identity primary key,
  dentist_id bigint not null references public.dentists(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  scheduled_for timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.enrichment_queue
drop constraint if exists valid_enrichment_job_type;

alter table public.enrichment_queue
add constraint valid_enrichment_job_type
check (job_type in (
  'osm_enrichment',
  'google_places_enrichment',
  'website_enrichment',
  'lead_scoring'
));

alter table public.enrichment_queue
drop constraint if exists valid_enrichment_status;

alter table public.enrichment_queue
add constraint valid_enrichment_status
check (status in (
  'pending',
  'processing',
  'completed',
  'failed'
));

create index if not exists dentists_npi_number_idx on public.dentists (npi_number);
create unique index if not exists dentists_npi_number_unique_idx
on public.dentists (npi_number)
where npi_number is not null;
create index if not exists dentists_state_idx on public.dentists (state);
create index if not exists dentists_specialty_idx on public.dentists (specialty);
create index if not exists dentists_contact_status_idx on public.dentists (contact_status);
create index if not exists dentists_owner_status_idx on public.dentists (owner_status);
create index if not exists dentists_graduation_year_idx on public.dentists (graduation_year);
create index if not exists dentists_next_follow_up_date_idx on public.dentists (next_follow_up_date);
create index if not exists dentists_lead_score_idx on public.dentists (lead_score);
create index if not exists dentists_import_batch_id_idx on public.dentists (import_batch_id);
create index if not exists dentists_google_place_id_idx on public.dentists (google_place_id);
create index if not exists dentists_osm_id_idx on public.dentists (osm_id);
create index if not exists dentists_enrichment_status_idx on public.dentists (enrichment_status);
create index if not exists dentists_practice_domain_idx on public.dentists (practice_domain);
create index if not exists dentists_public_email_idx on public.dentists (public_email);
create index if not exists enrichment_queue_status_scheduled_for_idx
on public.enrichment_queue (status, scheduled_for);
create index if not exists enrichment_queue_dentist_id_idx
on public.enrichment_queue (dentist_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_dentists_updated_at on public.dentists;

create trigger set_dentists_updated_at
before update on public.dentists
for each row
execute function public.set_updated_at();

drop trigger if exists set_crm_tasks_updated_at on public.crm_tasks;

create trigger set_crm_tasks_updated_at
before update on public.crm_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_enrichment_queue_updated_at on public.enrichment_queue;

create trigger set_enrichment_queue_updated_at
before update on public.enrichment_queue
for each row
execute function public.set_updated_at();

alter table public.dentists enable row level security;
alter table public.contact_notes enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.import_batches enable row level security;
alter table public.enrichment_queue enable row level security;

drop policy if exists "Authenticated users can read dentists" on public.dentists;
drop policy if exists "Authenticated users can insert dentists" on public.dentists;
drop policy if exists "Authenticated users can update dentists" on public.dentists;
drop policy if exists "Authenticated users can delete dentists" on public.dentists;

create policy "Authenticated users can read dentists"
on public.dentists
for select
to authenticated
using (true);

create policy "Authenticated users can insert dentists"
on public.dentists
for insert
to authenticated
with check (true);

create policy "Authenticated users can update dentists"
on public.dentists
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete dentists"
on public.dentists
for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can read contact notes" on public.contact_notes;
drop policy if exists "Authenticated users can insert contact notes" on public.contact_notes;
drop policy if exists "Authenticated users can update contact notes" on public.contact_notes;
drop policy if exists "Authenticated users can delete contact notes" on public.contact_notes;

create policy "Authenticated users can read contact notes"
on public.contact_notes
for select
to authenticated
using (true);

create policy "Authenticated users can insert contact notes"
on public.contact_notes
for insert
to authenticated
with check (true);

create policy "Authenticated users can update contact notes"
on public.contact_notes
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete contact notes"
on public.contact_notes
for delete
to authenticated
using (true);

drop policy if exists "Authenticated users can manage crm tasks" on public.crm_tasks;

create policy "Authenticated users can manage crm tasks"
on public.crm_tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage import batches" on public.import_batches;

create policy "Authenticated users can manage import batches"
on public.import_batches
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage enrichment queue" on public.enrichment_queue;

create policy "Authenticated users can manage enrichment queue"
on public.enrichment_queue
for all
to authenticated
using (true)
with check (true);

commit;
