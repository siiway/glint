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

// ─── Todo-list SVG (GitHub markdown style) ───────────────────────────────────

export type TodoItem = {
  title: string;
  completed: boolean;
  depth: number; // 0 = root, 1 = sub-todo, etc.
};

export type TodoListOptions = {
  title?: string;
  todos: TodoItem[];
  theme?: "light" | "dark";
  bgColor?: string;
  textColor?: string;
  checkColor?: string;
  borderColor?: string;
  fontSize?: number;
  showProgress?: boolean;
  maxItems?: number;
  width?: number;
};

const LIST_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";

function charWidthAt(ch: string, fontSize: number): number {
  const scale = fontSize / 11;
  return charWidth(ch) * scale;
}

function textWidthAt(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += charWidthAt(ch, fontSize);
  return w;
}

/** Truncate text to fit within maxW pixels, appending "..." */
function truncateText(text: string, maxW: number, fontSize: number): string {
  const ellipsis = "...";
  const ellipsisW = textWidthAt(ellipsis, fontSize);
  if (textWidthAt(text, fontSize) <= maxW) return text;
  let truncated = "";
  let w = 0;
  for (const ch of text) {
    const cw = charWidthAt(ch, fontSize);
    if (w + cw + ellipsisW > maxW) break;
    truncated += ch;
    w += cw;
  }
  return truncated + ellipsis;
}

export function renderTodoList(opts: TodoListOptions): string {
  const fontSize = opts.fontSize ?? 14;
  const lineHeight = Math.round(fontSize * 1.7);
  const checkboxSize = Math.round(fontSize * 0.93);
  const width = opts.width ?? 400;
  const maxItems = opts.maxItems ?? 50;
  const showProgress = opts.showProgress !== false;

  const isDark = opts.theme === "dark";
  const bgColor = sanitizeColor(
    opts.bgColor ?? (isDark ? "#0d1117" : "#ffffff"),
  );
  const textColor = sanitizeColor(
    opts.textColor ?? (isDark ? "#e6edf3" : "#1f2328"),
  );
  const mutedColor = isDark ? "#848d97" : "#656d76";
  const checkColor = sanitizeColor(opts.checkColor ?? "#1a7f37");
  const borderColor = sanitizeColor(
    opts.borderColor ?? (isDark ? "#30363d" : "#d1d9e0"),
  );
  const checkboxBorder = isDark ? "#484f58" : "#bcc0c4";
  const completedTextColor = isDark ? "#848d97" : "#656d76";

  const padX = 16;
  const padY = 12;

  const todos = opts.todos.slice(0, maxItems);
  const totalCount = opts.todos.length;
  const doneCount = opts.todos.filter((t) => t.completed).length;
  const truncated = opts.todos.length > maxItems;

  let y = padY;
  const rows: string[] = [];

  // Title
  if (opts.title) {
    const titleFontSize = Math.round(fontSize * 1.15);
    y += Math.round(titleFontSize * 0.3);
    rows.push(
      `<text x="${padX}" y="${y + titleFontSize * 0.85}" fill="${textColor}" font-size="${titleFontSize}" font-weight="600">${escapeXml(truncateText(opts.title, width - padX * 2, titleFontSize))}</text>`,
    );
    y += Math.round(titleFontSize * 1.4);

    if (showProgress) {
      const ratio = totalCount > 0 ? doneCount / totalCount : 0;
      const barW = width - padX * 2;
      const barH = 8;
      const barR = 4;
      const fillW = Math.round(barW * ratio);
      const pColor = sanitizeColor(opts.checkColor ?? progressColor(ratio));
      rows.push(
        `<rect x="${padX}" y="${y}" width="${barW}" height="${barH}" rx="${barR}" fill="${borderColor}"/>`,
      );
      if (fillW > 0) {
        rows.push(
          `<rect x="${padX}" y="${y}" width="${fillW}" height="${barH}" rx="${barR}" fill="${pColor}"/>`,
        );
      }
      y += barH + 4;
      rows.push(
        `<text x="${padX}" y="${y + fontSize * 0.75}" fill="${mutedColor}" font-size="${Math.round(fontSize * 0.78)}">${doneCount}/${totalCount} completed</text>`,
      );
      y += Math.round(fontSize * 1.2);
    }

    // Divider
    y += 4;
    rows.push(
      `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" stroke="${borderColor}" stroke-width="1"/>`,
    );
    y += 8;
  }

  // Todo items
  for (const todo of todos) {
    const indent = padX + todo.depth * 20;
    const cbX = indent;
    const cbY = y + Math.round((lineHeight - checkboxSize) / 2);
    const textX = cbX + checkboxSize + 8;
    const textY = y + Math.round(lineHeight * 0.62);
    const maxTextW = width - textX - padX;

    if (todo.completed) {
      // Filled checkbox with checkmark
      rows.push(
        `<rect x="${cbX}" y="${cbY}" width="${checkboxSize}" height="${checkboxSize}" rx="3" fill="${checkColor}"/>`,
      );
      // Checkmark path
      const cx = cbX + checkboxSize * 0.25;
      const cy = cbY + checkboxSize * 0.5;
      const mx = cbX + checkboxSize * 0.45;
      const my = cbY + checkboxSize * 0.72;
      const ex = cbX + checkboxSize * 0.78;
      const ey = cbY + checkboxSize * 0.3;
      rows.push(
        `<polyline points="${cx},${cy} ${mx},${my} ${ex},${ey}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
      // Strikethrough text
      rows.push(
        `<text x="${textX}" y="${textY}" fill="${completedTextColor}" font-size="${fontSize}" text-decoration="line-through">${escapeXml(truncateText(todo.title, maxTextW, fontSize))}</text>`,
      );
    } else {
      // Empty checkbox
      rows.push(
        `<rect x="${cbX}" y="${cbY}" width="${checkboxSize}" height="${checkboxSize}" rx="3" fill="none" stroke="${checkboxBorder}" stroke-width="1.5"/>`,
      );
      // Normal text
      rows.push(
        `<text x="${textX}" y="${textY}" fill="${textColor}" font-size="${fontSize}">${escapeXml(truncateText(todo.title, maxTextW, fontSize))}</text>`,
      );
    }

    y += lineHeight;
  }

  // "and N more..." if truncated
  if (truncated) {
    const moreText = `and ${totalCount - maxItems} more...`;
    y += 4;
    rows.push(
      `<text x="${padX}" y="${y + fontSize * 0.75}" fill="${mutedColor}" font-size="${Math.round(fontSize * 0.85)}" font-style="italic">${escapeXml(moreText)}</text>`,
    );
    y += Math.round(fontSize * 1.2);
  }

  y += padY;
  const totalH = y;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">
  <rect width="${width}" height="${totalH}" rx="6" fill="${bgColor}" stroke="${borderColor}" stroke-width="1"/>
  <g font-family="${LIST_FONT}" text-rendering="optimizeLegibility">
    ${rows.join("\n    ")}
  </g>
</svg>`;
}
