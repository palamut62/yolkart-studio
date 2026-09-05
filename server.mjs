import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4173);
const dataDirectory = path.join(root, ".data");
const settingsPath = path.join(dataDirectory, "provider-settings.json");
const patternsDirectory = path.join(dataDirectory, "patterns");
const cardArtDirectory = path.join(dataDirectory, "card-art");
const patternIndexPath = path.join(patternsDirectory, "index.json");
const profilesPath = path.join(dataDirectory, "profiles.json");
const patternFileRegex = /^pat-\d+\.(png|jpe?g|webp)$/;
const cardArtFileRegex = /^card-art-\d+\.(png|jpe?g|webp)$/;

const readProfiles = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeProfiles = (profiles) => {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), "utf8");
};

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const profileSlug = (value) => String(value || "")
  .toLocaleLowerCase("tr-TR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 48);

// Türkiye numaralarını E.164'e çevirir: "0532...", "532...", "0090532...", "+90532..." hepsi +90532... olur.
const phoneHref = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  else if (digits.length === 10) digits = `90${digits}`;
  return `+${digits}`;
};

const readPatternIndex = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(patternIndexPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writePatternIndex = (entries) => {
  fs.mkdirSync(patternsDirectory, { recursive: true });
  fs.writeFileSync(patternIndexPath, JSON.stringify(entries, null, 2), { encoding: "utf8" });
};

const readSettings = () => {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
};

const providerSettings = () => {
  const saved = readSettings();
  return {
    defaultProvider: saved.defaultProvider || "deepseek",
    deepseekModel: saved.deepseekModel || process.env.DEEPSEEK_MODEL || "deepseek-chat",
    openrouterModel: saved.openrouterModel || process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
    imageModel: saved.imageModel || process.env.OPENROUTER_IMAGE_MODEL || "bytedance-seed/seedream-4.5",
    deepseekKey: saved.deepseekKey || process.env.DEEPSEEK_API_KEY || "",
    openrouterKey: saved.openrouterKey || process.env.OPENROUTER_API_KEY || "",
  };
};

const extractText = (message) => {
  if (!message || typeof message !== "object") return "";
  let raw = message.content;
  if (Array.isArray(raw)) {
    raw = raw.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
  }
  if (typeof raw === "string" && raw.trim()) return raw;
  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) return message.reasoning_content;
  if (typeof message.reasoning === "string" && message.reasoning.trim()) return message.reasoning;
  return "";
};

const extractJson = (text) => {
  if (typeof text !== "string" || !text.trim()) return null;
  let cleaned = text.replace(/```json/gi, "```").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) end = i;
    }
  }
  if (end === -1) return null;
  const candidate = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

app.use(express.json({ limit: "32kb" }));

const allowedOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
app.use((request, response, next) => {
  const origin = request.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return response.status(403).json({ error: "Origin reddedildi." });
  }
  if (request.method === "POST") {
    const fetchSite = request.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return response.status(403).json({ error: "Çapraz kaynak isteği reddedildi." });
    }
  }
  next();
});

