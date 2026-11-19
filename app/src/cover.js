// Sunset Cover Studio — the cover engine. Multi-panel layouts, colour grades and
// bold poster lettering, all drawn onto one canvas. Written from scratch.

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  story: { w: 1080, h: 1920, label: 'Story 1080 x 1920' },
};

export const GRADES = {
  sunset: { name: 'Sunset', from: '#ff9a3d', to: '#ff2e88', deep: '#2b1038', sun: '#ffb347', scrim: 'rgba(43,16,56,0.55)' },
  neon: { name: 'Neon', from: '#ff2ec4', to: '#00d5ff', deep: '#12082e', sun: '#ff5ce1', scrim: 'rgba(18,8,46,0.55)' },
  dusk: { name: 'Dusk', from: '#8b3dff', to: '#1b2a6b', deep: '#0e1230', sun: '#c9a7ff', scrim: 'rgba(14,18,48,0.55)' },
  mono: { name: 'Mono', from: '#e8e8e8', to: '#5a5a5a', deep: '#111111', sun: '#f2f2f2', scrim: 'rgba(0,0,0,0.55)' },
};

export const LAYOUTS = {
  hero: { name: 'Hero', slots: 1 },
  split: { name: 'Split', slots: 2 },
  grid: { name: 'Grid', slots: 3 },
  strip: { name: 'Strip', slots: 3 },
};

/** Panel rectangles for a layout inside a w x h canvas. Grid's 4th rect is a title card. */
export function panelRects(layout, w, h) {
  const g = Math.max(6, Math.round(w * 0.008));
  if (layout === 'hero') return [{ x: 0, y: 0, w, h }];
  if (layout === 'split') {
    const lw = Math.round(w * 0.58);
    return [
      { x: 0, y: 0, w: lw, h },
      { x: lw + g, y: 0, w: w - lw - g, h },
    ];
  }
  if (layout === 'grid') {
    const cw = Math.round((w - g) / 2);
    const ch = Math.round((h - g) / 2);
    return [
      { x: 0, y: 0, w: cw, h: ch },
      { x: cw + g, y: 0, w: w - cw - g, h: ch },
      { x: 0, y: ch + g, w: cw, h: h - ch - g },
      { x: cw + g, y: ch + g, w: w - cw - g, h: h - ch - g },
    ];
  }
  const bh = Math.round((h - 2 * g) / 3);
  return [
    { x: 0, y: 0, w, h: bh },
    { x: 0, y: bh + g, w, h: bh },
    { x: 0, y: 2 * (bh + g), w, h: h - 2 * (bh + g) },
  ];
}

/** How many photo panels a layout has (grid's last rect is a title card). */
export function photoSlots(layout) {
  return LAYOUTS[layout].slots;
}

/** A fresh photo slot: the image, zoom (1 = cover-fit) and pan offsets in px. */
export function blankSlot() {
  return { img: null, zoom: 1, ox: 0, oy: 0 };
}

function clampPan(slot, img, rect) {
  if (!img) return;
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const pw = img.naturalWidth * base * slot.zoom;
  const ph = img.naturalHeight * base * slot.zoom;
  const mx = Math.max(0, (pw - rect.w) / 2);
  const my = Math.max(0, (ph - rect.h) / 2);
  slot.ox = Math.max(-mx, Math.min(mx, slot.ox));
  slot.oy = Math.max(-my, Math.min(my, slot.oy));
}

function drawPhoto(ctx, slot, rect, gradeKey) {
  const img = slot.img;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (!img) {
    // Empty panel: a soft grade wash so the layout still reads.
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, GRADES[gradeKey].from);
    g.addColorStop(1, GRADES[gradeKey].deep);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.globalAlpha = 1;
  } else {
    clampPan(slot, img, rect);
    const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
    const scale = base * slot.zoom;
    const pw = img.naturalWidth * scale;
    const ph = img.naturalHeight * scale;
    const dx = rect.x + (rect.w - pw) / 2 + slot.ox;
    // Wide panels crop faces if centred: bias the crop toward the top of the photo.
    const topBias = rect.w > rect.h * 1.5 ? (ph - rect.h) * 0.35 : rect.w > rect.h * 1.2 ? (ph - rect.h) * 0.15 : 0;
    const dy = rect.y + (rect.h - ph) / 2 + slot.oy - topBias;
    if (gradeKey === 'mono') ctx.filter = 'grayscale(1) contrast(1.08)';
    ctx.drawImage(img, dx, dy, pw, ph);
    ctx.filter = 'none';
    // Warm/cool wash over the photo so panels feel like one poster.
    const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    wash.addColorStop(0, 'rgba(255,255,255,0.06)');
    wash.addColorStop(0.55, 'rgba(255,255,255,0)');
    wash.addColorStop(1, GRADES[gradeKey].to + '55');
    ctx.fillStyle = wash;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
  // Thin white frame around every panel: the multi-panel poster look.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, rect.w * 0.003);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
}

