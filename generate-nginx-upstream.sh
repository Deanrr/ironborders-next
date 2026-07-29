#!/bin/sh
# generate-nginx-upstream.sh
#
# Generates the per-worker nginx config from NUM_WORKERS at container start
# (NUM_WORKERS arrives via the runtime env file and is not known when the image
# is built, so it can't be baked into nginx.conf). Emits two things, both in the
# http context, into a single conf.d file:
#
#   1. upstream openfront_workers  - random-balanced across the live workers, so
#      nginx can spread requests (e.g. POST /api/create_game) without the caller
#      knowing the worker count.
#   2. map $worker $worker_port    - worker index -> port (3001 + index), so the
#      /wN/ locations route without a hand-maintained if-ladder.
#
# Usage: generate-nginx-upstream.sh [output_path]
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$SCRIPT_DIR/generate-nginx-upstream.mjs" "$@"
