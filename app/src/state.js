// Sunset Cover Studio's state: one cover, three photo panels, a title and a grade.
// The app never sends a photo anywhere; everything happens in this browser tab.

export const LAYOUTS = ['hero', 'split', 'grid', 'strip'];
export const GRADES = ['sunset', 'neon', 'dusk', 'mono'];

export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080×1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080×1350' },
  story: { w: 1080, h: 1920, label: 'Story 1080×1920' },
};

export const SAMPLES = [
  { id: 'pier', label: 'Pier', src: 'samples/pier.jpg' },
  { id: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg' },
];

export function defaultState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    size: 'square',
    title: 'SUNSET HEIST',
    subtitle: 'A STORY IN THREE FRAMES',
    titlePos: 'bottom',
    selected: 0,
    panels: [
      { photo: 'pier', img: null, zoom: 1, ox: 0, oy: 0 },
      { photo: 'boulevard', img: null, zoom: 1, ox: 0, oy: 0 },
      { photo: 'pier', img: null, zoom: 1, ox: 0, oy: 0 },
    ],
  };
}