// Aynı adı taşıyan iki kişi birbirinin telefonunu ezmesin: çakışmada slug'a sayı eklenir.
const resolveSlug = (baseSlug, profiles, phone) => {
  if (!profiles[baseSlug] || phoneHref(profiles[baseSlug].phone) === phoneHref(phone)) return baseSlug;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${baseSlug}-${index}`;
    if (!profiles[candidate] || phoneHref(profiles[candidate].phone) === phoneHref(phone)) return candidate;
  }
  return "";
};

const profileWrites = new Map();
const rateLimited = (request) => {
  const now = Date.now();
  const key = request.ip || "local";
  const hits = (profileWrites.get(key) || []).filter((stamp) => now - stamp < 60_000);
  hits.push(now);
  profileWrites.set(key, hits);
  return hits.length > 60;
};

const MAX_PROFILES = 500;

app.post("/api/profiles", (request, response) => {
  if (rateLimited(request)) return response.status(429).json({ error: "Çok fazla istek. Bir dakika sonra tekrar deneyin." });
  const owner = String(request.body?.owner || "").trim().slice(0, 80);
  const phone = String(request.body?.phone || "").trim().slice(0, 32);
  const plate = String(request.body?.plate || "").trim().slice(0, 24);
  if (!owner || !phone) return response.status(400).json({ error: "Ad ve telefon numarası zorunludur." });
  if (phoneHref(phone).replace(/\D/g, "").length < 10) return response.status(400).json({ error: "Telefon numarası geçersiz." });
  const baseSlug = profileSlug(request.body?.slug || owner);
  if (!baseSlug) return response.status(400).json({ error: "Geçerli bir profil adı oluşturulamadı." });
  const profiles = readProfiles();
  const slug = resolveSlug(baseSlug, profiles, phone);
  if (!slug) return response.status(409).json({ error: "Bu isim için boş profil adresi kalmadı. Farklı bir ad kullanın." });
  if (!profiles[slug] && Object.keys(profiles).length >= MAX_PROFILES) {
    return response.status(507).json({ error: "Profil sayısı üst sınıra ulaştı." });
  }
  profiles[slug] = {
    owner,
    phone,
    plate,
    headline: String(request.body?.headline || "Araç sahibine ulaşın").trim().slice(0, 100),
    message: String(request.body?.message || "").trim().slice(0, 240),
    emergencyLabel: String(request.body?.emergencyLabel || "Acil durumda arayın").trim().slice(0, 80),
    accent: /^#[0-9a-f]{6}$/i.test(request.body?.accent) ? request.body.accent : "#ff4d45",
    updatedAt: new Date().toISOString(),
  };
  writeProfiles(profiles);
  return response.json({ ok: true, slug, url: `/u/${slug}` });
});

app.get("/u/:slug/vcard", (request, response) => {
  const profile = readProfiles()[profileSlug(request.params.slug)];
  if (!profile) return response.status(404).end();
  const safe = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/[\r\n]/g, " ").replace(/[;,]/g, "\\$&");
  const vcard = [
    "BEGIN:VCARD", "VERSION:3.0", `FN:${safe(profile.owner)}`,
    `TEL;TYPE=CELL:${safe(phoneHref(profile.phone))}`,
    `NOTE:${safe(profile.plate ? `Araç plakası: ${profile.plate}` : "YolKart araç iletişim kartı")}`,
    "END:VCARD",
  ].join("\r\n");
  response.set("Content-Type", "text/vcard; charset=utf-8");
  response.set("Content-Disposition", `attachment; filename="${profileSlug(profile.owner) || "yolkart"}.vcf"`);
  return response.send(vcard);
});

app.get("/u/:slug", (request, response) => {
  const slug = profileSlug(request.params.slug);
  const profile = readProfiles()[slug];
  if (!profile) {
    return response.status(404).send("<!doctype html><html lang=\"tr\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Kart bulunamadı</title><body style=\"font:16px system-ui;padding:40px\">Bu YolKart profili bulunamadı.</body></html>");
  }
  const owner = escapeHtml(profile.owner);
  const phone = escapeHtml(profile.phone);
  const plate = escapeHtml(profile.plate);
  const headline = escapeHtml(profile.headline);
  const message = escapeHtml(profile.message);
  const emergencyLabel = escapeHtml(profile.emergencyLabel);
  const accent = escapeHtml(profile.accent);
  const tel = escapeHtml(phoneHref(profile.phone));
  return response.type("html").send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${accent}"><title>${owner} - YolKart</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:22px;background:#f1f4f7;color:#101828;font:16px/1.45 Inter,system-ui,sans-serif}
.card{width:min(100%,430px);overflow:hidden;border:1px solid #dfe4ea;border-radius:28px;background:#fff;box-shadow:0 24px 70px #15223822}
.hero{position:relative;padding:34px 28px 30px;background:#101828;color:#fff}.hero:after{content:"";position:absolute;width:190px;height:190px;border-radius:50%;right:-80px;top:-90px;background:${accent}}
.brand{position:relative;z-index:1;display:flex;align-items:center;gap:9px;font-size:14px;font-weight:800;letter-spacing:.08em}.mark{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:${accent};color:#fff}
h1{position:relative;z-index:1;margin:34px 0 4px;font-size:30px;line-height:1.1;letter-spacing:-.04em}.plate{position:relative;z-index:1;margin:10px 0 0;color:#d0d5dd;font-weight:700}
.content{padding:26px 28px 30px}.eyebrow{margin:0 0 6px;color:${accent};font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.message{margin:0 0 24px;color:#667085}
.phone{display:block;margin-bottom:12px;padding:18px;border:1px solid #e4e7ec;border-radius:16px;color:#101828;text-decoration:none}.phone small{display:block;margin-bottom:4px;color:#667085}.phone strong{font-size:22px}
.actions{display:grid;gap:10px}.button{display:flex;align-items:center;justify-content:center;min-height:54px;border-radius:15px;background:${accent};color:#fff;text-decoration:none;font-weight:800}.button.secondary{border:1px solid #d0d5dd;background:#fff;color:#344054}
.privacy{margin:20px 0 0;text-align:center;color:#98a2b3;font-size:12px}
</style></head><body><main class="card">
<section class="hero"><div class="brand"><span class="mark">Y</span> YOLKART</div><h1>${owner}</h1>${plate ? `<p class="plate">🚘 ${plate}</p>` : ""}</section>
<section class="content"><p class="eyebrow">${headline}</p>${message ? `<p class="message">${message}</p>` : ""}
<a class="phone" href="tel:${tel}"><small>${emergencyLabel}</small><strong>${phone}</strong></a>
<div class="actions"><a class="button" href="tel:${tel}">📞 Şimdi ara</a><a class="button secondary" href="/u/${encodeURIComponent(slug)}/vcard">＋ Rehbere kaydet</a></div>
<p class="privacy">Yalnızca kart sahibinin paylaştığı iletişim bilgileri gösterilir.</p></section></main></body></html>`);
});

