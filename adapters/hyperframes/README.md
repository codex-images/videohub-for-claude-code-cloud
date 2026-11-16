# HyperFrames adapter (experimental)

For films built with [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML/CSS/GSAP compositions).

## What this is based on

HyperFrames' documented page contract: the engine reads `window.__hf.duration` and calls `window.__hf.seek(time)` before
each frame; standalone compositions may instead register a GSAP master timeline in `window.__timelines`. VideoHub only
needs `window.renderOut(t)`, so `hyperframes-videohub.js` finds one of those two seek handles and passes it to
`videohub-adapter.js` (copy that file from `../remotion/`).

## Status: experimental

Written from the official docs and not yet verified inside a running VideoHub. Check these first:

1. Which handle your HyperFrames version exposes (`window.__hf`, or `window.__timelines`; open DevTools and type both).
2. Whether `<video>` elements in the composition show the right frame after a seek. HyperFrames normally injects video frames itself during render; in a plain browser preview the clips may need their own `currentTime` sync.
3. Whether `seek` is synchronous. If the picture lags, add a `requestAnimationFrame` wait in `ready`.

## Use

1. Copy `hyperframes-videohub.js`, `../remotion/videohub-adapter.js`, `render.js` and `index.example.html` into `films/<name>/` and merge the script tags into your composition page.
2. Add `.videohub/project.json`, `data.json`, `shots.json`, `preload.json` as described in `../remotion/README.md`.
3. Push to the review repo (see `skill/videohub-cloud/SKILL.md`).

Alternative for final renders: HyperFrames' own renderer (`npx hyperframes render`) is the supported way to make the MP4. VideoHub's preview and notes are for review only.
