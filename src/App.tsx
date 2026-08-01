import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import QRCode from "qrcode";
import {
  CarFront,
  Check,
  Copy,
  Download,
  FileText,
  Globe2,
  LoaderCircle,
  Minus,
  Nfc,
  Image as ImageIcon,
  Palette,
  Phone,
  Plus,
  Settings2,
  Search,
  Sparkles,
  SlidersHorizontal,
  Type,
  Upload,
  UserRound,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { templates, type CardTemplate } from "./templates";
import { builtinPatterns, patternCategories, patternDataUri } from "./patterns";

type Language = "tr" | "en";
type FormState = {
  owner: string;
  phone: string;
  plate: string;
  url: string;
  headline: string;
  language: Language;
  accent: string;
  backgroundColor: string;
  font: string;
  textColor?: string;
  qrColor: string;
  showPhone: boolean;
  showNfc: boolean;
  message: string;
  motif: string;
  showPattern: boolean;
  emergencyLabel: string;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundSize: "cover" | "contain" | "repeat";
  backgroundPosition: string;
  overlayColor: string;
  overlayOpacity: number;
  borderWidth: number;
  radius: number;
  letterSpacing: number;
  textAlign: "left" | "center";
  patternDensity: number;
  qrStyle: "square" | "rounded" | "dots" | "organic";
  qrBackgroundMode: "card" | "transparent" | "white";
  qrTarget: "phone" | "profile" | "vcard";
  cardFormat?: "vehicle" | "id" | "badge" | "lanyard" | "brochure";
  builtinPatternId?: string;
  accentShape?: string;
};

const accentShapeOptions: Array<{ id: string; label: string }> = [
  { id: "default", label: "Varsayılan" },
  { id: "circle", label: "Daire" },
  { id: "ring", label: "Halka" },
  { id: "blob", label: "Blob" },
  { id: "ribbon", label: "Kurdele" },
  { id: "stripe", label: "Şerit" },
  { id: "wave", label: "Dalga" },
  { id: "none", label: "Gizli" },
];

const accentShapePaths: Record<string, React.ReactNode> = {
  circle: <circle cx="50" cy="50" r="40" />,
  ring: <circle cx="50" cy="50" r="38" fill="none" stroke="var(--accent)" strokeWidth="13" />,
  blob: <path d="M50 8c16 0 34 9 38 26s-6 33-19 44-33 17-46 8S8 55 13 38 34 8 50 8Z" />,
  ribbon: <path d="M100 0v50L50 0Z" />,
  stripe: <path d="M0 68 L32 100 L100 36 L68 4 Z" />,
  wave: <path d="M0 72 Q25 56 50 72 T100 72 V100 H0 Z" />,
};

function AccentShapeSvg({ shape, className, card = false }: { shape: string; className?: string; card?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="var(--accent)" preserveAspectRatio={card ? "xMidYMid slice" : "xMidYMid meet"} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {accentShapePaths[shape]}
    </svg>
  );
}

type CardElementId = "background" | "accent" | "motif" | "headline" | "message" | "scanPanel" | "qr" | "nfc" | "dividerTop" | "owner" | "plate" | "dividerBottom" | "emergency";
type InlineTextStyle = { start: number; end: number; color?: string; fontFamily?: string; fontSize?: number };
type ElementLayout = Record<CardElementId, { x: number; y: number; scale: number; hidden: boolean; color?: string; fontFamily?: string; fontSize?: number; inlineStyles?: InlineTextStyle[] }>;
type SavedTemplate = { template: CardTemplate; form: FormState; layout: ElementLayout };
type PrintCardImage = { key: string; dataUrl: string; background: string };
const initialElementLayout = (): ElementLayout => ({
  background: { x: 0, y: 0, scale: 1, hidden: false },
  accent: { x: 0, y: 0, scale: 1, hidden: false },
  motif: { x: 0, y: 0, scale: 1, hidden: false },
  headline: { x: 0, y: 0, scale: 1, hidden: false },
  message: { x: 0, y: 0, scale: 1, hidden: false },
  scanPanel: { x: 0, y: 0, scale: 1, hidden: false },
  qr: { x: 0, y: 0, scale: 1, hidden: false },
  nfc: { x: 0, y: 0, scale: 1, hidden: false },
  dividerTop: { x: 0, y: 0, scale: 1, hidden: false },
  owner: { x: 0, y: 0, scale: 1, hidden: false },
  plate: { x: 0, y: 0, scale: 1, hidden: false },
  dividerBottom: { x: 0, y: 0, scale: 1, hidden: false },
  emergency: { x: 0, y: 0, scale: 1, hidden: false },
});
const normalizeElementLayout = (saved?: Partial<ElementLayout>): ElementLayout => {
  const defaults = initialElementLayout();
  (Object.keys(defaults) as CardElementId[]).forEach((id) => {
    defaults[id] = { ...defaults[id], ...(saved?.[id] || {}) };
  });
  return defaults;
};

const copy = {
  tr: {
    templates: "Şablonlar",
    customize: "Özelleştir",
    content: "İçerik",
    design: "Tasarım",
    ai: "AI Tasarla",
    saved: "Tüm değişiklikler kaydedildi",
    export: "Dışa aktar",
    owner: "Araç sahibi adı",
    phone: "Telefon numarası",
    plate: "Araç plakası",
    headline: "Başlık",
    url: "İletişim URL'si",
    urlHint: "QR kod tarandığında açılacak bağlantı.",
    language: "Dil",
    palette: "Renk paleti",
    typography: "Yazı tipi ailesi",
    qr: "QR kod ön plan rengi",
    showPhone: "Telefon numarasını göster",
    showNfc: "NFC'yi göster",
    showPattern: "Arka plan desenini göster",
    helper: "QR kodu tarayın veya telefonunuzu yaklaştırın",
    emergency: "Acil durumda arayın",
    downloaded: "Kart PNG olarak indirildi",
    profession: "Meslek",
    city: "Şehir / yöre",
    tone: "Anlatım tonu",
    aiRequest: "Nasıl bir kart istiyorsunuz?",
    generate: "AI ile tasarla",
    generating: "Tasarım hazırlanıyor",
    provider: "AI sağlayıcısı",
  },
  en: {
    templates: "Templates",
    customize: "Customize",
    content: "Content",
    design: "Design",
    ai: "AI Design",
    saved: "All changes saved",
    export: "Export",
    owner: "Vehicle owner name",
    phone: "Phone number",
    plate: "Vehicle plate",
    headline: "Headline",
    url: "Contact URL",
    urlHint: "The link opened when the QR code is scanned.",
    language: "Language",
    palette: "Color palette",
    typography: "Typeface",
    qr: "QR foreground color",
    showPhone: "Show phone number",
    showNfc: "Show NFC",
    showPattern: "Show background pattern",
    helper: "Scan the QR code or bring your phone closer",
    emergency: "Call in an emergency",
    downloaded: "Card downloaded as PNG",
    profession: "Profession",
    city: "City / region",
    tone: "Tone",
    aiRequest: "Describe the card you want",
    generate: "Design with AI",
    generating: "Creating design",
    provider: "AI provider",
  },
};

const palettes = ["#ff4d45", "#071b2d", "#008c91", "#f5c400", "#bd9b6c", "#667684"];

type Rgb = { r: number; g: number; b: number };
function hexToRgb(hex: string): Rgb {
  const h = (hex || "").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const int = parseInt(n, 16) || 0;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}
function rgbToHex({ r, g, b }: Rgb): string {
  const t = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}
function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}
function luminance({ r, g, b }: Rgb): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function readableInk(bg: Rgb): Rgb {
  const black = { r: 17, g: 17, b: 17 }, white = { r: 255, g: 255, b: 255 };
  return contrastRatio(bg, black) >= contrastRatio(bg, white) ? black : white;
}
// Tek marka renginden kontrast-garantili 4 palet üretir: {bg, accent, ink}
function brandPalettes(brandHex: string): Array<{ bg: string; accent: string; ink: string }> {
  const brand = hexToRgb(brandHex);
  const white = { r: 255, g: 255, b: 255 }, black = { r: 17, g: 17, b: 17 };
  const recipes = [
    { bg: mixRgb(brand, white, 0.9), accent: brand },
    { bg: white, accent: brand },
    { bg: mixRgb(brand, black, 0.86), accent: mixRgb(brand, white, 0.28) },
    { bg: black, accent: mixRgb(brand, white, 0.12) },
  ];
  return recipes.map(({ bg, accent }) => {
    const ink = readableInk(bg);
    let acc = accent;
    if (contrastRatio(bg, acc) < 2) acc = mixRgb(acc, ink, 0.45);
    return { bg: rgbToHex(bg), accent: rgbToHex(acc), ink: rgbToHex(ink) };
  });
}
const templateFormats: Record<NonNullable<FormState["cardFormat"]>, string[]> = {
  vehicle: ["minimal", "night", "energy", "classic", "saas", "parkalert", "gothic"],
  id: ["monochrome", "pastel", "teacher", "health", "cream", "executive"],
  badge: ["technical", "engineer", "neon", "premium", "blueprint", "charcoal"],
  lanyard: ["kilim", "bosphorus", "cappadocia", "retro", "pop", "neomint"],
  brochure: ["aegean", "blacksea", "mediterranean", "nature", "postcard"],
};
const uiStyleTemplateIds = [
  "ui-glass", "ui-darkdev", "ui-command", "ui-neumorph", "ui-fluent",
  "ui-terminal", "ui-workspace", "ui-winform", "ui-cyberpunk", "ui-brutal", "ui-clay",
];
const funTemplateGroups = [
  { title: "Retro & Arcade", ids: ["arcade", "synthwave", "cassette"] },
  { title: "Pop & Çizgi Roman", ids: ["comic", "popart", "sticker"] },
  { title: "Yol & Motorsport", ids: ["racing", "boarding", "highway"] },
  { title: "Kültür & Doğa", ids: ["kilimmodern", "iznik", "sunset"] },
  { title: "Pop Kültür & Oyun", ids: ["voxel", "galaxy", "hero", "manga", "pirate", "matrix"] },
];
const exportDimensions: Record<NonNullable<FormState["cardFormat"]>, { width: number; height: number; label: string }> = {
  vehicle: { width: 815, height: 1181, label: "69x100mm" },
  id: { width: 1011, height: 638, label: "85.6x54mm" },
  badge: { width: 1063, height: 709, label: "90x60mm" },
  lanyard: { width: 1181, height: 1654, label: "100x140mm" },
  brochure: { width: 1240, height: 1748, label: "105x148mm" },
};

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
}

function colorIsLight(color: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return true;
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return (red * 299 + green * 587 + blue * 114) / 255000 > .58;
}

function safeQrColor(color: string, background = "#ffffff") {
  return colorIsLight(background) === colorIsLight(color) ? (colorIsLight(background) ? "#071320" : "#ffffff") : color;
}

function phoneQrValue(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "tel:";
  return `tel:+${digits.startsWith("0") ? `90${digits.slice(1)}` : digits}`;
}

// İnternetsiz çalışan vCard: okutunca cihaz doğrudan "rehbere ekle" ekranını açar.
function vcardQrValue(form: FormState) {
  const esc = (v: string) => String(v || "").replace(/[\r\n]/g, " ").replace(/([;,\\])/g, "\\$1");
  const tel = phoneQrValue(form.phone).replace(/^tel:/, "");
  const note = form.plate ? `Araç plakası: ${form.plate}` : "YolKart araç iletişim kartı";
  return [
    "BEGIN:VCARD", "VERSION:3.0",
    `FN:${esc(form.owner)}`,
    `TEL;TYPE=CELL:${esc(tel)}`,
    form.url ? `URL:${esc(form.url)}` : "",
    `NOTE:${esc(note)}`,
    "END:VCARD",
  ].filter(Boolean).join("\r\n");
}

