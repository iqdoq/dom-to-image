#!/bin/sh
# Runs the suite once in Safari (macOS only) through safaridriver. Safari must allow remote automation once:
# Settings > Advanced > "Show features for web developers", then Developer > "Allow remote automation".
set -e
cd "$(dirname "$0")"

port=${SAFARIDRIVER_PORT:-4444}
safaridriver --port "$port" &
driver=$!
trap 'kill "$driver" 2>/dev/null' EXIT

until curl -s -o /dev/null "http://127.0.0.1:$port/status"; do
    kill -0 "$driver" 2>/dev/null || exit 1
    sleep 1
done

BROWSERS=safari SAFARIDRIVER_PORT="$port" npx wtr
