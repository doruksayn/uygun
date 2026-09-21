# Uygun

İki kişi için mobil uyumlu uygunluk uygulaması. Bir dokunuşla durum değiştir; arkadaşın uygun olduğunda web bildirimi al.

## Durum

İlk sürümün kaynak kodu hazır. Supabase bağlanmadığında açıkça işaretlenmiş, geçici bir önizleme açılır. Önizleme gerçek veri kaydetmez, başka cihazlarla eşitlemez veya bildirim göndermez. Canlı kurulum ve iki fiziksel cihazla bildirim testi ayrıca tamamlanmalıdır.

## Yerelde çalıştır

Node.js 22 veya üzeri yeterli; yerel önizleme için npm install gerekmez.

```sh
node scripts/serve.mjs
```

http://127.0.0.1:4173 adresini aç. Kaynaklar `public/` içindedir. Supabase istemcisi canlı modda sürümü sabitlenmiş ESM CDN'den yüklenir. Yazı tipleri Google Fonts'tan gelir; sistem fontu yedeği vardır.

```sh
node --test
node scripts/build.mjs
node scripts/serve.mjs --dist
```

## Canlı kurulum

1. Supabase'te bir proje oluştur. Database şifresini güvenli bir yerde sakla; repoya veya sohbete koyma.
2. SQL Editor'de `supabase/migrations/202609220001_initial.sql` dosyasını bir kez çalıştır.
3. Authentication ayarlarında yeni kullanıcı kaydını kapat. Users ekranında yalnızca iki kullanıcı oluştur. Her kullanıcı kendi güçlü şifresini güvenli yoldan belirlesin; gerçek şifreleri kaynak kodda tutma.
4. SQL Editor'de aşağıdaki örnekte UUID ve isimleri kendi iki kullanıcınla değiştir. Bu gerçek kullanıcı bilgileri repoya kaydedilmemelidir.

```sql
insert into public.members (user_id, slot, display_name) values
  ('FIRST_AUTH_USER_UUID', 1, 'İlk kişi'),
  ('SECOND_AUTH_USER_UUID', 2, 'İkinci kişi');
```

5. `node scripts/generate-vapid.mjs` çalıştır. Bildirim anahtarları Git tarafından yok sayılan `.env.push` dosyasına yazılır. Özel anahtar yalnızca Supabase Edge Function secrets alanında kalmalı.
6. Supabase CLI ile projeyi bağlayıp fonksiyonu yayınla (veya Dashboard'daki Edge Functions editörüne iki fonksiyon dosyasını birlikte ekle):

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set --env-file .env.push
supabase functions deploy set-status
```

`APP_ORIGIN=https://doruksayn.github.io` olmalı; origin içine `/uygun/` yolu eklenmez. `VAPID_SUBJECT` geçerli bir HTTPS iletişim adresi veya mailto adresi olmalıdır. `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Supabase fonksiyon ortamında sağlanır. Fonksiyon `verify_jwt=false` kullanır ancak her isteğin Bearer token'ını `auth.getUser(token)` ile doğrular; ardından yalnızca iki üyeden biri olup olmadığını kontrol eder. Doğrulama başarısızsa hiçbir durum/veri işlemi yapılmaz.

7. GitHub → Settings → Secrets and variables → Actions → Variables bölümüne üç PUBLIC değeri ekle:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (anon JWT veya publishable key; service_role / secret key ASLA değil)
   - `VAPID_PUBLIC_KEY`
8. Settings → Pages → Source olarak GitHub Actions seç. Actions'tan Publish Uygun akışını çalıştır veya main'e push yap. Eksik değişkenlerle akış bilerek hata verir; yanlışlıkla demo yayınlamaz.
9. Beklenen adres: https://doruksayn.github.io/uygun/ (ancak başarılı dağıtımdan sonra açılır).

Yerelde canlı modu denemek için `public/config.js` içindeki üç PUBLIC alanı doldur veya ortam değişkenlerini tanımlayıp build al. Özel anahtarları hiçbir zaman bu dosyaya yazma. `.env` dosyaları otomatik okunmaz; build ortam değişkenlerini kullanır.

## Güvenlik ve davranış

- En fazla iki üye: veritabanındaki benzersiz slot yalnızca 1 veya 2 olabilir.
- Anonymous kullanıcılar durumu okuyamaz. Giriş yapmış ama üye olmayan hesaplar da okuyamaz.
- İstemci üyeleri veya durum alanını doğrudan değiştiremez. Sunucu doğrulanmış kimlik üzerinden yalnızca kendi durumunu değiştirir.
- Bildirim abonelikleri yalnızca sahipleri tarafından okunup değiştirilebilir.
- Bildirim yalnızca false → true geçişinde denenir. Aynı değerin tekrar gönderilmesi yeni bildirim üretmez. Sunucu kilidi ve 60 saniyelik aralık hızlı tekrarları sınırlar.
- Bildirim gönderimi başarısız olsa da kaydedilen durum korunur. İlk sürüm otomatik bildirim yeniden deneme kuyruğu içermez; UI gönderim hatasını bildirir.
- Geçersiz push abonelikleri temizlenir; sunucu yalnızca bilinen HTTPS push servislerine istek gönderir.
- Çıkış, hesabın tüm cihazlardaki bildirim aboneliklerini siler. Diğer cihazlarda gerekirse kapat/aç yaparak tekrar etkinleştir.
- Çevrimdışıyken durum değiştirilemez; gösterilen bilgi son alınan durumdur. Ekrana dönüşte ve 30 saniyede bir veri yeniden alınır.
- iPhone: iOS 16.4+, Ana Ekrana Ekle, uygulamayı ikonundan aç, Bildirimleri aç. Android: desteklenen tarayıcı ve bildirim izni. İnternet, pil ve odak ayarları teslimatı etkiler.
- Service worker yalnızca push işler; kişisel durum verileri çevrimdışı önbelleğe alınmaz.

## Yayına çıkmadan kontrol

- İki ayrı cihaz/hesapla giriş; birindeki geçiş diğerinde yenilemesiz görünmeli.
- Uygulamalar kapalıyken false → true geçişi: yalnızca arkadaşın bildirim almalı.
- true → false, aynı durumun tekrarı ve 60 saniye içindeki hızlı geçişler bildirim yağmuru oluşturmamalı.
- Bildirimleri kapatınca ve çıkıştan sonra yeni bildirim gelmemeli.
- Oturumsuz istek, üçüncü kullanıcı, başka kullanıcı kimliği gönderen istek reddedilmeli.
- İnternet kesilince hatalı başarı gösterilmemeli; yeniden açılınca güncel durum alınmalı.

Mevcut otomatik testler: durum girdisi doğrulama, push endpoint güvenlik sınırı. RLS ve gerçek push teslimatı canlı proje kurulmadan doğrulanmış sayılmaz.
