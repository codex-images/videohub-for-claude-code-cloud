---
name: videohub-cloud
description: How a Claude Code session in the cloud (no local VideoHub, no browser on the user's screen) builds a code-made video (Remotion, HyperFrames or plain JS) for live review, pushes it to a git review repo, and later reads the user's review notes from git. Use when the user wants to review a video you are building and VideoHub runs on their own PC or server, when they say "review repo", "send me the notes", "check the notes", or when a project must follow VideoHub's contract (window.renderOut, .videohub/project.json) without VideoHub installed in this session.
---

# VideoHub for cloud sessions

You run in the cloud. VideoHub runs on the user's PC or server (Docker), synced through a git **review repo**:

```
you -> films/<name>/ (git push) -> VideoHub container pulls it -> user watches + writes notes
you <- notes/<name>/notes.json (git pull) <- container pushes the notes back
```

The original `videohub` skill (MCP tools `hub_*`) does not apply here: you have no hub. You write files and use git.

## 1. Prepare the project

A project is a folder with:

| File | Purpose |
|---|---|
| `index.html` | the page. Defines `window.renderOut(t)` (draw second `t`, return a promise or be synchronous) and sets `window.READY = true` when loaded. Must be a pure function of `t`. |
| `.videohub/project.json` | `{"title":"...","status":"review","live":{"page":"index.html","audio":"audio/silent.wav","dur":<seconds>,"fps":30,"w":1080,"h":1920},"render":{"script":"render.js","workers":2,"env":{"DUR":"<seconds>","FPS":"30"},"mux":[...]}}`. Without it, the preview assumes 60 s. |
| `data.json` | `{"width":1080,"height":1920}` so the player gets the right size |
| `shots.json` | `[{"id":"s01","start":0,"end":3.2}, ...]` shot boundaries in seconds (see section 4) |
| `preload.json` | JSON list of the media files to preload, so cuts do not flash black |
| `audio/` | the real mix (`mix.mp3`), plus a silent `silent.wav` that VideoHub plays (the page plays the real mix itself) |
| `render.js` | the chunked renderer (copy from `adapters/<kind>/`) |

Pick the starting point:
- Remotion: `adapters/remotion/` (see its README).
- HyperFrames: `adapters/hyperframes/` (experimental).
- Neither: `adapters/plain/README.md` and `templates/new-film`.

Check locally before pushing if you can: open the page in headless Chromium, call `await window.renderOut(5)` and take a screenshot; compare two times to prove the frame changes.

## 2. Push to the review repo

- Put everything under `films/<name>/` in the review repo (name: lowercase, digits, `_`). The container copies it to its films folder every ~60 s.
- **Never write to `notes/`.** That folder belongs to the container, which pushes the user's notes there. Writing into it causes merge conflicts and can overwrite their notes.
- **Every file must be under 100 MB** (GitHub rejects larger). Re-encode clips (H.264, CRF 23, 1080 wide is plenty for review) or keep long media out of git and reference smaller proxies.
- Commit only what changed; do not force-push. `git pull --rebase` before you push (the container also pushes).
- Tell the user the film name and that it appears in VideoHub within about a minute (Projects page, then the live preview).

## 3. Wait, then read the notes

When the user says they sent notes (or asks you to check), `git pull --rebase` and read `notes/<name>/notes.json`. Each note:

| Field | Meaning |
|---|---|
| `id` | note id (keep it when you answer) |
| `t`, `t2` | time in seconds (`t2` only for a range) |
| `frame`, `frames` | frame number (range: `[start, end]`) |
| `text` | what the user wants changed |
| `region` | the rectangle they marked on the frame, if any |
| `drawing` / `images` | pictures: the frame, the frame with their drawing, a close-up. The files are in `notes/<name>/notes/` (match by file name; the stored absolute paths point inside the container). Look at them. |
| `status` | `open`, `claude`, `fixed`, `approved`, `reopened` |

**Known limitation:** for projects built from DOM and `<video>` tags (such as the Remotion adapter), VideoHub only captures canvases, so the note pictures (`nNNN_frame.jpg` and the close-up) come out **black**. The marks themselves (`region`, `drawing`) and the fields `t` and `frame` are stored correctly. Recommended workaround, on your side: render a single frame at time `t` (`npx remotion still <composition> --frame=N`, or open the page in headless Chromium, `await window.renderOut(t)`, screenshot) and draw the `region` and `drawing` from `notes.json` on top of it before you look at it.

Timing: a note reaches the cloud session in under a minute (the sync cycle is 60 seconds).

Work only on notes with status `open` or `reopened`.

## 4. Map a note to a shot, fix, mark

1. Read `shots.json` and find the shot where `start <= t < end` (a range may touch several shots). That is the code and the clip to change.
2. Fix it in the project files. The preview reloads itself when the files sync.
3. Mark it: you cannot write `notes/`, so list what you fixed in your reply (note id + one sentence) and put the same in a `films/<name>/REVIEW_LOG.md` entry. The user sets the status in VideoHub.
4. Push, then say what changed per note id.

## 5. Render only after approval

Do not render a final file until the user explicitly approves the preview. The user starts renders in VideoHub (protected queue, one at a time). If they ask you to prepare the render, check `render.js`, `DUR`, `FPS` and `render.mux` in `.videohub/project.json` first.

## 6. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Video clips stay on the first frame in the preview | The server must answer HTTP Range (206). This fork does; an old VideoHub image does not. Rebuild the image. |
| Chromium crashes in the container ("running as root without --no-sandbox") | The image sets `--no-sandbox` through `/etc/chromium.d`. If you run your own image, add it. |
| `start.sh: not found` or `\r` errors | CRLF line endings from a Windows checkout. Keep `.gitattributes` with `eol=lf`; rebuild. |
| Tunnel will not connect, "token is not valid" | The tunnel token was cut when pasted. Paste the whole value on one line. |
| Tunnel connects, then drops or never registers | QUIC (UDP 7844) is blocked. Run cloudflared with `--protocol http2`. |
| A render finishes after about 10 seconds with a short video | `.videohub/project.json` did not sync (so `DUR` fell back to 10). Push it from `films/<name>/.videohub/project.json` and check the sync. |
| Audio drifts from the picture | The page plays its own audio; calibrate with `?aoffset=0.03` (audio later) or `?offset=-0.05` (video earlier) in the preview URL, then store `"offset"` in `data.json`. Check that the player is muted and the VideoHub audio is the silent file. |
| Notes never arrive | The container needs `GIT_TOKEN` with write access to the review repo; check its logs. |
