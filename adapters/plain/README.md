# Plain code videos (no Remotion, no HyperFrames)

VideoHub's own contract already supports a video written as ordinary JavaScript. A cloud session only has to follow it:

1. Copy `templates/new-film/` to `films/<name>/` in the review repo.
2. Build the film in `film.js`. Keep the three names: `window.renderOut(t)` (draw second `t`, a pure function of `t`), `window.READY`, and optionally `window.VH_SCENES` (the shot lane on the timeline).
3. Write `.videohub/project.json` with the length and fps (`live.dur`, `live.fps`, `render.env.DUR`).
4. Add `shots.json` so notes can be mapped to shots.
5. Push to the review repo (see `skill/videohub-cloud/SKILL.md`).

The contract in full: `docs/PROJECT-CONTRACT.md`. Starter: `templates/new-film/README.md`.
Use the adapters in `../remotion` or `../hyperframes` only when the film is built with those frameworks.
