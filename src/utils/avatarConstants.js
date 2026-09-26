export const GRID_SIZE = 16;

export const BASIC_COLORS = [
  "#ff6b6b", "#ee5a24", "#f39c12", "#f1c40f",
  "#2ecc71", "#1abc9c", "#3498db", "#2980b9",
  "#9b59b6", "#8e44ad", "#e84393", "#fd79a8",
  "#d63031", "#e17055", "#fdcb6e", "#ffeaa7",
  "#00b894", "#55efc4", "#74b9ff", "#0984e3",
  "#6c5ce7", "#a29bfe", "#fab1a0", "#636e72",
  "#2d3436", "#000000", "#b2bec3", "#dfe6e9",
  "#ffffff", "#f4c430", "#5fd4d6", "#e85a7a",
];

// The five built-in avatars as 16x16 pixel maps, so they render through the
// same crisp path as painted ones. Each is a three-stop vertical gradient
// quantized to one color per row, with two 2x2 eyes and a one-row mouth — the
// same face the old CSS version drew with fractional em offsets.
const PRESET_STOPS = {
  1: ["#f4c430", "#c89820", "#6b3a1f"],
  2: ["#5fd4d6", "#2a8a8c", "#1a3a4a"],
  3: ["#e85a7a", "#a83a5a", "#4a1a2c"],
  4: ["#9bd14f", "#6a9a30", "#1a3a1a"],
  5: ["#c5a8ff", "#7a5fc8", "#3a2470"],
  me: ["#ead8b1", "#c8b890", "#6b3a1f"],
};
const FACE = "#1a1024";

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    "#" +
    pa
      .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0"))
      .join("")
  );
}

const presetCache = new Map();

/** Pixel data ({ pixels: 16x16 }) for a built-in avatar variant. */
export function presetAvatar(variant) {
  const key = PRESET_STOPS[variant] ? variant : 1;
  if (presetCache.has(key)) return presetCache.get(key);

  const [top, mid, bottom] = PRESET_STOPS[key];
  const pixels = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const t = r / (GRID_SIZE - 1);
    const color = t < 0.5 ? mix(top, mid, t * 2) : mix(mid, bottom, (t - 0.5) * 2);
    const row = Array(GRID_SIZE).fill(color);
    if (r === 7 || r === 8) row[4] = row[5] = row[10] = row[11] = FACE;
    if (r === 11) for (let c = 3; c <= 12; c++) row[c] = FACE;
    pixels.push(row);
  }
  const data = { pixels };
  presetCache.set(key, data);
  return data;
}

/** Device-pixel side (a multiple of 16) and CSS side for a requested size. */
/**
 * The face shown for a seat at the table: a player's own avatar when the
 * server sent one ({ variant, custom }), else a stock face for CPUs.
 * Returns props for PixelAvatar: { variant, customAvatarData }.
 */
export function seatAvatar(player, index = 0) {
  const a = player?.avatar;
  if (a?.variant === "custom" && a.custom) {
    return { variant: "custom", customAvatarData: deserializeAvatar(a.custom) };
  }
  if (a?.variant) return { variant: a.variant, customAvatarData: null };
  return { variant: ((player?.id ?? index) % 5) + 1, customAvatarData: null };
}

export function snapAvatarSize(size, dpr = 1) {
  const cells = Math.max(1, Math.round((size * dpr) / GRID_SIZE));
  const device = cells * GRID_SIZE;
  return { device, css: device / dpr };
}

export function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

export function serializeAvatar(pixels) {
  return { v: 2, pixels: pixels.flat() };
}

export function deserializeAvatar(data) {
  if (!data) return null;

  // v2: flat array of hex strings
  if (data.v === 2 && Array.isArray(data.pixels)) {
    const pixels = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      pixels.push(data.pixels.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE));
    }
    return { pixels };
  }

  // v1 legacy: palette index string
  if (data.pixels && typeof data.pixels === "string") {
    const palette = data.palette || [];
    const flat = data.pixels.split("").map((c) => parseInt(c, 36));
    const pixels = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row = flat.slice(r * GRID_SIZE, (r + 1) * GRID_SIZE);
      pixels.push(row.map((idx) => palette[idx] || null));
    }
    return { pixels };
  }

  return null;
}

/**
 * Draws a 16x16 avatar onto a canvas whose side is a multiple of 16, so every
 * avatar pixel is a whole number of canvas pixels — no seams, no uneven cells.
 */
export function renderAvatarToCanvas(ctx, avatarData, canvasSize) {
  const pixels = avatarData.pixels;
  const cell = Math.max(1, Math.floor(canvasSize / GRID_SIZE));
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const color = pixels[r]?.[c];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }
}

// HSB <-> hex conversion utilities
export function hsbToHex(h, s, b) {
  s /= 100;
  b /= 100;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  const r = Math.round(f(5) * 255);
  const g = Math.round(f(3) * 255);
  const bl = Math.round(f(1) * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

export function hexToHsb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h, s, b: v };
}

const CUSTOM_COLORS_KEY = "cardlore_custom_colors";

export function loadCustomColors() {
  try {
    const raw = localStorage.getItem(CUSTOM_COLORS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveCustomColors(colors) {
  localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors));
}
