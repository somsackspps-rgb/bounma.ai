// Supabase Edge Function: cleanup-files
// Removes expired classroom files from Storage and marks them deleted.
// Callers: (a) an admin signed in to the app (button in the admin tab), or
//          (b) pg_cron / any scheduler sending header  x-cleanup-secret: <CLEANUP_SECRET>
// Deploy:  supabase functions deploy cleanup-files --no-verify-jwt
//          supabase secrets set CLEANUP_SECRET=<long random text>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // who is calling?
  const secret = Deno.env.get('CLEANUP_SECRET');
  let allowed = !!secret && req.headers.get('x-cleanup-secret') === secret;
  if (!allowed) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: ud } = await admin.auth.getUser(token);
    if (ud?.user) {
      const { data: me } = await admin.from('profiles').select('role,status').eq('id', ud.user.id).maybeSingle();
      allowed = me?.role === 'admin' && me?.status === 'approved';
    }
  }
  if (!allowed) return json({ error: 'not allowed' }, 403);

  let removed = 0, failed = 0;
  for (let round = 0; round < 5; round++) {            // at most 5 x 100 files per call
    const { data: rows, error } = await admin.from('room_files')
      .select('id,group_id').is('deleted_at', null).lt('expires_at', new Date().toISOString()).limit(100);
    if (error) return json({ error: error.message, removed, failed }, 500);
    if (!rows?.length) break;
    const paths = rows.map((r) => `${r.group_id}/${r.id}`);
    const { error: re } = await admin.storage.from('classroom-files').remove(paths);
    if (re) { failed += rows.length; break; }           // keep rows so the next run retries
    await admin.from('room_files').update({ deleted_at: new Date().toISOString() }).in('id', rows.map((r) => r.id));
    removed += rows.length;
  }
  return json({ ok: true, removed, failed });
});
