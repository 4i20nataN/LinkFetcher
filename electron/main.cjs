const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const LOG_FILE = path.join(app.getPath('downloads'), 'linkfetcher-debug.log');
function logDebug(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

let mainWindow;
const cancelMap = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const htmlPath = path.join(__dirname, '..', 'index.html');
    mainWindow.loadFile(htmlPath);
  }
}

function resolveYtDlpPath() {
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const candidates = [
    process.env.YTDLP_PATH || '',
    path.join(__dirname, 'resources', binaryName),
    path.join(__dirname, '..', 'electron', 'resources', binaryName),
    path.join(app.getAppPath(), 'electron', 'resources', binaryName),
    path.join(app.getAppPath(), 'resources', binaryName),
    path.join(process.resourcesPath || process.cwd(), 'resources', binaryName),
    path.join(process.resourcesPath || process.cwd(), binaryName),
    path.join(app.getAppPath(), 'yt-dlp', binaryName),
    path.join(app.getAppPath(), binaryName),
    path.join(process.cwd(), 'electron', 'resources', binaryName),
    path.join(process.cwd(), 'yt-dlp', binaryName),
    path.join(process.cwd(), binaryName),
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function resolveFfmpegPath() {
  const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [
    process.env.FFMPEG_PATH || '',
    path.join(__dirname, 'resources', binaryName),
    path.join(__dirname, '..', 'electron', 'resources', binaryName),
    path.join(app.getAppPath(), 'electron', 'resources', binaryName),
    path.join(app.getAppPath(), 'resources', binaryName),
    path.join(process.resourcesPath || process.cwd(), 'resources', binaryName),
    path.join(process.resourcesPath || process.cwd(), binaryName),
    path.join(app.getAppPath(), 'yt-dlp', binaryName),
    path.join(app.getAppPath(), binaryName),
    path.join(process.cwd(), 'electron', 'resources', binaryName),
    path.join(process.cwd(), 'yt-dlp', binaryName),
    path.join(process.cwd(), binaryName),
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

ipcMain.handle('shell:getDownloadsPath', async () => app.getPath('downloads'));

ipcMain.handle('shell:openPath', async (_event, targetPath) => {
  if (!targetPath) return;

  const normalizedTarget = String(targetPath).trim().replace(/^['"]|['"]$/g, '');
  if (!normalizedTarget) return;

  if (fs.existsSync(normalizedTarget)) {
    const stat = fs.statSync(normalizedTarget);
    if (stat.isFile()) {
      shell.showItemInFolder(normalizedTarget);
      return;
    }
    if (stat.isDirectory()) {
      shell.openPath(normalizedTarget);
      return;
    }
  }

  const parentDir = path.dirname(normalizedTarget);
  if (parentDir && fs.existsSync(parentDir)) {
    shell.openPath(parentDir);
    return;
  }

  shell.openPath(normalizedTarget);
});

ipcMain.handle('shell:openExternal', async (_event, url) => shell.openExternal(url));

ipcMain.handle('download-file', async (_event, { url, filename }) => {
  if (!url) throw new Error('No URL provided');
  const defaultName = filename || 'thumbnail.jpg';

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (canceled || !filePath) return { canceled: true };

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return { filePath };
});

// Fetch image as base64 via main process (bypasses CORS entirely)
ipcMain.handle('fetch-image-base64', async (_event, { url }) => {
  if (!url) throw new Error('No URL provided');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || 'png';
  const mimeMap = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp' };
  const mime = mimeMap[ext] || 'image/png';
  return { base64: buffer.toString('base64'), mime };
});

// Save image from data URL (Canvas-converted) — writes buffer directly to disk
ipcMain.handle('save-image-dataurl', async (_event, { dataUrl, filename, dir }) => {
  if (!dataUrl) throw new Error('No data URL provided');
  const downloadsDir = (dir && path.isAbsolute(dir)) ? dir : app.getPath('downloads');
  const safeName = (filename || 'download').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  let filePath = path.join(downloadsDir, safeName);

  if (fs.existsSync(filePath)) {
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    let counter = 1;
    while (fs.existsSync(filePath)) {
      filePath = path.join(downloadsDir, `${base}_${counter}${ext}`);
      counter++;
    }
  }

  try {
    const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error('Invalid data URL format');
    const buffer = Buffer.from(match[1], 'base64');
    fs.writeFileSync(filePath, buffer);
    return { filePath };
  } catch (err) {
    logDebug('[save-image-dataurl] ERROR:', String(err));
    throw err;
  }
});

// Image proxy download — saves directly to default downloads folder (no dialog)
ipcMain.handle('download-file-proxy', async (_event, { url, filename, dir }) => {
  if (!url) throw new Error('No URL provided');
  const downloadsDir = (dir && path.isAbsolute(dir)) ? dir : app.getPath('downloads');
  const safeName = (filename || 'download').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  let filePath = path.join(downloadsDir, safeName);

  // Avoid overwriting: append _1, _2, etc.
  if (fs.existsSync(filePath)) {
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    let counter = 1;
    while (fs.existsSync(filePath)) {
      filePath = path.join(downloadsDir, `${base}_${counter}${ext}`);
      counter++;
    }
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return { filePath };
  } catch (err) {
    logDebug('[download-file-proxy] ERROR:', String(err));
    throw err;
  }
});

ipcMain.handle('shell:selectFolder', async (_event, defaultPath) => {
  const resolvedDefault = defaultPath && path.isAbsolute(defaultPath)
    ? defaultPath
    : app.getPath('downloads');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: resolvedDefault,
    title: 'Select Download Folder'
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('yt-dlp-probe', async (_event, args) => {
  const { probeUrl } = await import('../src/core/ytdlp/YtDlpManager.ts');
  const resolvedYtDlpPath = resolveYtDlpPath();
  const resolvedFfmpegPath = resolveFfmpegPath();
  process.env.YTDLP_PATH = resolvedYtDlpPath;
  process.env.FFMPEG_PATH = resolvedFfmpegPath;
  logDebug('[electron:probe] yt-dlp', resolvedYtDlpPath || 'missing');
  logDebug('[electron:probe] ffmpeg', resolvedFfmpegPath || 'missing');
  logDebug('[electron:probe] args', args);
  try {
    const result = await probeUrl(args);
    logDebug('[electron:probe] success', typeof result, result?.id || result?.title || '');
    return result;
  } catch (error) {
    console.error('[electron:probe] failed', error);
    throw error;
  }
});

ipcMain.handle('yt-dlp-search', async (_event, args) => {
  const { searchVideos } = await import('../src/core/ytdlp/YtDlpManager.ts');
  process.env.YTDLP_PATH = resolveYtDlpPath();
  process.env.FFMPEG_PATH = resolveFfmpegPath();
  return searchVideos(args);
});

ipcMain.handle('yt-dlp-status', async () => {
  const { getBinaryPath } = await import('../src/core/ytdlp/YtDlpManager.ts');
  const binaryPath = getBinaryPath();
  const ready = fs.existsSync(binaryPath);
  return { ready, binaryPath };
});

ipcMain.handle('yt-dlp-download', async (_event, params) => {
  logDebug('[yt-dlp-download] RECEIVED PARAMS:', JSON.stringify(params, null, 2));
  const { spawnDownload } = await import('../src/core/ytdlp/YtDlpManager.ts');
  const resolvedYtDlpPath = resolveYtDlpPath();
  const resolvedFfmpegPath = resolveFfmpegPath();
  process.env.YTDLP_PATH = resolvedYtDlpPath;
  process.env.FFMPEG_PATH = resolvedFfmpegPath;

  if (!resolvedYtDlpPath) {
    const error = 'yt-dlp não foi encontrado nas pastas do app. Verifique os binários em electron/resources.';
    logDebug('[electron] ERROR:', error);
    mainWindow?.webContents.send('yt-dlp-progress', { id: params.id, type: 'error', message: error });
    throw new Error(error);
  }

  const outputDir = params.outputDir || require('electron').app.getPath('downloads');
  logDebug('[yt-dlp-download] outputDir:', outputDir);

  const promise = new Promise((resolve, reject) => {
    const child = spawnDownload({
      url: params.url,
      outputDir,
      format: params.format,
      audioOnly: params.audioOnly,
      audioFormat: params.audioFormat,
      audioQuality: params.audioQuality,
      writeSubs: params.writeSubs,
      writeAutoSubs: params.writeAutoSubs,
      subLangs: params.subLangs,
      subFormat: params.subFormat,
      embedSubs: params.embedSubs,
      writeThumbnail: params.writeThumbnail,
      embedThumbnail: params.embedThumbnail,
      embedMetadata: params.embedMetadata,
      mergeOutputFormat: params.mergeOutputFormat,
      restrictFilenames: params.restrictFilenames,
      concurrentFragments: params.concurrentFragments,
      retries: params.retries,
      bandLimit: params.bandLimit,
      noOverwrites: params.noOverwrites,
      keepVideo: params.keepVideo,
      videoOnly: params.videoOnly,
      downloadSections: params.downloadSections,
      sponsorblockRemove: params.sponsorblockRemove,
      fpsMax: params.fpsMax,
      customFilename: params.customFilename,
      onProgress: (data) => {
        mainWindow?.webContents.send('yt-dlp-progress', { id: params.id, type: 'progress', ...data });
      },
      onComplete: (filePath) => {
        mainWindow?.webContents.send('yt-dlp-progress', { id: params.id, type: 'complete', filePath });
        resolve({ ok: true, filePath });
      },
      onError: (error) => {
        mainWindow?.webContents.send('yt-dlp-progress', { id: params.id, type: 'error', message: error });
        reject(new Error(error));
      },
    });

    if (typeof child === 'function') {
      cancelMap.set(params.id, child);
    }
  });

  const cleanup = () => { cancelMap.delete(params.id); };
  promise.finally(cleanup);
  return promise;
});

ipcMain.handle('yt-dlp-cancel', async (_event, id) => {
  try {
    const fn = cancelMap.get(id);
    if (fn) {
      fn();
      cancelMap.delete(id);
      return { ok: true };
    }
    return { ok: false, error: 'No active download' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
