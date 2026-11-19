// Sunset Cover Studio's poster renderer: sky, striped sun, photo panels, colour
// grade, big condensed lettering, film grain and vignette. Everything is drawn in
// code on a 2D canvas; the result has to read as a poster at thumbnail size, not
// as a photo collage with text pasted on top.

export const SIZES = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

const PALETTES = {
  sunset: {
    sky: ['#160a2e', '#5b1a5e', '#c62b5e', '#ff7a3c', '#ffc46b'],
    sunTop: '#ffe9a3', sunBottom: '#ff5e3a', glow: 'rgba(255,150,60,0.55)',
    accent: '#ffb13c', ink: '#160a2e', scrim: 'rgba(10,4,24,0.88)',
    wash: 'rgba(255,122,60,0.10)',
    filter: 'saturate(1.28) contrast(1.08) sepia(0.16)',
  },
  neon: {
    sky: ['#0a0018', '#3d0a5e', '#a4138f', '#ff2ea6', '#00e5ff'],
    sunTop: '#ffe3f6', sunBottom: '#ff2ea6', glow: 'rgba(255,46,166,0.5)',
    accent: '#00e5ff', ink: '#0a0018', scrim: 'rgba(8,0,20,0.88)',
    wash: 'rgba(255,46,166,0.12)',
    filter: 'saturate(1.7) contrast(1.16) hue-rotate(-12deg)',
  },
  dusk: {
    sky: ['#0d1530', '#2c2a5e', '#6b4a8a', '#c96a5e', '#e8a06a'],
    sunTop: '#e9e4ff', sunBottom: '#b08cff', glow: 'rgba(150,130,255,0.45)',
    accent: '#c9a7ff', ink: '#0d1530', scrim: 'rgba(8,10,28,0.88)',
    wash: 'rgba(96,70,180,0.14)',
    filter: 'saturate(0.92) contrast(1.06) brightness(0.93) hue-rotate(12deg)',
  },
  mono: {
    sky: ['#0a0a0a', '#2e2e2e', '#5a5a5a', '#9a9a9a', '#e8e8e8'],
    sunTop: '#ffffff', sunBottom: '#bdbdbd', glow: 'rgba(255,255,255,0.35)',
    accent: '#ffffff', ink: '#0a0a0a', scrim: 'rgba(0,0,0,0.88)',
    wash: 'rgba(0,0,0,0)',
    filter: 'grayscale(1) contrast(1.18)',
  },
};

const paletteOf = (grade) => PALETTES[grade] ?? PALETTES.sunset;

