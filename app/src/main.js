// Sunset Cover Studio's editor: wires the controls to the state, renders the
// preview on every change, and exports real PNGs. Photos never leave the tab.
import { defaultState, LAYOUTS, GRADES, SIZES, SAMPLES } from './state.js';
import { renderCover, exportPng, panelAt, panelRect, shiftPanel } from './cover.js';
import { shotStateFromQuery } from './shots.js';

const shot = shotStateFromQuery();
const state = shot ? shot.state : defaultState();
const canvas = document.getElementById('preview');
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

window.__cover = {
  state,
  render,
  exportPng: (size) => exportPng(state, size),
  ready: false,
  SIZES,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`cannot load ${src}`));
    im.src = src;
  });
}

async function ensurePhotos() {
  for (const p of state.panels) {
    if (p.img) continue;
    try {
      p.img = await loadImage(`samples/${p.photo}.jpg`);
    } catch (e) {
      // A panel with no photo draws its empty placeholder instead.
    }
  }
}

let renderQueued = false;
async function render() {
  if (renderQueued) return;
  renderQueued = true;
  await ensurePhotos();
  renderCover(canvas, state);
  renderQueued = false;
  window.__cover.ready = true;
  syncUI();
}

function syncUI() {
  $$('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  $$('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  $$('[data-size]').forEach((b) => b.classList.toggle('on', b.dataset.size === state.size));
  $$('[data-pos]').forEach((b) => b.classList.toggle('on', b.dataset.pos === state.titlePos));
  $$('.slot').forEach((b, i) => {
    b.classList.toggle('on', i === state.selected);
    b.querySelector('.slot-photo').textContent = state.panels[i].photo;
  });
  const zoom = $('#zoom');
  if (zoom) zoom.value = String(state.panels[state.selected].zoom || 1);
  const title = $('#title');
  if (title && document.activeElement !== title) title.value = state.title;
  const subtitle = $('#subtitle');
  if (subtitle && document.activeElement !== subtitle) subtitle.value = state.subtitle;
}

function bindSeg(attr, apply) {
  $$(`[data-${attr}]`).forEach((b) => {
    b.addEventListener('click', () => {
      apply(b.dataset[attr]);
      render();
    });
  });
}

bindSeg('layout', (v) => {
  if (LAYOUTS.includes(v)) state.layout = v;
});
bindSeg('grade', (v) => {
  if (GRADES.includes(v)) state.grade = v;
});
bindSeg('size', (v) => {
  if (SIZES[v]) state.size = v;
});
bindSeg('pos', (v) => {
  state.titlePos = v === 'top' ? 'top' : 'bottom';
});

$$('.slot').forEach((b, i) => {
  b.addEventListener('click', () => {
    state.selected = i;
    render();
  });
});

$$('[data-sample]').forEach((b) => {
  b.addEventListener('click', async () => {
    const panel = state.panels[state.selected];
    panel.photo = b.dataset.sample;
    panel.img = null;
    panel.ox = 0;
    panel.oy = 0;
    panel.zoom = 1;
    await render();
  });
});

$('#upload').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const panel = state.panels[state.selected];
    panel.photo = file.name;
    panel.img = img;
    panel.ox = 0;
    panel.oy = 0;
    panel.zoom = 1;
    await render();
  } finally {
    URL.revokeObjectURL(url);
  }
  e.target.value = '';
});

$('#zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  render();
});

$('#recenter').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  panel.ox = 0;
  panel.oy = 0;
  panel.zoom = 1;
  render();
});

let typeTimer = 0;
function bindText(id, key) {
  $(id).addEventListener('input', (e) => {
    state[key] = e.target.value;
    clearTimeout(typeTimer);
    typeTimer = setTimeout(render, 150);
  });
}
bindText('#title', 'title');
bindText('#subtitle', 'subtitle');

$('#export').addEventListener('click', async () => {
  const btn = $('#export');
  btn.disabled = true;
  btn.textContent = 'Exporting…';
  try {
    const { blob } = await exportPng(state, state.size);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cover-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export PNG';
  }
});

// Drag the preview to pan the photo inside the selected panel.
let drag = null;
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const idx = panelAt(state, p.x, p.y, canvas.width, canvas.height);
  if (idx < 0) return;
  state.selected = idx;
  drag = { x: p.x, y: p.y };
  canvas.setPointerCapture(e.pointerId);
  syncUI();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  shiftPanel(state, state.selected, p.x - drag.x, p.y - drag.y, canvas.width, canvas.height);
  drag = { x: p.x, y: p.y };
  render();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});
canvas.addEventListener('pointercancel', () => {
  drag = null;
});

if (shot && shot.shot === 'cover') document.body.classList.add('shot-cover');
render();
