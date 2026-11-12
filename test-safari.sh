#!/bin/sh
# Runs the suite once in Safari (macOS only): starts Karma, points Safari at it in the background and exits
# with Karma's result. Safari keeps the tab open afterwards.
set -e
cd "$(dirname "$0")"

./node_modules/.bin/karma start karma.safari.conf.js &
karma=$!

until curl -s -o /dev/null http://localhost:9876/; do
    kill -0 "$karma" 2>/dev/null || exit 1
    sleep 1
done
open -g -a Safari http://localhost:9876/

wait "$karma"
