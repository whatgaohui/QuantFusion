#!/usr/bin/env node
/**
 * QuantFusion Server Manager
 * Keeps the Next.js production server running with auto-restart on crash.
 * Uses `next start` for lower memory footprint.
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const MAX_RESTARTS = 50;
const RESTART_DELAY = 3000;
const HEALTH_CHECK_INTERVAL = 10000;
const HEALTH_CHECK_URL = 'http://localhost:3000/';
let restarts = 0;
let currentChild = null;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Manager] ${msg}`);
}

function startServer() {
  if (restarts >= MAX_RESTARTS) {
    log(`Max restarts (${MAX_RESTARTS}) reached. Exiting.`);
    process.exit(1);
  }

  log(`Starting Next.js production server (attempt ${restarts + 1}/${MAX_RESTARTS})...`);

  currentChild = spawn('node', ['node_modules/.bin/next', 'start', '-p', '3000'], {
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024', PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  currentChild.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  currentChild.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  currentChild.on('exit', (code, signal) => {
    log(`Server exited with code=${code} signal=${signal}`);
    currentChild = null;
    restarts++;
    setTimeout(startServer, RESTART_DELAY);
  });

  currentChild.on('error', (err) => {
    log(`Failed to start server: ${err.message}`);
    currentChild = null;
    restarts++;
    setTimeout(startServer, RESTART_DELAY);
  });

  // Write PID file for monitoring
  const pidFile = '/home/z/my-project/.next-server.pid';
  const checkInterval = setInterval(() => {
    if (currentChild && currentChild.pid) {
      writeFileSync(pidFile, String(currentChild.pid));
    }
  }, 2000);

  currentChild.on('exit', () => clearInterval(checkInterval));
}

// Health check - restart server if it's unresponsive
async function healthCheck() {
  if (!currentChild) return;

  try {
    const response = await fetch(HEALTH_CHECK_URL, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      // Server is healthy, reset restart counter
      restarts = Math.max(0, restarts - 1);
    } else {
      log(`Health check returned status ${response.status}`);
    }
  } catch (err) {
    log(`Health check failed: ${err.message}`);
    // Don't restart immediately - the exit handler will handle it
  }
}

startServer();

// Periodic health check
setInterval(healthCheck, HEALTH_CHECK_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  if (currentChild) currentChild.kill('SIGTERM');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...');
  if (currentChild) currentChild.kill('SIGTERM');
  process.exit(0);
});
