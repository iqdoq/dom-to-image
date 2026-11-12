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
# Locally Safari stays in the background (-g). A CI runner has no one to disturb, and a Safari window that is
# never brought to the front there does not render, so every render test times out.
if [ -n "$CI" ]; then
    open -a Safari http://localhost:9876/
else
    open -g -a Safari http://localhost:9876/
fi

wait "$karma"