function StyledQr({ value, color, background, size, style }: { value: string; color: string; background: string; size: number; style: FormState["qrStyle"] }) {
  // Uzun yüklerde (vCard) "H" seviyesi matrisi aşırı yoğunlaştırıp küçük basımda okunmaz hale getirir.
  const matrix = useMemo(() => {
    const data = value || "https://yolkart.app";
    const level = data.length > 120 ? "M" : data.length > 60 ? "Q" : "H";
    return QRCode.create(data, { errorCorrectionLevel: level }).modules;
  }, [value]);
  const quiet = 4;
  const total = matrix.size + quiet * 2;
  const cells = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.get(row, column)) continue;
      const x = column + quiet;
      const y = row + quiet;
      const finder = (row < 7 && column < 7) || (row < 7 && column >= matrix.size - 7) || (row >= matrix.size - 7 && column < 7);
      if (finder || style === "square") {
        cells.push(<rect key={`${row}-${column}`} x={x} y={y} width="1" height="1" />);
      } else if (style === "dots" || (style === "organic" && (row + column) % 3 !== 0)) {
        cells.push(<circle key={`${row}-${column}`} cx={x + .5} cy={y + .5} r={style === "dots" ? .42 : .46} />);
      } else {
        cells.push(<rect key={`${row}-${column}`} x={x + .04} y={y + .04} width=".92" height=".92" rx={style === "rounded" ? .32 : .46} />);
      }
    }
  }
  return <svg className="styled-qr" width={size} height={size} viewBox={`0 0 ${total} ${total}`} role="img" aria-label="QR kod" data-qr-value={value} shapeRendering="geometricPrecision" fill={color}>{background !== "transparent" && <rect width={total} height={total} fill={background} />}{cells}</svg>;
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button className="toggle-row" type="button" onClick={onClick} aria-pressed={active}>
      <span>{label}</span>
      <span className={`switch ${active ? "active" : ""}`}><span /></span>
    </button>
  );
}

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function RangeControl({ label, value, min, max, unit = "", onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <label className="range-control">
      <span><b>{label}</b><output>{value}{unit}</output></span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function StyledText({ text, styles = [] }: { text: string; styles?: InlineTextStyle[] }) {
  if (!styles.length) return text;
  const points = new Set([0, text.length]);
  styles.forEach((style) => { points.add(Math.max(0, style.start)); points.add(Math.min(text.length, style.end)); });
  const sorted = [...points].sort((a, b) => a - b);
  return sorted.slice(0, -1).map((start, index) => {
    const end = sorted[index + 1];
    const active = styles.filter((style) => style.start <= start && style.end >= end);
    const color = [...active].reverse().find((style) => style.color)?.color;
    const fontFamily = [...active].reverse().find((style) => style.fontFamily)?.fontFamily;
    const fontSize = [...active].reverse().find((style) => style.fontSize)?.fontSize;
    return <span key={`${start}-${end}`} style={{ color, fontFamily, fontSize: fontSize ? `${fontSize}px` : undefined }}>{text.slice(start, end)}</span>;
  });
}

function CardPreview({ form, template, compact = false, zoom = 100, resetVersion = 0, initialLayout, onSave, onSaveAsTemplate, onResetAll, onLayoutChange, onSelectionChange, customShapes = [] }: { form: FormState; template: CardTemplate; compact?: boolean; zoom?: number; resetVersion?: number; initialLayout?: ElementLayout; onSave?: (layout: ElementLayout) => void; onSaveAsTemplate?: (layout: ElementLayout) => void; onResetAll?: () => void; onLayoutChange?: (layout: ElementLayout) => void; onSelectionChange?: (selected: CardElementId[]) => void; customShapes?: Array<{ id: string; name: string; dataUri: string }> }) {
  const cardText = copy[form.language];
  const effectiveMotif = form.showPattern === false ? "none" : form.backgroundImage ? "none" : form.motif === "none" ? template.motif : form.motif;
  const cardBackground = form.backgroundColor || template.bg;
  const qrBackground = form.qrBackgroundMode === "white" ? "#ffffff" : form.qrBackgroundMode === "transparent" ? "transparent" : cardBackground;
  const qrForeground = safeQrColor(form.qrColor, qrBackground === "transparent" ? cardBackground : qrBackground);
  const cardFormat = form.cardFormat || "vehicle";
  const [selected, setSelected] = useState<CardElementId[]>([]);
  const [layout, setLayout] = useState<ElementLayout>(() => compact ? normalizeElementLayout(initialLayout) : normalizeElementLayout(initialLayout));
  const cardBoundsRef = useRef<HTMLDivElement>(null);
  const elementNodes = useRef<Partial<Record<CardElementId, HTMLElement | null>>>({});
  const textSelectionRef = useRef<{ id: CardElementId; start: number; end: number } | null>(null);
  const labels: Record<CardElementId, string> = { background: "Arka plan görseli", accent: "Dekoratif şekil", motif: "Arka plan deseni", headline: "Başlık", message: "Açıklama", scanPanel: "QR ve NFC paneli", qr: "QR kod", nfc: "NFC işareti", dividerTop: "Üst yatay çizgi", owner: "Araç sahibi", plate: "Plaka", dividerBottom: "Alt yatay çizgi", emergency: "Acil durum bilgisi" };
  const elementStyle = (id: CardElementId) => ({
    transform: `translate(${layout[id].x}px, ${layout[id].y}px) scale(${layout[id].scale ?? 1})`,
    color: layout[id].color,
    fontFamily: layout[id].fontFamily,
    fontSize: layout[id].fontSize,
    "--accent": layout[id].color || form.accent || template.accent,
    "--ink": layout[id].color || form.textColor || template.ink,
  } as React.CSSProperties);
  const elementProps = (id: CardElementId) => compact ? { style: elementStyle(id) } : {
    ref: (node: HTMLElement | null) => { elementNodes.current[id] = node; },
    className: `editable-element editable-${id} ${selected.includes(id) ? "selected-element" : ""}`,
    style: elementStyle(id),
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      event.stopPropagation();
      textSelectionRef.current = null;
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      if (additive) {
        setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
        return;
      }
      const activeSelection = selected.includes(id) ? selected : [id];
      if (!selected.includes(id)) setSelected([id]);
      const bounds = event.currentTarget.getBoundingClientRect();
      const handleSize = 26;
      const handleHit = event.clientX >= bounds.right - handleSize && event.clientX <= bounds.right + 4 && event.clientY >= bounds.top - 4 && event.clientY <= bounds.top + handleSize;
      if (!handleHit) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const origins = Object.fromEntries(activeSelection.map((item) => [item, { ...layout[item] }])) as Partial<ElementLayout>;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      let animationFrame = 0;
      let latestX = startX;
      let latestY = startY;
      const commitPosition = () => {
        animationFrame = 0;
        setLayout((current) => {
          const next = { ...current };
          activeSelection.forEach((item) => {
            const origin = origins[item]!;
            next[item] = { ...current[item], x: origin.x + (latestX - startX) / (zoom / 100), y: origin.y + (latestY - startY) / (zoom / 100) };
          });
          return next;
        });
      };
      const move = (moveEvent: PointerEvent) => {
        latestX = moveEvent.clientX;
        latestY = moveEvent.clientY;
        if (!animationFrame) animationFrame = window.requestAnimationFrame(commitPosition);
      };
      const up = () => {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        commitPosition();
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", up);
        try { target.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", up);
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (!(event.target as HTMLElement).closest(".rich-text")) return;
      window.requestAnimationFrame(() => {
        const selection = window.getSelection();
        const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
        const richText = anchor?.closest<HTMLElement>(".rich-text[data-element-id]");
        if (!selection || !richText || selection.isCollapsed || !richText.contains(selection.focusNode)) return;
        const range = selection.getRangeAt(0);
        const prefix = range.cloneRange();
        prefix.selectNodeContents(richText);
        prefix.setEnd(range.startContainer, range.startOffset);
        const start = prefix.toString().length;
        textSelectionRef.current = { id: richText.dataset.elementId as CardElementId, start, end: start + range.toString().length };
      });
    },
    title: `${labels[id]} — seçin; Ctrl veya Shift ile çoklu seçim yapın`,
    tabIndex: 0,
    "aria-label": `${labels[id]} — seçmek için tıklayın, seçiliyken sürükleyin`,
  };
  const visible = (id: CardElementId) => !layout[id].hidden;
  const scanPanelProps = elementProps("scanPanel");

  useEffect(() => {
    if (compact) return;
    const removeSelected = (event: KeyboardEvent) => {
      if (!selected.length || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        setLayout((current) => {
          const next = { ...current };
          selected.forEach((item) => { next[item] = { ...next[item], hidden: true }; });
          return next;
        });
        setSelected([]);
        return;
      }
      const nudges: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const delta = nudges[event.key];
      if (delta) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        setLayout((current) => {
          const next = { ...current };
          selected.forEach((item) => { next[item] = { ...next[item], x: (next[item].x ?? 0) + delta[0] * step, y: (next[item].y ?? 0) + delta[1] * step }; });
          return next;
        });
      }
    };
    window.addEventListener("keydown", removeSelected);
    return () => window.removeEventListener("keydown", removeSelected);
  }, [compact, selected]);

  useEffect(() => {
    if (compact) return;
    const timeout = window.setTimeout(() => onLayoutChange?.(layout), 220);
    return () => window.clearTimeout(timeout);
  }, [compact, layout, onLayoutChange]);

  // Kart dışına taşan elemanları çalışma anında geri çek (transform reflow yapmaz, CSS yetmez)
  useEffect(() => {
    if (compact) return;
    const card = cardBoundsRef.current;
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    if (!cardRect.width || !cardRect.height) return;
    const scaleFactor = (zoom || 100) / 100;
    let changed = false;
    const next = { ...layout };
    (Object.keys(elementNodes.current) as CardElementId[]).forEach((id) => {
      if (id === "background" || id === "accent" || id === "motif") return; // tam kart katmanlari
      const node = elementNodes.current[id];
      const current = layout[id];
      if (!node || !current || current.hidden) return;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      // Eleman karttan buyukse once olcegi sigacak sekilde kucult
      const curScale = current.scale ?? 1;
      const fit = Math.min(1, (cardRect.width - 8) / rect.width, (cardRect.height - 8) / rect.height);
      if (fit < 0.995 && curScale > 0.2) {
        next[id] = { ...current, scale: Math.max(0.2, curScale * fit) };
        changed = true;
        return; // yeni olcumle bir sonraki turda konum duzeltilir
      }
      const shift = (start: number, end: number, min: number, max: number) => {
        if (end - start > max - min) return min - start;
        if (start < min) return min - start;
        if (end > max) return max - end;
        return 0;
      };
      const dx = shift(rect.left, rect.right, cardRect.left, cardRect.right);
      const dy = shift(rect.top, rect.bottom, cardRect.top, cardRect.bottom);
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        next[id] = { ...current, x: (current.x ?? 0) + dx / scaleFactor, y: (current.y ?? 0) + dy / scaleFactor };
        changed = true;
      }
    });
    if (changed) setLayout(next);
  }, [compact, layout, zoom]);

  useEffect(() => {
    if (!compact) onSelectionChange?.(selected);
  }, [compact, onSelectionChange, selected]);

  useEffect(() => {
    if (compact) return;
    const applySelectedStyle = (event: Event) => {
      const style = (event as CustomEvent<{ color?: string; fontFamily?: string; fontSize?: number }>).detail;
      if (!selected.length || !style) return;
      const selection = window.getSelection();
      const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement;
      const richText = anchor?.closest<HTMLElement>(".rich-text[data-element-id]");
      if (selection && richText && !selection.isCollapsed && richText.contains(selection.focusNode)) {
        const id = richText.dataset.elementId as CardElementId;
        const range = selection.getRangeAt(0);
        const prefix = range.cloneRange();
        prefix.selectNodeContents(richText);
        prefix.setEnd(range.startContainer, range.startOffset);
        const start = prefix.toString().length;
        const end = start + range.toString().length;
        textSelectionRef.current = { id, start, end };
        setLayout((current) => ({
          ...current,
          [id]: { ...current[id], inlineStyles: [...(current[id].inlineStyles || []), { start, end, ...style }] },
        }));
        return;
      }
      if (textSelectionRef.current) {
        const { id, start, end } = textSelectionRef.current;
        setLayout((current) => ({
          ...current,
          [id]: { ...current[id], inlineStyles: [...(current[id].inlineStyles || []), { start, end, ...style }] },
        }));
        return;
      }
      setLayout((current) => {
        const next = { ...current };
        selected.forEach((item) => { next[item] = { ...next[item], ...style }; });
        return next;
      });
    };
    window.addEventListener("yolkart-apply-selected-style", applySelectedStyle);
    return () => window.removeEventListener("yolkart-apply-selected-style", applySelectedStyle);
  }, [compact, selected]);

  useEffect(() => {
    if (resetVersion > 0) {
      setLayout(normalizeElementLayout(loadLocal("yolkart-saved-layout", initialElementLayout())));
      setSelected([]);
    }
  }, [resetVersion]);

  return (
    <div className={`card-stage ${compact ? "compact-stage" : ""}`}>
    <div ref={cardBoundsRef} className={`vehicle-card format-${cardFormat} template-${template.id} align-${form.textAlign} ${form.showPattern !== false && form.backgroundImage ? "has-custom-background" : ""} ${compact ? "compact-card" : "is-editing"}`} onPointerDown={() => !compact && setSelected(form.showPattern !== false && form.backgroundImage ? ["background"] : [])} style={{ "--card-bg": cardBackground, "--accent": form.accent || template.accent, "--ink": form.textColor || template.ink, "--letter-spacing": `${form.letterSpacing}px`, "--pattern-unit": `${Math.round(190 / form.patternDensity)}px`, "--image-repeat-size": `${Math.round(720 / form.patternDensity)}px`, "--pattern-opacity": form.backgroundOpacity / 100, fontFamily: form.font || template.font, borderRadius: form.radius, outline: form.borderWidth ? `${form.borderWidth}px solid ${form.accent}` : undefined, outlineOffset: form.borderWidth ? -form.borderWidth : undefined } as React.CSSProperties}>
      {form.showPattern !== false && form.backgroundImage && visible("background") && <div {...elementProps("background")}><div className={`custom-background size-${form.backgroundSize}`} style={{ backgroundImage: `url("${form.backgroundImage.replace(/"/g, "%22")}")`, backgroundPosition: form.backgroundPosition, opacity: form.backgroundOpacity / 100 }} /></div>}
      {form.overlayOpacity > 0 && <div className="background-overlay" style={{ background: form.overlayColor, opacity: form.overlayOpacity / 100 }} />}
      {(form.accentShape || "default") !== "none" && visible("accent") && (() => {
        const customShape = customShapes.find((s) => s.id === form.accentShape);
        return <span {...elementProps("accent")}>{customShape ? <img src={customShape.dataUri} className="accent-svg" alt="" style={{ objectFit: "cover", width: "100%", height: "100%" }} /> : (form.accentShape || "default") === "default" ? <span className="accent-shape" /> : <AccentShapeSvg shape={form.accentShape || "default"} className="accent-svg" card />}</span>;
      })()}
      <div className="card-copy">
        {visible("headline") && <div {...elementProps("headline")}><h2 className="rich-text" data-element-id="headline"><StyledText text={form.headline} styles={layout.headline.inlineStyles} /></h2></div>}
        {visible("message") && <div {...elementProps("message")}><p className="rich-text" data-element-id="message"><StyledText text={form.message || cardText.helper} styles={layout.message.inlineStyles} /></p></div>}
      </div>
      {effectiveMotif !== "none" && visible("motif") && <div {...elementProps("motif")}><div className={`motif motif-${effectiveMotif}`} aria-hidden="true" /></div>}
      {visible("scanPanel") && <div {...scanPanelProps} className={`${scanPanelProps.className || ""} scan-row`.trim()}>
        {visible("qr") && <div {...elementProps("qr")}><div className="qr-block"><StyledQr value={form.qrTarget === "profile" ? form.url : form.qrTarget === "vcard" ? vcardQrValue(form) : phoneQrValue(form.phone)} size={compact ? 58 : 172} color={layout.qr.color || qrForeground} background={qrBackground} style={form.qrStyle} /><span>{form.language === "tr" ? "TARA" : "SCAN"}</span></div></div>}
        {form.showNfc && visible("nfc") && <div {...elementProps("nfc")}><div className="nfc-mark"><Nfc /><strong>NFC</strong></div></div>}
      </div>}
      <div className="identity">
        {visible("dividerTop") && <div {...elementProps("dividerTop")}><span className="card-divider" /></div>}
        {visible("owner") && <div {...elementProps("owner")}><UserRound /><strong className="rich-text" data-element-id="owner"><StyledText text={form.owner} styles={layout.owner.inlineStyles} /></strong></div>}
        {visible("plate") && <div {...elementProps("plate")}><CarFront /><strong className="rich-text" data-element-id="plate"><StyledText text={form.plate} styles={layout.plate.inlineStyles} /></strong></div>}
        {visible("dividerBottom") && <div {...elementProps("dividerBottom")}><span className="card-divider" /></div>}
      </div>
      {form.showPhone && visible("emergency") && <div {...elementProps("emergency")}><div className="emergency"><Phone /><span>{form.emergencyLabel || cardText.emergency}</span><strong>{form.phone}</strong></div></div>}
    </div>
      {!compact && <div className="element-editor" data-export-ignore="true" onPointerDown={(event) => event.stopPropagation()}>
        <span>{selected.length ? `${selected.length} öğe seçildi — Ctrl/Shift ile seçime ekleyin` : "Öğeyi seçin; Ctrl/Shift ile çoklu seçin"}</span>
        <input className="element-color" type="color" disabled={!selected.length} value={selected[0] ? (layout[selected[0]].color || form.textColor || template.ink) : "#000000"} aria-label="Seçili metin veya öğe rengi" onChange={(event) => window.dispatchEvent(new CustomEvent("yolkart-apply-selected-style", { detail: { color: event.target.value } }))} />
        <select className="element-font" disabled={!selected.length} value={selected[0] ? (layout[selected[0]].fontFamily || form.font) : form.font} aria-label="Seçili metin veya öğe yazı tipi" onChange={(event) => window.dispatchEvent(new CustomEvent("yolkart-apply-selected-style", { detail: { fontFamily: event.target.value } }))}>
          <option value="'Segoe UI', Arial, sans-serif">Segoe UI</option><option value="'Inter', sans-serif">Inter</option><option value="'Montserrat', sans-serif">Montserrat</option><option value="'Poppins', sans-serif">Poppins</option><option value="'Space Grotesk', sans-serif">Space Grotesk</option><option value="Georgia, serif">Georgia</option><option value="'JetBrains Mono', monospace">JetBrains Mono</option>
        </select>
        <input className="element-size" type="number" min="8" max="72" defaultValue="18" disabled={!selected.length} aria-label="Seçili metin veya öğe boyutu" onChange={(event) => window.dispatchEvent(new CustomEvent("yolkart-apply-selected-style", { detail: { fontSize: Number(event.target.value) } }))} />
        <button type="button" disabled={!selected.length} aria-label="Seçili öğeleri küçült" onClick={(event) => { event.stopPropagation(); setLayout((current) => { const next = { ...current }; selected.forEach((item) => { next[item] = { ...next[item], scale: Math.max(.35, (next[item].scale ?? 1) - .1) }; }); return next; }); }}><Minus /></button>
        <button type="button" disabled={!selected.length} aria-label="Seçili öğeleri büyüt" onClick={(event) => { event.stopPropagation(); setLayout((current) => { const next = { ...current }; selected.forEach((item) => { next[item] = { ...next[item], scale: Math.min(2.5, (next[item].scale ?? 1) + .1) }; }); return next; }); }}><Plus /></button>
        <button type="button" onClick={(event) => { event.stopPropagation(); localStorage.setItem("yolkart-saved-layout", JSON.stringify(layout)); onSave?.(layout); }}><Check /> Kaydet</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onSaveAsTemplate?.(layout); }}><Copy /> Farklı kaydet</button>
        <button type="button" disabled={!selected.length} onClick={(event) => { event.stopPropagation(); setLayout((current) => { const next = { ...current }; selected.forEach((item) => { next[item] = { ...next[item], hidden: true }; }); return next; }); setSelected([]); }}><Trash2 /> Sil</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); setLayout(initialElementLayout()); setSelected([]); onResetAll?.(); }}><RotateCcw /> Tümünü geri getir</button>
      </div>}
    </div>
  );
}

