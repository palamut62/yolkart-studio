# YolKart Studio

Araç iletişim kartı (QR + NFC) tasarım stüdyosu. Şablon seçip metin, renk, yazı tipi ve
deseni düzenler; kartı baskıya uygun PNG olarak dışa aktarır. İsteğe bağlı olarak
AI ile tasarım ve arka plan deseni üretir.

## Özellikler

- 60'a yakın kart şablonu (araç, kimlik, yaka kartı, boyunluk, broşür formatları)
- Sürükle-bırak öğe düzenleme, öğe bazlı renk/yazı tipi/boyut, şablon başına kayıt
- QR hedefi: **Telefonu ara** (`tel:`), **Rehbere ekle** (internet gerektirmeyen vCard),
  **Profil kartını aç** (sunucuda barındırılan mobil sayfa)
- Yerleşik desen kütüphanesi + Wikimedia Commons / Openverse desen arama
- AI tasarım (DeepSeek veya OpenRouter) ve AI kart görseli üretimi
- WCAG kontrast garantili palet üretici

## Kurulum

```bash
npm install
```

`.env.example` dosyasını `.env` olarak kopyalayıp anahtarları doldurun (AI özellikleri
kullanılmayacaksa boş bırakılabilir). Anahtarlar arayüzdeki **Ayarlar** panelinden de
girilebilir; yalnızca yerel sunucuda `.data/provider-settings.json` içinde saklanır ve
arayüze geri gönderilmez.

## Çalıştırma

Geliştirme (Vite middleware ile):

```bash
npm run dev
```

Üretim:

```bash
npm run build && npm start
```

Sunucu yalnızca `127.0.0.1` üzerinde dinler; varsayılan adres <http://127.0.0.1:4173>.

## Veri ve gizlilik

- Tüm tasarım durumu tarayıcıda `localStorage` içinde tutulur.
- Yayınlanan profiller, API anahtarları ve üretilen görseller proje kökündeki `.data/`
  klasöründe kalır; hiçbir yere gönderilmez.
- `/u/<slug>` profil sayfası yalnızca kart sahibinin girdiği ad, plaka ve telefonu gösterir.
- AI özellikleri açıkken sadece meslek/şehir/ton/istek metni sağlayıcıya iletilir;
  ad, telefon ve plaka gönderilmez.

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `PORT` | Sunucu portu (varsayılan `4173`) |
| `OPENROUTER_API_KEY` | OpenRouter tasarım ve görsel üretimi |
| `OPENROUTER_MODEL` | Metin modeli kimliği |
| `OPENROUTER_IMAGE_MODEL` | Görsel modeli kimliği |
| `DEEPSEEK_API_KEY` | DeepSeek Direct tasarım üretimi |
| `DEEPSEEK_MODEL` | DeepSeek model kimliği |

---

Ürün sahibi: **Umut Çelik** — [X](https://x.com/palamut62) · [GitHub](https://github.com/palamut62)