const fontFor = (size) => `900 ${size}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;

// ---------------------------------------------------------------- sky and sun

function drawSky(ctx, W, H, pal) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  pal.sky.forEach((c, i) => g.addColorStop(i / (pal.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// A striped retro sun on its own canvas, so the stripes can be punched out
// with destination-out without erasing the photos underneath.
function sunCanvas(pal, r) {
  const pad = Math.ceil(r * 2.6);
  const c = document.createElement('canvas');
  c.width = c.height = pad * 2;
  const x = c.getContext('2d');
  const cx = pad;
  const cy = pad;
  const halo = x.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.4);
  halo.addColorStop(0, pal.glow);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = halo;
  x.fillRect(0, 0, c.width, c.height);
  x.save();
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.clip();
  const g = x.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, pal.sunTop);
  g.addColorStop(1, pal.sunBottom);
  x.fillStyle = g;
  x.fillRect(cx - r, cy - r, r * 2, r * 2);
  x.globalCompositeOperation = 'destination-out';
  let y = cy + r * 0.02;
  let gap = r * 0.05;
  while (y < cy + r) {
    x.fillRect(cx - r, y, r * 2, gap);
    y += gap + r * 0.13;
    gap *= 1.45;
  }
  x.restore();
  return c;
}

function sunSpot(layout, W, H) {
  // High in the frame, over sky rather than faces: a face sits near the
  // middle of a photo, the sky sits at its top.
  switch (layout) {
    case 'split': return { x: 0.5 * W, y: 0.14 * H, r: 0.11 * W };
    case 'grid': return { x: 0.75 * W, y: 0.6 * H, r: 0.085 * W };
    case 'strip': return { x: 0.82 * W, y: 0.13 * H, r: 0.1 * W };
    default: return { x: 0.76 * W, y: 0.17 * H, r: 0.12 * W };
  }
}

// ---------------------------------------------------------------- layout geometry

function layoutPanels(layout, W, H) {
  const g = Math.max(2, Math.round(W * 0.006));
  switch (layout) {
    case 'split':
      return [
        { kind: 'photo', index: 0, poly: [[0, 0], [0.6 * W, 0], [0.4 * W, H], [0, H]] },
        { kind: 'photo', index: 1, poly: [[0.6 * W, 0], [W, 0], [W, H], [0.4 * W, H]] },
      ];
    case 'grid': {
      const cw = (W - g) / 2;
      const ch = (H - g) / 2;
      return [
        { kind: 'photo', index: 0, rect: { x: 0, y: 0, w: cw, h: ch } },
        { kind: 'photo', index: 1, rect: { x: cw + g, y: 0, w: cw, h: ch } },
        { kind: 'photo', index: 2, rect: { x: 0, y: ch + g, w: cw, h: ch } },
        { kind: 'card', rect: { x: cw + g, y: ch + g, w: cw, h: ch } },
      ];
    }
    case 'strip': {
      const b1 = 0.32 * H;
      const b2 = 0.66 * H;
      return [
        { kind: 'photo', index: 0, rect: { x: 0, y: 0, w: W, h: b1 - g / 2 } },
        { kind: 'photo', index: 1, rect: { x: 0, y: b1 + g / 2, w: W, h: b2 - b1 - g } },
        { kind: 'photo', index: 2, rect: { x: 0, y: b2 + g / 2, w: W, h: H - b2 - g / 2 } },
      ];
    }
    default:
      return [{ kind: 'photo', index: 0, rect: { x: 0, y: 0, w: W, h: H } }];
  }
}

function itemBox(item, W, H) {
  if (item.rect) return item.rect;
  const xs = item.poly.map((p) => p[0]);
  const ys = item.poly.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}

function clipItem(ctx, item) {
  ctx.beginPath();
  if (item.rect) {
    ctx.rect(item.rect.x, item.rect.y, item.rect.w, item.rect.h);
  } else {
    ctx.moveTo(item.poly[0][0], item.poly[0][1]);
    for (let i = 1; i < item.poly.length; i++) ctx.lineTo(item.poly[i][0], item.poly[i][1]);
    ctx.closePath();
  }
  ctx.clip();
}

// The panel under a point (canvas pixels), or -1 for the title card / nothing.
export function panelAt(state, px, py, W, H) {
  const items = layoutPanels(state.layout, W, H);
  for (const item of items) {
    if (item.kind !== 'photo') continue;
    if (item.rect) {
      if (px >= item.rect.x && px < item.rect.x + item.rect.w && py >= item.rect.y && py < item.rect.y + item.rect.h) return item.index;
    } else {
      // Diagonal split: the divider runs from (0.60W, 0) to (0.40W, H).
      const lineX = 0.6 * W - 0.2 * W * (py / H);
      return px < lineX ? 0 : 1;
    }
  }
  return -1;
}

export function panelRect(state, index, W, H) {
  const item = layoutPanels(state.layout, W, H).find((it) => it.kind === 'photo' && it.index === index);
  return item ? itemBox(item, W, H) : null;
}

// Drag a panel: dxPx/dyPx in canvas pixels become pan offsets in [-1, 1].
export function shiftPanel(state, index, dxPx, dyPx, W, H) {
  const panel = state.panels[index];
  const rect = panelRect(state, index, W, H);
  if (!panel || !rect || !panel.img) return;
  const iw = panel.img.naturalWidth;
  const ih = panel.img.naturalHeight;
  const s = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
  const dw = iw * s;
  const dh = ih * s;
  const sx = Math.max(0, (dw - rect.w) / 2);
  const sy = Math.max(0, (dh - rect.h) / 2);
  panel.ox = Math.max(-1, Math.min(1, (panel.ox || 0) + (sx > 0 ? dxPx / sx : 0)));
  panel.oy = Math.max(-1, Math.min(1, (panel.oy || 0) + (sy > 0 ? dyPx / sy : 0)));
}

// ---------------------------------------------------------------- photos

function drawPhoto(ctx, img, rect, panel, pal, bias = 0) {
  ctx.save();
  ctx.filter = pal.filter;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const s = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
  const dw = iw * s;
  const dh = ih * s;
  // A wide panel crops a square photo top and bottom: bias the crop toward
  // the top while the user has not panned it, so faces stay in frame.
  // (Positive oy moves the photo down, showing its top.)
  const oyEff = (panel.oy === 0 && dh > rect.h && rect.w / rect.h > 1.4) ? bias : (panel.oy || 0);
  const dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0) * Math.max(0, (dw - rect.w) / 2);
  const dy = rect.y + (rect.h - dh) / 2 + oyEff * Math.max(0, (dh - rect.h) / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  // A wash of the grade's tint, so the colour grade reads even on a bright
  // daylight photo and the panels feel like one poster.
  ctx.fillStyle = pal.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawEmpty(ctx, rect, pal) {
  ctx.fillStyle = '#14141c';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 20);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `700 ${Math.max(14, rect.w * 0.03)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- lettering

// Fit a title into maxW in at most two lines, shrinking from startSize.
function fitTitle(ctx, text, startSize, maxW) {
  const limit = maxW / 0.88; // the condensed scale narrows the drawn text
  let size = startSize;
  while (size > startSize * 0.35) {
    ctx.font = fontFor(size);
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width <= limit || !cur) cur = t;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= limit)) return { size, lines };
    size *= 0.92;
  }
  ctx.font = fontFor(size);
  return { size, lines: [text] };
}