app.get("/api/pattern-search", async (request, response) => {
  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
  if (query.length < 2) return response.status(400).json({ error: "En az iki karakter girin." });
  try {
    const searches = [query, `${query} textile`, `${query} ornament`];
    const payloads = await Promise.all(searches.map(async (search) => {
      const params = new URLSearchParams({
        action: "query", format: "json", origin: "*", generator: "search",
        gsrsearch: search, gsrnamespace: "6", gsrlimit: "30", prop: "imageinfo",
        iiprop: "url|extmetadata|mime", iiurlwidth: "500",
      });
      const result = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(15000) });
      if (!result.ok) throw new Error();
      return result.json();
    }));
    const pages = new Map();
    payloads.forEach((payload) => Object.values(payload?.query?.pages ?? {}).forEach((page) => pages.set(page.pageid, page)));
    const wikimediaItems = Array.from(pages.values()).map((page) => {
      const info = page.imageinfo?.[0] ?? {};
      const metadata = info.extmetadata ?? {};
      return {
        id: page.pageid,
        title: String(page.title || "").replace(/^File:/, ""),
        thumbnail: info.thumburl ? `/api/pattern-image?url=${encodeURIComponent(info.thumburl)}` : "",
        sourceUrl: info.descriptionurl || "",
        license: metadata.LicenseShortName?.value || "Lisans bilgisi",
        artist: String(metadata.Artist?.value || "").replace(/<[^>]+>/g, "").slice(0, 100),
        mime: info.mime || "",
      };
    }).filter((item) => item.thumbnail && item.sourceUrl && item.mime.startsWith("image/") && !item.mime.includes("svg")).slice(0, 40).map(({ mime: _mime, ...item }) => item);

    let openverseItems = [];
    try {
      const ovParams = new URLSearchParams({ q: `${query} pattern`, license_type: "commercial", page_size: "20" });
      const ovResult = await fetch(`https://api.openverse.org/v1/images/?${ovParams}`, { signal: AbortSignal.timeout(15000) });
      if (ovResult.ok) {
        const ovPayload = await ovResult.json();
        openverseItems = (Array.isArray(ovPayload?.results) ? ovPayload.results : [])
          .filter((r) => r && r.thumbnail && r.foreign_landing_url)
          .map((r) => ({
            id: `ov-${r.id}`,
            title: String(r.title || "").slice(0, 100),
            thumbnail: `/api/pattern-image?url=${encodeURIComponent(r.thumbnail)}`,
            sourceUrl: r.foreign_landing_url,
            license: String(r.license || "").toUpperCase(),
            artist: String(r.creator || "").slice(0, 100),
          }));
      }
    } catch {
      openverseItems = [];
    }

    const items = [...wikimediaItems, ...openverseItems].slice(0, 60);
    return response.json({ items, count: items.length, query });
  } catch {
    return response.status(502).json({ error: "Desen araması şu anda kullanılamıyor." });
  }
});

