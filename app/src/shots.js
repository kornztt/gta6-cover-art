// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos;
// ?shot=cover shows the cover alone. `photo` picks the first sample (samples/<photo>.jpg),
// the other sample fills the second panel, and `caption`/`subtitle` the words.
// window.__shotReady is set once painted.
export async function runShot(shot, query, setPhoto, redraw) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photo = query.get('photo') ?? 'pier';
  const other = photo === 'pier' ? 'boulevard' : 'pier';
  await setPhoto(`samples/${photo}.jpg`, 0);
  await setPhoto(`samples/${other}.jpg`, 1);
  await setPhoto(`samples/${photo}.jpg`, 2);
  redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
