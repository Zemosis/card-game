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

export function renderAvatarToCanvas(ctx, avatarData, canvasSize) {
  const pixels = avatarData.pixels;
  const cellSize = canvasSize / GRID_SIZE;
  ctx.clearRect(0, 0, canvasSize, canvasSize);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const color = pixels[r]?.[c];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
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
