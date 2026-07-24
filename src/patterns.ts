export type BuiltinPattern = {
  id: string;
  label: string;
  category: string;
  svg: (color: string) => string;
};

export const patternCategories = ["Anadolu", "Geometrik", "Piksel", "Retro Film", "Doğa"];

// Küçük yardımcı: her tile 80x80, arka plan şeffaf, tek renk + düşük opaklı ton.
const tile = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">${inner}</svg>`;

export const builtinPatterns: BuiltinPattern[] = [
  // ---------------- Anadolu ----------------
  {
    id: "cintemani",
    label: "Çintemani",
    category: "Anadolu",
    svg: (c) =>
      tile(
        `<g fill="none" stroke="${c}" stroke-width="2.5">
          <circle cx="20" cy="18" r="6"/><circle cx="40" cy="10" r="6"/><circle cx="60" cy="18" r="6"/>
        </g>
        <g fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round">
          <path d="M10 46 q10 -8 20 0 t20 0 t20 0"/>
          <path d="M10 58 q10 -8 20 0 t20 0 t20 0"/>
        </g>`
      ),
  },
  {
    id: "elibelinde",
    label: "Elibelinde",
    category: "Anadolu",
    svg: (c) =>
      tile(
        `<g fill="${c}">
          <circle cx="40" cy="14" r="6"/>
          <path d="M40 20 L52 32 L48 50 L54 66 L26 66 L32 50 L28 32 Z" fill="${c}" fill-opacity="0.55"/>
          <path d="M28 32 L14 40 L18 48 L30 42 Z"/>
          <path d="M52 32 L66 40 L62 48 L50 42 Z"/>
        </g>`
      ),
  },
  {
    id: "kocboynuzu",
    label: "Koçboynuzu",
    category: "Anadolu",
    svg: (c) =>
      tile(
        `<g fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round">
          <path d="M40 20 C40 40 20 40 20 55 C20 66 34 66 34 56"/>
          <path d="M40 20 C40 40 60 40 60 55 C60 66 46 66 46 56"/>
        </g>`
      ),
  },
  {
    id: "nazar",
    label: "Nazar",
    category: "Anadolu",
    svg: (c) =>
      tile(
        `<g>
          <circle cx="40" cy="40" r="20" fill="none" stroke="${c}" stroke-width="3"/>
          <circle cx="40" cy="40" r="12" fill="${c}" fill-opacity="0.25"/>
          <circle cx="40" cy="40" r="6" fill="${c}"/>
        </g>`
      ),
  },
  {
    id: "kilim-zigzag",
    label: "Kilim Zikzak",
    category: "Anadolu",
    svg: (c) =>
      tile(
        `<g fill="none" stroke="${c}" stroke-width="2.5">
          <path d="M0 20 L20 4 L40 20 L60 4 L80 20"/>
          <path d="M0 60 L20 44 L40 60 L60 44 L80 60"/>
        </g>
        <g fill="${c}" fill-opacity="0.6">
          <path d="M20 30 L28 40 L20 50 L12 40 Z"/>
          <path d="M60 30 L68 40 L60 50 L52 40 Z"/>
        </g>`
      ),
  },
  // ---------------- Geometrik ----------------
  {
    id: "grid-dots",
    label: "Izgara Nokta",
    category: "Geometrik",
    svg: (c) =>
      tile(
        `<g fill="${c}">
          <circle cx="20" cy="20" r="3"/><circle cx="60" cy="20" r="3"/>
          <circle cx="20" cy="60" r="3"/><circle cx="60" cy="60" r="3"/>
          <circle cx="40" cy="40" r="3" fill-opacity="0.5"/>
        </g>`
      ),
  },
  {
    id: "hex-honeycomb",
    label: "Altıgen Petek",
    category: "Geometrik",
    svg: (c) =>
      tile(
        `<g fill="none" stroke="${c}" stroke-width="2">
          <path d="M20 5 L36 14 L36 32 L20 41 L4 32 L4 14 Z"/>
          <path d="M60 5 L76 14 L76 32 L60 41 L44 32 L44 14 Z"/>
          <path d="M40 42 L56 51 L56 69 L40 78 L24 69 L24 51 Z"/>
        </g>`
      ),
  },
  {
    id: "triangle-mosaic",
    label: "Üçgen Mozaik",
    category: "Geometrik",
    svg: (c) =>
      tile(
        `<g fill="${c}">
          <path d="M0 0 L20 0 L10 20 Z"/>
          <path d="M40 0 L60 0 L50 20 Z" fill-opacity="0.5"/>
          <path d="M20 20 L40 20 L30 40 Z"/>
          <path d="M60 20 L80 20 L70 40 Z" fill-opacity="0.5"/>
          <path d="M0 40 L20 40 L10 60 Z" fill-opacity="0.5"/>
          <path d="M40 40 L60 40 L50 60 Z"/>
        </g>`
      ),
  },
  {
    id: "cross-lines",
    label: "Kesişen Çizgi",
    category: "Geometrik",
    svg: (c) =>
      tile(
        `<g stroke="${c}" stroke-width="1.5">
          <line x1="0" y1="0" x2="80" y2="80"/>
          <line x1="80" y1="0" x2="0" y2="80"/>
          <line x1="40" y1="0" x2="40" y2="80" stroke-opacity="0.4"/>
          <line x1="0" y1="40" x2="80" y2="40" stroke-opacity="0.4"/>
        </g>`
      ),
  },
  // ---------------- Piksel ----------------
  {
    id: "pixel-blocks",
    label: "8-bit Bloklar",
    category: "Piksel",
    svg: (c) => {
      const filled = [
        [0, 0], [2, 0], [3, 1], [1, 1], [0, 2], [3, 2], [2, 3], [1, 3], [3, 3], [0, 3],
      ];
      const rects = filled
        .map(([x, y]) => `<rect x="${x * 20}" y="${y * 20}" width="20" height="20"/>`)
        .join("");
      return tile(`<g fill="${c}" fill-opacity="0.85">${rects}</g>`);
    },
  },
  {
    id: "iso-cubes",
    label: "İzometrik Küp",
    category: "Piksel",
    svg: (c) =>
      tile(
        `<g stroke="${c}" stroke-width="1.5" fill="none">
          <path d="M40 12 L64 26 L64 54 L40 68 L16 54 L16 26 Z"/>
          <path d="M40 12 L40 40 M40 40 L16 26 M40 40 L64 26"/>
        </g>
        <path d="M40 40 L64 26 L64 54 L40 68 Z" fill="${c}" fill-opacity="0.2"/>`
      ),
  },
  {
    id: "pixel-checker",
    label: "Piksel Dama",
    category: "Piksel",
    svg: (c) =>
      tile(
        `<g fill="${c}">
          <rect x="0" y="0" width="20" height="20"/>
          <rect x="40" y="0" width="20" height="20"/>
          <rect x="20" y="20" width="20" height="20"/>
          <rect x="60" y="20" width="20" height="20"/>
          <rect x="0" y="40" width="20" height="20"/>
          <rect x="40" y="40" width="20" height="20"/>
          <rect x="20" y="60" width="20" height="20"/>
          <rect x="60" y="60" width="20" height="20"/>
        </g>`
      ),
  },
  // ---------------- Retro Film ----------------
  {
    id: "film-strip",
    label: "Film Şeridi",
    category: "Retro Film",
    svg: (c) =>
      tile(
        `<g fill="${c}">
          <rect x="0" y="8" width="80" height="6" fill-opacity="0.35"/>
          <rect x="0" y="66" width="80" height="6" fill-opacity="0.35"/>
          <rect x="6" y="24" width="10" height="10" rx="2"/>
          <rect x="26" y="24" width="10" height="10" rx="2"/>
          <rect x="46" y="24" width="10" height="10" rx="2"/>
          <rect x="66" y="24" width="10" height="10" rx="2"/>
          <rect x="6" y="46" width="10" height="10" rx="2"/>
          <rect x="26" y="46" width="10" height="10" rx="2"/>
          <rect x="46" y="46" width="10" height="10" rx="2"/>
          <rect x="66" y="46" width="10" height="10" rx="2"/>
        </g>`
      ),
  },
  {
    id: "sunburst",
    label: "Güneş Işınları",
    category: "Retro Film",
    svg: (c) =>
      tile(
        `<g fill="${c}" fill-opacity="0.55">
          <path d="M0 80 L0 60 L80 80 Z"/>
          <path d="M0 80 L0 40 L60 80 Z" fill-opacity="0.35"/>
          <path d="M0 80 L20 80 L0 60 Z"/>
          <path d="M0 80 L50 80 L0 50 Z" fill-opacity="0.25"/>
        </g>
        <circle cx="0" cy="80" r="10" fill="${c}"/>`
      ),
  },
  // ---------------- Doğa ----------------
  {
    id: "leaf-branch",
    label: "Yaprak Dalı",
    category: "Doğa",
    svg: (c) =>
      tile(
        `<g fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round">
          <path d="M10 70 Q40 40 70 10"/>
        </g>
        <g fill="${c}" fill-opacity="0.6">
          <path d="M30 46 q-10 -6 -4 -16 q10 6 4 16 Z"/>
          <path d="M46 30 q10 -6 4 -16 q-10 6 -4 16 Z"/>
          <path d="M20 58 q-10 -6 -4 -16 q10 6 4 16 Z"/>
        </g>`
      ),
  },
  {
    id: "waves",
    label: "Deniz Dalgası",
    category: "Doğa",
    svg: (c) =>
      tile(
        `<g fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round">
          <path d="M0 20 q20 -14 40 0 t40 0"/>
          <path d="M0 40 q20 -14 40 0 t40 0" stroke-opacity="0.6"/>
          <path d="M0 60 q20 -14 40 0 t40 0"/>
        </g>`
      ),
  },
];

export const patternDataUri = (p: BuiltinPattern, color: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(p.svg(color))}`;
