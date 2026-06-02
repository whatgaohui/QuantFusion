#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js dev server..." >> /tmp/keep-alive.log
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
  node ./node_modules/.bin/next dev -p 3000 >> /tmp/keep-alive-next.log 2>&1
  EXIT=$?
  echo "[$(date)] Next.js exited with code $EXIT" >> /tmp/keep-alive.log
  sleep 3
done
