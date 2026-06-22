# OmniHealth

OmniHealth is a React + Vite CRM for accounting and advisory teams managing dental and medical practice-owner leads. The current focus is dental specialties in NY, NJ, and CT, with Supabase handling auth, Postgres data, RLS, imports, notes, tasks, and lead scoring.

## Tech Stack

- React + Vite
- JavaScript
- Supabase Auth + Postgres
- Supabase Edge Functions
- PapaParse for CSV import/export
- Vercel-ready static deployment

## Features

- Email/password login with Supabase Auth
- Protected dashboard, leads, and import pages
- Supabase CRUD for dentists
- Contact notes with cascade delete from dentists
- CRM tasks per dentist
- CSV import with validation, preview, duplicate detection, import batch tracking, and batched inserts
- Automatic NPI Registry import for NY, NJ, and CT dental leads
- Enrichment queue for lead scoring, OpenStreetMap enrichment, and selected Google Places enrichment
- Search, filters, sorting, pagination, saved views, and CSV export
- Lead scoring on create/edit/import
- Follow-up tracking and dashboard work queues
- Dark mode support

## Local Setup

1. Create a Supabase project.
2. Run [supabase/schema.sql](./supabase/schema.sql) in the Supabase SQL editor.
3. Create the first Auth user in Supabase Authentication > Users.
4. Create a local `.env`.
5. Install dependencies and start Vite.

```bash
cp .env.example .env
npm install
npm run dev
```

Required environment variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Use the Supabase anon key only. Never put a service role key in `.env` for this frontend app.

## Supabase Setup

Run [supabase/schema.sql](./supabase/schema.sql) in the Supabase SQL editor.

Important: this project expects `dentists.id` and `contact_notes.dentist_id` to both be `bigint`. The setup file creates `contact_notes` correctly for new projects and raises a clear SQL error if an existing `contact_notes.dentist_id` column has the wrong type, such as `uuid`.

The SQL file includes:

- standardized `contact_status` values
- singular dental specialty migration
- `lead_score`, `last_contact_date`, and `follow_up_priority`
- enrichment fields: `taxonomy_code`, `source_confidence`, `osm_id`, `google_place_id`, `practice_domain`, `public_email`, `owner_confidence`, `education_school`, `graduation_year_source`, `data_sources`, `data_enriched_at`, `enrichment_status`, and `enrichment_error`
- rebuilt `contact_notes` with `dentist_id bigint`
- `crm_tasks`
- `import_batches`
- `enrichment_queue`
- indexes
- `updated_at` triggers
- RLS policies for authenticated users

## Supabase Auth

Enable email/password auth in Supabase:

1. Open Supabase Dashboard.
2. Go to Authentication > Providers.
3. Enable Email.
4. Create the first user in Authentication > Users.
5. Use that email/password on `/login`.

Anonymous users are blocked by RLS. Authenticated users can manage CRM records for this private/internal MVP.

For a multi-user/team version later, replace the broad authenticated policies with `user_id` or `account_id` scoped policies.

## CRM Data Values

Allowed `contact_status` values:

```text
New
Attempted
Contacted
Active Prospect
Proposal Sent
Client
Nurture
Unqualified
Lost
```

Allowed dental specialty values:

```text
General Dentist
Orthodontist
Oral Surgeon
Pediatric Dentist
Periodontist
Endodontist
```

## CSV Import

Open `/import`, upload a CSV, review validation errors, then confirm import.

Supported duplicate checks:

- `npi_number`
- `email`
- `phone`
- same `first_name` + `last_name` + `city`
- same `practice_name` + `city` + `state`

Recommended headers:

```text
first_name,last_name,credentials,specialty,npi_number,graduation_year,practice_name,website,phone,email,address,city,state,zip_code,estimated_age_range,owner_status,contact_status,lead_source,tags,notes
```

Common variants such as `first name`, `lastname`, `npi`, `practice name`, `business name`, `zip`, `zipcode`, `owner status`, and `lead source` are also mapped.

Import normalizes:

- state to uppercase
- specialty to singular standard values
- contact status to approved values
- blank strings to null
- numeric year/rating/review fields
- lead score
- import source and import batch ID

