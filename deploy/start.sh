#!/bin/sh
# Container entry point: folders, VideoHub config, optional two-way git sync, VideoHub, then the password gateway.
set -e
W=/data; mkdir -p $W/films $W/outputs $W/sounds $W/archive
[ -d $W/films/hello-film ] || cp -r /app/examples/hello-film $W/films/
mkdir -p /app/data
# config.json: allowed host names and the public link come from VH_ALLOWED_HOSTS (comma separated) and VH_PUBLIC_URL
W=$W node --input-type=commonjs -e '
const e = process.env, W = e.W;
const cfg = { port: 7788, baseDir: W, outputsDir: W + "/outputs", soundLibDir: W + "/sounds", archiveDir: W + "/archive",
  roots: [{ path: W + "/films", type: "container", enabled: true }], render: { encoder: "x264" },
  allowedHosts: (e.VH_ALLOWED_HOSTS || "").split(",").map(s => s.trim()).filter(Boolean) };
if (e.VH_PUBLIC_URL) cfg.publicUrl = e.VH_PUBLIC_URL;
require("fs").writeFileSync("/app/data/config.json", JSON.stringify(cfg, null, 2));
'
# Two-way sync with the review repo (optional):
#   from the cloud: FILMS_SUBDIR (default films) -> /data/films
#   to the cloud:   each film's .videohub notes -> notes/<film>/ in the repo, commit and push
# Variables: FILMS_REPO=https://github.com/owner/repo.git FILMS_BRANCH=main GIT_TOKEN=... SYNC_EVERY=60
if [ -n "$FILMS_REPO" ]; then
  B="${FILMS_BRANCH:-main}"; SUB="${FILMS_SUBDIR:-films}"
  URL="$(echo "$FILMS_REPO" | sed "s#https://#https://x-access-token:${GIT_TOKEN}@#")"
  (while true; do
    if [ ! -d $W/src/.git ]; then
      git clone -q --depth 1 --branch "$B" "$URL" $W/src 2>/dev/null || git clone -q --depth 1 "$URL" $W/src 2>/dev/null || true
      git -C $W/src config user.name "videohub-review"; git -C $W/src config user.email "videohub@localhost"
    fi
    if [ -d $W/src/.git ]; then
      git -C $W/src pull -q --rebase origin "$B" 2>/dev/null || true
      if [ -d "$W/src/$SUB" ]; then
        for d in "$W/src/$SUB"/*/; do
          [ -d "$d" ] || continue; n=$(basename "$d"); mkdir -p "$W/films/$n"
          # everything except .videohub (that is where the local notes live), but do take the film's settings:
          # .videohub/project.json from the cloud
          (cd "$d" && { find . -path ./.videohub -prune -o -type f -print; [ -f .videohub/project.json ] && echo ./.videohub/project.json; } | while read f; do
            mkdir -p "$W/films/$n/$(dirname "$f")"; cmp -s "$f" "$W/films/$n/$f" || cp "$f" "$W/films/$n/$f"; done)
        done
      fi
      for d in "$W/films"/*/.videohub; do
        [ -d "$d" ] || continue; n=$(basename "$(dirname "$d")"); mkdir -p "$W/src/notes/$n"
        cp -r "$d/." "$W/src/notes/$n/"
      done
      if [ -n "$(git -C $W/src status --porcelain notes 2>/dev/null)" ]; then
        git -C $W/src add notes && git -C $W/src commit -q -m "notes $(date -u +%FT%TZ)" && git -C $W/src push -q origin "HEAD:$B" 2>/dev/null || true
      fi
    fi
    sleep "${SYNC_EVERY:-60}"
  done) &
fi
cd /app
VIDEOHUB_BROWSER=/usr/bin/chromium VIDEOHUB_ALWAYS_ON=1 node server/hub.js &
for i in $(seq 1 60); do curl -sf -o /dev/null http://127.0.0.1:7788/ && break; sleep 1; done
exec node /opt/gateway.mjs
