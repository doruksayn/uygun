import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
import { trustedPushEndpoint } from '../set-status/validation.mjs';

const origin = Deno.env.get('APP_ORIGIN') || '';
const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (req.headers.get('origin') && req.headers.get('origin') !== origin) return json({ error: 'Forbidden origin' }, 403);
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json({ error: 'Unauthorized' }, 401);

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Unauthorized' }, 401);
    const { data: member, error: memberError } = await admin.from('members').select('display_name').eq('user_id', auth.user.id).maybeSingle();
    if (memberError) return json({ error: 'Database unavailable' }, 503);
    if (!member) return json({ error: 'Forbidden' }, 403);
    const { data: result, error } = await admin.rpc('claim_poke', { p_user_id: auth.user.id });
    if (error) return json({ error: 'Could not claim poke' }, 503);
    if (!result.allowed) return json({ ok: true, cooldown: true, next_available_at: result.next_available_at });

    const { data: subs, error: subError } = await admin.from('push_subscriptions').select('user_id,endpoint,subscription').neq('user_id', auth.user.id);
    if (subError) return json({ ok: true, push: 'failed', next_available_at: result.next_available_at });
    if (!subs?.length) return json({ ok: true, push: 'no_subscriptions', next_available_at: result.next_available_at });

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) return json({ ok: true, push: 'failed', next_available_at: result.next_available_at });
    const results = await Promise.allSettled(subs.map(async sub => {
      if (!trustedPushEndpoint(sub.endpoint) || sub.subscription?.endpoint !== sub.endpoint) throw Error('Untrusted endpoint');
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify({ title: `${member.display_name} seni BIZZLATTI!`, tag: 'uygun-poke' }), { TTL: 300, timeout: 8000, vapidDetails: { subject, publicKey, privateKey } });
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404 || (e as { statusCode?: number }).statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('user_id', sub.user_id).eq('endpoint', sub.endpoint);
        }
        throw e;
      }
    }));
    return json({ ok: true, push: results.every(result => result.status === 'fulfilled') ? 'sent' : 'failed', next_available_at: result.next_available_at });
  } catch {
    return json({ error: 'Server error' }, 500);
  }
});