/** A striped retro sun disc, drawn with plain canvas shapes. */
function drawSun(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Slats cut across the lower half.
  ctx.globalCompositeOperation = 'destination-out';
  let y = cy + r * 0.05;
  let th = r * 0.06;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, th);
    y += th * 2.2;
    th *= 1.35;
  }
  ctx.restore();
}

function fitFont(ctx, text, maxWidth, startSize, weight = 900) {
  let size = startSize;
  ctx.font = `${weight} ${size}px "Arial Black", Arial, sans-serif`;
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = `${weight} ${size}px "Arial Black", Arial, sans-serif`;
  }
  return size;
}

function drawTitleBlock(ctx, state, w, h, grade) {
  const title = state.title.trim().toUpperCase();
  const sub = state.subtitle.trim();
  const top = state.titlePos === 'top';
  const bandH = Math.round(h * (title ? 0.24 : 0.12));
  const bandY = top ? 0 : h - bandH;
  // Scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, top ? 0 : bandY - bandH * 0.5, 0, top ? bandH * 1.5 : h);
  if (top) {
    scrim.addColorStop(0, grade.scrim);
    scrim.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    scrim.addColorStop(0, 'rgba(0,0,0,0)');
    scrim.addColorStop(1, grade.scrim);
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, top ? 0 : bandY - bandH * 0.5, w, bandH * 1.5);
  // Sun disc in the corner opposite the title, over sky, never on a panel seam.
  if (grade !== GRADES.mono) {
    drawSun(ctx, w * 0.86, top ? h - h * 0.09 : h * 0.09, w * 0.07, grade.sun);
  }
  if (title) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(w * 0.006)}px`;
    const size = fitFont(ctx, title, w * 0.9, Math.round(w * 0.115));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = grade.deep;
    ctx.lineWidth = Math.max(3, size * 0.09);
    ctx.fillStyle = '#ffffff';
    const ty = top ? bandH * 0.42 : h - bandH * 0.58;
    ctx.strokeText(title, w / 2, ty);
    ctx.fillText(title, w / 2, ty);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    if (sub && state.layout !== 'grid') {
      // Grid's title card already carries the subtitle; don't print it twice.
      const ssize = fitFont(ctx, sub.toUpperCase(), w * 0.8, Math.round(w * 0.032), 700);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(sub.toUpperCase(), w / 2, ty + size * 0.62 + ssize * 0.4);
    }
  }
  // Small credit line along the very bottom edge.
  ctx.font = `700 ${Math.round(w * 0.018)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('MADE WITH SUNSET COVER STUDIO', w / 2, h - Math.round(h * 0.012));
}

/** Draws the whole cover for `state` onto `canvas` (resized to the chosen size). */
export function drawCover(canvas, state) {
  const size = SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const { w, h } = size;
  const grade = GRADES[state.grade];
  ctx.fillStyle = grade.deep;
  ctx.fillRect(0, 0, w, h);
  const rects = panelRects(state.layout, w, h);
  const n = photoSlots(state.layout);
  for (let i = 0; i < n; i++) {
    drawPhoto(ctx, state.photos[i] || blankSlot(), rects[i], state.grade);
  }
  if (state.layout === 'grid') {
    // Title card: grade gradient + sun + subtitle.
    const r = rects[3];
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    g.addColorStop(0, grade.from);
    g.addColorStop(1, grade.deep);
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    drawSun(ctx, r.x + r.w / 2, r.y + r.h * 0.36, Math.min(r.w, r.h) * 0.22, grade.sun);
    if (state.subtitle.trim()) {
      ctx.font = `700 ${fitFont(ctx, state.subtitle.trim().toUpperCase(), r.w * 0.85, Math.round(r.w * 0.075))}px "Arial Black", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(state.subtitle.trim().toUpperCase(), r.x + r.w / 2, r.y + r.h * 0.93);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, r.w * 0.003);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  drawTitleBlock(ctx, state, w, h, grade);
}
