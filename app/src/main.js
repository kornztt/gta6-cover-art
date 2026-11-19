// Sunset Cover Studio — wires the page: pick photos into panels, choose a layout,
// grade and size, type the title, drag to crop, export the cover as a PNG.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, panelRects, photoSlots, blankSlot, SIZES, GRADES, LAYOUTS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const status = document.getElementById('status');
const zoomInput = document.getElementById('zoom');
const zoomLabel = document.getElementById('zoom-label');

const state = {
  size: 'square',
  layout: 'split',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'A story in three frames',
  titlePos: 'bottom',
  photos: [blankSlot(), blankSlot(), blankSlot()],
  activeSlot: 0,
};
window.__coverState = state; // test hook for the verification probe

function redraw() {
  drawCover(canvas, state);
  syncControls();
}

function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  document.querySelectorAll('[data-slot]').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.slot) === state.activeSlot);
    b.classList.toggle('filled', !!state.photos[Number(b.dataset.slot)].img);
  });
  document.querySelectorAll('[data-titlepos]').forEach((b) => b.classList.toggle('on', b.dataset.titlepos === state.titlePos));
  const slot = state.photos[state.activeSlot];
  zoomInput.value = String(slot.zoom);
  zoomLabel.textContent = `${Math.round(slot.zoom * 100)}%`;
  document.getElementById('slot-name').textContent = `Panel ${state.activeSlot + 1}`;
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function setPhoto(url, slotIndex) {
  const img = await loadImage(url);
  const slot = state.photos[slotIndex];
  slot.img = img;
  slot.zoom = 1;
  slot.ox = 0;
  slot.oy = 0;
  redraw();
}

// Sample photos.
document.getElementById('sample-pier').addEventListener('click', () => setPhoto('samples/pier.jpg', state.activeSlot));
document.getElementById('sample-boulevard').addEventListener('click', () => setPhoto('samples/boulevard.jpg', state.activeSlot));
// Uploaded photo goes into the active panel.
document.getElementById('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await setPhoto(URL.createObjectURL(file), state.activeSlot);
  e.target.value = '';
});

// Panel picker.
document.querySelectorAll('[data-slot]').forEach((b) => {
  b.addEventListener('click', () => { state.activeSlot = Number(b.dataset.slot); redraw(); });
});

// Layout / grade / size / title position.
document.querySelectorAll('[data-layout]').forEach((b) => {
  b.addEventListener('click', () => { state.layout = b.dataset.layout; redraw(); });
});
document.querySelectorAll('[data-grade]').forEach((b) => {
  b.addEventListener('click', () => { state.grade = b.dataset.grade; redraw(); });
});
document.querySelectorAll('[data-size]').forEach((b) => {
  b.addEventListener('click', () => { state.size = b.dataset.size; redraw(); });
});
document.querySelectorAll('[data-titlepos]').forEach((b) => {
  b.addEventListener('click', () => { state.titlePos = b.dataset.titlepos; redraw(); });
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
zoomInput.addEventListener('input', () => {
  state.photos[state.activeSlot].zoom = Number(zoomInput.value);
  redraw();
});
document.getElementById('recenter').addEventListener('click', () => {
  const slot = state.photos[state.activeSlot];
  slot.zoom = 1;
  slot.ox = 0;
  slot.oy = 0;
  redraw();
});

// Drag on the preview: click picks the panel, drag pans its photo.
let drag = null;
function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left) * (canvas.width / r.width);
  const y = (clientY - r.top) * (canvas.height / r.height);
  const rects = panelRects(state.layout, canvas.width, canvas.height);
  for (let i = 0; i < photoSlots(state.layout); i++) {
    const p = rects[i];
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return { i, x, y };
  }
  return null;
}
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit) return;
  state.activeSlot = hit.i;
  const slot = state.photos[hit.i];
  drag = { cx: e.clientX, cy: e.clientY, ox: slot.ox, oy: slot.oy };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const slot = state.photos[state.activeSlot];
  const r = canvas.getBoundingClientRect();
  const kx = canvas.width / r.width;
  const ky = canvas.height / r.height;
  slot.ox = drag.ox + (e.clientX - drag.cx) * kx;
  slot.oy = drag.oy + (e.clientY - drag.cy) * ky;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// Export the cover at the chosen size.
document.getElementById('export').addEventListener('click', () => {
  const size = SIZES[state.size];
  canvas.toBlob((blob) => {
    if (!blob) { status.textContent = 'Export failed.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cover-${size.w}x${size.h}.png`;
    a.click();
    status.textContent = `Saved cover-${size.w}x${size.h}.png`;
  }, 'image/png');
});

// Fixed scene for a screenshot, or the live editor.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (params.get('layout') && LAYOUTS[params.get('layout')]) state.layout = params.get('layout');
if (params.get('grade') && GRADES[params.get('grade')]) state.grade = params.get('grade');
if (params.get('size') && SIZES[params.get('size')]) state.size = params.get('size');
if (params.get('caption') !== null) { state.title = params.get('caption'); titleInput.value = state.title; }
if (params.get('subtitle') !== null) { state.subtitle = params.get('subtitle'); subtitleInput.value = state.subtitle; }
if (shot) {
  runShot(shot, params, setPhoto, redraw);
} else {
  redraw();
}
