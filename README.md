<div align=center>
  <a href=https://doruksayn.github.io/UYGUN/><img src=./public/icon-512.png alt=UYGUN width=112 /></a>
  <h1>UYGUN</h1>
  <p><strong>Hazır olduğunu tek dokunuşla haber ver.</strong></p>
  <p>İki arkadaş için uygunluk paylaşımı. Durumunu değiştir, arkadaşını dürt, planı başlat.</p>
  <a href=https://doruksayn.github.io/UYGUN/>Uygulamayı aç</a> &nbsp;·&nbsp; <a href=https://github.com/doruksayn/UYGUN>Kaynak kodu</a>
  <br /><br />
  <a href=https://github.com/doruksayn/UYGUN/actions/workflows/pages.yml><img src=https://github.com/doruksayn/UYGUN/actions/workflows/pages.yml/badge.svg alt=Deployment /></a>
</div>

## Neler yapar?

| Özellik | Açıklama |
|---|---|
| **Durum paylaşımı** | İki kişi birbirinin uygun olup olmadığını anlık görür. Durum değişince arkadaşına bildirim gider. |
| **Dürtme** | Arkadaşına `BIZZLATTI` bildirimi gönderir. Tekrar dürtmek için 15 dakika beklenir. |
| **Web bildirimleri** | Bildirimler cihaz başına açılıp kapatılır. |
| **Hatırlatma** | İsteğe bağlı kurulumla, iki saattir uygun görünen kişiye hatırlatma gönderilir. |
| **Telefon desteği** | Ana ekrana eklenebilen, mobil uyumlu bir web uygulaması. |

## Yerelde çalıştır

Node.js 22 veya üstü yeterli; bağımlılık kurmadan önizlemeyi aç:

```sh
node scripts/serve.mjs
```

Ardından <http://127.0.0.1:4173> adresini aç. Supabase ayarı yoksa uygulama veri paylaşmayan önizleme modunda çalışır.

| Komut | İşlev |
|---|---|
| `node --test` | Yerel testleri çalıştırır. |
| `node scripts/build.mjs` | `dist/` altında dağıtım çıktısını oluşturur. |
| `node scripts/serve.mjs --dist` | Derlenen çıktıyı yerelde açar. |

## Supabase ve GitHub Pages kurulumu

### Supabase

1. Supabase projesi oluştur, yeni kullanıcı kayıtlarını kapat ve yalnızca iki kullanıcı ekle.
2. SQL Editor'de `supabase/migrations/` içindeki dosyaları tarih sırasıyla çalıştır:

| Migration | İçerik |
|---|---|
| `202609220001_initial.sql` | Üyeler, bildirim abonelikleri ve erişim kuralları. |
| `202609220002_notify_both_states.sql` | Durum değişikliklerinde bildirim. |
| `202610010001_available_reminders.sql` | İki saatlik hatırlatma altyapısı. |
| `202610080001_pokes.sql` | Dürtme ve 15 dakikalık bekleme süresi. |

3. `public.members` tablosuna iki kullanıcıyı ekle. UUID'leri Supabase Auth kayıtlarından al:

```sql
insert into public.members (user_id, slot, display_name) values
  ('FIRST_AUTH_USER_UUID', 1, 'İlk kişi'),
  ('SECOND_AUTH_USER_UUID', 2, 'İkinci kişi');
```

4. VAPID anahtarlarını üret, Supabase projesini bağla ve fonksiyonları dağıt:

```sh
node scripts/generate-vapid.mjs
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set --env-file .env.push
supabase functions deploy set-status
supabase functions deploy poke
```

`.env.push` Git tarafından yok sayılır. Özel VAPID anahtarı yalnızca Supabase secrets içinde kalmalı; `public/config.js` veya GitHub Actions değişkenlerine koyma. `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` Edge Functions ortamında Supabase tarafından sağlanır.

### GitHub Pages

GitHub deposunda **Settings → Secrets and variables → Actions → Variables** bölümüne şu public değerleri ekle:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (anon veya publishable key; `service_role` ya da secret key değil)
- `VAPID_PUBLIC_KEY`

**Settings → Pages → Build and deployment → GitHub Actions** seç. `main` dalına gönderim Pages dağıtımını başlatır. Canlı adres: <https://doruksayn.github.io/UYGUN/>.

`APP_ORIGIN` yalnızca `https://doruksayn.github.io` olmalı; sonuna `/UYGUN/` ekleme. Uygulama içindeki dosya yolları göreli olduğu için repo adının büyük harfli olması çalışmayı etkilemez.

### İsteğe bağlı: iki saatlik hatırlatma

Supabase Function Secrets'e güçlü bir `REMINDER_TOKEN` ekle. Aynı token'ı Supabase Vault'ta `reminder_token` adıyla sakla; proje URL'sini ve public API key'ini de `project_url` ve `publishable_key` adlarıyla Vault'a ekle. `supabase/schedule-reminders.sql` dosyasını SQL Editor'de bir kez çalıştır ve fonksiyonu dağıt:

```sh
supabase functions deploy remind-available
```

## Güvenlik ve davranış

- Sistemde en fazla iki üye bulunur; yalnızca bu üyeler birbirinin durumunu görebilir.
- Sunucu istek sahibini doğrular; durum ve üyelik bilgileri istemciden doğrudan değiştirilemez.
- Durum bildirimi yalnızca durum gerçekten değiştiğinde gönderilir.
- Push abonelikleri kullanıcıya özeldir; çıkışta hesabın cihaz abonelikleri silinir.
- Çevrimdışıyken durum değiştirilemez. Kişisel durum bilgileri service worker önbelleğine alınmaz.
- Dürtme aralığı veritabanında uygulanır; hızlı istekler sınırı aşamaz.

## Yayın öncesi kontrol

- İki ayrı hesapla giriş yap; durumun diğer ekranda yenileme olmadan göründüğünü kontrol et.
- Uygun ve uygun değil durumlarında bildirimleri, ardından dürtme bekleme süresini dene.
- Bildirim izni ve çıkış akışlarını iki cihazda kontrol et; oturumsuz ve üçüncü kullanıcı isteklerinin reddedildiğini doğrula.

CI, `node --test` komutunu çalıştırıp derlemeden sonra Pages'i yayınlar. Erişim kontrolleri için `tests/access.sql` kullanılabilir. Gerçek telefonlarda push teslimatı henüz doğrulanmadı.
