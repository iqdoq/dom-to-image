#!/bin/sh
# Runs the suite once in Safari (macOS only) through safaridriver. Safari must allow remote automation once:
# Settings > Advanced > "Show features for web developers", then Developer > "Allow remote automation".
set -e
cd "$(dirname "$0")"

# Suspended: since Safari 27, safaridriver cannot create a session ("The session timed out while connecting to a
# Safari instance"), also with remote automation allowed and Safari running; others report the same
# (https://groups.google.com/g/selenium-users/c/ril0bvxPDg4). Until Safari fixes it, WebKit in `npm test` is the
# closest check. SAFARI_WEBDRIVER=1 runs it anyway, to try whether a newer Safari works again.
if [ "$SAFARI_WEBDRIVER" != "1" ]; then
    echo "The Safari run is suspended: safaridriver cannot connect to Safari 27. See test-safari.sh."
    exit 0
fi

port=${SAFARIDRIVER_PORT:-4444}
safaridriver --port "$port" &
driver=$!
trap 'kill "$driver" 2>/dev/null' EXIT

until curl -s -o /dev/null "http://127.0.0.1:$port/status"; do
    kill -0 "$driver" 2>/dev/null || exit 1
    sleep 1
done

BROWSERS=safari SAFARIDRIVER_PORT="$port" npx wtr
