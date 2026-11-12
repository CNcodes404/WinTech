// Edge Function: admin-create-client
//
// Creates a client login (auth user + profile) on behalf of an ACTIVE ADMIN.
// - The service-role key exists only here (Supabase-managed env), never in the browser.
// - The caller is authenticated from their own access token and must be an active admin.
// - New accounts are always role 'client' (database trigger); the creating admin is recorded
//   in app_metadata.created_by, which the profile trigger writes to the audit log.
// - V1: the admin sets a temporary password (default Supabase email can't deliver invites to
//   arbitrary/fictional addresses). Email invites can be added with custom SMTP later.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { corsHeaders, validateCreateClientInput } from './validation.ts';

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)
  .concat(DEFAULT_ORIGINS);

const MAX_BODY_BYTES = 8 * 1024;

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('Origin'), ALLOWED_ORIGINS);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, cors);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('admin-create-client: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return json(500, { error: 'server_not_configured' }, cors);
  }

  // ---- Authenticate the caller -------------------------------------------------------------
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: 'unauthenticated' }, cors);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: 'unauthenticated' }, cors);

  const { data: caller, error: callerError } = await admin
    .from('profiles')
    .select('id, role, status')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (callerError) {
    console.error('admin-create-client: caller lookup failed', callerError.message);
    return json(500, { error: 'internal_error' }, cors);
  }
  if (!caller || caller.role !== 'admin' || caller.status !== 'active') {
    return json(403, { error: 'forbidden' }, cors);
  }

  // ---- Validate input ----------------------------------------------------------------------
  const length = Number(req.headers.get('Content-Length') ?? '0');
  if (length > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, cors);

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'payload_too_large' }, cors);
    raw = JSON.parse(text);
  } catch {
    return json(400, { error: 'invalid_json' }, cors);
  }

  const result = validateCreateClientInput(raw);
  if (!result.ok) return json(422, { error: 'validation_failed', fields: result.errors }, cors);
  const input = result.value;

  // ---- Create the account ------------------------------------------------------------------
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, phone: input.phone },
    app_metadata: { created_by: caller.id },
  });

  if (createError || !created.user) {
    const code = (createError as { code?: string } | null)?.code;
    if (code === 'weak_password') {
      return json(
        422,
        { error: 'validation_failed', fields: { temporaryPassword: 'Password is too weak.' } },
        cors,
      );
    }
    if (code === 'email_exists' || code === 'user_already_exists') {
      return json(409, { error: 'email_exists' }, cors);
    }
    console.error('admin-create-client: createUser failed', code, createError?.message);
    return json(500, { error: 'internal_error' }, cors);
  }

  return json(201, { id: created.user.id, email: created.user.email }, cors);
});