export default function App() {
  const [activeTemplate, setActiveTemplate] = useState("minimal");
  const [designHydrated, setDesignHydrated] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const [tab, setTab] = useState<"content" | "design" | "ai">("content");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<"" | "png" | "pdf" | "mixed">("");
  const [selectedPrintCardIds, setSelectedPrintCardIds] = useState<string[]>(["current"]);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [selectedElements, setSelectedElements] = useState<CardElementId[]>([]);
  const [selectedFontSize, setSelectedFontSize] = useState(18);
  const [toast, setToast] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiArtPrompt, setAiArtPrompt] = useState("Modern, profesyonel, koyu lacivert ve turkuaz geometrik araç iletişim kartı");
  const [aiArtLoading, setAiArtLoading] = useState(false);
  const [aiArtError, setAiArtError] = useState("");
  const [aiInput, setAiInput] = useState({ provider: "deepseek", profession: "Mühendis", city: "Gaziantep", tone: "Samimi", prompt: "Modern, güven veren ve hafif esprili olsun." });
  const [settings, setSettings] = useState({ defaultProvider: "deepseek", deepseekModel: "deepseek-v4-flash", openrouterModel: "deepseek/deepseek-v4-flash", imageModel: "bytedance-seed/seedream-4.5", deepseekKey: "", openrouterKey: "", deepseekConfigured: false, openrouterConfigured: false });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState<"" | "deepseek" | "openrouter">("");
  const [providerModels, setProviderModels] = useState<{ deepseek: Array<{ id: string; name: string }>; openrouter: Array<{ id: string; name: string }> }>({ deepseek: [], openrouter: [] });
  const [customTemplates, setCustomTemplates] = useState<SavedTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem("yolkart-custom-templates") || "[]"); } catch { return []; }
  });
  const [customShapes, setCustomShapes] = useState<Array<{ id: string; name: string; dataUri: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("customAccentShapes") || "[]"); } catch { return []; }
  });
  const [templateLayouts, setTemplateLayouts] = useState<Record<string, ElementLayout>>(() => {
    try { return JSON.parse(localStorage.getItem("yolkart-template-layouts") || "{}"); } catch { return {}; }
  });
  const [brandColor, setBrandColor] = useState("#1f6feb");
  const brandPalettePreview = useMemo(() => brandPalettes(brandColor), [brandColor]);
  const applyBrandPalette = (p: { bg: string; accent: string; ink: string }) => {
    setForm((current) => ({ ...current, backgroundColor: p.bg, accent: p.accent, textColor: p.ink, qrColor: p.ink, backgroundImage: "", motif: "none" }));
  };
  const handleLayoutChange = useCallback((layout: ElementLayout) => {
    setTemplateLayouts((prev) => {
      if (prev[activeTemplate] === layout) return prev;
      const next = { ...prev, [activeTemplate]: layout };
      try { localStorage.setItem("yolkart-template-layouts", JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, [activeTemplate]);
  const shapeFileInputRef = useRef<HTMLInputElement>(null);
  const persistCustomShapes = (next: Array<{ id: string; name: string; dataUri: string }>) => {
    setCustomShapes(next);
    try { localStorage.setItem("customAccentShapes", JSON.stringify(next)); } catch {
      setToast("Şekiller kaydedilemedi. Tarayıcı depolaması dolu olabilir.");
      window.setTimeout(() => setToast(""), 2600);
    }
  };
  const handleShapeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 200 * 1024) {
      setToast("Dosya çok büyük. En fazla 200 KB yükleyebilirsiniz.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = String(reader.result || "");
      if (!dataUri) return;
      const id = "custom-" + (crypto.randomUUID?.() || `${customShapes.length}-${dataUri.length}`);
      const next = [...customShapes, { id, name: file.name, dataUri }];
      persistCustomShapes(next);
      update("accentShape", id);
    };
    reader.readAsDataURL(file);
  };
  const removeCustomShape = (id: string) => {
    const next = customShapes.filter((s) => s.id !== id);
    persistCustomShapes(next);
    if (form.accentShape === id) update("accentShape", "default");
  };
  const [patternQuery, setPatternQuery] = useState("Anatolian kilim");
  const [patternLoading, setPatternLoading] = useState(false);
  const [patternError, setPatternError] = useState("");
  const [patternResults, setPatternResults] = useState<Array<{ id: number | string; title: string; thumbnail: string; sourceUrl: string; license: string; artist: string }>>([]);
  const [patternCategory, setPatternCategory] = useState<string>("Tümü");
  const [aiPatternPrompt, setAiPatternPrompt] = useState("");
  const [aiPatternLoading, setAiPatternLoading] = useState(false);
  const [savedPatterns, setSavedPatterns] = useState<Array<{ id: string; prompt: string; url: string }>>([]);
  const [form, setForm] = useState<FormState>({
    owner: "Umut",
    phone: "0532 123 45 67",
    plate: "34 YK 2026",
    url: "https://yolkart.app/u/umut",
    headline: "ARAÇ SAHİBİNE ULAŞIN",
    language: "tr",
    accent: "#ff4d45",
    backgroundColor: "#ffffff",
    font: "'Segoe UI', Arial, sans-serif",
    qrColor: "#071320",
    showPhone: true,
    showNfc: true,
    message: "QR kodu tarayın veya telefonunuzu yaklaştırın",
    motif: "none",
    showPattern: true,
    emergencyLabel: "Acil durumda arayın",
    backgroundImage: "",
    backgroundOpacity: 12,
    backgroundSize: "cover",
    backgroundPosition: "center",
    overlayColor: "#ffffff",
    overlayOpacity: 0,
    borderWidth: 0,
    radius: 18,
    letterSpacing: 0,
    textAlign: "left",
    patternDensity: 5,
    qrStyle: "square",
    qrBackgroundMode: "card",
    qrTarget: "phone",
    accentShape: "default",
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const savedPrintCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const defaultFormRef = useRef(form);
  const templatesPanelRef = useRef<HTMLElement>(null);
  const t = copy.tr;
  const activeCustomTemplate = useMemo(() => customTemplates.find((item) => item.template.id === activeTemplate), [activeTemplate, customTemplates]);
  const template = useMemo(() => activeCustomTemplate?.template || templates.find((item) => item.id === activeTemplate) || templates[0], [activeCustomTemplate, activeTemplate]);
  const visibleTemplates = useMemo(() => templates.filter((item) => templateFormats[form.cardFormat || "vehicle"].includes(item.id)), [form.cardFormat]);
  const uiStyleTemplates = useMemo(() => templates.filter((item) => uiStyleTemplateIds.includes(item.id)), []);
  const funTemplates = useMemo(() => funTemplateGroups.map((g) => ({ title: g.title, items: templates.filter((t) => g.ids.includes(t.id)) })), []);
  const visibleCustomTemplates = useMemo(() => customTemplates.filter((item) => (item.form.cardFormat || "vehicle") === (form.cardFormat || "vehicle")), [customTemplates, form.cardFormat]);
  const printableSavedTemplates = useMemo(() => customTemplates.filter((item) => (item.form.cardFormat || "vehicle") === "vehicle" && item.template.id !== activeTemplate), [activeTemplate, customTemplates]);
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const applySelectedTypography = (style: { color?: string; fontFamily?: string; fontSize?: number }) => {
    window.dispatchEvent(new CustomEvent("yolkart-apply-selected-style", { detail: style }));
  };

  const selectBuiltinPattern = (pattern: (typeof builtinPatterns)[number]) => setForm((current) => ({
    ...current,
    showPattern: true,
    builtinPatternId: pattern.id,
    backgroundImage: patternDataUri(pattern, current.accent),
    backgroundSize: "repeat",
    motif: "none",
  }));

  // Vurgu rengi değişince seçili yerleşik deseni yeni renkle yeniden üret.
  useEffect(() => {
    if (!form.builtinPatternId) return;
    const pattern = builtinPatterns.find((item) => item.id === form.builtinPatternId);
    if (!pattern) return;
    const next = patternDataUri(pattern, form.accent);
    if (next !== form.backgroundImage) update("backgroundImage", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.accent, form.textColor, form.builtinPatternId]);

  useEffect(() => {
    try {
      const savedForm = localStorage.getItem("yolkart-last-design");
      const savedTemplate = localStorage.getItem("yolkart-active-template");
      if (savedForm) setForm((current) => ({ ...current, ...JSON.parse(savedForm) }));
      if (savedTemplate && (templates.some((item) => item.id === savedTemplate) || customTemplates.some((item) => item.template.id === savedTemplate))) setActiveTemplate(savedTemplate);
    } catch {
      localStorage.removeItem("yolkart-last-design");
    }
    setDesignHydrated(true);
  }, []);

  useEffect(() => {
    if (!designHydrated) return;
    localStorage.setItem("yolkart-last-design", JSON.stringify(form));
    localStorage.setItem("yolkart-active-template", activeTemplate);
  }, [activeTemplate, designHydrated, form]);

  useEffect(() => {
    if (!designHydrated || !form.owner.trim() || !form.phone.trim()) return;
    const timeout = window.setTimeout(async () => {
      const slug = form.owner.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      if (!slug) return;
      try {
        const result = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner: form.owner,
            phone: form.phone,
            plate: form.plate,
            headline: form.headline,
            message: form.message,
            emergencyLabel: form.emergencyLabel,
            accent: form.accent,
            slug,
          }),
        });
        const payload = await result.json();
        if (!result.ok) return;
        const profileUrl = `${window.location.origin}${payload.url}`;
        setForm((current) => current.url === profileUrl ? current : { ...current, url: profileUrl });
      } catch {
        /* Bağlantı geri geldiğinde sonraki düzenleme profili yeniden günceller. */
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [designHydrated, form.accent, form.emergencyLabel, form.headline, form.message, form.owner, form.phone, form.plate]);

  const resetToDefault = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("yolkart-saved-design") || "null");
      setForm(saved?.form ? { ...defaultFormRef.current, ...saved.form } : defaultFormRef.current);
      setActiveTemplate(saved?.template && templates.some((item) => item.id === saved.template) ? saved.template : "minimal");
    } catch {
      setForm(defaultFormRef.current);
      setActiveTemplate("minimal");
    }
    setResetVersion((value) => value + 1);
    setToast("Kayıtlı tasarıma dönüldü");
    window.setTimeout(() => setToast(""), 2400);
  };

  const saveCurrentDesign = (layout: ElementLayout) => {
    if (activeCustomTemplate) {
      setCustomTemplates((current) => {
        const next = current.map((item) => item.template.id === activeTemplate ? { ...item, form: { ...form }, layout } : item);
        localStorage.setItem("yolkart-custom-templates", JSON.stringify(next));
        return next;
      });
      localStorage.setItem("yolkart-saved-design", JSON.stringify({ form, template: activeTemplate }));
      setToast(`${activeCustomTemplate.template.label} güncellendi`);
    } else {
      const saved: SavedTemplate = {
        template: { ...template, id: `saved-${Date.now()}`, label: `Kayıtlı ${template.label}` },
        form: { ...form },
        layout,
      };
      setCustomTemplates((current) => {
        const next = [...current, saved];
        localStorage.setItem("yolkart-custom-templates", JSON.stringify(next));
        return next;
      });
      setActiveTemplate(saved.template.id);
      localStorage.setItem("yolkart-saved-design", JSON.stringify({ form, template: saved.template.id }));
      setToast(`${saved.template.label} şablon olarak kaydedildi. Kaydet artık bu şablonu günceller.`);
    }
    localStorage.setItem("yolkart-saved-layout", JSON.stringify(layout));
    window.setTimeout(() => setToast(""), 2400);
  };

  const saveAsNewTemplate = (layout: ElementLayout) => {
    const count = customTemplates.length + 1;
    const saved: SavedTemplate = {
      template: { ...template, id: `custom-${Date.now()}`, label: `Özel Şablon ${count}` },
      form: { ...form },
      layout,
    };
    setCustomTemplates((current) => {
      const next = [...current, saved];
      localStorage.setItem("yolkart-custom-templates", JSON.stringify(next));
      return next;
    });
    setActiveTemplate(saved.template.id);
    setToast(`${saved.template.label} kaydedildi`);
    window.setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  useEffect(() => {
    fetch("/api/settings")
      .then((result) => result.json())
      .then((data) => {
        setSettings((current) => ({ ...current, ...data }));
        setAiInput((current) => ({ ...current, provider: data.defaultProvider || current.provider }));
      })
      .catch(() => undefined);
  }, []);

  const chooseTemplate = (item: CardTemplate) => {
    setActiveTemplate(item.id);
    setForm((current) => ({ ...current, backgroundColor: item.bg, accent: item.accent, textColor: item.ink, qrColor: item.ink, qrBackgroundMode: "card", font: item.font, motif: "none", backgroundImage: "", backgroundOpacity: 12, overlayOpacity: 0, radius: 18, borderWidth: 0, patternDensity: 5 }));
  };

  const chooseCustomTemplate = (saved: SavedTemplate) => {
    setActiveTemplate(saved.template.id);
    setForm(saved.form);
    localStorage.setItem("yolkart-element-layout", JSON.stringify(saved.layout));
    localStorage.setItem("yolkart-saved-layout", JSON.stringify(saved.layout));
    setResetVersion((value) => value + 1);
  };

  const resetToTemplateOriginal = () => {
    if (activeCustomTemplate) {
      setForm(activeCustomTemplate.form);
      localStorage.setItem("yolkart-element-layout", JSON.stringify(activeCustomTemplate.layout));
      localStorage.setItem("yolkart-saved-layout", JSON.stringify(activeCustomTemplate.layout));
    } else {
      chooseTemplate(template);
      localStorage.setItem("yolkart-element-layout", JSON.stringify(initialElementLayout()));
      localStorage.setItem("yolkart-saved-layout", JSON.stringify(initialElementLayout()));
    }
    setResetVersion((value) => value + 1);
    setToast("Şablon orijinal haline döndürüldü");
  };

  const setCardFormat = (format: NonNullable<FormState["cardFormat"]>) => {
    const recommended: Record<NonNullable<FormState["cardFormat"]>, string> = {
      vehicle: "minimal", id: "monochrome", badge: "technical", lanyard: "premium", brochure: "classic",
    };
    const nextTemplate = templates.find((item) => item.id === recommended[format]) || templates[0];
    setForm((current) => ({ ...current, cardFormat: format, backgroundColor: nextTemplate.bg, accent: nextTemplate.accent, textColor: nextTemplate.ink, qrColor: nextTemplate.ink, font: nextTemplate.font }));
    setActiveTemplate(nextTemplate.id);
    setResetVersion((value) => value + 1);
  };

  const setCardLanguage = (language: Language) => {
    const cardText = copy[language];
    setForm((current) => ({
      ...current,
      language,
      headline: language === "tr" ? "ARAÇ SAHİBİNE ULAŞIN" : "CONTACT THE VEHICLE OWNER",
      message: cardText.helper,
      emergencyLabel: cardText.emergency,
    }));
  };

  const openTab = (next: typeof tab) => {
    setTab(next);
    templatesPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveSettings = async () => {
    setSettingsLoading(true);
    try {
      const result = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setSettings((current) => ({ ...current, ...payload, deepseekKey: "", openrouterKey: "" }));
      setAiInput((current) => ({ ...current, provider: payload.defaultProvider }));
      setToast("Sağlayıcı ayarları kaydedildi");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Ayarlar kaydedilemedi");
    } finally {
      setSettingsLoading(false);
      window.setTimeout(() => setToast(""), 2600);
    }
  };

  const fetchModels = async (provider: "deepseek" | "openrouter") => {
    setModelsLoading(provider);
    try {
      const apiKey = provider === "deepseek" ? settings.deepseekKey : settings.openrouterKey;
      const result = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey }) });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setProviderModels((current) => ({ ...current, [provider]: payload.models }));
      setToast(`${payload.models.length} model getirildi`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Modeller alınamadı");
    } finally {
      setModelsLoading("");
      window.setTimeout(() => setToast(""), 2600);
    }
  };

  const searchPatterns = async (queryOverride?: string) => {
    const query = queryOverride || patternQuery;
    if (query.trim().length < 2) {
      setPatternError("Aramak için en az iki karakter girin.");
      return;
    }
    setPatternLoading(true);
    setPatternError("");
    setPatternResults([]);
    try {
      const result = await fetch(`/api/pattern-search?q=${encodeURIComponent(query)}`);
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setPatternResults(payload.items);
      if (!payload.items.length) setPatternError("Bu arama için desen bulunamadı.");
    } catch (error) {
      setPatternError(error instanceof Error ? error.message : "Desenler yüklenemedi.");
    } finally {
      setPatternLoading(false);
    }
  };

  const loadSavedPatterns = async () => {
    try {
      const result = await fetch("/api/saved-patterns");
      const payload = await result.json();
      if (result.ok && Array.isArray(payload.items)) setSavedPatterns(payload.items);
    } catch {
      /* sessizce yoksay */
    }
  };

  useEffect(() => {
    loadSavedPatterns();
  }, []);

  const selectSavedPattern = (item: { url: string }) => setForm((current) => ({
    ...current,
    showPattern: true,
    backgroundImage: item.url,
    backgroundSize: "repeat",
    motif: "none",
    builtinPatternId: undefined,
  }));

  const deleteSavedPattern = async (id: string) => {
    setSavedPatterns((current) => current.filter((item) => item.id !== id));
    try {
      await fetch(`/api/saved-patterns/${id}`, { method: "DELETE" });
    } catch {
      /* sessizce yoksay */
    }
  };

  const generateAiPattern = async () => {
    if (aiPatternPrompt.trim().length < 2) {
      setPatternError("Desen için en az iki karakter girin.");
      return;
    }
    setAiPatternLoading(true);
    setPatternError("");
    try {
      const result = await fetch("/api/ai-pattern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPatternPrompt.trim() }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setForm((current) => ({ ...current, showPattern: true, backgroundImage: payload.url || payload.image, backgroundSize: "repeat", motif: "none", builtinPatternId: undefined }));
      loadSavedPatterns();
    } catch (error) {
      setPatternError(error instanceof Error ? error.message : "Desen üretilemedi.");
    } finally {
      setAiPatternLoading(false);
    }
  };

  const uploadBackground = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5_000_000) {
      setPatternError("PNG, JPG veya WebP biçiminde en fazla 5 MB görsel seçin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, showPattern: true, backgroundImage: String(reader.result || ""), builtinPatternId: undefined }));
    reader.readAsDataURL(file);
  };

  const generateAiDesign = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const result = await fetch("/api/ai-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...aiInput, language: form.language }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      const fontMap: Record<string, string> = {
        inter: "'Inter', sans-serif",
        montserrat: "'Montserrat', sans-serif",
        poppins: "'Poppins', sans-serif",
        "space-grotesk": "'Space Grotesk', sans-serif",
        playfair: "'Playfair Display', Georgia, serif",
        georgia: "Georgia, serif",
        segoe: "'Segoe UI', Arial, sans-serif",
        jetbrains: "'JetBrains Mono', monospace",
      };
      const nextTemplate = templates.find((item) => item.id === payload.design.templateId) || template;
      const nextPattern = builtinPatterns.find((item) => item.id === payload.design.builtinPatternId);
      const cleanLayout = initialElementLayout();
      setActiveTemplate(nextTemplate.id);
      setTemplateLayouts((current) => ({ ...current, [nextTemplate.id]: cleanLayout }));
      localStorage.setItem("yolkart-element-layout", JSON.stringify(cleanLayout));
      localStorage.setItem("yolkart-saved-layout", JSON.stringify(cleanLayout));
      setSelectedElements([]);
      setForm((current) => ({
        ...current,
        headline: payload.design.headline,
        message: payload.design.message,
        backgroundColor: payload.design.backgroundColor,
        textColor: payload.design.textColor,
        accent: payload.design.accent,
        qrColor: payload.design.qrColor,
        font: fontMap[payload.design.fontFamily] || current.font,
        motif: payload.design.motif,
        builtinPatternId: nextPattern?.id,
        backgroundImage: nextPattern ? patternDataUri(nextPattern, payload.design.accent) : "",
        backgroundSize: "repeat",
        showPattern: payload.design.motif !== "none" || Boolean(nextPattern),
        accentShape: payload.design.accentShape,
        patternDensity: payload.design.patternDensity,
        backgroundOpacity: payload.design.backgroundOpacity,
        overlayColor: payload.design.overlayColor,
        overlayOpacity: payload.design.overlayOpacity,
        qrStyle: payload.design.qrStyle,
        textAlign: payload.design.textAlign,
        borderWidth: payload.design.borderWidth,
        radius: payload.design.radius,
        emergencyLabel: payload.design.emergencyLabel,
      }));
      setToast("AI tasarımı karta uygulandı");
      window.setTimeout(() => setToast(""), 2600);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI tasarımı oluşturulamadı.");
    } finally {
      setAiLoading(false);
    }
  };

  const generateAiCardArt = async () => {
    if (aiArtPrompt.trim().length < 4) {
      setAiArtError("Kart görselini en az 4 karakterle tarif edin.");
      return;
    }
    setAiArtLoading(true);
    setAiArtError("");
    try {
      const result = await fetch("/api/ai-card-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiArtPrompt.trim() }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      setForm((current) => ({
        ...current,
        showPattern: true,
        backgroundImage: payload.url,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundOpacity: 100,
        motif: "none",
        builtinPatternId: undefined,
        overlayColor: current.backgroundColor,
        overlayOpacity: 12,
      }));
      setToast("AI kart görseli uygulandı; gerçek QR ve bilgiler üst katmanda korundu");
      window.setTimeout(() => setToast(""), 3200);
    } catch (error) {
      setAiArtError(error instanceof Error ? error.message : "Kart görseli üretilemedi.");
    } finally {
      setAiArtLoading(false);
    }
  };

  const publishProfile = async () => {
    try {
      const slug = form.owner.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const result = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slug }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error);
      const profileUrl = `${window.location.origin}${payload.url}`;
      setForm((current) => ({ ...current, url: profileUrl }));
      setToast("QR profil sayfası yayınlandı ve karta bağlandı");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Profil sayfası yayınlanamadı");
    }
    window.setTimeout(() => setToast(""), 2800);
  };

  const captureCardNode = async (node: HTMLDivElement | null, dimensions: { width: number; height: number }) => {
    if (!node) throw new Error("Kart önizlemesi bulunamadı.");
    document.body.classList.add("exporting-card");
    try {
      // Yazi tipleri yuklenmeden yakalanirsa PNG'de yedek font/bos metin cikiyor
      if (document.fonts?.ready) await document.fonts.ready;
      const options = {
        pixelRatio: 1,
        canvasWidth: dimensions.width,
        canvasHeight: dimensions.height,
        cacheBust: true,
        filter: (node: HTMLElement) => !(node instanceof HTMLElement && node.dataset.exportIgnore === "true"),
      };
      // html-to-image'in bilinen davranisi: ilk cagri gorsel/font kaynaklarini
      // onbellege alir, ikinci cagri tam sonucu verir.
      await toPng(node, options);
      return await toPng(node, options);
    } finally {
      document.body.classList.remove("exporting-card");
    }
  };

  const saveA4PrintSheet = async (cards: PrintCardImage[], fileName: string, title: string) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const pageWidth = 297;
    const pageHeight = 210;
    const bleedWidth = 69;
    const bleedHeight = 100;
    const trimInsetX = 2;
    const trimInsetY = 3;
    const columnGap = 4;
    const rowGap = 6;
    const startX = (pageWidth - (bleedWidth * 3 + columnGap * 2)) / 2;
    const startY = (pageHeight - (bleedHeight * 2 + rowGap)) / 2;

    pdf.setProperties({
      title,
      subject: "65 x 94 mm kesim olculu arac kartlari",
      creator: "YolKart Studio",
    });
    pdf.setLineWidth(0.18);
    pdf.setDrawColor(35, 35, 35);

    const drawCropMarks = (trimX: number, trimY: number) => {
      const trimWidth = 65;
      const trimHeight = 94;
      const markLength = 1.5;
      const markGap = 0.3;
      const right = trimX + trimWidth;
      const bottom = trimY + trimHeight;
      pdf.line(trimX - markLength, trimY, trimX - markGap, trimY);
      pdf.line(trimX, trimY - markLength, trimX, trimY - markGap);
      pdf.line(right + markGap, trimY, right + markLength, trimY);
      pdf.line(right, trimY - markLength, right, trimY - markGap);
      pdf.line(trimX - markLength, bottom, trimX - markGap, bottom);
      pdf.line(trimX, bottom + markGap, trimX, bottom + markLength);
      pdf.line(right + markGap, bottom, right + markLength, bottom);
      pdf.line(right, bottom + markGap, right, bottom + markLength);
    };

    cards.slice(0, 6).forEach((card, index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const x = startX + column * (bleedWidth + columnGap);
      const y = startY + row * (bleedHeight + rowGap);
      const imageAlias = `yolkart-${card.key.replace(/[^a-z0-9_-]/gi, "_")}`;
      pdf.setFillColor(card.background);
      pdf.rect(x, y, bleedWidth, bleedHeight, "F");
      pdf.addImage(card.dataUrl, "PNG", x, y, bleedWidth, bleedHeight, imageAlias, "FAST");
      drawCropMarks(x + trimInsetX, y + trimInsetY);
    });

    pdf.save(fileName);
  };

  const togglePrintCard = (id: string) => {
    setSelectedPrintCardIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 6 ? [...current, id] : current);
  };

  const exportCard = async () => {
    try {
      setExporting("png");
      const dimensions = exportDimensions[form.cardFormat || "vehicle"];
      const dataUrl = await captureCardNode(cardRef.current, dimensions);
      const link = document.createElement("a");
      link.download = `yolkart-${form.plate.replace(/\s+/g, "-").toLowerCase()}-${dimensions.label}.png`;
      link.href = dataUrl;
      link.click();
      setExportOpen(false);
      setToast(t.downloaded);
    } catch {
      setToast(form.language === "tr" ? "Kart indirilemedi. Tekrar deneyin." : "Card could not be downloaded. Try again.");
    } finally {
      setExporting("");
    }
    window.setTimeout(() => setToast(""), 2600);
  };

  const exportA4PrintSheet = async () => {
    if ((form.cardFormat || "vehicle") !== "vehicle") return;
    try {
      setExporting("pdf");
      const cardDataUrl = await captureCardNode(cardRef.current, exportDimensions.vehicle);
      const cardBackground = form.backgroundColor || template.bg;
      const filePlate = form.plate.replace(/\s+/g, "-").toLocaleLowerCase("tr-TR");
      await saveA4PrintSheet(
        Array.from({ length: 6 }, () => ({ key: "current", dataUrl: cardDataUrl, background: cardBackground })),
        `yolkart-${filePlate}-a4-6li-65x94mm.pdf`,
        `YolKart ${form.plate} - 6'li A4 baski`,
      );
      setExportOpen(false);
      setToast("6 kartlı A4 baskı PDF'i indirildi");
    } catch {
      setToast("A4 baskı PDF'i oluşturulamadı. Tekrar deneyin.");
    } finally {
      setExporting("");
    }
    window.setTimeout(() => setToast(""), 3000);
  };

  const exportMixedA4PrintSheet = async () => {
    try {
      setExporting("mixed");
      const selectedCards = selectedPrintCardIds.map((id) => {
        if (id === "current" && (form.cardFormat || "vehicle") === "vehicle") {
          return { id, form, template, node: cardRef.current };
        }
        const saved = printableSavedTemplates.find((item) => item.template.id === id);
        return saved ? { id, form: saved.form, template: saved.template, node: savedPrintCardRefs.current[id] } : null;
      }).filter((item): item is { id: string; form: FormState; template: CardTemplate; node: HTMLDivElement | null } => Boolean(item));

      if (!selectedCards.length) {
        setToast("Karışık baskı için en az bir araç kartı seçin.");
        window.setTimeout(() => setToast(""), 2600);
        return;
      }

      const images: PrintCardImage[] = [];
      for (const card of selectedCards) {
        images.push({
          key: card.id,
          dataUrl: await captureCardNode(card.node, exportDimensions.vehicle),
          background: card.form.backgroundColor || card.template.bg,
        });
      }
      const slots = Array.from({ length: 6 }, (_, index) => images[index % images.length]);
      await saveA4PrintSheet(slots, "yolkart-karisik-araclar-a4-6li-65x94mm.pdf", "YolKart - karisik araclar A4 baski");
      setExportOpen(false);
      setToast(`${images.length} farklı kart 6 baskı yuvasına yerleştirildi`);
    } catch {
      setToast("Karışık A4 baskı PDF'i oluşturulamadı. Tekrar deneyin.");
    } finally {
      setExporting("");
    }
    window.setTimeout(() => setToast(""), 3200);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="YolKart ana sayfa"><span className="brand-mark">Y</span><strong>YolKart</strong></a>
        <div className="save-state"><Check />{t.saved}</div>
        <div className="top-actions">
          <button className="language-button lang-toggle" title="Kart dili" aria-label="Kart dili değiştir" onClick={() => setCardLanguage(form.language === "tr" ? "en" : "tr")}><Globe2 /><span>{form.language === "tr" ? "TR" : "EN"}</span></button>
          <button className="export-button" onClick={() => setExportOpen(true)}><Download />{t.export}</button>
        </div>
      </header>

      <section className="workspace">
        <nav className="tool-rail" aria-label="Araçlar">
          <button className={templatesOpen ? "active" : ""} aria-label="Şablonlar" title="Şablon panelini aç/kapa" onClick={() => setTemplatesOpen((open) => !open)}><SlidersHorizontal /></button>
          <button className={tab === "content" ? "active" : ""} aria-label="Metin" title="İçerik: metin alanları" onClick={() => openTab("content")}><Type /></button>
          <button className={tab === "design" ? "active" : ""} aria-label="Renkler" title="Tasarım: renk, yazı tipi, desen" onClick={() => openTab("design")}><Palette /></button>
          <button className={tab === "ai" ? "active" : ""} aria-label="AI Tasarla" title="AI ile otomatik tasarım" onClick={() => openTab("ai")}><Sparkles /></button>
          <button className={settingsOpen ? "active" : ""} aria-label="Ayarlar" title="Sağlayıcı ayarları" onClick={() => setSettingsOpen(true)}><Settings2 /></button>
        </nav>

        <aside className={`templates-panel ${templatesOpen ? "" : "collapsed"}`} ref={templatesPanelRef}>
          <h1>{t.templates}</h1>
          <div className="template-list">
            {visibleTemplates.map((item) => (
              <button key={item.id} className={`template-option ${activeTemplate === item.id ? "selected" : ""}`} onClick={() => chooseTemplate(item)}>
                <div className="template-thumb"><CardPreview form={{ ...form, backgroundColor: item.bg, accent: item.accent, qrColor: item.ink, qrBackgroundMode: "card", font: item.font, motif: "none", backgroundOpacity: 12 }} template={item} compact /></div>
                <span>{item.label}</span>
                {activeTemplate === item.id && <i><Check /></i>}
              </button>
            ))}
            {funTemplates.map((group) => (
              <Fragment key={group.title}>
                <h2 className="template-group-title">{group.title}</h2>
                {group.items.map((item) => (
                  <button key={item.id} className={`template-option ${activeTemplate === item.id ? "selected" : ""}`} onClick={() => chooseTemplate(item)}>
                    <div className="template-thumb"><CardPreview form={{ ...form, backgroundColor: item.bg, accent: item.accent, qrColor: item.ink, qrBackgroundMode: "card", font: item.font, motif: item.motif, backgroundOpacity: 12 }} template={item} compact /></div>
                    <span>{item.label}</span>
                    {activeTemplate === item.id && <i><Check /></i>}
                  </button>
                ))}
              </Fragment>
            ))}
            <h2 className="template-group-title">UI Stilleri</h2>
            {uiStyleTemplates.map((item) => (
              <button key={item.id} className={`template-option ${activeTemplate === item.id ? "selected" : ""}`} onClick={() => chooseTemplate(item)}>
                <div className="template-thumb"><CardPreview form={{ ...form, backgroundColor: item.bg, accent: item.accent, qrColor: item.ink, qrBackgroundMode: "card", font: item.font, motif: "none", backgroundOpacity: 12 }} template={item} compact /></div>
                <span>{item.label}</span>
                {activeTemplate === item.id && <i><Check /></i>}
              </button>
            ))}
            {visibleCustomTemplates.map((saved) => (
              <button key={saved.template.id} className={`template-option ${activeTemplate === saved.template.id ? "selected" : ""}`} onClick={() => chooseCustomTemplate(saved)}>
                <div className="template-thumb"><CardPreview form={saved.form} template={saved.template} compact initialLayout={saved.layout} /></div>
                <span>{saved.template.label}</span>
                {activeTemplate === saved.template.id && <i><Check /></i>}
              </button>
            ))}
          </div>
        </aside>

        <section className="canvas">
          <div className="preview-scale">
            <div ref={cardRef}><CardPreview key={activeTemplate} form={form} template={template} resetVersion={resetVersion} initialLayout={activeCustomTemplate?.layout ?? templateLayouts[activeTemplate]} onSave={saveCurrentDesign} onSaveAsTemplate={saveAsNewTemplate} onResetAll={resetToTemplateOriginal} onLayoutChange={handleLayoutChange} onSelectionChange={setSelectedElements} customShapes={customShapes} /></div>
          </div>
        </section>

        <aside className="inspector">
          <h1>{t.customize}</h1>
          <div className="tabs tabs-three">
            <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>{t.content}</button>
            <button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>{t.design}</button>
            <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}><Sparkles />{t.ai}</button>
          </div>
          <div className="inspector-content">
            {tab === "content" ? (
              <>
                <Field label={t.owner} value={form.owner} onChange={(v) => update("owner", v)} />
                <Field label={t.phone} value={form.phone} onChange={(v) => update("phone", v)} />
                <Field label={t.plate} value={form.plate} onChange={(v) => update("plate", v.toUpperCase())} />
                <Field label={t.headline} value={form.headline} onChange={(v) => update("headline", v)} />
                <Field label={t.url} value={form.url} onChange={(v) => update("url", v)} hint={t.urlHint} />
                <button className="publish-profile" type="button" onClick={publishProfile}><Globe2 /> QR profilini yayınla</button>
                <div className="control-group"><span>Kart dili</span><div className="segmented"><button className={form.language === "tr" ? "active" : ""} onClick={() => setCardLanguage("tr")}>Türkçe kart</button><button className={form.language === "en" ? "active" : ""} onClick={() => setCardLanguage("en")}>English card</button></div><small>Bu seçim yalnızca kart üzerindeki metinleri değiştirir.</small></div>
              </>
            ) : tab === "design" ? (
              <>
                <details className="design-section" open>
                  <summary className="section-title"><SlidersHorizontal /><strong>Kart ölçüsü ve kullanım tipi</strong></summary>
                  <div className="format-grid">
                  {[
                    ["vehicle", "Araç kartı", "69 × 100 mm"],
                    ["id", "Kimlik / ehliyet", "85.6 × 54 mm"],
                    ["badge", "Şirket yaka kartı", "90 × 60 mm"],
                    ["lanyard", "Seminer boyun kartı", "100 × 140 mm"],
                    ["brochure", "Mini broşür", "105 × 148 mm"],
                  ].map(([value, label, size]) => <button key={value} className={(form.cardFormat || "vehicle") === value ? "active" : ""} onClick={() => setCardFormat(value as NonNullable<FormState["cardFormat"]>)}><strong>{label}</strong><small>{size}</small></button>)}
                  </div><small>Ölçü seçildiğinde uygun başlangıç şablonu otomatik uygulanır.</small>
                </details>
                <details className="design-section typography-section" open>
                  <summary className="section-title"><Type /><strong>Yazı ve tipografi</strong></summary>
                  <div className="color-inputs">
                    <label><span>Arka plan</span><input type="color" value={form.backgroundColor || template.bg} onChange={(event) => update("backgroundColor", event.target.value)} /></label>
                    <label><span>{selectedElements.length ? `Seçili (${selectedElements.length})` : "Yazı rengi"}</span><input type="color" value={form.textColor || template.ink} onChange={(event) => selectedElements.length ? applySelectedTypography({ color: event.target.value }) : update("textColor", event.target.value)} /></label>
                    <label><span>Vurgu rengi</span><input type="color" value={form.accent} onChange={(event) => update("accent", event.target.value)} /></label>
                  </div>
                  <label className="field"><span>{selectedElements.length ? `Seçili öğelerin yazı tipi (${selectedElements.length})` : t.typography}</span><select value={form.font} onChange={(e) => selectedElements.length ? applySelectedTypography({ fontFamily: e.target.value }) : update("font", e.target.value)}>
                  <optgroup label="Popüler Web / UI"><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option><option value="'Open Sans', sans-serif">Open Sans</option><option value="'Montserrat', sans-serif">Montserrat</option><option value="'Poppins', sans-serif">Poppins</option><option value="'Lato', sans-serif">Lato</option><option value="'Nunito Sans', sans-serif">Nunito Sans</option><option value="'Raleway', sans-serif">Raleway</option><option value="'DM Sans', sans-serif">DM Sans</option><option value="'Manrope', sans-serif">Manrope</option><option value="'Space Grotesk', sans-serif">Space Grotesk</option><option value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans</option></optgroup>
                  <optgroup label="Kodlama / Monospace"><option value="'JetBrains Mono', monospace">JetBrains Mono</option><option value="'Fira Code', monospace">Fira Code</option><option value="'IBM Plex Mono', monospace">IBM Plex Mono</option><option value="'Source Code Pro', monospace">Source Code Pro</option><option value="'Inconsolata', monospace">Inconsolata</option></optgroup>
                  <optgroup label="Modern"><option value="'Segoe UI', Arial, sans-serif">Segoe UI</option><option value="Arial, sans-serif">Arial</option><option value="Verdana, sans-serif">Verdana</option><option value="Tahoma, sans-serif">Tahoma</option><option value="'Trebuchet MS', sans-serif">Trebuchet</option><option value="'Arial Black', sans-serif">Arial Black</option></optgroup>
                  <optgroup label="Klasik"><option value="Georgia, serif">Georgia</option><option value="Garamond, Georgia, serif">Garamond</option><option value="'Palatino Linotype', serif">Palatino</option><option value="'Book Antiqua', serif">Book Antiqua</option></optgroup>
                  <optgroup label="Teknik"><option value="'Courier New', monospace">Courier New</option><option value="Consolas, monospace">Consolas</option></optgroup>
                  </select></label>
                  {selectedElements.length > 0 && <RangeControl label="Seçili yazı boyutu" value={selectedFontSize} min={8} max={72} unit=" px" onChange={(value) => { setSelectedFontSize(value); applySelectedTypography({ fontSize: value }); }} />}
                  <RangeControl label="Harf aralığı" value={form.letterSpacing} min={-2} max={8} unit=" px" onChange={(value) => update("letterSpacing", value)} />
                  <div className="control-group brand-palette-block">
                    <span>Marka renginden palet üret</span>
                    <div className="brand-palette-row">
                      <input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} aria-label="Marka rengi" title="Marka rengini seçin" />
                      <div className="brand-palette-swatches">
                        {brandPalettePreview.map((p, i) => (
                          <button key={i} type="button" className="brand-palette-chip" onClick={() => applyBrandPalette(p)} title={`Palet ${i + 1} — zemin ${p.bg}, vurgu ${p.accent}`} aria-label={`Palet ${i + 1} uygula`} style={{ background: p.bg, borderColor: p.accent }}>
                            <span style={{ background: p.accent }} /><strong style={{ color: p.ink }}>Aa</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                    <small className="control-hint">Tek renk seçin; kontrast-garantili zemin, yazı ve vurgu paletini otomatik uygular.</small>
                  </div>
                  <div className="control-group"><span>Hazır vurgu renkleri</span><div className="swatches">{palettes.map((color) => <button key={color} style={{ background: color }} className={form.accent === color ? "active" : ""} onClick={() => update("accent", color)} aria-label={color} />)}</div></div>
                  <div className="control-group"><span>Metin hizası</span><div className="segmented"><button className={form.textAlign === "left" ? "active" : ""} onClick={() => update("textAlign", "left")}>Sola hizala</button><button className={form.textAlign === "center" ? "active" : ""} onClick={() => update("textAlign", "center")}>Ortala</button></div></div>
                </details>
                <details className="design-section">
                  <summary className="section-title"><Search /><strong>QR kod</strong></summary>
                <label className="field color-field"><span>{t.qr}</span><div><input type="color" value={form.qrColor} onChange={(e) => update("qrColor", e.target.value)} /><input value={form.qrColor.toUpperCase()} onChange={(e) => update("qrColor", e.target.value)} /></div></label>
                <div className="control-group"><span>QR şekli</span><div className="qr-style-grid">
                  <button className={form.qrStyle === "square" ? "active" : ""} onClick={() => update("qrStyle", "square")}>Klasik</button>
                  <button className={form.qrStyle === "rounded" ? "active" : ""} onClick={() => update("qrStyle", "rounded")}>Yumuşak</button>
                  <button className={form.qrStyle === "dots" ? "active" : ""} onClick={() => update("qrStyle", "dots")}>Nokta</button>
                  <button className={form.qrStyle === "organic" ? "active" : ""} onClick={() => update("qrStyle", "organic")}>Organik</button>
                </div><small className="control-hint">Köşe bulucuları korunur ve yüksek hata düzeltme kullanılır.</small></div>
                <div className="control-group"><span>QR arka planı</span><div className="segmented"><button className={form.qrBackgroundMode === "card" ? "active" : ""} onClick={() => update("qrBackgroundMode", "card")}>Kart rengi</button><button className={form.qrBackgroundMode === "transparent" ? "active" : ""} onClick={() => update("qrBackgroundMode", "transparent")}>Şeffaf</button><button className={form.qrBackgroundMode === "white" ? "active" : ""} onClick={() => update("qrBackgroundMode", "white")}>Beyaz</button></div><small className="control-hint">Şeffaf zemin yoğun desenlerde taramayı zorlaştırabilir.</small></div>
                <div className="control-group"><span>QR okutulunca</span><div className="segmented"><button className={form.qrTarget === "phone" ? "active" : ""} onClick={() => update("qrTarget", "phone")}>Telefonu ara</button><button className={form.qrTarget === "vcard" ? "active" : ""} onClick={() => update("qrTarget", "vcard")}>Rehbere ekle</button><button className={form.qrTarget === "profile" ? "active" : ""} onClick={() => update("qrTarget", "profile")}>Profil kartını aç</button></div><small className="control-hint">“Telefonu ara” numarayı arama ekranına gönderir. “Rehbere ekle” internet gerektirmez, kişi kartını doğrudan rehbere kaydettirir. “Profil kartını aç” ad, plaka ve telefonu gösteren mobil sayfayı açar.</small></div>
                </details>
                <details className="design-section">
                  <summary className="section-title"><ImageIcon /><strong>Arka plan deseni</strong></summary>
                  <Toggle label={t.showPattern} active={form.showPattern !== false} onClick={() => update("showPattern", form.showPattern === false)} />
                  <div className="builtin-pattern-block">
                    <small className="control-hint">Hazır desen kütüphanesi — vurgu renginde otomatik boyanır.</small>
                    <div className="pattern-category-chips">
                      {["Tümü", ...patternCategories].map((cat) => <button key={cat} className={patternCategory === cat ? "active" : ""} onClick={() => setPatternCategory(cat)}>{cat}</button>)}
                    </div>
                    <div className="builtin-pattern-grid">
                      {builtinPatterns.filter((p) => patternCategory === "Tümü" || p.category === patternCategory).map((p) => (
                        <button key={p.id} className={form.builtinPatternId === p.id ? "selected" : ""} onClick={() => selectBuiltinPattern(p)} title={p.label} aria-label={p.label}>
                          <div className="builtin-pattern-tile" style={{ backgroundImage: `url("${patternDataUri(p, form.accent)}")`, backgroundSize: "28px" }} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ai-pattern-block">
                    <small className="control-hint">AI ile desen üret — kısa bir açıklama yazın.</small>
                    <div className="pattern-search"><input aria-label="AI desen açıklaması" value={aiPatternPrompt} placeholder="Örn. kapadokya balonları, pastel" onChange={(event) => setAiPatternPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") generateAiPattern(); }} /><button onClick={() => generateAiPattern()} disabled={aiPatternLoading} aria-label="AI ile desen üret">{aiPatternLoading ? <LoaderCircle className="spin" /> : <Sparkles />}</button></div>
                    {savedPatterns.length > 0 && <>
                      <small className="control-hint">AI Desenlerim — daha önce ürettiğiniz desenler kalıcı olarak saklanır.</small>
                      <div className="saved-pattern-grid">
                        {savedPatterns.map((item) => (
                          <button key={item.id} className={form.backgroundImage === item.url ? "selected" : ""} onClick={() => selectSavedPattern(item)} title={item.prompt || "AI desen"}>
                            <div className="saved-pattern-tile" style={{ backgroundImage: `url("${item.url}")`, backgroundSize: "28px" }} />
                            <span className="saved-pattern-remove" role="button" aria-label="Deseni sil" onClick={(event) => { event.stopPropagation(); deleteSavedPattern(item.id); }}>×</span>
                          </button>
                        ))}
                      </div>
                    </>}
                  </div>
                  <div className="pattern-categories">{[["Kilim", "Anatolian kilim pattern"], ["Geometrik", "geometric seamless pattern"], ["Çini", "Turkish Iznik tile pattern"], ["Floral", "floral ornament pattern"], ["Modern", "modern abstract pattern"], ["Şehir", "city line art pattern"]].map(([label, query]) => <button key={label} onClick={() => { setPatternQuery(query); searchPatterns(query); }}>{label}</button>)}</div>
                  <div className="pattern-search"><input aria-label="Webde desen ara" value={patternQuery} placeholder="Örn. kilim, çini, geometrik..." onChange={(event) => setPatternQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchPatterns(); }} /><button onClick={() => searchPatterns()} disabled={patternLoading} aria-label="Desen ara">{patternLoading ? <LoaderCircle className="spin" /> : <Search />}</button></div>
                  <label className="upload-button"><Upload /><span>Kendi görselini yükle</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadBackground(event.target.files?.[0])} /></label>
                  {patternError && <div className="inline-error">{patternError}</div>}
                  {patternLoading && <div className="pattern-status"><LoaderCircle className="spin" /> Wikimedia Commons taranıyor…</div>}
                  {patternResults.length > 0 && <div className="pattern-count">{patternResults.length} lisanslı görsel bulundu</div>}
                  {patternResults.length > 0 && <div className="pattern-results">{patternResults.map((item) => <button key={item.id} className={form.backgroundImage === item.thumbnail ? "selected" : ""} onClick={() => setForm((current) => ({ ...current, showPattern: true, backgroundImage: item.thumbnail, builtinPatternId: undefined }))} title={`${item.title} - ${item.license}`}><img src={item.thumbnail} alt="" /><span>{item.license}</span></button>)}</div>}
                  {patternResults.length > 0 && <a className="license-note" href={patternResults[0].sourceUrl} target="_blank" rel="noreferrer">Kaynak ve lisans bilgilerini Wikimedia Commons'ta görüntüle</a>}
                  {form.backgroundImage && <button className="remove-background" onClick={() => setForm((current) => ({ ...current, backgroundImage: "", builtinPatternId: undefined }))}>Arka plan görselini kaldır</button>}
                  <div className="segmented"><button className={form.backgroundSize === "cover" ? "active" : ""} onClick={() => update("backgroundSize", "cover")}>Kapla</button><button className={form.backgroundSize === "contain" ? "active" : ""} onClick={() => update("backgroundSize", "contain")}>Sığdır</button><button className={form.backgroundSize === "repeat" ? "active" : ""} onClick={() => update("backgroundSize", "repeat")}>Tekrarla</button></div>
                  <RangeControl label="Desen opaklığı" value={form.backgroundOpacity} min={5} max={100} unit="%" onChange={(value) => update("backgroundOpacity", value)} />
                  <RangeControl label="Desen adedi / yoğunluğu" value={form.patternDensity} min={1} max={12} onChange={(value) => update("patternDensity", value)} />
                  <small className="control-hint">Az değer büyük ve seyrek, yüksek değer küçük ve sık desen oluşturur. Görsellerde “Tekrarla” moduyla kullanılır.</small>
                  <label className="field"><span>Desen konumu</span><select value={form.backgroundPosition} onChange={(event) => update("backgroundPosition", event.target.value)}><option value="center">Orta</option><option value="top">Üst</option><option value="bottom">Alt</option><option value="left">Sol</option><option value="right">Sağ</option></select></label>
                </details>
                <details className="design-section">
                  <summary className="section-title"><Palette /><strong>Yüzey ve çerçeve</strong></summary>
                  <label className="field color-field"><span>Kaplama rengi</span><div><input type="color" value={form.overlayColor} onChange={(event) => update("overlayColor", event.target.value)} /><input value={form.overlayColor.toUpperCase()} onChange={(event) => update("overlayColor", event.target.value)} /></div></label>
                  <RangeControl label="Kaplama opaklığı" value={form.overlayOpacity} min={0} max={90} unit="%" onChange={(value) => update("overlayOpacity", value)} />
                  <RangeControl label="Köşe yuvarlaklığı" value={form.radius} min={0} max={42} unit="px" onChange={(value) => update("radius", value)} />
                  <RangeControl label="Çerçeve kalınlığı" value={form.borderWidth} min={0} max={12} unit="px" onChange={(value) => update("borderWidth", value)} />
                  <div className="control-group"><span>Vurgu şekli</span><div className="accent-shape-grid">
                    {accentShapeOptions.map((option) => (
                      <button key={option.id} type="button" className={(form.accentShape || "default") === option.id ? "active" : ""} onClick={() => update("accentShape", option.id)} title={option.label} aria-label={option.label}>
                        {option.id === "default" ? <span className="accent-preview-default" /> : option.id === "none" ? <span className="accent-preview-none" /> : <AccentShapeSvg shape={option.id} />}
                      </button>
                    ))}
                    {customShapes.map((shape) => (
                      <button key={shape.id} type="button" className={`custom-shape ${form.accentShape === shape.id ? "active" : ""}`} onClick={() => update("accentShape", shape.id)} title={shape.name} aria-label={shape.name}>
                        <img src={shape.dataUri} alt="" />
                        <span className="shape-remove" role="button" tabIndex={0} title="Sil" aria-label="Şekli sil" onClick={(e) => { e.stopPropagation(); removeCustomShape(shape.id); }}>×</span>
                      </button>
                    ))}
                  </div>
                  <input ref={shapeFileInputRef} type="file" accept="image/svg+xml,image/png,image/webp" hidden onChange={handleShapeUpload} />
                  <button type="button" className="shape-upload-button" onClick={() => shapeFileInputRef.current?.click()}>Şekil Yükle</button></div>
                </details>
                <Toggle label={t.showPhone} active={form.showPhone} onClick={() => update("showPhone", !form.showPhone)} />
                <Toggle label={t.showNfc} active={form.showNfc} onClick={() => update("showNfc", !form.showNfc)} />
              </>
            ) : (
              <div className="ai-panel">
                <div className="ai-intro"><Sparkles /><div><strong>{t.ai}</strong><p>{form.language === "tr" ? "Mesleğinize, şehrinize ve istediğiniz havaya göre özgün kart dili oluşturur." : "Creates an original card style from your profession, city and preferred mood."}</p></div></div>
                <div className="control-group"><span>{t.provider}</span><div className="segmented provider-choice"><button className={aiInput.provider === "deepseek" ? "active" : ""} onClick={() => setAiInput((current) => ({ ...current, provider: "deepseek" }))}>DeepSeek Direct</button><button className={aiInput.provider === "openrouter" ? "active" : ""} onClick={() => setAiInput((current) => ({ ...current, provider: "openrouter" }))}>OpenRouter</button></div></div>
                <Field label={t.profession} value={aiInput.profession} onChange={(value) => setAiInput((current) => ({ ...current, profession: value }))} />
                <Field label={t.city} value={aiInput.city} onChange={(value) => setAiInput((current) => ({ ...current, city: value }))} />
                <label className="field"><span>{t.tone}</span><select value={aiInput.tone} onChange={(event) => setAiInput((current) => ({ ...current, tone: event.target.value }))}><option>Samimi</option><option>Komik</option><option>Resmi</option><option>Enerjik</option><option>Sade</option></select></label>
                <label className="field"><span>{t.aiRequest}</span><textarea value={aiInput.prompt} onChange={(event) => setAiInput((current) => ({ ...current, prompt: event.target.value }))} /></label>
                {aiError && <div className="inline-error">{aiError}</div>}
                <button className="ai-generate" onClick={generateAiDesign} disabled={aiLoading}>{aiLoading ? <LoaderCircle className="spin" /> : <Sparkles />}{aiLoading ? t.generating : t.generate}</button>
                <small className="provider-note">{aiInput.provider === "deepseek" ? `DeepSeek API - ${settings.deepseekModel}` : `OpenRouter - ${settings.openrouterModel}`}</small>
                <div className="ai-art-card">
                  <div className="ai-intro"><ImageIcon /><div><strong>AI kart görseli</strong><p>Arka plan sanatını üretir. İsim, telefon ve gerçek QR uygulama tarafından üstte tutulur.</p></div></div>
                  <label className="field"><span>Görsel isteği</span><textarea value={aiArtPrompt} onChange={(event) => setAiArtPrompt(event.target.value)} placeholder="Örn. koyu lacivert, turkuaz çizgiler, modern mühendislik teması" /></label>
                  {aiArtError && <div className="inline-error">{aiArtError}</div>}
                  <button className="ai-generate ai-art-generate" onClick={generateAiCardArt} disabled={aiArtLoading}>{aiArtLoading ? <LoaderCircle className="spin" /> : <ImageIcon />}{aiArtLoading ? "Görsel üretiliyor" : "Kart görseli üret"}</button>
                  <small className="provider-note">OpenRouter Image API - {settings.imageModel}</small>
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>
      <div className="export-source-deck" aria-hidden="true">
        {printableSavedTemplates.map((saved) => (
          <div key={saved.template.id} ref={(node) => { savedPrintCardRefs.current[saved.template.id] = node; }}>
            <CardPreview form={saved.form} template={saved.template} initialLayout={saved.layout} customShapes={customShapes} />
          </div>
        ))}
      </div>
      {exportOpen && (
        <div className="modal-overlay" onClick={() => !exporting && setExportOpen(false)}>
          <div className="modal-card export-panel" role="dialog" aria-modal="true" aria-label="Dışa aktarma seçenekleri" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Kapat" disabled={Boolean(exporting)} onClick={() => setExportOpen(false)}><X /></button>
            <div className="export-heading"><Download /><div><strong>Baskı ve dışa aktarma</strong><p>Kartı tek PNG olarak veya kesime hazır A4 sayfası halinde indirin.</p></div></div>
            <div className="export-options">
              <button type="button" className="export-option" disabled={Boolean(exporting)} onClick={exportCard}>
                <span className="export-option-icon"><ImageIcon /></span>
                <span><strong>Tek kart PNG</strong><small>Mevcut kart ölçüsünde yüksek çözünürlüklü görsel</small></span>
                {exporting === "png" ? <LoaderCircle className="spin" /> : <Download />}
              </button>
              <button type="button" className="export-option recommended" disabled={Boolean(exporting) || (form.cardFormat || "vehicle") !== "vehicle"} onClick={exportA4PrintSheet}>
                <span className="export-option-icon"><FileText /></span>
                <span><strong>6'lı A4 baskı PDF</strong><small>A4 yatay, 3 x 2 dizilim, kesilmiş kart 65 x 94 mm</small></span>
                {exporting === "pdf" ? <LoaderCircle className="spin" /> : <Download />}
              </button>
              <button type="button" className="export-option" disabled={Boolean(exporting) || !printableSavedTemplates.length || !selectedPrintCardIds.length} onClick={exportMixedA4PrintSheet}>
                <span className="export-option-icon"><Copy /></span>
                <span><strong>Farklı araçlarla karışık A4</strong><small>Seçilen tema, plaka, telefon ve QR bilgilerini aynı sayfaya dizer</small></span>
                {exporting === "mixed" ? <LoaderCircle className="spin" /> : <Download />}
              </button>
            </div>
            <div className="mixed-print-section">
              <div className="mixed-print-heading"><strong>Karışık sayfaya eklenecek kartlar</strong><small>En fazla 6 farklı kart seçin. Seçimler 6 baskı yuvasına sırayla dağıtılır.</small></div>
              <div className="mixed-card-picker">
                <button type="button" aria-pressed={selectedPrintCardIds.includes("current")} className={selectedPrintCardIds.includes("current") ? "selected" : ""} disabled={(form.cardFormat || "vehicle") !== "vehicle" || (!selectedPrintCardIds.includes("current") && selectedPrintCardIds.length >= 6)} onClick={() => togglePrintCard("current")}>
                  <span style={{ background: form.backgroundColor || template.bg }} />
                  <strong>{form.plate || "Geçerli kart"}</strong><small>{template.label}</small>
                </button>
                {printableSavedTemplates.map((saved) => {
                  const selected = selectedPrintCardIds.includes(saved.template.id);
                  return <button key={saved.template.id} type="button" aria-pressed={selected} className={selected ? "selected" : ""} disabled={!selected && selectedPrintCardIds.length >= 6} onClick={() => togglePrintCard(saved.template.id)}>
                    <span style={{ background: saved.form.backgroundColor || saved.template.bg }} />
                    <strong>{saved.form.plate || saved.template.label}</strong><small>{saved.template.label}</small>
                  </button>;
                })}
              </div>
              {!printableSavedTemplates.length && <small className="mixed-print-empty">Farklı bir aracı hazırlayıp kart altındaki "Farklı kaydet" düğmesine basın. Kayıtlı araçlar burada görünür.</small>}
            </div>
            <div className="print-spec"><strong>Kesim payı dahil</strong><span>Tema, kesim çizgisinin yatayda 2 mm ve dikeyde 3 mm dışına taşar. Kartı çizgilerden kestikten sonra PVC kaplayın.</span></div>
            {(form.cardFormat || "vehicle") !== "vehicle" && <div className="inline-error">6'lı A4 baskı için önce "Araç kartı" ölçüsünü seçin.</div>}
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal-card settings-panel" role="dialog" aria-modal="true" aria-label="Sağlayıcı ayarları" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" aria-label="Kapat" onClick={() => setSettingsOpen(false)}><X /></button>
            <div className="settings-heading"><Settings2 /><div><strong>Sağlayıcı ayarları</strong><p>API anahtarları yalnızca yerel sunucuda saklanır ve tekrar arayüze gönderilmez.</p></div></div>
            <label className="field"><span>Varsayılan sağlayıcı</span><select value={settings.defaultProvider} onChange={(event) => setSettings((current) => ({ ...current, defaultProvider: event.target.value }))}><option value="deepseek">DeepSeek Direct</option><option value="openrouter">OpenRouter</option></select></label>
            <section className="provider-settings">
              <div className="provider-title"><strong>DeepSeek Direct</strong><span className={settings.deepseekConfigured ? "configured" : ""}>{settings.deepseekConfigured ? "Yapılandırıldı" : "Anahtar yok"}</span></div>
              <label className="field"><span>DeepSeek API anahtarı</span><input type="password" value={settings.deepseekKey} placeholder={settings.deepseekConfigured ? "Değiştirmek için yeni anahtar girin" : "sk-..."} onChange={(event) => setSettings((current) => ({ ...current, deepseekKey: event.target.value }))} /></label>
              <button className="fetch-models" type="button" onClick={() => fetchModels("deepseek")} disabled={modelsLoading === "deepseek"}>{modelsLoading === "deepseek" ? <LoaderCircle className="spin" /> : <Download />}API'den modelleri getir</button>
              {providerModels.deepseek.length ? <label className="field"><span>Model seç</span><select value={settings.deepseekModel} onChange={(event) => setSettings((current) => ({ ...current, deepseekModel: event.target.value }))}>{providerModels.deepseek.map((model) => <option key={model.id} value={model.id}>{model.name} — {model.id}</option>)}</select></label> : <Field label="Model" value={settings.deepseekModel} onChange={(value) => setSettings((current) => ({ ...current, deepseekModel: value }))} />}
            </section>
            <section className="provider-settings">
              <div className="provider-title"><strong>OpenRouter</strong><span className={settings.openrouterConfigured ? "configured" : ""}>{settings.openrouterConfigured ? "Yapılandırıldı" : "Anahtar yok"}</span></div>
              <label className="field"><span>OpenRouter API anahtarı</span><input type="password" value={settings.openrouterKey} placeholder={settings.openrouterConfigured ? "Değiştirmek için yeni anahtar girin" : "sk-or-..."} onChange={(event) => setSettings((current) => ({ ...current, openrouterKey: event.target.value }))} /></label>
              <button className="fetch-models" type="button" onClick={() => fetchModels("openrouter")} disabled={modelsLoading === "openrouter"}>{modelsLoading === "openrouter" ? <LoaderCircle className="spin" /> : <Download />}API'den modelleri getir</button>
              {providerModels.openrouter.length ? <label className="field"><span>Model seç</span><select value={settings.openrouterModel} onChange={(event) => setSettings((current) => ({ ...current, openrouterModel: event.target.value }))}>{providerModels.openrouter.map((model) => <option key={model.id} value={model.id}>{model.name} — {model.id}</option>)}</select></label> : <Field label="Model" value={settings.openrouterModel} onChange={(value) => setSettings((current) => ({ ...current, openrouterModel: value }))} />}
              <Field label="Görsel üretim modeli" value={settings.imageModel} onChange={(value) => setSettings((current) => ({ ...current, imageModel: value }))} hint="OpenRouter Image API model kimliği" />
            </section>
            <button className="ai-generate" onClick={saveSettings} disabled={settingsLoading}>{settingsLoading ? <LoaderCircle className="spin" /> : <Check />}{settingsLoading ? "Kaydediliyor" : "Ayarları kaydet"}</button>
            <button className="reset-design" type="button" onClick={resetToDefault}><RotateCcw /> Varsayılan tasarıma dön</button>
          </div>
        </div>
      )}
      {toast && <div className="toast"><Check />{toast}</div>}
    </main>
  );
}
