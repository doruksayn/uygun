import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedPushEndpoint, statusInput } from '../supabase/functions/set-status/validation.mjs';
test('only real booleans are accepted',()=>{
  assert.equal(statusInput({available:true}),true);
  assert.equal(statusInput({available:false}),false);
  for(const input of [null,{}, {available:'true'}, {available:1}]) assert.equal(statusInput(input),null);
});
test('push destinations reject SSRF and deceptive domains',()=>{
  for(const url of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','https://evilpush.apple.com/a','https://fcm.googleapis.com:8443/a','https://user:pass@fcm.googleapis.com/a','not a url']) assert.equal(trustedPushEndpoint(url),false,url);
  for(const url of ['https://fcm.googleapis.com/fcm/send/a','https://web.push.apple.com/a','https://updates.push.services.mozilla.com/wpush/a','https://wns2.notify.windows.com/a']) assert.equal(trustedPushEndpoint(url),true,url);
});
