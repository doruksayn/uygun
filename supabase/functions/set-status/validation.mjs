export function trustedPushEndpoint(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return false;
    return u.hostname === 'fcm.googleapis.com' ||
      u.hostname === 'web.push.apple.com' || u.hostname.endsWith('.push.apple.com') ||
      u.hostname === 'updates.push.services.mozilla.com' ||
      u.hostname.endsWith('.notify.windows.com');
  } catch { return false; }
}
export function statusInput(body) {
  return body && typeof body.available === 'boolean' ? body.available : null;
}