app.get("/api/pattern-image", async (request, response) => {
  try {
    const source = new URL(String(request.query.url || ""));
    const isWikimedia = source.hostname === "upload.wikimedia.org" || source.hostname.endsWith(".upload.wikimedia.org");
    const isOpenverse = source.hostname === "api.openverse.org";
    if (source.protocol !== "https:" || !(isWikimedia || isOpenverse)) {
      return response.status(400).end();
    }
    const image = await fetch(source, { redirect: isOpenverse ? "follow" : "error", signal: AbortSignal.timeout(15000) });
    if (isOpenverse && !(image.url || "").startsWith("https:")) return response.status(400).end();
    const contentType = image.headers.get("content-type") || "";
    const contentLength = Number(image.headers.get("content-length") || 0);
    if (!image.ok || !contentType.startsWith("image/") || contentLength > 6_000_000) return response.status(400).end();
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length > 6_000_000) return response.status(413).end();
    response.set("Content-Type", contentType);
    response.set("Cache-Control", "public, max-age=86400");
    return response.send(bytes);
  } catch {
    return response.status(400).end();
  }
});

app.get("/api/settings", (_request, response) => {
  const settings = providerSettings();
  response.json({
    defaultProvider: settings.defaultProvider,
    deepseekModel: settings.deepseekModel,
    openrouterModel: settings.openrouterModel,
    imageModel: settings.imageModel,
    deepseekConfigured: Boolean(settings.deepseekKey),
    openrouterConfigured: Boolean(settings.openrouterKey),
  });
});

app.post("/api/settings", (request, response) => {
  const persisted = readSettings();
  const { defaultProvider, deepseekModel, openrouterModel, imageModel, deepseekKey, openrouterKey } = request.body ?? {};
  const validModel = (value) => typeof value === "string" && /^[a-zA-Z0-9._:/-]{2,100}$/.test(value);
  if (!["deepseek", "openrouter"].includes(defaultProvider) || !validModel(deepseekModel) || !validModel(openrouterModel) || !validModel(imageModel)) {
    return response.status(400).json({ error: "Sağlayıcı veya model bilgisi geçersiz." });
  }
  const saved = {
    defaultProvider,
    deepseekModel,
    openrouterModel,
    imageModel,
    deepseekKey: typeof deepseekKey === "string" && deepseekKey.trim() ? deepseekKey.trim() : persisted.deepseekKey || "",
    openrouterKey: typeof openrouterKey === "string" && openrouterKey.trim() ? openrouterKey.trim() : persisted.openrouterKey || "",
  };
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(saved, null, 2), { encoding: "utf8", mode: 0o600 });
  return response.json({
    defaultProvider: saved.defaultProvider,
    deepseekModel: saved.deepseekModel,
    openrouterModel: saved.openrouterModel,
    imageModel: saved.imageModel,
    deepseekConfigured: Boolean(saved.deepseekKey || process.env.DEEPSEEK_API_KEY),
    openrouterConfigured: Boolean(saved.openrouterKey || process.env.OPENROUTER_API_KEY),
  });
});

