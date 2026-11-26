// join-beta: receives the readrr.app beta sign-up form and stores it in
// public.beta_signups.
//
// Deployed with --no-verify-jwt so the static landing page can call it without
// embedding any Supabase key. It writes with the service role, which the Edge
// runtime provides as SUPABASE_SERVICE_ROLE_KEY (never in git).
//
// Deploy:  supabase functions deploy join-beta --no-verify-jwt --use-api

const ALLOWED_ORIGINS = new Set([
  'https://readrr.app',
  'https://www.readrr.app',
  'http://localhost:8765', // local preview of web/
]);

const PHONES = new Set(['iPhone', 'Android']);
const POSTAGE = new Set(['yes', 'no', 'not in the UK']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://readrr.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400, origin);
  }

  // Honeypot: real people never see or fill this field. Pretend success.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true }, 200, origin);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const city = String(body.city ?? '').trim().slice(0, 100) || null;
  const phone = PHONES.has(String(body.phone)) ? String(body.phone) : 'iPhone';
  const postage = POSTAGE.has(String(body.postage)) ? String(body.postage) : null;
  const source = String(body.source ?? 'landing').slice(0, 60);

  if (email.length < 5 || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400, origin);
  }

  // PostgREST insert with the service role. on_conflict + ignore-duplicates
  // makes a repeat sign-up a quiet no-op instead of an error.
  const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/beta_signups`;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify({ email, city, phone, postage, source }),
  });

  // 409 = the case-insensitive unique index caught a repeat (expression index,
  // so on_conflict can't target it). Treat as already signed up.
  if (res.ok || res.status === 409) return json({ ok: true }, 200, origin);

  console.error('beta_signups insert failed', res.status, await res.text());
  return json({ error: 'Something went wrong. Please try again.' }, 500, origin);
});
