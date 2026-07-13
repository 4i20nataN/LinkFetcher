const { spawn, execSync } = require('child_process');
const net = require('net');
const path = require('path');

const VITE_PORT = 3000;
const projectRoot = path.resolve(__dirname, '..');

function isPortFree(port) {
  return new Promise((resolve) => {
    const sock = net.createConnection(port);
    sock.on('connect', () => { sock.destroy(); resolve(false); });
    sock.on('error', () => resolve(true));
    sock.setTimeout(500, () => { sock.destroy(); resolve(true); });
  });
}

async function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8', timeout: 5000 });
      const pids = [...new Set(out.trim().split('\n').map(l => l.trim().split(/\s+/).pop()).filter(Boolean))];
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', timeout: 5000 }); } catch {}
      }
    } else {
      try { execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore', timeout: 5000 }); } catch {}
    }
  } catch {}
}

function waitForPort(port, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const sock = net.createConnection(port);
      sock.on('connect', () => { sock.destroy(); resolve(); });
      sock.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`));
        else setTimeout(check, 400);
      });
    };
    check();
  });
}

async function main() {
  // Kill anything on port 3000 first
  if (!(await isPortFree(VITE_PORT))) {
    console.log(`[electron-dev] Port ${VITE_PORT} occupied, killing...`);
    await killPort(VITE_PORT);
    await new Promise(r => setTimeout(r, 500));
  }

  // 1) Start Vite dev server
  console.log('[electron-dev] Starting Vite on port', VITE_PORT);
  const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const vite = spawn(process.execPath, [viteBin, '--port', String(VITE_PORT), '--strictPort'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  vite.stdout.pipe(process.stdout);
  vite.stderr.pipe(process.stderr);

  // 2) Wait for Vite to be ready
  try {
    await waitForPort(VITE_PORT);
    console.log('[electron-dev] Vite ready');
  } catch (err) {
    console.error('[electron-dev]', err.message);
    vite.kill();
    process.exit(1);
  }

  // 3) Start Electron
  console.log('[electron-dev] Starting Electron...');
  const electronBin = require('electron');
  const electron = spawn(electronBin, ['electron/main.cjs'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NODE_OPTIONS: '--import tsx/esm',
    },
  });

  electron.on('close', (code) => {
    vite.kill();
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    electron.kill();
    vite.kill();
    process.exit(0);
  });
}

main();
