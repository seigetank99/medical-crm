#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'
import { normalizeNppesCsvRow, supportedStates, taxonomyQueries } from '../supabase/functions/_shared/npi.js'
import { calculateLeadScore } from '../supabase/functions/_shared/scoring.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const defaultStates = ['NY', 'NJ', 'CT']

const options = parseArgs(process.argv.slice(2))
loadEnvFiles(['.env.npi.local', '.env.local', '.env'])

if (options.help) {
  printHelp()
  process.exit(0)
}

if (!options.csv || typeof options.csv !== 'string') {
  console.error('Missing required --csv path to the extracted npidata_pfile_*.csv file.')
  printHelp()
  process.exit(1)
}

const csvPath = path.resolve(process.cwd(), options.csv)
if (!fs.existsSync(csvPath)) {
  console.error(`CSV file not found: ${csvPath}`)
  process.exit(1)
}

const states = options.allStates
  ? supportedStates
  : parseList(options.states || defaultStates.join(',')).map((state) => state.toUpperCase())
const specialties = parseList(options.specialties || taxonomyQueries.map((item) => item.specialty).join(','))
const batchSize = clampNumber(options.batchSize, 1, 1000, 500)
const dryRun = Boolean(options.dryRun)
const updateExisting = Boolean(options.updateExisting)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const batchId = `nppes_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`

const invalidStates = states.filter((state) => !supportedStates.includes(state))
if (invalidStates.length) {
  console.error(`Unsupported state code(s): ${invalidStates.join(', ')}`)
  process.exit(1)
}

const invalidSpecialties = specialties.filter((specialty) => !taxonomyQueries.some((item) => item.specialty === specialty))
if (invalidSpecialties.length) {
  console.error(`Unsupported specialty value(s): ${invalidSpecialties.join(', ')}`)
  process.exit(1)
}

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Put them in .env.npi.local or export them in your shell.')
  process.exit(1)
}

const supabase = dryRun
  ? null
  : createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

const summary = {
  batch_id: batchId,
  csv_path: csvPath,
  states,
  specialties,
  rows_read: 0,
  matched: 0,
  inserted: 0,
  updated: 0,
  skipped_existing: 0,
  skipped: 0,
  failed: 0,
  errors: [],
}

console.log(`Starting NPPES dentist import from ${csvPath}`)
console.log(`States: ${states.join(', ')} | Specialties: ${specialties.join(', ')} | Batch size: ${batchSize}`)
if (dryRun) console.log('Dry run enabled. No Supabase writes will be made.')

if (!dryRun) {
  await createImportBatch()
}

await streamCsv()

if (!dryRun) {
  await finalizeImportBatch()
}

console.log(JSON.stringify(summary, null, 2))

