#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
APP_BUNDLE="$(cd "$DIR/../../.." && pwd)"
if [[ "$APP_BUNDLE" == *.app ]]; then
  APP_NAME="$(basename "$APP_BUNDLE" .app)"
  APP_EXEC="$APP_BUNDLE/Contents/MacOS/$APP_NAME"
  if [ -x "$APP_EXEC" ]; then
    ELECTRON_RUN_AS_NODE=1 exec "$APP_EXEC" "$DIR/index.mjs"
  fi
fi
exec node "$DIR/index.mjs"