app.post("/api/models", async (request, response) => {
  const { provider, apiKey: submittedKey } = request.body ?? {};
  if (!["deepseek", "openrouter"].includes(provider)) return response.status(400).json({ error: "Sağlayıcı geçersiz." });
  const settings = providerSettings();
  const storedKey = provider === "deepseek" ? settings.deepseekKey : settings.openrouterKey;
  const apiKey = typeof submittedKey === "string" && submittedKey.trim() ? submittedKey.trim() : storedKey;
  if (!apiKey) return response.status(400).json({ error: "Önce bu sağlayıcı için API anahtarı girin." });
  const endpoint = provider === "deepseek" ? "https://api.deepseek.com/models" : "https://openrouter.ai/api/v1/models";
  try {
    const result = await fetch(endpoint, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) return response.status(result.status === 401 ? 401 : 502).json({ error: result.status === 401 ? "API anahtarı kabul edilmedi." : "Model listesi sağlayıcıdan alınamadı." });
    const models = (Array.isArray(payload.data) ? payload.data : [])
      .filter((item) => typeof item?.id === "string")
      .map((item) => ({ id: item.id, name: typeof item.name === "string" ? item.name : item.id }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 600);
    return response.json({ models });
  } catch {
    return response.status(502).json({ error: "Model servisine bağlanılamadı." });
  }
});

app.post("/api/ai-design", async (request, response) => {
  const { profession, city, tone, prompt, language, provider = "openrouter" } = request.body ?? {};
  const directDeepSeek = provider === "deepseek";
  const settings = providerSettings();
  const apiKey = directDeepSeek ? settings.deepseekKey : settings.openrouterKey;
  if (!apiKey) {
    return response.status(503).json({
      error: directDeepSeek
        ? "DeepSeek Direct için sunucuda DEEPSEEK_API_KEY tanımlanmalı."
        : "OpenRouter için sunucuda OPENROUTER_API_KEY tanımlanmalı.",
    });
  }

  if (![profession, city, tone, prompt].some((value) => typeof value === "string" && value.trim())) {
    return response.status(400).json({ error: "En az bir kişiselleştirme bilgisi girin." });
  }

  const templateIds = ["minimal", "night", "energy", "classic", "kilim", "bosphorus", "aegean", "cappadocia", "blacksea", "mediterranean", "retro", "technical", "teacher", "health", "engineer", "monochrome", "pastel", "neon", "nature", "premium", "charcoal", "executive", "cream", "blueprint", "neomint", "gothic", "pop", "postcard", "saas", "parkalert", "ui-glass", "ui-darkdev", "ui-command", "ui-neumorph", "ui-fluent", "ui-terminal", "ui-workspace", "ui-cyberpunk", "ui-brutal", "ui-clay", "racing", "boarding", "highway", "kilimmodern", "iznik", "sunset"];
  const patternIds = ["none", "cintemani", "elibelinde", "kocboynuzu", "nazar", "kilim-zigzag", "grid-dots", "hex-honeycomb", "triangle-mosaic", "cross-lines", "pixel-blocks", "iso-cubes", "pixel-checker", "film-strip", "sunburst", "leaf-branch", "waves"];
  const fontFamilies = ["inter", "montserrat", "poppins", "space-grotesk", "playfair", "georgia", "segoe", "jetbrains"];
  const schema = {
    name: "vehicle_card_design",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "message", "templateId", "backgroundColor", "textColor", "accent", "qrColor", "fontFamily", "motif", "builtinPatternId", "accentShape", "patternDensity", "backgroundOpacity", "overlayColor", "overlayOpacity", "qrStyle", "textAlign", "borderWidth", "radius", "emergencyLabel"],
      properties: {
        headline: { type: "string", maxLength: 42, description: "Vehicle contact call-to-action. Never a person's name or profession alone." },
        message: { type: "string", maxLength: 90, description: "Short instruction explaining that scanning or tapping contacts the vehicle owner." },
        accent: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        qrColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        templateId: { type: "string", enum: templateIds },
        backgroundColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        textColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        fontFamily: { type: "string", enum: fontFamilies },
        motif: { type: "string", enum: ["geometric", "kilim", "waves", "city-lines", "floral", "none"] },
        builtinPatternId: { type: "string", enum: patternIds },
        accentShape: { type: "string", enum: ["default", "circle", "ring", "blob", "ribbon", "stripe", "wave", "none"] },
        patternDensity: { type: "integer", minimum: 1, maximum: 12 },
        backgroundOpacity: { type: "integer", minimum: 5, maximum: 45 },
        overlayColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        overlayOpacity: { type: "integer", minimum: 0, maximum: 55 },
        qrStyle: { type: "string", enum: ["square", "rounded", "dots", "organic"] },
        textAlign: { type: "string", enum: ["left", "center"] },
        borderWidth: { type: "integer", minimum: 0, maximum: 8 },
        radius: { type: "integer", minimum: 0, maximum: 32 },
        emergencyLabel: { type: "string", maxLength: 36, description: "Natural human-readable emergency call label, never snake_case." },
      },
    },
  };
  const systemPrompt = `You are a Turkish vehicle contact-card art director. Turn the user's profession, city, tone and request into one coherent, print-safe card recipe. Never invent a person's name, phone, plate, company or other personal data. headline must be a vehicle-owner contact call-to-action, not a name or profession. message must explain scanning/tapping to contact the vehicle owner. emergencyLabel must be natural readable language with spaces, never snake_case. Choose only values from the supplied JSON schema. Use local culture respectfully and abstractly. Keep QR contrast high: qrColor must strongly contrast backgroundColor. Avoid official emblems, authority impersonation, political/religious symbols, harassment and sensitive data. Use either one restrained motif or one builtin pattern; when builtinPatternId is not none, set motif to none. Available template IDs represent real application skins; choose the closest fit. Output only valid JSON in ${language === "en" ? "English" : "Turkish"} matching every schema key. No prose and no markdown.`;
  const endpoint = directDeepSeek
    ? "https://api.deepseek.com/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(directDeepSeek
      ? {}
      : {
          "HTTP-Referer": request.get("origin") || "http://localhost",
          "X-Title": "YolKart Studio",
        }),
  };

  try {
    const requestBody = {
      model: directDeepSeek ? settings.deepseekModel : settings.openrouterModel,
      temperature: 0.8,
      max_tokens: 650,
      response_format: directDeepSeek
        ? { type: "json_object" }
        : { type: "json_schema", json_schema: schema },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ profession, city, tone, request: prompt }) },
      ],
    };
    const originalUserContent = requestBody.messages[1].content;
    let payload;
    let design = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt === 1) {
        requestBody.response_format = { type: "json_object" };
        requestBody.messages[1].content = `${originalUserContent}\nReturn ONLY one complete JSON object matching every requested design field. No prose, no markdown.`;
      }
      const aiResponse = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(requestBody), signal: AbortSignal.timeout(60000) });
      const responseText = await aiResponse.text();
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        if (attempt === 1) return response.status(502).json({ error: `AI sağlayıcısı geçersiz yanıt döndürdü (HTTP ${aiResponse.status}).` });
        continue;
      }
      if (!aiResponse.ok) {
        const providerMessage = payload?.error?.message || payload?.message || `HTTP ${aiResponse.status}`;
        if (attempt === 1) return response.status(502).json({ error: `AI sağlayıcı hatası: ${providerMessage}` });
        continue;
      }
      const message = payload?.choices?.[0]?.message;
      const content = extractText(message);
      if (!content) continue;
      const parsed = extractJson(content);
      if (parsed && typeof parsed === "object") {
        design = parsed;
        break;
      }
    }
    if (!design || typeof design !== "object") {
      return response.status(502).json({ error: "AI tasarımı üretilemedi. Lütfen tekrar deneyin veya farklı bir model seçin (örn. deepseek-chat)." });
    }

    const allowedMotifs = ["geometric", "kilim", "waves", "city-lines", "floral", "none"];
    const validColor = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
    const findHex = (value) => {
      if (typeof value !== "string") return "";
      const match = value.match(/#[0-9a-fA-F]{6}/);
      return match ? match[0] : "";
    };
    const toneText = String(tone || prompt || "").toLowerCase();
    const paletteAccent = () => {
      if (/sıcak|sicak|warm|kırmız|kirmiz|ateş|ates/.test(toneText)) return "#C0392B";
      if (/sakin|calm|huzur|mavi|blue/.test(toneText)) return "#1F6FEB";
      if (/doğa|doga|nature|yeşil|yesil|green/.test(toneText)) return "#2E7D32";
      if (/lüks|luks|luxury|mor|purple|premium/.test(toneText)) return "#8E44AD";
      return "#1F6FEB";
    };

    // headline
    if (typeof design.headline !== "string" || !design.headline.trim()) {
      const derived = `${profession || "ARACIMA"} • ${city || ""}`.trim().replace(/•\s*$/, "").trim();
      design.headline = derived || "ARACIMA ULAŞIN";
    }
    design.headline = String(design.headline).slice(0, 60);
    if (!/(ulaş|ulas|iletiş|iletis|araç|arac|contact|reach|vehicle)/i.test(design.headline)) {
      design.headline = language === "en" ? "CONTACT THE VEHICLE OWNER" : "ARAÇ SAHİBİNE ULAŞIN";
    }

    // message
    if (typeof design.message !== "string" || !design.message.trim()) {
      design.message = "QR kodu okutun veya telefonunuzu yaklaştırın.";
    }
    design.message = String(design.message).slice(0, 120);
    if (!/(qr|tara|yaklaştır|yaklastir|telefon|scan|tap|phone|contact)/i.test(design.message)) {
      design.message = language === "en" ? "Scan the QR code or bring your phone closer." : "QR kodu tarayın veya telefonunuzu yaklaştırın.";
    }

    // emergencyLabel
    if (typeof design.emergencyLabel !== "string" || !design.emergencyLabel.trim()) {
      design.emergencyLabel = "Acil durumda arayın";
    }
    design.emergencyLabel = String(design.emergencyLabel).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 48);

    // accent
    if (!validColor(design.accent)) {
      design.accent = findHex(design.accent) || paletteAccent();
    }
    if (!validColor(design.backgroundColor)) design.backgroundColor = "#FFFFFF";
    if (!validColor(design.textColor)) design.textColor = "#101828";
    if (!validColor(design.overlayColor)) design.overlayColor = design.backgroundColor;

    // qrColor
    if (!validColor(design.qrColor)) {
      design.qrColor = findHex(design.qrColor) || "#0B1220";
    }

    if (!templateIds.includes(design.templateId)) design.templateId = "minimal";
    if (!fontFamilies.includes(design.fontFamily)) design.fontFamily = "inter";
    if (!patternIds.includes(design.builtinPatternId)) design.builtinPatternId = "none";
    if (design.builtinPatternId !== "none") design.motif = "none";
    if (!["default", "circle", "ring", "blob", "ribbon", "stripe", "wave", "none"].includes(design.accentShape)) design.accentShape = "default";
    if (!["square", "rounded", "dots", "organic"].includes(design.qrStyle)) design.qrStyle = "square";
    if (!["left", "center"].includes(design.textAlign)) design.textAlign = "left";
    const clampInteger = (value, min, max, fallback) => Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
    design.patternDensity = clampInteger(design.patternDensity, 1, 12, 5);
    design.backgroundOpacity = clampInteger(design.backgroundOpacity, 5, 45, 14);
    design.overlayOpacity = clampInteger(design.overlayOpacity, 0, 55, 0);
    design.borderWidth = clampInteger(design.borderWidth, 0, 8, 0);
    design.radius = clampInteger(design.radius, 0, 32, 18);

    // motif
    if (!allowedMotifs.includes(design.motif)) {
      const motif = String(design.motif || "").toLowerCase();
      if (/mesh|grid|geometric|geometr/.test(motif)) design.motif = "geometric";
      else if (/hali|halı|rug|kilim/.test(motif)) design.motif = "kilim";
      else if (/dalga|wave/.test(motif)) design.motif = "waves";
      else if (/sokak|street|line|çizgi|cizgi/.test(motif)) design.motif = "city-lines";
      else if (/çiçek|cicek|flower|floral/.test(motif)) design.motif = "floral";
      else if (/yok|none|hiç|hic/.test(motif)) design.motif = "none";
      else design.motif = "geometric";
    }

    return response.json({ design, model: payload?.model, provider });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen bağlantı hatası";
    return response.status(502).json({ error: `AI bağlantısı kurulamadı: ${detail}` });
  }
});