async function streamCsv() {
  let batch = []
  const csvStream = Papa.parse(Papa.NODE_STREAM_INPUT, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  fs.createReadStream(csvPath).pipe(csvStream)

  for await (const row of csvStream) {
    summary.rows_read += 1
    const payload = normalizeNppesCsvRow(row)

    if (!payload?.npi_number || !states.includes(payload.state) || !specialties.includes(payload.specialty)) {
      summary.skipped += 1
    } else {
      payload.import_source = 'NPI Registry'
      payload.import_batch_id = batchId
      payload.lead_score = calculateLeadScore(payload)
      batch.push(compactPayload(payload))
      summary.matched += 1
    }

    if (batch.length >= batchSize) {
      await flushBatch(batch)
      batch = []
    }

    if (summary.rows_read % 100000 === 0) {
      console.log(
        `Read ${summary.rows_read.toLocaleString()} rows; matched ${summary.matched.toLocaleString()}; inserted ${summary.inserted.toLocaleString()}; updated ${summary.updated.toLocaleString()}.`,
      )
    }
  }

  await flushBatch(batch)
}

async function flushBatch(records) {
  if (!records.length) return
  if (dryRun) return

  const npiNumbers = records.map((record) => record.npi_number).filter(Boolean)
  const existingByNpi = await findExistingDentists(npiNumbers)
  const newRecords = records.filter((record) => !existingByNpi.has(record.npi_number))
  const existingRecords = records.filter((record) => existingByNpi.has(record.npi_number))

  if (newRecords.length) {
    const { error } = await supabase.from('dentists').insert(newRecords)
    if (error) {
      summary.failed += newRecords.length
      summary.errors.push(`Insert failed near row ${summary.rows_read}: ${error.message}`)
    } else {
      summary.inserted += newRecords.length
    }
  }

  if (!existingRecords.length) return

  if (!updateExisting) {
    summary.skipped_existing += existingRecords.length
    return
  }

  for (const record of existingRecords) {
    const existing = existingByNpi.get(record.npi_number)
    const { error } = await supabase.from('dentists').update(record).eq('id', existing.id)
    if (error) {
      summary.failed += 1
      summary.errors.push(`Update failed for NPI ${record.npi_number}: ${error.message}`)
    } else {
      summary.updated += 1
    }
  }
}

async function findExistingDentists(npiNumbers) {
  const existingByNpi = new Map()
  for (const chunk of chunkArray([...new Set(npiNumbers)], 500)) {
    const { data, error } = await supabase.from('dentists').select('id,npi_number').in('npi_number', chunk)
    if (error) throw error
    for (const row of data || []) {
      if (row.npi_number) existingByNpi.set(row.npi_number, row)
    }
  }
  return existingByNpi
}

async function createImportBatch() {
  const { error } = await supabase.from('import_batches').insert({
    batch_id: batchId,
    file_name: path.basename(csvPath),
    import_source: 'NPI Registry',
    total_rows: 0,
    successful_rows: 0,
    failed_rows: 0,
    duplicate_rows: 0,
    notes: `NPPES bulk import started for ${states.join(', ')}.`,
  })
  if (error) throw error
}

async function finalizeImportBatch() {
  const { error } = await supabase
    .from('import_batches')
    .update({
      total_rows: summary.rows_read,
      successful_rows: summary.inserted + summary.updated,
      failed_rows: summary.failed,
      duplicate_rows: summary.skipped_existing,
      notes: `NPPES bulk import completed. Matched ${summary.matched}, inserted ${summary.inserted}, updated ${summary.updated}, skipped existing ${summary.skipped_existing}.`,
    })
    .eq('batch_id', batchId)
  if (error) throw error
}

function parseArgs(args) {
  const parsed = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') parsed.help = true
    else if (arg === '--all-states') parsed.allStates = true
    else if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--update-existing') parsed.updateExisting = true
    else if (arg.startsWith('--')) {
      const key = toCamelCase(arg.slice(2))
      const next = args[index + 1]
      if (!next || next.startsWith('--')) parsed[key] = true
      else {
        parsed[key] = next
        index += 1
      }
    }
  }

  return parsed
}

function printHelp() {
  console.log(`
Usage:
  npm run npi:bulk -- --csv ./data/nppes/npidata_pfile_*.csv

Options:
  --csv <path>              Required path to extracted CMS npidata_pfile CSV.
  --states NY,NJ,CT         State list. Defaults to NY,NJ,CT.
  --all-states              Import dentists from all 50 supported states.
  --specialties <list>      Comma-separated specialties. Defaults to all dental specialties in _shared/npi.js.
  --batch-size 500          Insert batch size, max 1000.
  --update-existing         Update existing dentists that match by NPI. Default is skip existing.
  --dry-run                 Parse and count matches without writing to Supabase.
`)
}

function loadEnvFiles(files) {
  for (const file of files) {
    const envPath = path.join(projectRoot, file)
    if (!fs.existsSync(envPath)) continue

    const text = fs.readFileSync(envPath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const separator = trimmed.indexOf('=')
      if (separator === -1) continue
      const key = trimmed.slice(0, separator).trim()
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value || fallback)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(number, min), max)
}

function compactPayload(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

function chunkArray(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}
