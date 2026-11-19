# Sunset Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/kornztt/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/kornztt/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn a photo and a caption into a poster cover in the style of a GTA 6 poster — a multi-panel cover with a big striped sun, a layered sunset sky, bold condensed lettering with an outline and hard shadow, film grain and a vignette — and export it as a PNG to share. Your photos never leave your machine: the whole thing runs offline in a desktop browser from static files.

## What it does

- **Four layouts**: Hero (one photo, full bleed), Split (two photos on a diagonal), Grid (three photos plus a title card), Strip (three stacked bands).
- **Four colour grades**: Sunset, Neon, Dusk and Mono, each with its own sky, sun and photo treatment.
- **Three photos**: upload your own or use the two bundled samples; click a panel to pick it, drag to crop, zoom, recenter.
- **Caption**: a title and a subtitle, top or bottom, with lettering that shrinks to fit.
- **Export**: a real PNG at Square 1080×1080, Portrait 1080×1350 or Story 1080×1920.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built by an AI agent for make.fun's "Make GTA 6 Cover Art" bounty.
