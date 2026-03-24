// shields.io-style SVG badge generator

type BadgeStyle = "flat" | "flat-square";

type BadgeOptions = {
  label: string;
  message: string;
  color: string;
  labelColor: string;
  style: BadgeStyle;
};

const FONT_SIZE = 11;
const FONT_FAMILY = "DejaVu Sans,Verdana,Geneva,sans-serif";
const PAD_H = 8;
const HEIGHT = 20;
const HEIGHT_SQUARE = 20;

function charWidth(ch: string): number {
  // Approximate character widths for common sans-serif at 11px
  // Uppercase ~7.5, lowercase ~6.5, digits ~6.5, spaces ~3
  if (ch === " ") return 3;
  if (ch >= "A" && ch <= "Z") return 7.2;
  if (ch >= "a" && ch <= "z") return 6.4;
  if (ch >= "0" && ch <= "9") return 6.5;
  if (ch === "/") return 4;
  if (ch === ".") return 3.5;
  if (ch === "-" || ch === "–") return 4.5;
  // CJK characters are roughly double width
  if (ch.charCodeAt(0) > 0x2e80) return 12;
  return 6.5;
}

function textWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sanitize a color value to prevent attribute injection in SVG.
 *  Only allows hex (#rgb, #rrggbb, #rrggbbaa), named CSS colors, and
 *  rgb()/hsl() functions with safe characters. Falls back to #555. */
function sanitizeColor(c: string, fallback = "#555"): string {
  const s = c.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^[a-zA-Z]{1,30}$/.test(s)) return s;
  if (/^(?:rgb|hsl)a?\([0-9.,% ]+\)$/.test(s)) return s;
  return fallback;
}

function renderFlat(opts: BadgeOptions): string {
  const labelW = textWidth(opts.label) + PAD_H * 2;
  const msgW = textWidth(opts.message) + PAD_H * 2;
  const totalW = labelW + msgW;
  const h = HEIGHT;
  const labelX = labelW / 2;
  const msgX = labelW + msgW / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalW}" height="${h}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${h}" fill="${sanitizeColor(opts.labelColor)}"/>
    <rect x="${labelW}" width="${msgW}" height="${h}" fill="${sanitizeColor(opts.color)}"/>
    <rect width="${totalW}" height="${h}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT_FAMILY}" text-rendering="geometricPrecision" font-size="${FONT_SIZE}">
    <text x="${labelX}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(opts.label)}</text>
    <text x="${labelX}" y="13">${escapeXml(opts.label)}</text>
    <text x="${msgX}" y="14" fill="#010101" fill-opacity=".3">${escapeXml(opts.message)}</text>
    <text x="${msgX}" y="13">${escapeXml(opts.message)}</text>
  </g>
</svg>`;
}

function renderFlatSquare(opts: BadgeOptions): string {
  const labelW = textWidth(opts.label) + PAD_H * 2;
  const msgW = textWidth(opts.message) + PAD_H * 2;
  const totalW = labelW + msgW;
  const h = HEIGHT_SQUARE;
  const labelX = labelW / 2;
  const msgX = labelW + msgW / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${h}">
  <g shape-rendering="crispEdges">
    <rect width="${labelW}" height="${h}" fill="${sanitizeColor(opts.labelColor)}"/>
    <rect x="${labelW}" width="${msgW}" height="${h}" fill="${sanitizeColor(opts.color)}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT_FAMILY}" text-rendering="geometricPrecision" font-size="${FONT_SIZE}">
    <text x="${labelX}" y="14">${escapeXml(opts.label)}</text>
    <text x="${msgX}" y="14">${escapeXml(opts.message)}</text>
  </g>
</svg>`;
}

export function renderBadge(opts: BadgeOptions): string {
  switch (opts.style) {
    case "flat-square":
      return renderFlatSquare(opts);
    default:
      return renderFlat(opts);
  }
}

/** Pick a color based on completion ratio (0..1) */
export function progressColor(ratio: number): string {
  if (ratio >= 1) return "#4c1";
  if (ratio >= 0.75) return "#97ca00";
  if (ratio >= 0.5) return "#dfb317";
  if (ratio >= 0.25) return "#fe7d37";
  return "#e05d44";
}