## Automatic Data Pipeline

Open `/import` to run and monitor the automatic data pipeline.

The pipeline includes these Supabase Edge Functions:

```text
import-npi-dentists
enrich-osm-dentists
enrich-google-places
enrich-practice-website
process-enrichment-queue
```

`import-npi-dentists` uses the official NPI Registry API to import dentists from NY, NJ, and CT for these specialties:

```text
General Dentist
Orthodontist
Oral Surgeon
Pediatric Dentist
Periodontist
Endodontist
```

After import, the function creates `enrichment_queue` jobs:

- `lead_scoring` for all imported or updated records
- `osm_enrichment` for records missing website or practice information
- `google_places_enrichment` only for high-value records with `lead_score >= 20` that are missing website, rating, or review count
- `website_enrichment` for records with a practice website

`enrich-osm-dentists` uses Overpass/OpenStreetMap data and only fills missing website, phone, address, and practice fields when match confidence is high.

`enrich-google-places` uses the official Google Places API. The `GOOGLE_PLACES_API_KEY` must stay in Supabase secrets and must never be added to Vite environment variables. Google Places API calls may cost money, so the frontend shows a warning before manual Google enrichment.

Google Places is optional. If `GOOGLE_PLACES_API_KEY` is not set, NPI imports will skip creating Google enrichment jobs, and the queue processor will complete any existing Google jobs without calling Google.

`enrich-practice-website` fetches the dentist/practice's own public website server-side. It extracts public email, practice domain, owner/founder signals, education clues, graduation-year clues, and multi-location signals. It stores source metadata in `data_sources` and recalculates lead score.

`process-enrichment-queue` processes pending jobs due now, retries failed jobs up to three attempts, and returns processing totals.

### Edge Function Deployment

Install and authenticate the Supabase CLI, then deploy:

```bash
supabase functions deploy import-npi-dentists
supabase functions deploy enrich-osm-dentists
supabase functions deploy enrich-google-places
supabase functions deploy enrich-practice-website
supabase functions deploy process-enrichment-queue
```

Supabase provides the project URL and service role key to hosted Edge Functions as default reserved secrets. Do not add custom secrets named `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` in the Dashboard; Supabase blocks names with the `SUPABASE_` prefix.

Only add the custom Google Places secret if Google enrichment is enabled:

```bash
supabase secrets set GOOGLE_PLACES_API_KEY=your-google-places-api-key
```

Frontend environment variables remain limited to:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never commit a service role key or Google Places key.

### Scheduled Jobs

Use Supabase scheduled functions or `pg_cron`/external cron to call the deployed Edge Functions.

Desired schedule:

```text
Daily:  import-npi-dentists
Hourly: process-enrichment-queue
```

Cron requests should use a server-side bearer token from the Supabase Dashboard service role key. Manual frontend requests require an authenticated Supabase user session.

## Lead Scoring

Lead score is calculated on create, edit, and import:

- `+15` if `owner_status` is `Owner` or `Partner`
- `+10` if `multi_location` is true
- `+10` if specialty is `Orthodontist` or `Oral Surgeon`
- `+8` if `graduation_year` is before 1995
- `+5` if `google_review_count >= 100`
- `+3` if `google_rating >= 4.5`
- `-10` if `owner_status` is `Associate`

Missing data contributes `0`.

## Export

The Leads page exports the currently filtered Supabase result set to:

```text
medical-crm-export-YYYY-MM-DD.csv
```

## Deploy To Vercel

1. Import the repo into Vercel.
2. Set `VITE_SUPABASE_URL`.
3. Set `VITE_SUPABASE_ANON_KEY`.
4. Use build command `npm run build`.
5. Use output directory `dist`.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## Known Limitations

- RLS is intentionally broad for authenticated internal users.
- CSV import validates and skips duplicates, but does not update existing CRM records.
- Dashboard assumes `crm_tasks` and `import_batches` exist.
- The current app does not include role-based permissions or team/account partitioning.

## Roadmap

- Account-scoped RLS for teams
- User-owned tasks
- Bulk edit actions
- Import update/merge mode
- More provider verticals: physicians, veterinarians, physical therapists, and mental health practices
- Automated enrichment and outreach integrations
