# Remotion adapter

Lets VideoHub preview and render a film built with [Remotion](https://www.remotion.dev) by wrapping `@remotion/player`
in VideoHub's page contract (`window.renderOut(t)` + `window.READY`).

## Files

| File | Purpose |
|---|---|
| `videohub-adapter.js` | generic bridge: turns any seekable player into `window.renderOut(t)`, plays the real audio mix in sync, preloads clips |
| `render.js` | chunked frame-by-frame renderer (2 s chunks, resumable, `ONLY=` and `PREVIEW=`), needs `puppeteer-core`, Chromium and ffmpeg |
| `template/index.html` | the page: loads `bundle.js`, the adapter, and installs it |
| `template/entry.jsx` | mounts `<Player>` from `@remotion/player` and exposes `window.vhPlayer` |

## Build a player bundle from a Remotion project

1. Create the project folder `films/<name>/` and copy: `videohub-adapter.js`, `render.js`, `template/index.html`, `template/entry.jsx`.
2. Put your composition next to `entry.jsx` and set `FPS`, `WIDTH`, `HEIGHT`, `FRAMES` at its top.
3. Bundle it once (the container does not need Node build tools, so commit the result):
   ```
   npm i react react-dom @remotion/player remotion esbuild
   npx esbuild entry.jsx --bundle --outfile=bundle.js --define:process.env.NODE_ENV='"production"' --loader:.js=jsx
   ```
4. Keep the Remotion player **muted** (`initiallyMuted`, and no `<Audio>` inside the composition). The real mix is `audio/mix.mp3`, played by the adapter, which keeps sound synced across seeks. VideoHub itself plays `audio/silent.wav`.
5. Use plain `<video>` / `<OffthreadVideo>` clips from files in the project (relative URLs). `@remotion/player` supports `seekTo(frame)`, `play()`, `pause()` and `getCurrentFrame()`, which is all the adapter needs.

## The small files

- **`preload.json`**: a JSON array of media URLs (relative to the page) that the adapter fetches into memory before setting `READY`, so cuts between clips do not flash black. Example: `["clips/00.mp4","clips/01.mp4"]`.
- **`data.json`**: `{"width":1080,"height":1920}`, the video size; also an optional `"offset"` (seconds) for sync calibration.
- **`.videohub/project.json`**: `{"title":"...","status":"review","live":{"page":"index.html","audio":"audio/silent.wav","dur":169.9,"fps":30,"w":1080,"h":1920},"render":{"script":"render.js","workers":2,"env":{"DUR":"169.9","FPS":"30"},"mux":["-y","-i","{video}","-i","audio/mix.mp3","-map","0:v","-map","1:a","-c:v","copy","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart","{out}"]}}`. If this file does not reach the container, the render falls back to 10 seconds.
- **`shots.json`**: shot boundaries for mapping notes (`[{"id":"s01","start":0,"end":3.2}]`).

## Sync calibration

`?offset=-0.05` (video earlier) and `?aoffset=0.03` (audio later) on the preview URL; store the final `offset` in `data.json`.

## Rendering

`node render.js 2` (two workers) writes `render/chunks/c_000.mp4 ...`, concatenates them, and muxes the audio. Re-run after a stop: finished chunks are kept. In VideoHub use the render queue instead (it passes `VIDEOHUB_JOB`).