function drawTitleLine(ctx, line, x, baselineY, size, pal) {
  ctx.save();
  ctx.translate(x, baselineY);
  ctx.scale(0.88, 1); // condensed poster lettering from a system font
  ctx.font = fontFor(size);
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; // hard shadow, no blur
  ctx.fillText(line, size * 0.05, size * 0.06);
  ctx.strokeStyle = pal.ink; // thick outline
  ctx.lineWidth = size * 0.09;
  ctx.strokeText(line, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(line, 0, 0);
  ctx.restore();
}

function drawTitleBlock(ctx, state, W, H, pal) {
  const bottom = state.titlePos === 'bottom';
  const sh = H * (state.layout === 'grid' ? 0.26 : state.layout === 'strip' ? 0.3 : 0.42);
  const g = ctx.createLinearGradient(0, bottom ? H - sh : 0, 0, bottom ? H : sh);
  if (bottom) {
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, pal.scrim);
  } else {
    g.addColorStop(0, pal.scrim);
    g.addColorStop(1, 'rgba(0,0,0,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, bottom ? H - sh : 0, W, sh);

  const x = W * 0.04;
  const maxW = W * 0.92;
  const { size, lines } = fitTitle(ctx, (state.title || 'UNTITLED').toUpperCase(), W * 0.105, maxW);
  const lineH = size * 1.04;
  const subSize = Math.max(14, size * 0.22);
  const subGap = size * 0.22;
  const blockH = subSize + subGap + lines.length * lineH;
  const topY = bottom ? H * 0.965 - blockH : H * 0.05;

  // Accent bar above the kicker.
  ctx.fillStyle = pal.accent;
  ctx.fillRect(x, topY - size * 0.16, W * 0.1, Math.max(3, size * 0.055));

  // Kicker: the subtitle, small caps, wide tracking.
  ctx.save();
  ctx.font = `700 ${subSize}px "Helvetica Neue", Arial, sans-serif`;
  if ('letterSpacing' in ctx) {
    try {
      ctx.letterSpacing = `${Math.round(subSize * 0.32)}px`;
    } catch (e) { /* older canvas: no tracking */ }
  }
  ctx.fillStyle = pal.accent;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText((state.subtitle || '').toUpperCase(), x, topY + subSize);
  ctx.restore();

  // The title itself, one or two huge lines.
  let baseline = topY + subSize + subGap + size;
  for (const line of lines) {
    drawTitleLine(ctx, line, x, baseline, size, pal);
    baseline += lineH;
  }
}

// ---------------------------------------------------------------- grain and vignette

let noiseCanvas = null;
function grain(ctx, W, H) {
  if (!noiseCanvas) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 140;
    noiseCanvas.height = 140;
    const n = noiseCanvas.getContext('2d');
    const d = n.createImageData(140, 140);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d.data[i] = v;
      d.data[i + 1] = v;
      d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    n.putImageData(d, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.fillStyle = ctx.createPattern(noiseCanvas, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function vignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- the render

export function renderCover(canvas, state) {
  const size = SIZES[state.size] ?? SIZES.square;
  const W = size.w;
  const H = size.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pal = paletteOf(state.grade);

  drawSky(ctx, W, H, pal);

  const items = layoutPanels(state.layout, W, H);
  for (const item of items) {
    if (item.kind === 'card') {
      ctx.fillStyle = pal.ink;
      ctx.fillRect(item.rect.x, item.rect.y, item.rect.w, item.rect.h);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = Math.max(2, W * 0.004);
      ctx.strokeRect(item.rect.x + 10, item.rect.y + 10, item.rect.w - 20, item.rect.h - 20);
      continue;
    }
    const panel = state.panels[item.index];
    ctx.save();
    clipItem(ctx, item);
    // In a strip, the top bands show the photo's top (faces); the bottom
    // band sits under the title, so it keeps a centred crop.
    const bias = state.layout === 'strip' && item.index < 2 ? 0.55 : 0;
    if (panel.img) drawPhoto(ctx, panel.img, itemBox(item, W, H), panel, pal, bias);
    else drawEmpty(ctx, itemBox(item, W, H), pal);
    ctx.restore();
  }

  // The sun sits on top of the panels, so it reads in every layout.
  const spot = sunSpot(state.layout, W, H);
  const sun = sunCanvas(pal, spot.r);
  ctx.drawImage(sun, spot.x - sun.width / 2, spot.y - sun.height / 2);

  // The split's diagonal divider.
  if (state.layout === 'split') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(0.6 * W, 0);
    ctx.lineTo(0.4 * W, H);
    ctx.stroke();
  }

  // The grid's title card carries the subtitle under the sun, shrunk to fit
  // inside the card instead of spilling past its edge.
  if (state.layout === 'grid') {
    const card = items.find((it) => it.kind === 'card');
    if (card) {
      const text = (state.subtitle || '').toUpperCase();
      const maxW = card.rect.w * 0.88;
      let cs = Math.max(13, W * 0.026);
      ctx.save();
      while (cs > 12) {
        ctx.font = `700 ${cs}px "Helvetica Neue", Arial, sans-serif`;
        const w = ctx.measureText(text).width + (text.length - 1) * Math.round(cs * 0.3);
        if (w <= maxW) break;
        cs *= 0.9;
      }
      ctx.font = `700 ${cs}px "Helvetica Neue", Arial, sans-serif`;
      if ('letterSpacing' in ctx) {
        try {
          ctx.letterSpacing = `${Math.round(cs * 0.3)}px`;
        } catch (e) { /* older canvas */ }
      }
      ctx.fillStyle = pal.accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Just under the sun, clear of the big title that runs across the bottom.
      ctx.fillText(text, card.rect.x + card.rect.w / 2, card.rect.y + card.rect.h * 0.4);
      ctx.restore();
    }
  }

  drawTitleBlock(ctx, state, W, H, pal);

  // A thin poster keyline, then grain and vignette.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  grain(ctx, W, H);
  vignette(ctx, W, H);
}

export function exportPng(state, sizeName) {
  const size = SIZES[sizeName] ?? SIZES.square;
  const c = document.createElement('canvas');
  renderCover(c, { ...state, size: sizeName });
  return new Promise((resolve) => {
    c.toBlob((blob) => resolve({ blob, w: size.w, h: size.h }), 'image/png');
  });
}
