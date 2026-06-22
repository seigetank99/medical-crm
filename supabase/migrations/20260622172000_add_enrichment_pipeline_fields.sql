alter table public.dentists
add column if not exists taxonomy_code text,
add column if not exists source_confidence int default 0,
add column if not exists osm_id text,
add column if not exists google_place_id text,
add column if not exists practice_domain text,
add column if not exists public_email text,
add column if not exists owner_confidence int default 0,
add column if not exists education_school text,
add column if not exists graduation_year_source text,
add column if not exists data_sources jsonb default '{}'::jsonb,
add column if not exists data_enriched_at timestamptz,
add column if not exists enrichment_status text,
add column if not exists enrichment_error text,
add column if not exists lead_score int default 0;

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
create index if not exists dentists_lead_score_idx on public.dentists (lead_score);
create index if not exists dentists_google_place_id_idx on public.dentists (google_place_id);
create index if not exists dentists_osm_id_idx on public.dentists (osm_id);
create index if not exists dentists_practice_domain_idx on public.dentists (practice_domain);
create index if not exists dentists_public_email_idx on public.dentists (public_email);
create index if not exists enrichment_queue_status_scheduled_for_idx
on public.enrichment_queue (status, scheduled_for);
create index if not exists enrichment_queue_dentist_id_idx
on public.enrichment_queue (dentist_id);

alter table public.import_batches enable row level security;
alter table public.enrichment_queue enable row level security;

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
