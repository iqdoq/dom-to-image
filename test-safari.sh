#!/bin/sh
# Runs the suite once in Safari (macOS only): starts Karma, points Safari at it and exits with Karma's result.
set -e
cd "$(dirname "$0")"

URL=http://localhost:9876/

./node_modules/.bin/karma start karma.safari.conf.js &
karma=$!

until curl -s -o /dev/null "$URL"; do
    kill -0 "$karma" 2>/dev/null || exit 1
    sleep 1
done

if [ -n "$CI" ]; then
    # A Safari window opened with `open` on a CI runner never lays out the page, so every render test fails.
    # Safari under safaridriver (WebDriver over curl) renders normally; the runner allows enabling it with sudo.
    sudo safaridriver --enable
    safaridriver -p 4444 &
    until curl -s -o /dev/null http://localhost:4444/status; do sleep 1; done
    session=$(curl -s -X POST -H 'Content-Type: application/json' \
        -d '{"capabilities": {"alwaysMatch": {"browserName": "safari"}}}' http://localhost:4444/session \
        | python3 -c 'import json, sys; print(json.load(sys.stdin)["value"]["sessionId"])')
    curl -s -o /dev/null -X POST -H 'Content-Type: application/json' -d "{\"url\": \"$URL\"}" \
        "http://localhost:4444/session/$session/url" &
else
    # locally Safari stays in the background and keeps the tab open afterwards
    open -g -a Safari "$URL"
fi

wait "$karma"
