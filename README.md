# Humberto Ferrante · Game Developer

Portfolio site: **https://brugo.github.io/**

Five projects, shown with the motion they were built for:

| Project | What it is | Built with |
| --- | --- | --- |
| **A Era dos Heróis** (alpha) | Co-operative browser card game for up to four players. Co-created with Neto. [Play it](https://a-era-dos-herois.pages.dev/) | JavaScript, WebRTC (peer-to-peer) |
| **Bistrô dos Pequenos** (v0.9.0) | Kids' restaurant-and-farm game for Android and Windows | Godot 4.7.2, GDScript |
| **Mimo Garden** (v0.8.0, in development) | 3D creature game for Android tablets | Unity 6, URP |
| **Dumpling Squish** (in development) | Squishy 3D character study for a mobile game | Blender, Three.js |
| **Despertaverso** (2024) | Virtual-reality world for a non-profit | Team of five, which I led |

## How it's made

A single static page with no build step:

- **GSAP + ScrollTrigger** for the scroll scenes: a 3D fly-through of the work, a rotating ring of hero cards, a video that opens to full screen, a horizontal gallery and a frame-by-frame storyboard.
- **Lenis** for smooth scrolling.
- **Three.js** for the hero: the real dumpling model from the character study, with spring-based squash and stretch. Press and hold it.
- Media is converted to WebP and short silent MP4 loops by `tools/build_media.py`, and loaded only when it gets close to the screen. `tools/optimize_glb.py` brings the 3D model from 2.5 MB to 0.75 MB.
- Respects `prefers-reduced-motion`, with a visible switch to turn motion on or off.

## About AI

I build with AI coding tools (Codex, Claude, Cursor and Gemini). I write the design and the specifications, direct the build and test every release. Where art in a project is AI-generated, the site says so next to that project. This site was built the same way.

## Run locally

```bash
python -m http.server 8130
```

Then open http://localhost:8130.

## Rights

The code of this site may be read for reference. Game names, art, screenshots and videos belong to their authors and are not licensed for reuse. *A Era dos Heróis* is an original work by Brugo and Neto.

Third-party libraries in `js/vendor/`: GSAP (GreenSock standard license), Lenis (MIT) and Three.js (MIT).
