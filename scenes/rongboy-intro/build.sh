#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO=$(CDPATH= cd -- "$HERE/../.." && pwd)
LIB=${LEMO_LIB:-"$HOME/lemo-opuscar"}
[ -f "$LIB/core/render/video.mjs" ] || { echo 'Set LEMO_LIB to a Lemo-Opuscar checkout with its core dependencies installed.' >&2; exit 1; }
PY="$LIB/.venv/bin/python"
[ -x "$PY" ] || { echo 'Install the Lemo-Opuscar core dependencies first.' >&2; exit 1; }
"$PY" "$HERE/score.py"
cd "$REPO"
node scripts/tests/rongboy-intro.mjs
node scripts/build.mjs rongboy-intro
mkdir -p "$HERE/out/page"
cp dist/rongboy-intro.html "$HERE/out/page/index.html"
cd "$LIB"
node core/render/video.mjs "$HERE/out/page" --q render=1 --fps 24 --size 1920x1080 --workers 2 --out "$HERE/out/video.mp4"
LEMO_COLOR=bt709 sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/rongboy-intro.mp4" 24 0
ffmpeg -y -loglevel error -ss 10.3 -i "$HERE/rongboy-intro.mp4" -frames:v 1 -q:v 2 "$HERE/poster.jpg"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,nb_frames -of json "$HERE/rongboy-intro.mp4" > "$HERE/out/media-probe.json"
printf '%s\n' "$HERE/rongboy-intro.mp4"