app.post("/api/ai-pattern", async (request, response) => {
  const settings = providerSettings();
  const apiKey = settings.openrouterKey;
  if (!apiKey) {
    return response.status(503).json({ error: "OpenRouter için sunucuda OPENROUTER_API_KEY tanımlanmalı." });
  }
  const prompt = typeof request.body?.prompt === "string" ? request.body.prompt.trim() : "";
  if (!prompt) {
    return response.status(400).json({ error: "Desen için kısa bir açıklama girin." });
  }
  const saved = readSettings();
  const model = process.env.OPENROUTER_IMAGE_MODEL || saved.openrouterImageModel || "google/gemini-2.5-flash-image";
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": request.get("origin") || "http://localhost",
    "X-Title": "YolKart Studio",
  };
  try {
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        modalities: ["image", "text"],
        messages: [{ role: "user", content: `Seamless repeating flat 2-color pattern tile, ${prompt}. No text, no watermark, tileable edges.` }],
      }),
      signal: AbortSignal.timeout(120000),
    });
    const responseText = await aiResponse.text();
    let payload;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      return response.status(502).json({ error: `AI sağlayıcısı geçersiz yanıt döndürdü (HTTP ${aiResponse.status}).` });
    }
    if (!aiResponse.ok) {
      const providerMessage = payload?.error?.message || payload?.message || `HTTP ${aiResponse.status}`;
      return response.status(502).json({ error: `AI sağlayıcı hatası: ${providerMessage}` });
    }
    const dataUri = payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof dataUri !== "string" || !dataUri.startsWith("data:")) {
      const providerMessage = payload?.error?.message || "Sağlayıcı görsel döndürmedi.";
      return response.status(502).json({ error: `Desen üretilemedi: ${providerMessage}` });
    }
    const match = /^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i.exec(dataUri);
    if (!match) {
      return response.status(502).json({ error: "Desen görseli beklenen biçimde değil." });
    }
    const subtype = match[2].toLowerCase();
    const extension = subtype === "jpeg" || subtype === "jpg" ? "jpeg" : subtype;
    const file = `pat-${Date.now()}.${extension}`;
    try {
      fs.mkdirSync(patternsDirectory, { recursive: true });
      fs.writeFileSync(path.join(patternsDirectory, file), Buffer.from(match[3], "base64"));
      const index = readPatternIndex();
      index.push({ file, prompt, createdAt: new Date().toISOString() });
      writePatternIndex(index);
    } catch {
      return response.status(500).json({ error: "Desen sunucuya kaydedilemedi." });
    }
    return response.json({ image: dataUri, id: file, url: `/api/saved-patterns/${file}` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bilinmeyen bağlantı hatası";
    return response.status(502).json({ error: `AI bağlantısı kurulamadı: ${detail}` });
  }
});

