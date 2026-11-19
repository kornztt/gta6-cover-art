// Screenshot mode: ?shot=cover|editor plus ?photo=, ?caption=, ?subtitle=,
// ?layout=, ?grade=, ?size= and ?pos= set the cover up for a render, so a
// screenshot is always a genuine render of the app itself.
import { defaultState } from './state.js';

export function shotStateFromQuery() {
  const q = new URLSearchParams(location.search);
  if (!q.has('shot')) return null;
  const st = defaultState();
  const photo = q.get('photo');
  if (photo) st.panels.forEach((p) => {
    p.photo = photo;
    p.img = null;
  });
  for (let i = 0; i < 3; i++) {
    const one = q.get(`photo${i + 1}`);
    if (one) {
      st.panels[i].photo = one;
      st.panels[i].img = null;
    }
  }
  if (q.get('caption')) st.title = q.get('caption');
  if (q.get('subtitle')) st.subtitle = q.get('subtitle');
  if (q.get('layout')) st.layout = q.get('layout');
  if (q.get('grade')) st.grade = q.get('grade');
  if (q.get('size')) st.size = q.get('size');
  if (q.get('pos')) st.titlePos = q.get('pos');
  return { shot: q.get('shot'), state: st };
}
