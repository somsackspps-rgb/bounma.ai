// Supabase Edge Function: delete-user  (admin only)
// Deploy:  supabase functions deploy delete-user
// Deleting an auth account needs the service-role key, which must never be in the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  // 1) who is calling?
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: ud, error: ue } = await admin.auth.getUser(token);
  if (ue || !ud?.user) return json({ error: 'not signed in' }, 401);
  const caller = ud.user.id;
  const { data: me } = await admin.from('profiles').select('role,status').eq('id', caller).maybeSingle();
  if (!me || me.role !== 'admin' || me.status !== 'approved') return json({ error: 'admin only' }, 403);

  // 2) validate target
  let body: { user_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const target = String(body?.user_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(target)) return json({ error: 'invalid user_id' }, 400);
  if (target === caller) return json({ error: 'you cannot delete yourself' }, 400);

  const { data: t } = await admin.from('profiles').select('role,status').eq('id', target).maybeSingle();
  if (t?.role === 'admin' && t?.status === 'approved') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
      .eq('role', 'admin').eq('status', 'approved').neq('id', target);
    if (!count) return json({ error: 'cannot delete the last admin' }, 400);
  }

  // 3) rooms created by the target are handed to the calling admin (otherwise they would be deleted with the user)
  let transferred = 0;
  const { data: rooms } = await admin.from('classroom_groups').select('id').eq('created_by', target);
  if (rooms?.length) {
    const ids = rooms.map((r) => r.id);
    await admin.from('group_members').upsert(ids.map((g) => ({ group_id: g, user_id: caller })),
      { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    const { error: e1 } = await admin.from('classroom_groups').update({ created_by: caller }).in('id', ids);
    if (e1) return json({ error: 'could not transfer classrooms: ' + e1.message }, 500);
    transferred = ids.length;
  }

  // 4) avatar file (best effort)
  try {
    const { data: files } = await admin.storage.from('profile-avatars').list(target);
    if (files?.length) await admin.storage.from('profile-avatars').remove(files.map((f) => `${target}/${f.name}`));
  } catch (_) { /* ignore */ }

  // 5) delete the account (profile, progress, memberships and messages cascade)
  const { error: de } = await admin.auth.admin.deleteUser(target);
  if (de) return json({ error: de.message }, 500);
  return json({ ok: true, transferred_rooms: transferred });
});
