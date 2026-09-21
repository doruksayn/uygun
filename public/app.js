const $ = id => document.getElementById(id);
const cfg = window.UYGUN_CONFIG || {};
const demo = !cfg.supabaseUrl || !cfg.supabaseKey;
let db, user, rows = [], busy = false, channel, refreshTimer;
const message = text => { $('message').textContent = text; };
const stamp = value => value ? `Son değişiklik: ${new Date(value).toLocaleString('tr-TR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}` : 'Henüz güncellenmedi';
function render() {
  const mine = rows.find(r => r.user_id === user?.id);
  const friend = rows.find(r => r.user_id !== user?.id);
  $('my-name').textContent = mine?.display_name || 'Sen';
  $('my-avatar').textContent = (mine?.display_name || 'Sen').slice(0,1);
  $('my-status').textContent = mine?.available ? 'Şu an uygunsun' : 'Şu an uygun değilsin';
  $('toggle').setAttribute('aria-pressed', String(!!mine?.available));
  $('toggle-label').textContent = mine?.available ? 'Uygun değilim' : 'Uygunum';
  $('toggle').disabled = busy || !mine || !navigator.onLine;
  $('my-time').textContent = stamp(mine?.updated_at);
  $('friend-name').textContent = friend?.display_name || 'Arkadaşın';
  $('friend-avatar').textContent = (friend?.display_name || 'Arkadaşın').slice(0,1);
  $('friend-status').textContent = !friend ? 'Henüz durum yok' : friend.available ? 'Şu an uygun' : 'Şu an uygun değil';
  $('friend-indicator').classList.toggle('available',!!friend?.available);
  $('friend-note').textContent = friend?.available ? 'Müsaitmiş. Oyuna ya da DC’ye çağır.' : 'Uygun olduğunda burada göreceksin.';
  $('friend-time').textContent = stamp(friend?.updated_at);
}
async function refresh() {
  if (!user || demo) return;
  const {data,error} = await db.from('members').select('user_id,display_name,available,updated_at');
  if (error) { $('connection').textContent='Bağlantı sorunu'; throw error; }
  if (!user) return;
  rows = data || []; render();
  if (!rows.find(r => r.user_id === user.id)) message('Hesabın henüz bu ikiliye eklenmemiş. Kurulumu yapan kişiyle görüş.');
}
async function setSession(session) {
  if (channel) { await db.removeChannel(channel); channel = null; }
  clearInterval(refreshTimer);
  user = session?.user; rows = [];
  $('login').hidden = !!user; $('dashboard').hidden = !user;
  if (!user) { $('connection').textContent='Özel alan'; return; }
  await refresh();
  channel = db.channel('availability').on('postgres_changes',{event:'*',schema:'public',table:'members'},() => refresh().catch(()=>message('Durum yenilenemedi. Bağlantını kontrol et.'))).subscribe(state => {
    $('connection').textContent = state === 'SUBSCRIBED' ? '● Canlı bağlantı' : 'Yeniden bağlanıyor';
    if(state === 'SUBSCRIBED') refresh().catch(()=>{});
  });
  refreshTimer = setInterval(()=>refresh().catch(()=>{}),30000);
  await updatePushLabel();
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); const button=event.submitter; button.disabled=true; message('');
  try { const {data,error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}); if(error) throw error; $('password').value=''; await setSession(data.session); }
  catch { message('Giriş yapılamadı. E-posta, şifre ve internet bağlantını kontrol et.'); }
  finally { button.disabled=false; }
});
$('toggle').addEventListener('click', async () => {
  if (busy) return;
  const mine=rows.find(r=>r.user_id===user.id); if(!mine) return;
  busy=true; render();
  try {
    if(demo) { mine.available=!mine.available; mine.updated_at=new Date().toISOString(); }
    else { const {data,error}=await db.functions.invoke('set-status',{body:{available:!mine.available}}); if(error) throw error; await refresh(); message(data?.push === 'failed' ? 'Durumun kaydedildi; bildirim gönderilemedi.' : ''); }
  } catch { message('Durum kaydedilemedi. Bağlantını kontrol edip tekrar dene.'); }
  finally { busy=false; render(); }
});
async function updatePushLabel() {
  if(demo || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  $('notifications').textContent=sub ? 'Bildirimleri kapat' : 'Bildirimleri aç';
}
$('notifications').addEventListener('click',async()=>{
  if(demo) { message('Önizlemede bildirim gönderilmez. Canlı bağlantı kurulunca açılacak.'); return; }
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) { message('iPhone’da Safari’den Ana Ekrana Ekle seçeneğiyle ekle, uygulamayı oradan aç. iOS 16.4 veya üzeri gerekir.'); return; }
  if(!cfg.vapidPublicKey) { message('Bildirim kurulumu henüz tamamlanmadı.'); return; }
  $('notifications').disabled=true;
  try {
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(sub) {
      const {error}=await db.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',sub.endpoint); if(error) throw error;
      await sub.unsubscribe(); message('Bu cihazda bildirimler kapatıldı.');
    } else {
      const permission=await Notification.requestPermission(); if(permission!=='granted') throw new Error('permission');
      const raw=atob(cfg.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/'));
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});
      const json=sub.toJSON();
      const {error}=await db.from('push_subscriptions').upsert({user_id:user.id,endpoint:sub.endpoint,subscription:json},{onConflict:'user_id,endpoint'});
      if(error) { await sub.unsubscribe(); throw error; }
      message('Bildirimler açık. Arkadaşın uygun olduğunda haber vereceğiz.');
    }
    await updatePushLabel();
  } catch { message('Bildirimler ayarlanamadı. Tarayıcı izinlerini ve bağlantını kontrol et.'); }
  finally { $('notifications').disabled=false; }
});
$('logout').addEventListener('click',async()=>{
  if(demo) { message('Bu bir önizleme; gerçek bir hesaba giriş yapılmadı.'); return; }
  try {
    const {error}=await db.from('push_subscriptions').delete().eq('user_id',user.id); if(error) throw error;
    if('serviceWorker' in navigator) { const reg=await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe(); }
    const result=await db.auth.signOut(); if(result.error) throw result.error; await setSession(null); message('Çıkış yapıldı. Hesabının bildirim abonelikleri kapatıldı.');
  } catch { message('Çıkış tamamlanamadı. Bağlantını kontrol edip tekrar dene.'); }
});
window.addEventListener('offline',()=>{ $('connection').textContent='Çevrimdışı · son durum'; render(); });
window.addEventListener('online',()=>{ refresh().catch(()=>{}); render(); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refresh().catch(()=>{}); });
async function start() {
  if('serviceWorker' in navigator) await navigator.serviceWorker.register('./sw.js');
  if(demo) {
    user={id:'preview-me'}; rows=[{user_id:user.id,display_name:'Sen',available:false},{user_id:'preview-friend',display_name:'Arkadaşın',available:false}];
    $('dashboard').hidden=false; $('connection').textContent='Tasarım önizlemesi'; message('Önizleme modu · Butonu deneyebilirsin. Durumlar paylaşılmaz ve bildirim gönderilmez.'); render(); return;
  }
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');
  db=createClient(cfg.supabaseUrl,cfg.supabaseKey);
  const {data,error}=await db.auth.getSession(); if(error) throw error;
  await setSession(data.session);
  db.auth.onAuthStateChange((event,session)=>{ if(event==='SIGNED_OUT') setTimeout(()=>setSession(null),0); });
}
start().catch(()=>message('Uygulama başlatılamadı. İnternet bağlantını ve proje ayarlarını kontrol et.'));
