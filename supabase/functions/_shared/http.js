import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(message, status = 400, details = null) {
  return jsonResponse({ error: message, details }, status)
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = getServiceRoleKey()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or service role key.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function requireAuthorizedRequest(req, supabase) {
  const serviceRoleKey = getServiceRoleKey()
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) return { error: 'Authentication required.', status: 401 }
  if (serviceRoleKey && token === serviceRoleKey) return { actor: 'service_role' }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return { error: 'Authentication required.', status: 401 }

  return { actor: 'authenticated', user: data.user }
}

export function getServiceRoleKey() {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacyKey) return legacyKey

  try {
    const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
    return secretKeys.service_role || secretKeys.default || null
  } catch {
    return null
  }
}

export async function readJson(req) {
  try {
    return await req.json()
  } catch {
    return {}
  }
}
