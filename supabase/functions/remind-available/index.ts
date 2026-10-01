import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';

function trustedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && (
      url.hostname === 'fcm.googleapis.com' || url.hostname === 'web.push.apple.com' ||
      url.hostname.endsWith('.push.apple.com') || url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname.endsWith('.notify.windows.com')
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('REMINDER_TOKEN');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject) return Response.json({ error: 'Missing VAPID configuration' }, { status: 503 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: due, error } = await admin.rpc('claim_due_reminders');
  if (error) return Response.json({ error: 'Reminder claim failed' }, { status: 503 });

  let sent = 0;
  for (const member of due || []) {
    const { data: subs, error: subError } = await admin.from('push_subscriptions').select('user_id,endpoint,subscription').eq('user_id', member.reminder_user_id);
    if (subError) continue;
    const results = await Promise.allSettled((subs || []).map(async sub => {
      if (!trustedPushEndpoint(sub.endpoint) || sub.subscription?.endpoint !== sub.endpoint) throw Error('Untrusted endpoint');
      await webpush.sendNotification(sub.subscription, JSON.stringify({ title: 'Uygun musun?' }), { TTL: 300, timeout: 8000, vapidDetails: { subject, publicKey, privateKey } });
    }));
    sent += results.filter(result => result.status === 'fulfilled').length;
  }
  return Response.json({ ok: true, sent, due: due?.length || 0 });
});