app.post("/api/ai-card-art", async (request, response) => {
  const settings = providerSettings();
  if (!settings.openrouterKey) return response.status(503).json({ error: "Görsel üretmek için OpenRouter API anahtarı gerekli." });
  const prompt = String(request.body?.prompt || "").trim();
  if (prompt.length < 4 || prompt.length > 800) return response.status(400).json({ error: "Görsel isteği 4-800 karakter olmalı." });
  const artPrompt = `Full-bleed abstract decorative background texture for a portrait vehicle contact card, 2:3 aspect ratio. ${prompt}. Background texture only, edge-to-edge. No card mockup, no interface, no content panels, no white placeholder boxes, no labels and no reserved QR area. Absolutely no text, letters, glyphs, numbers, logos, icons, QR codes, barcodes, NFC symbols, watermarks, official emblems, license plates or realistic documents. Professional flat graphic design, restrained detail, subtle contrast so real content can be overlaid later.`;
  try {
    const imageResponse = await fetch("https://openrouter.ai/api/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": request.get("origin") || "http://localhost",
        "X-Title": "YolKart Studio",
      },
      body: JSON.stringify({
        model: settings.imageModel,
        prompt: artPrompt,
        n: 1,
        resolution: "4K",
        aspect_ratio: "2:3",
        quality: "high",
        output_format: "png",
        background: "opaque",
      }),
      signal: AbortSignal.timeout(180000),
    });
    const payload = await imageResponse.json().catch(() => ({}));
    if (!imageResponse.ok) {
      return response.status(502).json({ error: `Görsel modeli hatası: ${payload?.error?.message || `HTTP ${imageResponse.status}`}` });
    }
    const image = payload?.data?.[0];
    if (typeof image?.b64_json !== "string" || !image.b64_json) return response.status(502).json({ error: "Görsel modeli resim döndürmedi." });
    const mediaType = typeof image.media_type === "string" ? image.media_type : "image/png";
    const extension = mediaType.includes("webp") ? "webp" : mediaType.includes("jpeg") || mediaType.includes("jpg") ? "jpeg" : "png";
    const bytes = Buffer.from(image.b64_json, "base64");
    if (!bytes.length || bytes.length > 12_000_000) return response.status(502).json({ error: "Üretilen görsel boyutu geçersiz." });
    const file = `card-art-${Date.now()}.${extension}`;
    fs.mkdirSync(cardArtDirectory, { recursive: true });
    fs.writeFileSync(path.join(cardArtDirectory, file), bytes);
    return response.json({ ok: true, url: `/api/card-art/${file}`, model: settings.imageModel });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Bağlantı hatası";
    return response.status(502).json({ error: `Kart görseli üretilemedi: ${detail}` });
  }
});

