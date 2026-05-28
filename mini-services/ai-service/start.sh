#!/bin/bash
# Trap all signals and ignore them
trap '' HUP INT TERM QUIT USR1 USR2

cd /home/z/my-project/mini-services/ai-service

# Redirect stdout/stderr to log file
exec >> /tmp/ai-service.log 2>&1

echo "[$(date)] Starting AI service..."

# Run the Python server, restart on crash
while true; do
    /home/z/.venv/bin/python3 -u main.py
    EXIT_CODE=$?
    echo "[$(date)] AI service exited with code $EXIT_CODE, restarting in 2s..."
    sleep 2
done
