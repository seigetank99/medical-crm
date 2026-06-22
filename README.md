# OmniHealth

OmniHealth is a React + Vite lead management application for accounting and advisory teams targeting healthcare practice owners, starting with dental specialties in NY, NJ, and CT.

## Stack

- React 19
- Vite
- Supabase (Postgres)
- JavaScript
- Vercel-ready static frontend deployment

## Features

- Dashboard with lead and pipeline counts
- Three-panel CRM layout: sidebar, main table, right detail panel
- Server-side search, filters, sorting, and pagination for large lead lists
- Dentist create, edit, and delete flows
- Contact notes and history timeline
- Contact status and follow-up management
- Bulk CSV upload with validation, duplicate detection, preview, and batched Supabase inserts
- Saved views
- CSV export
- Responsive layout with dark mode

## Project structure

```text
src/
  components/
    common/
    crm/
    dashboard/
    layout/
  hooks/
  pages/
  services/
  utils/
```

## Environment variables

Create a local `.env` from `.env.example`.

```bash
cp .env.example .env
```

Required values:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase setup

The app expects these tables:

### `dentists`

Existing table used by the CRM:

- `id`
- `first_name`
- `last_name`
- `credentials`
- `specialty`
- `npi_number`
- `graduation_year`
- `estimated_age_range`
- `years_in_practice`
- `practice_name`
- `website`
- `phone`
- `email`
- `address`
- `city`
- `state`
- `zip_code`
- `owner_status`
- `number_of_locations`
- `solo_practice`
- `multi_location`
- `google_rating`
- `google_review_count`
- `contact_status`
- `lead_source`
- `notes`
- `next_follow_up_date`
- `tags`
- `import_source`
- `import_batch_id`
- `created_at`
- `updated_at`

### `contact_notes`

If `contact_notes` is not already present, create it with:

```sql
create table if not exists public.contact_notes (
  id bigint generated always as identity primary key,
  dentist_id uuid not null references public.dentists (id) on delete cascade,
  note text not null,
  contact_method text,
  contact_date date,
  created_at timestamptz not null default now()
);

create index if not exists contact_notes_dentist_id_idx
  on public.contact_notes (dentist_id, created_at desc);
```

Recommended indexes for scale:

```sql
create index if not exists dentists_state_idx on public.dentists (state);
create index if not exists dentists_specialty_idx on public.dentists (specialty);
create index if not exists dentists_contact_status_idx on public.dentists (contact_status);
create index if not exists dentists_owner_status_idx on public.dentists (owner_status);
create index if not exists dentists_graduation_year_idx on public.dentists (graduation_year);
create index if not exists dentists_next_follow_up_date_idx on public.dentists (next_follow_up_date);
```

If you use Row Level Security, add policies that allow the frontend role to read and write both tables.

## Run locally

```bash
npm install
npm run dev
```

Default Vite URL:

```text
http://localhost:5173
```

## Build for production

```bash
npm run build
```

## Deploy to Vercel

1. Import the repo into Vercel.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project settings.
3. Deploy with the default Vite build settings.

Build settings:

- Build command: `npm run build`
- Output directory: `dist`

## Notes on scale

- Lead table uses server-side pagination with a page size of 25.
- Search and filters execute in Supabase instead of loading the full dataset into the browser.
- CSV export can fetch the full filtered result set in batches for operational exports.
- CSV import inserts valid rows in batches of 500 and skips rows with validation errors or detected duplicates.

## CSV import

The import page accepts common header variants and maps them to the `dentists` table. Recommended headers:

```text
first_name,last_name,credentials,specialty,npi_number,practice_name,phone,email,website,address,city,state,zip_code,graduation_year,estimated_age_range,owner_status,contact_status,next_follow_up_date,tags,notes
```

Duplicate detection checks:

- existing CRM records by `npi_number`
- existing CRM records by `email`
- duplicate `npi_number` values inside the uploaded CSV
- duplicate `email` values inside the uploaded CSV

## MVP expansion path

The current app is tuned for dental leads and can be extended later by:

- adding specialty presets for physicians, veterinarians, physical therapists, and mental health practices
- introducing role-based auth
- adding pipeline stages, tasks, and bulk actions
- adding enrichment jobs and import workflows