app.get("/api/card-art/:file", (request, response) => {
  const file = request.params.file;
  if (!cardArtFileRegex.test(file)) return response.status(404).end();
  return response.sendFile(file, { root: cardArtDirectory, headers: { "Cache-Control": "public, max-age=31536000" } }, (error) => {
    if (error && !response.headersSent) response.status(404).end();
  });
});

app.get("/api/saved-patterns", (_request, response) => {
  const index = readPatternIndex();
  const items = index
    .filter((entry) => entry && typeof entry.file === "string" && fs.existsSync(path.join(patternsDirectory, entry.file)))
    .map((entry) => ({ id: entry.file, prompt: entry.prompt || "", url: `/api/saved-patterns/${entry.file}` }))
    .reverse();
  return response.json({ items });
});

app.get("/api/saved-patterns/:file", (request, response) => {
  const file = request.params.file;
  if (!patternFileRegex.test(file)) return response.status(404).end();
  return response.sendFile(file, {
    root: patternsDirectory,
    headers: { "Cache-Control": "public, max-age=31536000" },
  }, (error) => {
    if (error && !response.headersSent) response.status(404).end();
  });
});

app.delete("/api/saved-patterns/:file", (request, response) => {
  const file = request.params.file;
  if (!patternFileRegex.test(file)) return response.status(404).json({ error: "Geçersiz dosya." });
  try {
    fs.rmSync(path.join(patternsDirectory, file), { force: true });
    writePatternIndex(readPatternIndex().filter((entry) => entry?.file !== file));
  } catch {
    return response.status(500).json({ error: "Desen silinemedi." });
  }
  return response.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.use((_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, "127.0.0.1", () => {
  console.log(`YolKart Studio: http://127.0.0.1:${port}`);
});
