const { app, ipcMain, clipboard } = require('electron');
const net = require('net');
const fs = require('fs');
const path = require('path');

const URL_RE = /^https?:\/\/[^\s<>"{}|\\^`\[\]]+$/i;
const isWin = process.platform === 'win32';

const PIPE_NAME = '\\\\.\\pipe\\linkfetcher-native';
const PIPE_UNIX = '/tmp/linkfetcher-native.sock';

let mainWindow = null;
let extensionConnected = false;
let clipboardMonitoring = false;
let clipboardPollInterval = null;
let server = null;

function logDebug(...args) {
  const LOG_FILE = path.join(app.getPath('downloads'), 'linkfetcher-debug.log');
  const line = `[${new Date().toISOString()}] [native-msg] ${args.join(' ')}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
}

// ── Named pipe server ─────────────────────────────────────────────────────────

function startPipeServer() {
  if (server) return;

  if (!isWin) {
    try { fs.unlinkSync(PIPE_UNIX); } catch {}
  }

  server = net.createServer((client) => {
    let data = Buffer.alloc(0);

    client.on('data', (chunk) => {
      data = Buffer.concat([data, chunk]);
    });

    client.on('end', () => {
      if (data.length === 0) return;
      try {
        const msg = JSON.parse(data.toString('utf8'));
        handleMessage(msg);
      } catch {}
    });

    client.on('error', () => {});
  });

  server.on('error', (err) => {
    logDebug('Pipe server error:', err.message);
    server = null;
  });

  const pipePath = isWin ? PIPE_NAME : PIPE_UNIX;
  server.listen(pipePath, () => {
    logDebug('Pipe server listening on', pipePath);
  });
}

function stopPipeServer() {
  if (server) {
    server.close();
    server = null;
    if (!isWin) {
      try { fs.unlinkSync(PIPE_UNIX); } catch {}
    }
  }
}

// ── Handle message from extension ─────────────────────────────────────────────

function handleMessage(msg) {
  if (!msg || msg.type !== 'url-detected' || !msg.url) return;
  if (!URL_RE.test(msg.url)) return;

  extensionConnected = true;
  logDebug('URL from extension:', msg.url);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('clipboard:url-detected', msg.url);
    mainWindow.webContents.send('extension:status', true);
  }

  // Disable polling — extension is handling detection
  stopClipboardPolling();
}

// ── Clipboard polling (fallback when extension not connected) ─────────────────

function startClipboardPolling() {
  if (clipboardPollInterval || extensionConnected) return;
  clipboardMonitoring = true;

  const POLL_MS = 2000;
  let lastText = clipboard.readText() || '';

  const tick = () => {
    if (!clipboardMonitoring || extensionConnected) return;
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isFocused()) {
      clipboardPollInterval = setTimeout(tick, POLL_MS);
      return;
    }
    const current = clipboard.readText() || '';
    if (current && current !== lastText) {
      lastText = current;
      if (URL_RE.test(current)) {
        mainWindow.webContents.send('clipboard:url-detected', current);
      }
    }
    clipboardPollInterval = setTimeout(tick, POLL_MS);
  };

  clipboardPollInterval = setTimeout(tick, POLL_MS);
  logDebug('Focus-aware polling started (fallback)');
}

function stopClipboardPolling() {
  clipboardMonitoring = false;
  if (clipboardPollInterval) {
    clearTimeout(clipboardPollInterval);
    clipboardPollInterval = null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function init(mainWin) {
  mainWindow = mainWin;
  startPipeServer();
}

function startMonitoring() {
  clipboardMonitoring = true;
  if (!extensionConnected) {
    startClipboardPolling();
  }
}

function stopMonitoring() {
  clipboardMonitoring = false;
  stopClipboardPolling();
}

function registerIpcHandlers() {
  ipcMain.on('clipboard:startMonitoring', () => startMonitoring());
  ipcMain.on('clipboard:stopMonitoring', () => stopMonitoring());
  ipcMain.handle('clipboard:getText', () => clipboard.readText() || '');
  ipcMain.handle('extension:isConnected', () => extensionConnected);
}

function cleanup() {
  stopClipboardPolling();
  stopPipeServer();
}

module.exports = {
  init,
  startMonitoring,
  stopMonitoring,
  registerIpcHandlers,
  cleanup,
  isConnected: () => extensionConnected,
};
