#!/bin/bash
trap "" HUP TERM
cd /home/z/my-project
export NODE_OPTIONS="--max-old-space-size=768"
while true; do
  node node_modules/.bin/next dev -p 3000 2>&1
  echo "[$(date)] Server exited, restarting in 3s..."
  sleep 3
done
